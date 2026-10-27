[CmdletBinding()]
param(
    [string]$ArtifactRoot = $env:MGX_RL_ARTIFACT_ROOT,
    [ValidateRange(1.0, 1000.0)]
    [double]$MinimumFreeGB = 20.0,
    [ValidateRange(1.0, 1000.0)]
    [double]$MinimumAvailableMemoryGB = 4.0
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $repoRoot ".venv-rl\Scripts\python.exe"
$preflight = Join-Path $repoRoot "src\rl\training\ten_game_f04_preflight.py"

if (-not $ArtifactRoot) {
    throw "Set -ArtifactRoot or MGX_RL_ARTIFACT_ROOT to a dedicated non-system drive directory."
}
if (-not (Test-Path $venvPython)) {
    throw "RL Python environment is missing: $venvPython"
}
& $venvPython -c "import torch, gymnasium, numpy"
if ($LASTEXITCODE -ne 0) {
    throw "RL Python dependencies are incomplete. Run the Windows RL setup first."
}

$resolvedRoot = [System.IO.Path]::GetFullPath($ArtifactRoot)
$driveRoot = [System.IO.Path]::GetPathRoot($resolvedRoot)
$rootExists = [int](Test-Path -LiteralPath $resolvedRoot -PathType Container)
$markerExists = [int](Test-Path -LiteralPath (Join-Path $resolvedRoot ".mgx-rl-artifacts") -PathType Leaf)
$freeBytes = [long]0
try {
    $drive = [System.IO.DriveInfo]::new($driveRoot)
    if ($drive.IsReady) { $freeBytes = [long]$drive.AvailableFreeSpace }
} catch {
    # The Python gate reports an absent or unready artifact drive as blocked.
}

$os = Get-CimInstance Win32_OperatingSystem
$availableMemoryBytes = [long]$os.FreePhysicalMemory * 1024
$systemDrive = [System.IO.Path]::GetPathRoot($env:SystemRoot)
$pythonProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'python.exe' OR Name = 'pythonw.exe'")
$trainers = @($pythonProcesses | Where-Object {
    -not $_.CommandLine -or $_.CommandLine -match '([\\/]src[\\/]rl[\\/]training[\\/]train_|rl\.training\.train_)[^\s]+'
})

& $venvPython $preflight `
    --artifact-root $resolvedRoot `
    --system-drive $systemDrive `
    --root-exists $rootExists `
    --marker-exists $markerExists `
    --free-bytes $freeBytes `
    --available-memory-bytes $availableMemoryBytes `
    --running-trainers $trainers.Count `
    --minimum-free-gb $MinimumFreeGB `
    --minimum-available-memory-gb $MinimumAvailableMemoryGB
exit $LASTEXITCODE
