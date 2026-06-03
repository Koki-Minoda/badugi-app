import numpy as np

from rl.env.draw_lowball_env import (
    DrawLowballEnv,
    compare_lowball,
    discard_indexes_for_family,
    draw_teacher_action,
    evaluate_lowball,
)


def c(rank, suit):
    ranks = {"A": 14, "K": 13, "Q": 12, "J": 11, "T": 10}
    return (ranks[rank] if rank in ranks else int(rank), suit)


def test_27_keeps_clean_seven_low_above_eight_low():
    seven = [c("7", 0), c("5", 1), c("4", 2), c("3", 3), c("2", 0)]
    eight = [c("8", 0), c("6", 1), c("5", 2), c("3", 3), c("2", 0)]
    assert compare_lowball(seven, eight, "low-27") == 1
    assert discard_indexes_for_family(seven, "low-27") == []


def test_27_breaks_straights_and_pairs():
    straight = [c("7", 0), c("6", 1), c("5", 2), c("4", 3), c("3", 0)]
    paired = [c("7", 0), c("7", 1), c("5", 2), c("3", 3), c("2", 0)]
    assert evaluate_lowball(straight, "low-27").category >= 4
    assert discard_indexes_for_family(straight, "low-27")
    assert discard_indexes_for_family(paired, "low-27")


def test_a5_keeps_wheel_even_when_straight_or_flush_shaped():
    wheel_flush = [c("A", 0), c("2", 0), c("3", 0), c("4", 0), c("5", 0)]
    six_low = [c("A", 0), c("2", 1), c("3", 2), c("4", 3), c("6", 0)]
    assert compare_lowball(wheel_flush, six_low, "low-a5") == 1
    assert discard_indexes_for_family(wheel_flush, "low-a5") == []


def test_env_masks_betting_and_draw_actions():
    env = DrawLowballEnv(family="low-27", seed=7)
    obs, _ = env.reset(seed=7)
    assert obs.shape == (96,)
    mask = env.legal_action_mask()
    assert mask[0] == 1
    assert mask[2] == 1
    assert np.all(mask[5:] == 0)
    env.step(2)
    assert env.phase in {"BET", "DRAW", "SHOWDOWN"}


def test_teacher_uses_variant_specific_pat_rules():
    env_27 = DrawLowballEnv(family="low-27", seed=11)
    env_27.phase = "DRAW"
    env_27.hero_hand = [c("7", 0), c("6", 1), c("5", 2), c("4", 3), c("3", 0)]
    assert draw_teacher_action(env_27) > 5

    env_a5 = DrawLowballEnv(family="low-a5", seed=11)
    env_a5.phase = "DRAW"
    env_a5.hero_hand = [c("A", 0), c("2", 0), c("3", 0), c("4", 0), c("5", 0)]
    assert draw_teacher_action(env_a5) == 5


# ---------------------------------------------------------------------------
# PAT-DRAW-SDCARD-001: A-5 made low hands (6-8 high) must not be force-discarded
# Root cause: _must_discard_rank used eff > 5, wrongly flagging rank 6/7/8 as
# "must discard" even for clean made lows, causing ideal_draw_count=1 for every
# A-5 6-8 low. Training reward penalised patting (0.04 vs 0.12) → patFrequency=0%.
# ---------------------------------------------------------------------------

def test_a5_made_lows_six_through_eight_pat():
    """discard_indexes_for_family must return [] for clean A-5 6-low/7-low/8-low."""
    six_low = [c("A", 0), c("2", 1), c("3", 2), c("4", 3), c("6", 0)]
    seven_low = [c("A", 0), c("2", 1), c("3", 2), c("5", 3), c("7", 0)]
    eight_low = [c("A", 0), c("2", 1), c("3", 2), c("4", 3), c("8", 0)]

    assert discard_indexes_for_family(six_low, "low-a5") == [], "A-5 6-low should pat"
    assert discard_indexes_for_family(seven_low, "low-a5") == [], "A-5 7-low should pat"
    assert discard_indexes_for_family(eight_low, "low-a5") == [], "A-5 8-low should pat"


def test_a5_nine_low_draws_to_improve():
    """A-5 9-low should draw 1 (9 is above the pat threshold of eff>8)."""
    nine_low = [c("A", 0), c("2", 1), c("3", 2), c("4", 3), c("9", 0)]
    assert discard_indexes_for_family(nine_low, "low-a5") == [4], "A-5 9-low should draw 1"


def test_a5_teacher_pats_strong_made_lows():
    """draw_teacher_action must select pat (action=5) for A-5 6-8 low hands."""
    for hand in [
        [c("A", 0), c("2", 1), c("3", 2), c("4", 3), c("6", 0)],
        [c("A", 0), c("2", 1), c("3", 2), c("5", 3), c("7", 0)],
        [c("A", 0), c("2", 1), c("3", 2), c("4", 3), c("8", 0)],
    ]:
        env = DrawLowballEnv(family="low-a5", seed=1)
        env.phase = "DRAW"
        env.hero_hand = hand
        assert draw_teacher_action(env) == 5, f"Teacher should pat A-5 made low: {hand}"


def test_27_nine_low_pats():
    """discard_indexes_for_family must return [] for 2-7 9-low (no force-discard, rank<10)."""
    nine_low = [c("9", 0), c("7", 1), c("5", 2), c("3", 3), c("2", 0)]
    assert discard_indexes_for_family(nine_low, "low-27") == [], "2-7 9-low should pat"


def test_draw_quality_reward_uses_pre_draw_ideal():
    """Reward for patting a strong A-5 made low must equal 0.12 (not 0.04)."""
    env = DrawLowballEnv(family="low-a5", seed=42)
    env.phase = "DRAW"
    env.hero_hand = [c("A", 0), c("2", 1), c("3", 2), c("4", 3), c("6", 0)]
    env.opp_hand = [c("K", 0), c("K", 1), c("Q", 2), c("J", 3), c("T", 0)]
    env.draw_round = 0
    env.raise_count = 0
    env.current_bet = 0
    env.hero_bet = 0
    env.opp_bet = 0
    env.opp_opened_current_round = False
    env.hero_opened_current_round = False

    pre_draw_ideal = len(discard_indexes_for_family(env.hero_hand, env.family))
    assert pre_draw_ideal == 0, "Pre-draw ideal for A-5 6-low must be 0"

    reward = env._draw_quality_reward(0, pre_draw_ideal)
    assert abs(reward - 0.12) < 1e-6, f"Pat reward for strong A-5 low must be 0.12, got {reward}"
