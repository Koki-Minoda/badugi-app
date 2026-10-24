from collections import deque

import pytest

from rl.env import badugi_env_sixmax_selfplay as game


@pytest.fixture
def env():
    state = game.SixMaxBadugiEnv(seed=206)
    state.reset(seed=206)
    state.phase = 'BET'
    state.draw_round = 1
    state.current_bet = 0
    state.pot = 10
    for player in state.players:
        player.update(stack=20, bet=0, folded=False, all_in=False)
    return state


@pytest.mark.parametrize('action', [game.BET, game.RAISE])
def test_exact_stack_aggression_marks_allin_and_conserves_chips(env, action):
    seat = env.hero_seat
    env.current_bet = 2 if action == game.RAISE else 0
    env.players[seat]['stack'] = env.current_bet + game.SMALL_BET
    env.bet_queue = deque([seat])
    total = env.pot + sum(p['stack'] for p in env.players)
    assert env._mask_for(seat)[action] == 1
    env._apply_action(seat, action)
    assert env.players[seat]['stack'] == 0
    assert env.players[seat]['all_in']
    assert env.pot + sum(p['stack'] for p in env.players) == total


@pytest.mark.parametrize('reopened', [False, True])
def test_betting_queue_skips_allin_but_keeps_showdown_and_draw_eligibility(env, reopened):
    hero = env.hero_seat
    allin = (hero + 1) % 6
    folded = (hero + 2) % 6
    env.players[allin].update(stack=0, all_in=True)
    env.players[folded]['folded'] = True
    if reopened:
        env._on_raise(hero)
        expected = [(hero + i) % 6 for i in range(1, 6) if (hero+i)%6 not in [allin, folded]]
    else:
        env._setup_bet_queue(hero)
        expected = [(hero + i) % 6 for i in range(6) if (hero+i)%6 not in [allin, folded]]
    assert list(env.bet_queue) == expected
    assert allin in env._active_seats_list()
    env.phase = 'DRAW'
    assert list(env._mask_for(allin)[:4]) == [1, 1, 1, 1]
    old_hand = list(env.players[allin]['hand'])
    env._apply_draw(allin, 1)
    assert len(env.players[allin]['hand']) == 4
    assert env.players[allin]['hand'] != old_hand


def test_stale_allin_entry_is_not_asked_to_bet(env, monkeypatch):
    hero = env.hero_seat
    allin = (hero + 1) % 6
    env.players[allin].update(stack=0, all_in=True)
    env.bet_queue = deque([allin, hero])
    def unexpected(seat):
        pytest.fail(f'all-in seat {seat} asked to bet')
    monkeypatch.setattr(env, '_get_opp_action_bet', unexpected)
    env._autoplay_until_hero()
    assert list(env.bet_queue) == [hero]


def test_allin_hand_still_draws_three_times_and_returns_terminal_reward(env, monkeypatch):
    hero = env.hero_seat
    for player in env.players:
        player.update(stack=0, all_in=True)
    env.phase = 'DRAW'
    env.draw_round = 0
    env.draw_order = deque((hero + i) % 6 for i in range(6))
    monkeypatch.setattr(env, '_get_opp_draw_count', lambda seat: 0)
    monkeypatch.setattr(env, '_draw_decision_shaping_reward', lambda *args, **kwargs: 0)
    for index in range(3):
        _, reward, done, truncated, info = env.step(0)
        assert not truncated
        assert not info.get('illegal')
        if index < 2:
            assert not done
            assert env.phase == 'DRAW'
        else:
            assert done
            assert info['terminal_reason'] == 'showdown'
            assert reward == env._showdown()
