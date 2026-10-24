"""Same-state 96-slot comparison, without replacing the deployed encoder."""
import copy
import json
from pathlib import Path
import random
import subprocess

import numpy as np
import pytest
from rl.env.badugi_env_sixmax_selfplay import SixMaxBadugiEnv

ROOT = Path(__file__).resolve().parents[3]
SCHEMA = 'badugi-sixmax-selfplay-20261024-v1'


def snapshot(env, seat):
    players = []
    for index, p in enumerate(env.players):
        row = dict(stack=p['stack'], bet=p['bet'], folded=p['folded'],
                   lastDraw=p['last_draw'], drawHistory=p['draw_history'],
                   openedCurrentRound=p['opened_current_round'])
        if index == seat:
            row.update(hand=p['hand'], discarded=p['discarded'], betHistory=p['bet_history'])
        players.append(row)
    return dict(schemaVersion=SCHEMA, players=players, seat=seat,
                dealerSeat=env.dealer_seat, phase=env.phase, drawRound=env.draw_round,
                pot=env.pot, currentBet=env.current_bet, raiseCount=env.raise_count,
                firstToAct=env._is_first_to_act(seat), actionMask=env._mask_for(seat).tolist())


def encode(rows):
    script = """
import { buildBadugiSixMaxObservation } from './src/rl/badugiSixMaxObservation.js';
let data='';for await(const chunk of process.stdin)data+=chunk;
process.stdout.write(JSON.stringify(JSON.parse(data).map(input=>{
 try{return {vector:buildBadugiSixMaxObservation(input)}}catch(error){return {error:error.message}}
})));
"""
    result = subprocess.run(['node', '--input-type=module', '-e', script], input=json.dumps(rows),
                            text=True, capture_output=True, cwd=ROOT, check=True)
    return json.loads(result.stdout)


def test_every_slot_matches_python_through_natural_hands():
    fixtures, expected, phases, rounds, seats = [], [], set(), set(), set()
    rng = random.Random(186)
    env = SixMaxBadugiEnv()
    for seed in range(186, 222):
        env.reset(seed=seed)
        for _ in range(100):
            for seat in range(6):
                fixtures.append(copy.deepcopy(snapshot(env, seat)))
                expected.append(env._obs_for(seat))
                phases.add(env.phase); rounds.add(env.draw_round); seats.add(seat)
            mask = env.legal_action_mask()
            choices = [i for i, allowed in enumerate(mask) if allowed]
            # Continue often enough to visit every draw and the final bet.
            action = (2 if mask[2] else 1 if mask[1] else choices[0]) if env.phase == 'BET' else rng.choice(choices)
            _, _, done, truncated, _ = env.step(action)
            if done or truncated:
                break
        else:
            pytest.fail('Natural hand did not terminate')
    assert phases == {'BET', 'DRAW'} and rounds == {0, 1, 2, 3} and seats == set(range(6))
    actual = encode(fixtures)
    assert len(actual) == len(expected)
    for index, (result, target) in enumerate(zip(actual, expected)):
        assert 'error' not in result, (index, result)
        np.testing.assert_allclose(result['vector'], target, rtol=0, atol=1e-6, err_msg=f'fixture {index}')


def test_opponent_private_cards_and_deck_cannot_change_observation():
    env = SixMaxBadugiEnv(); env.reset(seed=186)
    a = snapshot(env, env.hero_seat); b = copy.deepcopy(a)
    b['deck'] = [[12, 3]] * 52
    b['futureActions'] = ['raise'] * 10
    for i, player in enumerate(b['players']):
        if i != b['seat']:
            player.update(hand=[[0, 0]] * 4, discarded=[[0, 1]] * 20)
    actual = encode([a, b])
    assert 'vector' in actual[0]
    assert actual[0] == actual[1]


def test_rejects_missing_contract_public_history_or_invalid_cards():
    env = SixMaxBadugiEnv(); env.reset(seed=186)
    baseline = snapshot(env, env.hero_seat)
    rows = []
    for key in ['schemaVersion', 'firstToAct', 'actionMask']:
        row = copy.deepcopy(baseline); row.pop(key); rows.append(row)
    for key in ['drawHistory', 'openedCurrentRound', 'stack']:
        row = copy.deepcopy(baseline); row['players'][1].pop(key); rows.append(row)
    row = copy.deepcopy(baseline); row['players'][row['seat']]['hand'][0] = [13, 0]; rows.append(row)
    row = copy.deepcopy(baseline); row['players'][row['seat']].pop('discarded'); rows.append(row)
    assert all('error' in result for result in encode(rows))


def test_extreme_hands_positions_allin_and_history_slots():
    cases, expected = [], []
    hands = [
        [(0, 0), (1, 1), (2, 2), (3, 3)],
        [(0, 0), (0, 1), (1, 0), (2, 2)],
        [(9, 0), (10, 1), (11, 2), (12, 3)],
        [(0, 0), (1, 0), (2, 0), (3, 0)],
    ]
    for hand in hands:
        for seat in range(6):
            for round_index in range(4):
                for phase in ['BET', 'DRAW']:
                    env = SixMaxBadugiEnv(); env.reset(seed=186)
                    env.phase = phase; env.draw_round = round_index
                    env.current_bet = 20 if round_index % 2 else 0
                    env.raise_count = 4; env.pot = 500 if round_index % 2 else 8
                    for i, p in enumerate(env.players):
                        p['stack'] = 0 if i == seat else 300
                        p['bet'] = i; p['folded'] = i % 2 == 0 and i != seat
                        p['last_draw'] = i % 4
                        p['draw_history'] = [i % 4, (i + 1) % 4, (i + 2) % 4]
                        p['opened_current_round'] = i % 2 == 1
                    actor = env.players[seat]
                    actor['hand'] = hand
                    actor['discarded'] = [(0, 3), (1, 2), (2, 1)]
                    actor['bet_history'] = [True, False, True]
                    cases.append(copy.deepcopy(snapshot(env, seat)))
                    expected.append(env._obs_for(seat))
    for i, (actual, target) in enumerate(zip(encode(cases), expected)):
        assert 'error' not in actual, (i, actual)
        np.testing.assert_allclose(actual['vector'], target, rtol=0, atol=1e-6, err_msg=f'edge {i}')
