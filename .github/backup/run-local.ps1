param([Parameter(Mandatory = $true)][string]$ConfigFile)
$ErrorActionPreference = 'Stop'
$backupConfig = Get-Content -LiteralPath $ConfigFile -Raw | ConvertFrom-Json
$backupLogs = Join-Path $backupConfig.stateDirectory 'logs'
New-Item -ItemType Directory -Path $backupLogs -Force | Out-Null
$backupLog = Join-Path $backupLogs ((Get-Date).ToString('yyyy-MM-dd') + '.log')
$backupSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$backupMutex = New-Object Threading.Mutex($false, ('Local\GitHubDriveBackup-' + $backupSid))
$backupLocked = $false
$backupExit = 1
try {
    try { $backupLocked = $backupMutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $backupLocked = $true }
    if (-not $backupLocked) { exit 0 }
    Add-Content -LiteralPath $backupLog -Encoding UTF8 -Value ((Get-Date).ToString('o') + ' Starting backup check.')
    $env:PATH = $backupConfig.gitDirectory + ';' + $backupConfig.tarDirectory + ';' + $env:PATH
    $backupProgram = Join-Path $PSScriptRoot 'local-backup.mjs'
    $ErrorActionPreference = 'Continue'
    & $backupConfig.nodeExecutable $backupProgram --config $ConfigFile 2>&1 | Out-File -LiteralPath $backupLog -Append -Encoding utf8
    $backupExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    Add-Content -LiteralPath $backupLog -Encoding UTF8 -Value ((Get-Date).ToString('o') + ' Finished with exit code ' + $backupExit)
} catch {
    Add-Content -LiteralPath $backupLog -Encoding UTF8 -Value ('Backup launcher failed: ' + $_.Exception.Message)
} finally {
    if ($backupLocked) { $backupMutex.ReleaseMutex() }
    $backupMutex.Dispose()
}
exit $backupExit
