from types import SimpleNamespace

from rl.training.inventory_badugi_sixmax_checkpoints import (
    compare_to_baseline,
    compact_summary,
    select_best,
    select_best_observed,
)


def _result(*, avg, worst, guard, value_bet, checkpoint, episode):
    summary = {
        "avgReward": avg,
        "worstProfile": "loose_aggressive",
        "worstProfileAvgReward": worst,
        "valueBetRate": value_bet,
        "foldRate": 0.3,
        "showdownWinRate": 0.6,
        "profileSummaries": {"loose_aggressive": {"avgReward": guard}},
    }
    return {
        "checkpoint": checkpoint,
        "episode": episode,
        "cleanEval": {
            "proOverlayOff": {"summary": summary, "gate": {"passed": True}}
        },
    }


def _args():
    return SimpleNamespace(
        guard_profile="loose_aggressive",
        min_avg_delta=0.0,
        min_worst_delta=-0.02,
        min_guard_profile_delta=-0.02,
        min_value_bet_delta=-0.05,
    )


def test_inventory_regression_gate_and_best_selection():
    baseline = _result(avg=0.50, worst=0.20, guard=0.25, value_bet=0.70, checkpoint="base.pt", episode=0)
    passing = _result(avg=0.52, worst=0.24, guard=0.26, value_bet=0.68, checkpoint="20k.pt", episode=20_000)
    failing = _result(avg=0.55, worst=0.10, guard=0.11, value_bet=0.40, checkpoint="30k.pt", episode=30_000)

    passing_comparison = compare_to_baseline(passing, baseline, _args())
    failing_comparison = compare_to_baseline(failing, baseline, _args())

    assert passing_comparison["passedRegressionGate"] is True
    assert failing_comparison["passedRegressionGate"] is False
    assert select_best([failing_comparison, passing_comparison])["checkpoint"] == "20k.pt"
    assert select_best([failing_comparison]) is None
    assert select_best_observed([failing_comparison, passing_comparison])["checkpoint"] == "20k.pt"


def test_compact_summary_drops_raw_runs():
    baseline = _result(avg=0.50, worst=0.20, guard=0.25, value_bet=0.70, checkpoint="base.pt", episode=0)
    report = {
        "updatedAt": "now",
        "status": "complete",
        "config": {},
        "baseline": {"sha256": "abc", "result": {**baseline, "raw": [1, 2, 3]}},
        "comparisons": [],
        "bestCheckpoint": None,
        "bestObservedCheckpoint": None,
        "recommendedAction": "retain-baseline",
    }

    summary = compact_summary(report)

    assert summary["baseline"]["sha256"] == "abc"
    assert "raw" not in summary["baseline"]
