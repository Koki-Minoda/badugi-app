"""Export an isolated D03 candidate to ONNX and verify numeric parity."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch

if __package__:
    from .train_badugi_controller_v2_draft import DQNAgent, SCHEMA
else:
    from train_badugi_controller_v2_draft import DQNAgent, SCHEMA

MAX_ABS_TOLERANCE = 2e-5
DOUBLE_CORE_EQUIVALENCE_SAMPLES = 10_000


class DoubleCorePolicy(torch.nn.Module):
    """Compute with the same checkpoint weights in float64, retaining float32 I/O."""

    def __init__(self, network):
        super().__init__()
        self.network = copy.deepcopy(network).double().eval()

    def forward(self, observations):
        return self.network(observations.double()).float()


def check_parity(expected, actual):
    if actual.shape != expected.shape or not np.all(np.isfinite(actual)):
        raise ValueError(f'ONNX parity failed: shape={actual.shape}, non-finite or unexpected scores')
    max_abs = float(np.max(np.abs(expected - actual)))
    action_mismatches = int(np.count_nonzero(expected.argmax(axis=1) != actual.argmax(axis=1)))
    if max_abs > MAX_ABS_TOLERANCE or action_mismatches:
        raise ValueError(f'ONNX parity failed: shape={actual.shape}, maxAbs={max_abs}, '
                         f'actions={action_mismatches}')
    return max_abs, action_mismatches


def check_legal_action_equivalence(original, exported):
    """Compare every nonempty legal mask, including masks that omit the top action."""
    if original.shape != exported.shape or original.ndim != 2 or original.shape[1] != 6:
        raise ValueError('legal action parity requires equal [samples, 6] scores')
    mismatches = 0
    for bits in range(1, 1 << 6):
        mask = np.array([(bits >> action) & 1 for action in range(6)], dtype=bool)
        expected = np.where(mask, original, -np.inf).argmax(axis=1)
        actual = np.where(mask, exported, -np.inf).argmax(axis=1)
        mismatches += int(np.count_nonzero(expected != actual))
    if mismatches:
        raise ValueError(f'ONNX changed {mismatches} legal actions across all masks')
    return original.shape[0] * ((1 << 6) - 1), mismatches


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--double-core', action='store_true',
                        help='explicit float64 computation with float32 I/O and exhaustive legal-mask action parity')
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('isolated output directory already exists')
    agent = DQNAgent.load(str(args.checkpoint), device='cpu')
    if (agent.obs_dim != 96 or agent.n_actions != 6 or
            agent.checkpoint_training_state.get('schemaVersion') != SCHEMA):
        raise ValueError('candidate schema mismatch')
    args.output.mkdir(parents=True)
    path = args.output / 'candidate.onnx'
    agent.q_network.eval()
    model = DoubleCorePolicy(agent.q_network) if args.double_core else agent.q_network
    torch.onnx.export(model, torch.zeros(1, 96), str(path),
                      input_names=['observation'], output_names=['q_values'],
                      dynamic_axes={'observation': {0: 'batch'}, 'q_values': {0: 'batch'}},
                      opset_version=17, dynamo=False)
    session = ort.InferenceSession(str(path), providers=['CPUExecutionProvider'])
    rng = np.random.default_rng(20261104)
    sample_count = DOUBLE_CORE_EQUIVALENCE_SAMPLES if args.double_core else 128
    samples = rng.uniform(0, 1, size=(sample_count, 96)).astype(np.float32)
    with torch.no_grad():
        expected = model(torch.from_numpy(samples)).numpy()
        original = agent.q_network(torch.from_numpy(samples)).numpy()
    actual = session.run(['q_values'], {'observation': samples})[0]
    if expected.shape != (sample_count, 6):
        raise ValueError('candidate ONNX score shape mismatch')
    max_abs, action_mismatches = check_parity(expected, actual)
    legal_checks, legal_mismatches = (check_legal_action_equivalence(original, actual)
                                     if args.double_core else (None, None))
    report = {'status': 'PARITY_PASS_NOT_STRENGTH', 'schemaVersion': SCHEMA,
              'checkpointSha256': digest(args.checkpoint),
              'onnxSha256': digest(path), 'inputShape': [1, 96],
              'outputShape': [1, 6], 'paritySamples': sample_count,
              'maxAbsoluteDifference': max_abs,
              'maxAbsoluteTolerance': MAX_ABS_TOLERANCE,
              'greedyActionMismatches': action_mismatches,
              'exportPrecision': 'float64-core-float32-io' if args.double_core else 'float32',
              'originalCheckpointMaxScoreDifference': (float(np.max(np.abs(original - actual)))
                                                       if args.double_core else 0.0),
              'legalMaskDecisionChecks': legal_checks,
              'originalCheckpointLegalActionMismatches': legal_mismatches,
              'published': False}
    (args.output / 'export-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
