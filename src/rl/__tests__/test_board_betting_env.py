import copy

import numpy as np
import pytest

from rl.env.board_betting_env import (
    BOARD_ACTIONS,
    BoardBettingEnv,
    BoardLongHorizonEnv,
    BoardScenario,
    board_teacher_action,
)


@pytest.mark.parametrize("env_type", [BoardBettingEnv, BoardLongHorizonEnv])
@pytest.mark.parametrize("action", [-100, -1, len(BOARD_ACTIONS), 100])
def test_board_invalid_action_terminates_without_mutation(env_type, action):
    env = env_type(family="nlh", seed=7)
    env.reset()
    # Make the last action legal so -1 must not alias Python's final index.
    env.scenario.stack_ratio = 0.1
    env.scenario.equity = 0.9
    observation = env._observation()
    scenario = copy.deepcopy(env.scenario)
    next_observation, reward, terminated, truncated, _ = env.step(action)
    assert reward == (-1.5 if env_type is BoardLongHorizonEnv else -1.4)
    assert terminated is True
    assert truncated is False
    assert env.scenario == scenario
    np.testing.assert_array_equal(next_observation, observation)


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


def test_flo8_observation_combines_hilo_with_fixed_limit():
    env = BoardBettingEnv(family="flo8", tier="standard", seed=19)
    observation, _ = env.reset()
    assert observation.shape == (16,)
    assert observation[10] == 1.0  # high/low split
    assert observation[11] == 0.0  # not pot limit
    assert observation[12] == 1.0  # fixed limit
    assert observation[15] == 0.0  # not no limit


def test_flo8_long_horizon_uses_small_and_big_fixed_bets():
    env = BoardLongHorizonEnv(family="flo8", tier="standard", seed=19)
    env.reset()
    env.hero_stack = 1.0
    env.scenario.to_call = 0.04
    assert env._sample_to_call() in {0.0, 0.04}
    assert env._contribution_for("raise") == pytest.approx(0.08)
    env.street_index = 2
    env.scenario.to_call = 0.08
    assert env._sample_to_call() in {0.0, 0.08}
    assert env._contribution_for("raise") == pytest.approx(0.16)


def test_flo8_disallows_oversized_all_in_but_allows_short_stack():
    env = BoardBettingEnv(family="flo8", tier="standard", seed=19)
    env.reset()
    env.scenario.to_call = 0.04
    env.scenario.bet_size = 0.04
    env.scenario.stack_ratio = 0.7
    env.scenario.equity = 0.95
    assert env.legal_action_mask()[BOARD_ACTIONS.index("all_in")] == 0
    env.scenario.stack_ratio = 0.07
    assert env.legal_action_mask()[BOARD_ACTIONS.index("all_in")] == 1


def test_flo8_teacher_values_scoop_and_folds_weak_no_low():
    poor = make_scenario(
        family="flo8", strength=0.48, equity=0.42, draw_potential=0.12,
        position=0.2, to_call=0.04, pot_size=0.25, active_opponents=3,
        range_score=0.35,
    )
    scoop = make_scenario(
        family="flo8", strength=0.72, equity=0.74, draw_potential=0.62,
        position=0.7, to_call=0.04, pot_size=0.25, active_opponents=2,
        range_score=0.84,
    )
    assert BOARD_ACTIONS[board_teacher_action(poor)] == "fold"
    assert BOARD_ACTIONS[board_teacher_action(scoop)] == "raise"


def test_flo8_candidate_evaluation_flags_and_registry_gate(tmp_path):
    from rl.training.evaluate_board_onnx import family_from_variant, fixtures_for_family, make_vector
    from rl.training.export_board_dqn_onnx import PROJECT_ROOT, VARIANT_BY_FAMILY, export_board_checkpoint

    assert family_from_variant("B09") == "flo8"
    assert VARIANT_BY_FAMILY["flo8"] == ["B09"]
    vector = make_vector(family="flo8", strength=0.7, equity=0.7, draw=0.5, to_call=0.04, position=0.7)
    assert (vector[10], vector[11], vector[12], vector[15]) == (1.0, 0.0, 1.0, 0.0)
    assert vector[0] == pytest.approx(0.04)
    assert vector[1] == pytest.approx(0.04)
    fixtures = fixtures_for_family("flo8", advanced_gate=True)
    assert len(fixtures) == 8
    assert all(fixture["vector"][0] in {0.0, vector[0]} for fixture in fixtures)
    assert any(fixture["category"] == "scoopNoLow" for fixture in fixtures)
    with pytest.raises(ValueError, match="production registry"):
        export_board_checkpoint(
            family="flo8", tier="standard", checkpoint=tmp_path / "candidate.pt",
            output=tmp_path / "candidate.onnx", registry=tmp_path / "registry.json",
            update_registry_file=True, device="cpu",
        )
    with pytest.raises(ValueError, match="outside public"):
        export_board_checkpoint(
            family="flo8", tier="standard", checkpoint=tmp_path / "candidate.pt",
            output=PROJECT_ROOT / "public/models/flo8_candidate.onnx",
            registry=tmp_path / "registry.json", update_registry_file=False, device="cpu",
        )
