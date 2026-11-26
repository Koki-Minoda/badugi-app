"""Recorded later hands must be excluded, including a formerly missed candidate."""

from array import array
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'training'))
from build_badugi_entry_m2_root50_expansion import (
    METHOD, build, expand_source, hand_index, read_u32, verified_u32,
)


class Root50Expansion(unittest.TestCase):
    def test_recorded_hand_expands_prefix_and_rejects_old_candidate(self):
        # The historical v2 controller deals hand h at seed + 1009*h.
        values = expand_source({1_420_060_001: 10})
        self.assertEqual(len(values), 11)
        self.assertIn(1_420_070_091, values)
        self.assertIn(1_420_060_001, values)
        self.assertNotIn(1_420_071_100, values)

    def test_nested_target_and_completed_hands_are_distinct(self):
        self.assertEqual(hand_index({'target': {'handIndex': 8}},
                                    'target.handIndex'), 8)
        self.assertEqual(hand_index({'hands': 20}, 'hands'), 19)
        for row in ({'handIndex': -1}, {'hands': 0}, {'target': {}}):
            method = ('handIndex' if 'handIndex' in row else 'hands' if 'hands' in row
                      else 'target.handIndex')
            with self.subTest(row=row), self.assertRaises(ValueError):
                hand_index(row, method)

    def test_rejects_unsorted_or_duplicate_prior_index(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'prior.u32'
            path.write_bytes(array('I', [7, 2, 7]).tobytes())
            with self.assertRaises(ValueError):
                read_u32(path)

    def test_manifest_binds_both_input_indexes_and_combined_collision_scope(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            tags = []
            for relative, method in METHOD.items():
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                row = {'seed': 1_420_060_001}
                if method == 'handIndex':
                    row['handIndex'] = 10
                elif method == 'target.handIndex':
                    row['target'] = {'handIndex': 10}
                else:
                    row['hands'] = 11
                data = (json.dumps(row) + '\n').encode()
                path.write_bytes(data)
                tags.append({'path': relative,
                             'classification': 'UNRESOLVED_ROOT_SEED_EXCLUSION_ONLY',
                             'rows': 1, 'sourceSha256': hashlib.sha256(data).hexdigest()})
            for index in range(50 - len(tags)):
                tags.append({'path': f'onehand-{index}',
                             'classification': 'UNRESOLVED_ROOT_SEED_EXCLUSION_ONLY'})
            old_path = root / 'unresolved-root.u32'
            old_bytes = array('I', [7]).tobytes()
            old_path.write_bytes(old_bytes)
            old_record = {'path': old_path.name, 'count': 1,
                          'sha256': hashlib.sha256(old_bytes).hexdigest()}
            prior_path = root / 'prior.json'
            prior_path.write_text(json.dumps({'sourceTags': tags,
                                              'files': {'unresolvedRoot': old_record}}))
            candidate_path = root / 'dry-run-candidates-only.u32le'
            candidate_bytes = array('I', [7, 1_420_070_091]).tobytes()
            candidate_path.write_bytes(candidate_bytes)
            candidate_manifest_path = root / 'dry-run-manifest.json'
            candidate_manifest = {
                'schema': 'mgx-d03-m2-topup-pilot-seed-dry-run/v1',
                'status': 'DRY_RUN_NOT_GO', 'collectionAllowed': False,
                'candidateFile': candidate_path.name, 'candidateCount': 2,
                'candidateSha256': hashlib.sha256(candidate_bytes).hexdigest()}
            candidate_manifest_path.write_text(json.dumps(candidate_manifest))
            def run(output_name):
                return build(root, prior_path, old_path, candidate_path,
                             candidate_manifest_path, root / output_name)

            result = run('good')
            self.assertEqual(result['candidateCollisionsCombined'],
                             [(7, 0), (1_420_070_091, 1)])
            self.assertEqual(result['candidateCollisionsNewDerived'],
                             [(1_420_070_091, 1)])
            self.assertEqual(result['gate'],
                             'NO_GO_V2_PRODUCER_PARTIAL_ROLLUP_EXTERNAL_INCREMENTAL_CI')

            old_path.write_bytes(array('I', [8]).tobytes())
            with self.assertRaisesRegex(ValueError, 'identity'):
                run('bad-old-sha')
            old_path.write_bytes(old_bytes)
            prior = json.loads(prior_path.read_text())
            prior['files']['unresolvedRoot']['count'] = 2
            prior_path.write_text(json.dumps(prior))
            with self.assertRaisesRegex(ValueError, 'count'):
                run('bad-old-count')
            prior['files']['unresolvedRoot']['count'] = 1
            prior_path.write_text(json.dumps(prior))

            candidate_path.write_bytes(array('I', [7, 1_420_070_092]).tobytes())
            with self.assertRaisesRegex(ValueError, 'identity'):
                run('bad-candidate-sha')
            candidate_path.write_bytes(candidate_bytes)
            candidate_manifest['candidateCount'] = 3
            candidate_manifest_path.write_text(json.dumps(candidate_manifest))
            with self.assertRaisesRegex(ValueError, 'count'):
                run('bad-candidate-count')

    def test_verified_u32_rejects_unbound_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'index.u32'
            data = array('I', [2, 4]).tobytes()
            path.write_bytes(data)
            record = {'path': 'other.u32', 'count': 2,
                      'sha256': hashlib.sha256(data).hexdigest()}
            with self.assertRaises(ValueError):
                verified_u32(path, record, sorted_unique=True)


if __name__ == '__main__':
    unittest.main()
