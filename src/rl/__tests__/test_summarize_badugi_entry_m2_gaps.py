"""M2 gap accounting never promotes a legal opportunity to an EV result."""

import unittest

from rl.training.badugi_starting_ranges import _score_key
from rl.training.summarize_badugi_entry_m2_gaps import (
    hand_class, price_band, reconcile,
)


CUTOFF = _score_key((3, (0, 5, 9)))


def cell(*, position=0, prior=1, hand="three_card_A6T", price="le_half_BB", n=0):
    return {"mode": "cash", "physicalSeats": 2, "activeSeats": 2,
            "openingPosition": position, "priorRaiseCountCapped": prior,
            "priceBand": price, "handClass": hand, "opportunities": n,
            "planningQuota": 200, "priorityTier": 0}


def row(*, target=True, prior=1, price=0.5):
    return {"group": [2, 2, "cash"], "stratum": "A6T_boundary",
            "target": {"openingPosition": 0, "priorRaiseCount": prior,
                       "toCallBigBets": price,
                       "actorCurrentCards": ["AH", "6D", "10C", "KH"]}
            if target else None}


class EntryM2GapTests(unittest.TestCase):
    def test_hand_class_boundaries_are_exclusive(self):
        self.assertEqual(hand_class(["AH", "6D", "10C", "KH"], CUTOFF), "three_card_A6T")
        self.assertEqual(hand_class(["AH", "4D", "KH", "KD"], CUTOFF), "two_card_A2_to_A6")
        self.assertEqual(hand_class(["AH", "3D", "6C", "KS"], CUTOFF), "four_card_T_to_K")

    def test_existing_opportunity_and_new_one_fill_only_planning_count(self):
        allocation = {"status": "PROSPECTIVE_OPPORTUNITY_QUOTAS_NOT_EV_GATE",
                      "cells": [cell(n=199), cell(position=1)]}
        result = reconcile(allocation, [row(), row(target=False)], CUTOFF)
        self.assertEqual(result["counts"]["planningQuotaMet"], 1)
        self.assertEqual(result["counts"]["zeroFeasibilityUnresolved"], 1)
        self.assertEqual(result["counts"]["newLegalFcrOpportunities"], 1)
        self.assertEqual(result["counts"]["noOpportunitySelectedDeals"], 1)
        self.assertEqual(result["counts"]["recommendedRangeRows"], 0)
        self.assertEqual(result["cells"][0]["actionRecommendation"], "INSUFFICIENT_EV")

    def test_unseen_public_cell_is_reported_not_discarded(self):
        allocation = {"status": "PROSPECTIVE_OPPORTUNITY_QUOTAS_NOT_EV_GATE",
                      "cells": [cell()]}
        result = reconcile(allocation, [row(price=1.5)], CUTOFF)
        self.assertEqual(result["counts"]["newlyObservedCells"], 1)
        self.assertEqual(result["newlyObservedCells"][0]["key"][4], "above_one_BB")
        self.assertEqual(result["cells"][0]["opportunityState"], "ZERO_FEASIBILITY_UNRESOLVED")

    def test_bad_price_and_duplicate_baseline_fail(self):
        allocation = {"status": "PROSPECTIVE_OPPORTUNITY_QUOTAS_NOT_EV_GATE",
                      "cells": [cell(), cell()]}
        with self.assertRaisesRegex(ValueError, "duplicated"):
            reconcile(allocation, [], CUTOFF)
        allocation["cells"] = [cell()]
        with self.assertRaisesRegex(ValueError, "positive price"):
            reconcile(allocation, [row(price=0)], CUTOFF)
        with self.assertRaisesRegex(ValueError, "prior raise"):
            reconcile(allocation, [row(prior=-1)], CUTOFF)

    def test_price_boundaries_are_fixed_limit_big_bets(self):
        self.assertEqual(price_band(0.5), "le_half_BB")
        self.assertEqual(price_band(1.0), "le_one_BB")
        self.assertEqual(price_band(1.001), "above_one_BB")


if __name__ == "__main__":
    unittest.main()
