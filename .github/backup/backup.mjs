import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const API = 'https://api.github.com';
const ZERO = /^0+$/;
const SHA = /^[a-f0-9]{40,64}$/;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function command(program, args, options = {}) {
  const result = spawnSync(program, args, {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    timeout: 30 * 60 * 1000, windowsHide: true, ...options,
  });
  // Do not include child output in errors: tools can echo credential configuration.
  if (result.error || result.status !== 0) {
    throw new Error(program + ' ' + args[0] + ' failed (exit ' +
      (result.status ?? result.error?.code ?? 'unknown') + ').');
  }
  return result.stdout.trim();
}

export function validateRepository(repository) {
  assert(/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9_.-]+$/.test(repository),
    'Expected a GitHub repository in owner/name form.');
  assert(!['.', '..'].includes(repository.split('/')[1]), 'Invalid repository name.');
  return repository;
}

export function gitEnvironment(token = '') {
  const env = {
    ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_LFS_SKIP_SMUDGE: '1', GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: 'core.hooksPath', GIT_CONFIG_VALUE_1: '/dev/null',
  };
  if (token) {
    env.GIT_CONFIG_COUNT = '3';
    env.GIT_CONFIG_KEY_2 = 'http.https://github.com/.extraheader';
    env.GIT_CONFIG_VALUE_2 = 'AUTHORIZATION: basic ' +
      Buffer.from('x-access-token:' + token).toString('base64');
  }
  return env;
}

export async function hashFile(filename, algorithm = 'sha256') {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

export function captureCommits(event, fallback = '') {
  const candidates = event.after !== undefined
    ? [['after', event.after], ...((event.forced || event.deleted) ? [['before', event.before]] : [])]
    : [['trigger', fallback]];
  return candidates.filter(([, sha]) => sha && !ZERO.test(sha)).map(([label, sha]) => {
    assert(SHA.test(sha), 'Invalid triggering commit.');
    return { label, sha };
  });
}

export function makeRunLabel(runId, attempt, now = new Date()) {
  assert(/^[A-Za-z0-9_-]+$/.test(String(runId)), 'Invalid run identifier.');
  assert(/^\d+$/.test(String(attempt)), 'Invalid run attempt.');
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') +
    '-' + runId + '-' + attempt;
}

export async function request(url, { token = '', accept = 'application/vnd.github+json',
  timeout = 60000, fetchImpl = fetch, sleep = pause } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: accept, 'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'whole-repository-drive-backup',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        signal: AbortSignal.timeout(timeout), redirect: 'follow',
      });
    } catch {
      if (attempt === 2) throw new Error('GitHub request failed after three attempts.');
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (response.ok) return response;
    const transient = response.status === 429 || response.status >= 500 ||
      (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
    await response.body?.cancel();
    if (!transient || attempt === 2) {
      throw new Error('GitHub request failed (HTTP ' + response.status + ').');
    }
    const seconds = Number(response.headers.get('retry-after')) || (attempt + 1) * 2;
    await sleep(Math.min(Math.max(seconds, 1), 60) * 1000);
  }
}

export async function listReleases(repository, token) {
  const releases = [];
  for (let page = 1; ; page++) {
    const response = await request(API + '/repos/' + repository +
      '/releases?per_page=100&page=' + page, { token });
    const batch = await response.json();
    assert(Array.isArray(batch), 'Unexpected releases response.');
    // Assets have a separate paginated endpoint; embedded assets can be incomplete.
    for (const release of batch) {
      assert(Number.isSafeInteger(release.id) && release.id > 0, 'Invalid release ID.');
      const assets = [];
      for (let assetPage = 1; ; assetPage++) {
        const assetResponse = await request(API + '/repos/' + repository +
          '/releases/' + release.id + '/assets?per_page=100&page=' + assetPage, { token });
        const assetBatch = await assetResponse.json();
        assert(Array.isArray(assetBatch), 'Unexpected assets response.');
        assets.push(...assetBatch);
        if (assetBatch.length < 100) break;
      }
      releases.push({ ...release, assets });
    }
    if (batch.length < 100) break;
  }
  return releases;
}

export function releaseSignature(releases) {
  return JSON.stringify(releases.map((r) => ({
    id: r.id, tag: r.tag_name, name: r.name, body: r.body,
    draft: r.draft, prerelease: r.prerelease, updated: r.updated_at,
    assets: r.assets.map((a) => ({
      id: a.id, name: a.name, size: a.size, updated: a.updated_at, digest: a.digest,
    })).sort((a, b) => a.id - b.id),
  })).sort((a, b) => a.id - b.id));
}

export async function downloadAsset(url, destination, asset, options = {}) {
  const temporary = destination + '.partial';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(url, {
        ...options, accept: 'application/octet-stream', timeout: 20 * 60 * 1000,
      });
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx' }));
      const size = (await fs.stat(temporary)).size;
      assert.equal(size, asset.size, 'Release asset size mismatch.');
      const sha256 = await hashFile(temporary);
      if (asset.digest) {
        assert(asset.digest.startsWith('sha256:'), 'Unsupported release asset digest.');
        assert.equal(sha256, asset.digest.slice(7), 'Release asset checksum mismatch.');
      }
      await fs.rename(temporary, destination);
      return { id: asset.id, name: asset.name, bytes: size, sha256 };
    } catch (error) {
      await fs.rm(temporary, { force: true });
      if (attempt === 2) throw error;
      await (options.sleep || pause)(1000 * (attempt + 1));
    }
  }
}

export async function backupReleases(directory, repository, token) {
  const releases = await listReleases(repository, token);
  const files = [];
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'index.json'), JSON.stringify(releases, null, 2) + '\n');
  for (const release of releases) {
    const target = path.join(directory, String(release.id));
    await fs.mkdir(target);
    await fs.writeFile(path.join(target, 'metadata.json'), JSON.stringify(release, null, 2) + '\n');
    for (const asset of release.assets) {
      assert(Number.isSafeInteger(asset.id) && asset.id > 0, 'Invalid asset ID.');
      // Numeric IDs prevent traversal and collisions; metadata preserves original names.
      const filename = String(asset.id) + '.asset';
      const saved = await downloadAsset(API + '/repos/' + repository +
        '/releases/assets/' + asset.id, path.join(target, filename), asset, { token });
      files.push({ ...saved, path: 'releases/' + release.id + '/' + filename });
    }
  }
  const after = await listReleases(repository, token);
  assert.equal(releaseSignature(after), releaseSignature(releases),
    'Releases changed during backup. Run the backup again.');
  return files;
}

export async function verifyLfs(mirror, env) {
  command('git', ['lfs', 'fetch', '--all'], { cwd: mirror, env });
  const output = command('git', ['lfs', 'ls-files', '--all', '--long'], { cwd: mirror, env });
  const ids = [...new Set(output.split(/\r?\n/).map((line) =>
    line.match(/^([a-f0-9]{64}) /)?.[1]).filter(Boolean))];
  for (const id of ids) {
    const filename = path.join(mirror, 'lfs', 'objects', id.slice(0, 2), id.slice(2, 4), id);
    assert.equal(await hashFile(filename), id, 'Missing or corrupt Git LFS content.');
  }
  return ids.length;
}

export const RESTORE = [
  'WHOLE REPOSITORY BACKUP',
  '',
  'Only use a backup folder containing SUCCESS.json. Verify repository.tar.gz against',
  'SHA256SUMS, then extract the archive. manifest.json records captured refs and checksums.',
  '',
  'Restore files locally:',
  '  GIT_LFS_SKIP_SMUDGE=1 git clone repository.git restored',
  '  If repository.git/lfs exists, copy it into restored/.git/lfs, then run:',
  '  git -C restored lfs checkout',
  '',
  'Restore branches and tags to a NEW, EMPTY GitHub repository:',
  "  git -C repository.git push NEW_URL 'refs/heads/*:refs/heads/*' 'refs/tags/*:refs/tags/*'",
  '  git -C repository.git lfs push --all NEW_URL',
  '',
  'refs/backup-events preserves the triggering commits, including before a force push',
  'or branch deletion. Inspect with git -C repository.git show-ref.',
  'Create a recovery branch from one of these refs if needed; do not overwrite live history.',
  '',
  'Release files are stored by numeric ID under releases/. Their original filenames,',
  'tags and descriptions are in releases/index.json and per-release metadata.json.',
  'Recreate releases and upload each .asset file using its recorded original filename.',
  '',
  'This contains committed Git content and release assets. GitHub issues, PR discussions,',
  'repository settings/secrets and uncommitted local files are not exported.',
].join('\n') + '\n';

export async function createArchive({ source, repository, stage, label, event = {},
  fallbackSha = '', env = gitEnvironment(), writeReleases = async () => [],
  restoreInstructions = RESTORE }) {
  validateRepository(repository);
  assert(/^[A-Za-z0-9_-]+$/.test(label), 'Invalid backup label.');
  const content = path.join(stage, 'content');
  const payload = path.join(stage, 'payload');
  await fs.mkdir(content, { recursive: true });
  await fs.mkdir(payload, { recursive: true });
  const mirror = path.join(content, 'repository.git');
  command('git', ['clone', '--mirror', '--no-local', source, mirror], { env });
  const captured = captureCommits(event, fallbackSha);
  for (const { label: name, sha } of captured) {
    try {
      command('git', ['cat-file', '-e', sha + '^{object}'], { cwd: mirror, env });
    } catch {
      command('git', ['fetch', '--no-tags', 'origin', sha], { cwd: mirror, env });
    }
    command('git', ['update-ref', 'refs/backup-events/' + label + '/' + name, sha], { cwd: mirror, env });
  }
  command('git', ['fsck', '--full'], { cwd: mirror, env });
  const lfsObjects = await verifyLfs(mirror, env);
  const refs = command('git', ['for-each-ref', '--format=%(refname) %(objectname)'], { cwd: mirror, env })
    .split(/\r?\n/).filter(Boolean).map((line) => {
      const [ref, sha] = line.split(' ');
      return { ref, sha };
    });
  const releaseFiles = await writeReleases(path.join(content, 'releases'));
  const manifest = {
    formatVersion: 1, repository, capturedAt: new Date().toISOString(), label,
    source: 'https://github.com/' + repository,
    event: { ref: event.ref || null, before: event.before || null, after: event.after || null,
      forced: Boolean(event.forced), deleted: Boolean(event.deleted) },
    capturedCommits: captured, refs, lfsObjects, releaseFiles,
  };
  await fs.writeFile(path.join(content, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(path.join(content, 'RESTORE.txt'), restoreInstructions);
  const archive = path.join(payload, 'repository.tar.gz');
  command('tar', ['-czf', archive, '-C', content, '.']);
  command('tar', ['-tzf', archive]); // Validate the completed archive before upload.
  const sha256 = await hashFile(archive);
  const bytes = (await fs.stat(archive)).size;
  await fs.writeFile(path.join(payload, 'SHA256SUMS'), sha256 + '  repository.tar.gz\n');
  await fs.writeFile(path.join(payload, 'RESTORE.txt'), restoreInstructions);
  return { payload, archive, sha256, bytes, manifest };
}

export async function publishBackup(backup, remote, { rclone, markerDirectory }) {
  rclone(['copy', backup.payload, remote, '--immutable']);
  // Download verification checks bytes, including backends that lack useful hashes.
  rclone(['check', backup.payload, remote, '--one-way', '--download']);
  const receipt = {
    status: 'complete', repository: backup.manifest.repository,
    capturedAt: backup.manifest.capturedAt, verifiedAt: new Date().toISOString(),
    archive: 'repository.tar.gz', sha256: backup.sha256, bytes: backup.bytes,
    capturedCommits: backup.manifest.capturedCommits,
  };
  const filename = path.join(markerDirectory, 'SUCCESS.json');
  await fs.writeFile(filename, JSON.stringify(receipt, null, 2) + '\n');
  rclone(['copyto', filename, remote + '/SUCCESS.json', '--immutable']);
  const readback = JSON.parse(rclone(['cat', remote + '/SUCCESS.json']));
  assert.deepEqual(readback, receipt, 'Backup completion marker verification failed.');
  return receipt;
}

async function removePrivateTemp(directory) {
  const actual = await fs.realpath(directory);
  const parent = await fs.realpath(os.tmpdir());
  assert.equal(path.dirname(actual), parent, 'Refusing cleanup outside the temporary directory.');
  assert(path.basename(actual).startsWith('github-drive-backup-'), 'Unexpected temporary directory.');
  await fs.rm(actual, { recursive: true, force: true });
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  const verifyOnly = args.includes('--verify-only');
  const outputIndex = args.indexOf('--output');
  assert(outputIndex < 0 || Boolean(args[outputIndex + 1]), '--output requires a directory.');
  const output = outputIndex >= 0 ? path.resolve(args[outputIndex + 1]) : null;
  assert(args.every((arg, index) => ['--verify-only', '--output'].includes(arg) ||
    (outputIndex >= 0 && index === outputIndex + 1)), 'Unknown argument.');
  assert(!verifyOnly || output, '--verify-only requires --output DIRECTORY.');
  const repository = validateRepository(environment.GITHUB_REPOSITORY || '');
  const token = environment.BACKUP_GITHUB_TOKEN || '';
  const folderId = environment.GDRIVE_FOLDER_ID || '';
  if (!verifyOnly) {
    assert(token, 'BACKUP_GITHUB_TOKEN is missing.');
    assert(/^[A-Za-z0-9_-]{10,}$/.test(folderId), 'GDRIVE_FOLDER_ID is missing or invalid.');
    assert(environment.GDRIVE_RCLONE_CONFIG?.trim(),
      'Drive is not configured. Use .github/backup/setup-local.ps1 for Google Drive for desktop backups.');
  }
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'github-drive-backup-'));
  try {
    const label = makeRunLabel(environment.GITHUB_RUN_ID || ('local-' + randomUUID()),
      environment.GITHUB_RUN_ATTEMPT || '1');
    let rclone;
    if (!verifyOnly) {
      const config = path.join(stage, 'rclone.conf');
      await fs.writeFile(config, environment.GDRIVE_RCLONE_CONFIG, { mode: 0o600 });
      rclone = (argv) => command(environment.RCLONE_BINARY || 'rclone', [
        ...argv, '--config', config, '--drive-root-folder-id', folderId,
        '--retries', '3', '--low-level-retries', '10', '--log-level', 'ERROR',
      ]);
      assert(rclone(['listremotes']).split(/\r?\n/).includes('gdrive:'),
        'The rclone configuration must contain a remote named gdrive.');
      rclone(['lsf', 'gdrive:', '--max-depth', '1']);
    }
    const metadata = await (await request(API + '/repos/' + repository, { token })).json();
    assert.equal(metadata.full_name.toLowerCase(), repository.toLowerCase(), 'Unexpected source repository.');
    const event = environment.GITHUB_EVENT_PATH
      ? JSON.parse(await fs.readFile(environment.GITHUB_EVENT_PATH, 'utf8')) : {};
    console.log('Creating a complete Git and release backup for ' + repository + '.');
    const backup = await createArchive({
      source: 'https://github.com/' + repository + '.git', repository, stage, label,
      event, fallbackSha: environment.GITHUB_SHA || '', env: gitEnvironment(token),
      writeReleases: (directory) => backupReleases(directory, repository, token),
    });
    if (verifyOnly) {
      await fs.mkdir(output, { recursive: true });
      const destination = path.join(output, label);
      await fs.cp(backup.payload, destination, { recursive: true, errorOnExist: true, force: false });
      console.log('Local verification archive: ' + destination);
      console.log('No Google Drive upload was attempted; this is not an activated backup.');
      return { verifyOnly: true, destination, ...backup, manifest: backup.manifest };
    }
    const remote = 'gdrive:' + repository + '/' + label;
    await publishBackup(backup, remote, { rclone, markerDirectory: stage });
    const summary = 'Verified whole-repository backup: ' + repository + '\n\n' +
      '- Drive folder: https://drive.google.com/drive/folders/' + folderId + '\n' +
      '- Backup path: ' + repository + '/' + label + '\n' +
      '- Archive bytes: ' + backup.bytes + '\n' +
      '- SHA-256: ' + backup.sha256 + '\n' +
      '- Git refs: ' + backup.manifest.refs.length + '\n' +
      '- LFS objects: ' + backup.manifest.lfsObjects + '\n' +
      '- Release files: ' + backup.manifest.releaseFiles.length + '\n';
    if (environment.GITHUB_STEP_SUMMARY) await fs.appendFile(environment.GITHUB_STEP_SUMMARY, summary);
    console.log(summary);
    return { verifyOnly: false, remote, sha256: backup.sha256 };
  } finally {
    await removePrivateTemp(stage);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Backup FAILED: ' + error.message);
    process.exitCode = 1;
  });
}
