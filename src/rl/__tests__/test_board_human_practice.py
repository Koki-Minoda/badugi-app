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
                    json.dumps({
                        "variantId": "B05",
                        "heroNet": 12,
                        "heroPosition": "BTN",
                        "showdown": True,
                        "seats": [{"seat": 0, "actions": [{"street": "PREFLOP", "type": "raise"}]}],
                    }),
                    json.dumps({
                        "variantId": "plo",
                        "heroNet": -4,
                        "heroPosition": "CO",
                        "seats": [{"seat": 0, "actions": [{"street": "PREFLOP", "type": "call"}]}],
                    }),
                    json.dumps({"variantId": "B06", "heroNet": 20}),
                    json.dumps({
                        "humanBenchmark": {"variantId": "B05", "heroResult": "tie", "heroNet": 0},
                        "feedbackContext": {"position": "BB"},
                        "seats": [{"seat": 0, "handLabel": "Two Pair", "actions": [{"type": "check"}]}],
                    }),
                ]
            ),
            encoding="utf8",
        )

        summary = summarize_human_logs(path, "B05", min_hands=3)

    assert summary["hands"] == 3
    assert summary["wins"] == 1
    assert summary["losses"] == 1
    assert summary["ties"] == 1
    assert summary["evSamples"] == 3
    assert summary["avgEV"] == (12 - 4 + 0) / 3
    assert summary["showdownHands"] == 2
    assert summary["positionCoverage"] == 3
    assert summary["positions"]["BTN"]["pfr"] == 1.0
    assert summary["positions"]["CO"]["vpip"] == 1.0
    assert summary["verified"] is True


def test_board_human_log_variant_id_accepts_nested_feedback_context():
    assert (
        record_variant_id({"feedbackContext": {"variant_id": "B01"}})
        == "B01"
    )


def test_board_human_log_summary_requires_ev_samples_for_verification():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir) / "board.json"
        path.write_text(
            json.dumps(
                {
                    "hands": [
                        {"variantId": "B01", "heroResult": "win", "heroPosition": "BTN"},
                        {"variantId": "B01", "heroResult": "loss", "heroPosition": "CO"},
                    ]
                }
            ),
            encoding="utf8",
        )

        summary = summarize_human_logs(path, "B01", min_hands=2)

    assert summary["hands"] == 2
    assert summary["decidedHands"] == 2
    assert summary["evSamples"] == 0
    assert summary["verified"] is False


def test_board_human_log_summary_ignores_records_without_variant():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir) / "board.jsonl"
        path.write_text(
            "\n".join(
                [
                    json.dumps({"heroNet": 100, "heroPosition": "BTN"}),
                    json.dumps({"variantId": "B01", "heroNet": 8, "heroPosition": "BTN"}),
                ]
            ),
            encoding="utf8",
        )

        summary = summarize_human_logs(path, "B01", min_hands=1)

    assert summary["hands"] == 1
    assert summary["netChips"] == 8
    assert summary["verified"] is True
