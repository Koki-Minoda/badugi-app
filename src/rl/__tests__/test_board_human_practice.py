import json
import tempfile
from pathlib import Path

from rl.training.benchmark_board_human_practice import (
    record_variant_id,
    summarize_human_logs,
)


def test_board_human_log_summary_filters_variant_and_marks_verified():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir) / "board.jsonl"
        path.write_text(
            "\n".join(
                [
                    json.dumps({"variantId": "B05", "heroNet": 12}),
                    json.dumps({"variantId": "B05", "heroNet": -4}),
                    json.dumps({"variantId": "B06", "heroNet": 20}),
                    json.dumps({"humanBenchmark": {"variantId": "B05", "heroResult": "tie"}}),
                ]
            ),
            encoding="utf8",
        )

        summary = summarize_human_logs(path, "B05", min_hands=3)

    assert summary["hands"] == 3
    assert summary["wins"] == 1
    assert summary["losses"] == 1
    assert summary["ties"] == 1
    assert summary["verified"] is True


def test_board_human_log_variant_id_accepts_nested_feedback_context():
    assert (
        record_variant_id({"feedbackContext": {"variant_id": "B01"}})
        == "B01"
    )
