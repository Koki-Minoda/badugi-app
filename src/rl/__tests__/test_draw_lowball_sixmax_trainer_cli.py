import json
import os
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize("variant_id", ["S01", "D01", "S02", "D02"])
def test_draw_lowball_sixmax_trainer_cli_smoke(tmp_path: Path, variant_id: str):
    output_dir = tmp_path / variant_id
    env = os.environ.copy()
    env["PYTHONPATH"] = "src"

    result = subprocess.run(
        [
            sys.executable,
            "src/rl/training/train_draw_lowball_sixmax_dqn.py",
            "--variant-id",
            variant_id,
            "--episodes",
            "1",
            "--checkpoint-every",
            "1",
            "--max-steps",
            "8",
            "--warmup-steps",
            "999",
            "--batch-size",
            "2",
            "--buffer-capacity",
            "16",
            "--hidden-dim",
            "8",
            "--log-interval",
            "0",
            "--seed",
            "11",
            "--output-dir",
            str(output_dir),
            "--device",
            "cpu",
        ],
        cwd=Path(__file__).resolve().parents[3],
        env=env,
        text=True,
        capture_output=True,
        check=True,
    )

    assert f"variant={variant_id}" in result.stdout
    checkpoints = list(output_dir.glob(f"draw_lowball_sixmax_{variant_id}_dqn_*.pt"))
    assert checkpoints

    report = output_dir / f"draw_lowball_sixmax_{variant_id}_dqn_latest_summary.json"
    payload = json.loads(report.read_text(encoding="utf8"))
    assert payload["variantId"] == variant_id
    assert payload["episodes"] == 1
    assert Path(payload["checkpoint"]).exists()
    assert payload["foldMarginBufferSize"] >= 0
    assert payload["callMarginBufferSize"] >= 0
    assert payload["foldMarginTransitions"] >= 0
    assert payload["callMarginTransitions"] >= 0
    assert payload["foldMarginUpdates"] >= 0
    assert payload["callMarginUpdates"] >= 0
    assert payload["foldMargin"] == 0.20
    assert payload["callMargin"] == 0.20
    assert payload["foldMarginWeight"] == 0.40
    assert payload["callMarginWeight"] == 0.40
    assert payload["foldMarginInterval"] == 8
