from collections import deque

import pytest

from rl.env import badugi_env_sixmax_selfplay as badugi
from rl.env import draw_lowball_env_sixmax_selfplay as draw


@pytest.fixture(params=["badugi", "low-27-1", "low-27-3", "low-a5-1", "low-a5-3"])
def game(request):
    if request.param == "badugi":
        env, module = badugi.SixMaxBadugiEnv(seed=190), badugi
    else:
        family, draws = request.param.rsplit("-", 1)
        env, module = draw.SixMaxDrawLowballEnv(family=family, max_draws=int(draws), seed=190), draw
    env.reset(seed=190)
    seat = env.hero_seat
    env.phase = "BET"
    env.current_bet = 8
    env.raise_count = 0
    env.pot = 20
    env.players[seat].update(bet=2, folded=False, all_in=False)
    env.bet_queue = deque([seat, (seat + 1) % 6])
    return env, module, seat


@pytest.mark.parametrize("stack", [1, 5, 6, 7])
def test_call_mask_and_payment_preserve_short_allin(game, stack):
    env, module, seat = game
    player = env.players[seat]
    player["stack"] = stack
    total_before = env.pot + sum(p["stack"] for p in env.players)
    assert env._mask_for(seat)[module.CALL] == 1
    terminated, _, _ = env._apply_action(seat, module.CALL)
    paid = min(stack, 6)
    assert not terminated
    assert player["stack"] == stack - paid
    assert player["bet"] == 2 + paid
    assert player["all_in"] == (stack <= 6)
    assert env.pot == 20 + paid
    assert env.current_bet == 8
    assert env.raise_count == 0
    assert seat not in env.bet_queue
    assert env.pot + sum(p["stack"] for p in env.players) == total_before


def test_zero_stack_cannot_call(game):
    env, module, seat = game
    env.players[seat]["stack"] = 0
    assert env._mask_for(seat)[module.CALL] == 0
