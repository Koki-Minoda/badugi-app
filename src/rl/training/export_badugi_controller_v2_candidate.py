"""Export an isolated D03 candidate to ONNX and verify numeric parity."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch

from train_badugi_controller_v2_draft import DQNAgent, SCHEMA


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
    max_abs = float(np.max(np.abs(expected - actual)))
    if actual.shape != (128, 6) or max_abs > 1e-5:
        raise ValueError(f'ONNX parity failed: shape={actual.shape}, maxAbs={max_abs}')
    report = {'status': 'PARITY_PASS_NOT_STRENGTH', 'schemaVersion': SCHEMA,
              'checkpointSha256': digest(args.checkpoint),
              'onnxSha256': digest(path), 'inputShape': [1, 96],
              'outputShape': [1, 6], 'paritySamples': 128,
              'maxAbsoluteDifference': max_abs, 'published': False}
    (args.output / 'export-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
