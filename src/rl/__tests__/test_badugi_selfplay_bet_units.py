"""Both self-play actors use the same 2/2/4/4 triple-draw limit schedule."""
from types import SimpleNamespace
import pytest
from rl.env.badugi_env_selfplay import DualAgentBadugiEnv


@pytest.mark.parametrize('round_index,unit', [(0, 2), (1, 2), (2, 4), (3, 4)])
@pytest.mark.parametrize('actor', ['hero', 'opponent'])
@pytest.mark.parametrize('action', [3, 4])
def test_posted_bet_or_raise_uses_actual_street_unit(round_index, unit, actor, action):
    env = DualAgentBadugiEnv(seed=204)
    env.phase = 'BET'
    env.draw_round = round_index
    env.raise_count = 0
    env.hero_stack = env.opp_stack = 100
    env.hero_bet = env.opp_bet = 0
    env.pot = 20
    env.current_bet = 10 if action == 4 else 0
    to_call = env.current_bet
    before = env.hero_stack + env.opp_stack + env.pot
    if actor == 'hero':
        env._apply_hero_bet(action)
        posted, remaining = env.hero_bet, env.hero_stack
    else:
        env.opp_agent = SimpleNamespace(act=lambda *_args, **_kwargs: action)
        env._opp_bet_response()
        posted, remaining = env.opp_bet, env.opp_stack
    assert posted == to_call + unit
    assert remaining == 100 - posted
    assert env.current_bet == posted
    assert env.pot == 20 + posted
    assert env.hero_stack + env.opp_stack + env.pot == before
