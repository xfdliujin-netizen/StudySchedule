$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = 'http://127.0.0.1:4173/'

function Get-PlannerStatus {
    try {
        $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
        if ($response.Headers['X-Study-Planner'] -eq 'kids-study-planner') { return 'ready' }
        return 'occupied'
    } catch {
        if ($_.Exception.Response) { return 'occupied' }
        return 'unavailable'
    }
}

try {
    $status = Get-PlannerStatus
    if ($status -eq 'occupied') {
        throw 'Port 4173 is being used by another service. Close it and try again.'
    }
    if ($status -ne 'ready') {
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }
        if (-not $nodePath) {
            $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
            if (Test-Path -LiteralPath $bundledNode) { $nodePath = $bundledNode }
        }
        if (-not $nodePath) { throw 'Node.js was not found. Install Node.js 24 or newer, then try again.' }
        $serverScript = Join-Path $PSScriptRoot 'serve.js'
        $server = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $serverScript + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
        $ready = $false
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            if ($server.HasExited) { throw 'The local server could not start. Check whether port 4173 is already in use.' }
            if ((Get-PlannerStatus) -eq 'ready') { $ready = $true; break }
            Start-Sleep -Milliseconds 250
        }
        if (-not $ready) { throw 'The local server did not respond. Please try again.' }
    }
    Start-Process $appUrl
    Write-Host 'Study Planner is ready. You can close this window.'
    exit 0
} catch {
    Write-Host ('Unable to launch: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
