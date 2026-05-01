import unittest

from rl.env.badugi_env import (
    BadugiEnv,
    OPPONENT_PROFILES,
    compare_badugi_scores,
    evaluate_badugi,
    resolve_opponent_profile,
)


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
        self.assertLess(_reward, 0)

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

    def test_weak_fold_is_penalized_less_than_strong_fold(self):
        weak_env = BadugiEnv()
        weak_env.reset(seed=1)
        weak_env.player_hand = [(12, 0), (12, 1), (12, 2), (12, 3)]
        _obs, weak_reward, _terminated, _truncated, _info = weak_env.step(0)

        strong_env = BadugiEnv()
        strong_env.reset(seed=1)
        strong_env.player_hand = [(0, 0), (1, 1), (2, 2), (3, 3)]
        _obs, strong_reward, _terminated, _truncated, _info = strong_env.step(0)

        self.assertGreater(weak_reward, strong_reward)

    def test_opponent_profiles_expose_play_styles(self):
        self.assertLess(
            OPPONENT_PROFILES["loose_aggressive"].fold_probability,
            OPPONENT_PROFILES["tight_passive"].fold_probability,
        )
        self.assertGreater(
            OPPONENT_PROFILES["loose_aggressive"].raise_probability,
            OPPONENT_PROFILES["loose_passive"].raise_probability,
        )
        self.assertGreater(
            OPPONENT_PROFILES["draw_heavy"].draw_bias,
            OPPONENT_PROFILES["pat_heavy"].draw_bias,
        )

    def test_unknown_opponent_profile_fails_fast(self):
        with self.assertRaises(ValueError):
            resolve_opponent_profile("unknown-style")

    def test_env_can_switch_opponent_profile(self):
        env = BadugiEnv(opponent_profile="tight_passive")

        self.assertEqual(env.opponent_profile.name, "tight_passive")

        env.set_opponent_profile("loose_aggressive")

        self.assertEqual(env.opponent_profile.name, "loose_aggressive")

    def test_observation_exposes_hand_position_pot_odds_and_action_mask(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.player_hand = [(0, 0), (1, 1), (8, 1), (12, 2)]
        env.phase = "BET"
        env.round = 1
        env.pot = 12
        env.current_bet = 2
        env.player_bet = 0

        obs = env._get_obs()

        self.assertEqual(len(obs), 96)
        self.assertGreater(obs[22], 0)  # made cards
        self.assertGreater(obs[27], 0)  # starting hand strength
        self.assertGreater(obs[28], 0)  # fixed-limit pot odds
        self.assertIn(obs[29], (0.0, 1.0))  # position feature
        self.assertEqual(obs[32:38].tolist(), env.legal_action_mask().tolist())

    def test_fixed_limit_pot_odds_make_marginal_call_better_than_fold(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.pot = 40
        env.current_bet = 1
        env.player_bet = 0
        env.player_hand = [(0, 0), (4, 1), (11, 1), (12, 2)]
        features = env._hand_features(env.player_hand)

        fold_reward = env._reward_shaping(features, 0)
        call_reward = env._reward_shaping(features, 2)

        self.assertGreater(call_reward, fold_reward)


if __name__ == "__main__":
    unittest.main()
