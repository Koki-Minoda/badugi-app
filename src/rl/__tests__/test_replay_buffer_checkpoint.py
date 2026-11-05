"""Replay sampling must continue unchanged after a trusted local snapshot."""
import random
import unittest

import numpy as np

from rl.utils.replay_buffer import ReplayBuffer


class ReplayCheckpointTests(unittest.TestCase):
    def test_round_trip_preserves_sampling_and_configuration(self):
        replay = ReplayBuffer(capacity=8, seed=123)
        for index in range(10):
            obs = np.full(4, index, dtype=np.float32)
            replay.add(obs, index % 2, float(index), obs + 1, False,
                       next_action_mask=np.array([1, index % 2], dtype=np.float32))
        replay.update_priorities(np.arange(8), np.arange(1, 9, dtype=np.float32))
        replay.sample(2)
        snapshot = replay.state_dict()
        random_state, numpy_state = random.getstate(), np.random.get_state()
        expected, expected_indices, expected_weights = replay.sample(3, return_meta=True)

        restored = ReplayBuffer(capacity=8)
        restored.load_state_dict(snapshot)
        random.setstate(random_state)
        np.random.set_state(numpy_state)
        actual, actual_indices, actual_weights = restored.sample(3, return_meta=True)
        np.testing.assert_array_equal(actual_indices, expected_indices)
        np.testing.assert_array_equal(actual_weights, expected_weights)
        for key in expected:
            if expected[key] is not None:
                np.testing.assert_array_equal(actual[key], expected[key])
        self.assertEqual(restored.next_idx, replay.next_idx)
        self.assertEqual(restored._frame, replay._frame)
        with self.assertRaisesRegex(ValueError, "configuration"):
            ReplayBuffer(capacity=9).load_state_dict(snapshot)
        corrupted = dict(snapshot)
        corrupted["priorities"] = snapshot["priorities"].copy()
        corrupted["priorities"][0] = np.nan
        with self.assertRaisesRegex(ValueError, "invalid replay"):
            ReplayBuffer(capacity=8).load_state_dict(corrupted)


if __name__ == "__main__":
    unittest.main()
