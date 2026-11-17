"""Development fit keeps sessions independent and never opens the action gate."""
import unittest

from rl.training.badugi_public_style_weight_fit_draft import (
    fit_style_weight, validate_style_weight,
)


def row(session, state=0, group=0, profile="balanced", truth=0, base=0.6, weighted=0.7):
    return {"sessionId": session, "stateId": state, "group": group, "profile": profile,
            "truthBucket": truth,
            "probabilities": {"0": [base, 1-base, 0, 0],
                              "0.25": [weighted, 1-weighted, 0, 0],
                              "0.5": [weighted, 1-weighted, 0, 0],
                              "0.75": [weighted, 1-weighted, 0, 0]}}


class StyleWeightFitTests(unittest.TestCase):
    def test_fit_counts_sessions_not_correlated_decisions(self):
        rows = [row(1, state=i, weighted=0.9) for i in range(100)]
        rows += [row(i, weighted=0.1) for i in range(2, 12)]
        result = fit_style_weight(rows, min_sessions=11)
        self.assertEqual(result["sessions"], 11)
        self.assertEqual(result["weight"], "0")
        self.assertFalse(result["actionOverrideAllowed"])

    def test_sparse_and_negative_cells_fail_closed(self):
        fitted = fit_style_weight([row(i, weighted=0.8) for i in range(100)],
                                  min_sessions=100)
        report = validate_style_weight([row(i, weighted=0.5) for i in range(10)],
                                       fitted, profiles=["balanced"])
        self.assertEqual(len(report["cells"]), 10)
        self.assertFalse(report["allCellsNonWorse"])
        self.assertFalse(report["minimumGlobalGainMet"])
        self.assertFalse(report["actionOverrideAllowed"])

    def test_private_fields_and_mixed_cells_rejected(self):
        with self.assertRaisesRegex(ValueError, "exact offline"):
            fit_style_weight([{**row(1), "opponentPrivateCards": []}], min_sessions=1)
        with self.assertRaisesRegex(ValueError, "multiple cells"):
            fit_style_weight([row(1), row(1, state=1, group=1)], min_sessions=1)
        with self.assertRaisesRegex(ValueError, "same state twice"):
            fit_style_weight([row(1), row(1)], min_sessions=1)
        self.assertIsNone(fit_style_weight([row(1)], min_sessions=2)["weight"])


if __name__ == "__main__":
    unittest.main()
