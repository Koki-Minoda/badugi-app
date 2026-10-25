"""Drawing never posts a fictitious opening bet in the next street."""
import pytest

from rl.env.badugi_env_sixmax_selfplay import SixMaxBadugiEnv, CHECK, CALL, BET
from rl.env.badugi_env_selfplay import DualAgentBadugiEnv
from rl.env.draw_lowball_env_sixmax_selfplay import SixMaxDrawLowballEnv


VARIANTS = [('badugi', 3), ('low-27', 3), ('low-a5', 3), ('low-27', 1), ('low-a5', 1)]
CASES = [(family, draws, round_index) for family, draws in VARIANTS for round_index in range(draws)]


@pytest.mark.parametrize('family,draws,round_index', CASES)
def test_postdraw_first_actor_checks_or_opens_only_actual_chips(family, draws, round_index):
    env = SixMaxBadugiEnv(seed=203) if family == 'badugi' else SixMaxDrawLowballEnv(family=family, max_draws=draws, seed=203)
    env.hero_seat = (env.dealer_seat + 1) % 6
    env.phase = 'DRAW'
    env.draw_round = round_index
    env.current_bet = 2
    env.pot = 12
    for player in env.players:
        player.update(stack=98, bet=2, folded=False, all_in=False)
    stacks = [p['stack'] for p in env.players]
    env._end_draw_round()
    assert env.phase == 'BET'
    assert env.draw_round == round_index + 1
    assert env.current_bet == 0
    assert env.pot == 12
    assert [p['stack'] for p in env.players] == stacks
    assert all(p['bet'] == 0 for p in env.players)
    assert env.bet_queue[0] == env.hero_seat
    mask = env.legal_action_mask()
    assert mask[CHECK] == mask[BET] == 1
    assert mask[CALL] == 0
    env._apply_action(env.hero_seat, CHECK)
    assert env.current_bet == 0 and env.pot == 12
    next_seat = env.bet_queue[0]
    assert env._mask_for(next_seat)[CHECK] == 1
    env._apply_action(next_seat, BET)
    posted = env.players[next_seat]['bet']
    assert posted > 0
    assert env.current_bet == posted
    assert env.pot == 12 + posted
    assert env._mask_for(env.hero_seat)[CALL] == 1
    assert env._mask_for(env.hero_seat)[CHECK] == 0
    assert sum(p['stack'] for p in env.players) + env.pot == sum(stacks) + 12


@pytest.mark.parametrize('round_index', range(3))
def test_heads_up_selfplay_draw_starts_unopened(round_index):
    env = DualAgentBadugiEnv(seed=203)
    env.phase = 'DRAW'
    env.draw_round = round_index
    env.current_bet = 4
    env.hero_bet = env.opp_bet = 4
    pot = env.pot
    stacks = env.hero_stack, env.opp_stack
    _, _, done, _, _ = env.step(0)
    assert not done and env.phase == 'BET'
    assert env.current_bet == env.hero_bet == env.opp_bet == 0
    assert env.pot == pot
    assert (env.hero_stack, env.opp_stack) == stacks
    mask = env.legal_action_mask()
    assert mask[CHECK] == mask[BET] == 1
    assert mask[CALL] == 0
