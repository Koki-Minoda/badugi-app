[CmdletBinding()]
param(
    [ValidateSet("Diagnose", "Setup", "Smoke", "Train", "Resume")]
    [string]$Mode = "Diagnose",
    [ValidateSet("auto", "cpu", "cuda")]
    [string]$Device = "auto",
    [int]$Episodes = 100000,
    [int]$SaveInterval = 10000,
    [int]$LogInterval = 1000,
    [string]$OutputDir = "rl/models/badugi_sixmax_windows",
    [string]$Checkpoint = "rl/models/badugi_sixmax_foldmargin_100k_from_raiseev_fix/badugi_sixmax_dqn_latest.pt",
    [string]$OpponentCheckpoint = "",
    [string]$TorchIndexUrl = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $repoRoot ".venv-rl\Scripts\python.exe"
$trainer = Join-Path $repoRoot "src\rl\training\train_sixmax_selfplay_badugi_dqn.py"

function Resolve-RepoPath([string]$PathValue) {
    if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
    return Join-Path $repoRoot $PathValue
}

function Require-Python {
    if (-not (Test-Path $venvPython)) {
        throw "RL environment is missing. Run: .\scripts\windows-badugi-rl.ps1 -Mode Setup"
    }
}

function Show-Diagnostics {
    Write-Host "Repository: $repoRoot"
    Write-Host "Virtual environment: $venvPython"
    if (-not (Test-Path $venvPython)) {
        Write-Host "Python environment: NOT SET UP"
        return
    }
    & $venvPython -c "import platform, torch; print('Python:', platform.python_version()); print('PyTorch:', torch.__version__); print('CUDA available:', torch.cuda.is_available()); print('CUDA runtime:', torch.version.cuda); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"
    if ($LASTEXITCODE -ne 0) { throw "Python/PyTorch diagnostics failed." }
}

if ($Mode -eq "Setup") {
    $basePython = Get-Command py -ErrorAction SilentlyContinue
    if ($null -ne $basePython) {
        & py -3 -m venv (Join-Path $repoRoot ".venv-rl")
    } else {
        $python = Get-Command python -ErrorAction SilentlyContinue
        if ($null -eq $python) { throw "Python 3.11+ is required." }
        & python -m venv (Join-Path $repoRoot ".venv-rl")
    }
    Require-Python
    & $venvPython -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed." }
    if ($TorchIndexUrl) {
        & $venvPython -m pip install torch --index-url $TorchIndexUrl
        if ($LASTEXITCODE -ne 0) { throw "PyTorch installation failed." }
    }
    & $venvPython -m pip install -r (Join-Path $repoRoot "src\rl\requirements.txt")
    if ($LASTEXITCODE -ne 0) { throw "RL dependency setup failed." }
    Show-Diagnostics
    Write-Host "Setup complete. Next: .\scripts\windows-badugi-rl.ps1 -Mode Smoke"
    exit 0
}

if ($Mode -eq "Diagnose") {
    Show-Diagnostics
    exit 0
}

Require-Python
$cudaAvailable = (& $venvPython -c "import torch; print('true' if torch.cuda.is_available() else 'false')").Trim() -eq "true"
if ($Device -eq "cuda" -and -not $cudaAvailable) {
    throw "CUDA was requested but PyTorch cannot see the GPU. Run Diagnose and install the matching official PyTorch CUDA wheel."
}
$resolvedDevice = if ($Device -eq "auto") { if ($cudaAvailable) { "cuda" } else { "cpu" } } else { $Device }

$resolvedOutput = Resolve-RepoPath $OutputDir
$resolvedCheckpoint = Resolve-RepoPath $Checkpoint
$resolvedOpponent = if ($OpponentCheckpoint) { Resolve-RepoPath $OpponentCheckpoint } else { "" }

if ($Mode -eq "Smoke") {
    $Episodes = 4
    $SaveInterval = 2
    $LogInterval = 1
    $resolvedOutput = Join-Path $env:TEMP "mgx-badugi-sixmax-smoke"
    $trainArgs = @(
        $trainer, "--episodes", $Episodes, "--output-dir", $resolvedOutput,
        "--save-interval", $SaveInterval, "--log-interval", $LogInterval,
        "--teacher-warmup-episodes", 0, "--max-steps-per-episode", 8,
        "--warmup-steps", 1, "--train-every-steps", 1,
        "--batch-size", 2, "--buffer-capacity", 64, "--device", $resolvedDevice
    )
} else {
    if ($Episodes -le 0 -or $SaveInterval -le 0 -or $LogInterval -le 0) {
        throw "Episodes, SaveInterval, and LogInterval must be positive."
    }
    $trainArgs = @(
        $trainer, "--episodes", $Episodes, "--output-dir", $resolvedOutput,
        "--save-interval", $SaveInterval, "--log-interval", $LogInterval,
        "--device", $resolvedDevice,
        "--batch-size", 128, "--buffer-capacity", 300000
    )
    if ($Mode -eq "Resume") {
        if (-not (Test-Path $resolvedCheckpoint)) {
            throw "Checkpoint not found: $resolvedCheckpoint"
        }
        $trainArgs += @(
            "--pretrained", $resolvedCheckpoint,
            "--resume-continuation"
        )
    }
    if ($resolvedOpponent) {
        if (-not (Test-Path $resolvedOpponent)) { throw "Opponent checkpoint not found: $resolvedOpponent" }
        $trainArgs += @("--pretrained-opponent", $resolvedOpponent)
    }
}

New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$logPath = Join-Path $resolvedOutput ("training-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Write-Host "Mode=$Mode Device=$resolvedDevice Episodes=$Episodes"
Write-Host "Output=$resolvedOutput"
Write-Host "Log=$logPath"
Push-Location $repoRoot
try {
    # Windows PowerShell 5 wraps native stderr as ErrorRecord objects. Keep
    # warnings in the combined log without letting ErrorActionPreference=Stop
    # abort before the native exit code can be checked.
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $venvPython @trainArgs 2>&1 | Tee-Object -FilePath $logPath
        $trainingExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($trainingExitCode -ne 0) { throw "Training command failed with exit code $trainingExitCode." }
} finally {
    Pop-Location
}
