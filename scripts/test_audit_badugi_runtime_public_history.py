"""Small contract checks for the diagnostic Badugi event auditor."""

import importlib.util
from pathlib import Path
import unittest


def _audit_snapshot(row):
    source = Path(__file__).with_name("audit-badugi-runtime-public-history.py")
    spec = importlib.util.spec_from_file_location("badugi_public_history_audit", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.audit_snapshot(row, [], 600)


def _row(phase="DRAW", draw_round=0):
    events = [
        {"type": "BET_ACTION", "seat": 1, "action": "bet", "amount": 2,
         "drawRoundIndex": 0, "betRoundIndex": 0},
        {"type": "DRAW_ACTION", "seat": 1, "drawCount": 2,
         "drawRoundIndex": 0, "betRoundIndex": 0},
    ]
    if phase == "BET":
        events.append({"type": "BET_ACTION", "seat": 2, "action": "raise", "amount": 2,
                       "drawRoundIndex": 1, "betRoundIndex": 1})
        events.append({"type": "BET_ACTION", "seat": 3, "action": "all-in", "amount": 0,
                       "drawRoundIndex": 1, "betRoundIndex": 1})
    invested = 4 if phase == "BET" else 2
    players = [{"lastDrawCount": 2 if seat == 1 else None} for seat in range(6)]
    return {"publicEvents": events, "playerCount": 6, "players": players,
            "totalStacks": 600 - invested, "totalInvested": invested,
            "phase": phase, "drawRound": draw_round, "bb": 20,
            "trainingDiagnostic": {"ready": True, "vectorLength": 96,
                                   "maskCount": 2, "potSlot": invested * 0.1 / 400}}


class PublicHistoryAuditTests(unittest.TestCase):
    def test_completed_bet_history_resets_current_opening(self):
        problems, fields = _audit_snapshot(_row())
        self.assertEqual(problems, [])
        self.assertEqual(fields["completedBetHistory"][1], [True, False, False])
        self.assertEqual(fields["openedCurrentRound"], [False] * 6)

        problems, fields = _audit_snapshot(_row(phase="BET", draw_round=1))
        self.assertEqual(problems, [])
        self.assertEqual(fields["completedBetHistory"][1], [True, False, False])
        self.assertTrue(fields["openedCurrentRound"][2])
        # ALL_IN is not BET/RAISE in the trainer's opening-history feature.
        self.assertFalse(fields["openedCurrentRound"][3])

    def test_incorrect_round_tag_is_rejected(self):
        row = _row()
        row["publicEvents"][1]["drawRoundIndex"] = 1
        problems, _fields = _audit_snapshot(row)
        self.assertTrue(any("round tag differs" in problem for problem in problems))


if __name__ == "__main__":
    unittest.main()
