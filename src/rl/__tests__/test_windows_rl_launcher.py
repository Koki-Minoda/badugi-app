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
    ):
        assert f"${parameter}" in script
    assert "Validate-TrainingConfig" in script
    assert '"--profile-mix-rate"' in script
    assert '"--seed"' in script


def test_phase2_launcher_pins_baseline_and_serial_experiment_matrix():
    script = (Path(__file__).resolve().parents[3] / "scripts" / "windows-badugi-rl-phase2.ps1").read_text(encoding="utf8")

    assert '[ValidateSet("E0", "E1", "E2", "E3")]' in script
    assert "[ValidateSet(10000, 25000)]" in script
    assert "d93fad43dce8266d6b725eb7e598d2e961db0fbbfafca4eaae993bc78c734079" in script
    assert "Another six-max training process is already running" in script
    assert "Refusing to overwrite a partial run" in script
    assert "screen-inventory-summary.json" in script
