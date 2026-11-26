"""Unknown evaluation opponents must use legal observable actions only."""
from __future__ import annotations

import random
import unittest

from rl.training.unknown_badugi_opponents import UNKNOWN_PROFILES, unknown_opponent_action


class UnknownOpponentTests(unittest.TestCase):
    def test_every_nonempty_mask_remains_legal_in_both_phases(self):
        for phase in ("BET", "DRAW"):
            for profile in UNKNOWN_PROFILES:
                for bits in range(1, 64):
                    mask = [(bits >> index) & 1 for index in range(6)]
                    observation = [0.0] * 96
                    observation[24] = 0.75
                    observation[25] = 0.5
                    observation[18] = 0.1
                    decision = {"phase": phase, "drawRoundIndex": 1,
                                "observation": observation, "legalMask": mask}
                    action = unknown_opponent_action(decision, profile, random.Random(7))
                    self.assertEqual(mask[action], 1)

    def test_profiles_are_separate_from_training_set(self):
        from rl.training.train_badugi_controller_v2_draft import PROFILES
        self.assertFalse(set(UNKNOWN_PROFILES) & set(PROFILES))

    def test_empty_mask_and_bad_phase_fail_closed(self):
        decision = {"phase": "DRAW", "drawRoundIndex": 1,
                    "observation": [0.0] * 96, "legalMask": [0] * 6}
        with self.assertRaisesRegex(ValueError, 'empty legal mask'):
            unknown_opponent_action(decision, 'tight_range', random.Random(1))
        decision['legalMask'][0] = 1
        decision['phase'] = 'SHOWDOWN'
        with self.assertRaisesRegex(ValueError, 'invalid evaluation opponent phase'):
            unknown_opponent_action(decision, 'tight_range', random.Random(1))


if __name__ == '__main__':
    unittest.main()
