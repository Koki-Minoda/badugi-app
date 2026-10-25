"""Check provenance is stored with artifacts without running training episodes."""

import hashlib
import json
from pathlib import Path

import pytest
import torch

from rl.training import train_draw_lowball_sixmax_dqn as draw_training
from rl.training.train_draw_lowball_sixmax_dqn import (
    DrawLowballSixMaxConfig,
    train_draw_lowball_sixmax_dqn,
)
from rl.training.train_sixmax_selfplay_badugi_dqn import (
    SixMaxSelfPlayConfig,
    train_sixmax_selfplay_badugi_dqn,
)


def _assert_artifacts(summary: dict, checkpoint_path: Path, provenance: dict) -> None:
    manifest = Path(summary["runManifest"])
    assert manifest.exists()
    assert summary["runManifestId"]
    assert summary["sourceFingerprint"]
    assert summary["runManifestSha256"] == hashlib.sha256(manifest.read_bytes()).hexdigest()
    assert provenance == {
        key: summary[key]
        for key in ("runManifest", "runManifestId", "runManifestSha256", "sourceFingerprint")
    }
    manifest_payload = json.loads(manifest.read_text(encoding="utf-8"))
    assert manifest_payload["runId"] == summary["runManifestId"]
    assert manifest_payload["sourceProvenance"]["fingerprint"] == summary["sourceFingerprint"]
    assert manifest_payload["sourceProvenance"]["files"]
    assert checkpoint_path.exists()


def test_badugi_zero_episode_checkpoint_records_manifest(tmp_path: Path):
    summary = train_sixmax_selfplay_badugi_dqn(
        SixMaxSelfPlayConfig(
            total_episodes=0,
            teacher_warmup_episodes=0,
            imitation_pretrain_steps=0,
            buffer_capacity=16,
            batch_size=2,
            hidden_dim=8,
            output_dir=str(tmp_path),
            seed=11,
        ),
    )
    latest = tmp_path / "badugi_sixmax_dqn_latest.pt"
    checkpoint = torch.load(latest, map_location="cpu", weights_only=False)
    _assert_artifacts(summary, latest, checkpoint["training_state"]["training_provenance"])
    assert summary["episodes"] == 0
    assert (tmp_path / "badugi_sixmax_run_manifest.json").exists()


def test_draw_zero_episode_checkpoint_records_manifest(tmp_path: Path):
    summary = train_draw_lowball_sixmax_dqn(
        DrawLowballSixMaxConfig(
            variant_id="S01",
            total_episodes=0,
            teacher_warmup_episodes=0,
            checkpoint_every=0,
            buffer_capacity=16,
            batch_size=2,
            hidden_dim=8,
            output_dir=str(tmp_path),
            seed=11,
        ),
    )
    latest = tmp_path / "draw_lowball_sixmax_S01_dqn_latest.pt"
    checkpoint = torch.load(latest, map_location="cpu", weights_only=False)
    _assert_artifacts(summary, latest, checkpoint["training_provenance"])
    assert summary["episodes"] == 0
    assert (tmp_path / "draw_lowball_sixmax_S01_run_manifest.json").exists()


def test_draw_manifest_survives_failure_before_training(tmp_path: Path, monkeypatch):
    def fail_before_training(**_kwargs):
        raise RuntimeError("agent initialization failed")

    monkeypatch.setattr(draw_training, "_build_agent", fail_before_training)
    with pytest.raises(RuntimeError, match="agent initialization failed"):
        train_draw_lowball_sixmax_dqn(
            DrawLowballSixMaxConfig(
                variant_id="S01",
                total_episodes=1,
                teacher_warmup_episodes=0,
                output_dir=str(tmp_path),
            ),
        )

    manifests = list(tmp_path.glob("draw_lowball_sixmax_S01_run_manifest_*.json"))
    assert len(manifests) == 1
    assert json.loads(manifests[0].read_text(encoding="utf-8"))["config"]["total_episodes"] == 1
