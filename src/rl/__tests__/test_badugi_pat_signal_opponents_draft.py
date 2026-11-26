"""Public-PAT response contracts for isolated development opponents."""
import random
import unittest

from rl.training.badugi_pat_signal_opponents_draft import (
    PAT_SIGNAL_PROFILES, pat_signal_opponent_action, public_opponent_pat_signal)
from rl.training.unknown_badugi_opponents import UNKNOWN_PROFILES


def decision(*, pat=True, made=3, high=8):
    obs = [0.0] * 96
    obs[11] = 2 / 6
    obs[12] = 0.0
    obs[15] = 4 / 400
    obs[18] = 1 / 20
    obs[24] = made / 4
    obs[25] = high / 12
    return {'phase': 'BET', 'seat': 1, 'drawRoundIndex': 2,
            'observation': obs, 'legalMask': [1, 0, 1, 0, 1, 0],
            'beliefEvidence': {'currentPublicBetContext': {'activePlayers': 2},
                               'publicActions': [
                                   {'type': 'DRAW_ACTION', 'seat': 0,
                                    'drawRoundIndex': 1, 'drawCount': 0 if pat else 1},
                                   {'type': 'BET_ACTION', 'seat': 0,
                                    'drawRoundIndex': 2, 'action': 'BET'}]}}


class PatSignalOpponentTests(unittest.TestCase):
    def test_profiles_are_disjoint_from_final_unknown_holdout(self):
        self.assertFalse(set(PAT_SIGNAL_PROFILES) & set(UNKNOWN_PROFILES))

    def test_signal_requires_public_prior_draw_in_heads_up(self):
        row = decision()
        self.assertTrue(public_opponent_pat_signal(row))
        self.assertFalse(public_opponent_pat_signal(decision(pat=False)))
        row['beliefEvidence']['currentPublicBetContext']['activePlayers'] = 3
        self.assertFalse(public_opponent_pat_signal(row))

    def test_respect_and_skeptic_change_fold_frequency_only_after_pat(self):
        pat = decision()
        drawn = decision(pat=False)
        counts = {}
        for profile in PAT_SIGNAL_PROFILES:
            counts[(profile, 'pat')] = sum(pat_signal_opponent_action(
                pat, profile, random.Random(seed)) == 0 for seed in range(2000))
            counts[(profile, 'drawn')] = sum(pat_signal_opponent_action(
                drawn, profile, random.Random(seed)) == 0 for seed in range(2000))
        self.assertGreater(counts[('pat_respect', 'pat')],
                           counts[('pat_skeptic', 'pat')] + 500)
        self.assertEqual(counts[('pat_respect', 'drawn')],
                         counts[('pat_skeptic', 'drawn')])

    def test_no_private_cards_and_legal_action(self):
        row = decision()
        row['heroPrivateCards'] = 'forbidden'
        row['legalMask'] = [0, 0, 1, 0, 0, 0]
        for profile in PAT_SIGNAL_PROFILES:
            self.assertEqual(pat_signal_opponent_action(row, profile, random.Random(7)), 2)


if __name__ == '__main__':
    unittest.main()
