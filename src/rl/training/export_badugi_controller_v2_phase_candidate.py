"""Export an isolated Pro BET + published Standard DRAW diagnostic as one ONNX.

The public phase slot (8) selects the branch. This never edits the registry or
public model assets, and parity is checked against both component ONNX files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch

MAX_ABS_TOLERANCE = 2e-5

if __package__:
    from .export_badugi_controller_v2_mode_ensemble import ModeEnsemble
    from .train_badugi_controller_v2_draft import DQNAgent, SCHEMA
else:
    from export_badugi_controller_v2_mode_ensemble import ModeEnsemble
    from train_badugi_controller_v2_draft import DQNAgent, SCHEMA


class PhaseEnsemble(torch.nn.Module):
    def __init__(self, bet, draw, fold_guardian=False):
        super().__init__()
        self.bet = bet
        self.draw = draw
        self.fold_guardian = fold_guardian

    def forward(self, observation):
        standard_scores = self.draw(observation)
        bet_scores = self.bet(observation)
        if self.fold_guardian:
            # The controller's legal mask is part of the frozen 96-input schema.
            # Preserve Standard only when its legal BET argmax is FOLD (index 0).
            legal_scores = torch.where(observation[:, 32:38] >= 0.5,
                                       standard_scores, torch.full_like(standard_scores, -1e9))
            standard_folds = torch.argmax(legal_scores, dim=1, keepdim=True) == 0
            bet_scores = torch.where(standard_folds, standard_scores, bet_scores)
        return torch.where(observation[:, 8:9] >= 0.5, standard_scores, bet_scores)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_checkpoint(path, tier):
    agent = DQNAgent.load(str(path), device='cpu')
    if (agent.obs_dim != 96 or agent.n_actions != 6 or
            agent.checkpoint_training_state.get('schemaVersion') != SCHEMA or
            agent.checkpoint_training_state.get('tier') != tier):
        raise ValueError(f'{tier} checkpoint contract mismatch')
    return agent.q_network.eval()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bet-checkpoint', type=Path, required=True)
    parser.add_argument('--cash-checkpoint', type=Path, required=True)
    parser.add_argument('--mtt-checkpoint', type=Path, required=True)
    parser.add_argument('--heads-up-mtt-checkpoint', type=Path, required=True)
    parser.add_argument('--bet-reference-onnx', type=Path, required=True)
    parser.add_argument('--draw-reference-onnx', type=Path, required=True)
    parser.add_argument('--fold-guardian', action='store_true',
                        help='Retain published Standard BET only when its legal action is FOLD')
    parser.add_argument('--controller-rollouts', type=Path, required=True)
    parser.add_argument('--heldout-controller-rollouts', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('isolated output directory must not already exist')
    bet = load_checkpoint(args.bet_checkpoint, 'pro')
    draw = ModeEnsemble(load_checkpoint(args.cash_checkpoint, 'standard'),
                        load_checkpoint(args.mtt_checkpoint, 'standard'),
                        load_checkpoint(args.heads_up_mtt_checkpoint, 'beginner')).eval()
    combined = PhaseEnsemble(bet, draw, fold_guardian=args.fold_guardian).eval()
    args.output.mkdir(parents=True)
    path = args.output / 'candidate.onnx'
    torch.onnx.export(combined, torch.zeros(1, 96), str(path),
                      input_names=['observation'], output_names=['q_values'],
                      dynamic_axes={'observation': {0: 'batch'}, 'q_values': {0: 'batch'}},
                      opset_version=17, dynamo=False)
    combined_session = ort.InferenceSession(str(path), providers=['CPUExecutionProvider'])
    bet_session = ort.InferenceSession(str(args.bet_reference_onnx), providers=['CPUExecutionProvider'])
    draw_session = ort.InferenceSession(str(args.draw_reference_onnx), providers=['CPUExecutionProvider'])
    rng = np.random.default_rng(20261105)
    random_obs = rng.uniform(0, 1, size=(256, 96)).astype(np.float32)
    random_obs[:, 8] = np.tile(np.asarray([0, 1], dtype=np.float32), 128)
    random_obs[:, 21] = np.tile(np.asarray([0, 0, 1, 1], dtype=np.float32), 64)
    random_obs[:, 10] = np.tile(np.asarray([2 / 6, 3 / 6, 1.0, 2 / 6], dtype=np.float32), 64)
    random_obs[:, 32:38] = (rng.uniform(size=(256, 6)) > 0.5).astype(np.float32)
    random_obs[:, 32] = np.where(random_obs[:, 8] == 0, 1.0, random_obs[:, 32])
    random_obs[:, 33] = np.where(random_obs[:, 8] == 1, 1.0, random_obs[:, 33])
    rollout_batches = []
    for rollout_path in (args.controller_rollouts, args.heldout_controller_rollouts):
        rollouts = json.loads(rollout_path.read_text())
        decisions = [decision for session in rollouts['sessions'] for hand in session['hands']
                     for decision in hand['decisions']]
        rollout_batches.append((np.asarray([decision['observation'] for decision in decisions], dtype=np.float32),
                                np.asarray([decision['legalMask'] for decision in decisions], dtype=np.float32)))
    max_difference = 0.0
    action_mismatches = []
    for observations, masks in ((random_obs, None), *rollout_batches):
        actual = combined_session.run(['q_values'], {'observation': observations})[0]
        with torch.no_grad():
            expected_torch = combined(torch.from_numpy(observations)).numpy()
        bet_reference = bet_session.run(['q_values'], {'observation': observations})[0]
        draw_reference = draw_session.run(['q_values'], {'observation': observations})[0]
        if args.fold_guardian:
            legal = observations[:, 32:38] >= 0.5
            standard_folds = np.where(legal, draw_reference, -1e9).argmax(axis=1) == 0
            bet_reference = np.where(standard_folds[:, None], draw_reference, bet_reference)
        expected_reference = np.where(observations[:, 8:9] >= 0.5,
                                      draw_reference, bet_reference)
        if actual.shape != (len(observations), 6) or not np.all(np.isfinite(actual)):
            raise ValueError('phase candidate returned invalid ONNX scores')
        max_difference = max(max_difference,
                             float(np.max(np.abs(actual - expected_torch))),
                             float(np.max(np.abs(actual - expected_reference))))
        active_mask = observations[:, 32:38] if masks is None else masks
        if active_mask is not None:
            actual_actions = np.where(active_mask > 0, actual, -np.inf).argmax(axis=1)
            expected_actions = np.where(active_mask > 0, expected_reference, -np.inf).argmax(axis=1)
            action_mismatches.append(int(np.sum(actual_actions != expected_actions)))
    if max_difference > MAX_ABS_TOLERANCE or any(action_mismatches):
        raise ValueError(f'phase ONNX parity failed: maxAbs={max_difference}, actions={action_mismatches}')
    report = {'status': 'PARITY_PASS_NOT_STRENGTH', 'schemaVersion': SCHEMA,
              'phaseFlagSlot': 8, 'betCheckpointSha256': digest(args.bet_checkpoint),
              'foldGuardian': args.fold_guardian, 'legalMaskSlots': [32, 38],
              'cashCheckpointSha256': digest(args.cash_checkpoint),
              'mttCheckpointSha256': digest(args.mtt_checkpoint),
              'headsUpMttCheckpointSha256': digest(args.heads_up_mtt_checkpoint),
              'betReferenceOnnxSha256': digest(args.bet_reference_onnx),
              'drawReferenceOnnxSha256': digest(args.draw_reference_onnx),
              'controllerRolloutsSha256': digest(args.controller_rollouts),
              'heldoutControllerRolloutsSha256': digest(args.heldout_controller_rollouts),
              'onnxSha256': digest(path), 'inputShape': [1, 96],
              'outputShape': [1, 6], 'randomParitySamples': 256,
              'realControllerDecisions': [len(batch[0]) for batch in rollout_batches],
              'realLegalActionMismatches': action_mismatches,
              'maxAbsoluteDifference': max_difference,
              'maxAbsoluteTolerance': MAX_ABS_TOLERANCE,
              'toleranceNote': '2e-5 allows FP32 export rounding after 1.53e-5 was observed; strict zero legal-action mismatch is required on two independent controller rollout sets.',
              'published': False}
    (args.output / 'export-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
