# Wrapper PowerShell untuk backup SQLite LoraField. Cocok di-trigger Task Scheduler.
# Set Working Directory di Task Scheduler ke folder backend/.
# Action: Start a program → powershell.exe
# Arguments: -NoProfile -ExecutionPolicy Bypass -File "D:\CDP-Proyek\backend\scripts\backup-db.ps1"

$ErrorActionPreference = "Stop"

$backendDir = Split-Path -Parent $PSScriptRoot
$python = Join-Path $backendDir ".venv\Scripts\python.exe"
$script = Join-Path $PSScriptRoot "backup_db.py"
$logDir = Join-Path $backendDir "logs"
$logFile = Join-Path $logDir "backup.log"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$timestamp] Start backup"

try {
    & $python $script 2>&1 | Tee-Object -FilePath $logFile -Append
    $exitCode = $LASTEXITCODE
    $endStamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$endStamp] Selesai (exit code: $exitCode)"
    exit $exitCode
} catch {
    $errStamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$errStamp] ERROR: $($_.Exception.Message)"
    exit 1
}
