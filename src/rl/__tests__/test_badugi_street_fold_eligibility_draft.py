"""Street and fixed-limit price regression tests for an isolated study."""
import unittest

from rl.training.badugi_street_fold_eligibility_draft import eligible_postdraw_fold_street


BASE = dict(natural_action=2, legal_mask=[1, 0, 1, 0, 1, 0],
            made_cards=3, made_card_gain=0, active_players=3)


class StreetFoldEligibilityTests(unittest.TestCase):
    def test_full_small_bet_after_first_draw(self):
        self.assertEqual(eligible_postdraw_fold_street(
            street=1, to_call_bb=1, **BASE), 1)
        self.assertIsNone(eligible_postdraw_fold_street(
            street=1, to_call_bb=0.5, **BASE))

    def test_full_big_bet_after_second_and_third_draw(self):
        for street in (2, 3):
            with self.subTest(street=street):
                self.assertEqual(eligible_postdraw_fold_street(
                    street=street, to_call_bb=2, **BASE), street)
                self.assertIsNone(eligible_postdraw_fold_street(
                    street=street, to_call_bb=1, **BASE))

    def test_predraw_does_not_share_no_improvement_rule(self):
        self.assertIsNone(eligible_postdraw_fold_street(
            street=0, to_call_bb=1, **BASE))

    def test_strong_hand_and_heads_up_are_not_forced_to_fold(self):
        for override in (dict(made_cards=4), dict(made_card_gain=1),
                         dict(active_players=2)):
            args = {**BASE, **override}
            with self.subTest(override=override):
                self.assertIsNone(eligible_postdraw_fold_street(
                    street=3, to_call_bb=2, **args))

    def test_natural_raise_or_illegal_fold_is_not_changed(self):
        self.assertIsNone(eligible_postdraw_fold_street(
            street=2, to_call_bb=2,
            **{**BASE, 'natural_action': 4}))
        self.assertIsNone(eligible_postdraw_fold_street(
            street=2, to_call_bb=2,
            **{**BASE, 'legal_mask': [0, 1, 1, 0, 1, 0]}))

    def test_malformed_public_state_is_rejected(self):
        with self.assertRaises(ValueError):
            eligible_postdraw_fold_street(street=2, to_call_bb=float('nan'), **BASE)
        with self.assertRaises(ValueError):
            eligible_postdraw_fold_street(street=2, to_call_bb=2,
                                          **{**BASE, 'legal_mask': [1, 0, 0, 0, 1, 0]})


if __name__ == '__main__':
    unittest.main()
