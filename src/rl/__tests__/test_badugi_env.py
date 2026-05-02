import unittest
from itertools import combinations

from rl.env.badugi_env import (
    BadugiEnv,
    OPPONENT_PROFILES,
    build_deck,
    compare_badugi_scores,
    evaluate_badugi,
    resolve_opponent_profile,
    starting_score_percentile,
)
from rl.training.benchmark_badugi_human_practice import summarize_human_logs
from rl.training.gate_badugi_model import summarize_runs


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

    def test_evaluator_prefers_more_cards_over_greedy_low_rank(self):
        self.assertEqual(
            evaluate_badugi([(0, 0), (0, 1), (0, 2), (1, 0)]),
            (2, [0, 1]),
        )

    def test_evaluator_matches_bruteforce_for_all_starting_hands(self):
        def brute_force_score(hand):
            best = (0, [])
            for subset_size in range(1, 5):
                for subset in combinations(hand, subset_size):
                    ranks = [rank for rank, _suit in subset]
                    suits = [suit for _rank, suit in subset]
                    if len(set(ranks)) != len(ranks) or len(set(suits)) != len(suits):
                        continue
                    candidate = (len(subset), sorted(ranks))
                    if compare_badugi_scores(candidate, best) > 0:
                        best = candidate
            return best

        for hand in combinations(build_deck(), 4):
            self.assertEqual(evaluate_badugi(hand), brute_force_score(hand))

    def test_player_fold_ends_hand_without_showdown_override(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.pot = 10
        env.current_bet = 1
        env.player_bet = 0
        _obs, _reward, terminated, _truncated, _info = env.step(0)

        self.assertTrue(terminated)
        self.assertEqual(env.last_result, -1)
        self.assertEqual(env.terminal_reason, "player_fold")
        self.assertEqual(env.pot, 0)
        self.assertLess(_reward, 0)

    def test_reset_clears_terminal_state(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.current_bet = 1
        env.player_bet = 0
        env.step(0)
        env.reset(seed=2)

        self.assertIsNone(env.last_result)
        self.assertIsNone(env.terminal_reason)

    def test_gate_summary_tracks_worst_profile(self):
        summary = summarize_runs(
            [
                {
                    "episodes": 10,
                    "showdowns": 8,
                    "wins": 4,
                    "folds": 1,
                    "avgReward": 1.5,
                    "opponentProfile": "balanced",
                    "actionCounts": {"0": 1},
                    "evDiagnostics": {"profitableFoldMisses": 1},
                },
                {
                    "episodes": 10,
                    "showdowns": 5,
                    "wins": 1,
                    "folds": 4,
                    "avgReward": -0.25,
                    "opponentProfile": "draw_heavy",
                    "actionCounts": {"0": 4},
                    "evDiagnostics": {"profitableFoldMisses": 3},
                },
            ]
        )

        self.assertEqual(summary["worstProfile"], "draw_heavy")
        self.assertEqual(summary["worstProfileAvgReward"], -0.25)
        self.assertIn("draw_heavy", summary["profileSummaries"])
        self.assertEqual(summary["evDiagnostics"]["profitableFoldMisses"], 4)

    def test_human_practice_log_summary_marks_verified_logs(self):
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "human.jsonl"
            path.write_text(
                "\n".join(
                    [
                        '{"heroResult":"win"}',
                        '{"heroResult":"loss"}',
                        '{"heroNet":0}',
                    ]
                ),
                encoding="utf8",
            )

            summary = summarize_human_logs(path, min_hands=3)

        self.assertTrue(summary["verified"])
        self.assertEqual(summary["hands"], 3)
        self.assertEqual(summary["wins"], 1)
        self.assertEqual(summary["losses"], 1)
        self.assertEqual(summary["ties"], 1)

    def test_human_practice_log_summary_accepts_nested_human_benchmark_records(self):
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "human.jsonl"
            path.write_text(
                "\n".join(
                    [
                        '{"humanBenchmark":{"heroResult":"win"}}',
                        '{"humanBenchmark":{"heroNet":-20}}',
                        '{"heroNet":0}',
                    ]
                ),
                encoding="utf8",
            )

            summary = summarize_human_logs(path, min_hands=3)

        self.assertTrue(summary["verified"])
        self.assertEqual(summary["wins"], 1)
        self.assertEqual(summary["losses"], 1)
        self.assertEqual(summary["ties"], 1)

    def test_showdown_result_is_returned_as_terminal_reward(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.round = env.max_rounds
        env.player_hand = [(0, 0), (1, 1), (2, 2), (3, 3)]
        env.opponent_hand = [(0, 0), (3, 1), (5, 2), (7, 3)]

        _obs, reward, terminated, _truncated, _info = env.step(2)

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
        env.current_bet = 0
        env.player_bet = 0

        self.assertEqual(env.legal_action_mask().tolist(), [0, 1, 0, 1, 0, 0])

        env.phase = "BET"
        env.current_bet = 1
        env.player_bet = 0

        self.assertEqual(env.legal_action_mask().tolist(), [1, 0, 1, 0, 1, 0])

        env.phase = "DRAW"
        self.assertEqual(env.legal_action_mask().tolist(), [1, 1, 1, 1, 0, 0])

    def test_player_gets_draw_decision_after_betting_round(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.current_bet = 1
        env.player_bet = 0

        env.step(2)

        self.assertFalse(env.done)
        self.assertEqual(env.phase, "DRAW")
        self.assertEqual(env.legal_action_mask().tolist(), [1, 1, 1, 1, 0, 0])

    def test_player_draw_and_opponent_draw_complete_before_next_bet_round(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "DRAW"
        env.round = 0
        env.deck = [(9, 0), (10, 1), (11, 2), (12, 3), (8, 0), (7, 1)]
        env.player_hand = [(0, 0), (5, 0), (1, 1), (8, 1)]
        env.opponent_hand = [(0, 0), (6, 0), (2, 1), (9, 1)]

        env.step(2)

        self.assertEqual(env.phase, "BET")
        self.assertEqual(env.round, 1)
        self.assertIn((0, 0), env.player_hand)
        self.assertIn((1, 1), env.player_hand)
        self.assertEqual(env.opponent_last_draw, 2)

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
        weak_env.current_bet = 1
        weak_env.player_bet = 0
        weak_env.player_hand = [(12, 0), (12, 1), (12, 2), (12, 3)]
        _obs, weak_reward, _terminated, _truncated, _info = weak_env.step(0)

        strong_env = BadugiEnv()
        strong_env.reset(seed=1)
        strong_env.current_bet = 1
        strong_env.player_bet = 0
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
        self.assertGreater(
            OPPONENT_PROFILES["loose_aggressive"].bluff_frequency,
            OPPONENT_PROFILES["tight_passive"].bluff_frequency,
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
        self.assertGreater(obs[48], 0)  # estimated equity
        self.assertGreater(obs[49], 0)  # EV pot odds
        self.assertGreaterEqual(obs[50], -1)  # call EV
        self.assertGreater(obs[52], 0)  # draw equity
        self.assertGreater(obs[54], 0)  # future street value
        self.assertGreater(obs[55], 0)  # cheap draw continue value

    def test_sixmax_context_adds_dead_money_position_and_multiway_pressure(self):
        env = BadugiEnv(table_size=6, hero_position=0)
        obs, _info = env.reset(seed=1)

        self.assertEqual(env.table_size, 6)
        self.assertEqual(env.hero_position, 0)
        self.assertGreater(env.pot, 0)
        self.assertEqual(env._player_is_first_to_act(), 1)
        self.assertGreater(env._multiway_pressure(), 0)
        self.assertGreater(obs[56], 0)  # active opponent count
        self.assertGreater(obs[57], 0)  # multiway pressure

    def test_range_equity_percentile_orders_strong_badugi_above_trash(self):
        strong = starting_score_percentile(evaluate_badugi([(0, 0), (1, 1), (2, 2), (3, 3)]))
        trash = starting_score_percentile(evaluate_badugi([(12, 0), (12, 1), (12, 2), (12, 3)]))

        self.assertGreater(strong, 0.99)
        self.assertLess(trash, 0.10)

    def test_late_sixmax_position_has_less_pressure_than_early_position(self):
        early = BadugiEnv(table_size=6, hero_position=0)
        late = BadugiEnv(table_size=6, hero_position=5)
        early.reset(seed=1)
        late.reset(seed=1)

        self.assertGreater(early._multiway_pressure(), late._multiway_pressure())
        self.assertEqual(late.is_button, 1)

    def test_sixmax_rewards_value_bet_over_check_with_strong_made_hand(self):
        env = BadugiEnv(table_size=6, hero_position=5)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.current_bet = 0
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (3, 2), (7, 3)]
        features = env._hand_features(env.player_hand)

        check_reward = env._reward_shaping(features, 1)
        bet_reward = env._reward_shaping(features, 3)

        self.assertGreater(bet_reward, check_reward)
        self.assertEqual(env.legal_action_mask().tolist(), [0, 1, 0, 1, 0, 0])

    def test_sixmax_rewards_late_position_semibluff_over_check(self):
        env = BadugiEnv(table_size=6, hero_position=5)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.current_bet = 0
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]
        features = env._hand_features(env.player_hand)

        check_reward = env._reward_shaping(features, 1)
        bet_reward = env._reward_shaping(features, 3)

        self.assertGreater(bet_reward, check_reward)
        self.assertEqual(env.legal_action_mask().tolist(), [0, 1, 0, 1, 0, 0])

    def test_sixmax_allows_positive_ev_isolation_raise(self):
        env = BadugiEnv(table_size=6, hero_position=4)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.pot = 40
        env.current_bet = 1
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (3, 2), (7, 3)]
        features = env._hand_features(env.player_hand)

        call_reward = env._reward_shaping(features, 2)
        raise_reward = env._reward_shaping(features, 4)

        self.assertGreater(raise_reward, 0)

    def test_sixmax_penalizes_negative_ev_isolation_raise(self):
        env = BadugiEnv(table_size=6, hero_position=1)
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.pot = 6
        env.current_bet = 1
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (8, 2), (12, 2)]
        features = env._hand_features(env.player_hand)

        call_reward = env._reward_shaping(features, 2)
        raise_reward = env._reward_shaping(features, 4)

        self.assertLess(raise_reward, call_reward)

    def test_sixmax_isolation_pressure_raises_fold_equity_for_strong_late_spot(self):
        early = BadugiEnv(table_size=6, hero_position=0)
        early.reset(seed=1)
        early.phase = "BET"
        early.round = 1
        early.pot = 18
        early.current_bet = 1
        early.player_bet = 0
        early.player_hand = [(0, 0), (1, 1), (3, 2), (7, 3)]

        late = BadugiEnv(table_size=6, hero_position=5)
        late.reset(seed=1)
        late.phase = "BET"
        late.round = early.round
        late.pot = early.pot
        late.current_bet = early.current_bet
        late.player_bet = early.player_bet
        late.player_hand = list(early.player_hand)
        late.opponent_action_count = early.opponent_action_count
        late.opponent_fold_count = early.opponent_fold_count

        early_ev = early._bet_ev_diagnostic(early._hand_features(early.player_hand), to_call=1)
        late_ev = late._bet_ev_diagnostic(late._hand_features(late.player_hand), to_call=1)

        self.assertGreater(late_ev.fold_equity, early_ev.fold_equity)
        self.assertGreater(late._get_obs()[58], 0.5)  # range equity percentile
        self.assertGreater(late._get_obs()[59], 0)  # isolation pressure

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

    def test_ev_diagnostic_marks_one_away_draw_call_profitable_at_good_price(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.pot = 24
        env.current_bet = 1
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]
        features = env._hand_features(env.player_hand)

        ev = env._bet_ev_diagnostic(features, to_call=1)

        self.assertGreater(ev.draw_equity, 0)
        self.assertGreater(ev.future_street_value, 0)
        self.assertGreater(ev.cheap_draw_continue_value, 0)
        self.assertLess(ev.pot_odds, ev.estimated_equity)
        self.assertGreater(ev.call_ev, ev.fold_ev)

    def test_future_street_value_is_zero_on_final_betting_round(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.round = env.max_rounds
        env.pot = 24
        env.current_bet = 2
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]
        features = env._hand_features(env.player_hand)

        ev = env._bet_ev_diagnostic(features, to_call=2)

        self.assertEqual(ev.future_street_value, 0)
        self.assertGreaterEqual(ev.call_ev, -2)

    def test_fold_penalty_is_higher_when_one_away_call_ev_is_positive(self):
        good_price_env = BadugiEnv()
        good_price_env.reset(seed=1)
        good_price_env.phase = "BET"
        good_price_env.round = 1
        good_price_env.pot = 24
        good_price_env.current_bet = 1
        good_price_env.player_bet = 0
        good_price_env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]
        good_price_features = good_price_env._hand_features(good_price_env.player_hand)

        bad_price_env = BadugiEnv()
        bad_price_env.reset(seed=1)
        bad_price_env.phase = "BET"
        bad_price_env.round = 1
        bad_price_env.pot = 2
        bad_price_env.current_bet = 4
        bad_price_env.player_bet = 0
        bad_price_env.player_hand = list(good_price_env.player_hand)
        bad_price_features = bad_price_env._hand_features(bad_price_env.player_hand)

        self.assertLess(
            good_price_env._reward_shaping(good_price_features, 0),
            bad_price_env._reward_shaping(bad_price_features, 0),
        )

    def test_step_info_exposes_ev_diagnostic_for_betting_actions(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.round = 1
        env.pot = 12
        env.current_bet = 1
        env.player_bet = 0
        env.player_hand = [(0, 0), (1, 1), (6, 2), (12, 2)]

        _obs, _reward, _terminated, _truncated, info = env.step(2)

        self.assertIsNotNone(info["ev"])
        self.assertEqual(info["ev"]["phase"], "BET")
        self.assertIn("callEV", info["ev"])
        self.assertIn("estimatedEquity", info["ev"])

    def test_final_bet_context_is_reached_after_third_draw(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "DRAW"
        env.round = env.max_rounds - 1

        _reward = env._handle_draw_action(0)

        self.assertFalse(env.done)
        self.assertEqual(env.phase, "BET")
        self.assertEqual(env.round, env.max_rounds)

        env._maybe_advance_from_bet()

        self.assertTrue(env.done)
        self.assertEqual(env.terminal_reason, "showdown")

    def test_opponent_pat_advances_draw_phase_to_bet(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "DRAW"
        env.opponent_hand = [(0, 0), (1, 1), (2, 2), (3, 3)]

        env._opponent_draw_action()

        self.assertEqual(env.opponent_last_draw, 0)
        self.assertEqual(env.phase, "BET")
        self.assertGreaterEqual(env.current_bet, 0)

    def test_k_badugi_is_worse_on_final_bet_than_early_street(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.player_hand = [(0, 0), (5, 1), (9, 2), (12, 3)]
        features = env._hand_features(env.player_hand)
        env.round = 0
        early_strength = env._street_adjusted_strength(features)
        env.round = env.max_rounds
        final_strength = env._street_adjusted_strength(features)

        self.assertGreater(early_strength, final_strength)
        self.assertTrue(env._is_weak_final_badugi(features))

    def test_final_bet_bluff_is_better_after_opponent_two_card_draw(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.round = env.max_rounds
        env.current_bet = 2
        env.player_bet = 0
        env.player_hand = [(0, 0), (5, 1), (9, 2), (12, 3)]
        features = env._hand_features(env.player_hand)

        env.opponent_last_draw = 0
        pat_reward = env._reward_shaping(features, 3)
        env.opponent_last_draw = 2
        two_draw_reward = env._reward_shaping(features, 3)

        self.assertGreater(two_draw_reward, pat_reward)

    def test_observation_exposes_opponent_tendency_features(self):
        env = BadugiEnv(opponent_profile="loose_aggressive")
        env.reset(seed=1)
        env._record_opponent_action("raise")
        env._record_opponent_action("check")
        env._record_opponent_draw(0)
        env._record_opponent_draw(2)

        obs = env._get_obs()

        self.assertGreater(obs[42], 0)  # observed aggression
        self.assertGreater(obs[43], 0)  # observed passivity
        self.assertGreater(obs[44], 0)  # pat pressure
        self.assertGreater(obs[45], 0)  # average draw count
        self.assertGreater(obs[46], 0)  # foldability estimate
        self.assertGreater(obs[47], 0)  # profile bluff frequency

    def test_bluff_opportunity_depends_on_opponent_foldability(self):
        foldable_env = BadugiEnv(opponent_profile="tight_passive")
        foldable_env.reset(seed=1)
        foldable_env.phase = "BET"
        foldable_env.round = 1
        foldable_env.is_button = 0
        foldable_env.current_bet = 0
        foldable_env.player_bet = 0
        foldable_env.player_hand = [(0, 0), (6, 1), (6, 2), (12, 3)]
        foldable_features = foldable_env._hand_features(foldable_env.player_hand)

        sticky_env = BadugiEnv(opponent_profile="loose_passive")
        sticky_env.reset(seed=1)
        sticky_env.phase = "BET"
        sticky_env.round = 1
        sticky_env.is_button = 0
        sticky_env.current_bet = 0
        sticky_env.player_bet = 0
        sticky_env.player_hand = list(foldable_env.player_hand)
        sticky_features = sticky_env._hand_features(sticky_env.player_hand)

        self.assertGreater(
            foldable_env._reward_shaping(foldable_features, 3),
            sticky_env._reward_shaping(sticky_features, 3),
        )

    def test_showdown_ready_hand_prefers_call_over_fold(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.phase = "BET"
        env.round = env.max_rounds
        env.pot = 18
        env.current_bet = 2
        env.player_bet = 0
        env.player_hand = [(0, 0), (3, 1), (6, 2), (8, 3)]
        features = env._hand_features(env.player_hand)

        fold_reward = env._reward_shaping(features, 0)
        call_reward = env._reward_shaping(features, 2)

        self.assertGreater(call_reward, fold_reward)

    def test_terminal_reward_values_showdown_more_than_fold_win(self):
        fold_env = BadugiEnv()
        fold_env.reset(seed=1)
        fold_env.terminal_reason = "opponent_fold"
        fold_env.done = True
        fold_env.player_stack = fold_env.starting_stack + 4

        showdown_env = BadugiEnv()
        showdown_env.reset(seed=1)
        showdown_env.terminal_reason = "showdown"
        showdown_env.last_result = 1
        showdown_env.done = True
        showdown_env.player_stack = showdown_env.starting_stack + 4

        self.assertGreater(showdown_env._terminal_reward(), fold_env._terminal_reward())

    def test_non_terminal_shaping_reward_is_capped(self):
        env = BadugiEnv()

        self.assertEqual(env._cap_shaping_reward(10.0), 1.0)
        self.assertEqual(env._cap_shaping_reward(-10.0), -1.0)

    def test_player_fold_terminal_reward_is_negative(self):
        env = BadugiEnv()
        env.reset(seed=1)
        env.done = True
        env.terminal_reason = "player_fold"
        env.player_stack = env.starting_stack

        self.assertLess(env._terminal_reward(), 0)


if __name__ == "__main__":
    unittest.main()
