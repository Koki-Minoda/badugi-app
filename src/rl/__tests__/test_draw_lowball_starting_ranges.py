"""Tests for draw_lowball_starting_ranges.

Covers:
- classify_lowball_starting_hand: hand class, is_made, is_premium, is_trash,
  open_from_positions, call_from_positions for both 2-7 and A-5.
- sixmax_draw_teacher_action: BET/DRAW phases, position-aware thresholds,
  single-draw tightening, final-street tightening.
- position_name: seat-to-position mapping.
"""

from __future__ import annotations

import unittest
from collections import deque
from unittest.mock import MagicMock

import numpy as np

from rl.training.draw_lowball_starting_ranges import (
    HAND_CLASS_ORDER,
    POSITION_CALL_THRESHOLDS,
    POSITION_NAMES_BY_BUTTON_OFFSET,
    POSITION_OPEN_THRESHOLDS,
    LowballStartingHandRange,
    classify_lowball_starting_hand,
    position_name,
    sixmax_draw_teacher_action,
)


# ---------------------------------------------------------------------------
# Card helpers
# ---------------------------------------------------------------------------

def c(rank: int | str, suit: int) -> tuple[int, int]:
    _face = {"T": 10, "J": 11, "Q": 12, "K": 13, "A": 14}
    r = _face[rank] if isinstance(rank, str) else int(rank)
    return (r, suit)


# Notable 2-7 hands
SEVEN_LOW_27   = [c(7,0), c(5,1), c(4,2), c(3,3), c(2,0)]  # 7-5-4-3-2 — premium
EIGHT_LOW_27   = [c(8,0), c(7,1), c(4,2), c(3,3), c(2,0)]  # 8-7-4-3-2 — strong
NINE_LOW_27    = [c(9,0), c(7,1), c(4,2), c(3,3), c(2,0)]  # 9-low — weak made (T=10 is must-discard in 2-7)
KQJHAND_27     = [c("K",0), c("Q",1), c("J",2), c(8,3), c(5,0)]  # 3-card draw; well below any 6-max call threshold
KT_DRAW_27     = [c("K",0), c("T",1), c(7,2), c(4,3), c(3,0)]  # K,T must-discard; 2-card draw to 7-4-3; norm≈0.60 (BTN call range)
JACK_DRAW_27   = [c("J",0), c(5,1), c(4,2), c(3,3), c(2,0)]# draw J → strong_draw
ACE_PAIR_27    = [c("A",0), c("A",1), c(8,2), c(5,3), c(2,0)] # pair of aces — draw
TRASH_27       = [c("K",0), c("K",1), c("Q",2), c("J",3), c("T",0)] # pure trash

# Notable A-5 hands
WHEEL_A5       = [c("A",0), c(2,1), c(3,2), c(4,3), c(5,0)] # A-2-3-4-5 — premium
SIX_LOW_A5     = [c("A",0), c(2,1), c(3,2), c(4,3), c(6,0)] # 6-low — strong
EIGHT_LOW_A5   = [c("A",0), c(2,1), c(3,2), c(5,3), c(8,0)] # 8-low — weak made
KING_DRAW_A5   = [c("A",0), c(2,1), c(3,2), c(4,3), c("K",0)] # draw K → strong_draw
TRASH_A5       = [c("K",0), c("K",1), c("Q",2), c("J",3), c("T",0)]


# ---------------------------------------------------------------------------
# classify_lowball_starting_hand — 2-7
# ---------------------------------------------------------------------------

class Classify27Test(unittest.TestCase):

    def test_seven_low_is_premium_made(self):
        r = classify_lowball_starting_hand(SEVEN_LOW_27, "low-27")
        self.assertEqual(r.hand_class, "made_low_premium")
        self.assertTrue(r.is_made)
        self.assertTrue(r.is_premium)
        self.assertFalse(r.is_trash)
        self.assertEqual(r.recommended_draw_count, 0)

    def test_eight_low_is_strong_made(self):
        r = classify_lowball_starting_hand(EIGHT_LOW_27, "low-27")
        self.assertEqual(r.hand_class, "made_low_strong")
        self.assertTrue(r.is_made)
        self.assertTrue(r.is_premium)
        self.assertEqual(r.recommended_draw_count, 0)

    def test_nine_low_is_weak_made(self):
        # T (rank 10) is a must-discard in 2-7, so the highest truly pat rank is 9.
        r = classify_lowball_starting_hand(NINE_LOW_27, "low-27")
        self.assertEqual(r.hand_class, "made_low_weak")
        self.assertTrue(r.is_made)
        self.assertFalse(r.is_premium)
        self.assertFalse(r.is_trash)
        self.assertEqual(r.recommended_draw_count, 0)

    def test_ten_low_is_strong_draw_not_made(self):
        # T in 2-7 is must_discard so T-7-4-3-2 is a 1-card draw, not a made pat hand.
        ten_low = [c(10,0), c(7,1), c(4,2), c(3,3), c(2,0)]
        r = classify_lowball_starting_hand(ten_low, "low-27")
        self.assertFalse(r.is_made)
        self.assertEqual(r.recommended_draw_count, 1)

    def test_jack_draw_is_strong_draw_not_made(self):
        r = classify_lowball_starting_hand(JACK_DRAW_27, "low-27")
        self.assertEqual(r.hand_class, "strong_draw")
        self.assertFalse(r.is_made)
        self.assertEqual(r.recommended_draw_count, 1)

    def test_pure_trash_classified_as_trash(self):
        r = classify_lowball_starting_hand(TRASH_27, "low-27")
        self.assertEqual(r.hand_class, "trash")
        self.assertTrue(r.is_trash)
        self.assertFalse(r.is_playable)
        self.assertEqual(r.draw_strength, 0.0)

    def test_open_from_positions_monotone_with_strength(self):
        premium = classify_lowball_starting_hand(SEVEN_LOW_27, "low-27")
        weak = classify_lowball_starting_hand(NINE_LOW_27, "low-27")
        # premium opens from at least as many positions as weak
        self.assertGreaterEqual(
            len(premium.open_from_positions), len(weak.open_from_positions)
        )

    def test_premium_opens_from_all_positions(self):
        r = classify_lowball_starting_hand(SEVEN_LOW_27, "low-27")
        for pos in ("UTG", "MP", "CO", "BTN", "SB"):
            self.assertIn(pos, r.open_from_positions, f"{pos} missing from premium open range")

    def test_call_positions_subset_of_or_equal_to_open_positions_for_strong(self):
        r = classify_lowball_starting_hand(SEVEN_LOW_27, "low-27")
        # call threshold <= open threshold so call set >= open set
        for pos in r.open_from_positions:
            self.assertIn(pos, r.call_from_positions)

    def test_flush_hand_is_not_made(self):
        flush_27 = [c(7,0), c(5,0), c(4,0), c(3,0), c(2,0)]
        r = classify_lowball_starting_hand(flush_27, "low-27")
        self.assertFalse(r.is_made, "Flush in 2-7 should not be treated as pat made hand")

    def test_straight_hand_is_not_made(self):
        straight_27 = [c(6,0), c(5,1), c(4,2), c(3,3), c(2,0)]
        r = classify_lowball_starting_hand(straight_27, "low-27")
        self.assertFalse(r.is_made, "Straight in 2-7 should not be treated as pat made hand")


# ---------------------------------------------------------------------------
# classify_lowball_starting_hand — A-5
# ---------------------------------------------------------------------------

class ClassifyA5Test(unittest.TestCase):

    def test_wheel_is_premium_made(self):
        r = classify_lowball_starting_hand(WHEEL_A5, "low-a5")
        self.assertEqual(r.hand_class, "made_low_premium")
        self.assertTrue(r.is_made)
        self.assertTrue(r.is_premium)
        self.assertEqual(r.recommended_draw_count, 0)
        self.assertEqual(r.highest_rank, 5)

    def test_six_low_is_strong_made(self):
        r = classify_lowball_starting_hand(SIX_LOW_A5, "low-a5")
        self.assertEqual(r.hand_class, "made_low_strong")
        self.assertTrue(r.is_made)
        self.assertEqual(r.recommended_draw_count, 0)

    def test_eight_low_is_weak_made(self):
        r = classify_lowball_starting_hand(EIGHT_LOW_A5, "low-a5")
        self.assertEqual(r.hand_class, "made_low_weak")
        self.assertTrue(r.is_made)
        self.assertFalse(r.is_premium)

    def test_king_draw_is_strong_draw(self):
        r = classify_lowball_starting_hand(KING_DRAW_A5, "low-a5")
        self.assertEqual(r.hand_class, "strong_draw")
        self.assertFalse(r.is_made)
        self.assertEqual(r.recommended_draw_count, 1)

    def test_ace_counts_as_low_in_a5(self):
        r = classify_lowball_starting_hand(WHEEL_A5, "low-a5")
        # effective highest rank should reflect ace-as-low (=1 internally),
        # but highest_rank stored is after lowball conversion which uses 1 for ace
        self.assertLessEqual(r.highest_rank, 5)

    def test_straight_is_fine_in_a5(self):
        # A-2-3-4-5 is a straight but should be premium in A-5
        r = classify_lowball_starting_hand(WHEEL_A5, "low-a5")
        self.assertEqual(r.hand_class, "made_low_premium")
        self.assertTrue(r.is_made)

    def test_wheel_opens_from_all_positions(self):
        r = classify_lowball_starting_hand(WHEEL_A5, "low-a5")
        for pos in ("UTG", "MP", "CO", "BTN", "SB"):
            self.assertIn(pos, r.open_from_positions)


# ---------------------------------------------------------------------------
# Hand class ordering sanity
# ---------------------------------------------------------------------------

class HandClassOrderTest(unittest.TestCase):

    def test_hand_class_order_is_complete(self):
        self.assertIn("made_low_premium", HAND_CLASS_ORDER)
        self.assertIn("trash", HAND_CLASS_ORDER)

    def test_all_classified_classes_are_in_order(self):
        samples = [
            (SEVEN_LOW_27, "low-27"),
            (TRASH_27, "low-27"),
            (JACK_DRAW_27, "low-27"),
            (WHEEL_A5, "low-a5"),
            (TRASH_A5, "low-a5"),
        ]
        for hand, family in samples:
            r = classify_lowball_starting_hand(hand, family)
            self.assertIn(r.hand_class, HAND_CLASS_ORDER, f"{hand}, {family}")

    def test_premium_stronger_than_strong_draw(self):
        premium_idx = HAND_CLASS_ORDER.index("made_low_premium")
        draw_idx = HAND_CLASS_ORDER.index("strong_draw")
        self.assertLess(premium_idx, draw_idx)


# ---------------------------------------------------------------------------
# sixmax_draw_teacher_action — helpers
# ---------------------------------------------------------------------------

def _make_env(
    *,
    family: str = "low-27",
    max_draws: int = 3,
    phase: str = "BET",
    draw_round: int = 0,
    current_bet: int = 0,
    raise_count: int = 0,
    hero_hand: list | None = None,
    hero_bet: int = 0,
    hero_stack: int = 100,
    pot: int = 3,
) -> MagicMock:
    from rl.env.draw_lowball_env_sixmax_selfplay import (
        BET, CALL, CHECK, DRAW_0, DRAW_5, FOLD, RAISE,
    )
    env = MagicMock()
    env.family = family
    env.max_draws = max_draws
    env.phase = phase
    env.draw_round = draw_round
    env.current_bet = current_bet
    env.raise_count = raise_count
    env.pot = pot
    env.hero_seat = 0
    env.players = [{
        "hand": hero_hand or list(SEVEN_LOW_27),
        "bet": hero_bet,
        "stack": hero_stack,
        "folded": False,
        "all_in": False,
        "draw_history": [0, 0, 0],
        "last_draw": 0,
        "total_draws": 0,
        "bet_history": [False, False, False],
        "opened_current_round": False,
        "raised_predraw": False,
        "discarded": [],
    }]
    # Default mask: CHECK and BET legal
    mask = np.zeros(11, dtype=np.float32)
    mask[CHECK] = 1.0
    mask[BET] = 1.0
    env.legal_action_mask.return_value = mask
    return env


def _full_mask() -> np.ndarray:
    from rl.env.draw_lowball_env_sixmax_selfplay import BET, CALL, CHECK, FOLD, RAISE
    mask = np.zeros(11, dtype=np.float32)
    for a in (FOLD, CHECK, CALL, BET, RAISE):
        mask[a] = 1.0
    return mask


def _draw_mask() -> np.ndarray:
    from rl.env.draw_lowball_env_sixmax_selfplay import DRAW_0, DRAW_5
    mask = np.zeros(11, dtype=np.float32)
    mask[DRAW_0:DRAW_5 + 1] = 1.0
    return mask


# ---------------------------------------------------------------------------
# sixmax_draw_teacher_action — BET phase
# ---------------------------------------------------------------------------

class TeacherBetPhaseTest(unittest.TestCase):

    def test_premium_hand_bets_from_any_position(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import BET
        for pos in ("UTG", "MP", "CO", "BTN", "SB"):
            env = _make_env(hero_hand=list(SEVEN_LOW_27))
            env.legal_action_mask.return_value = _full_mask()
            action = sixmax_draw_teacher_action(env, position=pos)
            self.assertIn(action, (BET, 4), f"Expected bet/raise for premium at {pos}")

    def test_trash_hand_checks_or_folds_from_utg(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import CHECK, FOLD
        env = _make_env(hero_hand=list(TRASH_27))
        env.legal_action_mask.return_value = _full_mask()
        action = sixmax_draw_teacher_action(env, position="UTG")
        self.assertIn(action, (CHECK, FOLD), f"Trash should check/fold from UTG, got {action}")

    def test_moderate_hand_folds_from_utg_facing_raise(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import FOLD
        # K-Q-J-8-5: draw_strength ≈ 0.45, below UTG call threshold (0.60).
        env = _make_env(
            hero_hand=list(KQJHAND_27),
            current_bet=4,
            hero_bet=0,
        )
        mask = np.zeros(11, dtype=np.float32)
        from rl.env.draw_lowball_env_sixmax_selfplay import FOLD, CALL, RAISE
        mask[FOLD] = 1.0
        mask[CALL] = 1.0
        env.legal_action_mask.return_value = mask
        action = sixmax_draw_teacher_action(env, position="UTG")
        self.assertEqual(action, FOLD)

    def test_premium_calls_or_raises_facing_bet(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import CALL, RAISE
        env = _make_env(
            hero_hand=list(SEVEN_LOW_27),
            current_bet=4,
            hero_bet=0,
        )
        mask = np.zeros(11, dtype=np.float32)
        from rl.env.draw_lowball_env_sixmax_selfplay import FOLD, CALL, RAISE
        mask[FOLD] = 1.0
        mask[CALL] = 1.0
        mask[RAISE] = 1.0
        env.legal_action_mask.return_value = mask
        action = sixmax_draw_teacher_action(env, position="BTN")
        self.assertIn(action, (CALL, RAISE))

    def test_single_draw_tighter_utg_open(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import CHECK, BET
        # Pair-of-8s hand [5♣8♦2♥4♠8♠]: break the pair, draw 1 to 8-5-4-2.
        # norm≈0.882 → above TD UTG threshold (0.88) but below SD UTG threshold (0.91).
        pair_eight_hand = [(5,0),(8,1),(2,2),(4,3),(8,3)]
        env_td = _make_env(hero_hand=list(pair_eight_hand), max_draws=3)
        env_sd = _make_env(hero_hand=list(pair_eight_hand), max_draws=1)
        mask = np.zeros(11, dtype=np.float32)
        mask[CHECK] = 1.0
        mask[BET] = 1.0
        env_td.legal_action_mask.return_value = mask.copy()
        env_sd.legal_action_mask.return_value = mask.copy()
        action_td = sixmax_draw_teacher_action(env_td, position="UTG")
        action_sd = sixmax_draw_teacher_action(env_sd, position="UTG")
        self.assertEqual(action_td, BET,   "pair-of-8s should open from UTG in 6-max TD (norm≈0.882≥0.88)")
        self.assertEqual(action_sd, CHECK, "pair-of-8s should not open from UTG in 6-max SD (norm≈0.882<0.91)")

    def test_final_street_tightens_call_threshold(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import CALL, FOLD
        # K-T-7-4-3: K and T are must-discard in 2-7; 2-card draw to 7-4-3.
        # norm≈0.60 — above BTN call threshold (0.58) but below final-street threshold (0.66).
        mask = np.zeros(11, dtype=np.float32)
        mask[FOLD] = 1.0
        mask[CALL] = 1.0

        env_pre = _make_env(
            hero_hand=list(KT_DRAW_27), max_draws=3, draw_round=0, current_bet=4, hero_bet=0
        )
        env_pre.legal_action_mask.return_value = mask.copy()
        action_pre = sixmax_draw_teacher_action(env_pre, position="BTN")
        self.assertEqual(action_pre, CALL, "K-T-7-4-3 should call BTN pre-final (norm≈0.60≥0.58)")

        env_final = _make_env(
            hero_hand=list(KT_DRAW_27), max_draws=3, draw_round=3, current_bet=4, hero_bet=0
        )
        env_final.legal_action_mask.return_value = mask.copy()
        action_final = sixmax_draw_teacher_action(env_final, position="BTN")
        self.assertEqual(action_final, FOLD, "K-T-7-4-3 should fold BTN on final street (norm≈0.60<0.66)")

    def test_raise_pressure_tightens_threshold(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import FOLD, CALL
        borderline_hand = [c(8,0), c(6,1), c(4,2), c(3,3), c(2,0)]
        env_no_pressure = _make_env(
            hero_hand=borderline_hand, current_bet=4, hero_bet=0, raise_count=0
        )
        env_pressure = _make_env(
            hero_hand=borderline_hand, current_bet=4, hero_bet=0, raise_count=2
        )
        mask = np.zeros(11, dtype=np.float32)
        from rl.env.draw_lowball_env_sixmax_selfplay import FOLD, CALL
        mask[FOLD] = 1.0
        mask[CALL] = 1.0
        env_no_pressure.legal_action_mask.return_value = mask.copy()
        env_pressure.legal_action_mask.return_value = mask.copy()
        action_no = sixmax_draw_teacher_action(env_no_pressure, position="BTN")
        action_pr = sixmax_draw_teacher_action(env_pressure, position="BTN")
        # Raise pressure should never make teacher more aggressive
        if action_no == FOLD:
            self.assertEqual(action_pr, FOLD)


# ---------------------------------------------------------------------------
# sixmax_draw_teacher_action — DRAW phase
# ---------------------------------------------------------------------------

class TeacherDrawPhaseTest(unittest.TestCase):

    def test_premium_27_hand_pats(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import DRAW_0
        env = _make_env(phase="DRAW", hero_hand=list(SEVEN_LOW_27))
        env.legal_action_mask.return_value = _draw_mask()
        action = sixmax_draw_teacher_action(env, position="BTN")
        self.assertEqual(action, DRAW_0, "7-low should pat (draw 0)")

    def test_jack_draw_draws_one_in_27(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import DRAW_0
        env = _make_env(phase="DRAW", hero_hand=list(JACK_DRAW_27))
        env.legal_action_mask.return_value = _draw_mask()
        action = sixmax_draw_teacher_action(env, position="CO")
        self.assertEqual(action, DRAW_0 + 1, "J-5-4-3-2 should draw 1 (discard J)")

    def test_wheel_a5_pats(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import DRAW_0
        env = _make_env(phase="DRAW", family="low-a5", hero_hand=list(WHEEL_A5))
        env.legal_action_mask.return_value = _draw_mask()
        action = sixmax_draw_teacher_action(env, position="BTN")
        self.assertEqual(action, DRAW_0, "A-5 wheel should pat")

    def test_king_draw_a5_draws_one(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import DRAW_0
        env = _make_env(phase="DRAW", family="low-a5", hero_hand=list(KING_DRAW_A5))
        env.legal_action_mask.return_value = _draw_mask()
        action = sixmax_draw_teacher_action(env, position="BTN")
        self.assertEqual(action, DRAW_0 + 1, "A-2-3-4-K should draw 1 (discard K)")

    def test_trash_27_draws_five(self):
        from rl.env.draw_lowball_env_sixmax_selfplay import DRAW_0
        env = _make_env(phase="DRAW", hero_hand=list(TRASH_27))
        env.legal_action_mask.return_value = _draw_mask()
        action = sixmax_draw_teacher_action(env, position="UTG")
        self.assertEqual(action, DRAW_0 + 5, "Pure trash should draw 5")

    def test_draw_action_independent_of_position(self):
        # Draw count should be the same regardless of position
        env_utg = _make_env(phase="DRAW", hero_hand=list(JACK_DRAW_27))
        env_btn = _make_env(phase="DRAW", hero_hand=list(JACK_DRAW_27))
        env_utg.legal_action_mask.return_value = _draw_mask()
        env_btn.legal_action_mask.return_value = _draw_mask()
        a_utg = sixmax_draw_teacher_action(env_utg, position="UTG")
        a_btn = sixmax_draw_teacher_action(env_btn, position="BTN")
        self.assertEqual(a_utg, a_btn)


# ---------------------------------------------------------------------------
# position_name
# ---------------------------------------------------------------------------

class PositionNameTest(unittest.TestCase):

    def test_dealer_is_btn(self):
        self.assertEqual(position_name(hero_seat=3, dealer_seat=3), "BTN")

    def test_sb_is_one_left_of_dealer(self):
        self.assertEqual(position_name(hero_seat=4, dealer_seat=3), "SB")

    def test_bb_is_two_left(self):
        self.assertEqual(position_name(hero_seat=5, dealer_seat=3), "BB")

    def test_utg_is_three_left(self):
        self.assertEqual(position_name(hero_seat=0, dealer_seat=3), "UTG")

    def test_wraps_correctly(self):
        self.assertEqual(position_name(hero_seat=0, dealer_seat=0), "BTN")
        self.assertEqual(position_name(hero_seat=1, dealer_seat=0), "SB")

    def test_all_six_positions_covered(self):
        positions = {position_name(hero_seat=i, dealer_seat=0) for i in range(6)}
        self.assertEqual(positions, set(POSITION_NAMES_BY_BUTTON_OFFSET))


if __name__ == "__main__":
    unittest.main()
