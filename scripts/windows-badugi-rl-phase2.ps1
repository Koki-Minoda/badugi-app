[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("E0", "E1", "E2", "E3")]
    [string]$Experiment,
    [ValidateSet(10000, 25000)]
    [int]$Episodes = 10000,
    [int]$Seed = 20260827,
    [string]$RootOutputDir = "rl/models/badugi_phase2_20260827",
    [string]$Baseline = "rl/models/badugi_sixmax_foldmargin_100k_from_raiseev_fix/badugi_sixmax_dqn_latest.pt",
    [string]$ExpectedBaselineSha256 = "d93fad43dce8266d6b725eb7e598d2e961db0fbbfafca4eaae993bc78c734079"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot "windows-badugi-rl.ps1"
$inventory = Join-Path $repoRoot "src\rl\training\inventory_badugi_sixmax_checkpoints.py"
$python = Join-Path $repoRoot ".venv-rl\Scripts\python.exe"

$experiments = @{
    E0 = @{ Name = "e0_control"; ProfileMixRate = 0.0; LearningRate = 0.0001; ResumeEpsilon = 0.25 }
    E1 = @{ Name = "e1_profile_diversity"; ProfileMixRate = 0.5; LearningRate = 0.0001; ResumeEpsilon = 0.25 }
    E2 = @{ Name = "e2_low_lr"; ProfileMixRate = 0.0; LearningRate = 0.00003; ResumeEpsilon = 0.25 }
    E3 = @{ Name = "e3_low_epsilon"; ProfileMixRate = 0.0; LearningRate = 0.0001; ResumeEpsilon = 0.10 }
}

function Resolve-RepoPath([string]$PathValue) {
    if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
    return Join-Path $repoRoot $PathValue
}

function Write-Status([string]$Path, [string]$Stage, [hashtable]$Extra = @{}) {
    $payload = @{
        schemaVersion = "badugi-phase2-run-status-v1"
        experiment = $Experiment
        episodes = $Episodes
        seed = $Seed
        stage = $Stage
        updatedAt = (Get-Date).ToUniversalTime().ToString("o")
        baselineSha256 = $ExpectedBaselineSha256
    }
    foreach ($key in $Extra.Keys) { $payload[$key] = $Extra[$key] }
    $temporary = "$Path.tmp"
    $payload | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $temporary
    Move-Item -Force $temporary $Path
}

if (-not (Test-Path $launcher) -or -not (Test-Path $inventory) -or -not (Test-Path $python)) {
    throw "Phase 2 prerequisites are missing. Run the Windows RL setup first."
}

$baselinePath = Resolve-RepoPath $Baseline
if (-not (Test-Path $baselinePath)) { throw "Baseline checkpoint not found: $baselinePath" }
$actualBaselineSha = (Get-FileHash $baselinePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualBaselineSha -ne $ExpectedBaselineSha256.ToLowerInvariant()) {
    throw "Baseline SHA mismatch. expected=$ExpectedBaselineSha256 actual=$actualBaselineSha"
}

$activeTrainer = @(Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object {
    $_.CommandLine -like "*train_sixmax_selfplay_badugi_dqn.py*"
})
if ($activeTrainer.Count -gt 0) {
    throw "Another six-max training process is already running: $($activeTrainer.ProcessId -join ',')"
}

$settings = $experiments[$Experiment]
$runName = "{0}_{1}k" -f $settings.Name, [int]($Episodes / 1000)
$outputDir = Resolve-RepoPath (Join-Path $RootOutputDir $runName)
$statusPath = Join-Path $outputDir "phase2-status.json"
$screenReport = Join-Path $outputDir "screen-inventory.json"
$screenSummary = Join-Path $outputDir "screen-inventory-summary.json"

if (Test-Path $statusPath) {
    $existing = Get-Content $statusPath -Raw | ConvertFrom-Json
    if ($existing.stage -eq "complete" -and (Test-Path $screenSummary)) {
        Write-Host "Phase 2 run already complete: $outputDir"
        exit 0
    }
}
if (Test-Path $outputDir) {
    $existingCheckpoints = @(Get-ChildItem $outputDir -Filter "badugi_sixmax_dqn_*.pt" -ErrorAction SilentlyContinue)
    if ($existingCheckpoints.Count -gt 0) {
        throw "Refusing to overwrite a partial run with checkpoints: $outputDir"
    }
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Write-Status $statusPath "training" @{ outputDir = $outputDir; config = $settings }

try {
    & $launcher `
        -Mode Resume `
        -Device cpu `
        -Episodes $Episodes `
        -SaveInterval $Episodes `
        -LogInterval 1000 `
        -OutputDir $outputDir `
        -Checkpoint $baselinePath `
        -ProfileMixRate $settings.ProfileMixRate `
        -TrainingProfiles "loose_aggressive,draw_heavy,loose_passive" `
        -LearningRate $settings.LearningRate `
        -ResumeEpsilon $settings.ResumeEpsilon `
        -ResumeEpsilonDecayEpisodes 200000 `
        -OpponentUpdateInterval 1000 `
        -OpponentEpsilon 0.05 `
        -Seed $Seed

    Write-Status $statusPath "evaluation" @{ outputDir = $outputDir }
    $env:PYTHONUTF8 = "1"
    $env:PYTHONIOENCODING = "utf-8"
    $env:PYTHONPATH = "src"
    Push-Location $repoRoot
    try {
        & $python $inventory `
            --checkpoint-dir $outputDir `
            --baseline $baselinePath `
            --milestones $Episodes `
            --onnx-dir (Join-Path $outputDir "screen-onnx") `
            --report $screenReport `
            --device cpu
        if ($LASTEXITCODE -ne 0) { throw "Screen evaluation failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
    Write-Status $statusPath "complete" @{
        outputDir = $outputDir
        screenReport = $screenReport
        screenSummary = $screenSummary
    }
    Write-Host "Phase 2 run complete: $outputDir"
} catch {
    Write-Status $statusPath "failed" @{ outputDir = $outputDir; error = $_.Exception.Message }
    throw
}
