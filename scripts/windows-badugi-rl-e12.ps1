[CmdletBinding()]
param(
    [ValidateSet("Plan", "Run")]
    [string]$Mode = "Plan",
    [ValidateSet("E12-LA", "E12-ANCHOR", "E12-LOWLR")]
    [string]$Experiment = "E12-LA",
    [ValidateSet(3000, 10000)]
    [int]$Episodes = 3000,
    [string]$E11Checkpoint = "rl/models/badugi_sixmax_e11/badugi_sixmax_dqn_0003000.pt",
    [string]$ArtifactRoot = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot "windows-badugi-rl.ps1"
$expectedE11Sha = "5b44a23972d98a7d4e86c0a742b80b37f70297cff2ac2683683a9f57d065d1ef"
$seed = 20260903
$profiles = "loose_aggressive,draw_heavy,tight_aggressive"

$matrix = @{
    "E12-LA" = @{ Mix = 0.75; LearningRate = 0.00003; Anchor = $false }
    "E12-ANCHOR" = @{ Mix = 0.50; LearningRate = 0.00003; Anchor = $true }
    "E12-LOWLR" = @{ Mix = 0.50; LearningRate = 0.00001; Anchor = $false }
}

function Resolve-RepoPath([string]$PathValue) {
    if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
    return Join-Path $repoRoot $PathValue
}

$checkpoint = Resolve-RepoPath $E11Checkpoint
$settings = $matrix[$Experiment]
$resolvedArtifactRoot = if ($ArtifactRoot) {
    $ArtifactRoot
} elseif ($env:MGX_RL_ARTIFACT_ROOT) {
    $env:MGX_RL_ARTIFACT_ROOT
} elseif (Test-Path "D:\") {
    "D:\MGX-RL"
} else {
    Join-Path $repoRoot "rl\models\badugi_e12_windows"
}
$outputDir = Join-Path $resolvedArtifactRoot ("{0}-{1}ep-seed{2}" -f $Experiment.ToLowerInvariant(), $Episodes, $seed)

$plan = [ordered]@{
    mode = $Mode
    experiment = $Experiment
    episodes = $Episodes
    checkpoint = $checkpoint
    requiredCheckpointSha256 = $expectedE11Sha
    artifactRoot = $resolvedArtifactRoot
    outputDir = $outputDir
    profileMixRate = $settings.Mix
    profiles = $profiles
    fixedE11Opponent = $settings.Anchor
    learningRate = $settings.LearningRate
    resumeEpsilon = 0.08
    opponentEpsilon = 0.03
    seed = $seed
}
$plan | ConvertTo-Json
if ($Mode -eq "Plan") { exit 0 }

if (-not (Test-Path $checkpoint)) { throw "E11 checkpoint not found: $checkpoint" }
$actualSha = (Get-FileHash -Algorithm SHA256 $checkpoint).Hash.ToLowerInvariant()
if ($actualSha -ne $expectedE11Sha) {
    throw "E11 checkpoint SHA-256 mismatch. Expected $expectedE11Sha, got $actualSha"
}
$active = @(Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object {
    $_.CommandLine -match "train_sixmax_selfplay_badugi_dqn"
})
if ($active.Count -gt 0) { throw "Another six-max training process is already running." }
if (Test-Path $outputDir) { throw "Refusing to overwrite E12 output: $outputDir" }

$launcherArgs = @{
    Mode = "Resume"
    Device = "cpu"
    Episodes = $Episodes
    SaveInterval = 1000
    LogInterval = 250
    ProfileMixRate = $settings.Mix
    TrainingProfiles = $profiles
    LearningRate = $settings.LearningRate
    ResumeEpsilon = 0.08
    ResumeEpsilonDecayEpisodes = $Episodes
    OpponentUpdateInterval = $(if ($settings.Anchor) { 1000000000 } else { 1000 })
    OpponentEpsilon = 0.03
    Seed = $seed
    OutputDir = $outputDir
    Checkpoint = $checkpoint
    ArtifactRoot = $resolvedArtifactRoot
}
if ($settings.Anchor) { $launcherArgs.OpponentCheckpoint = $checkpoint }
& $launcher @launcherArgs
if ($LASTEXITCODE -ne 0) { throw "$Experiment failed with exit code $LASTEXITCODE" }
