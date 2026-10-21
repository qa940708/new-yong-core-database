import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  command, gitEnvironment, createArchive, captureCommits, hashFile,
  makeRunLabel, publishBackup, downloadAsset, request, main,
} from '../backup.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'github-drive-test-'));
  t.after(async () => {
    const actual = await fs.realpath(root);
    assert.equal(path.dirname(actual), await fs.realpath(os.tmpdir()));
    assert(path.basename(actual).startsWith('github-drive-test-'));
    await fs.rm(actual, { recursive: true, force: true });
  });
  const source = path.join(root, 'source');
  await fs.mkdir(source);
  const env = gitEnvironment();
  const git = (...args) => command('git', args, { cwd: source, env });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Backup Test');
  git('config', 'user.email', 'backup-test@example.invalid');
  await fs.writeFile(path.join(source, 'data.txt'), 'original\n');
  git('add', '.');
  git('commit', '-m', 'Initial content');
  const original = git('rev-parse', 'HEAD');
  git('tag', '-a', 'v1', '-m', 'Original release');
  return { root, source, env, git, original };
}

test('a whole archive restores all branches, annotated tags, history and release bytes', async (t) => {
  const f = await fixture(t);
  f.git('switch', '-c', 'feature/example');
  await fs.writeFile(path.join(f.source, 'feature.txt'), 'other branch\n');
  f.git('add', '.');
  f.git('commit', '-m', 'Feature content');
  const feature = f.git('rev-parse', 'HEAD');
  f.git('switch', 'main');
  await fs.writeFile(path.join(f.source, 'data.txt'), 'updated\n');
  f.git('add', '.');
  f.git('commit', '-m', 'Update content');
  const latest = f.git('rev-parse', 'HEAD');
  const backup = await createArchive({
    source: f.source, repository: 'owner/project', stage: path.join(f.root, 'stage'),
    label: 'test-1', event: { after: latest, ref: 'refs/heads/main' }, env: f.env,
    writeReleases: async (directory) => {
      await fs.mkdir(directory);
      await fs.writeFile(path.join(directory, 'video.asset'), 'release video');
      return [{ name: 'video.mp4', path: 'releases/video.asset' }];
    },
  });
  assert.equal(await hashFile(backup.archive), backup.sha256);
  const restored = path.join(f.root, 'restored');
  await fs.mkdir(restored);
  command('tar', ['-xzf', backup.archive, '-C', restored]);
  const mirror = path.join(restored, 'repository.git');
  const restoredGit = (...args) => command('git', args, { cwd: mirror, env: f.env });
  restoredGit('fsck', '--full');
  assert.equal(restoredGit('rev-parse', 'refs/heads/main'), latest);
  assert.equal(restoredGit('rev-parse', 'refs/heads/feature/example'), feature);
  assert.equal(restoredGit('rev-parse', 'refs/tags/v1^{}'), f.original);
  assert.equal(restoredGit('show', 'main:data.txt'), 'updated');
  assert.equal(restoredGit('show', 'v1:data.txt'), 'original');
  assert.equal(await fs.readFile(path.join(restored, 'releases/video.asset'), 'utf8'), 'release video');
  assert(!(await fs.readFile(path.join(mirror, 'config'), 'utf8')).includes('AUTHORIZATION'));
  const entries = command('tar', ['-tzf', backup.archive]);
  assert(!entries.includes('rclone.conf'));
  assert(!entries.includes('SUCCESS.json'));
});

test('rapid pushes, force pushes and deletion retain event commits even after refs move', async (t) => {
  const f = await fixture(t);
  f.git('switch', '-c', 'temporary');
  await fs.writeFile(path.join(f.source, 'temporary.txt'), 'preserve after deletion\n');
  f.git('add', '.');
  f.git('commit', '-m', 'Temporary branch');
  const deleted = f.git('rev-parse', 'HEAD');
  f.git('switch', 'main');
  f.git('branch', '-D', 'temporary');
  await fs.writeFile(path.join(f.source, 'data.txt'), 'first update\n');
  f.git('add', '.');
  f.git('commit', '-m', 'First push');
  const firstPush = f.git('rev-parse', 'HEAD');
  f.git('reset', '--hard', f.original);
  await fs.writeFile(path.join(f.source, 'data.txt'), 'force replacement\n');
  f.git('add', '.');
  f.git('commit', '-m', 'Force replacement');
  const forcePush = f.git('rev-parse', 'HEAD');
  for (const [label, event, preserved] of [
    ['rapid', { after: firstPush }, [firstPush]],
    ['force', { before: firstPush, after: forcePush, forced: true }, [firstPush, forcePush]],
    ['delete', { before: deleted, after: '0'.repeat(40), deleted: true }, [deleted]],
  ]) {
    const backup = await createArchive({
      source: f.source, repository: 'owner/project', stage: path.join(f.root, label),
      label, event, env: f.env,
    });
    for (const sha of preserved) assert(backup.manifest.capturedCommits.some((c) => c.sha === sha));
    assert(backup.manifest.refs.some((r) => r.ref.startsWith('refs/backup-events/')));
  }
});

test('LFS objects are downloaded, archived and checked by their content hash', async (t) => {
  const f = await fixture(t);
  const content = Buffer.from('The entire large binary is preserved, not just a pointer.\n');
  const oid = createHash('sha256').update(content).digest('hex');
  const objectDirectory = path.join(f.source, '.git/lfs/objects', oid.slice(0, 2), oid.slice(2, 4));
  await fs.mkdir(objectDirectory, { recursive: true });
  await fs.writeFile(path.join(objectDirectory, oid), content);
  await fs.writeFile(path.join(f.source, '.gitattributes'), '*.bin filter=lfs diff=lfs merge=lfs -text\n');
  await fs.writeFile(path.join(f.source, 'large.bin'),
    'version https://git-lfs.github.com/spec/v1\noid sha256:' + oid + '\nsize ' + content.length + '\n');
  f.git('add', '.');
  f.git('commit', '-m', 'Add LFS content');
  const backup = await createArchive({
    source: f.source, repository: 'owner/project', stage: path.join(f.root, 'stage'),
    label: 'lfs', env: f.env,
  });
  assert.equal(backup.manifest.lfsObjects, 1);
  const filename = path.join(f.root, 'stage/content/repository.git/lfs/objects',
    oid.slice(0, 2), oid.slice(2, 4), oid);
  assert.deepEqual(await fs.readFile(filename), content);
  await fs.rm(path.join(objectDirectory, oid));
  await assert.rejects(createArchive({
    source: f.source, repository: 'owner/project', stage: path.join(f.root, 'missing-lfs'),
    label: 'missing-lfs', env: f.env,
  }));
});

test('upload/quota/checksum failures never publish a success marker', async (t) => {
  const f = await fixture(t);
  const backup = {
    payload: f.source, sha256: 'a'.repeat(64), bytes: 100,
    manifest: { repository: 'owner/project', capturedAt: '2026-01-01T00:00:00Z', capturedCommits: [] },
  };
  for (const failedOperation of ['copy', 'check']) {
    const operations = [];
    const markerDirectory = path.join(f.root, failedOperation);
    await fs.mkdir(markerDirectory);
    await assert.rejects(publishBackup(backup, 'gdrive:owner/project/run', {
      markerDirectory, rclone: (args) => {
        operations.push(args[0]);
        if (args[0] === failedOperation) throw new Error('simulated upload/quota/corruption failure');
        return '';
      },
    }));
    assert(!operations.includes('copyto'));
    await assert.rejects(fs.access(path.join(markerDirectory, 'SUCCESS.json')));
  }
});

test('successful upload publishes its receipt only after byte verification', async (t) => {
  const f = await fixture(t);
  const operations = [];
  let receiptText;
  const backup = {
    payload: f.source, sha256: 'b'.repeat(64), bytes: 123,
    manifest: { repository: 'owner/project', capturedAt: '2026-01-01T00:00:00Z', capturedCommits: [] },
  };
  const syncFs = await import('node:fs');
  const receipt = await publishBackup(backup, 'gdrive:owner/project/run', {
    markerDirectory: f.root, rclone: (args) => {
      operations.push(args[0]);
      if (args[0] === 'copyto') receiptText = syncFs.readFileSync(args[1], 'utf8');
      return args[0] === 'cat' ? receiptText : '';
    },
  });
  assert.deepEqual(operations, ['copy', 'check', 'copyto', 'cat']);
  assert.equal(receipt.status, 'complete');
  assert.equal(receipt.sha256, backup.sha256);
});

test('release downloads reject truncation and corrupt bytes, and clean incomplete files', async (t) => {
  const f = await fixture(t);
  const output = path.join(f.root, 'release.asset');
  const options = {
    fetchImpl: async () => new Response('abc'), sleep: async () => {},
  };
  await assert.rejects(downloadAsset('https://example.invalid/asset', output, { size: 4 }, options));
  await assert.rejects(fs.access(output + '.partial'));
  await assert.rejects(downloadAsset('https://example.invalid/asset', output,
    { size: 3, digest: 'sha256:' + '0'.repeat(64) }, options));
  await assert.rejects(fs.access(output));
  const digest = createHash('sha256').update('abc').digest('hex');
  const result = await downloadAsset('https://example.invalid/asset', output,
    { id: 1, name: '../unsafe-name', size: 3, digest: 'sha256:' + digest }, options);
  assert.equal(result.sha256, digest);
  assert.equal(await fs.readFile(output, 'utf8'), 'abc');
});

test('transient network errors retry; authentication failures stop', async () => {
  let attempts = 0;
  const response = await request('https://example.invalid', {
    fetchImpl: async () => new Response('ok', { status: ++attempts < 3 ? 503 : 200 }),
    sleep: async () => {},
  });
  assert.equal(await response.text(), 'ok');
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(request('https://example.invalid', {
    fetchImpl: async () => { attempts++; return new Response('', { status: 401 }); },
    sleep: async () => {},
  }), /HTTP 401/);
  assert.equal(attempts, 1);
});

test('missing configuration fails before contacting Drive or creating an archive', async () => {
  await assert.rejects(main([], {
    GITHUB_REPOSITORY: 'owner/project', BACKUP_GITHUB_TOKEN: 'test-token',
    GDRIVE_FOLDER_ID: '18VBKe_iQVWt2KbtjUxyYd1b5NgTbSsUe',
  }), /Drive is not configured/);
  assert.deepEqual(captureCommits({ after: '0'.repeat(40), deleted: true }), []);
  assert.throws(() => captureCommits({ after: '--malicious' }));
  assert.notEqual(makeRunLabel('123', 1), makeRunLabel('123', 2));
});
