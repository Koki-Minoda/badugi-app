from collections import deque

import numpy as np
import pytest
import torch

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.env.badugi_env_sixmax_selfplay import CALL, FOLD, MAX_DRAWS, SixMaxBadugiEnv
from rl.training.train_sixmax_selfplay_badugi_dqn import _add_fold_margin_transition
from rl.utils.replay_buffer import ReplayBuffer


def _set_final_street_facing_bet(
    env: SixMaxBadugiEnv,
    *,
    hero_hand: list[tuple[int, int]],
) -> None:
    hero = env.hero_seat
    opp1 = (hero + 1) % 6
    opp2 = (hero + 2) % 6
    env.phase = "BET"
    env.draw_round = MAX_DRAWS
    env.current_bet = 2
    env.raise_count = 0
    env.pot = 7
    env.bet_queue = deque([hero, opp1, opp2])
    for seat, player in enumerate(env.players):
        player["folded"] = seat not in {hero, opp1, opp2}
        player["bet"] = 2 if seat in {opp1, opp2} else 0
        player["stack"] = 98
    env.players[hero]["hand"] = list(hero_hand)
    env.players[opp1]["hand"] = [(0, 0), (1, 1), (2, 2), (3, 3)]
    env.players[opp2]["hand"] = [(0, 0), (4, 1), (8, 2), (12, 3)]


def test_weak_hero_fold_is_shaped_better_than_showdown_call_multiway():
    weak_hand = [(12, 0), (12, 1), (12, 2), (12, 3)]

    fold_env = SixMaxBadugiEnv(seed=7, opp_epsilon=0.0)
    fold_env.reset(seed=7)
    _set_final_street_facing_bet(fold_env, hero_hand=weak_hand)
    assert len(fold_env._active_seats_list()) == 3

    _obs, fold_reward, terminated, _truncated, info = fold_env.step(FOLD)

    assert terminated is True
    assert info["terminal_reason"] == "hero_fold"
    assert fold_env.terminal_reason == "hero_fold"
    assert fold_reward == pytest.approx(0.15)

    call_env = SixMaxBadugiEnv(seed=7, opp_epsilon=0.0)
    call_env.reset(seed=7)
    _set_final_street_facing_bet(call_env, hero_hand=weak_hand)

    _obs, call_reward, terminated, _truncated, info = call_env.step(CALL)

    assert terminated is True
    assert info["terminal_reason"] == "showdown"
    assert call_reward < fold_reward


def test_bad_fold_routes_to_call_buffer_not_fold_buffer():
    fold_buffer = ReplayBuffer(capacity=4, alpha=0.0)
    call_buffer = ReplayBuffer(capacity=4, alpha=0.0)
    obs = np.zeros(96, dtype=np.float32)
    next_obs = np.ones(96, dtype=np.float32)
    mask = np.array([1, 0, 1, 0, 1, 0], dtype=np.float32)

    routed = _add_fold_margin_transition(
        fold_buffer=fold_buffer,
        call_buffer=call_buffer,
        obs=obs,
        action=FOLD,
        reward=-0.5,
        next_obs=next_obs,
        done=True,
        next_action_mask=mask,
    )

    assert routed == "call"
    assert len(fold_buffer) == 0
    assert len(call_buffer) == 1
    assert call_buffer.sample(1)["actions"][0] == CALL


def test_good_fold_routes_to_fold_buffer():
    fold_buffer = ReplayBuffer(capacity=4, alpha=0.0)
    call_buffer = ReplayBuffer(capacity=4, alpha=0.0)
    obs = np.zeros(96, dtype=np.float32)
    next_obs = np.ones(96, dtype=np.float32)
    mask = np.array([1, 0, 1, 0, 1, 0], dtype=np.float32)

    routed = _add_fold_margin_transition(
        fold_buffer=fold_buffer,
        call_buffer=call_buffer,
        obs=obs,
        action=FOLD,
        reward=0.15,
        next_obs=next_obs,
        done=True,
        next_action_mask=mask,
    )

    assert routed == "fold"
    assert len(fold_buffer) == 1
    assert len(call_buffer) == 0
    assert fold_buffer.sample(1)["actions"][0] == FOLD


def test_call_buffer_margin_update_pushes_call_above_fold():
    torch.manual_seed(17)
    np.random.seed(17)
    agent = DQNAgent(
        obs_dim=4,
        n_actions=6,
        hidden_dim=16,
        hyperparams=DQNHyperParams(lr=0.05, batch_size=8),
    )
    batch = {
        "obs": np.tile(np.array([1.0, 0.0, 1.0, 0.0], dtype=np.float32), (8, 1)),
        "actions": np.full((8,), CALL, dtype=np.int64),
    }

    for _ in range(80):
        _loss, satisfied = agent.action_margin_update(
            batch,
            avoid_action=FOLD,
            margin=0.2,
            loss_weight=1.0,
        )

    q_values = agent.q_network(torch.as_tensor(batch["obs"][:1], dtype=torch.float32))
    assert satisfied >= 0.9
    assert q_values[0, CALL].item() > q_values[0, FOLD].item()


def test_draw_phase_resets_current_bet_and_observation_ignores_stale_bet():
    env = SixMaxBadugiEnv(seed=11, opp_epsilon=0.0)
    env.reset(seed=11)
    hero = env.hero_seat
    env.dealer_seat = hero
    env.phase = "BET"
    env.draw_round = 0
    env.current_bet = 6
    env.pot = 24
    env.bet_queue = deque()
    for player in env.players:
        player["folded"] = False
        player["bet"] = 6
        player["stack"] = 94

    done, _reward, _info = env._advance_from_bet(0.0)

    assert done is False
    assert env.phase == "DRAW"
    assert env.current_bet == 0
    assert all(player["bet"] == 0 for player in env.players)

    clean_obs = env._obs_for(hero)
    env.current_bet = 10
    stale_obs = env._obs_for(hero)

    assert stale_obs[14] == pytest.approx(0.0)
    assert stale_obs[28] == pytest.approx(0.0)
    assert stale_obs[30] == pytest.approx(0.0)
    for idx in (28, 30, 50, 51):
        assert stale_obs[idx] == pytest.approx(clean_obs[idx])


def test_btn_three_card_nine_high_is_not_unconditional_late_semibluff_signal():
    env = SixMaxBadugiEnv(seed=17, opp_epsilon=0.0)
    env.reset(seed=17)
    hero = env.hero_seat
    env.dealer_seat = hero
    env.phase = "BET"
    env.draw_round = 2
    env.current_bet = 0
    env.pot = 12
    for seat, player in enumerate(env.players):
        player["folded"] = seat not in {hero, (hero + 1) % 6, (hero + 2) % 6}
        player["bet"] = 0

    env.players[hero]["hand"] = [(0, 0), (4, 1), (8, 2), (12, 2)]
    nine_high_obs = env._obs_for(hero)

    env.players[hero]["hand"] = [(0, 0), (3, 1), (6, 2), (12, 2)]
    seven_high_obs = env._obs_for(hero)

    assert nine_high_obs[60] == pytest.approx(0.0)
    assert seven_high_obs[60] == pytest.approx(1.0)
