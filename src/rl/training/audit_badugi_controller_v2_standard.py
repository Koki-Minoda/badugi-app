"""Audit a frozen Standard ONNX against the published Beginner model.

The arms use disjoint controller sessions. Bootstrap resampling is stratified
within each seat/mode/opponent cell; continuous hands are never treated as
independent or causally paired observations.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from audit_badugi_controller_v2_beginner import (
    audit_arm, audit_browser, bootstrap_cells, estimates, sha256,
)


def main():
    parser = argparse.ArgumentParser()
    for name in ('candidate', 'beginner', 'browser', 'manifest',
                 'beginner-manifest', 'output'):
        parser.add_argument(f'--{name}', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('audit output already exists')
    manifest = json.loads(args.manifest.read_text())
    beginner_manifest = json.loads(args.beginner_manifest.read_text())
    quality = manifest['quality']
    if (manifest['status'] != 'FROZEN' or beginner_manifest['status'] != 'FROZEN' or
            manifest['codeGitSha'] != beginner_manifest['codeGitSha'] or
            manifest['contractSha256'] != beginner_manifest['contractSha256'] or
            manifest['seedBase'] == beginner_manifest['seedBase'] or
            manifest['sessionsPerProfileGroup'] != beginner_manifest['sessionsPerProfileGroup'] or
            manifest['handsPerSessionMax'] != beginner_manifest['handsPerSessionMax'] or
            quality['bootstrapReplicates'] < 1000 or
            quality['minimumImprovementBbPerHand'] <= 0 or
            quality.get('maximumMaterialCellRegressionBbPerHand', 0) <= 0):
        raise ValueError('Standard manifests are not independent or comparable')
    candidate = audit_arm(args.candidate, manifest, args.manifest, 'candidate')
    beginner = audit_arm(args.beginner, beginner_manifest,
                         args.beginner_manifest, 'candidate')
    if (candidate['summary']['modelKind'] != 'onnx' or
            beginner['summary']['modelKind'] != 'pytorch' or
            {row['seed'] for row in candidate['rows']} &
            {row['seed'] for row in beginner['rows']}):
        raise ValueError('model kinds or independent seeds differ from plan')
    browser = audit_browser(args.browser, manifest)
    for name in browser:
        data = json.loads((args.browser / name).read_text())
        rows = data['target']
        if not name.endswith('-timeout.json'):
            for hand in data['hands']:
                for event in hand['events']:
                    if event['type'] == 'BET_ACTION' and not (
                            isinstance(event['amount'], (int, float)) and
                            0 <= event['amount'] <= event['stackBefore']):
                        raise ValueError(f'browser bet amount is invalid: {name}')
                    if event['type'] == 'DRAW_ACTION' and not (
                            isinstance(event['drawCount'], int) and
                            0 <= event['drawCount'] <= 4):
                        raise ValueError(f'browser draw count is invalid: {name}')
        if any(row['inferenceTrace']['tierId'] != 'standard' or
               not row['applySuccess'] or row['illegalActionRejected'] or
               set(row['normalizationWarnings']) - {'bet-alias-normalized-to-raise'}
               for row in rows):
            raise ValueError(f'browser Standard action application failed: {name}')
    repetitions = quality['bootstrapReplicates']
    candidate_point, candidate_samples = bootstrap_cells(
        candidate['cells'], quality['bootstrapSeed'], repetitions)
    beginner_point, beginner_samples = bootstrap_cells(
        beginner['cells'], quality['bootstrapSeed'] + 1, repetitions)
    candidate_stats = estimates(candidate_point, candidate_samples, candidate['cells'])
    beginner_stats = estimates(beginner_point, beginner_samples, beginner['cells'])
    difference = estimates(
        {key: candidate_point[key] - beginner_point[key] for key in candidate_point},
        {key: candidate_samples[key] - beginner_samples[key] for key in candidate_samples},
        candidate['cells'],
    )
    minimum = quality['minimumImprovementBbPerHand']
    actions = candidate['actions']
    bet_count = sum(count for action, count in actions.items() if action.startswith('BET:'))
    draw_count = sum(count for action, count in actions.items() if action.startswith('DRAW:'))
    fold_rate = actions['BET:0'] / bet_count if bet_count else 0
    pat_rate = actions['DRAW:0'] / draw_count if draw_count else 0
    checks = {
        'overallLowerExceedsDelta': difference['overall']['lower95'] > minimum,
        'cashLowerExceedsDelta': difference['mode']['cash']['lower95'] > minimum,
        'mttLowerExceedsDelta': difference['mode']['mtt']['lower95'] > minimum,
        'allCandidateProfileLowersPositive': all(
            value['lower95'] > 0 for value in candidate_stats['profile'].values()),
        'noCandidateCellMeanBelowFloor': all(
            value['meanBbPerHand'] >= quality['minimumCellMeanBbPerHand']
            for value in candidate_stats['cell'].values()),
        'noMaterialRelativeCellRegression': all(
            value['upper95'] >= -quality['maximumMaterialCellRegressionBbPerHand']
            for value in difference['cell'].values()),
        'foldRateNotCollapsed': fold_rate >= quality['minimumFoldRate'],
        'patRateNotCollapsed': pat_rate >= quality['minimumPatRate'],
    }
    report = {
        'status': 'STANDARD_CANDIDATE_GATE_PASS' if all(checks.values())
                  else 'STANDARD_CANDIDATE_GATE_FAIL',
        'preregisteredDeltaBbPerHand': minimum,
        'manifestSha256': sha256(args.manifest),
        'beginnerManifestSha256': sha256(args.beginner_manifest),
        'checks': checks,
        'candidate': candidate_stats,
        'publishedBeginner': beginner_stats,
        'candidateMinusBeginnerUnpaired': difference,
        'weakCellNames': [name for name, value in difference['cell'].items()
                          if value['meanBbPerHand'] < 0],
        'materialRegressionCellNames': [
            name for name, value in difference['cell'].items()
            if value['upper95'] < -quality['maximumMaterialCellRegressionBbPerHand']],
        'candidateActions': dict(candidate['actions']),
        'beginnerActions': dict(beginner['actions']),
        'candidateFoldRate': fold_rate,
        'candidatePatRate': pat_rate,
        'candidateSessionsSha256': candidate['sessionsSha256'],
        'candidateHandTraceSha256': candidate['handTraceSha256'],
        'beginnerSessionsSha256': beginner['sessionsSha256'],
        'beginnerHandTraceSha256': beginner['handTraceSha256'],
        'browserEvidence': browser,
        'limitations': 'Scripted opponents and session bootstrap do not prove human or ICM strength; identical initial conditions are not causal paired EV.',
    }
    args.output.mkdir(parents=True)
    (args.output / 'audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'checks': checks,
                      'overall': difference['overall'],
                      'cash': difference['mode']['cash'],
                      'mtt': difference['mode']['mtt']}))


if __name__ == '__main__':
    main()
