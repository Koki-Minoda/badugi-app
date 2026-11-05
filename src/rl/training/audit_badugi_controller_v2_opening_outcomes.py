"""Exploratory one-hand outcome audit by real-controller opening range.

Every row is a fresh independent session/hand. This is a diagnostic of the
opening policy, not a 20-hand product EV evaluation or a training command.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

from rl.training.audit_badugi_controller_v2_opening_range import ACTIONS, PROFILES, classify
from rl.training.train_badugi_controller_v2_draft import ControllerBridge, run_hand
from rl.training.validate_badugi_controller_v2_draft import GROUPS, OnnxAgent


class OpeningCaptureAgent:
    def __init__(self, model: OnnxAgent):
        self.model = model
        self.opening = None

    def act(self, obs, epsilon, action_mask):
        action = self.model.act(obs, epsilon, action_mask)
        if self.opening is None and obs[8] == 0 and obs[9] == 0:
            shape = classify(obs.tolist())
            self.opening = {**shape, 'relativePosition': float(obs[12]),
                            'toCallBb': float(obs[18] * 20),
                            'raiseCount': round(float(obs[20] * 4)),
                            'stackBb': float(obs[14] * 200),
                            'action': ACTIONS[action]}
        return action


def run(hands: int, seed_base: int, model_path: Path, output: Path) -> dict:
    if hands < 40 or hands > 5000 or seed_base < 0 or seed_base + hands >= 2**32:
        raise ValueError('audit requires 40–5000 hands and unique 32-bit seeds')
    if output.exists():
        raise ValueError('output already exists')
    model = OnnxAgent(model_path)
    rows = []
    bridge = ControllerBridge()
    try:
        for index in range(hands):
            group_index = index % len(GROUPS)
            profile_index = (index // len(GROUPS)) % len(PROFILES)
            seats, occupied, tournament = GROUPS[group_index]
            profile = PROFILES[profile_index]
            seed = seed_base + index
            rng = random.Random(seed + 997)
            response = bridge.send({'command': 'reset', 'seatCount': seats,
                                    'occupiedSeatCount': occupied,
                                    'isTournament': tournament, 'seed': seed})
            if response['type'] != 'decision':
                raise ValueError('fresh controller session did not enter a decision')
            hero = (index // (len(GROUPS) * len(PROFILES))) % occupied
            agent = OpeningCaptureAgent(model)
            result = run_hand(bridge, response, agent, rng, hero, profile,
                              0.0, seats, occupied, tournament)
            delta = result['chipDeltaBySeat']
            if sum(delta) != 0:
                raise ValueError('controller hand did not conserve chips')
            rows.append({'seed': seed,
                         'group': f'{seats}/{occupied}-{("mtt" if tournament else "cash")}',
                         'profile': profile, 'heroSeat': hero,
                         'chipBb': delta[hero] / response['activeBigBlind'],
                         'heroDecisions': result['heroDecisions'],
                         'opening': agent.opening})
    finally:
        bridge.close()
    output.mkdir(parents=True)
    (output / 'hands.jsonl').write_text(''.join(json.dumps(row, separators=(',', ':')) + '\n' for row in rows))
    cells = defaultdict(list)
    for row in rows:
        opening = row['opening']
        key = (row['group'], row['profile'], opening['class'] if opening else 'no-opening')
        cells[key].append(row)
    summary = {'status': 'EXPLORATORY_FRESH_ONE_HAND_RANGE_OUTCOMES_NOT_PRODUCT_EV',
               'hands': len(rows), 'independentSessions': len(rows),
               'modelSha256': hashlib.sha256(model_path.read_bytes()).hexdigest(),
               'seedBase': seed_base, 'zeroSumHands': len(rows),
               'noOpeningHands': sum(row['opening'] is None for row in rows),
               'method': 'One fresh real-controller hand per seed; scripted opponents; diagnostic BB/hand by opening class; no continuous 20-hand stack trajectory',
               'cells': {}}
    for key, cell in sorted(cells.items()):
        summary['cells']['|'.join(key)] = {
            'n': len(cell), 'meanChipBb': sum(row['chipBb'] for row in cell) / len(cell),
            'actions': dict(Counter(row['opening']['action'] for row in cell if row['opening'])),
        }
    (output / 'summary.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False) + '\n')
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--hands', type=int, required=True)
    parser.add_argument('--seed-base', type=int, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = run(args.hands, args.seed_base, args.model, args.output)
    print(json.dumps({'status': result['status'], 'hands': result['hands'],
                      'noOpeningHands': result['noOpeningHands']}))
