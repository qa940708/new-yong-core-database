import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RESTORE, command, validateRepository, gitEnvironment, hashFile, listReleases,
  releaseSignature, createArchive, backupReleases, makeRunLabel,
} from './backup.mjs';

export const TARGET_MARKER = '.github-drive-backup-target.json';
export const LOCAL_RESTORE = [
  'LOCAL BACKUP SYNCHRONIZED BY GOOGLE DRIVE FOR DESKTOP',
  '',
  'LOCAL_SUCCESS.json confirms the archive was copied and verified on this PC.',
  'It does NOT confirm that Google Drive has finished uploading every file.',
  'Check Drive for desktop shows the backup fully synced before relying on the cloud copy.',
  'Verify repository.tar.gz against SHA256SUMS before extracting and restoring.',
  '',
  RESTORE.slice(RESTORE.indexOf('Restore files locally:')).replace(
    /refs\/backup-events preserves[\s\S]*?do not overwrite live history\.\n/,
    'This is a periodic snapshot. Commits removed by force pushes or branch deletion\n' +
    'between checks may be missed. Earlier backup archives remain independent.\n'),
].join('\n');

function within(root, ...segments) {
  const destination = path.resolve(root, ...segments);
  const relative = path.relative(path.resolve(root), destination);
  assert(relative && relative !== '..' && !relative.startsWith('..' + path.sep) &&
    !path.isAbsolute(relative), 'Path must remain inside its backup directory.');
  return destination;
}

async function readJson(filename, fallback) {
  try { return JSON.parse((await fs.readFile(filename, 'utf8')).replace(/^\uFEFF/, '')); }
  catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

async function saveJson(filename, value) {
  const temporary = filename + '.' + randomUUID() + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await fs.rename(temporary, filename);
}

export function fingerprint(refs, releases) {
  const refText = refs.map((r) => r.ref + ' ' + r.sha).sort().join('\n');
  return createHash('sha256').update(refText + '\n' + releaseSignature(releases)).digest('hex');
}

export async function checkTarget(config) {
  assert(path.isAbsolute(config.driveFolder), 'The Drive folder must be an absolute path.');
  assert(/^[a-f0-9-]{36}$/i.test(config.targetId), 'Invalid target marker ID.');
  const marker = await readJson(path.join(config.driveFolder, TARGET_MARKER));
  assert.equal(marker.application, 'GitHubDriveBackup', 'This is not the configured backup folder.');
  assert.equal(marker.targetId, config.targetId, 'The Drive folder changed. Recheck its location.');
  return config.driveFolder;
}

export async function readSnapshot(repository, token) {
  const output = command('git', ['ls-remote', '--refs', 'https://github.com/' + repository + '.git'],
    { env: gitEnvironment(token) });
  const refs = output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [sha, ref] = line.split(/\s+/);
    assert(/^[a-f0-9]{40,64}$/.test(sha) && ref.startsWith('refs/'), 'Invalid remote ref.');
    return { ref, sha };
  });
  return { fingerprint: fingerprint(refs, await listReleases(repository, token)) };
}

export async function buildSnapshot(repository, stage, label, token) {
  const backup = await createArchive({
    source: 'https://github.com/' + repository + '.git', repository, stage, label,
    env: gitEnvironment(token), restoreInstructions: LOCAL_RESTORE,
    writeReleases: (directory) => backupReleases(directory, repository, token),
  });
  const releases = await readJson(path.join(stage, 'content', 'releases', 'index.json'));
  // Save the actual captured data, not the earlier change-detection result.
  return { ...backup, fingerprint: fingerprint(backup.manifest.refs, releases) };
}

export async function publishLocal(backup, config, label, { copyFile = fs.copyFile } = {}) {
  await checkTarget(config);
  const destination = within(config.driveFolder, backup.manifest.repository, label);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.mkdir(destination);
  for (const filename of ['repository.tar.gz', 'SHA256SUMS', 'RESTORE.txt']) {
    const source = path.join(backup.payload, filename);
    const copied = path.join(destination, filename);
    await copyFile(source, copied, constants.COPYFILE_EXCL);
    const expected = filename === 'repository.tar.gz' ? backup.sha256 : await hashFile(source);
    assert.equal(await hashFile(copied), expected, 'Copied file failed verification: ' + filename);
  }
  const receipt = {
    version: 1, status: 'local-copy-verified',
    cloudSync: 'Google Drive for desktop handles upload; remote completion is not verified by this receipt.',
    repository: backup.manifest.repository, capturedAt: backup.manifest.capturedAt,
    localVerifiedAt: new Date().toISOString(), archive: 'repository.tar.gz',
    sha256: backup.sha256, bytes: backup.bytes, fingerprint: backup.fingerprint,
  };
  const receiptFile = path.join(destination, 'LOCAL_SUCCESS.json');
  await fs.writeFile(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  assert.deepEqual(await readJson(receiptFile), receipt, 'Local receipt verification failed.');
  return { destination, receipt };
}

async function hasPreviousCopy(config, previous) {
  if (!previous?.relativePath) return false;
  try {
    const directory = within(config.driveFolder, previous.relativePath);
    const receipt = await readJson(path.join(directory, 'LOCAL_SUCCESS.json'));
    const archive = await fs.stat(path.join(directory, 'repository.tar.gz'));
    const checksum = await fs.readFile(path.join(directory, 'SHA256SUMS'), 'utf8');
    await fs.access(path.join(directory, 'RESTORE.txt'));
    return receipt.status === 'local-copy-verified' && receipt.sha256 === previous.sha256 &&
      receipt.fingerprint === previous.fingerprint && archive.size === receipt.bytes &&
      checksum.trim() === receipt.sha256 + '  repository.tar.gz';
  } catch { return false; }
}

export async function runOnce(config, {
  snapshot = readSnapshot, build = buildSnapshot, publish = publishLocal, log = console.log,
} = {}) {
  assert.equal(config.version, 1, 'Unsupported local backup configuration.');
  assert(path.isAbsolute(config.stateDirectory), 'State directory must be absolute.');
  assert(Array.isArray(config.repositories) && config.repositories.length, 'No repositories configured.');
  config.repositories.forEach(validateRepository);
  await fs.mkdir(config.stateDirectory, { recursive: true });
  const stateFile = path.join(config.stateDirectory, 'state.json');
  const statusFile = path.join(config.stateDirectory, 'status.json');
  const state = await readJson(stateFile, { version: 1, repositories: {} });
  const status = { startedAt: new Date().toISOString(), destination: config.driveFolder, repositories: [] };
  const workRoot = path.join(config.stateDirectory, 'work');
  await fs.mkdir(workRoot, { recursive: true });
  let token = '';
  if (config.githubTokenFile) token = (await fs.readFile(config.githubTokenFile, 'utf8')).trim();
  for (const repository of config.repositories) {
    let stage;
    try {
      await checkTarget(config);
      log('Checking ' + repository + '.');
      const current = await snapshot(repository, token);
      const previous = state.repositories[repository];
      if (previous?.fingerprint === current.fingerprint && await hasPreviousCopy(config, previous)) {
        status.repositories.push({ repository, status: 'unchanged', relativePath: previous.relativePath });
        log('No changes; keeping the existing backup.');
        continue;
      }
      stage = await fs.mkdtemp(path.join(workRoot, 'snapshot-'));
      const label = makeRunLabel('desktop-' + randomUUID(), '1');
      log('Creating a complete archive for ' + repository + '.');
      const backup = await build(repository, stage, label, token);
      assert(/^[a-f0-9]{64}$/.test(backup.fingerprint), 'Missing captured-data fingerprint.');
      const saved = await publish(backup, config, label);
      const relativePath = path.relative(config.driveFolder, saved.destination);
      state.repositories[repository] = {
        fingerprint: backup.fingerprint, sha256: backup.sha256,
        bytes: backup.bytes, relativePath, localVerifiedAt: saved.receipt.localVerifiedAt,
      };
      await saveJson(stateFile, state);
      status.repositories.push({ repository, status: 'local-copy-verified', relativePath, bytes: backup.bytes });
      log('Local backup verified: ' + saved.destination);
      log('Google Drive for desktop will sync these files. Check its sync status for cloud completion.');
    } catch (error) {
      status.repositories.push({ repository, status: 'failed', error: error.message });
      log('Backup failed for ' + repository + ': ' + error.message);
    } finally {
      if (stage) {
        const actual = await fs.realpath(stage);
        assert.equal(path.dirname(actual), await fs.realpath(workRoot), 'Unsafe cleanup directory.');
        assert(path.basename(actual).startsWith('snapshot-'), 'Unsafe cleanup name.');
        await fs.rm(actual, { recursive: true, force: true });
      }
    }
  }
  status.finishedAt = new Date().toISOString();
  await saveJson(statusFile, status);
  if (status.repositories.some((r) => r.status === 'failed')) throw new Error('Backup failed; see ' + statusFile);
  return status;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  Promise.resolve().then(async () => {
    assert(args.length === 2 && args[0] === '--config', 'Usage: local-backup.mjs --config FILE');
    await runOnce(await readJson(path.resolve(args[1])));
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
