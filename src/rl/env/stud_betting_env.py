"""Synthetic Stud/Razz betting environment for bootstrap DQNs.

This environment is intentionally small. It trains an initial betting surface
for 7-card Stud, Stud Hi-Lo, and Razz CPU tiers while the production Stud
controller remains the source of truth for street progression.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

import gymnasium as gym
import numpy as np
from gymnasium import spaces


STUD_ACTIONS = ["fold", "check", "call", "bet", "raise", "all_in"]
STUD_VARIANTS = ("stud", "stud8", "razz")
STUD_TIERS = ("beginner", "standard")
STUD_STREETS = ("third", "fourth", "fifth", "sixth", "seventh")


@dataclass
class StudScenario:
    family: str
    tier: str
    made_strength: float
    draw_equity: float
    visible_pressure: float
    position: float
    street_progress: float
    to_call: float
    bet_size: float
    pot_size: float
    raise_count: int
    active_opponents: int
    stack_ratio: float
    low_potential: float
    high_potential: float


class StudBettingEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, family: str = "stud", tier: str = "beginner", seed: int | None = None):
        if family not in STUD_VARIANTS:
            raise ValueError(f"Unsupported stud family: {family}")
        if tier not in STUD_TIERS:
            raise ValueError(f"Unsupported stud tier: {tier}")
        self.family = family
        self.tier = tier
        self.random = random.Random(seed)
        self.observation_space = spaces.Box(low=0.0, high=1.5, shape=(16,), dtype=np.float32)
        self.action_space = spaces.Discrete(len(STUD_ACTIONS))
        self.scenario = self._sample_scenario()

    def reset(self, *, seed: int | None = None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            self.random.seed(seed)
        self.scenario = self._sample_scenario()
        return self._observation(), {}

    def step(self, action: int):
        action = int(action)
        teacher = stud_teacher_action(self.scenario)
        reward = self._reward_for_action(action, teacher)
        return self._observation(), float(reward), True, False, {"teacherAction": teacher}

    def legal_action_mask(self):
        mask = np.zeros(len(STUD_ACTIONS), dtype=np.float32)
        if self.scenario.to_call > 0:
            mask[0] = 1
            mask[2] = 1
            if self.scenario.raise_count < 4 and self.scenario.stack_ratio > 0.08:
                mask[4] = 1
            if self.scenario.stack_ratio < 0.16 and self.scenario.made_strength > 0.72:
                mask[5] = 1
        else:
            mask[1] = 1
            mask[3] = 1
            if self.scenario.raise_count < 4 and self.scenario.stack_ratio > 0.08:
                mask[4] = 1
        return mask

    def _sample_scenario(self) -> StudScenario:
        street = self.random.choice([0.0, 0.25, 0.5, 0.75, 1.0])
        active_opponents = self.random.choice([1, 1, 2, 3, 4])
        high_potential = self.random.betavariate(2.0, 2.3)
        low_potential = self.random.betavariate(2.0, 2.0)
        draw_equity = self.random.betavariate(1.8, 2.2) * max(0.12, 1.0 - street * 0.45)
        visible_pressure = self.random.betavariate(2.2, 2.0)
        if self.family == "razz":
            made_strength = 0.72 * low_potential + 0.28 * draw_equity
        elif self.family == "stud8":
            made_strength = max(high_potential, 0.65 * low_potential + 0.18 * draw_equity)
        else:
            made_strength = 0.78 * high_potential + 0.12 * visible_pressure + 0.1 * draw_equity
        made_strength = float(np.clip(made_strength * (1.0 - active_opponents * 0.035), 0.0, 1.0))
        return StudScenario(
            family=self.family,
            tier=self.tier,
            made_strength=made_strength,
            draw_equity=float(np.clip(draw_equity, 0.0, 1.0)),
            visible_pressure=float(np.clip(visible_pressure, 0.0, 1.0)),
            position=self.random.random(),
            street_progress=street,
            to_call=self.random.choice([0.0, 0.04, 0.08, 0.16, 0.24]),
            bet_size=0.04 if street < 0.5 else 0.08,
            pot_size=self.random.uniform(0.05, 0.7),
            raise_count=self.random.choice([0, 0, 1, 2, 3]),
            active_opponents=active_opponents,
            stack_ratio=self.random.uniform(0.08, 1.2),
            low_potential=float(np.clip(low_potential, 0.0, 1.0)),
            high_potential=float(np.clip(high_potential, 0.0, 1.0)),
        )

    def _observation(self):
        return make_stud_observation(self.scenario)

    def _reward_for_action(self, action: int, teacher: int):
        if action < 0 or action >= len(STUD_ACTIONS) or self.legal_action_mask()[action] <= 0:
            return -1.4
        if action == teacher:
            return 1.0
        action_name = STUD_ACTIONS[action]
        teacher_name = STUD_ACTIONS[teacher]
        reward = -0.35
        if action_name in {"call", "check"} and teacher_name in {"bet", "raise"} and self.scenario.made_strength > 0.58:
            reward = -0.08
        if action_name in {"bet", "raise"} and teacher_name in {"call", "check"} and self.scenario.made_strength > 0.62:
            reward = -0.05
        if action_name == "fold" and self.scenario.made_strength > max(0.34, pot_odds(self.scenario) + 0.04):
            reward -= 0.5
        if action_name in {"raise", "all_in"} and self.scenario.made_strength < 0.35:
            reward -= 0.55
        return reward


def pot_odds(scenario: StudScenario):
    if scenario.to_call <= 0:
        return 0.0
    return scenario.to_call / max(0.01, scenario.pot_size + scenario.to_call)


def make_stud_observation(scenario: StudScenario):
    is_razz = 1.0 if scenario.family == "razz" else 0.0
    is_stud8 = 1.0 if scenario.family == "stud8" else 0.0
    is_stud = 1.0 if scenario.family == "stud" else 0.0
    return np.array(
        [
            scenario.to_call,
            scenario.bet_size,
            scenario.pot_size,
            scenario.made_strength,
            scenario.draw_equity,
            scenario.visible_pressure,
            scenario.position,
            scenario.street_progress,
            pot_odds(scenario),
            scenario.raise_count / 4.0,
            is_razz,
            is_stud8,
            is_stud,
            min(1.0, scenario.active_opponents / 5.0),
            scenario.stack_ratio,
            max(scenario.low_potential, scenario.high_potential),
        ],
        dtype=np.float32,
    )


def stud_teacher_action(scenario: StudScenario):
    standard = scenario.tier == "standard"
    odds = pot_odds(scenario)
    late_street = scenario.street_progress >= 0.75
    multiway = scenario.active_opponents >= 3
    value_threshold = 0.62 if standard else 0.72
    continue_threshold = max(0.28 if standard else 0.36, odds + (0.08 if multiway else -0.02))
    if scenario.family == "razz":
        continue_threshold += 0.03 if late_street and scenario.visible_pressure > 0.62 else 0.0
    if scenario.family == "stud8" and scenario.low_potential > 0.62 and scenario.high_potential > 0.48:
        value_threshold -= 0.08
        continue_threshold -= 0.04

    if scenario.to_call > 0:
        if scenario.made_strength >= value_threshold and scenario.raise_count < 4:
            return STUD_ACTIONS.index("raise")
        if scenario.made_strength >= continue_threshold or scenario.draw_equity >= continue_threshold + 0.08:
            return STUD_ACTIONS.index("call")
        return STUD_ACTIONS.index("fold")

    if scenario.made_strength >= value_threshold:
        return STUD_ACTIONS.index("bet")
    if standard and scenario.position > 0.58 and scenario.draw_equity > 0.58 and not multiway:
        return STUD_ACTIONS.index("bet")
    return STUD_ACTIONS.index("check")

