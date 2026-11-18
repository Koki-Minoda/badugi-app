"""Public PAT-response counts remain diagnostic and cannot enable actions."""
import unittest

from rl.training.badugi_public_pat_response_draft import estimate_public_pat_response


def counts(opportunities=0, fold=0, call=0, raise_=0):
    return {'opportunities': opportunities, 'fold': fold, 'call': call, 'raise': raise_}


def history(pat=None, drawn=None):
    return {'byStreet': [
        {'pat': pat or counts(), 'draw': drawn or counts()},
        {'pat': counts(), 'draw': counts()},
        {'pat': counts(), 'draw': counts()},
    ]}


class PublicPatResponseTests(unittest.TestCase):
    def test_completed_public_opportunities_and_uncertainty(self):
        value = estimate_public_pat_response(history(
            pat=counts(80, 64, 12, 4), drawn=counts(80, 24, 48, 8)))
        self.assertEqual(value.pat_opportunities, 80)
        self.assertEqual(value.drawn_opportunities, 80)
        self.assertAlmostEqual(value.fold_after_pat_mean, 65 / 82)
        self.assertAlmostEqual(value.fold_after_draw_mean, 25 / 82)
        self.assertGreater(value.difference_mean, 0)
        self.assertTrue(value.enough_history_for_diagnosis)
        self.assertFalse(value.calibrated_for_action)
        self.assertEqual(value.diagnostic_readiness_reason, 'ready')

    def test_missing_observations_fall_back_to_uncertain_diagnostic(self):
        value = estimate_public_pat_response(history())
        self.assertEqual(value.difference_mean, 0)
        self.assertFalse(value.enough_history_for_diagnosis)
        self.assertFalse(value.calibrated_for_action)
        self.assertEqual(value.diagnostic_readiness_reason,
                         'insufficient_matched_opportunities')

    def test_street_filter_does_not_borrow_other_streets(self):
        source = history(pat=counts(80, 64, 12, 4), drawn=counts(80, 24, 48, 8))
        value = estimate_public_pat_response(source, street=2)
        self.assertEqual(value.pat_opportunities, 0)
        self.assertFalse(value.enough_history_for_diagnosis)
        with self.assertRaisesRegex(ValueError, 'valid betting street'):
            estimate_public_pat_response(source, street=0)

    def test_rejects_private_and_inconsistent_fields(self):
        source = history(pat=counts(3, 1, 1, 1))
        source['opponentCards'] = ['AS']
        with self.assertRaisesRegex(ValueError, 'exact public-history'):
            estimate_public_pat_response(source)
        source.pop('opponentCards')
        source['byStreet'][0]['pat']['opportunities'] = 4
        with self.assertRaisesRegex(ValueError, 'inconsistent'):
            estimate_public_pat_response(source)


if __name__ == '__main__':
    unittest.main()
