from dataclasses import replace

import numpy as np
import pytest
import torch

from rl.agents.dqn_agent import DQNAgent
from rl.env.board_betting_env import BoardBettingEnv, board_teacher_action
from rl.training.train_board_dqn import BoardTrainConfig, add_board_fixture_examples, train_board_dqn


class RecordingReplay:
    def __init__(self, env):
        self.env = env
        self.rows = []

    def add(self, observation, action, *_args, **_kwargs):
        self.rows.append((observation.copy(), action, replace(self.env.scenario)))


@pytest.mark.parametrize("family", ["nlh", "flh", "plo", "plo8"])
def test_fixture_replay_keeps_context_consistent_across_samples(family):
    env = BoardBettingEnv(family=family, tier="standard", seed=112)
    replay = RecordingReplay(env)
    expert = RecordingReplay(env)

    add_board_fixture_examples(env, replay, expert, copies=20)

    assert len(replay.rows) == len(expert.rows) == 200
    street_contexts = (
        (0.0, 0.12, 0.95),
        (0.33, 0.28, 0.8),
        (0.66, 0.45, 0.65),
        (1.0, 0.6, 0.5),
    )
    for copy_index in range(20):
        street, pot, stack = street_contexts[copy_index % 4]
        for observation, action, scenario in replay.rows[copy_index * 10 : (copy_index + 1) * 10]:
            assert observation[7] == pytest.approx(street)
            assert observation[2] == pytest.approx(pot)
            assert observation[14] == pytest.approx(stack)
            assert action in range(6)
            if street != 0.33:
                assert action == board_teacher_action(scenario)
    for index in range(10):
        first = replay.rows[index][0]
        for copy_index in range(4, 20, 4):
            np.testing.assert_array_equal(replay.rows[copy_index * 10 + index][0], first)

    thin_value_observation, thin_value_action, _ = replay.rows[15]
    assert thin_value_observation[3] == pytest.approx(0.66)
    assert thin_value_observation[4] == pytest.approx(0.61)
    assert thin_value_observation[6] == pytest.approx(0.9)
    assert thin_value_action == 3  # bet, not check


def test_seeded_short_runs_have_identical_weights_and_bounded_fixture_mix(tmp_path):
    checkpoints = []
    for run in ("a", "b"):
        summary = train_board_dqn(
            BoardTrainConfig(
                family="nlh",
                tier="standard",
                total_episodes=6,
                teacher_warmup_episodes=80,
                imitation_pretrain_steps=2,
                warmup_steps=1,
                fixture_replay_copies=300,
                discount=0.5,
                seed=42,
                output_dir=str(tmp_path / run),
                log_interval=0,
            )
        )
        assert summary["fixture_replay_copies"] == 2  # 20 rows, 20% of the expert buffer
        assert summary["discount"] == 0.5
        checkpoints.append(DQNAgent.load(summary["checkpoint"]))
    for key, weights in checkpoints[0].q_network.state_dict().items():
        assert torch.equal(weights, checkpoints[1].q_network.state_dict()[key])
