param([switch]$Pause)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$pauseFile = Join-Path $stateDir 'auto-sync.paused'
if ($Pause) {
    [IO.File]::WriteAllText($pauseFile, 'Paused by user')
    Write-Host 'Automatic Git sync is paused.'
    exit 0
}
if (Test-Path -LiteralPath $pauseFile) { Remove-Item -LiteralPath $pauseFile }
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js 24 or newer is required.' }
$scriptPath = Join-Path $PSScriptRoot 'auto-sync.mjs'
Start-Process -FilePath $nodePath -ArgumentList @(('"' + $scriptPath + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden
Write-Host 'Automatic Git sync is running in the background.'
