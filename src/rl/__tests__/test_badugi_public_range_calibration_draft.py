"""Offline calibration must keep inference labels separate and fail closed."""
import unittest

from rl.training.badugi_public_range_calibration_draft import (
    apply_temperature, fit_development_temperatures,
    validate_development_calibration,
)


class PublicRangeCalibrationTests(unittest.TestCase):
    def test_temperature_preserves_order_and_normalization(self):
        probabilities = apply_temperature((0.8, 0.1, 0.06, 0.04), 2.0)
        self.assertAlmostEqual(sum(probabilities), 1)
        self.assertEqual(sorted(probabilities, reverse=True), list(probabilities))
        self.assertLess(probabilities[0], 0.8)

    def test_profile_is_not_used_to_select_temperature(self):
        rows = []
        for profile in ('tight', 'loose'):
            for _ in range(200):
                rows.append({'group': 2, 'profile': profile, 'truthBucket': 0,
                             'prior': [0.25] * 4,
                             'posterior': [0.7, 0.1, 0.1, 0.1]})
        fitted = fit_development_temperatures(rows)
        self.assertEqual(set(fitted), {2})
        self.assertIn(fitted[2], (0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0))
        validation = validate_development_calibration(rows, fitted, min_cell_rows=100)
        self.assertTrue(validation['allCellsNonWorse'])
        self.assertFalse(validation['actionOverrideAllowed'])

    def test_worse_or_sparse_cell_blocks_development_gate(self):
        rows = [{'group': 0, 'profile': 'switch', 'truthBucket': 1,
                 'prior': [0.1, 0.8, 0.05, 0.05],
                 'posterior': [0.8, 0.1, 0.05, 0.05]} for _ in range(120)]
        report = validate_development_calibration(rows, {0: 1.0}, min_cell_rows=100)
        self.assertFalse(report['allCellsNonWorse'])
        self.assertFalse(report['cells'][0]['nonWorse'])
        sparse = validate_development_calibration(rows[:20], {0: 1.0}, min_cell_rows=100)
        self.assertFalse(sparse['allCellsNonWorse'])

    def test_private_or_invalid_probability_fields_fail(self):
        row = {'group': 0, 'profile': 'balanced', 'truthBucket': 0,
               'prior': [0.25] * 4, 'posterior': [0.7, 0.1, 0.1, 0.1]}
        with self.assertRaises(ValueError):
            fit_development_temperatures([{**row, 'posterior': [0.7, 0.1, 0.1, 0.2]}],
                                         min_group_rows=1)
        with self.assertRaisesRegex(ValueError, 'private card'):
            fit_development_temperatures([{**row, 'opponentPrivateCards': ['AC']}],
                                         min_group_rows=1)
        with self.assertRaises(ValueError):
            validate_development_calibration([row], {}, min_cell_rows=1)


if __name__ == '__main__':
    unittest.main()
