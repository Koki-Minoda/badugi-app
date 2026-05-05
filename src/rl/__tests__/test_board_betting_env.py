from rl.env.board_betting_env import (
    BOARD_ACTIONS,
    BoardBettingEnv,
    BoardLongHorizonEnv,
    BoardScenario,
    board_teacher_action,
)


def test_board_bootstrap_env_is_one_step_with_16_features():
    env = BoardBettingEnv(family="nlh", tier="beginner", seed=7)
    obs, _ = env.reset()
    assert obs.shape == (16,)
    action = board_teacher_action(env.scenario)
    next_obs, reward, terminated, truncated, info = env.step(action)
    assert next_obs.shape == (16,)
    assert reward > 0
    assert terminated is True
    assert truncated is False
    assert info["teacherAction"] == action


def test_board_long_horizon_env_advances_multiple_decisions():
    env = BoardLongHorizonEnv(family="plo8", tier="standard", seed=11, max_steps_per_episode=4)
    obs, _ = env.reset()
    assert obs.shape == (16,)
    seen_non_terminal = False
    for _ in range(4):
        action = board_teacher_action(env.scenario)
        obs, reward, terminated, truncated, info = env.step(action)
        assert obs.shape == (16,)
        assert BOARD_ACTIONS[info["teacherAction"]] in BOARD_ACTIONS
        assert truncated is False
        if not terminated:
            seen_non_terminal = True
        if terminated:
            break
    assert seen_non_terminal is True
    assert env.pot > 0


def make_scenario(**overrides):
    base = dict(
        family="nlh",
        tier="standard",
        strength=0.58,
        equity=0.52,
        draw_potential=0.35,
        position=0.08,
        street_progress=0.0,
        to_call=0.0,
        bet_size=0.08,
        pot_size=0.12,
        raise_count=0,
        active_opponents=1,
        stack_ratio=0.8,
        last_aggression=0.2,
        range_score=0.0,
    )
    base.update(overrides)
    return BoardScenario(**base)


def test_board_teacher_uses_tighter_early_position_preflop_range():
    early = make_scenario(position=0.08, range_score=0.62)
    button = make_scenario(position=0.65, range_score=0.62)

    assert BOARD_ACTIONS[board_teacher_action(early)] == "check"
    assert BOARD_ACTIONS[board_teacher_action(button)] == "bet"


def test_board_teacher_folds_poor_plo8_no_low_start_but_raises_scoop_start():
    poor_no_low = make_scenario(
        family="plo8",
        strength=0.48,
        equity=0.42,
        draw_potential=0.12,
        position=0.2,
        to_call=0.1,
        pot_size=0.25,
        active_opponents=3,
        range_score=0.35,
    )
    scoop_candidate = make_scenario(
        family="plo8",
        strength=0.72,
        equity=0.74,
        draw_potential=0.62,
        position=0.7,
        to_call=0.1,
        pot_size=0.25,
        active_opponents=2,
        range_score=0.84,
    )

    assert BOARD_ACTIONS[board_teacher_action(poor_no_low)] == "fold"
    assert BOARD_ACTIONS[board_teacher_action(scoop_candidate)] == "raise"
