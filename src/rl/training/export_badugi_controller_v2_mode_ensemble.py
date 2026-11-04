"""Export a D03 Standard diagnostic ONNX that selects cash/MTT by public slot 21.

This is an isolated candidate export. It neither changes the registry nor claims
strength; controller and browser audits are required before any promotion.
"""
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


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ModeEnsemble(torch.nn.Module):
    def __init__(self, cash, mtt, heads_up_mtt=None):
        super().__init__()
        self.cash = cash
        self.mtt = mtt
        self.heads_up_mtt = heads_up_mtt

    def forward(self, observation):
        # v2 slot 21 is the public is_tournament flag, 0 for cash and 1 for MTT.
        mtt_scores = self.mtt(observation)
        if self.heads_up_mtt is not None:
            # Slot 10 is public table_size/6. A two-seat MTT table is 2/6;
            # three and six-seat tables are 3/6 and 6/6 respectively.
            mtt_scores = torch.where(
                observation[:, 10:11] < 0.5,
                self.heads_up_mtt(observation), mtt_scores)
        return torch.where(observation[:, 21:22] >= 0.5,
                           mtt_scores, self.cash(observation))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cash-checkpoint', type=Path, required=True)
    parser.add_argument('--mtt-checkpoint', type=Path, required=True)
    parser.add_argument('--heads-up-mtt-checkpoint', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('isolated output directory already exists')
    cash = DQNAgent.load(str(args.cash_checkpoint), device='cpu')
    mtt = DQNAgent.load(str(args.mtt_checkpoint), device='cpu')
    heads_up_mtt = (DQNAgent.load(str(args.heads_up_mtt_checkpoint), device='cpu')
                    if args.heads_up_mtt_checkpoint else None)
    branches = [('cash', cash), ('mtt', mtt)]
    if heads_up_mtt is not None:
        branches.append(('heads-up-mtt', heads_up_mtt))
    for name, agent in branches:
        if (agent.obs_dim != 96 or agent.n_actions != 6 or
                agent.checkpoint_training_state.get('schemaVersion') != SCHEMA or
                agent.checkpoint_training_state.get('tier') !=
                ('beginner' if name == 'heads-up-mtt' else 'standard')):
            raise ValueError(f'{name} checkpoint contract mismatch')
    network = ModeEnsemble(cash.q_network, mtt.q_network,
                           heads_up_mtt.q_network if heads_up_mtt else None).eval()
    args.output.mkdir(parents=True)
    path = args.output / 'candidate.onnx'
    torch.onnx.export(network, torch.zeros(1, 96), str(path),
                      input_names=['observation'], output_names=['q_values'],
                      dynamic_axes={'observation': {0: 'batch'}, 'q_values': {0: 'batch'}},
                      opset_version=17, dynamo=False)
    session = ort.InferenceSession(str(path), providers=['CPUExecutionProvider'])
    rng = np.random.default_rng(20261105)
    samples = rng.uniform(0, 1, size=(256, 96)).astype(np.float32)
    samples[:128, 21] = 0.0
    samples[128:, 21] = 1.0
    samples[:, 10] = np.tile(np.asarray([2 / 6, 3 / 6, 1.0, 2 / 6],
                                        dtype=np.float32), 64)
    with torch.no_grad():
        expected = network(torch.from_numpy(samples)).numpy()
        cash_expected = cash.q_network(torch.from_numpy(samples[:128])).detach().numpy()
        mtt_expected = mtt.q_network(torch.from_numpy(samples[128:])).detach().numpy()
        if heads_up_mtt is not None:
            hu_expected = heads_up_mtt.q_network(torch.from_numpy(samples[128:])).detach().numpy()
            mtt_expected = np.where(samples[128:, 10:11] < 0.5,
                                    hu_expected, mtt_expected)
    actual = session.run(['q_values'], {'observation': samples})[0]
    max_abs = float(np.max(np.abs(expected - actual)))
    if (actual.shape != (256, 6) or max_abs > 1e-5 or
            not np.array_equal(expected[:128], cash_expected) or
            not np.array_equal(expected[128:], mtt_expected)):
        raise ValueError('mode selection or ONNX parity failed')
    report = {'status': 'PARITY_PASS_NOT_STRENGTH', 'schemaVersion': SCHEMA,
              'modeFlagSlot': 21, 'cashCheckpointSha256': digest(args.cash_checkpoint),
              'mttCheckpointSha256': digest(args.mtt_checkpoint),
              'headsUpMttCheckpointSha256': digest(args.heads_up_mtt_checkpoint)
              if args.heads_up_mtt_checkpoint else None,
              'headsUpMttTableSizeSlot': 10 if heads_up_mtt else None,
              'onnxSha256': digest(path), 'inputShape': [1, 96],
              'outputShape': [1, 6], 'paritySamples': 256,
              'maxAbsoluteDifference': max_abs, 'published': False}
    (args.output / 'export-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
