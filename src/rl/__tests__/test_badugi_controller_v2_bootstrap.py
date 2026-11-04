"""Guard the public-only bootstrap action mapping used before D03 RL."""

import unittest

from rl.training.train_badugi_controller_v2_draft import observable_reference_action, run_hand


def decision(phase, made, high, round_index, to_call_bb, mask):
    observation = [0.0] * 96
    observation[9] = round_index / 3
    observation[18] = to_call_bb / 20
    observation[24] = made / 4
    observation[25] = high / 12
    observation[32:38] = mask
    return {"phase": phase, "observation": observation, "legalMask": mask}


class BootstrapPolicyTests(unittest.TestCase):
    def test_standard_bootstrap_uses_frozen_beginner_actions(self):
        class FrozenBeginner:
            def act(self, obs, epsilon, action_mask):
                self_called.append((epsilon, int(action_mask[0])))
                return 0

        class Learner:
            def act(self, *args, **kwargs):
                raise AssertionError("learner must not choose bootstrap actions")

        class Bridge:
            def send(self, command):
                self.assert_command = command
                return {"type": "hand_end", "chipDeltaBySeat": [20, -20]}

        self_called = []
        bridge = Bridge()
        first = decision("BET", 2, 10, 3, 0, [1, 1, 0, 0, 0, 0])
        first.update({"type": "decision", "schemaVersion": "badugi-controller-observation-v2-draft",
                      "seat": 0, "seatCount": 2, "occupiedSeatCount": 2,
                      "isTournament": False, "activeBigBlind": 20})
        demos = []
        outcome = run_hand(bridge, first, Learner(), None, 0, "passive", 0.1,
                           2, 2, False, bootstrap=True, demonstrations=demos,
                           bootstrap_agent=FrozenBeginner())
        self.assertEqual(bridge.assert_command["actionIndex"], 0)
        self.assertEqual(outcome["heroChipBb"], 1)
        self.assertEqual(demos[0][1], 0)
        self.assertEqual(self_called, [(0.0, 1)])

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
