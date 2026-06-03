import json
import tempfile
import unittest
from types import SimpleNamespace
from pathlib import Path

import numpy as np

from rl.training.gate_badugi_model import build_clean_eval_gate_report
from rl.training.evaluate_badugi_sixmax_clean import (
    BET,
    DecisionCounters,
    build_report,
    RAISE,
    checkpoint_episode,
    parse_milestones,
    pro_overlay_action,
    select_milestone_checkpoints,
    summarize_runs,
)


class FakeEnv:
    def __init__(self, *, phase, hand, mask, current_bet=0, player_bet=0, draw_round=0):
        self.phase = phase
        self.hero_seat = 0
        self.players = [{"hand": hand, "bet": player_bet}]
        self.current_bet = current_bet
        self.draw_round = draw_round
        self._mask = np.asarray(mask, dtype=np.float32)

    def _mask_for(self, _seat):
        return self._mask


class BadugiSixMaxCleanEvalTest(unittest.TestCase):
    def test_checkpoint_episode_and_milestone_selection(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ckpt_50 = root / "badugi_dqn_050000_20260602-000000.pt"
            ckpt_100 = root / "badugi_sixmax_dqn_100000_20260602-000000.pt"
            ckpt_50.write_text("x", encoding="utf8")
            ckpt_100.write_text("x", encoding="utf8")

            self.assertEqual(checkpoint_episode(ckpt_50), 50000)
            selected, missing = select_milestone_checkpoints(
                [ckpt_50, ckpt_100],
                [50000, 100000, 200000],
            )

        self.assertEqual([row["episode"] for row in selected], [50000, 100000])
        self.assertEqual(missing, [{"milestone": 200000, "reason": "checkpoint-not-found"}])

    def test_parse_milestones_accepts_k_and_m_suffixes(self):
        self.assertEqual(parse_milestones("50k,100k,1m"), [50000, 100000, 1000000])

    def test_decision_counter_rates_include_clean_gate_metrics(self):
        counters = DecisionCounters()
        counters.decisions = 10
        counters.bet_decisions = 4
        counters.draw_decisions = 6
        counters.fold_actions = 1
        counters.value_opportunities = 2
        counters.value_bets = 1
        counters.bluff_opportunities = 2
        counters.bluffs = 1
        counters.pat_actions = 3
        counters.draw_correct = 5
        counters.onnx_calls = 9
        counters.fallback_actions = 1
        counters.overlay_actions = 2

        rates = counters.rates()

        self.assertEqual(rates["valueBetRate"], 0.5)
        self.assertEqual(rates["bluffRate"], 0.5)
        self.assertEqual(rates["patFrequency"], 0.5)
        self.assertEqual(rates["foldRate"], 0.25)
        self.assertAlmostEqual(rates["drawDecisionAccuracy"], 5 / 6)
        self.assertEqual(rates["onnxUsageRate"], 0.9)
        self.assertEqual(rates["fallbackRate"], 0.1)
        self.assertEqual(rates["proOverlayRate"], 0.2)

    def test_pro_overlay_corrects_bad_draw_and_value_bet(self):
        draw_env = FakeEnv(
            phase="DRAW",
            hand=[(0, 0), (1, 1), (2, 2), (8, 2)],
            mask=[1, 1, 1, 1, 0, 0],
        )
        action, used, reason = pro_overlay_action(draw_env, 0, draw_env._mask)
        self.assertEqual(action, 1)
        self.assertTrue(used)
        self.assertEqual(reason, "clean-draw-policy")

        bet_env = FakeEnv(
            phase="BET",
            hand=[(0, 0), (1, 1), (2, 2), (3, 3)],
            mask=[0, 1, 0, 1, 0, 0],
        )
        action, used, reason = pro_overlay_action(bet_env, 1, bet_env._mask)
        self.assertEqual(action, BET)
        self.assertTrue(used)
        self.assertEqual(reason, "strong-made-value-bet")

    def test_summarize_runs_tracks_worst_profile_and_usage_rates(self):
        base_summary = {
            "episodes": 2,
            "avgReward": 1.0,
            "showdowns": 1,
            "wins": 1,
            "actionCounts": {"0": 1},
            "decisionCounts": {
                "decisions": 4,
                "betDecisions": 2,
                "drawDecisions": 2,
                "foldActions": 1,
                "valueBetOpportunities": 1,
                "valueBetActions": 1,
                "bluffOpportunities": 1,
                "bluffActions": 0,
                "patActions": 1,
                "drawCorrect": 2,
                "onnxCalls": 4,
                "fallbackActions": 0,
                "proOverlayActions": 1,
            },
            "showdownWinRate": 1.0,
            "foldRate": 0.5,
            "valueBetRate": 1.0,
            "bluffRate": 0.0,
            "patFrequency": 0.5,
            "drawDecisionAccuracy": 1.0,
        }
        weak_summary = {**base_summary, "avgReward": -0.5}

        summary = summarize_runs(
            [
                {"opponentProfile": "balanced", "summary": base_summary, "positionSummaries": {}},
                {"opponentProfile": "draw_heavy", "summary": weak_summary, "positionSummaries": {}},
            ]
        )

        self.assertEqual(summary["worstProfile"], "draw_heavy")
        self.assertEqual(summary["worstProfileAvgReward"], -0.5)
        self.assertEqual(summary["onnxUsageRate"], 1.0)
        self.assertEqual(summary["fallbackRate"], 0.0)

    def test_gate_reads_clean_eval_summary_json(self):
        clean_summary = {
            "episodes": 10,
            "avgReward": 1.25,
            "minAvgReward": 1.0,
            "showdowns": 5,
            "wins": 3,
            "folds": 1,
            "showdownWinRate": 0.6,
            "foldRate": 0.1,
            "worstProfile": "balanced",
            "worstProfileAvgReward": 1.1,
            "onnxUsageRate": 1.0,
            "fallbackRate": 0.0,
            "valueBetRate": 0.5,
            "bluffRate": 0.1,
            "patFrequency": 0.4,
            "drawDecisionAccuracy": 0.9,
            "actionCounts": {"1": 3},
            "decisionCounts": {"decisions": 10, "onnxCalls": 10, "fallbackActions": 0},
            "profileSummaries": {"balanced": {"avgReward": 1.1}},
            "positionSummaries": {"BTN": {"avgReward": 1.2}},
        }
        report = {
            "schemaVersion": "badugi-sixmax-clean-eval-v1",
            "passed": True,
            "missingMilestones": [],
            "results": [
                {
                    "checkpoint": "ckpt.pt",
                    "episode": 50000,
                    "milestone": 50000,
                    "cleanEval": {
                        "proOverlayOff": {
                            "passed": True,
                            "gate": {"passed": True, "checks": {}, "failReasons": []},
                            "summary": clean_summary,
                        }
                    },
                }
            ],
        }
        with tempfile.TemporaryDirectory() as tmp:
            report_path = Path(tmp) / "clean.json"
            report_path.write_text(json.dumps(report), encoding="utf8")
            result = build_clean_eval_gate_report(
                SimpleNamespace(
                    clean_eval_report=str(report_path),
                    clean_eval_mode="proOverlayOff",
                    min_avg_reward=0.0,
                    min_showdown_win_rate=0.35,
                    max_fold_rate=0.45,
                    min_worst_profile_avg_reward=0.0,
                    min_baseline_avg_delta=0.25,
                    min_onnx_usage_rate=0.99,
                    max_fallback_rate=0.01,
                )
            )

        self.assertTrue(result["passed"])
        self.assertEqual(result["candidate"]["summary"]["valueBetRate"], 0.5)
        self.assertIn("positionSummaries", result["candidate"]["summary"])

    def test_gate_fails_clean_eval_when_onnx_usage_is_zero(self):
        clean_summary = {
            "episodes": 10,
            "avgReward": 1.25,
            "showdowns": 5,
            "wins": 3,
            "folds": 1,
            "showdownWinRate": 0.6,
            "foldRate": 0.1,
            "worstProfileAvgReward": 1.1,
            "onnxUsageRate": 0.0,
            "fallbackRate": 1.0,
        }
        report = {
            "schemaVersion": "badugi-sixmax-clean-eval-v1",
            "passed": False,
            "missingMilestones": [],
            "results": [
                {
                    "checkpoint": "ckpt.pt",
                    "episode": 50000,
                    "milestone": 50000,
                    "cleanEval": {
                        "proOverlayOff": {
                            "passed": False,
                            "summary": clean_summary,
                        }
                    },
                }
            ],
        }
        with tempfile.TemporaryDirectory() as tmp:
            report_path = Path(tmp) / "clean.json"
            report_path.write_text(json.dumps(report), encoding="utf8")
            result = build_clean_eval_gate_report(
                SimpleNamespace(
                    clean_eval_report=str(report_path),
                    clean_eval_mode="proOverlayOff",
                    min_avg_reward=0.0,
                    min_showdown_win_rate=0.35,
                    max_fold_rate=0.45,
                    min_worst_profile_avg_reward=0.0,
                    min_baseline_avg_delta=0.25,
                    min_onnx_usage_rate=0.99,
                    max_fallback_rate=0.01,
                )
            )

        self.assertFalse(result["passed"])
        self.assertIn("ONNX_USAGE_LOW:0.0000", result["failReasons"])
        self.assertIn("FALLBACK_RATE_HIGH:1.0000", result["failReasons"])

    def test_clean_eval_report_marks_missing_checkpoint_as_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "badugi_sixmax_dqn_050000_missing.pt"
            report = build_report(
                SimpleNamespace(
                    checkpoint_dir=tmp,
                    checkpoint=str(missing),
                    patterns="badugi_sixmax_dqn_*.pt",
                    milestones=[50000],
                    allow_nearest=False,
                    episodes=1,
                    max_steps=1,
                    seeds=[20260602],
                    opponent_profiles=["balanced"],
                    onnx_dir=Path(tmp) / "onnx",
                    device="cpu",
                    allow_torch_fallback=False,
                    min_onnx_usage_rate=0.99,
                    max_fallback_rate=0.01,
                )
            )

        self.assertFalse(report["passed"])
        self.assertEqual(report["missingMilestones"][0]["reason"], "checkpoint-not-found")
        self.assertIn("CHECKPOINT_NOT_FOUND:50000", report["gate"]["failReasons"])


if __name__ == "__main__":
    unittest.main()
