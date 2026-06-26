from collections import deque

import pytest

from rl.env.badugi_draw_policy import ideal_draw_count
from rl.env.badugi_env_sixmax_selfplay import (
    CALL,
    DRAW_DECISION_SHAPING_WEIGHT,
    SixMaxBadugiEnv,
)


MADE_BADUGI = [(0, 0), (1, 1), (2, 2), (3, 3)]
STRONG_THREE_CARD = [(0, 0), (1, 1), (2, 2), (12, 2)]
TWO_CARD_HAND = [(0, 0), (1, 1), (5, 0), (5, 1)]
WEAK_ONE_CARD = [(12, 0), (12, 1), (12, 2), (12, 3)]


def _set_draw_spot(
    env: SixMaxBadugiEnv,
    *,
    hero_hand: list[tuple[int, int]],
    hero_is_front: bool = True,
) -> None:
    hero = env.hero_seat
    opp = (hero + 1) % 6
    env.phase = "DRAW"
    env.draw_round = 0
    env.current_bet = 0
    env.terminal_reason = None
    env._game_ended = False
    env.draw_order = deque([hero, opp] if hero_is_front else [opp, hero])
    env.deck = [(rank, suit) for rank in range(12, -1, -1) for suit in range(3, -1, -1)]
    for seat, player in enumerate(env.players):
        player["folded"] = seat not in {hero, opp}
        player["bet"] = 0
        player["stack"] = 98
    env.players[hero]["hand"] = list(hero_hand)
    env.players[opp]["hand"] = list(MADE_BADUGI)


def _step_draw_reward(
    monkeypatch: pytest.MonkeyPatch,
    *,
    hero_hand: list[tuple[int, int]],
    action: int,
    hero_is_front: bool = True,
) -> float:
    env = SixMaxBadugiEnv(seed=11, opp_epsilon=0.0)
    env.reset(seed=11)
    _set_draw_spot(env, hero_hand=hero_hand, hero_is_front=hero_is_front)
    monkeypatch.setattr(env, "_apply_all_opponent_draws", lambda: None)
    monkeypatch.setattr(env, "_end_draw_round", lambda: None)

    _obs, reward, terminated, _truncated, info = env.step(action)

    assert terminated is False
    assert info == {}
    return reward


@pytest.mark.parametrize(
    ("hand", "expected"),
    [
        (MADE_BADUGI, 0),
        (STRONG_THREE_CARD, 1),
        (TWO_CARD_HAND, 2),
        (WEAK_ONE_CARD, 3),
    ],
)
def test_ideal_draw_count_representative_badugi_hands(hand, expected):
    assert ideal_draw_count(hand) == expected


@pytest.mark.parametrize(
    ("hand", "action"),
    [
        (MADE_BADUGI, 0),
        (STRONG_THREE_CARD, 1),
        (WEAK_ONE_CARD, 3),
    ],
)
def test_draw_decision_shaping_disabled_for_ideal_hero_draw(monkeypatch, hand, action):
    reward = _step_draw_reward(monkeypatch, hero_hand=hand, action=action)

    assert DRAW_DECISION_SHAPING_WEIGHT == pytest.approx(0.0)
    assert reward == pytest.approx(0.0)


def test_draw_decision_shaping_penalizes_one_card_miss(monkeypatch):
    reward = _step_draw_reward(monkeypatch, hero_hand=MADE_BADUGI, action=1)

    assert reward == pytest.approx(0.0)


def test_draw_decision_shaping_penalizes_pat_with_three_card_hand(monkeypatch):
    reward = _step_draw_reward(monkeypatch, hero_hand=STRONG_THREE_CARD, action=0)

    assert reward == pytest.approx(0.0)


def test_draw_decision_shaping_penalizes_overdraw_with_three_card_hand(monkeypatch):
    reward = _step_draw_reward(monkeypatch, hero_hand=STRONG_THREE_CARD, action=2)

    assert reward == pytest.approx(0.0)


def test_draw_decision_shaping_penalizes_two_or_more_card_miss(monkeypatch):
    reward = _step_draw_reward(monkeypatch, hero_hand=MADE_BADUGI, action=2)

    assert reward == pytest.approx(0.0)


def test_draw_decision_shaping_does_not_apply_to_opponent_seat():
    env = SixMaxBadugiEnv(seed=13, opp_epsilon=0.0)
    env.reset(seed=13)
    _set_draw_spot(env, hero_hand=MADE_BADUGI)
    opp = (env.hero_seat + 1) % 6

    reward = env._draw_decision_shaping_reward(opp, 3, hand=WEAK_ONE_CARD)

    assert reward == pytest.approx(0.0)


def test_draw_decision_shaping_does_not_apply_in_bet_phase():
    env = SixMaxBadugiEnv(seed=17, opp_epsilon=0.0)
    env.reset(seed=17)
    _set_draw_spot(env, hero_hand=MADE_BADUGI)
    env.phase = "BET"

    reward = env._draw_decision_shaping_reward(env.hero_seat, 0, hand=MADE_BADUGI)

    assert reward == pytest.approx(0.0)


def test_draw_decision_shaping_does_not_apply_when_hero_is_not_draw_actor(monkeypatch):
    reward = _step_draw_reward(
        monkeypatch,
        hero_hand=MADE_BADUGI,
        action=0,
        hero_is_front=False,
    )

    assert reward == pytest.approx(0.0)


def test_invalid_draw_action_gets_no_draw_decision_shaping():
    env = SixMaxBadugiEnv(seed=19, opp_epsilon=0.0)
    env.reset(seed=19)
    _set_draw_spot(env, hero_hand=MADE_BADUGI)

    _obs, reward, terminated, _truncated, info = env.step(4)

    assert terminated is True
    assert info == {"illegal": True}
    assert reward == pytest.approx(-2.0)


def test_bet_phase_step_gets_no_draw_decision_shaping():
    env = SixMaxBadugiEnv(seed=23, opp_epsilon=0.0)
    env.reset(seed=23)
    env.phase = "BET"
    env.players[env.hero_seat]["hand"] = list(MADE_BADUGI)

    reward = env._draw_decision_shaping_reward(env.hero_seat, CALL, hand=MADE_BADUGI)

    assert reward == pytest.approx(0.0)
