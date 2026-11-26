"""Real-controller first-deal audit fields; no model or training involved."""

import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[3]
BRIDGE = ROOT / "scripts/badugi-entry-m2-bridge-draft.mjs"


def reset(seats: int, occupied: int, tournament: bool, hero: int, seed: int) -> dict:
    request = {"command": "reset", "seatCount": seats,
               "occupiedSeatCount": occupied, "isTournament": tournament,
               "heroSeat": hero, "seed": seed, "includeLedger": True}
    result = subprocess.run(["node", str(BRIDGE)], input=json.dumps(request) + "\n",
                            text=True, capture_output=True, cwd=ROOT, timeout=15,
                            check=True)
    return json.loads(result.stdout.strip())


class EntryM2BridgeTest(unittest.TestCase):
    def test_legal_amounts_match_applied_controller_branches(self):
        requests = [{"command": "reset", "seatCount": 2, "occupiedSeatCount": 2,
                     "isTournament": False, "heroSeat": 0, "seed": 132228,
                     "includeLedger": True}, {"command": "audit_legal_amounts"}]
        result = subprocess.run(["node", str(BRIDGE)],
                                input="".join(json.dumps(item) + "\n" for item in requests),
                                text=True, capture_output=True, cwd=ROOT, timeout=15,
                                check=True)
        decision, audit = map(json.loads, result.stdout.splitlines())
        self.assertEqual(audit["type"], "amount_audit")
        self.assertEqual(audit["decisionIndex"], decision["decisionIndex"])
        self.assertEqual(audit["actualAmountsChips"], {"0": 0, "2": 10, "4": 30})
        self.assertEqual([decision["auditActorVisible"]["legalAmountsChips"][index]
                          for index in (0, 2, 4)], [0, 10, 30])

    def test_hero_initial_cards_across_modes_and_seats(self):
        for seats, occupied in ((2, 2), (3, 3), (6, 2), (6, 3), (6, 6)):
            for tournament in (False, True):
                with self.subTest(seats=seats, occupied=occupied, tournament=tournament):
                    response = reset(seats, occupied, tournament, occupied - 1, 12345)
                    self.assertEqual(response["type"], "decision")
                    self.assertEqual(response["auditHeroSeat"], occupied - 1)
                    self.assertEqual(response["auditOpeningHandIndex"], 0)
                    self.assertEqual(len(set(response["auditOpeningHeroCards"])), 4)
                    self.assertEqual(response["ledger"]["accounted"],
                                     response["ledger"]["chipPool"])

    def test_invalid_or_empty_hero_rejected(self):
        self.assertEqual(reset(6, 2, False, 2, 12345)["type"], "error")


if __name__ == "__main__":
    unittest.main()
