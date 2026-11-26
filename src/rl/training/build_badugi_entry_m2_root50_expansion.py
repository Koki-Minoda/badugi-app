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


def verified_u32(path: Path, record: dict, *, sorted_unique: bool) -> tuple[list[int], bytes]:
    """Bind an input index to its frozen manifest before using any values."""
    data = path.read_bytes()
    if (record.get('path', record.get('candidateFile')) != path.name
            or hashlib.sha256(data).hexdigest() != record.get('sha256', record.get('candidateSha256'))
            or len(data) % 4 or sys.byteorder != 'little'):
        raise ValueError(f'u32 input identity or framing changed: {path}')
    values = array('I')
    values.frombytes(data)
    expected_count = record.get('count', record.get('candidateCount'))
    if type(expected_count) is not int or len(values) != expected_count:
        raise ValueError(f'u32 input count changed: {path}')
    if len(values) != len(set(values)) or (sorted_unique and list(values) != sorted(values)):
        raise ValueError(f'u32 input order or uniqueness changed: {path}')
    return list(values), data


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
          candidate_path: Path, candidate_manifest_path: Path, output: Path) -> dict:
    manifest = json.loads(manifest_path.read_text())
    tags = {x['path']: x for x in manifest['sourceTags']
            if x['classification'] == 'UNRESOLVED_ROOT_SEED_EXCLUSION_ONLY'}
    if len(tags) != 50 or not set(METHOD).issubset(tags):
        raise ValueError('residual source scope changed')
    root_record = manifest.get('files', {}).get('unresolvedRoot')
    if not isinstance(root_record, dict):
        raise ValueError('missing frozen old-root manifest record')
    old_values, old_bytes = verified_u32(old_roots_path, root_record, sorted_unique=True)
    old = set(old_values)
    candidate_manifest = json.loads(candidate_manifest_path.read_text())
    if (candidate_manifest.get('schema') != 'mgx-d03-m2-topup-pilot-seed-dry-run/v1'
            or candidate_manifest.get('status') != 'DRY_RUN_NOT_GO'
            or candidate_manifest.get('collectionAllowed') is not False):
        raise ValueError('candidate manifest is not the frozen dry-run exclusion input')
    candidate_record = {'path': candidate_manifest.get('candidateFile'),
                        'count': candidate_manifest.get('candidateCount'),
                        'sha256': candidate_manifest.get('candidateSha256')}
    candidate_values, candidate_bytes = verified_u32(
        candidate_path, candidate_record, sorted_unique=False)
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
    old_sha = hashlib.sha256(old_bytes).hexdigest()
    # Candidate file is ordered by selection, not sorted; retain its index.
    combined = old | expanded
    collisions = sorted((value, index) for index, value in enumerate(candidate_values)
                        if value in combined)
    output.mkdir(parents=True, exist_ok=False)
    outputs = [write_u32(output / 'new-derived-beyond-root.u32', extra),
               write_u32(output / 'expanded-root50.u32', combined)]
    result = {'schema': 'mgx-d03-m2-root50-derived/v1',
              'sourceManifestSha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
              'oldRootIndexSha256': old_sha,
              'oldRootIndexCount': len(old),
              'candidateManifestSha256': hashlib.sha256(candidate_manifest_path.read_bytes()).hexdigest(),
              'reviewedMultiHandSources': len(METHOD),
              'remainingRootOnlySources': len(tags) - len(METHOD),
              'oldRootCount': len(old), 'expandedReviewedCount': len(expanded),
              'newBeyondRootCount': len(extra),
              'combinedRoot50Count': len(combined),
              'candidatePath': str(candidate_path),
              'candidateSha256': hashlib.sha256(candidate_bytes).hexdigest(),
              'candidateCount': len(candidate_values),
              'candidateCollisionsCombined': collisions,
              'candidateCollisionsNewDerived': [pair for pair in collisions if pair[0] in extra],
              'auditedSources': audited, 'outputs': outputs,
              'gate': 'NO_GO_V2_PRODUCER_PARTIAL_ROLLUP_EXTERNAL_INCREMENTAL_CI'}
    (output / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--previous-manifest', required=True, type=Path)
    parser.add_argument('--old-root-index', required=True, type=Path)
    parser.add_argument('--candidate-index', required=True, type=Path)
    parser.add_argument('--candidate-manifest', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps({k: v for k, v in build(args.root, args.previous_manifest,
                                              args.old_root_index, args.candidate_index,
                                              args.candidate_manifest,
                                              args.output).items()
                      if k not in {'auditedSources', 'outputs'}}))
