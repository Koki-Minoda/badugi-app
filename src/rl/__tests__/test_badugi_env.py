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

    def test_reset_clears_terminal_state(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.step(0)
        env.reset(seed=2)

        self.assertIsNone(env.last_result)
        self.assertIsNone(env.terminal_reason)


if __name__ == "__main__":
    unittest.main()
