import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { command, gitEnvironment, createArchive } from '../backup.mjs';
import { TARGET_MARKER, LOCAL_RESTORE, fingerprint, runOnce, publishLocal } from '../local-backup.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'desktop-backup-test-'));
  t.after(async () => {
    const actual = await fs.realpath(root);
    assert.equal(path.dirname(actual), await fs.realpath(os.tmpdir()));
    assert(path.basename(actual).startsWith('desktop-backup-test-'));
    await fs.rm(actual, { recursive: true, force: true });
  });
  const source = path.join(root, 'source');
  const driveFolder = path.join(root, 'drive');
  await fs.mkdir(source);
  await fs.mkdir(driveFolder);
  const config = { version: 1, driveFolder, targetId: randomUUID(),
    stateDirectory: path.join(root, 'state'), repositories: ['owner/project'] };
  await fs.writeFile(path.join(driveFolder, TARGET_MARKER),
    JSON.stringify({ application: 'GitHubDriveBackup', targetId: config.targetId }));
  const env = gitEnvironment();
  const git = (...args) => command('git', args, { cwd: source, env });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Backup Test');
  git('config', 'user.email', 'test@example.invalid');
  await fs.writeFile(path.join(source, 'data.txt'), 'initial\n');
  git('add', '.');
  git('commit', '-m', 'Initial');
  git('tag', 'v1');
  const releases = [{ id: 1, name: 'Release', tag_name: 'v1', body: 'Description', assets: [] }];
  const refs = () => git('for-each-ref', '--format=%(refname) %(objectname)')
    .split(/\r?\n/).map(line => { const [ref, sha] = line.split(' '); return { ref, sha }; });
  let builds = 0;
  const snapshot = async () => ({ fingerprint: fingerprint(refs(), releases) });
  const build = async (repository, stage, label) => {
    builds++;
    const backup = await createArchive({ source, repository, stage, label, env,
      restoreInstructions: LOCAL_RESTORE,
      writeReleases: async (directory) => {
        await fs.mkdir(directory);
        await fs.writeFile(path.join(directory, 'index.json'), JSON.stringify(releases));
        return [];
      },
    });
    return { ...backup, fingerprint: fingerprint(backup.manifest.refs, releases) };
  };
  const options = { snapshot, build, log: () => {} };
  const state = async () => JSON.parse(await fs.readFile(path.join(config.stateDirectory, 'state.json'), 'utf8'));
  return { root, source, driveFolder, config, git, env, releases, options, state, builds: () => builds };
}

test('local backups restore history, skip unchanged data, detect releases and repair a missing copy', async t => {
  const f = await fixture(t);
  const first = await runOnce(f.config, f.options);
  const destination = path.join(f.driveFolder, first.repositories[0].relativePath);
  assert.equal(first.repositories[0].status, 'local-copy-verified');
  const receipt = JSON.parse(await fs.readFile(path.join(destination, 'LOCAL_SUCCESS.json')));
  assert.equal(receipt.status, 'local-copy-verified');
  assert.match(receipt.cloudSync, /not verified/);
  await assert.rejects(fs.access(path.join(destination, 'SUCCESS.json')));
  const restore = path.join(f.root, 'restored');
  await fs.mkdir(restore);
  command('tar', ['-xzf', path.join(destination, 'repository.tar.gz'), '-C', restore]);
  const mirror = path.join(restore, 'repository.git');
  command('git', ['fsck', '--full'], { cwd: mirror, env: f.env });
  assert.equal(command('git', ['show', 'v1:data.txt'], { cwd: mirror, env: f.env }), 'initial');
  const instructions = await fs.readFile(path.join(restore, 'RESTORE.txt'), 'utf8');
  assert.match(instructions, /LOCAL_SUCCESS\.json/);
  assert.match(instructions, /does NOT confirm/);
  assert.equal((await runOnce(f.config, f.options)).repositories[0].status, 'unchanged');
  assert.equal(f.builds(), 1);
  f.releases[0].body = 'Updated release description';
  await runOnce(f.config, f.options);
  assert.equal(f.builds(), 2);
  const latest = (await f.state()).repositories['owner/project'].relativePath;
  await fs.unlink(path.join(f.driveFolder, latest, 'repository.tar.gz'));
  await runOnce(f.config, f.options);
  assert.equal(f.builds(), 3);
});

test('a wrong or disconnected Drive target cannot advance successful state', async t => {
  const f = await fixture(t);
  await runOnce(f.config, f.options);
  const before = await f.state();
  await fs.writeFile(path.join(f.driveFolder, TARGET_MARKER),
    JSON.stringify({ application: 'GitHubDriveBackup', targetId: randomUUID() }));
  await assert.rejects(runOnce(f.config, f.options));
  assert.equal(f.builds(), 1);
  assert.deepEqual(await f.state(), before);
  await fs.unlink(path.join(f.driveFolder, TARGET_MARKER));
  await assert.rejects(runOnce(f.config, f.options));
  assert.deepEqual(await f.state(), before);
});

test('copy corruption never gets a completion receipt or replaces successful state', async t => {
  const f = await fixture(t);
  await runOnce(f.config, f.options);
  const before = await f.state();
  f.releases[0].body = 'Change requiring a backup';
  let failedDestination;
  await assert.rejects(runOnce(f.config, { ...f.options,
    publish: (backup, config, label) => publishLocal(backup, config, label, {
      copyFile: async (source, destination, flags) => {
        failedDestination = path.dirname(destination);
        await fs.copyFile(source, destination, flags);
        await fs.appendFile(destination, 'corruption');
      },
    }),
  }));
  await assert.rejects(fs.access(path.join(failedDestination, 'LOCAL_SUCCESS.json')));
  assert.deepEqual(await f.state(), before);
});

test('state records the captured commit when the repository changes during backup', async t => {
  const f = await fixture(t);
  let changed = false;
  const options = { ...f.options, build: async (...args) => {
    if (!changed) {
      await fs.writeFile(path.join(f.source, 'data.txt'), 'changed during capture\n');
      f.git('add', '.');
      f.git('commit', '-m', 'Concurrent change');
      changed = true;
    }
    return f.options.build(...args);
  } };
  await runOnce(f.config, options);
  assert.equal((await f.state()).repositories['owner/project'].fingerprint,
    (await f.options.snapshot()).fingerprint);
  assert.equal((await runOnce(f.config, options)).repositories[0].status, 'unchanged');
  assert.equal(f.builds(), 1);
});
