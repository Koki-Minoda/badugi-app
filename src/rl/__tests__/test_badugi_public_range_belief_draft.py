"""Meaningful public-information and blocker contracts for range particles."""
import dataclasses
import unittest

from rl.training.badugi_public_range_belief_draft import (
    RangeEstimate, _public_action_likelihood, estimate_public_range,
    guarded_range_action, remaining_rank_counts,
)


class PublicRangeBeliefTests(unittest.TestCase):
    def setUp(self):
        self.seen = [(0, 0), (3, 1), (3, 2), (8, 3)]
        self.public_history = {
            'handsObserved': 40, 'fold': 10, 'check': 12, 'call': 40,
            'bet': 8, 'raise': 10, 'raiseAmountBbSum': 15.0,
            'drawCounts': [20, 50, 20, 10, 0],
            'facedBetOpportunities': 60, 'foldedFacingBet': 10,
            'calledFacingBet': 40, 'raisedFacingBet': 10,
            'freeBetOpportunities': 20, 'betWhenFree': 8,
        }

    def test_exact_seen_ace_and_four_counts(self):
        ranks = remaining_rank_counts(self.seen)
        self.assertEqual((ranks[0], ranks[3], ranks[8]), (3, 2, 3))
        with self.assertRaisesRegex(ValueError, "counted twice"):
            remaining_rank_counts([(0, 0), (0, 0)])

    def test_public_raise_and_draw_change_current_range(self):
        plain = estimate_public_range(actor_seen_cards=self.seen,
                                      public_events=[], target_seat=1, seed=7, particles=1024)
        raised = estimate_public_range(actor_seen_cards=self.seen, public_events=[
            {"type": "BET_ACTION", "seat": 1, "action": "RAISE", "amountBb": 2}],
            target_seat=1, seed=7, particles=1024)
        stood_pat = estimate_public_range(actor_seen_cards=self.seen, public_events=[
            {"type": "DRAW_ACTION", "seat": 1, "drawCount": 0}],
            target_seat=1, seed=7, particles=1024)
        self.assertGreater(raised.probabilities[3], plain.probabilities[3])
        self.assertGreater(stood_pat.probabilities[3], plain.probabilities[3])
        self.assertAlmostEqual(sum(raised.probabilities), 1.0)
        self.assertEqual((raised.remaining_aces, raised.remaining_fours), (3, 2))
        self.assertFalse(raised.calibrated)

    def test_public_raise_size_is_range_evidence(self):
        def posterior(amount):
            return estimate_public_range(actor_seen_cards=self.seen, public_events=[
                {"type": "BET_ACTION", "seat": 1, "action": "RAISE", "amountBb": amount}],
                target_seat=1, seed=8, particles=1024).probabilities[3]
        self.assertGreater(posterior(2), posterior(1))

    def test_other_seat_actions_do_not_update_target(self):
        event = {"type": "BET_ACTION", "seat": 2, "action": "RAISE", "amountBb": 2}
        plain = estimate_public_range(actor_seen_cards=self.seen, public_events=[],
                                      target_seat=1, seed=17, particles=256)
        other = estimate_public_range(actor_seen_cards=self.seen, public_events=[event],
                                      target_seat=1, seed=17, particles=256)
        self.assertEqual(plain, other)

    def test_private_opponent_fields_are_rejected(self):
        hidden = {"type": "DRAW_ACTION", "seat": 1, "drawCount": 1,
                  "replacedCards": [{"oldCard": [0, 0]}]}
        with self.assertRaisesRegex(ValueError, "public action fields only"):
            estimate_public_range(actor_seen_cards=self.seen, public_events=[hidden],
                                  target_seat=1, seed=3, particles=64)

    def test_uncalibrated_style_mixture_is_disabled(self):
        event = {'type': 'BET_ACTION', 'seat': 1, 'action': 'CALL', 'amountBb': 1}
        params = {'actor_seen_cards': self.seen, 'public_events': [event],
                  'target_seat': 1, 'seed': 11, 'particles': 512}
        base = estimate_public_range(**params)
        with self.assertRaisesRegex(ValueError, 'uncalibrated style mixture is disabled'):
            estimate_public_range(**params,
                opponent_public_history=self.public_history, style_weight=0.5)
        sparse = {**self.public_history, 'handsObserved': 1,
                  'fold': 0, 'check': 0, 'call': 2, 'bet': 0,
                  'raise': 0, 'raiseAmountBbSum': 0,
                  'drawCounts': [0, 1, 0, 0, 0],
                  'facedBetOpportunities': 2, 'foldedFacingBet': 0,
                  'calledFacingBet': 2, 'raisedFacingBet': 0,
                  'freeBetOpportunities': 0, 'betWhenFree': 0}
        fallback = estimate_public_range(**params,
            opponent_public_history=sparse, style_weight=0)
        self.assertEqual(fallback, base)
        with self.assertRaisesRegex(ValueError, 'exact public-history'):
            estimate_public_range(**params,
                opponent_public_history={**self.public_history, 'opponentPrivateCards': []},
                style_weight=0.5)
        with self.assertRaisesRegex(ValueError, 'style weight'):
            estimate_public_range(**params, style_weight=1.1)

    def test_recorded_public_legal_menu_normalizes_without_hidden_cards(self):
        event = {'type': 'BET_ACTION', 'seat': 1, 'action': 'CALL',
                 'amountBb': 1, 'drawRoundIndex': 0,
                 'legalActions': [0, 2, 4], 'toCallBb': 1,
                 'potBb': 4, 'activePlayers': 3}
        for bucket in range(4):
            total = sum(_public_action_likelihood({**event, 'action': action}, bucket, 2)
                        for action in ('FOLD', 'CALL', 'RAISE'))
            self.assertAlmostEqual(total, 1)
        result = estimate_public_range(actor_seen_cards=self.seen,
            public_events=[event], target_seat=1, seed=11, particles=256)
        self.assertFalse(result.calibrated)
        self.assertAlmostEqual(sum(result.probabilities), 1)
        with self.assertRaisesRegex(ValueError, 'public legal context'):
            estimate_public_range(actor_seen_cards=self.seen,
                public_events=[{**event, 'legalActions': [0, 4]}],
                target_seat=1, seed=11, particles=256)

    def test_uncalibrated_or_sparse_evidence_cannot_override(self):
        estimate = estimate_public_range(actor_seen_cards=self.seen, public_events=[
            {"type": "BET_ACTION", "seat": 1, "action": "CALL", "amountBb": 1}],
            target_seat=1, seed=3, particles=128)
        mask = [1, 0, 1, 0, 1, 0]
        self.assertEqual(guarded_range_action(base_action=2, legal_mask=mask,
                         hero_made=4, hero_high=8, to_call_bb=1, estimate=estimate), 2)
        self.assertEqual(guarded_range_action(base_action=2, legal_mask=mask,
                         hero_made=4, hero_high=8, to_call_bb=1,
                         estimate=dataclasses.replace(estimate, calibrated=True)), 2)

    def test_calibrated_interface_can_change_only_legal_actions(self):
        weak_range = RangeEstimate((0.8, 0.1, 0.08, 0.02), 3, 2, 3, 1024, True)
        strong_range = RangeEstimate((0.1, 0.1, 0.1, 0.7), 3, 2, 3, 1024, True)
        mask = [1, 0, 1, 0, 1, 0]
        self.assertEqual(guarded_range_action(base_action=2, legal_mask=mask,
                         hero_made=4, hero_high=8, to_call_bb=1, estimate=weak_range), 4)
        self.assertEqual(guarded_range_action(base_action=2, legal_mask=mask,
                         hero_made=2, hero_high=8, to_call_bb=1, estimate=strong_range), 0)
        self.assertEqual(guarded_range_action(base_action=2, legal_mask=[0, 0, 1, 0, 0, 0],
                         hero_made=4, hero_high=8, to_call_bb=1, estimate=weak_range), 2)


if __name__ == "__main__":
    unittest.main()
