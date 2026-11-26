#!/usr/bin/env python3
"""Expand recorded multi-hand root seeds without touching source artifacts."""

from __future__ import annotations

from array import array
from collections import defaultdict
import argparse
import hashlib
import json
from pathlib import Path
import sys

MOD = 2**32

# These records expose a played hand index or the completed-hand count. The
# remaining 33 root-only files stay at their previous conservative boundary.
INDEX_SUFFIXES = (
    'd03-iron-hand-aware-training-20261118/action-diagnostic-rows.jsonl',
    'd03-iron-weak-raise-cause-20261118/targets.jsonl',
    'd03-iron-weak-raise-cause-v2-20261118/targets.jsonl',
    'd03-v2-independent-slot-audit-60hand-20261104/transitions.jsonl',
    'd03-v2-iron-four-card-value-bet-20261105/same-state-4000hand/same-state-actions.jsonl',
    'd03-v2-iron-four-card-value-bet-strict-20261105/same-state-parity-4000hand/same-state-actions.jsonl',
    'd03-v2-iron-guarded-residual-same-state-20261106/same-state-actions.jsonl',
    'd03-v2-iron-public-aggression-probe-20261106/same-state-4000hand/same-state-actions.jsonl',
    'd03-v2-iron-residual-same-state-4000hand-20261105/same-state-actions.jsonl',
    'd03-v2-iron-same-state-all-rounds-4000hand-20261105/same-state-actions.jsonl',
    'd03-v2-iron-same-state-all-rounds-smoke-20261105/same-state-actions.jsonl',
)
NESTED_SUFFIXES = ('d03-iron-nine-low-branch-20261118/paired-hands.jsonl.partial',)
HANDS_SUFFIXES = (
    'd03-v2-opening-range-guard-experiment-20261105/all_two_guard.jsonl',
    'd03-v2-opening-range-guard-experiment-20261105/combined_guard.jsonl',
    'd03-v2-opening-range-guard-experiment-20261105/pro_bet_standard_draw.jsonl',
    'd03-v2-opening-range-guard-experiment-20261105/raised_two_guard.jsonl',
    'd03-v2-opening-range-guard-experiment-20261105/short_stack_guard.jsonl',
)
METHOD = {**{path: 'handIndex' for path in INDEX_SUFFIXES},
          **{path: 'target.handIndex' for path in NESTED_SUFFIXES},
          **{path: 'hands' for path in HANDS_SUFFIXES}}


def read_u32(path: Path) -> set[int]:
    data = path.read_bytes()
    if len(data) % 4 or sys.byteorder != 'little':
        raise ValueError('u32 index requires little endian, four-byte framing')
    values = array('I')
    values.frombytes(data)
    if list(values) != sorted(set(values)):
        raise ValueError('old root index is not sorted and unique')
    return set(values)


def hand_index(row: dict, method: str) -> int:
    if method == 'handIndex':
        value = row.get('handIndex')
    elif method == 'target.handIndex':
        target = row.get('target')
        value = target.get('handIndex') if isinstance(target, dict) else None
    elif method == 'hands':
        hands = row.get('hands')
        value = hands - 1 if type(hands) is int else None
    else:
        raise ValueError('unreviewed method')
    if type(value) is not int or not 0 <= value < 100:
        raise ValueError(f'invalid hand index: {value}')
    return value


def expand_source(max_index: dict[int, int]) -> set[int]:
    return {(seed + 1009 * h) % MOD for seed, last in max_index.items()
            for h in range(last + 1)}


def write_u32(path: Path, values: set[int]) -> dict:
    data = array('I', sorted(values)).tobytes()
    path.write_bytes(data)
    return {'path': path.name, 'count': len(values),
            'sha256': hashlib.sha256(data).hexdigest()}


def build(root: Path, manifest_path: Path, old_roots_path: Path,
          candidate_path: Path, output: Path) -> dict:
    manifest = json.loads(manifest_path.read_text())
    tags = {x['path']: x for x in manifest['sourceTags']
            if x['classification'] == 'UNRESOLVED_ROOT_SEED_EXCLUSION_ONLY'}
    if len(tags) != 50 or not set(METHOD).issubset(tags):
        raise ValueError('residual source scope changed')
    old = read_u32(old_roots_path)
    expanded: set[int] = set()
    audited = []
    for relative, method in sorted(METHOD.items()):
        tag = tags[relative]
        digest = hashlib.sha256()
        max_index: dict[int, int] = defaultdict(int)
        rows = 0
        with (root / relative).open('rb') as stream:
            for raw in stream:
                if not raw.endswith(b'\n'):
                    raise ValueError(f'unframed row in {relative}')
                digest.update(raw)
                row = json.loads(raw)
                seed = row.get('seed')
                if type(seed) is not int or seed < 0:
                    raise ValueError(f'invalid seed in {relative}')
                index = hand_index(row, method)
                max_index[seed] = max(max_index[seed], index)
                rows += 1
        if rows != tag['rows'] or digest.hexdigest() != tag['sourceSha256']:
            raise ValueError(f'source SHA or row count changed: {relative}')
        source = expand_source(max_index)
        expanded.update(source)
        audited.append({'path': relative, 'method': method, 'rows': rows,
                        'rootSeeds': len(max_index), 'expandedUnique': len(source),
                        'maxObservedHandIndex': max(max_index.values()),
                        'sourceSha256': digest.hexdigest()})
    extra = expanded - old
    old_sha = hashlib.sha256(old_roots_path.read_bytes()).hexdigest()
    # Candidate file is ordered by selection, not sorted; retain its index.
    candidate_bytes = candidate_path.read_bytes()
    if len(candidate_bytes) % 4:
        raise ValueError('candidate u32 framing')
    candidate_values = array('I')
    candidate_values.frombytes(candidate_bytes)
    if len(candidate_values) != len(set(candidate_values)):
        raise ValueError('duplicate candidate')
    collisions = sorted((value, index) for index, value in enumerate(candidate_values)
                        if value in extra)
    output.mkdir(parents=True, exist_ok=False)
    outputs = [write_u32(output / 'new-derived-beyond-root.u32', extra),
               write_u32(output / 'expanded-root50.u32', old | expanded)]
    result = {'schema': 'mgx-d03-m2-root50-derived/v1',
              'sourceManifestSha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
              'oldRootIndexSha256': old_sha,
              'reviewedMultiHandSources': len(METHOD),
              'remainingRootOnlySources': len(tags) - len(METHOD),
              'oldRootCount': len(old), 'expandedReviewedCount': len(expanded),
              'newBeyondRootCount': len(extra),
              'combinedRoot50Count': len(old | expanded),
              'candidatePath': str(candidate_path),
              'candidateSha256': hashlib.sha256(candidate_bytes).hexdigest(),
              'candidateCount': len(candidate_values),
              'candidateCollisionsNewDerived': collisions,
              'auditedSources': audited, 'outputs': outputs,
              'gate': 'NO_GO_UNRESOLVED_ROOT33_EXTERNAL_AND_CI'}
    (output / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--previous-manifest', required=True, type=Path)
    parser.add_argument('--old-root-index', required=True, type=Path)
    parser.add_argument('--candidate-index', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps({k: v for k, v in build(args.root, args.previous_manifest,
                                              args.old_root_index, args.candidate_index,
                                              args.output).items()
                      if k not in {'auditedSources', 'outputs'}}))
