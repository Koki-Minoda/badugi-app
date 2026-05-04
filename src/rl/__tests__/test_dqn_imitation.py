import unittest

import numpy as np
import torch

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.training.evaluate_badugi_onnx import apply_badugi_feature_set


class DQNImitationTest(unittest.TestCase):
    def test_imitation_update_learns_expert_action(self):
        torch.manual_seed(7)
        np.random.seed(7)
        agent = DQNAgent(
            obs_dim=4,
            n_actions=3,
            hidden_dim=16,
            hyperparams=DQNHyperParams(lr=0.05, batch_size=8),
        )
        batch = {
            "obs": np.tile(np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32), (8, 1)),
            "actions": np.full((8,), 2, dtype=np.int64),
        }

        _loss, first_accuracy = agent.imitation_update(batch)
        for _ in range(20):
            loss, accuracy = agent.imitation_update(batch)

        self.assertLess(first_accuracy, 1.0)
        self.assertLess(loss, 0.05)
        self.assertEqual(accuracy, 1.0)
        action = agent.act(batch["obs"][0], epsilon=0.0)
        self.assertEqual(action, 2)

    def test_action_margin_update_pushes_preferred_action_above_fold(self):
        torch.manual_seed(11)
        np.random.seed(11)
        agent = DQNAgent(
            obs_dim=4,
            n_actions=3,
            hidden_dim=16,
            hyperparams=DQNHyperParams(lr=0.05, batch_size=8),
        )
        batch = {
            "obs": np.tile(np.array([0.0, 1.0, 0.0, 0.0], dtype=np.float32), (8, 1)),
            "actions": np.full((8,), 2, dtype=np.int64),
        }

        first_loss, _first_satisfied = agent.action_margin_update(
            batch,
            avoid_action=0,
            margin=0.2,
            loss_weight=1.0,
        )
        loss = first_loss
        satisfied = 0.0
        for _ in range(80):
            loss, satisfied = agent.action_margin_update(
                batch,
                avoid_action=0,
                margin=0.2,
                loss_weight=1.0,
            )

        self.assertLess(loss, first_loss)
        self.assertGreaterEqual(satisfied, 0.9)

    def test_badugi_feature_set_masks_newer_slots_for_older_models(self):
        obs = np.ones(96, dtype=np.float32)

        legacy = apply_badugi_feature_set(obs, "badugi-observation-v1")
        ev = apply_badugi_feature_set(obs, "badugi-observation-v1-ev")
        ev_range = apply_badugi_feature_set(obs, "badugi-observation-v1-ev-range")

        self.assertTrue(np.all(legacy[48:56] == 0))
        self.assertTrue(np.all(legacy[58:61] == 0))
        self.assertTrue(np.all(ev[48:56] == 1))
        self.assertTrue(np.all(ev[58:61] == 0))
        self.assertTrue(np.all(ev_range[58:61] == 1))


if __name__ == "__main__":
    unittest.main()
