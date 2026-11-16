"""Independent ledger rejection tests for the D03 bridge diagnostic."""

from __future__ import annotations

import importlib.util
import random
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[3] / "scripts" / "audit_badugi_controller_step_ledger.py"
SPEC = importlib.util.spec_from_file_location("audit_badugi_controller_step_ledger", MODULE)
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


def responses():
    first = {"type": "decision", "seat": 0, "phase": "BET",
             "legalMask": [0, 1, 0, 0, 0, 0],
             "ledger": {"handIndex": 0, "decisionIndex": 0,
                        "terminal": False, "stacks": [490, 480],
                        "committedBySeat": [10, 20],
                        "accounted": 1000, "chipPool": 1000}}
    final = {"type": "hand_end", "handIndex": 0,
             "startingStacks": [500, 500], "endingStacks": [500, 500],
             "chipDeltaBySeat": [0, 0],
             "publicActionTrace": [{"type": "BET_ACTION", "seat": 0,
                                    "action": "check", "amount": 0,
                                    "stackBefore": 490, "stackAfter": 490}],
             "ledger": {"handIndex": 0, "decisionIndex": 1,
                        "terminal": True, "stacks": [500, 500],
                        "committedBySeat": None,
                        "accounted": 1000, "chipPool": 1000}}
    return first, final


def run(first, final):
    return audit.audit_hand(session_index=0, hand_index=0, response=first,
                            bridge=lambda request: final, seats=2, pool=1000,
                            profile="passive", rng=random.Random(1))


class BadugiStepLedgerAuditTest(unittest.TestCase):
    def test_valid_terminal_and_decision_ledgers(self):
        first, final = responses()
        row = run(first, final)
        self.assertEqual(len(row["decisions"]), 1)
        self.assertEqual(row["ledgers"][0]["committedBySeat"], [10, 20])
        self.assertEqual(row["ledgers"][-1]["stacks"], [500, 500])

    def test_rejects_chips_created_or_lost_at_any_boundary(self):
        mutations = [
            lambda first, final: first["ledger"].update(stacks=[491, 480]),
            lambda first, final: final["ledger"].update(stacks=[501, 500]),
            lambda first, final: final.update(chipDeltaBySeat=[1, 0]),
            lambda first, final: final["publicActionTrace"][0].update(amount=491),
            lambda first, final: final["publicActionTrace"][0].update(seat=1),
        ]
        for mutate in mutations:
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                first, final = responses()
                mutate(first, final)
                run(first, final)


if __name__ == "__main__":
    unittest.main()
