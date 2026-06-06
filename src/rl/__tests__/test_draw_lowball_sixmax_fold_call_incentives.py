from collections import deque

import pytest

from rl.env.draw_lowball_env_sixmax_selfplay import (
    CALL,
    FOLD,
    SixMaxDrawLowballEnv,
)


def c(rank: str | int, suit: int) -> tuple[int, int]:
    ranks = {"A": 14, "K": 13, "Q": 12, "J": 11, "T": 10}
    value = ranks[rank] if isinstance(rank, str) and rank in ranks else int(rank)
    return (value, suit)


WEAK_27_HAND = [c("K", 0), c("K", 1), c("Q", 2), c("J", 3), c("T", 0)]
STRONG_27_HAND = [c("7", 0), c("5", 1), c("4", 2), c("3", 3), c("2", 0)]
OPP_EIGHT_LOW = [c("8", 0), c("6", 1), c("5", 2), c("4", 3), c("2", 0)]
OPP_NINE_LOW = [c("9", 0), c("7", 1), c("5", 2), c("4", 3), c("2", 0)]


def _set_final_street_facing_bet(
    env: SixMaxDrawLowballEnv,
    *,
    hero_hand: list[tuple[int, int]],
    current_bet: int = 8,
    pot: int = 16,
    queue_only_hero: bool = True,
) -> None:
    env.reset(seed=7)
    hero = env.hero_seat
    opp1 = (hero + 1) % 6
    opp2 = (hero + 2) % 6
    env.phase = "BET"
    env.draw_round = env.max_draws
    env.current_bet = current_bet
    env.raise_count = 0
    env.pot = pot
    env.bet_queue = deque([hero] if queue_only_hero else [hero, opp1, opp2])
    for seat, player in enumerate(env.players):
        player["folded"] = seat not in {hero, opp1, opp2}
        player["all_in"] = False
        player["stack"] = 100
        player["bet"] = current_bet if seat in {opp1, opp2} else 0
    env.players[hero]["hand"] = list(hero_hand)
    env.players[opp1]["hand"] = list(OPP_EIGHT_LOW)
    env.players[opp2]["hand"] = list(OPP_NINE_LOW)


def _s01_env() -> SixMaxDrawLowballEnv:
    return SixMaxDrawLowballEnv(family="low-27", max_draws=1, seed=1, opp_epsilon=0.0)


def test_s01_weak_hand_fold_better_than_call():
    fold_env = _s01_env()
    _set_final_street_facing_bet(fold_env, hero_hand=WEAK_27_HAND)
    assert len(fold_env._active_seats_list()) == 3

    _obs, fold_reward, terminated, _truncated, info = fold_env.step(FOLD)

    assert terminated is True
    assert info["terminal_reason"] == "hero_fold"
    assert fold_env.terminal_reason == "hero_fold"

    call_env = _s01_env()
    _set_final_street_facing_bet(call_env, hero_hand=WEAK_27_HAND)
    _obs, call_reward, terminated, _truncated, info = call_env.step(CALL)

    assert terminated is True
    assert info["terminal_reason"] == "showdown"
    assert fold_reward > call_reward


def test_s01_good_hand_fold_is_bad_fold():
    env = _s01_env()
    _set_final_street_facing_bet(env, hero_hand=STRONG_27_HAND, current_bet=2, pot=12)

    _obs, reward, terminated, _truncated, info = env.step(FOLD)

    assert terminated is True
    assert info["terminal_reason"] == "hero_fold"
    assert reward < 0


def test_s01_non_hero_fold_no_shaping():
    env = _s01_env()
    _set_final_street_facing_bet(env, hero_hand=STRONG_27_HAND, queue_only_hero=False)
    hero = env.hero_seat
    opponent = (hero + 1) % 6
    env.bet_queue = deque([opponent, hero])

    done, reward, info = env._apply_action(opponent, FOLD)

    assert done is False
    assert reward == 0.0
    assert info == {}
    assert env.terminal_reason is None


def test_s01_fold_call_action_indices_preserved():
    assert FOLD == 0
    assert CALL == 2


@pytest.mark.parametrize("max_draws", [1, 3])
def test_low27_weak_hand_fold_path_shared_by_s01_and_d01(max_draws: int):
    env = SixMaxDrawLowballEnv(family="low-27", max_draws=max_draws, seed=1, opp_epsilon=0.0)
    _set_final_street_facing_bet(env, hero_hand=WEAK_27_HAND)

    _obs, reward, terminated, _truncated, info = env.step(FOLD)

    assert terminated is True
    assert info["terminal_reason"] == "hero_fold"
    assert env.terminal_reason == "hero_fold"
    assert reward == pytest.approx(0.15)
