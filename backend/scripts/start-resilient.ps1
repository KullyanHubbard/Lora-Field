# Wrapper auto-restart untuk uvicorn LoraField.
# Kalau uvicorn crash, tunggu 5 detik, restart. Log ke logs/supervisor.log.
# Daftarkan di Task Scheduler dengan trigger "At log on" atau "At system startup".

$ErrorActionPreference = "Continue"

$backendDir = Split-Path -Parent $PSScriptRoot
$venvUvicorn = Join-Path $backendDir ".venv\Scripts\uvicorn.exe"
$logDir = Join-Path $backendDir "logs"
$supervisorLog = Join-Path $logDir "supervisor.log"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

function Write-SupervisorLog {
    param([string]$Message)
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$stamp] $Message"
    Write-Host $line
    Add-Content -Path $supervisorLog -Value $line
}

Write-SupervisorLog "Supervisor start | backend=$backendDir"

Set-Location $backendDir

$restartCount = 0
$maxRestartBurst = 5
$burstWindow = [TimeSpan]::FromMinutes(2)
$restartTimes = [System.Collections.Generic.List[datetime]]::new()

while ($true) {
    Write-SupervisorLog "Spawn uvicorn (restart #$restartCount)"
    & $venvUvicorn app.main:app --host 127.0.0.1 --port 8000
    $exitCode = $LASTEXITCODE

    $now = Get-Date
    $restartTimes.Add($now)
    # Buang restart yang lebih lama dari burst window.
    while ($restartTimes.Count -gt 0 -and ($now - $restartTimes[0]) -gt $burstWindow) {
        $restartTimes.RemoveAt(0)
    }

    Write-SupervisorLog "Uvicorn exit code=$exitCode | restart_in_window=$($restartTimes.Count)"

    if ($restartTimes.Count -ge $maxRestartBurst) {
        Write-SupervisorLog "FATAL: $maxRestartBurst restart dalam $($burstWindow.TotalMinutes) menit. Stop supervisor."
        exit 1
    }

    $restartCount += 1
    Start-Sleep -Seconds 5
}
