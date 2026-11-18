"""Safety checks for opportunity denominators and hypothesis-only output."""
import unittest

from rl.training.badugi_decision_leak_discovery_draft import discover_badugi_decision_leaks


def row(index, *, active=3, made=3, gain=0, call_minus_fold=-1,
        facing=True, action=2, seed=None, private=False):
    decision = {'street': 2, 'action': action,
                'legalMask': [1, 0, 1, 0, 1, 0] if facing else [0, 1, 0, 1, 0, 0],
                'madeCards': made, 'highRank': 9, 'madeCardGain': gain,
                'toCallBb': 2 if facing else 0, 'potBb': 10,
                'activePlayers': active}
    result = {'pairIndex': index, 'seed': index + 1000 if seed is None else seed,
              'group': [6, 6, 'cash'], 'profile': 'balanced_range', 'heroSeat': 0,
              'arms': {'checkpoint31': {'heroBetDecisions': [decision]}}}
    if facing and action == 2:
        result['branch'] = {'targetBetOrdinal': 0,
            'context': {'madeCardGain': gain, 'toCallBb': 2,
                        'activePlayers': active,
                        'opponentLastDrawCounts': {'1': 1},
                        'sameHandPublicBetActions': 2,
                        'current': {'madeCards': made, 'highRank': 9}},
            'foldBigBets': 0, 'callBigBets': call_minus_fold}
    if private:
        result['opponentPrivateCards'] = ['AH', '4C', '5S', '9D']
    return result


class LeakDiscoveryTests(unittest.TestCase):
    def test_counts_only_legal_facing_bet_opportunities(self):
        report = discover_badugi_decision_leaks([
            row(0), row(1, facing=False, action=1), row(2, action=4)],
            minimum_branch_sessions=2)
        street = report['opportunityCells']['street=2']
        self.assertEqual(street, {'facingBet': 2, 'call': 1, 'raise': 1})
        self.assertEqual(report['pairedBranchSessions'], 1)
        self.assertFalse(report['actionOverrideAllowed'])
        self.assertFalse(report['modelPromotionAllowed'])

    def test_actual_deck_alias_is_not_an_independent_session(self):
        with self.assertRaisesRegex(ValueError, 'actual deck seed'):
            discover_badugi_decision_leaks([
                row(0, seed=123), row(1, seed=123 + 2**32)])

    def test_private_opponent_cards_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'private'):
            discover_badugi_decision_leaks([row(0, private=True)])

    def test_branch_must_match_the_selected_public_state(self):
        changed = row(0)
        changed['branch']['context']['madeCardGain'] = 1
        with self.assertRaisesRegex(ValueError, 'branch does not match'):
            discover_badugi_decision_leaks([changed])

    def test_worsened_hand_is_not_counted_as_unchanged(self):
        report = discover_badugi_decision_leaks([
            row(0, gain=0), row(1, gain=-1)], minimum_branch_sessions=2)
        self.assertEqual(report['opportunityCells'][
            'street=2|madeCards=3|madeCardGain=unchanged|activePlayers=3_plus'
        ]['facingBet'], 1)
        self.assertEqual(report['opportunityCells'][
            'street=2|madeCards=3|madeCardGain=worsened|activePlayers=3_plus'
        ]['facingBet'], 1)

    def test_rejects_hero_seat_outside_occupied_table(self):
        invalid = row(0)
        invalid['group'][0] = 3
        invalid['group'][1] = 3
        invalid['heroSeat'] = 3
        with self.assertRaisesRegex(ValueError, 'hero seat'):
            discover_badugi_decision_leaks([invalid])

    def test_public_opponent_actions_enter_discovery_slices(self):
        rows = [row(i) for i in range(40)]
        for changed in rows[20:]:
            changed['branch']['context']['opponentLastDrawCounts'] = {'1': 0}
        for changed in rows[10:20] + rows[30:]:
            changed['branch']['context']['sameHandPublicBetActions'] = 1
        report = discover_badugi_decision_leaks(
            rows, minimum_branch_sessions=2, max_ranked_hypotheses=100)
        self.assertTrue(any('opponentLastDraw=one_card_draw_seen' in
                            cell['slice'] for cell in report['rankedHypotheses']))
        self.assertTrue(any('publicBetActions=two_plus' in
                            cell['slice'] for cell in report['rankedHypotheses']))

    def test_ranks_a_multiway_no_gain_hypothesis_without_authorizing_it(self):
        rows = [row(i, active=3, call_minus_fold=-1) for i in range(40)]
        rows += [row(i + 40, active=2, call_minus_fold=1) for i in range(40)]
        report = discover_badugi_decision_leaks(rows, minimum_branch_sessions=30,
                                                max_ranked_hypotheses=100)
        self.assertTrue(any(
            'activePlayers=3_plus' in cell['slice'] and
            cell['callMinusFoldBigBetsPerSelectedHand'] == -1
            for cell in report['rankedHypotheses']))
        self.assertTrue(report['requiresFreshSeedConfirmation'])
        self.assertTrue(report['requiresNaturalMultiHandPolicyEv'])
        self.assertFalse(report['actionOverrideAllowed'])


if __name__ == '__main__':
    unittest.main()
