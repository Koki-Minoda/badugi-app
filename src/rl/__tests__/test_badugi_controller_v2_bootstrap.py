"""Guard the public-only bootstrap action mapping used before D03 RL."""

import unittest

from rl.training.train_badugi_controller_v2_draft import observable_reference_action


def decision(phase, made, high, round_index, to_call_bb, mask):
    observation = [0.0] * 96
    observation[9] = round_index / 3
    observation[18] = to_call_bb / 20
    observation[24] = made / 4
    observation[25] = high / 12
    observation[32:38] = mask
    return {"phase": phase, "observation": observation, "legalMask": mask}


class BootstrapPolicyTests(unittest.TestCase):
    def test_draws_only_missing_badugi_cards(self):
        self.assertEqual(observable_reference_action(decision("DRAW", 4, 7, 1, 0, [1, 1, 1, 1, 1, 0])), 0)
        self.assertEqual(observable_reference_action(decision("DRAW", 3, 7, 1, 0, [1, 1, 1, 1, 1, 0])), 1)
        self.assertEqual(observable_reference_action(decision("DRAW", 2, 7, 1, 0, [1, 1, 1, 1, 1, 0])), 2)

    def test_folds_weak_hand_to_pressure_and_checks_for_free(self):
        self.assertEqual(observable_reference_action(decision("BET", 2, 10, 3, 2, [1, 0, 1, 0, 1, 0])), 0)
        self.assertEqual(observable_reference_action(decision("BET", 2, 10, 3, 0, [0, 1, 0, 1, 0, 0])), 1)

    def test_raises_strong_made_hand_when_legal(self):
        self.assertEqual(observable_reference_action(decision("BET", 4, 7, 3, 2, [1, 0, 1, 0, 1, 0])), 4)

    def test_respects_short_stack_mask(self):
        self.assertEqual(observable_reference_action(decision("BET", 4, 7, 3, 2, [1, 0, 1, 0, 0, 0])), 2)


if __name__ == '__main__':
    unittest.main()
