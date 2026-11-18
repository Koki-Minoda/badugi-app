#!/usr/bin/env python3
"""Recount frozen controller hand originals and rank development hypotheses."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from rl.training.badugi_decision_leak_discovery_draft import discover_badugi_decision_leaks


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--frozen-plan', type=Path, required=True)
    parser.add_argument('--collection-result', type=Path, required=True)
    parser.add_argument('--rows', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        raise ValueError('existing discovery report must be preserved')
    plan = json.loads(args.frozen_plan.read_text())
    result = json.loads(args.collection_result.read_text())
    if (plan.get('status') != 'FROZEN_FRESH_SAFETY_CAUSE_ONLY' or
            result.get('status') != 'COMPLETE_FRESH_SAFETY_CAUSE_ONLY' or
            result.get('planSha256') != sha(args.frozen_plan) or
            result.get('rowsSha256') != sha(args.rows) or
            plan.get('modelSha256') != sha(plan['modelPath'])):
        raise ValueError('source collection or real model integrity mismatch')
    with args.rows.open() as stream:
        report = discover_badugi_decision_leaks(json.loads(line) for line in stream)
    if report['hands'] != result['hands'] or report['pairedBranchSessions'] != result['pairedFoldCallTargets']:
        raise ValueError('source hand or branch count mismatch')
    report['sourcePlanSha256'] = result['planSha256']
    report['sourceRowsSha256'] = result['rowsSha256']
    report['sourceModelSha256'] = plan['modelSha256']
    with args.out.open('x') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'status': report['status'], 'hands': report['hands'],
                      'pairedBranchSessions': report['pairedBranchSessions'],
                      'screenedSliceCount': report['screenedSliceCount'],
                      'rankedHypotheses': report['rankedHypotheses'][:3],
                      'reportSha256': sha(args.out)}))


if __name__ == '__main__':
    main()
