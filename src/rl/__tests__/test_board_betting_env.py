from rl.env.board_betting_env import BOARD_ACTIONS, BoardBettingEnv, BoardLongHorizonEnv, board_teacher_action


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

