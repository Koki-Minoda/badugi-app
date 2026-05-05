"""Synthetic board-game betting environment for NLH/FLH/PLO/PLO8 bootstrap DQNs."""

from __future__ import annotations

import random
from dataclasses import dataclass

import gymnasium as gym
import numpy as np
from gymnasium import spaces


BOARD_ACTIONS = ["fold", "check", "call", "bet", "raise", "all_in"]
BOARD_VARIANTS = ("nlh", "flh", "plo", "plo8")
BOARD_TIERS = ("beginner", "standard")


@dataclass
class BoardScenario:
    family: str
    tier: str
    strength: float
    equity: float
    draw_potential: float
    position: float
    street_progress: float
    to_call: float
    bet_size: float
    pot_size: float
    raise_count: int
    active_opponents: int
    stack_ratio: float
    last_aggression: float


class BoardBettingEnv(gym.Env):
    """One-step no-limit/fixed-limit/pot-limit betting decision simulator.

    The goal is not to solve poker. It gives the DQN a stable initial policy
    surface for common board-game actions before real hand-history training.
    """

    metadata = {"render_modes": []}

    def __init__(self, family: str = "nlh", tier: str = "beginner", seed: int | None = None):
        if family not in BOARD_VARIANTS:
            raise ValueError(f"Unsupported board family: {family}")
        if tier not in BOARD_TIERS:
            raise ValueError(f"Unsupported board tier: {tier}")
        self.family = family
        self.tier = tier
        self.random = random.Random(seed)
        self.observation_space = spaces.Box(low=0.0, high=1.5, shape=(16,), dtype=np.float32)
        self.action_space = spaces.Discrete(len(BOARD_ACTIONS))
        self.scenario = self._sample_scenario()

    def set_family(self, family: str):
        if family not in BOARD_VARIANTS:
            raise ValueError(f"Unsupported board family: {family}")
        self.family = family

    def set_tier(self, tier: str):
        if tier not in BOARD_TIERS:
            raise ValueError(f"Unsupported board tier: {tier}")
        self.tier = tier

    def reset(self, *, seed: int | None = None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            self.random.seed(seed)
        self.scenario = self._sample_scenario()
        return self._observation(), {}

    def step(self, action: int):
        action = int(action)
        teacher = board_teacher_action(self.scenario)
        reward = self._reward_for_action(action, teacher)
        return self._observation(), float(reward), True, False, {"teacherAction": teacher}

    def legal_action_mask(self):
        mask = np.zeros(len(BOARD_ACTIONS), dtype=np.float32)
        if self.scenario.to_call > 0:
            mask[0] = 1
            mask[2] = 1
            if self.scenario.raise_count < 4 and self.scenario.stack_ratio > 0.08:
                mask[4] = 1
            if self.scenario.stack_ratio < 0.18 or self.scenario.equity > 0.8:
                mask[5] = 1
        else:
            mask[1] = 1
            mask[3] = 1
            if self.scenario.raise_count < 4 and self.scenario.stack_ratio > 0.08:
                mask[4] = 1
            if self.scenario.stack_ratio < 0.16 and self.scenario.equity > 0.55:
                mask[5] = 1
        return mask

    def _sample_scenario(self) -> BoardScenario:
        strength = self.random.betavariate(2.0, 2.2)
        draw_potential = self.random.betavariate(1.6, 2.4)
        position = self.random.random()
        street_progress = self.random.choice([0.0, 0.33, 0.66, 1.0])
        active_opponents = self.random.choice([1, 1, 2, 3, 4])
        to_call = self.random.choice([0.0, 0.05, 0.1, 0.2, 0.35])
        bet_size = self.random.choice([0.04, 0.08, 0.16, 0.25])
        pot_size = self.random.uniform(0.05, 0.6)
        raise_count = self.random.choice([0, 0, 1, 2, 3])
        stack_ratio = self.random.uniform(0.08, 1.0)
        hi_lo = 1.0 if self.family == "plo8" else 0.0
        equity = _estimate_equity(
            strength=strength,
            draw_potential=draw_potential,
            street_progress=street_progress,
            active_opponents=active_opponents,
            hi_lo=hi_lo,
        )
        return BoardScenario(
            family=self.family,
            tier=self.tier,
            strength=strength,
            equity=equity,
            draw_potential=draw_potential,
            position=position,
            street_progress=street_progress,
            to_call=to_call,
            bet_size=bet_size,
            pot_size=pot_size,
            raise_count=raise_count,
            active_opponents=active_opponents,
            stack_ratio=stack_ratio,
            last_aggression=self.random.random(),
        )

    def _observation(self):
        scenario = self.scenario
        return make_board_observation(scenario)

    def _reward_for_action(self, action: int, teacher: int):
        if self.legal_action_mask()[action] <= 0:
            return -1.4
        if action == teacher:
            return 1.0
        action_name = BOARD_ACTIONS[action]
        teacher_name = BOARD_ACTIONS[teacher]
        equity = self.scenario.equity
        pot_odds = _pot_odds(self.scenario)
        reward = -0.35
        if action_name in {"call", "check"} and teacher_name in {"bet", "raise"} and equity > 0.55:
            reward = -0.1
        if action_name in {"bet", "raise"} and teacher_name in {"call", "check"} and equity > 0.62:
            reward = -0.05
        if action_name == "fold" and equity > max(0.35, pot_odds):
            reward -= 0.55
        if action_name in {"raise", "all_in"} and equity < 0.38:
            reward -= 0.55
        if self.family in {"flh"} and action_name == "all_in":
            reward -= 0.4
        return reward


def _estimate_equity(*, strength: float, draw_potential: float, street_progress: float, active_opponents: int, hi_lo: float):
    draw_weight = max(0.05, 0.4 * (1.0 - street_progress))
    multiway_penalty = max(0.55, 1.0 - active_opponents * 0.09)
    split_bonus = 0.08 if hi_lo else 0.0
    return float(np.clip((strength * 0.72 + draw_potential * draw_weight + split_bonus) * multiway_penalty, 0.0, 1.0))


def _pot_odds(scenario: BoardScenario):
    if scenario.to_call <= 0:
        return 0.0
    return scenario.to_call / max(0.01, scenario.pot_size + scenario.to_call)


def make_board_observation(scenario: BoardScenario):
    hi_lo = 1.0 if scenario.family == "plo8" else 0.0
    pot_limit = 1.0 if scenario.family in {"plo", "plo8"} else 0.0
    fixed_limit = 1.0 if scenario.family == "flh" else 0.0
    no_limit = 1.0 if scenario.family == "nlh" else 0.0
    return np.array(
        [
            scenario.to_call,
            scenario.bet_size,
            scenario.pot_size,
            scenario.strength,
            scenario.equity,
            scenario.draw_potential,
            scenario.position,
            scenario.street_progress,
            _pot_odds(scenario),
            scenario.raise_count / 4.0,
            hi_lo,
            pot_limit,
            fixed_limit,
            min(1.0, scenario.active_opponents / 5.0),
            scenario.stack_ratio,
            no_limit,
        ],
        dtype=np.float32,
    )


def board_teacher_action(scenario: BoardScenario):
    equity = scenario.equity
    pot_odds = _pot_odds(scenario)
    late_position = scenario.position > 0.62
    multiway = scenario.active_opponents >= 3
    standard = scenario.tier == "standard"
    value_threshold = 0.63 if standard else 0.72
    continue_threshold = max(0.24 if standard else 0.31, pot_odds + (0.03 if multiway else -0.02))
    semi_bluff_threshold = 0.48 if standard else 0.58

    if scenario.to_call > 0:
        if equity >= value_threshold and scenario.raise_count < 4:
            return BOARD_ACTIONS.index("raise")
        if equity >= continue_threshold or (late_position and scenario.draw_potential >= semi_bluff_threshold):
            return BOARD_ACTIONS.index("call")
        return BOARD_ACTIONS.index("fold")

    if equity >= value_threshold:
        return BOARD_ACTIONS.index("bet")
    if standard and late_position and scenario.draw_potential >= semi_bluff_threshold and scenario.last_aggression < 0.55:
        return BOARD_ACTIONS.index("bet")
    return BOARD_ACTIONS.index("check")
