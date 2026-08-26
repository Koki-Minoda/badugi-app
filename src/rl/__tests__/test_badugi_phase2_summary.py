from rl.training.summarize_badugi_phase2_experiments import choose_winner, stop_reasons


def _run(name, *, passed=True, stopped=False, worst=0.2, avg=0.5, value_bet=0.7):
    return {
        "run": name,
        "extensionEligible": passed and not stopped,
        "candidate": {
            "worstProfileAvgReward": worst,
            "avgReward": avg,
            "valueBetRate": value_bet,
        },
    }


def test_phase2_stop_reasons_match_predeclared_thresholds():
    comparison = {
        "deltas": {
            "avgReward": -0.031,
            "worstProfileAvgReward": -0.051,
            "guardProfile": -0.049,
            "valueBetRate": -0.101,
        }
    }

    assert stop_reasons(comparison) == [
        "AVG_DELTA_BELOW_-0.03",
        "WORST_DELTA_BELOW_-0.05",
        "VALUE_BET_DELTA_BELOW_-0.10",
    ]


def test_phase2_winner_excludes_failed_or_stopped_runs():
    winner = choose_winner([
        _run("failed", passed=False, worst=0.9),
        _run("stopped", stopped=True, worst=0.8),
        _run("eligible-a", worst=0.3, avg=0.6),
        _run("eligible-b", worst=0.4, avg=0.5),
    ])

    assert winner["run"] == "eligible-b"
