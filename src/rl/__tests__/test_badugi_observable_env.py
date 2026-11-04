"""An opponent's private profile must not appear in a fixed public state."""

import numpy as np
import pytest

from rl.env.badugi_env import BadugiEnv, OPPONENT_PROFILES
from rl.env.badugi_env_observable import ObservableBadugiEnv
from rl.training.badugi_starting_ranges import teacher_action


@pytest.mark.parametrize("table_size", [2, 3, 6])
@pytest.mark.parametrize("phase", ["BET", "DRAW"])
@pytest.mark.parametrize("observed_actions", [False, True])
def test_profile_changes_do_not_change_observation(table_size, phase, observed_actions):
    env = ObservableBadugiEnv(table_size=table_size, hero_position=0)
    env.reset(seed=103)
    env.phase = phase
    if observed_actions:
        env.opponent_action_count = 4
        env.opponent_aggressive_action_count = 1
        env.opponent_passive_action_count = 2
        env.opponent_fold_count = 1
        env.opponent_pat_count = 1
        env.opponent_draw_count = 2
        env.opponent_total_draw_cards = 3
        env.opponent_last_draw = 2

    baseline_mask = env.legal_action_mask().copy()
    baseline = env._get_obs().copy()
    baseline_teacher = teacher_action(env)
    assert baseline.shape == (96,)
    assert np.isfinite(baseline).all()
    assert baseline[47] == pytest.approx(env.NEUTRAL_BLUFF_FREQUENCY)
    for profile in OPPONENT_PROFILES:
        env.set_opponent_profile(profile)
        np.testing.assert_array_equal(env.legal_action_mask(), baseline_mask)
        np.testing.assert_array_equal(env._get_obs(), baseline)
        assert teacher_action(env) == baseline_teacher


def test_legacy_observation_exposes_hidden_profile_before_any_action():
    env = BadugiEnv(table_size=2)
    env.reset(seed=107)
    env.set_opponent_profile("tight_aggressive")
    first = env._get_obs()
    env.set_opponent_profile("loose_passive")
    second = env._get_obs()
    assert np.any(first != second)


def test_private_opponent_cards_and_deck_do_not_change_observation():
    env = ObservableBadugiEnv(table_size=6, hero_position=2)
    env.reset(seed=109)
    baseline = env._get_obs().copy()
    env.opponent_hand = [(0, 0), (1, 1), (2, 2), (3, 3)]
    env.deck = [(12, 3)] * 44
    np.testing.assert_array_equal(env._get_obs(), baseline)


def test_observable_teacher_does_not_inspect_private_profile():
    class ProfileTrap:
        def __getattr__(self, name):
            raise AssertionError(f"Teacher read private profile field: {name}")

    env = ObservableBadugiEnv(table_size=6, hero_position=5)
    env.reset(seed=113)
    env.opponent_profile = ProfileTrap()
    assert env.legal_action_mask()[teacher_action(env)] > 0
