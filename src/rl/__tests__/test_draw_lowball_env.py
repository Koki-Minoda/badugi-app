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
