"""Isolated D03 controller evaluation; frozen only with a matching manifest.

Each row is a fresh controller session. Hands within it share a stack trajectory.
An exploratory run cannot be re-labelled as a frozen evaluation afterward.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import subprocess
import time
from collections import Counter
from pathlib import Path

import numpy as np
import onnxruntime as ort

if __package__:
    from .train_badugi_controller_v2_draft import (
        ControllerBridge, DQNAgent, PROFILES, SCHEMA, check_decision, contract_hash,
        opponent_action, observable_reference_action,
    )
else:
    from train_badugi_controller_v2_draft import (
        ControllerBridge, DQNAgent, PROFILES, SCHEMA, check_decision, contract_hash,
        opponent_action, observable_reference_action,
    )

GROUPS = tuple((seats, occupied, tournament) for tournament in (False, True)
               for seats, occupied in ((2, 2), (3, 3), (6, 6), (6, 2), (6, 3)))
GROUP_NAMES = [f'{seats}/{occupied}-{("mtt" if tournament else "cash")}'
               for seats, occupied, tournament in GROUPS]
REFERENCE_POLICY_ID = 'observable-reference-v1'


class OnnxAgent:
    """Use the same six Q values and legal mask as the browser adapter."""

    def __init__(self, path):
        self.session = ort.InferenceSession(str(path), providers=['CPUExecutionProvider'])
        inputs, outputs = self.session.get_inputs(), self.session.get_outputs()
        if (len(inputs) != 1 or len(outputs) != 1 or
                inputs[0].name != 'observation' or outputs[0].name != 'q_values' or
                inputs[0].shape[-1] != 96 or outputs[0].shape[-1] != 6):
            raise ValueError('ONNX candidate observation/action contract mismatch')

    def act(self, obs, epsilon, action_mask):
        if epsilon != 0.0:
            raise ValueError('controller validation requires greedy ONNX inference')
        q_values = self.session.run(['q_values'], {'observation': obs[None, :]})[0][0]
        if q_values.shape != (6,) or not np.all(np.isfinite(q_values)):
            raise ValueError('ONNX candidate returned invalid Q values')
        allowed = np.flatnonzero(np.asarray(action_mask) > 0)
        if not len(allowed):
            raise ValueError('controller validation requires legal ONNX actions')
        return int(allowed[np.argmax(q_values[allowed])])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=Path)
    parser.add_argument('--onnx-model', type=Path)
    parser.add_argument('--reference', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--sessions-per-profile', type=int, default=6)
    parser.add_argument('--hands-per-session', type=int, default=20)
    parser.add_argument('--seed-base', type=int, default=410040001)
    parser.add_argument('--evaluation-manifest', type=Path)
    args = parser.parse_args()
    if args.output.exists() or not 1 <= args.sessions_per_profile <= 250 or not 1 <= args.hands_per_session <= 100:
        raise ValueError('new output directory and bounded session counts required')
    if args.sessions_per_profile > 100 and not args.evaluation_manifest:
        raise ValueError('large controller evaluations require a frozen manifest')
    if sum((args.reference, args.model is not None, args.onnx_model is not None)) != 1:
        raise ValueError('choose exactly one of --model, --onnx-model or --reference')
    agent = (None if args.reference else
             OnnxAgent(args.onnx_model) if args.onnx_model else
             DQNAgent.load(str(args.model), device='cpu'))
    if args.model and (agent.obs_dim != 96 or agent.n_actions != 6 or
                  agent.checkpoint_training_state.get('schemaVersion') != SCHEMA):
        raise ValueError('candidate observation/action contract mismatch')
    candidate_path = args.model or args.onnx_model
    model_sha = REFERENCE_POLICY_ID if args.reference else hashlib.sha256(candidate_path.read_bytes()).hexdigest()
    code_sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    manifest_sha = None
    if args.evaluation_manifest:
        manifest_bytes = args.evaluation_manifest.read_bytes()
        manifest = json.loads(manifest_bytes)
        manifest_sha = hashlib.sha256(manifest_bytes).hexdigest()
        if (manifest.get('status') != 'FROZEN' or
                manifest.get('codeGitSha') != code_sha or
                manifest.get('contractSha256') != contract_hash() or
                (manifest.get('referencePolicyId') if args.reference else
                 manifest.get('modelSha256')) != model_sha or
                manifest.get('seedBase') != args.seed_base or
                manifest.get('sessionsPerProfileGroup') != args.sessions_per_profile or
                manifest.get('handsPerSessionMax') != args.hands_per_session or
                manifest.get('groupMatrix') != GROUP_NAMES or
                manifest.get('opponentProfiles') != list(PROFILES)):
            raise ValueError('evaluation arguments differ from frozen manifest')
    bridge = ControllerBridge()
    rows = []
    hand_rows = []
    try:
        for group_index, (seats, occupied, tournament) in enumerate(GROUPS):
            for profile_index, profile in enumerate(PROFILES):
                for session_index in range(args.sessions_per_profile):
                    seed = args.seed_base + group_index * 1_000_000 + profile_index * 10_000 + session_index
                    rng = random.Random(seed + 997)
                    response = bridge.send({'command': 'reset', 'seatCount': seats,
                                            'occupiedSeatCount': occupied,
                                            'isTournament': tournament, 'seed': seed})
                    hero = session_index % occupied
                    chips = 0
                    chip_bb = 0.0
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
                        decision_trace = []
                        while response['type'] == 'decision':
                            check_decision(response, seats, occupied, tournament)
                            start = time.perf_counter()
                            if response['seat'] == hero:
                                action = (observable_reference_action(response) if args.reference else
                                          agent.act(np.asarray(response['observation'], dtype=np.float32),
                                                    epsilon=0.0,
                                                    action_mask=np.asarray(response['legalMask'], dtype=np.float32)))
                                actions[f"{response['phase']}:{action}"] += 1
                                hero_decisions += 1
                            else:
                                action = opponent_action(response, profile, rng)
                            decision_trace.append({'seat': response['seat'],
                                                   'phase': response['phase'],
                                                   'actionIndex': action,
                                                   'legalMask': response['legalMask'],
                                                   'status': ('reference' if args.reference else 'used')
                                                   if response['seat'] == hero else 'opponent',
                                                   'elapsedMs': (time.perf_counter() - start) * 1000})
                            if response['legalMask'][action] != 1:
                                raise ValueError('illegal selected action')
                            response = bridge.send({'command': 'step', 'actionIndex': action})
                        if response['type'] != 'hand_end':
                            raise ValueError('controller hand did not terminate')
                        zero_sum &= sum(response['chipDeltaBySeat']) == 0
                        chips += response['chipDeltaBySeat'][hero]
                        chip_bb += response['chipDeltaBySeat'][hero] / active_bb
                        hands += 1
                        no_decision_hands += hero_decisions == 0
                        if len(decision_trace) != response['decisionCount'] or len(decision_trace) != len(response['publicActionTrace']):
                            raise ValueError('controller decision and public action trace length mismatch')
                        for public_action in response['publicActionTrace']:
                            if public_action['type'] == 'BET_ACTION':
                                if (public_action['action'] not in ('fold', 'check', 'call', 'bet', 'raise') or
                                        not 0 <= public_action['amount'] <= public_action['stackBefore']):
                                    raise ValueError('invalid public bet action or amount')
                            elif public_action['type'] == 'DRAW_ACTION':
                                if not 0 <= public_action['drawCount'] <= 4:
                                    raise ValueError('invalid public draw count')
                            else:
                                raise ValueError('unknown public action type')
                        hand_rows.append({'seed': seed, 'handIndex': hand_index,
                                          'group': f'{seats}/{occupied}-{("mtt" if tournament else "cash")}',
                                          'profile': profile, 'heroSeat': hero,
                                          'activeBigBlind': active_bb,
                                          'startingStacks': response['startingStacks'],
                                          'endingStacks': response['endingStacks'],
                                          'chipDeltaBySeat': response['chipDeltaBySeat'],
                                          'decisions': decision_trace,
                                          'publicActionTrace': response['publicActionTrace']})
                    rows.append({'group': f'{seats}/{occupied}-{("mtt" if tournament else "cash")}',
                                 'seatCount': seats, 'occupiedSeatCount': occupied,
                                 'isTournament': tournament, 'profile': profile,
                                 'seed': seed, 'heroSeat': hero,
                                 'hands': hands, 'chipDelta': chips,
                                 'chipPerHand': chips / hands if hands else None,
                                 'chipBbPerHand': chip_bb / hands if hands else None,
                                 'noHeroDecisionHands': no_decision_hands,
                                 'zeroSum': zero_sum, 'heroActions': dict(actions)})
    finally:
        bridge.close()
    args.output.mkdir(parents=True)
    (args.output / 'sessions.jsonl').write_text(''.join(json.dumps(row, separators=(',', ':')) + '\n' for row in rows))
    (args.output / 'hand-trace.jsonl').write_text(''.join(json.dumps(row, separators=(',', ':')) + '\n' for row in hand_rows))
    summary = {'status': 'FROZEN_EVALUATION' if manifest_sha else 'EXPLORATORY_VALIDATION_ONLY',
               'evaluationManifestSha256': manifest_sha, 'codeGitSha': code_sha,
               'modelSha256': model_sha,
               'contractSha256': contract_hash(),
               'candidatePath': str(candidate_path) if candidate_path else None,
               'modelKind': 'onnx' if args.onnx_model else 'pytorch' if args.model else 'reference',
               'seedBase': args.seed_base, 'sessions': len(rows),
               'hands': sum(row['hands'] for row in rows),
               'zeroSumSessions': sum(row['zeroSum'] for row in rows),
               'sessionsPerProfileGroup': args.sessions_per_profile,
               'handsPerSessionMax': args.hands_per_session,
               'opponentProfiles': PROFILES, 'groups': GROUP_NAMES}
    (args.output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
