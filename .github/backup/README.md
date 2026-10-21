# Whole-repository Google Drive backup

Every push to a branch containing the workflow creates a complete repository archive.
It contains all Git branches, tags, committed files and history, all referenced Git LFS
objects, and release metadata and downloadable release files. Each archive is independent.

The workflow also runs manually and after the existing media-import and guide-publishing
workflows finish. Their commits use GITHUB_TOKEN and otherwise do not start push workflows.

## Activate once

GitHub Actions needs its own Google authorization. Signing into Drive in Edge or connecting
Drive to a chat application does not grant an Actions runner access.

1. In the Google Cloud console, create or select a project you control.
2. Enable **Google Drive API** under APIs & Services.
3. Configure **Google Auth Platform** with an app name and your contact email. For a
   personal Google account, use an External audience.
4. Add the Drive scope https://www.googleapis.com/auth/drive. This is needed for the
   existing destination folder. The commands fix their destination to the folder ID;
   this is a path restriction, not an OAuth permission boundary.
5. Create an **OAuth client ID**, application type **Desktop app**.
6. Complete **Branding** before publishing. For this owner's deployment, use:

   - Application home page: https://yongorigindata.online/backup-app/
   - Application privacy policy link: https://yongorigindata.online/backup-app/privacy.html
   - Application terms of service link: https://yongorigindata.online/backup-app/terms.html
   - Authorized domain: yongorigindata.online

   Save Branding, then return to **Audience** and publish to **Production**. A disabled
   Publish app button can indicate incomplete Branding links even when the starred
   name and email fields are filled. Another operator must provide accurate pages
   on their own domain. Testing mode can expire authorization after seven days.
   If Google displays an unverified-app prompt, verify that the project and client
   belong to you. Personal use does not normally require submitting for verification.
7. Run the installer in PowerShell from this checkout:

       powershell -NoProfile -ExecutionPolicy Bypass -File .github/backup/setup.ps1

The installer downloads checksum-verified portable rclone and GitHub CLI, signs into
GitHub, asks for the OAuth client ID and secret locally, and opens Google sign-in.
Use the account with **write access** to:

https://drive.google.com/drive/folders/18VBKe_iQVWt2KbtjUxyYd1b5NgTbSsUe

The current connection could not access that folder during preparation. The installer
must upload, verify and remove its own temporary probe before configuring Actions.
It preserves other files in the destination.

The script stores the rclone configuration in a restricted directory under
LOCALAPPDATA/GitHubDriveBackup/credentials and sends it directly to Actions secret
GDRIVE_RCLONE_CONFIG. It sets repository variable GDRIVE_FOLDER_ID, installs the backup
files on all existing branches using fast-forward commits, and dispatches the first
backup. It will not force-update a branch.

Do not paste tokens or OAuth secrets into chat or commit the local configuration.
You can download the Desktop client's JSON from Google and supply its local path with
-OAuthClientFile. The installer reads it privately without displaying its contents.
If authorization is revoked, rerun with -ReconnectGoogle. For another repository you own:

    powershell -NoProfile -ExecutionPolicy Bypass -File .github/backup/setup.ps1 -Repository qa940708/OTHER_REPOSITORY

For a protected branch, add the same files through its normal pull-request process
and rerun setup. For an empty repository, make its first commit before onboarding.

## What appears in Drive

    <owner>/<repository>/<UTC timestamp>-<run ID>-<attempt>/
        repository.tar.gz
        SHA256SUMS
        RESTORE.txt
        SUCCESS.json

SUCCESS.json is written only after downloading and comparing the uploaded bytes.
An interrupted or failed run has no success marker. No automatic deletion, retention
pruning, or shared latest-file overwrite is enabled.

The archive contains repository.git, manifest.json, RESTORE.txt and releases/.
Release binaries use asset IDs as filenames; metadata preserves their original names.
Credentials stay outside the archive and are removed from the runner when it exits.

Use the Actions page and GitHub workflow notifications to monitor failures. Missing
configuration, inaccessible folders, full storage, missing LFS objects, changed
release assets or failed checksum checks cause an explicit failed run.

## Restore

Choose a run with SUCCESS.json, check the archive against SHA256SUMS, and extract it.
Follow RESTORE.txt to clone locally or push branches and tags to a new empty repository,
then restore any LFS objects and release assets. The manifest records every ref and SHA.

For rapid pushes, force pushes and branch deletion, refs/backup-events preserves the
event commits. Other refs reflect the mirror-clone snapshot. This is not an atomic
historical snapshot of every GitHub feature.

Issues, PR discussions, settings, secrets, Actions artifacts and uncommitted local
files are outside this backup. Submodules preserve Git links; the repositories they
point to need their own backups.

## Coverage and validation

New branches should inherit the workflow. Branches or tags pointing to old commits
without it require the workflow or a manual backup. GitHub skip-CI directives and
bulk-push event limits also apply. Future repositories require one-time onboarding.
Release changes without a push are included in the next push or manual backup.

The workflow reads its tool from the default branch, uses contents: read, persists
no checkout credentials, and pins checkout and rclone versions. Runs do not cancel
earlier backups.

Run the restoration and failure tests with Node 20+ and Git LFS installed:

    node --test .github/backup/tests/backup.test.mjs

Build a real public-repository archive locally without uploading:

    $env:GITHUB_REPOSITORY = 'qa940708/new-yong-core-database'
    node .github/backup/backup.mjs --verify-only --output ./backup-output

Verification mode does not mark a backup complete or activate Drive uploads.

References:

- https://docs.github.com/en/repositories/archiving-a-github-repository/backing-up-a-repository
- https://docs.github.com/en/actions/concepts/security/github_token
- https://rclone.org/drive/
