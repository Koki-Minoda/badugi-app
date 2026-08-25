import numpy as np
import pytest

from rl.env.badugi_env_sixmax_profiled import ProfiledSixMaxBadugiEnv
from rl.env.badugi_env_sixmax_selfplay import SixMaxBadugiEnv
from rl.training.train_sixmax_selfplay_badugi_dqn import (
    SixMaxSelfPlayConfig,
    _build_profile_envs,
    _select_episode_env,
    parse_args,
)
from rl.utils.replay_buffer import ReplayBuffer


def _first_legal_action(mask: np.ndarray) -> int:
    legal = np.where(mask > 0)[0]
    assert len(legal) > 0
    return int(legal[0])


def test_parse_args_reads_profile_mix_options():
    args = parse_args([
        "--episodes",
        "0",
        "--profile-mix-rate",
        "0.35",
        "--training-profiles",
        "loose_passive,draw_heavy",
    ])

    assert args.profile_mix_rate == pytest.approx(0.35)
    assert args.training_profiles == ("loose_passive", "draw_heavy")


def test_profile_mix_zero_keeps_selfplay_env():
    cfg = SixMaxSelfPlayConfig(profile_mix_rate=0.0)
    sp_env = SixMaxBadugiEnv(seed=41, opp_epsilon=0.0)
    profile_envs = _build_profile_envs(cfg)

    active_env = _select_episode_env(
        cfg=cfg,
        episode=1,
        sp_env=sp_env,
        profile_envs=profile_envs,
        random_value=0.0,
    )

    assert profile_envs == ()
    assert active_env is sp_env


def test_profile_mix_selects_profile_env_round_robin():
    cfg = SixMaxSelfPlayConfig(
        profile_mix_rate=0.5,
        training_profiles=("loose_passive", "draw_heavy"),
        opp_epsilon=0.07,
    )
    sp_env = SixMaxBadugiEnv(seed=43, opp_epsilon=0.0)
    profile_envs = _build_profile_envs(cfg)

    assert len(profile_envs) == 2
    assert all(isinstance(env, ProfiledSixMaxBadugiEnv) for env in profile_envs)
    assert all(env.opp_epsilon == pytest.approx(0.07) for env in profile_envs)
    assert _select_episode_env(
        cfg=cfg,
        episode=1,
        sp_env=sp_env,
        profile_envs=profile_envs,
        random_value=0.0,
    ) is profile_envs[0]
    assert _select_episode_env(
        cfg=cfg,
        episode=2,
        sp_env=sp_env,
        profile_envs=profile_envs,
        random_value=0.0,
    ) is profile_envs[1]
    assert _select_episode_env(
        cfg=cfg,
        episode=3,
        sp_env=sp_env,
        profile_envs=profile_envs,
        random_value=0.99,
    ) is sp_env


def test_profile_env_transition_replay_shape_matches_sixmax():
    env = ProfiledSixMaxBadugiEnv(opponent_profile="loose_aggressive", seed=53, opp_epsilon=0.0)
    obs, _ = env.reset(seed=53)
    mask = env.legal_action_mask()
    action = _first_legal_action(mask)
    next_obs, reward, terminated, truncated, _info = env.step(action)
    done = terminated or truncated
    next_mask = env.legal_action_mask()
    replay = ReplayBuffer(capacity=4, alpha=0.0)

    replay.add(obs, action, reward, next_obs, done, next_action_mask=next_mask)
    batch = replay.sample(1)

    assert batch["obs"].shape == (1, 96)
    assert batch["next_obs"].shape == (1, 96)
    assert batch["actions"].shape == (1,)
    assert batch["rewards"].shape == (1,)
    assert batch["dones"].shape == (1,)
    assert batch["next_action_masks"].shape == (1, 6)
