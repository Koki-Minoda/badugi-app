"""Export an isolated D03 candidate to ONNX and verify numeric parity."""
from __future__ import annotations

import argparse
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


def check_parity(expected, actual):
    if actual.shape != expected.shape or not np.all(np.isfinite(actual)):
        raise ValueError(f'ONNX parity failed: shape={actual.shape}, non-finite or unexpected scores')
    max_abs = float(np.max(np.abs(expected - actual)))
    action_mismatches = int(np.count_nonzero(expected.argmax(axis=1) != actual.argmax(axis=1)))
    if max_abs > MAX_ABS_TOLERANCE or action_mismatches:
        raise ValueError(f'ONNX parity failed: shape={actual.shape}, maxAbs={max_abs}, '
                         f'actions={action_mismatches}')
    return max_abs, action_mismatches


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
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
    torch.onnx.export(agent.q_network, torch.zeros(1, 96), str(path),
                      input_names=['observation'], output_names=['q_values'],
                      dynamic_axes={'observation': {0: 'batch'}, 'q_values': {0: 'batch'}},
                      opset_version=17, dynamo=False)
    session = ort.InferenceSession(str(path), providers=['CPUExecutionProvider'])
    rng = np.random.default_rng(20261104)
    samples = rng.uniform(0, 1, size=(128, 96)).astype(np.float32)
    with torch.no_grad():
        expected = agent.q_network(torch.from_numpy(samples)).numpy()
    actual = session.run(['q_values'], {'observation': samples})[0]
    if expected.shape != (128, 6):
        raise ValueError('candidate ONNX score shape mismatch')
    max_abs, action_mismatches = check_parity(expected, actual)
    report = {'status': 'PARITY_PASS_NOT_STRENGTH', 'schemaVersion': SCHEMA,
              'checkpointSha256': digest(args.checkpoint),
              'onnxSha256': digest(path), 'inputShape': [1, 96],
              'outputShape': [1, 6], 'paritySamples': 128,
              'maxAbsoluteDifference': max_abs,
              'maxAbsoluteTolerance': MAX_ABS_TOLERANCE,
              'greedyActionMismatches': action_mismatches,
              'published': False}
    (args.output / 'export-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
