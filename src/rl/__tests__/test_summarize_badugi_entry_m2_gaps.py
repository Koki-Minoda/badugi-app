"""M2 gap accounting never promotes a legal opportunity to an EV result."""

import unittest

from rl.training.badugi_starting_ranges import _score_key
from rl.training.summarize_badugi_entry_m2_gaps import (
    hand_class, opening_position_from_public_button, price_band, reconcile,
    verify_row_against_selected,
)


CUTOFF = _score_key((3, (0, 5, 9)))


def cell(*, position=1, prior=1, hand="three_card_A6T", price="le_half_BB", n=0):
    return {"mode": "cash", "physicalSeats": 2, "activeSeats": 2,
            "openingPosition": position, "priorRaiseCountCapped": prior,
            "priceBand": price, "handClass": hand, "opportunities": n,
            "planningQuota": 200, "priorityTier": 0}


def row(*, target=True, prior=1, price=0.5, position=1):
    return {"group": [2, 2, "cash"], "heroSeat": 1,
            "profile": "tight_value", "stratum": "A6T_boundary",
            "target": {"dealerSeat": 0, "openingPosition": position,
                       "priorRaiseCount": prior,
                       "toCallBigBets": price,
                       "publicActions": [{"type": "BET_ACTION", "seat": 0,
                                          "drawRoundIndex": 0, "action": "RAISE"}],
                       "actorCurrentCards": ["AH", "6D", "10C", "KH"]}
            if target else None}


class EntryM2GapTests(unittest.TestCase):
    def test_hand_class_boundaries_are_exclusive(self):
        self.assertEqual(hand_class(["AH", "6D", "10C", "KH"], CUTOFF), "three_card_A6T")
        self.assertEqual(hand_class(["AH", "4D", "KH", "KD"], CUTOFF), "two_card_A2_to_A6")
        self.assertEqual(hand_class(["AH", "3D", "6C", "KS"], CUTOFF), "four_card_T_to_K")

    def test_existing_opportunity_and_new_one_fill_only_planning_count(self):
        allocation = {"status": "PROSPECTIVE_OPPORTUNITY_QUOTAS_NOT_EV_GATE",
                      "cells": [cell(n=199), cell(position=0)]}
        result = reconcile(allocation, [row(), row(target=False)], CUTOFF)
        self.assertEqual(result["counts"]["planningQuotaMet"], 1)
        self.assertEqual(result["counts"]["zeroFeasibilityUnresolved"], 1)
        self.assertEqual(result["counts"]["newLegalFcrOpportunities"], 1)
        self.assertEqual(result["counts"]["noOpportunitySelectedDeals"], 1)
        self.assertEqual(result["counts"]["recommendedRangeRows"], 0)
        self.assertEqual(result["cells"][0]["actionRecommendation"], "INSUFFICIENT_EV")
        self.assertEqual(result["cells"][0]["newM2OpportunitiesByKnownArtificialProfile"]["tight_value"], 1)
        self.assertEqual(result["cells"][0]["newM2OpportunitiesByKnownArtificialProfile"]["balanced_range"], 0)
        self.assertEqual(result["noOpportunityByModeSeatAndOpeningStratum"][0]["knownArtificialProfile"], "tight_value")

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
        with self.assertRaisesRegex(ValueError, "classification fields"):
            reconcile(allocation, [row(prior=-1)], CUTOFF)

    def test_position_and_raise_count_are_rederived_from_public_evidence(self):
        allocation = {"status": "PROSPECTIVE_OPPORTUNITY_QUOTAS_NOT_EV_GATE",
                      "cells": [cell()]}
        with self.assertRaisesRegex(ValueError, "public history"):
            reconcile(allocation, [row(position=0)], CUTOFF)
        with self.assertRaisesRegex(ValueError, "public history"):
            reconcile(allocation, [row(prior=0)], CUTOFF)
        self.assertEqual(opening_position_from_public_button(0, 1, 2, 6), 1)
        self.assertEqual(opening_position_from_public_button(1, 0, 3, 6), 2)

    def test_missing_or_malformed_public_evidence_cannot_fill_a_cell(self):
        allocation = {"status": "PROSPECTIVE_OPPORTUNITY_QUOTAS_NOT_EV_GATE",
                      "cells": [cell()]}
        missing_button = row()
        del missing_button["target"]["dealerSeat"]
        with self.assertRaisesRegex(ValueError, "public button"):
            reconcile(allocation, [missing_button], CUTOFF)
        missing_raise_event = row()
        missing_raise_event["target"]["publicActions"] = []
        with self.assertRaisesRegex(ValueError, "public history"):
            reconcile(allocation, [missing_raise_event], CUTOFF)
        malformed_action = row()
        del malformed_action["target"]["publicActions"][0]["action"]
        with self.assertRaisesRegex(ValueError, "malformed"):
            reconcile(allocation, [malformed_action], CUTOFF)
        unknown_profile = row()
        unknown_profile["profile"] = "hidden_type"
        with self.assertRaisesRegex(ValueError, "profile"):
            reconcile(allocation, [unknown_profile], CUTOFF)

    def test_price_boundaries_are_fixed_limit_big_bets(self):
        self.assertEqual(price_band(0.5), "le_half_BB")
        self.assertEqual(price_band(1.0), "le_one_BB")
        self.assertEqual(price_band(1.001), "above_one_BB")

    def test_forged_hero_seat_cannot_change_position_cell(self):
        scheduled = {"seed": 17, "group": [2, 2, "cash"],
                     "profile": "tight_value", "stratum": "A6T_boundary",
                     "heroSeat": 1}
        original = {**row(), "globalIndex": 0, "seed": 17}
        verify_row_against_selected(original, scheduled, 0)
        forged = {**original, "heroSeat": 0,
                  "target": {**original["target"], "openingPosition": 0}}
        with self.assertRaisesRegex(ValueError, "selected hero schedule"):
            verify_row_against_selected(forged, scheduled, 0)


if __name__ == "__main__":
    unittest.main()
