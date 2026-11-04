"""Exploratory, unused-seed validation for an isolated D03 controller candidate.

This is not the preregistered final product evaluation. Each row is a fresh
controller session; all hands in a session share a stack trajectory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
from collections import Counter
from pathlib import Path

import numpy as np

from train_badugi_controller_v2_draft import (
    ControllerBridge, DQNAgent, PROFILES, SCHEMA, check_decision, contract_hash,
    opponent_action, observable_reference_action,
)

GROUPS = tuple((seats, occupied, tournament) for tournament in (False, True)
               for seats, occupied in ((2, 2), (3, 3), (6, 6), (6, 2), (6, 3)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=Path)
    parser.add_argument('--reference', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--sessions-per-profile', type=int, default=6)
    parser.add_argument('--hands-per-session', type=int, default=20)
    args = parser.parse_args()
    if args.output.exists() or not 1 <= args.sessions_per_profile <= 100 or not 1 <= args.hands_per_session <= 100:
        raise ValueError('new output directory and bounded session counts required')
    if args.reference == (args.model is not None):
        raise ValueError('choose exactly one of --model or --reference')
    agent = None if args.reference else DQNAgent.load(str(args.model), device='cpu')
    if agent and (agent.obs_dim != 96 or agent.n_actions != 6 or
                  agent.checkpoint_training_state.get('schemaVersion') != SCHEMA):
        raise ValueError('candidate observation/action contract mismatch')
    model_sha = 'observable-reference-v1' if args.reference else hashlib.sha256(args.model.read_bytes()).hexdigest()
    bridge = ControllerBridge()
    rows = []
    try:
        for group_index, (seats, occupied, tournament) in enumerate(GROUPS):
            for profile_index, profile in enumerate(PROFILES):
                for session_index in range(args.sessions_per_profile):
                    seed = 410040001 + group_index * 1_000_000 + profile_index * 10_000 + session_index
                    rng = random.Random(seed + 997)
                    response = bridge.send({'command': 'reset', 'seatCount': seats,
                                            'occupiedSeatCount': occupied,
                                            'isTournament': tournament, 'seed': seed})
                    hero = session_index % occupied
                    chips = 0
                    hands = 0
                    actions = Counter()
                    zero_sum = True
                    no_decision_hands = 0
                    for hand_index in range(args.hands_per_session):
                        if hand_index:
                            response = bridge.send({'command': 'next_hand'})
                        if response['type'] == 'hand_end' and response['decisionCount'] == 0:
                            break
                        if response['type'] != 'decision':
                            raise ValueError('session did not enter a controller decision')
                        active_bb = response['activeBigBlind']
                        hero_decisions = 0
                        while response['type'] == 'decision':
                            check_decision(response, seats, occupied, tournament)
                            if response['seat'] == hero:
                                action = (observable_reference_action(response) if args.reference else
                                          agent.act(np.asarray(response['observation'], dtype=np.float32),
                                                    epsilon=0.0,
                                                    action_mask=np.asarray(response['legalMask'], dtype=np.float32)))
                                actions[f"{response['phase']}:{action}"] += 1
                                hero_decisions += 1
                            else:
                                action = opponent_action(response, profile, rng)
                            if response['legalMask'][action] != 1:
                                raise ValueError('illegal selected action')
                            response = bridge.send({'command': 'step', 'actionIndex': action})
                        if response['type'] != 'hand_end':
                            raise ValueError('controller hand did not terminate')
                        zero_sum &= sum(response['chipDeltaBySeat']) == 0
                        chips += response['chipDeltaBySeat'][hero]
                        hands += 1
                        no_decision_hands += hero_decisions == 0
                    rows.append({'group': f'{seats}/{occupied}-{("mtt" if tournament else "cash")}',
                                 'seatCount': seats, 'occupiedSeatCount': occupied,
                                 'isTournament': tournament, 'profile': profile,
                                 'seed': seed, 'heroSeat': hero,
                                 'hands': hands, 'chipDelta': chips,
                                 'chipPerHand': chips / hands if hands else None,
                                 'noHeroDecisionHands': no_decision_hands,
                                 'zeroSum': zero_sum, 'heroActions': dict(actions)})
    finally:
        bridge.close()
    args.output.mkdir(parents=True)
    (args.output / 'sessions.jsonl').write_text(''.join(json.dumps(row, separators=(',', ':')) + '\n' for row in rows))
    summary = {'status': 'EXPLORATORY_VALIDATION_ONLY', 'modelSha256': model_sha,
               'contractSha256': contract_hash(), 'candidatePath': str(args.model) if args.model else None,
               'seedBase': 410040001, 'sessions': len(rows),
               'hands': sum(row['hands'] for row in rows),
               'zeroSumSessions': sum(row['zeroSum'] for row in rows),
               'sessionsPerProfileGroup': args.sessions_per_profile,
               'handsPerSessionMax': args.hands_per_session,
               'opponentProfiles': PROFILES, 'groups': [row['group'] for row in rows[::args.sessions_per_profile * len(PROFILES)]]}
    (args.output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
