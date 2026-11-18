"""Session dependence, sparse coverage, and simultaneous ranking checks."""
import unittest

from rl.training.badugi_street_fold_analysis_draft import analyze_street_fold_sessions


GROUPS = ((3, 3, 'cash'), (6, 3, 'cash'), (6, 6, 'cash'),
          (3, 3, 'mtt'), (6, 3, 'mtt'), (6, 6, 'mtt'))
PROFILES = ('tight_value', 'balanced_range', 'loose_station',
            'bluff_pressure', 'legacy_passive')


def rows(session_count=2, rewards=None):
    rewards = rewards or {'street1': 1, 'street2': 0.5, 'street3': 0.2}
    index = 0
    for group in GROUPS:
        for profile in PROFILES:
            for session_index in range(session_count):
                arms = {'baseline': {'completedHeroHands': 1,
                                     'modelCalls': 1,
                                     'heroProfitBigBets': 0}}
                for arm in ('street1', 'street2', 'street3'):
                    arms[arm] = {'completedHeroHands': 1, 'modelCalls': 1,
                                 'heroProfitBigBets': rewards[arm],
                                 f'override|{arm}': 1}
                yield {'globalIndex': index, 'seed': index + 1000,
                       'group': list(group), 'profile': profile,
                       'heroSeat': session_index % group[1], 'arms': arms}
                index += 1


class StreetFoldAnalysisTests(unittest.TestCase):
    def test_resolves_only_with_sufficient_exposure_and_pairwise_evidence(self):
        report = analyze_street_fold_sessions(rows(), sessions_per_cell=2,
                                              minimum_overrides_per_mode=10)
        self.assertEqual(report['status'], 'DEVELOPMENT_STREET_RANK_RESOLVED')
        self.assertEqual(report['streetWinner'], 'street1')
        self.assertEqual(report['pairedSessions'], 60)
        self.assertEqual(report['scheduledHandsPerArm'], 1200)
        self.assertEqual(report['overridesByMode']['street3|cash'], 30)

    def test_hundreds_of_opportunities_do_not_override_frozen_minimum(self):
        report = analyze_street_fold_sessions(rows(), sessions_per_cell=2,
                                              minimum_overrides_per_mode=5000)
        self.assertEqual(report['status'], 'INSUFFICIENT_STREET_EXPOSURE')
        self.assertIsNone(report['streetWinner'])

    def test_sample_mean_does_not_resolve_overlapping_intervals(self):
        items = list(rows())
        for item in items:
            sign = 1 if item['globalIndex'] % 2 == 0 else -1
            for arm in ('street1', 'street2', 'street3'):
                item['arms'][arm]['heroProfitBigBets'] += sign * 100
        report = analyze_street_fold_sessions(items, sessions_per_cell=2,
                                              minimum_overrides_per_mode=10)
        self.assertEqual(report['status'], 'DEVELOPMENT_STREET_RANK_UNRESOLVED')
        self.assertIsNone(report['streetWinner'])

    def test_no_override_parity_is_required(self):
        items = list(rows())
        items[0]['arms']['street2']["override|street2"] = 0
        with self.assertRaisesRegex(ValueError, 'zero-override'):
            analyze_street_fold_sessions(items, sessions_per_cell=2)

    def test_partial_source_is_not_analyzed(self):
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            analyze_street_fold_sessions(list(rows())[:-1], sessions_per_cell=2)


if __name__ == '__main__':
    unittest.main()
