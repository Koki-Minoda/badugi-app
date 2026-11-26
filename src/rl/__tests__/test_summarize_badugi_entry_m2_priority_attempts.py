import unittest
from unittest.mock import Mock, patch

from rl.training.badugi_starting_ranges import _score_key
from rl.training.collect_badugi_entry_m2_draft import collect_hand
from rl.training.summarize_badugi_entry_m2_priority_attempts import summarize_priority_attempts


CUTOFF = _score_key((3, (0, 5, 9)))
CARDS = ["AH", "6D", "10C", "KH"]
CONDITION = {
    "mode": "cash", "physicalSeats": 3, "activeSeats": 3, "openingPosition": 1,
    "priceBand": "le_one_BB", "priorRaiseCountCapped": 2, "handClass": "three_card_A6T",
}


def opportunity(index, cost, raises):
    return {
        "decisionIndex": index,
        "activeBigBlindChips": 10,
        "actorCurrentCards": CARDS,
        "dealerSeat": 0,
        "openingPosition": 1,
        "madeCards": 3,
        "highRankZeroBased": 9,
        "toCallBigBets": cost / 20,
        "priorRaiseCount": raises,
        "publicActions": [
            {"type": "BET_ACTION", "seat": 0, "drawRoundIndex": 0,
             "action": "RAISE" if event < raises else "CALL"} for event in range(index)
        ],
        "legalMask": [1, 0, 1, 0, 1, 0],
        "legalAmountsChips": [0, None, cost, None, cost + 10, None],
        "controllerAppliedAmountsChips": {"0": 0, "2": cost, "4": cost + 10},
        "naturalAction": 2,
    }


def attempt(seed, opportunities):
    first = {key: value for key, value in opportunities[0].items()
             if key not in ("decisionIndex", "activeBigBlindChips")} if opportunities else None
    return {
        "seed": seed, "group": [3, 3, "cash"], "heroSeat": 1,
        "openingDealerSeat": 0, "openingPosition": 1, "openingActorCards": CARDS,
        "stratum": "A6T_boundary", "profile": "tight_value", "chipLedgerPass": True,
        "controllerDecisions": 10,
        "terminalHeroPredrawDecisionIndices": [row["decisionIndex"] for row in opportunities],
        "target": first, "predrawOpportunities": opportunities,
        "heroPredrawDecisions": [
            {"decisionIndex": row["decisionIndex"], "legalMask": row["legalMask"]}
            for row in opportunities
        ],
    }


class EntryM2PriorityAttemptTests(unittest.TestCase):
    def test_collector_captures_position_when_hero_never_acts(self):
        bridge = Mock()
        bridge.send.side_effect = [
            {"type": "decision", "seat": 0, "auditHeroSeat": 1, "auditOpeningHandIndex": 0,
             "auditOpeningHeroCards": CARDS, "auditActorVisible": {"dealerSeat": 0},
             "handIndex": 0, "decisionIndex": 0, "observation": [0] * 96,
             "legalMask": [1, 0, 1, 0, 1, 0], "ledger": {"accounted": 100, "chipPool": 100}},
            {"type": "hand_end", "decisionCount": 1, "chipDeltaBySeat": [-1, 1],
             "handIndex": 0, "startingStacks": [50, 50], "endingStacks": [49, 51],
             "ledger": {"terminal": True, "accounted": 100, "chipPool": 100},
             "publicActionTrace": [{"type": "BET_ACTION", "seat": 0, "drawRoundIndex": 0}]},
        ]
        model = Mock()
        record = {"seed": 7, "group": [2, 2, "cash"], "heroSeat": 1, "profile": "tight_value",
                  "stratum": "A6T_boundary", "expectedOpeningActorCards": CARDS,
                  "expectedOpeningPosition": 1, "expectedOpeningDealerSeat": 0}
        module = "rl.training.collect_badugi_entry_m2_draft"
        with patch(f"{module}.check_decision"), patch(f"{module}.training_opponent_action", return_value=0):
            result = collect_hand(bridge, model, record, 2000, capture_predraw_attempt=True)
        self.assertEqual(result["openingPosition"], 1)
        self.assertEqual(result["openingDealerSeat"], 0)
        self.assertEqual(result["heroPredrawDecisions"], [])
        self.assertEqual(result["predrawOpportunities"], [])
        self.assertIsNone(result["target"])
        model.act.assert_not_called()

    def test_later_hit_counts_once_and_no_hit_attempt_stays_in_denominator(self):
        first = opportunity(1, 10, 1)
        later = opportunity(4, 20, 2)
        again = opportunity(7, 20, 3)
        result, = summarize_priority_attempts(
            [CONDITION], [attempt(1, [first, later, again]), attempt(2, [])], CUTOFF,
        )
        self.assertEqual(result["byKnownArtificialProfile"]["tight_value"], {
            "completedAttempts": 2, "firstOpportunityHits": 0, "anyOpportunityHits": 1,
        })
        self.assertEqual(result["byKnownArtificialProfile"]["balanced_range"]["completedAttempts"], 0)

    def test_rejects_omitted_legal_opportunity_and_duplicate_seed(self):
        row = attempt(1, [opportunity(4, 20, 2)])
        row["heroPredrawDecisions"].append(
            {"decisionIndex": 7, "legalMask": [1, 0, 1, 0, 1, 0]},
        )
        row["terminalHeroPredrawDecisionIndices"].append(7)
        with self.assertRaisesRegex(ValueError, "omits or adds"):
            summarize_priority_attempts([CONDITION], [row], CUTOFF)
        with self.assertRaisesRegex(ValueError, "seed"):
            summarize_priority_attempts([CONDITION], [attempt(1, []), attempt(1, [])], CUTOFF)

    def test_rejects_wrong_public_position_or_price(self):
        empty = {**attempt(1, []), "openingPosition": 2}
        with self.assertRaisesRegex(ValueError, "opening position"):
            summarize_priority_attempts([CONDITION], [empty], CUTOFF)
        bad_price = {**opportunity(4, 20, 2), "toCallBigBets": 0.6}
        with self.assertRaisesRegex(ValueError, "audited CALL amount"):
            summarize_priority_attempts([CONDITION], [attempt(1, [bad_price])], CUTOFF)
