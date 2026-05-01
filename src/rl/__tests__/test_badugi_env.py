import unittest

from rl.env.badugi_env import BadugiEnv, compare_badugi_scores, evaluate_badugi


class BadugiEnvTest(unittest.TestCase):
    def test_lower_ranks_win_when_made_card_count_matches(self):
        four_high = evaluate_badugi([(0, 0), (1, 1), (2, 2), (3, 3)])
        eight_high = evaluate_badugi([(0, 0), (3, 1), (5, 2), (7, 3)])

        self.assertEqual(compare_badugi_scores(four_high, eight_high), 1)
        self.assertEqual(compare_badugi_scores(eight_high, four_high), -1)

    def test_more_made_badugi_cards_win_before_rank_comparison(self):
        three_card = evaluate_badugi([(0, 0), (1, 0), (2, 1), (3, 2)])
        four_card = evaluate_badugi([(8, 0), (9, 1), (10, 2), (11, 3)])

        self.assertEqual(compare_badugi_scores(four_card, three_card), 1)
        self.assertEqual(compare_badugi_scores(three_card, four_card), -1)

    def test_player_fold_ends_hand_without_showdown_override(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.pot = 10
        _obs, _reward, terminated, _truncated, _info = env.step(0)

        self.assertTrue(terminated)
        self.assertEqual(env.last_result, -1)
        self.assertEqual(env.terminal_reason, "player_fold")
        self.assertEqual(env.pot, 0)
        self.assertLessEqual(_reward, -2.0)

    def test_reset_clears_terminal_state(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.step(0)
        env.reset(seed=2)

        self.assertIsNone(env.last_result)
        self.assertIsNone(env.terminal_reason)

    def test_showdown_result_is_returned_as_terminal_reward(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "DRAW"
        env.round = env.max_rounds - 1
        env.player_hand = [(0, 0), (1, 1), (2, 2), (3, 3)]
        env.opponent_hand = [(0, 0), (3, 1), (5, 2), (7, 3)]

        _obs, reward, terminated, _truncated, _info = env.step(0)

        self.assertTrue(terminated)
        self.assertEqual(env.terminal_reason, "showdown")
        self.assertEqual(env.last_result, 1)
        self.assertGreaterEqual(reward, 2.0)

    def test_action_five_is_limit_raise_alias_not_all_in(self):
        env = BadugiEnv()
        env.reset(seed=1)
        starting_stack = env.player_stack
        bet_size = env._bet_size()

        env.step(5)

        self.assertGreaterEqual(env.player_stack, starting_stack - bet_size * 2)
        self.assertFalse(env.player_all_in)

    def test_legal_action_mask_matches_bet_and_draw_phases(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.current_bet = 1
        env.player_bet = 0

        self.assertEqual(env.legal_action_mask().tolist(), [1, 0, 1, 0, 1, 0])

        env.phase = "DRAW"
        self.assertEqual(env.legal_action_mask().tolist(), [1, 1, 1, 1, 0, 0])

    def test_illegal_action_uses_safe_fallback_with_penalty(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.current_bet = 1
        env.player_bet = 0
        starting_stack = env.player_stack

        _obs, reward, terminated, _truncated, _info = env.step(5)

        self.assertFalse(terminated)
        self.assertLess(reward, 0)
        self.assertLess(env.player_stack, starting_stack)

    def test_player_draw_keeps_low_unique_badugi_cards(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.deck = [(9, 0), (10, 1), (11, 2), (12, 3)]
        env.player_hand = [(0, 0), (5, 0), (1, 1), (8, 1)]

        env._handle_draw_action(2)

        self.assertIn((0, 0), env.player_hand)
        self.assertIn((1, 1), env.player_hand)
        self.assertNotIn((5, 0), env.player_hand)
        self.assertNotIn((8, 1), env.player_hand)


if __name__ == "__main__":
    unittest.main()
