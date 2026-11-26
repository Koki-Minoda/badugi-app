"""Recorded later hands must be excluded, including a formerly missed candidate."""

from array import array
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'training'))
from build_badugi_entry_m2_root50_expansion import (
    expand_source, hand_index, read_u32,
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


if __name__ == '__main__':
    unittest.main()
