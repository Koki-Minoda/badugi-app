"""Focused checks for the M2 opportunity-sampling design; no game run."""

import unittest

from rl.training.entry_m2_sampling_contract import (
    Design, audit_selected_deal, audit_selected_opportunity, best_badugi, check_seed_schedule,
    parse_cards, stratum,
)


COUNTS = {"A6T_boundary": 636, "A2_A6_two_card": 15280,
          "T_K_four_card": 14136, "other": 240673}


class EntryM2SamplingContractTest(unittest.TestCase):
    def test_partition_weights_and_capacity(self):
        plan = Design(COUNTS, 25).summary()
        self.assertEqual(plan["acceptedSessions"], 5000)
        self.assertAlmostEqual(sum(cell["samplingProbability"] *
                                   cell["naturalOverSamplingWeight"]
                                   for cell in plan["strata"].values()), 1)
        self.assertGreater(plan["strata"]["A6T_boundary"]["expectedRawDealsToFill"],
                           500000)
        with self.assertRaises(ValueError):
            Design({**COUNTS, "other": 1}, 25).summary()

    def test_ten_card_and_rank_suit_duplicate(self):
        hand = parse_cards(["AD", "6C", "10S", "AH"])
        self.assertEqual(best_badugi(hand), (3, (0, 5, 9)))
        self.assertEqual(stratum(*best_badugi(hand)), "A6T_boundary")
        with self.assertRaises(ValueError):
            parse_cards(["AD", "AD", "6S", "KH"])

    def test_seed_residue_guard(self):
        check_seed_schedule([10, 11], {12})
        with self.assertRaises(ValueError):
            check_seed_schedule([10, 10 + 2**32], set())
        with self.assertRaises(ValueError):
            check_seed_schedule([10], {10})

    def test_actual_shape_and_tamper_guards(self):
        target = {
            "actorCurrentCards": ["AD", "6C", "10S", "AH"],
            "madeCards": 3, "highRankZeroBased": 9,
            "legalMask": [1, 0, 1, 0, 1, 0],
            "legalAmountsChips": [0, None, 10, None, 30, None],
            "naturalAction": 2, "toCallBigBets": .25,
            "openingPosition": 0, "publicActions": [],
        }
        row = {"chipLedgerPass": True, "target": target}
        self.assertEqual(audit_selected_opportunity(row, "A6T_boundary")["ranks"],
                         (0, 5, 9))
        with self.assertRaises(ValueError):
            audit_selected_opportunity(row, "other")
        with self.assertRaises(ValueError):
            audit_selected_opportunity({**row, "chipLedgerPass": False}, "A6T_boundary")
        with self.assertRaises(ValueError):
            audit_selected_opportunity({"chipLedgerPass": True,
                                        "target": {**target, "legalMask": [1, 0, 1, 0, 0, 0]}},
                                       "A6T_boundary")
        selected = {**row, "openingActorCards": target["actorCurrentCards"]}
        self.assertTrue(audit_selected_deal(selected, "A6T_boundary")
                        ["legalThreeActionOpportunity"])
        self.assertFalse(audit_selected_deal({**selected, "target": None}, "A6T_boundary")
                         ["legalThreeActionOpportunity"])


if __name__ == "__main__":
    unittest.main()
