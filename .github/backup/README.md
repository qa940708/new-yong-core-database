# Whole-repository backups through Google Drive for desktop

Windows checks the configured GitHub repositories every 15 minutes and after sign-in.
A change to any advertised Git ref or release creates a complete, independent archive.
Google Drive for desktop synchronizes the archive from the chosen folder to Drive.

This replaces the previous GitHub Actions uploader. The cloud backup workflow was
removed from all four existing branches; Google Cloud OAuth setup is no longer used.

## Install or add a repository

Install Google Drive for desktop and sign in. Open the intended backup folder in
Windows File Explorer. Git with Git LFS, Node 20 or newer, and tar must be installed.
Run the installer from PowerShell:

    powershell -NoProfile -ExecutionPolicy Bypass -File .github/backup/setup-local.ps1 -DriveFolder "G:\My Drive\GitHub Backups" -Repository qa940708/new-yong-core-database

For a future repository, rerun with its owner/name. Existing configured repositories
are retained. Current public-repository reads do not require GitHub authentication.
A private repository needs a read-capable GitHub token in a local protected file,
passed with -GitHubTokenFile. Keep that file outside the repository and synced folder.
Never paste its contents into chat or place it in the backup archive.

The installer copies the program and configuration into
LOCALAPPDATA/GitHubDriveBackup/local, restricts access to the Windows user and system,
and registers the GitHub Drive Backup scheduled task. It runs under the signed-in
user, without storing a Windows password. A hidden launcher prevents overlapping runs.
It runs after sign-in and every 15 minutes while the PC is awake and the user is signed in.
Drive must be available at the configured path. A marker identifies the destination
so a reused drive letter cannot silently redirect a backup elsewhere.

## Backup contents and completion

Each archive includes all committed files and Git history, branches and tags, all
referenced Git LFS objects, and release metadata and downloadable release assets.
Copies have this layout inside the selected Drive folder:

    <owner>/<repository>/<UTC timestamp>-desktop-<unique ID>-1/
        repository.tar.gz
        SHA256SUMS
        RESTORE.txt
        LOCAL_SUCCESS.json

The archive is built outside the synced folder, checked, copied, and checked again.
LOCAL_SUCCESS.json is written last and verifies only the copy on this PC.
Google Drive for desktop uploads asynchronously: check its sync status and the files
in Drive before relying on the cloud copy. The local receipt does not prove remote
upload completion. Incomplete copies have no receipt and must not be used for restore.

No automatic deletion or retention pruning is enabled. Each complete copy currently
uses roughly 371 MB; storage grows when repository content changes. Unchanged checks
do not create duplicate copies. Deleting the latest local backup causes a fresh copy
to be created at the next check. Changes and deletions within a Drive-synced folder
also synchronize; treat the archive folders as backup data, not a working checkout.

## Limits

This is polling, not an event handler for every push. Normal history is preserved,
but a branch or commit removed by force push or deletion between checks may be missed.
The next check captures the currently available repository state after the PC returns.
Release changes are detected even without a Git push. Every new repository requires
one-time onboarding.

Issues, PR discussions, settings, secrets, Actions artifacts and uncommitted local
files are outside this backup. Submodules preserve Git links; their source
repositories need separate backups. Capture is not an atomic snapshot of every
GitHub feature. Public API rate limits, full storage, network errors, missing LFS
objects and inaccessible repositories cause the run to fail and retry on a later check.

## Monitor, run, pause and restore

Open Windows Task Scheduler and select GitHub Drive Backup. Use Run for an immediate
check or Disable to pause future checks. The launcher writes daily logs under
LOCALAPPDATA/GitHubDriveBackup/local/logs. The latest per-repository outcome is in
status.json. Failed runs return a nonzero Task Scheduler result and preserve the
previous successful state. Windows does not automatically notify you about every
failed scheduled task, so check the status and Drive sync periodically.

For restore, select a complete archive whose files have finished syncing. Verify
repository.tar.gz against SHA256SUMS, extract it, and follow RESTORE.txt to clone
locally or push branches and tags to a new empty repository. Restore LFS objects and
release files using the included manifest and release metadata.

## Validation

Run the archive restoration and local scheduling-data tests:

    node --test .github/backup/tests/backup.test.mjs .github/backup/tests/local-backup.test.mjs

The archived RESTORE.txt explains that cloud upload completion is separate from
the local verification receipt.

References:

- https://support.google.com/drive/answer/10838124
- https://support.google.com/drive/answer/13401938
- https://docs.github.com/en/repositories/archiving-a-github-repository/backing-up-a-repository
