"""Versioned lowball encoder parity; no deployed model/encoder replacement."""
import copy
import json
from pathlib import Path
import random
import subprocess

import numpy as np
import pytest
from rl.env.draw_lowball_env_sixmax_selfplay import SixMaxDrawLowballEnv

ROOT = Path(__file__).resolve().parents[3]
SCHEMA = 'draw-sixmax-selfplay-20261024-v1'


def snapshot(env, seat):
    players = []
    for index, p in enumerate(env.players):
        row = dict(stack=p['stack'], bet=p['bet'], folded=p['folded'],
                   lastDraw=p['last_draw'], totalDraws=p['total_draws'],
                   drawHistory=p['draw_history'], betHistory=p['bet_history'],
                   openedCurrentRound=p['opened_current_round'])
        if index == seat:
            row.update(hand=p['hand'], discarded=p['discarded'], raisedPredraw=p['raised_predraw'])
        players.append(row)
    return copy.deepcopy(dict(schemaVersion=SCHEMA, players=players, seat=seat,
                dealerSeat=env.dealer_seat, family=env.family, phase=env.phase,
                drawRound=env.draw_round, maxDraws=env.max_draws, pot=env.pot,
                currentBet=env.current_bet, raiseCount=env.raise_count,
                playersYetToAct=env._players_yet_to_act(seat), actionMask=env._mask_for(seat).tolist()))


def encode(rows):
    script = """
import { buildDrawSixMaxObservation } from './src/rl/drawSixMaxObservation.js';
let data='';for await(const chunk of process.stdin)data+=chunk;
process.stdout.write(JSON.stringify(JSON.parse(data).map(input=>{
 try{return {vector:buildDrawSixMaxObservation(input)}}catch(error){return {error:error.message}}
})));
"""
    result = subprocess.run(['node', '--input-type=module', '-e', script], input=json.dumps(rows),
                            text=True, capture_output=True, cwd=ROOT, check=True)
    return json.loads(result.stdout)


@pytest.mark.parametrize('family', ['low-27', 'low-a5'])
@pytest.mark.parametrize('draws', [1, 3])
def test_every_slot_matches_during_natural_hands(family, draws):
    env = SixMaxDrawLowballEnv(family=family, max_draws=draws)
    rng = random.Random(184)
    fixtures, expected, phases, rounds = [], [], set(), set()
    for seed in range(184, 208):
        env.reset(seed=seed)
        for _ in range(100):
            for seat in range(6):
                fixtures.append(snapshot(env, seat)); expected.append(env._obs_for(seat))
            phases.add(env.phase); rounds.add(env.draw_round)
            mask = env.legal_action_mask(); choices = [i for i, v in enumerate(mask) if v]
            action = (2 if mask[2] else 1 if mask[1] else choices[0]) if env.phase == 'BET' else rng.choice(choices)
            _, _, done, truncated, _ = env.step(action)
            if done or truncated:
                break
        else:
            pytest.fail('Natural hand did not terminate')
    assert phases == {'BET', 'DRAW'} and rounds == set(range(draws + 1))
    actual = encode(fixtures)
    assert len(actual) == len(expected)
    for index, (result, target) in enumerate(zip(actual, expected)):
        assert 'error' not in result, (index, result)
        np.testing.assert_allclose(result['vector'], target, rtol=0, atol=1e-6, err_msg=f'{family}/{draws} fixture {index}')


def test_hidden_cards_never_change_observation():
    env = SixMaxDrawLowballEnv(family='low-27'); env.reset(seed=184)
    a = snapshot(env, env.hero_seat); b = copy.deepcopy(a)
    b['deck'] = [[14, 3]] * 52; b['futureActions'] = ['raise'] * 10
    for i, p in enumerate(b['players']):
        if i != b['seat']:
            p.update(hand=[[2, 0]] * 5, discarded=[[14, 1]] * 20)
    actual = encode([a, b]); assert 'vector' in actual[0]; assert actual[0] == actual[1]


def test_missing_contract_history_and_bad_cards_fail_closed():
    env = SixMaxDrawLowballEnv(family='low-a5'); env.reset(seed=184)
    baseline = snapshot(env, env.hero_seat); rows = []
    for key in ['schemaVersion', 'family', 'maxDraws', 'playersYetToAct', 'actionMask']:
        row = copy.deepcopy(baseline); row.pop(key); rows.append(row)
    for key in ['drawHistory', 'betHistory', 'totalDraws']:
        row = copy.deepcopy(baseline); row['players'][1].pop(key); rows.append(row)
    row = copy.deepcopy(baseline); row['players'][row['seat']]['hand'][0] = [1, 0]; rows.append(row)
    assert all('error' in result for result in encode(rows))


@pytest.mark.parametrize('family', ['low-27', 'low-a5'])
def test_pair_groups_straights_flushes_aces_and_pressure(family):
    hands = [
        [(14, 0), (2, 1), (3, 2), (4, 3), (5, 0)],
        [(7, 0), (5, 0), (4, 0), (3, 0), (2, 0)],
        [(6, 0), (5, 1), (4, 2), (3, 3), (2, 0)],
        [(13, 0), (13, 1), (8, 2), (5, 3), (2, 0)],
        [(9, 0), (9, 1), (9, 2), (3, 3), (3, 0)],
        [(8, 0), (8, 1), (8, 2), (8, 3), (2, 0)],
        [(10, 0), (11, 1), (12, 2), (13, 3), (14, 0)],
    ]
    fixtures, expected = [], []
    for hand in hands:
        for seat in range(6):
            env = SixMaxDrawLowballEnv(family=family); env.reset(seed=184)
            env.phase = 'BET'; env.draw_round = 3; env.pot = 500; env.current_bet = 20; env.raise_count = 4
            for i, p in enumerate(env.players):
                p['stack'] = 0 if i == seat else 300; p['bet'] = i
                p['folded'] = i % 2 == 0 and i != seat
                p['last_draw'] = i % 6; p['total_draws'] = i * 3
                p['draw_history'] = [i % 6, (i + 1) % 6, (i + 2) % 6]
                p['opened_current_round'] = i % 2 == 1
                p['bet_history'] = [True, False, True]
            actor = env.players[seat]; actor['hand'] = hand
            actor['discarded'] = [(14, 2), (2, 3), (4, 1)]
            fixtures.append(snapshot(env, seat)); expected.append(env._obs_for(seat))
    for index, (actual, target) in enumerate(zip(encode(fixtures), expected)):
        assert 'error' not in actual, (index, actual)
        np.testing.assert_allclose(actual['vector'], target, rtol=0, atol=1e-6, err_msg=f'{family} edge {index}')
