from collections import deque

import pytest

from rl.env.badugi_env_sixmax_selfplay import (
    BET,
    CALL,
    CHECK,
    FOLD,
    POSTDRAW_VALUE_BET_SHAPING_WEIGHT,
    RAISE,
    SixMaxBadugiEnv,
)


MADE_BADUGI = [(0, 0), (3, 1), (8, 2), (12, 3)]
STRONG_THREE_CARD = [(0, 0), (3, 1), (6, 2), (12, 2)]
THREE_CARD_SEVEN_HIGH = [(0, 0), (3, 1), (7, 2), (12, 2)]
WEAK_THREE_CARD = [(0, 0), (4, 1), (9, 2), (12, 2)]


def _set_value_bet_spot(
    env: SixMaxBadugiEnv,
    *,
    hero_hand: list[tuple[int, int]] = MADE_BADUGI,
    seat: int | None = None,
    draw_round: int = 1,
    current_bet: int = 0,
    player_bet: int = 0,
    folded: bool = False,
    terminal_reason: str | None = None,
    game_ended: bool = False,
) -> int:
    hero = env.hero_seat
    active_seat = hero if seat is None else seat
    opp = (hero + 1) % 6 if active_seat != (hero + 1) % 6 else (hero + 2) % 6
    env.phase = "BET"
    env.draw_round = draw_round
    env.current_bet = current_bet
    env.raise_count = 0
    env.pot = 12
    env.bet_queue = deque([active_seat, opp])
    env.terminal_reason = terminal_reason
    env._game_ended = game_ended
    for player in env.players:
        player["folded"] = True
        player["bet"] = 0
        player["stack"] = 98
        player["hand"] = list(WEAK_THREE_CARD)
    env.players[hero]["folded"] = folded
    env.players[active_seat]["folded"] = folded if active_seat == hero else False
    env.players[opp]["folded"] = False
    env.players[active_seat]["bet"] = player_bet
    env.players[active_seat]["hand"] = list(hero_hand)
    env.players[opp]["hand"] = list(MADE_BADUGI)
    return active_seat


def test_value_bet_shaping_does_not_fire_predraw():
    env = SixMaxBadugiEnv(seed=101, opp_epsilon=0.0)
    env.reset(seed=101)
    _set_value_bet_spot(env, hero_hand=MADE_BADUGI, draw_round=0)

    reward = env._postdraw_value_bet_shaping(env.hero_seat, BET)

    assert reward == pytest.approx(0.0)


def test_value_bet_shaping_rewards_postdraw_made_badugi_bet():
    env = SixMaxBadugiEnv(seed=103, opp_epsilon=0.0)
    env.reset(seed=103)
    _set_value_bet_spot(env, hero_hand=MADE_BADUGI)

    _done, reward, _info = env._apply_action(env.hero_seat, BET)

    assert reward == pytest.approx(POSTDRAW_VALUE_BET_SHAPING_WEIGHT)


def test_value_bet_shaping_rewards_postdraw_strong_three_card_bet():
    env = SixMaxBadugiEnv(seed=107, opp_epsilon=0.0)
    env.reset(seed=107)
    _set_value_bet_spot(env, hero_hand=STRONG_THREE_CARD)

    reward = env._postdraw_value_bet_shaping(env.hero_seat, BET)

    assert reward == pytest.approx(POSTDRAW_VALUE_BET_SHAPING_WEIGHT)


@pytest.mark.parametrize(
    ("hero_hand", "expected"),
    [
        (STRONG_THREE_CARD, POSTDRAW_VALUE_BET_SHAPING_WEIGHT),
        (THREE_CARD_SEVEN_HIGH, 0.0),
    ],
)
def test_value_bet_shaping_strong_three_card_high_rank_threshold(hero_hand, expected):
    env = SixMaxBadugiEnv(seed=108, opp_epsilon=0.0)
    env.reset(seed=108)
    _set_value_bet_spot(env, hero_hand=hero_hand)

    reward = env._postdraw_value_bet_shaping(env.hero_seat, BET)

    assert reward == pytest.approx(expected)


def test_value_bet_shaping_does_not_reward_weak_three_card():
    env = SixMaxBadugiEnv(seed=109, opp_epsilon=0.0)
    env.reset(seed=109)
    _set_value_bet_spot(env, hero_hand=WEAK_THREE_CARD)

    reward = env._postdraw_value_bet_shaping(env.hero_seat, BET)

    assert reward == pytest.approx(0.0)


def test_value_bet_shaping_does_not_fire_facing_bet():
    env = SixMaxBadugiEnv(seed=113, opp_epsilon=0.0)
    env.reset(seed=113)
    _set_value_bet_spot(env, hero_hand=MADE_BADUGI, current_bet=2, player_bet=0)

    reward = env._postdraw_value_bet_shaping(env.hero_seat, BET)

    assert reward == pytest.approx(0.0)


def test_value_bet_shaping_does_not_fire_for_opponent_seat():
    env = SixMaxBadugiEnv(seed=127, opp_epsilon=0.0)
    env.reset(seed=127)
    opponent = (env.hero_seat + 1) % 6
    _set_value_bet_spot(env, hero_hand=MADE_BADUGI, seat=opponent)

    reward = env._postdraw_value_bet_shaping(opponent, BET)

    assert reward == pytest.approx(0.0)


@pytest.mark.parametrize("action", [CHECK, CALL, RAISE, FOLD])
def test_value_bet_shaping_does_not_fire_for_non_bet_actions(action):
    env = SixMaxBadugiEnv(seed=131, opp_epsilon=0.0)
    env.reset(seed=131)
    _set_value_bet_spot(env, hero_hand=MADE_BADUGI)

    reward = env._postdraw_value_bet_shaping(env.hero_seat, action)

    assert reward == pytest.approx(0.0)


@pytest.mark.parametrize("draw_round", [2, 3])
def test_value_bet_shaping_rewards_later_postdraw_rounds(draw_round):
    env = SixMaxBadugiEnv(seed=133, opp_epsilon=0.0)
    env.reset(seed=133)
    _set_value_bet_spot(env, hero_hand=MADE_BADUGI, draw_round=draw_round)

    reward = env._postdraw_value_bet_shaping(env.hero_seat, BET)

    assert reward == pytest.approx(POSTDRAW_VALUE_BET_SHAPING_WEIGHT)


@pytest.mark.parametrize(
    ("folded", "terminal_reason", "game_ended"),
    [
        (True, None, False),
        (False, "hero_fold", False),
        (False, None, True),
    ],
)
def test_value_bet_shaping_does_not_fire_when_hero_cannot_act(
    folded,
    terminal_reason,
    game_ended,
):
    env = SixMaxBadugiEnv(seed=137, opp_epsilon=0.0)
    env.reset(seed=137)
    _set_value_bet_spot(
        env,
        hero_hand=MADE_BADUGI,
        folded=folded,
        terminal_reason=terminal_reason,
        game_ended=game_ended,
    )

    reward = env._postdraw_value_bet_shaping(env.hero_seat, BET)

    assert reward == pytest.approx(0.0)


def test_value_bet_shaping_adds_no_reward_for_weak_hand_bet_via_apply_action(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    env_normal = SixMaxBadugiEnv(seed=201, opp_epsilon=0.0)
    env_normal.reset(seed=201)
    _set_value_bet_spot(env_normal, hero_hand=WEAK_THREE_CARD)

    env_control = SixMaxBadugiEnv(seed=201, opp_epsilon=0.0)
    env_control.reset(seed=201)
    _set_value_bet_spot(env_control, hero_hand=WEAK_THREE_CARD)
    monkeypatch.setattr(env_control, '_postdraw_value_bet_shaping', lambda seat, action: 0.0)

    _done_n, reward_normal, _info_n = env_normal._apply_action(env_normal.hero_seat, BET)
    _done_c, reward_control, _info_c = env_control._apply_action(env_control.hero_seat, BET)

    assert reward_normal == pytest.approx(reward_control)
