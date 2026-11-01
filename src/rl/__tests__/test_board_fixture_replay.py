import numpy as np
import pytest

from rl.env.board_betting_env import BoardBettingEnv
from rl.training.train_board_dqn import add_board_fixture_examples


class RecordingReplay:
    def __init__(self):
        self.rows = []

    def add(self, observation, action, *_args, **_kwargs):
        self.rows.append((observation.copy(), action))


@pytest.mark.parametrize("family", ["nlh", "flh", "plo", "plo8"])
def test_fixture_replay_keeps_context_consistent_across_samples(family):
    env = BoardBettingEnv(family=family, tier="standard", seed=112)
    replay = RecordingReplay()
    expert = RecordingReplay()

    add_board_fixture_examples(env, replay, expert, copies=20)

    assert len(replay.rows) == len(expert.rows) == 200
    for observation, action in replay.rows:
        assert observation[7] == pytest.approx(0.33)  # flop, not a random street
        assert observation[2] == pytest.approx(0.28)  # fixed evaluation pot
        assert observation[14] == pytest.approx(0.8)  # fixed stack ratio
        assert action in range(6)
    for index in range(10):
        first = replay.rows[index][0]
        for copy_index in range(1, 20):
            np.testing.assert_array_equal(replay.rows[copy_index * 10 + index][0], first)

    thin_value_observation, thin_value_action = replay.rows[5]
    assert thin_value_observation[3] == pytest.approx(0.66)
    assert thin_value_observation[4] == pytest.approx(0.61)
    assert thin_value_observation[6] == pytest.approx(0.9)
    assert thin_value_action == 3  # bet, not check
