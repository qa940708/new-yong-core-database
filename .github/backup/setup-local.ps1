param(
    [Parameter(Mandatory = $true)][string]$DriveFolder,
    [string]$Repository = 'qa940708/new-yong-core-database',
    [ValidateRange(5, 1440)][int]$IntervalMinutes = 15,
    [string]$GitHubTokenFile,
    [switch]$NoStart
)
$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9_.-]+$' -or $Repository.Split('/')[1] -in @('.', '..')) { throw 'Use owner/repository.' }
if (-not (Test-Path -LiteralPath $DriveFolder -PathType Container)) { throw 'Open the intended Google Drive folder in File Explorer first.' }
$backupTarget = (Resolve-Path -LiteralPath $DriveFolder).ProviderPath
$backupInstall = Join-Path $env:LOCALAPPDATA 'GitHubDriveBackup\local'
$backupProgram = Join-Path $backupInstall 'program'
New-Item -ItemType Directory -Path $backupInstall, $backupProgram -Force | Out-Null
$backupIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$backupSid = $backupIdentity.User.Value
& icacls.exe $backupInstall /inheritance:r /grant:r ('*' + $backupSid + ':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict access to local backup settings.' }
$backupUtf8 = New-Object Text.UTF8Encoding($false)
$backupMarkerFile = Join-Path $backupTarget '.github-drive-backup-target.json'
if (Test-Path -LiteralPath $backupMarkerFile) {
    $backupMarker = Get-Content -LiteralPath $backupMarkerFile -Raw | ConvertFrom-Json
    if ($backupMarker.application -ne 'GitHubDriveBackup' -or $backupMarker.targetId -notmatch '^[a-f0-9-]{36}$') { throw 'The destination marker belongs to another setup or is invalid.' }
} else {
    $backupMarker = @{ version = 1; application = 'GitHubDriveBackup'; targetId = [Guid]::NewGuid().ToString() }
    [IO.File]::WriteAllText($backupMarkerFile, ($backupMarker | ConvertTo-Json), $backupUtf8)
}
$backupConfigFile = Join-Path $backupInstall 'config.json'
$backupRepositories = @($Repository)
$backupOldConfig = $null
if (Test-Path -LiteralPath $backupConfigFile) {
    $backupOldConfig = Get-Content -LiteralPath $backupConfigFile -Raw | ConvertFrom-Json
    $backupRepositories += @($backupOldConfig.repositories)
}
$backupConfig = [ordered]@{
    version = 1
    driveFolder = $backupTarget
    targetId = $backupMarker.targetId
    stateDirectory = $backupInstall
    repositories = @($backupRepositories | Sort-Object -Unique)
    nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
    gitDirectory = Split-Path (Get-Command git.exe -ErrorAction Stop).Source -Parent
    tarDirectory = Split-Path (Get-Command tar.exe -ErrorAction Stop).Source -Parent
    intervalMinutes = $IntervalMinutes
}
if ($GitHubTokenFile) {
    $backupConfig.githubTokenFile = (Resolve-Path -LiteralPath $GitHubTokenFile).ProviderPath
} elseif ($backupOldConfig.githubTokenFile) {
    $backupConfig.githubTokenFile = $backupOldConfig.githubTokenFile
}
foreach ($backupName in @('backup.mjs', 'local-backup.mjs', 'run-local.ps1', 'setup-local.ps1')) {
    $backupSource = Join-Path $PSScriptRoot $backupName
    $backupDestination = Join-Path $backupProgram $backupName
    if ([IO.Path]::GetFullPath($backupSource) -ne [IO.Path]::GetFullPath($backupDestination)) {
        Copy-Item -LiteralPath $backupSource -Destination $backupDestination -Force
    }
}
[IO.File]::WriteAllText($backupConfigFile, ($backupConfig | ConvertTo-Json -Depth 8), $backupUtf8)
$backupTaskName = 'GitHub Drive Backup'
$backupExisting = Get-ScheduledTask -TaskName $backupTaskName -ErrorAction SilentlyContinue
if ($backupExisting -and $backupExisting.Description -notlike 'Local whole-repository backups*') { throw 'An unrelated scheduled task already uses this name.' }
$backupRunner = Join-Path $backupProgram 'run-local.ps1'
$backupArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $backupRunner + '" -ConfigFile "' + $backupConfigFile + '"'
$backupAction = New-ScheduledTaskAction -Execute (Join-Path $PSHOME 'powershell.exe') -Argument $backupArguments -WorkingDirectory $backupProgram
$backupTimer = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$backupLogon = New-ScheduledTaskTrigger -AtLogOn -User $backupIdentity.Name
$backupLogon.Delay = 'PT2M'
$backupPrincipal = New-ScheduledTaskPrincipal -UserId $backupSid -LogonType Interactive -RunLevel Limited
$backupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $backupTaskName -Action $backupAction -Trigger @($backupTimer, $backupLogon) -Principal $backupPrincipal -Settings $backupSettings -Description 'Local whole-repository backups to the selected Google Drive for desktop folder.' -Force | Out-Null
if (-not $NoStart) { Start-ScheduledTask -TaskName $backupTaskName }
Write-Output ('Scheduled task: ' + $backupTaskName)
Write-Output ('Check interval: ' + $IntervalMinutes + ' minutes, and after sign-in')
Write-Output ('Drive destination: ' + $backupTarget)
Write-Output ('Status: ' + (Join-Path $backupInstall 'status.json'))
Write-Output 'LOCAL_SUCCESS.json verifies the local copy. Check Google Drive for desktop for upload completion.'
