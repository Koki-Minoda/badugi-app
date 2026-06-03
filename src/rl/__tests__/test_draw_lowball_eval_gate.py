import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from rl.training.evaluate_draw_onnx import evaluate as evaluate_draw_onnx_model
from rl.training.evaluate_draw_onnx import fixtures_for_variant
from rl.training.evaluate_selfplay_draw import (
    FOLD_TO_BET_PREDRAW_ONLY_NOTE,
    ProfileResult,
    build_report_payload,
    infer_variant_config,
    summarize_results,
)
from rl.training.gate_draw_model import (
    GATE_THRESHOLDS,
    build_gate_report,
    build_metric_checks,
    checkpoint_allows_variant,
)


class DrawLowballEvalGateTest(unittest.TestCase):
    def test_variant_config_sets_single_draw_max_draws(self):
        self.assertEqual(infer_variant_config("D01", "low-27", None)["maxDraws"], 3)
        self.assertEqual(infer_variant_config("D02", "low-a5", None)["maxDraws"], 3)
        self.assertEqual(infer_variant_config("S01", "low-27", None)["maxDraws"], 1)
        self.assertEqual(infer_variant_config("S02", "low-a5", None)["maxDraws"], 1)
        self.assertEqual(infer_variant_config("S01", "low-27", 2)["maxDraws"], 2)

    def test_summary_exposes_gate_metrics_and_worst_profile(self):
        strong = ProfileResult(
            profile="standard",
            episodes=4,
            wins=3,
            losses=1,
            draws=0,
            showdowns=2,
            showdown_wins=1,
            folds=1,
            opponent_folds=1,
            draw_decisions=4,
            pat_actions=2,
            strong_low_draw_decisions=2,
            strong_low_pats=2,
            draw_correct=3,
            draw_mistakes=1,
            total_reward=2.0,
        )
        weak = ProfileResult(
            profile="aggressive",
            episodes=4,
            wins=1,
            losses=3,
            draws=0,
            showdowns=2,
            showdown_wins=0,
            folds=2,
            opponent_folds=0,
            draw_decisions=4,
            pat_actions=1,
            strong_low_draw_decisions=1,
            strong_low_pats=0,
            draw_correct=1,
            draw_mistakes=3,
            total_reward=-2.0,
        )

        summary = summarize_results([strong, weak])

        self.assertIn("avgReward", summary)
        self.assertIn("winRate", summary)
        self.assertIn("showdownWinRate", summary)
        self.assertIn("foldRate", summary)
        self.assertIn("patFrequency", summary)
        self.assertIn("patRateWithStrongLow", summary)
        self.assertIn("drawAccuracy", summary)
        self.assertIn("drawMistakeRate", summary)
        self.assertEqual(summary["worstProfile"], "aggressive")
        self.assertEqual(summary["worstProfileAvgReward"], -0.5)
        self.assertEqual(summary["drawAccuracy"], 0.5)

    def test_profile_result_calculates_fold_to_bet_rate(self):
        result = ProfileResult(
            profile="standard",
            episodes=1,
            wins=0,
            losses=1,
            draws=0,
            showdowns=0,
            showdown_wins=0,
            folds=1,
            opponent_folds=0,
            draw_decisions=0,
            pat_actions=0,
            strong_low_draw_decisions=0,
            strong_low_pats=0,
            draw_correct=0,
            draw_mistakes=0,
            total_reward=-1.0,
            fold_to_bet_count=2,
            fold_opportunity_count=8,
        )

        self.assertEqual(result.fold_to_bet_rate, 0.25)

    def test_profile_result_fold_to_bet_fields_default_to_zero(self):
        result = ProfileResult(
            profile="standard",
            episodes=1,
            wins=1,
            losses=0,
            draws=0,
            showdowns=1,
            showdown_wins=1,
            folds=0,
            opponent_folds=0,
            draw_decisions=1,
            pat_actions=1,
            strong_low_draw_decisions=1,
            strong_low_pats=1,
            draw_correct=1,
            draw_mistakes=0,
            total_reward=1.0,
        )

        self.assertEqual(result.fold_to_bet_count, 0)
        self.assertEqual(result.fold_opportunity_count, 0)
        self.assertEqual(result.fold_to_bet_rate, 0.0)

    def test_summary_exposes_fold_to_bet_metrics(self):
        result = ProfileResult(
            profile="standard",
            episodes=1,
            wins=0,
            losses=1,
            draws=0,
            showdowns=0,
            showdown_wins=0,
            folds=1,
            opponent_folds=0,
            draw_decisions=0,
            pat_actions=0,
            strong_low_draw_decisions=0,
            strong_low_pats=0,
            draw_correct=0,
            draw_mistakes=0,
            total_reward=-1.0,
            fold_to_bet_count=2,
            fold_opportunity_count=8,
        )

        summary = summarize_results([result])

        self.assertIn("foldToBetPct", summary)
        self.assertIn("foldToBetCount", summary)
        self.assertIn("foldOpportunityCount", summary)
        self.assertIn("predrawFoldToBetPct", summary)
        self.assertIn("predrawFoldToBetCount", summary)
        self.assertIn("predrawFoldOpportunityCount", summary)
        self.assertEqual(summary["foldToBetPct"], 0.25)
        self.assertEqual(summary["foldToBetCount"], 2)
        self.assertEqual(summary["foldOpportunityCount"], 8)
        self.assertEqual(summary["predrawFoldToBetPct"], 0.25)
        self.assertEqual(summary["predrawFoldToBetCount"], 2)
        self.assertEqual(summary["predrawFoldOpportunityCount"], 8)

    def test_report_payload_keeps_summary_json_shape(self):
        result = ProfileResult(
            profile="standard",
            episodes=1,
            wins=1,
            losses=0,
            draws=0,
            showdowns=1,
            showdown_wins=1,
            folds=0,
            opponent_folds=0,
            draw_decisions=1,
            pat_actions=1,
            strong_low_draw_decisions=1,
            strong_low_pats=1,
            draw_correct=1,
            draw_mistakes=0,
            total_reward=1.0,
        )
        payload = build_report_payload(
            checkpoint_path=Path("model.pt"),
            variant_id="S01",
            family="low-27",
            max_draws=1,
            episodes=1,
            max_steps=10,
            seed=1,
            profiles=("standard",),
            results=[result],
        )

        self.assertEqual(payload["schemaVersion"], "draw-lowball-selfplay-eval-v1")
        self.assertEqual(payload["variantId"], "S01")
        self.assertEqual(payload["maxDraws"], 1)
        self.assertEqual(payload["summary"]["avgReward"], 1.0)
        self.assertEqual(payload["overall_avg_reward"], 1.0)
        self.assertEqual(payload["episodes_per_profile"], 1)
        self.assertEqual(payload["profiles"][0]["win_rate"], 1.0)
        self.assertIn("standard", payload["profileSummaries"])
        self.assertIn("notes", payload)
        self.assertIn("metadata", payload)
        self.assertIn(FOLD_TO_BET_PREDRAW_ONLY_NOTE, payload["notes"])
        self.assertIn(FOLD_TO_BET_PREDRAW_ONLY_NOTE, payload["metadata"]["notes"])
        self.assertIn("predrawFoldToBetPct", payload["summary"])
        self.assertIn("foldToBetPct", payload["summary"])
        self.assertIn("predrawFoldToBetPct", payload["profiles"][0])
        self.assertIn("foldToBetPct", payload["profiles"][0])

    def test_sd_pro_gate_rejects_generic_td_checkpoint_name(self):
        allowed, reason = checkpoint_allows_variant(Path("low-27_selfplay_dqn_latest.pt"), "S01", "pro")
        self.assertFalse(allowed)
        self.assertEqual(reason, "SD_PRO_REQUIRES_VARIANT_SPECIFIC_CHECKPOINT")

        allowed, reason = checkpoint_allows_variant(Path("s01_sd_dqn_latest.pt"), "S01", "pro")
        self.assertTrue(allowed)
        self.assertIsNone(reason)

        allowed, reason = checkpoint_allows_variant(
            Path("rl/models/draw/s02_sd_v2_25k/low-a5_selfplay_dqn_020000.pt"),
            "S02",
            "pro",
        )
        self.assertTrue(allowed)
        self.assertIsNone(reason)

        allowed, reason = checkpoint_allows_variant(Path("low-27_selfplay_dqn_latest.pt"), "S01", "standard")
        self.assertTrue(allowed)
        self.assertIsNone(reason)

    def test_metric_checks_apply_variant_thresholds(self):
        summary = {
            "avgReward": 0.2,
            "winRate": 0.52,
            "showdownWinRate": 0.48,
            "foldRate": 0.39,
            "patRateWithStrongLow": 0.88,
            "drawAccuracy": 0.66,
            "drawMistakeRate": 0.34,
            "worstProfileAvgReward": -0.10,
        }
        checks = build_metric_checks(
            summary,
            {
                "minAvgReward": 0.18,
                "minWinRate": 0.51,
                "minShowdownWinRate": 0.47,
                "maxFoldRate": 0.40,
                "minPatRateWithStrongLow": 0.88,
                "minDrawAccuracy": 0.66,
                "maxDrawMistakeRate": 0.34,
                "minWorstProfileAvgReward": -0.12,
            },
        )

        self.assertTrue(all(checks.values()))

    def test_s02_gate_treats_draw_accuracy_as_report_only_for_all_tiers(self):
        for tier in ("standard", "pro", "iron"):
            thresholds = GATE_THRESHOLDS["S02"][tier]
            summary = {
                "avgReward": thresholds["minAvgReward"],
                "winRate": thresholds["minWinRate"],
                "showdownWinRate": thresholds["minShowdownWinRate"],
                "foldRate": thresholds["maxFoldRate"],
                "patRateWithStrongLow": thresholds["minPatRateWithStrongLow"],
                "drawAccuracy": 0.0,
                "drawMistakeRate": 1.0,
                "worstProfileAvgReward": thresholds["minWorstProfileAvgReward"],
            }

            checks = build_metric_checks(summary, thresholds, variant_id="S02")
            fail_reasons = [key for key, passed in checks.items() if not passed]

            self.assertTrue(all(checks.values()))
            self.assertNotIn("drawAccuracy", checks)
            self.assertNotIn("drawMistakeRate", checks)
            self.assertNotIn("drawAccuracy", fail_reasons)
            self.assertNotIn("drawMistakeRate", fail_reasons)

    def test_non_s02_variants_keep_draw_accuracy_gate(self):
        for variant_id in ("D01", "D02", "S01"):
            thresholds = GATE_THRESHOLDS[variant_id]["standard"]
            summary = {
                "avgReward": thresholds["minAvgReward"],
                "winRate": thresholds["minWinRate"],
                "showdownWinRate": thresholds["minShowdownWinRate"],
                "foldRate": thresholds["maxFoldRate"],
                "patRateWithStrongLow": thresholds["minPatRateWithStrongLow"],
                "drawAccuracy": 0.0,
                "drawMistakeRate": 1.0,
                "worstProfileAvgReward": thresholds["minWorstProfileAvgReward"],
            }

            checks = build_metric_checks(summary, thresholds, variant_id=variant_id)

            self.assertFalse(checks["drawAccuracy"])
            self.assertFalse(checks["drawMistakeRate"])

    def test_missing_checkpoint_is_explicit_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "missing.pt"
            report = build_gate_report(
                SimpleNamespace(
                    checkpoint=str(missing),
                    variant_id="D01",
                    tier="standard",
                    episodes=1,
                    max_steps=1,
                    family="low-27",
                    max_draws=None,
                    profiles="standard",
                    seed=1,
                    device="cpu",
                )
            )

        self.assertFalse(report["passed"])
        self.assertFalse(report["checks"]["checkpointExists"])
        self.assertTrue(report["failReasons"][0].startswith("CHECKPOINT_NOT_FOUND"))

    def test_single_draw_onnx_fixtures_are_variant_specific(self):
        s01_names = {fixture["name"] for fixture in fixtures_for_variant("S01")}
        s02_names = {fixture["name"] for fixture in fixtures_for_variant("S02")}

        self.assertIn("rough-nine-pats-in-sd", s01_names)
        self.assertIn("borderline-nine-low-with-pair", s01_names)
        self.assertIn("eight-high-a5-pats-in-sd", s02_names)
        self.assertIn("nine-high-a5-context-dependent-sd", s02_names)
        self.assertIn("pair-a5-breaks-even-with-low-pair", s02_names)

    def test_s02_context_dependent_onnx_fixtures_are_report_only(self):
        fixtures = {fixture["name"]: fixture for fixture in fixtures_for_variant("S02")}

        self.assertNotIn("blocking", fixtures["a5-wheel-stands-pat"])
        self.assertFalse(fixtures["eight-high-a5-pats-in-sd"]["blocking"])
        self.assertFalse(fixtures["nine-high-a5-context-dependent-sd"]["blocking"])
        self.assertFalse(fixtures["pair-a5-breaks-even-with-low-pair"]["blocking"])

    def test_non_s02_onnx_fixtures_remain_blocking(self):
        for variant_id in ("D01", "D02", "S01"):
            with self.subTest(variant_id=variant_id):
                self.assertTrue(all(fixture.get("blocking", True) for fixture in fixtures_for_variant(variant_id)))

    def test_s02_report_only_fixture_failures_do_not_populate_blocking_failures(self):
        decisions = iter(
            [
                {"drawAction": "draw_0", "drawCount": 0, "scores": []},
                {"drawAction": "draw_1", "drawCount": 1, "scores": []},
                {"drawAction": "draw_1", "drawCount": 1, "scores": []},
                {"drawAction": "draw_0", "drawCount": 0, "scores": []},
            ]
        )
        with patch("rl.training.evaluate_draw_onnx.run_model", side_effect=lambda *_args: next(decisions)):
            report = evaluate_draw_onnx_model(Path("s02.onnx"), "S02")

        self.assertEqual(report["failures"], [])
        self.assertEqual(report["blockingFailures"], [])
        self.assertEqual(len(report["reportOnlyFailures"]), 3)


if __name__ == "__main__":
    unittest.main()
