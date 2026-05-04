import unittest

from rl.training.badugi_starting_ranges import (
    classify_starting_hand,
    median_starting_score_key,
    teacher_action,
)
from rl.training.train_dqn import first_in_value_bet_action, profitable_continue_action
from rl.env.badugi_env import BadugiEnv


class BadugiStartingRangesTest(unittest.TestCase):
    def test_median_starting_score_is_available(self):
        self.assertEqual(len(median_starting_score_key()), 5)

    def test_a27_one_away_is_premium_heads_up_continue(self):
        hand_range = classify_starting_hand([(0, 0), (1, 1), (6, 2), (12, 2)])

        self.assertTrue(hand_range.is_a27_or_better)
        self.assertTrue(hand_range.is_premium)
        self.assertTrue(hand_range.should_continue_heads_up)

    def test_weak_duplicates_are_not_automatic_continue(self):
        hand_range = classify_starting_hand([(12, 0), (12, 1), (11, 0), (10, 0)])

        self.assertFalse(hand_range.is_premium)
        self.assertLess(hand_range.one_draw_top_half_probability, 0.5)

    def test_teacher_opens_a27_and_folds_trash_when_facing_bet(self):
        open_env = BadugiEnv()
        open_env.reset(seed=1)
        open_env.phase = "BET"
        open_env.current_bet = 0
        open_env.player_bet = 0
        open_env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]

        self.assertIn(teacher_action(open_env), (3, 4))

        fold_env = BadugiEnv()
        fold_env.reset(seed=1)
        fold_env.phase = "BET"
        fold_env.current_bet = 2
        fold_env.player_bet = 0
        fold_env.player_hand = [(12, 0), (12, 1), (11, 0), (10, 0)]

        self.assertEqual(teacher_action(fold_env), 0)

    def test_teacher_draw_count_matches_badugi_shape(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "DRAW"
        env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]

        self.assertEqual(teacher_action(env), 1)

    def test_teacher_folds_unmade_hand_on_final_street_bet(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.round = env.max_rounds
        env.current_bet = 2
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]

        self.assertEqual(teacher_action(env), 0)

    def test_teacher_calls_cheap_developing_draw_before_final_street(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.pot = 24
        env.current_bet = 1
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]

        self.assertEqual(teacher_action(env), 2)

    def test_teacher_profile_aware_continue_calls_draw_heavy_marginal_price(self):
        hand = [(0, 0), (0, 1), (0, 2), (1, 0)]
        balanced = BadugiEnv(opponent_profile="balanced", table_size=6, hero_position=1)
        balanced.reset(seed=1)
        balanced.phase = "BET"
        balanced.round = 1
        balanced.pot = 2
        balanced.current_bet = 1
        balanced.player_bet = 0
        balanced.player_hand = hand

        draw_heavy = BadugiEnv(opponent_profile="draw_heavy", table_size=6, hero_position=1)
        draw_heavy.reset(seed=1)
        draw_heavy.phase = "BET"
        draw_heavy.round = 1
        draw_heavy.pot = 2
        draw_heavy.current_bet = 1
        draw_heavy.player_bet = 0
        draw_heavy.player_hand = hand

        self.assertEqual(teacher_action(balanced), 0)
        self.assertEqual(teacher_action(draw_heavy), 2)

    def test_profitable_continue_action_marks_ev_call_state_for_margin_training(self):
        env = BadugiEnv(opponent_profile="balanced", table_size=6, hero_position=2)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.pot = 24
        env.current_bet = 1
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]

        self.assertEqual(profitable_continue_action(env), 2)

    def test_profitable_continue_action_skips_rough_final_payoff(self):
        env = BadugiEnv(opponent_profile="balanced", table_size=6, hero_position=2)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = env.max_rounds
        env.pot = 18
        env.current_bet = 2
        env.player_bet = 0
        env.opponent_last_draw = 0
        env.player_hand = [(0, 0), (5, 1), (9, 2), (12, 3)]

        self.assertIsNone(profitable_continue_action(env))

    def test_sixmax_teacher_value_bets_strong_made_hand(self):
        env = BadugiEnv(table_size=6, hero_position=5)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.current_bet = 0
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (3, 2), (7, 3)]

        self.assertEqual(teacher_action(env), 3)

    def test_sixmax_teacher_semibluffs_late_position_one_away(self):
        env = BadugiEnv(table_size=6, hero_position=5)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.current_bet = 0
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]

        self.assertEqual(teacher_action(env), 3)

    def test_sixmax_teacher_isolation_raises_strong_hand_facing_bet(self):
        env = BadugiEnv(table_size=6, hero_position=4)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.pot = 18
        env.current_bet = 1
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (3, 2), (7, 3)]

        self.assertEqual(teacher_action(env), 4)

    def test_sixmax_teacher_thin_value_bets_against_passive_drawer(self):
        env = BadugiEnv(opponent_profile="loose_passive", table_size=6, hero_position=5)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.current_bet = 0
        env.player_bet = 0
        env.player_hand = [(0, 0), (2, 1), (5, 2), (9, 3)]
        env._record_opponent_action("call")
        env._record_opponent_action("check")
        env._record_opponent_draw(2)
        env._record_opponent_draw(3)

        self.assertEqual(teacher_action(env), 3)

    def test_first_in_value_bet_fixture_marks_passive_drawer_sample(self):
        env = BadugiEnv(opponent_profile="loose_passive", table_size=6, hero_position=5)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.current_bet = 0
        env.player_bet = 0
        env.player_hand = [(0, 0), (2, 1), (5, 2), (9, 3)]
        env._record_opponent_action("call")
        env._record_opponent_action("check")
        env._record_opponent_draw(2)
        env._record_opponent_draw(3)

        self.assertEqual(first_in_value_bet_action(env), 3)
        self.assertEqual(teacher_action(env), 3)

    def test_sixmax_teacher_thin_isolation_raises_exploitable_drawer(self):
        env = BadugiEnv(opponent_profile="draw_heavy", table_size=6, hero_position=5)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.pot = 40
        env.current_bet = 1
        env.player_bet = 0
        env.player_hand = [(0, 0), (2, 1), (5, 2), (9, 3)]
        env._record_opponent_action("call")
        env._record_opponent_action("check")
        env._record_opponent_draw(2)
        env._record_opponent_draw(3)

        self.assertEqual(teacher_action(env), 4)

    def test_teacher_does_not_value_bet_rough_final_badugi_without_draw_signal(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.round = env.max_rounds
        env.current_bet = 0
        env.player_bet = 0
        env.opponent_last_draw = 0
        env.player_hand = [(0, 0), (3, 1), (8, 2), (12, 3)]

        self.assertEqual(teacher_action(env), 1)

    def test_first_in_value_bet_fixture_rejects_pat_pressure(self):
        env = BadugiEnv(opponent_profile="loose_passive", table_size=6, hero_position=5)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.current_bet = 0
        env.player_bet = 0
        env.player_hand = [(0, 0), (2, 1), (5, 2), (9, 3)]
        env._record_opponent_action("check")
        env._record_opponent_action("call")
        env._record_opponent_draw(0)
        env._record_opponent_draw(0)

        self.assertIsNone(first_in_value_bet_action(env))


if __name__ == "__main__":
    unittest.main()
