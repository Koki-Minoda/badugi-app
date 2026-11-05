"""Exploratory same-state Badugi opening-range audit on the real controller.

This stops before the hero's first pre-draw BET action. It does not measure EV,
train a model, or relabel the observations as independent full-hand sessions.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

from rl.env.badugi_env import evaluate_badugi
from rl.training.train_badugi_controller_v2_draft import (
    ControllerBridge, check_decision, opponent_action, observable_reference_action,
)
from rl.training.validate_badugi_controller_v2_draft import GROUPS, OnnxAgent


PROFILES = ('passive', 'pressure', 'draw_heavy', 'random_legal')
ACTIONS = ('FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN')


def classify(obs: list[float]) -> dict:
    cards = [(round(obs[2 * i] * 12), round(obs[2 * i + 1] * 3)) for i in range(4)]
    if len(set(cards)) != 4:
        raise ValueError('observation does not contain four distinct cards')
    count, ranks = evaluate_badugi(cards)
    high = max(ranks) if ranks else 12
    if round(obs[24] * 4) != count or round(obs[25] * 12) != high:
        raise ValueError('controller range shape differs from independent card evaluation')
    return {
        'madeCards': count,
        'highRank': high,
        'rankSum': sum(ranks),
        'class': ('made-8-or-better' if high <= 8 else 'made-9-plus') if count == 4
                 else ('three-7-or-better' if high <= 6 else 'three-8-plus') if count == 3
                 else 'two-card' if count == 2 else 'one-card',
    }


def run(contexts: int, seed_base: int, standard_path: Path, candidate_path: Path,
        output: Path) -> dict:
    if contexts < 40 or contexts > 5000 or seed_base < 0 or seed_base + 10_000_000 >= 2**32:
        raise ValueError('audit requires 40–5000 contexts and unique 32-bit seeds')
    if output.exists():
        raise ValueError('output already exists')
    standard, candidate = OnnxAgent(standard_path), OnnxAgent(candidate_path)
    rows = []
    skipped = Counter()
    bridge = ControllerBridge()
    try:
        for index in range(contexts):
            group_index = index % len(GROUPS)
            profile_index = (index // len(GROUPS)) % len(PROFILES)
            seats, occupied, tournament = GROUPS[group_index]
            profile = PROFILES[profile_index]
            seed = seed_base + index
            rng = random.Random(seed + 997)
            response = bridge.send({'command': 'reset', 'seatCount': seats,
                                    'occupiedSeatCount': occupied,
                                    'isTournament': tournament, 'seed': seed})
            hero = (index // (len(GROUPS) * len(PROFILES))) % occupied
            while response['type'] == 'decision':
                check_decision(response, seats, occupied, tournament)
                if response['seat'] == hero and response['phase'] == 'BET' and response['drawRoundIndex'] == 0:
                    obs = response['observation']
                    mask = response['legalMask']
                    shape = classify(obs)
                    array = np.asarray(obs, dtype=np.float32)
                    legal = np.asarray(mask, dtype=np.float32)
                    standard_action = standard.act(array, 0.0, legal)
                    candidate_action = candidate.act(array, 0.0, legal)
                    teacher_action = observable_reference_action(response)
                    rows.append({
                        'seed': seed, 'group': f'{seats}/{occupied}-{("mtt" if tournament else "cash")}',
                        'profile': profile, 'heroSeat': hero,
                        'relativePosition': obs[12], 'toCallBb': obs[18] * 20,
                        'raiseCount': round(obs[20] * 4), 'stackBb': obs[14] * 200,
                        **shape, 'legalMask': mask,
                        'standardAction': ACTIONS[standard_action],
                        'candidateAction': ACTIONS[candidate_action],
                        'simpleTeacherAction': ACTIONS[teacher_action],
                    })
                    break
                response = bridge.send({'command': 'step',
                                        'actionIndex': opponent_action(response, profile, rng)})
            else:
                skipped['noHeroPredrawDecision'] += 1
    finally:
        bridge.close()
    output.mkdir(parents=True)
    (output / 'opening-contexts.jsonl').write_text(''.join(json.dumps(row, separators=(',', ':')) + '\n' for row in rows))
    summary = {'status': 'EXPLORATORY_SAME_STATE_RANGE_DIAGNOSTIC_NOT_EV',
               'attemptedContexts': contexts, 'recordedContexts': len(rows),
               'skipped': dict(skipped), 'seedBase': seed_base,
               'standardModelSha256': hashlib.sha256(standard_path.read_bytes()).hexdigest(),
               'candidateModelSha256': hashlib.sha256(candidate_path.read_bytes()).hexdigest(),
               'method': 'One fresh real-controller hand per seed; same public observation for both models; stop before hero action; no chip outcome',
               'cells': {}}
    cells = defaultdict(list)
    for row in rows:
        # An initial blind creates toCallBb>0 even without a voluntary raise.
        key = (row['group'], row['profile'], row['class'],
               'price-to-enter' if row['toCallBb'] > 0 else 'check-option')
        cells[key].append(row)
    for key, cell in sorted(cells.items()):
        summary['cells']['|'.join(key)] = {
            'n': len(cell),
            'standardActions': dict(Counter(row['standardAction'] for row in cell)),
            'candidateActions': dict(Counter(row['candidateAction'] for row in cell)),
            'simpleTeacherActions': dict(Counter(row['simpleTeacherAction'] for row in cell)),
            'actionChanges': sum(row['standardAction'] != row['candidateAction'] for row in cell),
        }
    (output / 'summary.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False) + '\n')
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--contexts', type=int, required=True)
    parser.add_argument('--seed-base', type=int, required=True)
    parser.add_argument('--standard-model', type=Path, required=True)
    parser.add_argument('--candidate-model', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = run(args.contexts, args.seed_base, args.standard_model,
                 args.candidate_model, args.output)
    print(json.dumps({'status': result['status'], 'attempted': result['attemptedContexts'],
                      'recorded': result['recordedContexts'], 'skipped': result['skipped']}))
