"""The paired-action study cannot conceal illegal moves or chip imbalance."""
import unittest

from rl.evaluation.badugi_action_ev_draft import summarize_paired_action_ev


def row(session, state=0, gain=2):
    return {"sessionId": session, "stateId": state, "group": 0,
            "profile": "tight_value", "legalMask": [0, 1, 0, 1, 0, 0],
            "baseAction": 1, "alternateAction": 3, "activeBigBlind": 2,
            "baseChipDeltaBySeat": [0, 0],
            "alternateChipDeltaBySeat": [gain, -gain], "heroSeat": 0}


class PairedActionEvTests(unittest.TestCase):
    def test_session_not_hand_is_bootstrap_unit(self):
        rows = [row(1, 0, 4), row(1, 1, 4), row(2, 0, -2)]
        report = summarize_paired_action_ev(rows, minimum_sessions_per_cell=2,
                                            bootstrap_repetitions=100, seed=4)
        cell = report["cells"][0]
        self.assertEqual(cell["independentSessions"], 2)
        self.assertEqual(cell["pairedTargets"], 3)
        self.assertEqual(cell["meanBigBetsPerSelectedDecision"], .25)
        self.assertFalse(report["actionOverrideAllowed"])
        self.assertFalse(report["promotionEligible"])
        self.assertFalse(report["complete40CellMatrix"])

    def test_rejects_duplicate_target(self):
        with self.assertRaisesRegex(ValueError, "twice"):
            summarize_paired_action_ev([row(1), row(1)])

    def test_rejects_illegal_or_non_bet_action(self):
        bad = row(1)
        bad["alternateAction"] = 4
        with self.assertRaisesRegex(ValueError, "legal BET"):
            summarize_paired_action_ev([bad])
        bad = row(1)
        bad["alternateAction"] = 5
        with self.assertRaisesRegex(ValueError, "legal BET"):
            summarize_paired_action_ev([bad])

    def test_rejects_chip_imbalance(self):
        bad = row(1)
        bad["alternateChipDeltaBySeat"] = [2, -1]
        with self.assertRaisesRegex(ValueError, "conserve chips"):
            summarize_paired_action_ev([bad])

    def test_rejects_session_reused_across_cells(self):
        other = row(1, 1)
        other["group"] = 2
        with self.assertRaisesRegex(ValueError, "one session"):
            summarize_paired_action_ev([row(1), other])


if __name__ == "__main__":
    unittest.main()
