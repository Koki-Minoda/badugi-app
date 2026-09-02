[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactRoot,
    [ValidateRange(1, 20)]
    [int]$KeepRecentCheckpoints = 2,
    [ValidateRange(1, 365)]
    [int]$MinimumAgeDays = 2,
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($ArtifactRoot).TrimEnd('\')
$rootPath = [System.IO.Path]::GetPathRoot($root).TrimEnd('\')
if ($root -eq $rootPath -or $root.Length -lt 6) {
    throw "ArtifactRoot must be a dedicated subdirectory, never a drive root."
}
$marker = Join-Path $root ".mgx-rl-artifacts"
if (-not (Test-Path $marker -PathType Leaf)) {
    throw "Retention marker is missing: $marker"
}

$referencedNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
Get-ChildItem $root -Recurse -File -Include *.json | ForEach-Object {
    try {
        $payload = Get-Content $_.FullName -Raw | ConvertFrom-Json
        $serialized = $payload | ConvertTo-Json -Depth 100 -Compress
        [regex]::Matches($serialized, '[^"\\/]+\.pt') | ForEach-Object {
            [void]$referencedNames.Add($_.Value)
        }
    } catch {
        throw "Cannot safely parse retention evidence: $($_.FullName)"
    }
}

$cutoff = (Get-Date).AddDays(-$MinimumAgeDays)
$candidates = @()
Get-ChildItem $root -Directory | ForEach-Object {
    $run = $_
    $checkpoints = @(Get-ChildItem $run.FullName -File -Filter *.pt | Sort-Object LastWriteTime -Descending)
    $recent = @($checkpoints | Select-Object -First $KeepRecentCheckpoints | ForEach-Object Name)
    foreach ($checkpoint in $checkpoints) {
        $keep = $recent -contains $checkpoint.Name -or
            $referencedNames.Contains($checkpoint.Name) -or
            $checkpoint.Name -match '(winner|best|promoted)'
        if (-not $keep -and $checkpoint.LastWriteTime -lt $cutoff) {
            $candidates += $checkpoint
        }
    }
}

$summary = [ordered]@{
    artifactRoot = $root
    apply = [bool]$Apply
    referencedCheckpoints = @($referencedNames | Sort-Object)
    candidateCount = $candidates.Count
    reclaimBytes = ($candidates | Measure-Object Length -Sum).Sum
    candidates = @($candidates | ForEach-Object FullName)
}
$summary | ConvertTo-Json -Depth 4
if (-not $Apply) { exit 0 }

foreach ($candidate in $candidates) {
    if ($PSCmdlet.ShouldProcess($candidate.FullName, "Remove unreferenced RL checkpoint")) {
        Remove-Item -LiteralPath $candidate.FullName -Force
    }
}
