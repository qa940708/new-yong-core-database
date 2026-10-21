param(
    [string]$Repository = 'qa940708/new-yong-core-database',
    [string]$FolderId = '18VBKe_iQVWt2KbtjUxyYd1b5NgTbSsUe',
    [string]$OAuthClientFile,
    [switch]$ReconnectGoogle
)

$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9_.-]+$') { throw 'Use owner/repository.' }
if ($FolderId -notmatch '^[A-Za-z0-9_-]{10,}$') { throw 'Invalid Google Drive folder ID.' }
$backupState = Join-Path $env:LOCALAPPDATA 'GitHubDriveBackup'
$backupCredentials = Join-Path $backupState 'credentials'
$backupTools = Join-Path $backupState 'tools'
New-Item -ItemType Directory -Path $backupCredentials, $backupTools -Force | Out-Null
$backupSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $backupCredentials /inheritance:r /grant:r ("*" + $backupSid + ':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict access to the local credential directory.' }

function Install-BackupTool {
    param([string]$Name, [string]$Url, [string]$Sha256, [string]$ExeName)
    $destination = Join-Path $backupTools $Name
    $installed = @(Get-ChildItem -LiteralPath $destination -Filter $ExeName -Recurse -ErrorAction SilentlyContinue)
    if ($installed.Count -eq 0) {
        $archive = Join-Path $backupTools ($Name + '.zip')
        Invoke-WebRequest -Uri $Url -OutFile $archive -UseBasicParsing
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Sha256) {
            throw "$Name download failed checksum verification."
        }
        Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
        $installed = @(Get-ChildItem -LiteralPath $destination -Filter $ExeName -Recurse)
    }
    if ($installed.Count -ne 1) { throw "Could not locate $ExeName." }
    return $installed[0].FullName
}

$rclone = Install-BackupTool 'rclone-1.75.2' 'https://github.com/rclone/rclone/releases/download/v1.75.2/rclone-v1.75.2-windows-amd64.zip' '8a9db2bad1dc79a65b3348fd857069598e2aab7cf4d118b77b1df23055aff818' 'rclone.exe'
$gh = Install-BackupTool 'gh-2.103.0' 'https://github.com/cli/cli/releases/download/v2.103.0/gh_2.103.0_windows_amd64.zip' '80c846a5b8432672ca6373b34ce9de998c9686aaa1885c845f2e1ee81f713726' 'gh.exe'
$oldGhDirectory = $env:GH_CONFIG_DIR
$oldOutputEncoding = $OutputEncoding
$env:GH_CONFIG_DIR = Join-Path $backupCredentials 'gh'
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$configFile = Join-Path $backupCredentials 'rclone.conf'

function Invoke-GitHubApi {
    param([string]$Route, [string]$Method = 'GET', $Body = $null, [switch]$Paginate)
    $arguments = @('api', '--hostname', 'github.com', '--method', $Method, $Route)
    if ($Paginate) { $arguments += @('--paginate', '--slurp') }
    if ($null -ne $Body) {
        $arguments += @('--input', '-')
        $result = ($Body | ConvertTo-Json -Depth 100 -Compress) | & $gh @arguments
    } else {
        $result = & $gh @arguments
    }
    if ($LASTEXITCODE -ne 0) { throw "GitHub request failed: $Method $Route" }
    if ($result) { return (($result -join [Environment]::NewLine) | ConvertFrom-Json) }
}

function Invoke-Rclone {
    param([string[]]$Arguments)
    & $rclone @Arguments --config $configFile --drive-root-folder-id $FolderId
    if ($LASTEXITCODE -ne 0) { throw 'Google Drive operation failed. Check the selected account, OAuth configuration and folder access.' }
}

try {
    Write-Host 'Sign in to the GitHub account that owns the repository.'
    $statusPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $gh auth status --hostname github.com 2>$null | Out-Null
        $authStatus = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $statusPreference
    }
    if ($authStatus -ne 0) {
        & $gh auth login --hostname github.com --web --git-protocol https --scopes workflow
        if ($LASTEXITCODE -ne 0) { throw 'GitHub sign-in did not complete.' }
    }
    $identity = Invoke-GitHubApi 'user'
    if ($identity.login -ne $Repository.Split('/')[0]) {
        throw "Signed in as $($identity.login). Sign in as the owner of $Repository and rerun setup."
    }
    $repo = Invoke-GitHubApi ("repos/" + $Repository)
    if (-not $repo.permissions.admin) { throw 'Repository admin access is needed to configure the backup secret.' }
    if ($repo.archived) { throw 'This repository is archived and cannot receive a workflow.' }

    if (-not (Test-Path -LiteralPath $configFile)) {
        Write-Host ''
        Write-Host 'Create a Desktop OAuth client in your own Google Cloud project:'
        Write-Host 'https://console.cloud.google.com/apis/credentials'
        Write-Host 'Enable Google Drive API and publish the OAuth consent configuration to Production.'
        Write-Host 'The README beside this script has the detailed steps. Use the Google account with write access to your folder.'
        if ($OAuthClientFile) {
            $clientDocument = Get-Content -LiteralPath $OAuthClientFile -Raw | ConvertFrom-Json
            if (-not $clientDocument.installed) { throw 'The OAuth JSON must be for a Desktop app.' }
            $clientId = $clientDocument.installed.client_id
            $clientSecret = $clientDocument.installed.client_secret
            $clientDocument = $null
        } else {
            $clientId = (Read-Host 'Google OAuth client ID').Trim()
            $secureClientSecret = Read-Host 'Google OAuth client secret (hidden)' -AsSecureString
            $clientSecret = (New-Object System.Net.NetworkCredential('', $secureClientSecret)).Password
        }
        if ($clientId -notmatch '^[A-Za-z0-9_.-]+\.apps\.googleusercontent\.com$' -or
            [string]::IsNullOrWhiteSpace($clientSecret) -or $clientSecret -match '[\r\n]') {
            throw 'Invalid OAuth client credentials.'
        }
        $configuration = @('[gdrive]', 'type = drive', 'scope = drive', ('client_id = ' + $clientId), ('client_secret = ' + $clientSecret), ('root_folder_id = ' + $FolderId), '') -join [Environment]::NewLine
        [IO.File]::WriteAllText($configFile, $configuration, (New-Object Text.UTF8Encoding($false)))
        $configuration = $null
        $clientSecret = $null
        $secureClientSecret = $null
    }
    if ($ReconnectGoogle -or (Get-Content -LiteralPath $configFile -Raw) -notmatch '(?m)^token\s*=') {
        Write-Host 'The next command opens Google sign-in. Use your Edge account that owns the destination folder.'
        Invoke-Rclone @('config', 'reconnect', 'gdrive:')
    }

    # Verify write access before configuring or activating GitHub uploads.
    Invoke-Rclone @('mkdir', ('gdrive:' + $Repository))
    $probeName = '.setup-probe-' + [Guid]::NewGuid().ToString('N') + '.txt'
    $probeDirectory = Join-Path $backupState ('probe-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $probeDirectory | Out-Null
    $probeFile = Join-Path $probeDirectory $probeName
    [IO.File]::WriteAllText($probeFile, 'GitHub Drive backup write verification.')
    Invoke-Rclone @('copyto', $probeFile, ('gdrive:' + $Repository + '/' + $probeName))
    Invoke-Rclone @('check', $probeDirectory, ('gdrive:' + $Repository), '--one-way', '--download')
    Invoke-Rclone @('deletefile', ('gdrive:' + $Repository + '/' + $probeName))
    Remove-Item -LiteralPath $probeFile
    Remove-Item -LiteralPath $probeDirectory

    Get-Content -LiteralPath $configFile -Raw | & $gh secret set GDRIVE_RCLONE_CONFIG --repo $Repository
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure the GitHub Actions secret.' }
    & $gh variable set GDRIVE_FOLDER_ID --repo $Repository --body $FolderId
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure the destination folder variable.' }

    # Reusable installer: add backup files without merging unrelated branch content.
    $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $paths = @('.github/workflows/backup-to-drive.yml', '.github/backup/backup.mjs', '.github/backup/setup.ps1', '.github/backup/README.md', '.github/backup/tests/backup.test.mjs')
    $entries = @($paths | ForEach-Object {
        $localFile = Join-Path $projectRoot $_
        if (-not (Test-Path -LiteralPath $localFile)) { throw "Missing installer file: $_" }
        @{ path = $_; mode = '100644'; type = 'blob'; content = [IO.File]::ReadAllText($localFile) }
    })
    $pages = Invoke-GitHubApi ("repos/" + $Repository + '/branches?per_page=100') -Paginate
    $branches = @($pages | ForEach-Object { $_ }) | Sort-Object @{ Expression = { $_.name -ne $repo.default_branch } }, name
    foreach ($branch in $branches) {
        $head = Invoke-GitHubApi ("repos/" + $Repository + '/git/commits/' + $branch.commit.sha)
        $tree = Invoke-GitHubApi ("repos/" + $Repository + '/git/trees') 'POST' @{ base_tree = $head.tree.sha; tree = $entries }
        if ($tree.sha -eq $head.tree.sha) {
            Write-Host "Backup files already installed on $($branch.name)."
            continue
        }
        $commit = Invoke-GitHubApi ("repos/" + $Repository + '/git/commits') 'POST' @{
            message = 'Add verified whole-repository Google Drive backups'
            tree = $tree.sha; parents = @($branch.commit.sha)
        }
        $encodedBranch = ($branch.name.Split('/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
        $refRoute = "repos/" + $Repository + '/git/refs/heads/' + $encodedBranch
        Invoke-GitHubApi $refRoute 'PATCH' @{ sha = $commit.sha; force = $false } | Out-Null
        Write-Host "Installed backup workflow on $($branch.name)."
    }
    & $gh workflow run backup-to-drive.yml --repo $Repository --ref $repo.default_branch
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the initial backup.' }
    Write-Host ''
    Write-Host 'Drive access verified and the backup workflow is configured.'
    Write-Host "Check the initial run at https://github.com/$Repository/actions/workflows/backup-to-drive.yml"
    Write-Host 'Only backups with SUCCESS.json have completed upload verification.'
    Write-Host 'For future repositories, rerun this script with -Repository owner/name.'
} finally {
    $env:GH_CONFIG_DIR = $oldGhDirectory
    $OutputEncoding = $oldOutputEncoding
}
