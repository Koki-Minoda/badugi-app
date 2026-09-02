from pathlib import Path


def test_windows_launcher_exposes_reproducible_experiment_controls():
    script = (Path(__file__).resolve().parents[3] / "scripts" / "windows-badugi-rl.ps1").read_text(encoding="utf8")

    for parameter in (
        "ProfileMixRate",
        "TrainingProfiles",
        "LearningRate",
        "ResumeEpsilon",
        "ResumeEpsilonDecayEpisodes",
        "OpponentUpdateInterval",
        "OpponentEpsilon",
        "Seed",
        "ArtifactRoot",
        "MinimumFreeGB",
    ):
        assert f"${parameter}" in script
    assert "Validate-TrainingConfig" in script
    assert '"--profile-mix-rate"' in script
    assert '"--seed"' in script
    assert "MGX_RL_ARTIFACT_ROOT" in script
    assert ".mgx-rl-artifacts" in script
    assert "Artifact drive has only" in script


def test_e12_launcher_is_plan_only_by_default_and_pins_e11():
    script = (Path(__file__).resolve().parents[3] / "scripts" / "windows-badugi-rl-e12.ps1").read_text(encoding="utf8")

    assert '[ValidateSet("Plan", "Run")]' in script
    assert '[ValidateSet("E12-LA", "E12-ANCHOR", "E12-LOWLR")]' in script
    assert '5b44a23972d98a7d4e86c0a742b80b37f70297cff2ac2683683a9f57d065d1ef' in script
    assert '"E12-LA" = @{ Mix = 0.75' in script
    assert '"E12-ANCHOR" = @{ Mix = 0.50' in script
    assert '"E12-LOWLR" = @{ Mix = 0.50; LearningRate = 0.00001' in script
    assert 'if ($Mode -eq "Plan") { exit 0 }' in script
    assert "Another six-max training process is already running" in script


def test_windows_retention_is_marker_scoped_and_dry_run_by_default():
    script = (Path(__file__).resolve().parents[3] / "scripts" / "windows-badugi-rl-retention.ps1").read_text(encoding="utf8")

    assert ".mgx-rl-artifacts" in script
    assert "never a drive root" in script
    assert "if (-not $Apply) { exit 0 }" in script
    assert "referencedNames.Contains" in script
    assert "(winner|best|promoted)" in script
    assert "ShouldProcess" in script


def test_phase2_launcher_pins_baseline_and_serial_experiment_matrix():
    script = (Path(__file__).resolve().parents[3] / "scripts" / "windows-badugi-rl-phase2.ps1").read_text(encoding="utf8")

    assert '[ValidateSet("E0", "E1", "E2", "E3")]' in script
    assert "[ValidateSet(10000, 25000)]" in script
    assert "d93fad43dce8266d6b725eb7e598d2e961db0fbbfafca4eaae993bc78c734079" in script
    assert "Another six-max training process is already running" in script
    assert "Refusing to overwrite a partial run" in script
    assert "screen-inventory-summary.json" in script
