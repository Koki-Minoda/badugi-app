import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from rl.training.gate_badugi_model import build_clean_eval_gate_report, build_promotion_report


STANDARD_V2_BASELINE_AVG = 0.5571430068778129


def summary(**overrides):
    base = {
        "episodes": 4200,
        "avgReward": 0.62,
        "showdownWinRate": 0.58,
        "foldRate": 0.31,
        "worstProfile": "draw_heavy",
        "worstProfileAvgReward": 0.36,
        "proOverlayRate": 0.10,
        "onnxUsageRate": 1.0,
        "fallbackRate": 0.0,
    }
    base.update(overrides)
    return base


def clean_eval_report(clean_summary):
    return {
        "schemaVersion": "badugi-sixmax-clean-eval-v1",
        "passed": True,
        "missingMilestones": [],
        "results": [
            {
                "checkpoint": "candidate.onnx",
                "episode": None,
                "milestone": None,
                "cleanEval": {
                    "proOverlayOff": {
                        "passed": True,
                        "summary": clean_summary,
                    }
                },
            }
        ],
    }


class BadugiModelGateTest(unittest.TestCase):
    def test_standard_v2_baseline_summary_fails_pro_delta_check(self):
        candidate = summary(
            avgReward=STANDARD_V2_BASELINE_AVG,
            showdownWinRate=0.5743415463041631,
            foldRate=0.3069876438005965,
            worstProfileAvgReward=0.23095951785142962,
            proOverlayRate=0.0,
        )

        report = build_promotion_report(candidate, avg_delta=0.0)

        self.assertFalse(report["failedTierChecks"]["pro"]["baselineAvgDelta"])
        self.assertNotIn("pro", report["eligibleTiers"])

    def test_pro_overlay_rate_above_pro_threshold_fails(self):
        candidate = summary(proOverlayRate=0.20)

        report = build_promotion_report(candidate, avg_delta=0.06)

        self.assertFalse(report["failedTierChecks"]["pro"]["proOverlayRate"])
        self.assertNotIn("pro", report["eligibleTiers"])

    def test_pro_overlay_rate_below_pro_threshold_passes_overlay_check(self):
        candidate = summary(proOverlayRate=0.10)

        report = build_promotion_report(candidate, avg_delta=0.06)

        self.assertIn("pro", report["eligibleTiers"])
        self.assertNotIn("pro", report["failedTierChecks"])

    def test_cli_max_pro_overlay_rate_override_is_applied_to_clean_eval_gate(self):
        candidate = summary(avgReward=0.62, proOverlayRate=0.10)
        baseline = summary(avgReward=STANDARD_V2_BASELINE_AVG, proOverlayRate=0.0)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            candidate_path = root / "candidate.json"
            baseline_path = root / "baseline.json"
            candidate_path.write_text(json.dumps(clean_eval_report(candidate)), encoding="utf8")
            baseline_path.write_text(json.dumps(clean_eval_report(baseline)), encoding="utf8")

            result = build_clean_eval_gate_report(
                SimpleNamespace(
                    clean_eval_report=str(candidate_path),
                    baseline_clean_eval_report=str(baseline_path),
                    clean_eval_mode="proOverlayOff",
                    baseline_clean_eval_mode="proOverlayOff",
                    min_avg_reward=0.55,
                    min_showdown_win_rate=0.50,
                    max_fold_rate=0.38,
                    min_worst_profile_avg_reward=0.35,
                    min_baseline_avg_delta=0.05,
                    max_pro_overlay_rate=0.05,
                    min_onnx_usage_rate=0.99,
                    max_fallback_rate=0.01,
                )
            )

        self.assertFalse(result["checks"]["cleanEval"][0]["proOverlayRate"])
        pro_threshold = next(
            tier for tier in result["promotion"]["tierThresholds"] if tier["tier"] == "pro"
        )
        self.assertEqual(pro_threshold["maxProOverlayRate"], 0.05)

    def test_baseline_delta_at_least_minimum_passes_delta_check(self):
        candidate = summary(avgReward=STANDARD_V2_BASELINE_AVG + 0.05)

        report = build_promotion_report(candidate, avg_delta=0.05)

        self.assertTrue(report["eligibleTiers"])
        self.assertNotIn("pro", report["failedTierChecks"])


if __name__ == "__main__":
    unittest.main()
