import unittest

from rl.training.badugi_public_style_draft import estimate_public_style


def history(**changes):
    value = {'handsObserved': 20, 'fold': 16, 'check': 8, 'call': 18,
             'bet': 4, 'raise': 6, 'raiseAmountBbSum': 9.0,
             'drawCounts': [8, 16, 10, 4, 0],
             'facedBetOpportunities': 40, 'foldedFacingBet': 16,
             'calledFacingBet': 18, 'raisedFacingBet': 6,
             'freeBetOpportunities': 12, 'betWhenFree': 4}
    value.update(changes)
    return value


class PublicStyleTests(unittest.TestCase):
    def test_public_opportunity_denominators_and_uncertainty(self):
        value = estimate_public_style(history())
        self.assertEqual(value.faced_bets, 40)
        self.assertAlmostEqual(value.fold_when_facing_mean, 17 / 43)
        self.assertAlmostEqual(value.call_when_facing_mean, 19 / 43)
        self.assertAlmostEqual(value.raise_when_facing_mean, 7 / 43)
        self.assertAlmostEqual(value.fold_when_facing_mean + value.call_when_facing_mean +
                               value.raise_when_facing_mean, 1)
        self.assertAlmostEqual(value.average_raise_amount_bb, 1.5)
        self.assertTrue(value.enough_history_for_diagnosis)
        self.assertFalse(value.calibrated_for_action)

    def test_sparse_history_is_not_diagnostic(self):
        value = estimate_public_style(history(handsObserved=1, drawCounts=[0, 1, 0, 0, 0]))
        self.assertFalse(value.enough_history_for_diagnosis)

    def test_private_fields_and_inconsistent_counts_rejected(self):
        with self.assertRaisesRegex(ValueError, 'exact public-history'):
            estimate_public_style(history(opponentPrivateCards=['AC']))
        with self.assertRaisesRegex(ValueError, 'inconsistent'):
            estimate_public_style(history(facedBetOpportunities=41))
        with self.assertRaisesRegex(ValueError, 'inconsistent'):
            estimate_public_style(history(drawCounts=[100, 0, 0, 0, 0]))


if __name__ == '__main__':
    unittest.main()
