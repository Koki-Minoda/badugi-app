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
