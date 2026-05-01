import unittest

import numpy as np
import torch

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams


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


if __name__ == "__main__":
    unittest.main()
