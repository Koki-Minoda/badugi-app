"""Audit a frozen D03 Beginner evaluation using independent session units.

Bootstrap resamples sessions within each preregistered group/profile cell.
Candidate and reference use separate seeds; their continuous hands are not paired.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

from validate_badugi_controller_v2_draft import GROUP_NAMES, PROFILES


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_jsonl(path):
    with Path(path).open() as stream:
        for line in stream:
            yield json.loads(line)


def audit_arm(directory, manifest, manifest_path, role):
    directory = Path(directory)
    summary = json.loads((directory / 'summary.json').read_text())
    if (summary['status'] != 'FROZEN_EVALUATION' or
            summary['evaluationManifestSha256'] != sha256(manifest_path) or
            summary['codeGitSha'] != manifest['codeGitSha'] or
            summary['contractSha256'] != manifest['contractSha256'] or
            summary['seedBase'] != manifest['seedBase'] or
            summary['modelSha256'] != (manifest['modelSha256'] if role == 'candidate'
                                        else manifest['referencePolicyId'])):
        raise ValueError(f'{role} summary differs from its frozen manifest')
    rows = list(read_jsonl(directory / 'sessions.jsonl'))
    hands = list(read_jsonl(directory / 'hand-trace.jsonl'))
    cells = defaultdict(list)
    chip_cells = defaultdict(list)
    seeds = set()
    actions = Counter()
    for row in rows:
        key = (row['group'], row['profile'])
        if (row['seed'] in seeds or row['hands'] <= 0 or not row['zeroSum'] or
                row['chipBbPerHand'] is None or row['group'] not in GROUP_NAMES or
                row['profile'] not in PROFILES):
            raise ValueError(f'{role} has duplicate, empty or invalid session')
        seeds.add(row['seed'])
        cells[key].append(row['chipBbPerHand'])
        chip_cells[key].append(row['chipPerHand'])
        actions.update(row['heroActions'])
    expected = manifest['sessionsPerProfileGroup']
    if (len(rows) != len(GROUP_NAMES) * len(PROFILES) * expected or
            any(len(cells[(group, profile)]) != expected
                for group in GROUP_NAMES for profile in PROFILES) or
            len(hands) != sum(row['hands'] for row in rows)):
        raise ValueError(f'{role} session/hand matrix is incomplete')
    hand_count_by_seed = Counter()
    for hand in hands:
        hand_count_by_seed[hand['seed']] += 1
        deltas = hand['chipDeltaBySeat']
        if (sum(deltas) != 0 or len(hand['startingStacks']) != len(deltas) or
                any(end - start != delta for start, end, delta in
                    zip(hand['startingStacks'], hand['endingStacks'], deltas)) or
                len(hand['decisions']) != len(hand['publicActionTrace'])):
            raise ValueError(f'{role} hand chips or action trace differ')
        for decision, action in zip(hand['decisions'], hand['publicActionTrace']):
            index = decision['actionIndex']
            expected_phase = 'BET' if action['type'] == 'BET_ACTION' else 'DRAW'
            if (decision['legalMask'][index] != 1 or
                    decision['seat'] != action['seat'] or
                    decision['phase'] != expected_phase or
                    decision['elapsedMs'] >= 8000):
                raise ValueError(f'{role} illegal, mismatched or late decision')
            expected_status = (('used' if role == 'candidate' else 'reference')
                               if decision['seat'] == hand['heroSeat'] else 'opponent')
            if decision['status'] != expected_status:
                raise ValueError(f'{role} decision origin mismatch')
            if action['type'] == 'BET_ACTION':
                if (action['action'] not in ('fold', 'check', 'call', 'bet', 'raise') or
                        not 0 <= action['amount'] <= action['stackBefore']):
                    raise ValueError(f'{role} illegal public bet')
            elif action['type'] == 'DRAW_ACTION':
                if not 0 <= action['drawCount'] <= 4:
                    raise ValueError(f'{role} illegal public draw')
            else:
                raise ValueError(f'{role} unknown public action')
    if any(hand_count_by_seed[row['seed']] != row['hands'] for row in rows):
        raise ValueError(f'{role} hand/session counts differ')
    return {'summary': summary, 'rows': rows, 'cells': cells,
            'chipCells': chip_cells, 'actions': actions,
            'sessionsSha256': sha256(directory / 'sessions.jsonl'),
            'handTraceSha256': sha256(directory / 'hand-trace.jsonl')}


def bootstrap_cells(cells, seed, replicates):
    rng = np.random.default_rng(seed)
    point = {}
    samples = {}
    for group in GROUP_NAMES:
        for profile in PROFILES:
            key = (group, profile)
            values = np.asarray(cells[key], dtype=np.float64)
            point[key] = float(values.mean())
            samples[key] = values[rng.integers(0, len(values), size=(replicates, len(values)))].mean(axis=1)
    return point, samples


def estimates(point, samples, cells):
    def stat(keys):
        value = float(np.mean([point[key] for key in keys]))
        draws = np.mean([samples[key] for key in keys], axis=0)
        return {'meanBbPerHand': value,
                'lower95': float(np.quantile(draws, 0.025)),
                'upper95': float(np.quantile(draws, 0.975)),
                'sessionUnits': sum(len(cells[key]) for key in keys)}
    all_keys = [(group, profile) for group in GROUP_NAMES for profile in PROFILES]
    return {
        'overall': stat(all_keys),
        'mode': {mode: stat([key for key in all_keys if key[0].endswith(mode)])
                 for mode in ('cash', 'mtt')},
        'profile': {profile: stat([key for key in all_keys if key[1] == profile])
                    for profile in PROFILES},
        'group': {group: stat([key for key in all_keys if key[0] == group])
                  for group in GROUP_NAMES},
        'cell': {f'{group}|{profile}': stat([(group, profile)])
                 for group in GROUP_NAMES for profile in PROFILES},
    }


def audit_browser(directory, manifest):
    directory = Path(directory)
    evidence = {}
    product_matrix = manifest.get('browserEvidenceMatrix') == 'cash-6-mtt-2-3-6-both-engines'
    for engine in ('chromium', 'webkit'):
        normal_cases = [('cash', 6, f'{engine}-cash.json')]
        if product_matrix:
            normal_cases += [('tournament', entrants, f'{engine}-tournament-{entrants}.json')
                             for entrants in (2, 3, 6)]
        else:
            normal_cases += [('tournament', None, f'{engine}-tournament.json')]
        for mode, entrants, name in normal_cases:
            data = json.loads((directory / name).read_text())
            if (sha256(directory / name) != manifest['browserEvidenceSha256'][name] or
                    data['onnxSha256'] != manifest['onnxSha256'] or
                    data['mode'] != mode or len(data['hands']) != 3 or
                    (entrants is not None and data['entrants'] != entrants) or
                    not data['target'] or data['errors'] or
                    any(sum(hand['chipDelta']) != 0 for hand in data['hands']) or
                    any(row['inferenceTrace']['status'] != 'used' or
                        row['inferenceTrace']['usedModelId'] != manifest['browserModelId'] or
                        row['inferenceTrace']['elapsedMs'] >= 8000
                        for row in data['target']) or
                    any(row['phase'] == 'BET' and
                        str(row['finalAction']).lower() not in
                        {str(action).lower() for action in row['legalActions']}
                        for row in data['target'])):
                raise ValueError(f'normal browser evidence failed: {name}')
            evidence[name] = {'sha256': sha256(directory / name),
                              'targetDecisions': len(data['target']),
                              'hands': len(data['hands'])}
        name = f'{engine}-timeout.json'
        data = json.loads((directory / name).read_text())
        if (sha256(directory / name) != manifest['browserEvidenceSha256'][name] or
                data['onnxSha256'] != manifest['onnxSha256'] or
                sum(data['chipDelta']) != 0 or
                not any(row['inferenceTrace']['status'] == 'fallback' and
                        row['inferenceTrace']['reason'] == 'inference-timeout' and
                        row['inferenceTrace']['usedModelId'] is None
                        for row in data['target']) or
                any(row['phase'] == 'BET' and
                    str(row['finalAction']).lower() not in
                    {str(action).lower() for action in row['legalActions']}
                    for row in data['target'])):
            raise ValueError(f'timeout browser evidence failed: {name}')
        evidence[name] = {'sha256': sha256(directory / name),
                          'fallbackDecisions': sum(row['inferenceTrace']['status'] == 'fallback'
                                                   for row in data['target'])}
    return evidence


def main():
    parser = argparse.ArgumentParser()
    for name in ('candidate', 'reference', 'browser', 'manifest', 'reference-manifest', 'output'):
        parser.add_argument(f'--{name}', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('audit output already exists')
    manifest = json.loads(args.manifest.read_text())
    reference_manifest = json.loads(args.reference_manifest.read_text())
    if (manifest['status'] != 'FROZEN' or reference_manifest['status'] != 'FROZEN' or
            manifest['codeGitSha'] != reference_manifest['codeGitSha'] or
            manifest['contractSha256'] != reference_manifest['contractSha256'] or
            manifest['seedBase'] == reference_manifest['seedBase'] or
            manifest['quality']['bootstrapReplicates'] < 1000):
        raise ValueError('evaluation manifests are not independent/frozen')
    candidate = audit_arm(args.candidate, manifest, args.manifest, 'candidate')
    reference = audit_arm(args.reference, reference_manifest,
                          args.reference_manifest, 'reference')
    if {row['seed'] for row in candidate['rows']} & {row['seed'] for row in reference['rows']}:
        raise ValueError('candidate/reference session seeds overlap')
    browser = audit_browser(args.browser, manifest)
    replicates = manifest['quality']['bootstrapReplicates']
    candidate_point, candidate_samples = bootstrap_cells(candidate['cells'],
                                                          manifest['quality']['bootstrapSeed'], replicates)
    reference_point, reference_samples = bootstrap_cells(reference['cells'],
                                                          manifest['quality']['bootstrapSeed'] + 1, replicates)
    candidate_estimates = estimates(candidate_point, candidate_samples, candidate['cells'])
    reference_estimates = estimates(reference_point, reference_samples, reference['cells'])
    difference = candidate_samples.keys()
    diff_point = {key: candidate_point[key] - reference_point[key] for key in difference}
    diff_samples = {key: candidate_samples[key] - reference_samples[key] for key in difference}
    difference_estimates = estimates(diff_point, diff_samples, candidate['cells'])
    candidate_chip_point, candidate_chip_samples = bootstrap_cells(
        candidate['chipCells'], manifest['quality']['bootstrapSeed'] + 2, replicates)
    reference_chip_point, reference_chip_samples = bootstrap_cells(
        reference['chipCells'], manifest['quality']['bootstrapSeed'] + 3, replicates)
    candidate_chip_estimates = estimates(candidate_chip_point, candidate_chip_samples,
                                         candidate['chipCells'])
    reference_chip_estimates = estimates(reference_chip_point, reference_chip_samples,
                                         reference['chipCells'])
    actions = candidate['actions']
    bet_count = sum(count for action, count in actions.items() if action.startswith('BET:'))
    draw_count = sum(count for action, count in actions.items() if action.startswith('DRAW:'))
    fold_rate = actions['BET:0'] / bet_count if bet_count else 0
    pat_rate = actions['DRAW:0'] / draw_count if draw_count else 0
    quality = manifest['quality']
    checks = {
        'overallLowerPositive': candidate_estimates['overall']['lower95'] > quality['minimumOverallLowerBbPerHand'],
        'bothModeLowersPositive': all(value['lower95'] > quality['minimumModeLowerBbPerHand']
                                       for value in candidate_estimates['mode'].values()),
        'allProfileLowersPositive': all(value['lower95'] > quality['minimumProfileLowerBbPerHand']
                                        for value in candidate_estimates['profile'].values()),
        'noCellMeanBelowFloor': all(value['meanBbPerHand'] >= quality['minimumCellMeanBbPerHand']
                                     for value in candidate_estimates['cell'].values()),
        'foldRate': fold_rate >= quality['minimumFoldRate'],
        'patRate': pat_rate >= quality['minimumPatRate'],
    }
    report = {'status': 'BEGINNER_Q_PASS' if all(checks.values()) else 'BEGINNER_Q_FAIL',
              'manifestSha256': sha256(args.manifest),
              'referenceManifestSha256': sha256(args.reference_manifest),
              'candidate': candidate_estimates, 'reference': reference_estimates,
              'candidateMinusReferenceUnpaired': difference_estimates,
              'candidateChipPerHand': {key: candidate_chip_estimates[key] for key in ('group', 'cell')},
              'referenceChipPerHand': {key: reference_chip_estimates[key] for key in ('group', 'cell')},
              'checks': checks, 'foldRate': fold_rate, 'patRate': pat_rate,
              'candidateSessionsSha256': candidate['sessionsSha256'],
              'candidateHandTraceSha256': candidate['handTraceSha256'],
              'referenceSessionsSha256': reference['sessionsSha256'],
              'referenceHandTraceSha256': reference['handTraceSha256'],
              'browserEvidence': browser}
    args.output.mkdir(parents=True)
    (args.output / 'audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'checks': checks,
                      'overall': candidate_estimates['overall'],
                      'candidateMinusReference': difference_estimates['overall']}))


if __name__ == '__main__':
    main()
