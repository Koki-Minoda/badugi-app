from collections import deque

import numpy as np
import pytest
import torch

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.env.badugi_env_sixmax_selfplay import BET, CHECK, CALL, FOLD, MAX_DRAWS, RAISE, SixMaxBadugiEnv
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


def _set_predraw_spot(
    env: SixMaxBadugiEnv,
    *,
    position: str,
    hero_hand: list[tuple[int, int]],
    draw_round: int = 0,
    current_bet: int = 2,
    hero_bet: int = 0,
) -> None:
    hero = env.hero_seat
    dealer_offsets = {"BTN": 0, "CO": 1, "MP": 2, "UTG": 3, "BB": 4, "SB": 5}
    env.dealer_seat = (hero + dealer_offsets[position]) % 6
    env.phase = "BET"
    env.draw_round = draw_round
    env.current_bet = current_bet
    env.raise_count = 0
    env.pot = max(3, current_bet + 1)
    env.bet_queue = deque([hero, (hero + 1) % 6, (hero + 2) % 6])
    for seat, player in enumerate(env.players):
        player["folded"] = seat not in set(env.bet_queue)
        player["bet"] = 0
        player["stack"] = 98
    env.players[hero]["bet"] = hero_bet
    env.players[hero]["hand"] = list(hero_hand)


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
    assert fold_reward == pytest.approx(0.30)

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
        reward=0.30,
        next_obs=next_obs,
        done=True,
        next_action_mask=mask,
    )

    assert routed == "fold"
    assert len(fold_buffer) == 1
    assert len(call_buffer) == 0
    assert fold_buffer.sample(1)["actions"][0] == FOLD


def test_good_fold_shaping_returns_enhanced_reward():
    weak_hand = [(12, 0), (12, 1), (12, 2), (12, 3)]
    env = SixMaxBadugiEnv(seed=19, opp_epsilon=0.0)
    env.reset(seed=19)
    _set_final_street_facing_bet(env, hero_hand=weak_hand)

    assert env._fold_shaping(env.hero_seat) == pytest.approx(0.30)


def test_sb_facing_open_weak_3card_fold_is_not_bad_fold():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=167, opp_epsilon=0.0)
    env.reset(seed=167)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=weak_3card_eight_high,
        current_bet=4,
        hero_bet=1,
    )

    done, reward, info = env._apply_action(env.hero_seat, FOLD)

    assert done is True
    assert info["terminal_reason"] == "hero_fold"
    assert reward == pytest.approx(0.0)


def test_sb_facing_open_trashy_3card_fold_gets_small_good_fold():
    trashy_3card_ten_high = [(0, 0), (4, 1), (9, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=173, opp_epsilon=0.0)
    env.reset(seed=173)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=trashy_3card_ten_high,
        current_bet=4,
        hero_bet=1,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, FOLD)

    assert reward == pytest.approx(0.10)


def test_sb_facing_open_strong_3card_fold_remains_bad_fold():
    strong_3card_seven_high = [(0, 0), (3, 1), (6, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=179, opp_epsilon=0.0)
    env.reset(seed=179)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=strong_3card_seven_high,
        current_bet=4,
        hero_bet=1,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, FOLD)

    assert reward < 0.0


def test_bb_facing_open_weak_3card_fold_unchanged():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=181, opp_epsilon=0.0)
    env.reset(seed=181)
    _set_predraw_spot(
        env,
        position="BB",
        hero_hand=weak_3card_eight_high,
        current_bet=4,
        hero_bet=2,
    )
    env.pot = 20

    _done, reward, _info = env._apply_action(env.hero_seat, FOLD)

    assert reward < 0.0


def test_btn_facing_open_weak_3card_fold_unchanged():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=191, opp_epsilon=0.0)
    env.reset(seed=191)
    _set_predraw_spot(
        env,
        position="BTN",
        hero_hand=weak_3card_eight_high,
        current_bet=4,
        hero_bet=0,
    )
    env.pot = 30

    _done, reward, _info = env._apply_action(env.hero_seat, FOLD)

    assert reward < 0.0


def test_sb_completion_weak_3card_fold_unchanged():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=193, opp_epsilon=0.0)
    env.reset(seed=193)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=weak_3card_eight_high,
        current_bet=2,
        hero_bet=1,
    )
    env.pot = 20

    _done, reward, _info = env._apply_action(env.hero_seat, FOLD)

    assert reward < 0.0


def test_weak_3card_early_raise_gets_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=23, opp_epsilon=0.0)
    env.reset(seed=23)
    _set_predraw_spot(env, position="UTG", hero_hand=weak_3card_eight_high)

    done, reward, info = env._apply_action(env.hero_seat, RAISE)

    assert done is False
    assert info == {}
    assert reward == pytest.approx(-0.10)
    assert env._fold_shaping(env.hero_seat) != pytest.approx(reward)


def test_weak_3card_early_call_gets_smaller_penalty():
    weak_3card_nine_high = [(0, 0), (4, 1), (8, 2), (12, 2)]
    call_env = SixMaxBadugiEnv(seed=29, opp_epsilon=0.0)
    call_env.reset(seed=29)
    _set_predraw_spot(call_env, position="MP", hero_hand=weak_3card_nine_high)

    _done, call_reward, _info = call_env._apply_action(call_env.hero_seat, CALL)

    raise_env = SixMaxBadugiEnv(seed=29, opp_epsilon=0.0)
    raise_env.reset(seed=29)
    _set_predraw_spot(raise_env, position="MP", hero_hand=weak_3card_nine_high)

    _done, raise_reward, _info = raise_env._apply_action(raise_env.hero_seat, RAISE)

    assert call_reward == pytest.approx(-0.05)
    assert raise_reward == pytest.approx(-0.10)
    assert call_reward > raise_reward


@pytest.mark.parametrize("position", ["CO", "BTN"])
def test_weak_3card_late_position_not_penalized(position):
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=31, opp_epsilon=0.0)
    env.reset(seed=31)
    _set_predraw_spot(env, position=position, hero_hand=weak_3card_eight_high)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(0.0)


def test_weak_3card_co_facing_open_call_gets_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=43, opp_epsilon=0.0)
    env.reset(seed=43)
    _set_predraw_spot(env, position="CO", hero_hand=weak_3card_eight_high, current_bet=4)

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(-0.10)


def test_weak_3card_btn_facing_open_raise_gets_penalty():
    weak_3card_nine_high = [(0, 0), (4, 1), (8, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=47, opp_epsilon=0.0)
    env.reset(seed=47)
    _set_predraw_spot(env, position="BTN", hero_hand=weak_3card_nine_high, current_bet=4)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.20)


def test_sb_facing_open_weak_3card_raise_gets_stronger_aggressive_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=101, opp_epsilon=0.0)
    env.reset(seed=101)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=weak_3card_eight_high,
        current_bet=4,
        hero_bet=1,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.35)


def test_sb_facing_open_weak_2card_raise_gets_stronger_aggressive_penalty():
    weak_2card_nine_high = [(0, 0), (8, 1), (12, 0), (12, 1)]
    env = SixMaxBadugiEnv(seed=131, opp_epsilon=0.0)
    env.reset(seed=131)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=weak_2card_nine_high,
        current_bet=4,
        hero_bet=1,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.35)


def test_sb_facing_open_1card_trash_raise_gets_aggressive_penalty():
    one_card_trash = [(12, 0), (12, 1), (12, 2), (12, 3)]
    env = SixMaxBadugiEnv(seed=137, opp_epsilon=0.0)
    env.reset(seed=137)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=one_card_trash,
        current_bet=4,
        hero_bet=1,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.35)


def test_bb_facing_open_weak_3card_raise_gets_stronger_aggressive_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=103, opp_epsilon=0.0)
    env.reset(seed=103)
    _set_predraw_spot(
        env,
        position="BB",
        hero_hand=weak_3card_eight_high,
        current_bet=4,
        hero_bet=2,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.35)


def test_bb_facing_open_weak_3card_call_keeps_normal_call_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=107, opp_epsilon=0.0)
    env.reset(seed=107)
    _set_predraw_spot(
        env,
        position="BB",
        hero_hand=weak_3card_eight_high,
        current_bet=4,
        hero_bet=2,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(-0.10)


def test_sb_facing_open_weak_3card_call_gets_extra_call_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=139, opp_epsilon=0.0)
    env.reset(seed=139)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=weak_3card_eight_high,
        current_bet=4,
        hero_bet=1,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(-0.18)


def test_bb_facing_open_weak_3card_call_stays_normal_call_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=149, opp_epsilon=0.0)
    env.reset(seed=149)
    _set_predraw_spot(
        env,
        position="BB",
        hero_hand=weak_3card_eight_high,
        current_bet=4,
        hero_bet=2,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(-0.10)


def test_btn_facing_open_weak_3card_call_stays_normal_call_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=151, opp_epsilon=0.0)
    env.reset(seed=151)
    _set_predraw_spot(
        env,
        position="BTN",
        hero_hand=weak_3card_eight_high,
        current_bet=4,
        hero_bet=0,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(-0.10)


def test_sb_facing_open_strong_3card_call_not_penalized():
    strong_3card_seven_high = [(0, 0), (3, 1), (6, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=157, opp_epsilon=0.0)
    env.reset(seed=157)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=strong_3card_seven_high,
        current_bet=4,
        hero_bet=1,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(0.0)


def test_sb_completion_weak_3card_call_not_affected_by_extra_call_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=163, opp_epsilon=0.0)
    env.reset(seed=163)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=weak_3card_eight_high,
        current_bet=2,
        hero_bet=1,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(0.0)


def test_btn_facing_open_weak_3card_raise_keeps_existing_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=109, opp_epsilon=0.0)
    env.reset(seed=109)
    _set_predraw_spot(env, position="BTN", hero_hand=weak_3card_eight_high, current_bet=4)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.20)


@pytest.mark.parametrize(
    ("action", "expected"),
    [
        (CALL, 0.0),
        (RAISE, 0.0),
    ],
)
def test_sb_completion_weak_3card_is_not_affected_by_facing_open_aggressive_penalty(action, expected):
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=113, opp_epsilon=0.0)
    env.reset(seed=113)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=weak_3card_eight_high,
        current_bet=2,
        hero_bet=1,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, action)

    assert reward == pytest.approx(expected)


@pytest.mark.parametrize("position", ["SB", "BB"])
def test_strong_3card_blind_facing_open_raise_not_penalized(position):
    strong_3card_seven_high = [(0, 0), (3, 1), (6, 2), (12, 2)]
    hero_bet = 1 if position == "SB" else 2
    env = SixMaxBadugiEnv(seed=127, opp_epsilon=0.0)
    env.reset(seed=127)
    _set_predraw_spot(
        env,
        position=position,
        hero_hand=strong_3card_seven_high,
        current_bet=4,
        hero_bet=hero_bet,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(0.0)


def test_strong_3card_early_not_penalized():
    strong_3card_seven_high = [(0, 0), (3, 1), (6, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=37, opp_epsilon=0.0)
    env.reset(seed=37)
    _set_predraw_spot(env, position="UTG", hero_hand=strong_3card_seven_high)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(0.0)


def test_postdraw_r1_weak_3card_raise_gets_penalty():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=41, opp_epsilon=0.0)
    env.reset(seed=41)
    _set_predraw_spot(env, position="UTG", hero_hand=weak_3card_eight_high, draw_round=1)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.10)


def test_postdraw_r2_weak_3card_raise_gets_stronger_penalty():
    weak_3card_nine_high = [(0, 0), (3, 1), (8, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=43, opp_epsilon=0.0)
    env.reset(seed=43)
    _set_predraw_spot(env, position="CO", hero_hand=weak_3card_nine_high, draw_round=2)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.15)


def test_postdraw_r1_trash_raise_gets_penalty():
    trash_one_card = [(12, 0), (12, 1), (12, 2), (12, 3)]
    env = SixMaxBadugiEnv(seed=47, opp_epsilon=0.0)
    env.reset(seed=47)
    _set_predraw_spot(env, position="BTN", hero_hand=trash_one_card, draw_round=1)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.15)


def test_postdraw_r3_weak_3card_raise_not_penalized():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=49, opp_epsilon=0.0)
    env.reset(seed=49)
    _set_predraw_spot(env, position="UTG", hero_hand=weak_3card_eight_high, draw_round=3)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(0.0)


def test_postdraw_r1_weak_3card_call_not_penalized():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=51, opp_epsilon=0.0)
    env.reset(seed=51)
    _set_predraw_spot(env, position="UTG", hero_hand=weak_3card_eight_high, draw_round=1)

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(0.0)


def test_postdraw_r1_strong_3card_raise_not_penalized():
    strong_3card_seven_high = [(0, 0), (3, 1), (6, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=52, opp_epsilon=0.0)
    env.reset(seed=52)
    _set_predraw_spot(env, position="UTG", hero_hand=strong_3card_seven_high, draw_round=1)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(0.0)


def test_weak_3card_early_check_not_penalized():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    env = SixMaxBadugiEnv(seed=53, opp_epsilon=0.0)
    env.reset(seed=53)
    _set_predraw_spot(env, position="UTG", hero_hand=weak_3card_eight_high, current_bet=0)

    _done, reward, _info = env._apply_action(env.hero_seat, CHECK)

    assert reward == pytest.approx(0.0)


def test_weak_2card_early_call_gets_penalty():
    weak_2card_nine_high = [(0, 0), (8, 1), (12, 0), (12, 1)]
    env = SixMaxBadugiEnv(seed=59, opp_epsilon=0.0)
    env.reset(seed=59)
    _set_predraw_spot(env, position="UTG", hero_hand=weak_2card_nine_high)

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(-0.05)


def test_weak_2card_early_raise_gets_penalty():
    weak_2card_nine_high = [(0, 0), (8, 1), (12, 0), (12, 1)]
    env = SixMaxBadugiEnv(seed=61, opp_epsilon=0.0)
    env.reset(seed=61)
    _set_predraw_spot(env, position="UTG", hero_hand=weak_2card_nine_high)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.10)


@pytest.mark.parametrize("action", [CALL, RAISE])
def test_strong_2card_early_not_penalized(action):
    strong_2card_eight_high = [(0, 0), (7, 1), (12, 0), (12, 1)]
    env = SixMaxBadugiEnv(seed=67, opp_epsilon=0.0)
    env.reset(seed=67)
    _set_predraw_spot(env, position="UTG", hero_hand=strong_2card_eight_high)

    _done, reward, _info = env._apply_action(env.hero_seat, action)

    assert reward == pytest.approx(0.0)


def test_sb_completion_weak_2card_no_penalty():
    weak_2card_nine_high = [(0, 0), (8, 1), (12, 0), (12, 1)]
    env = SixMaxBadugiEnv(seed=71, opp_epsilon=0.0)
    env.reset(seed=71)
    _set_predraw_spot(
        env,
        position="SB",
        hero_hand=weak_2card_nine_high,
        current_bet=2,
        hero_bet=1,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(0.0)


@pytest.mark.parametrize("action", [BET, CHECK])
def test_bb_option_weak_2card_no_penalty(action):
    weak_2card_nine_high = [(0, 0), (8, 1), (12, 0), (12, 1)]
    env = SixMaxBadugiEnv(seed=73, opp_epsilon=0.0)
    env.reset(seed=73)
    _set_predraw_spot(
        env,
        position="BB",
        hero_hand=weak_2card_nine_high,
        current_bet=2,
        hero_bet=2,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, action)

    assert reward == pytest.approx(0.0)


def test_bb_facing_raise_weak_2card_call_gets_penalty():
    weak_2card_nine_high = [(0, 0), (8, 1), (12, 0), (12, 1)]
    env = SixMaxBadugiEnv(seed=79, opp_epsilon=0.0)
    env.reset(seed=79)
    _set_predraw_spot(
        env,
        position="BB",
        hero_hand=weak_2card_nine_high,
        current_bet=4,
        hero_bet=2,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, CALL)

    assert reward == pytest.approx(-0.10)


def test_weak_2card_facing_open_raise_gets_aggressive_penalty():
    weak_2card_nine_high = [(0, 0), (8, 1), (12, 0), (12, 1)]
    env = SixMaxBadugiEnv(seed=81, opp_epsilon=0.0)
    env.reset(seed=81)
    _set_predraw_spot(
        env,
        position="CO",
        hero_hand=weak_2card_nine_high,
        current_bet=4,
    )

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(-0.20)


def test_1card_trash_utg_no_weak_hand_penalty():
    one_card_trash = [(12, 0), (12, 0), (12, 0), (12, 0)]
    env = SixMaxBadugiEnv(seed=82, opp_epsilon=0.0)
    env.reset(seed=82)
    _set_predraw_spot(env, position="UTG", hero_hand=one_card_trash)

    _done, reward, _info = env._apply_action(env.hero_seat, RAISE)

    assert reward == pytest.approx(0.0)


def test_high_boundary_for_weak_3card():
    weak_3card_eight_high = [(0, 0), (3, 1), (7, 2), (12, 2)]
    strong_3card_seven_high = [(0, 0), (3, 1), (6, 2), (12, 2)]

    weak_env = SixMaxBadugiEnv(seed=83, opp_epsilon=0.0)
    weak_env.reset(seed=83)
    _set_predraw_spot(weak_env, position="UTG", hero_hand=weak_3card_eight_high)
    _done, weak_reward, _info = weak_env._apply_action(weak_env.hero_seat, CALL)

    strong_env = SixMaxBadugiEnv(seed=89, opp_epsilon=0.0)
    strong_env.reset(seed=89)
    _set_predraw_spot(strong_env, position="UTG", hero_hand=strong_3card_seven_high)
    _done, strong_reward, _info = strong_env._apply_action(strong_env.hero_seat, CALL)

    assert weak_reward == pytest.approx(-0.05)
    assert strong_reward == pytest.approx(0.0)


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


def _semibluff_obs(
    *,
    position: str,
    hand: list[tuple[int, int]],
    n_opps: int = 2,
    draw_round: int = 1,
    pot: int = 10,
    current_bet: int = 0,
) -> np.ndarray:
    env = SixMaxBadugiEnv(seed=17, opp_epsilon=0.0)
    env.reset(seed=17)
    hero = env.hero_seat
    dealer_offsets = {"BTN": 0, "CO": 1, "MP": 2}
    env.dealer_seat = (hero + dealer_offsets[position]) % 6
    env.phase = "BET"
    env.draw_round = draw_round
    env.current_bet = current_bet
    env.pot = pot
    active = {hero}
    for offset in range(1, n_opps + 1):
        active.add((hero + offset) % 6)
    for seat, player in enumerate(env.players):
        player["folded"] = seat not in active
        player["bet"] = 0

    env.players[hero]["hand"] = list(hand)
    return env._obs_for(hero)


def test_mp_position_does_not_emit_late_semibluff_signal():
    obs = _semibluff_obs(position="MP", hand=[(0, 0), (3, 1), (6, 2), (12, 2)])

    assert obs[21] == pytest.approx(0.6)
    assert obs[60] == pytest.approx(0.0)


def test_btn_three_card_nine_high_is_not_unconditional_late_semibluff_signal():
    obs = _semibluff_obs(position="BTN", hand=[(0, 0), (4, 1), (8, 2), (12, 2)])

    assert obs[60] == pytest.approx(0.0)


@pytest.mark.parametrize("position", ["BTN", "CO"])
@pytest.mark.parametrize(
    "hand",
    [
        [(0, 0), (3, 1), (6, 2), (12, 2)],
        [(0, 0), (3, 1), (7, 2), (12, 2)],
    ],
)
def test_late_position_three_card_seven_or_eight_high_can_emit_semibluff_signal(position, hand):
    obs = _semibluff_obs(position=position, hand=hand, n_opps=2, draw_round=1, pot=10)

    assert obs[60] == pytest.approx(1.0)


def test_late_semibluff_signal_rejects_too_many_opponents():
    obs = _semibluff_obs(
        position="BTN",
        hand=[(0, 0), (3, 1), (6, 2), (12, 2)],
        n_opps=3,
    )

    assert obs[60] == pytest.approx(0.0)


def test_late_semibluff_signal_rejects_final_draw_spot():
    obs = _semibluff_obs(
        position="BTN",
        hand=[(0, 0), (3, 1), (6, 2), (12, 2)],
        draw_round=2,
    )

    assert obs[60] == pytest.approx(0.0)


def test_late_semibluff_signal_rejects_high_pot_pressure():
    obs = _semibluff_obs(
        position="BTN",
        hand=[(0, 0), (3, 1), (6, 2), (12, 2)],
        pot=18,
    )

    assert obs[60] == pytest.approx(0.0)
