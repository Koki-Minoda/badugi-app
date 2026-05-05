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
POSITION_BUCKETS = ("UTG", "MP", "CO", "BTN", "SB", "BB")
POSITION_OPEN_FLOORS = {
    "nlh": {"UTG": 0.74, "MP": 0.68, "CO": 0.60, "BTN": 0.50, "SB": 0.56, "BB": 0.30},
    "flh": {"UTG": 0.68, "MP": 0.62, "CO": 0.55, "BTN": 0.48, "SB": 0.52, "BB": 0.28},
    "plo": {"UTG": 0.80, "MP": 0.73, "CO": 0.66, "BTN": 0.58, "SB": 0.64, "BB": 0.36},
    "plo8": {"UTG": 0.78, "MP": 0.70, "CO": 0.62, "BTN": 0.54, "SB": 0.60, "BB": 0.34},
}


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
    range_score: float = 0.0


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
        range_score = _estimate_position_range_score(
            family=self.family,
            strength=strength,
            draw_potential=draw_potential,
            position=position,
            active_opponents=active_opponents,
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
            range_score=range_score,
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


class BoardLongHorizonEnv(BoardBettingEnv):
    """Multi-street board-game betting simulator for longer DQN runs.

    It keeps the same 16-feature observation and 6-action output contract as
    the bootstrap one-step environment, but turns each episode into a compact
    hand with preflop/flop/turn/river decisions, stack movement, pot growth,
    opponent pressure, and terminal showdown/fold rewards.
    """

    def __init__(
        self,
        family: str = "nlh",
        tier: str = "beginner",
        seed: int | None = None,
        max_steps_per_episode: int = 12,
    ):
        self.max_steps_per_episode = int(max_steps_per_episode)
        self.step_count = 0
        self.hero_stack = 1.0
        self.pot = 0.0
        self.street_index = 0
        self.folded = False
        super().__init__(family=family, tier=tier, seed=seed)

    def reset(self, *, seed: int | None = None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            self.random.seed(seed)
        self.step_count = 0
        self.hero_stack = self.random.uniform(0.7, 1.2)
        self.pot = self.random.uniform(0.04, 0.12)
        self.street_index = 0
        self.folded = False
        self.scenario = self._sample_long_scenario()
        return self._observation(), {}

    def step(self, action: int):
        action = int(action)
        teacher = board_teacher_action(self.scenario)
        mask = self.legal_action_mask()
        action_name = BOARD_ACTIONS[action] if 0 <= action < len(BOARD_ACTIONS) else "invalid"
        reward = self._reward_for_action(action, teacher)
        if action < 0 or action >= len(BOARD_ACTIONS) or mask[action] <= 0:
            return self._observation(), -1.5, True, False, {"teacherAction": teacher, "terminal": "illegal"}

        contribution = self._contribution_for(action_name)
        self.hero_stack = max(0.0, self.hero_stack - contribution)
        self.pot += contribution
        if action_name == "fold":
            self.folded = True
            reward -= self._fold_ev_penalty()
            return self._observation(), float(reward), True, False, {"teacherAction": teacher, "terminal": "fold"}

        reward += self._ev_shaping(action_name)
        self.step_count += 1
        self.street_index = min(3, self.street_index + 1)
        done = self.step_count >= self.max_steps_per_episode or self.street_index >= 4 or self.hero_stack <= 0.0
        if done:
            reward += self._showdown_reward()
            return self._observation(), float(reward), True, False, {"teacherAction": teacher, "terminal": "showdown"}

        self._advance_scenario(action_name)
        return self._observation(), float(reward), False, False, {"teacherAction": teacher, "terminal": None}

    def _sample_long_scenario(self) -> BoardScenario:
        scenario = self._sample_scenario()
        scenario.street_progress = self.street_index / 3.0
        scenario.pot_size = self.pot
        scenario.stack_ratio = self.hero_stack
        scenario.to_call = self._sample_to_call()
        scenario.equity = _estimate_equity(
            strength=scenario.strength,
            draw_potential=scenario.draw_potential,
            street_progress=scenario.street_progress,
            active_opponents=scenario.active_opponents,
            hi_lo=1.0 if self.family == "plo8" else 0.0,
        )
        scenario.range_score = _estimate_position_range_score(
            family=self.family,
            strength=scenario.strength,
            draw_potential=scenario.draw_potential,
            position=scenario.position,
            active_opponents=scenario.active_opponents,
        )
        return scenario

    def _sample_to_call(self):
        pressure = self.random.random()
        if pressure < 0.45:
            return 0.0
        if self.family == "flh":
            return 0.04 if self.street_index < 2 else 0.08
        return self.random.choice([0.04, 0.08, 0.14, 0.22])

    def _contribution_for(self, action_name: str):
        if action_name in {"check", "fold"}:
            return 0.0
        if action_name == "call":
            return min(self.hero_stack, self.scenario.to_call)
        if action_name == "all_in":
            return self.hero_stack
        unit = 0.04 if self.family == "flh" and self.street_index < 2 else 0.08
        if self.family in {"plo", "plo8"}:
            unit = min(max(0.05, self.pot), 0.35)
        if self.family == "nlh":
            unit = self.random.choice([0.08, 0.14, 0.22])
        return min(self.hero_stack, max(unit, self.scenario.to_call + unit))

    def _ev_shaping(self, action_name: str):
        equity_edge = self.scenario.equity - _pot_odds(self.scenario)
        if action_name in {"bet", "raise"}:
            return 0.35 * equity_edge + (0.1 if self.scenario.position > 0.65 else 0.0)
        if action_name == "call":
            return 0.22 * equity_edge
        if action_name == "check":
            return 0.05 if self.scenario.equity < 0.55 else -0.04
        return 0.0

    def _fold_ev_penalty(self):
        if self.scenario.equity > max(0.36, _pot_odds(self.scenario) + 0.04):
            return 0.45
        return -0.08

    def _showdown_reward(self):
        pressure = 0.04 * max(0, self.scenario.active_opponents - 1)
        win_probability = float(np.clip(self.scenario.equity - pressure, 0.02, 0.95))
        expected_pot = self.pot * win_probability
        investment_penalty = max(0.0, 1.0 - self.hero_stack) * 0.35
        return expected_pot - investment_penalty

    def _advance_scenario(self, action_name: str):
        aggression_boost = 0.04 if action_name in {"bet", "raise"} else 0.0
        draw_realization = self.scenario.draw_potential * self.random.uniform(0.02, 0.12)
        self.scenario.strength = float(np.clip(self.scenario.strength + draw_realization + aggression_boost, 0.02, 0.98))
        self.scenario.draw_potential = float(np.clip(self.scenario.draw_potential * self.random.uniform(0.55, 0.9), 0.0, 1.0))
        self.scenario.street_progress = self.street_index / 3.0
        self.scenario.pot_size = self.pot
        self.scenario.stack_ratio = self.hero_stack
        self.scenario.to_call = self._sample_to_call()
        self.scenario.raise_count = 0 if self.scenario.to_call == 0 else self.random.choice([0, 1, 2])
        self.scenario.last_aggression = 1.0 if action_name in {"bet", "raise"} else self.random.random()
        self.scenario.equity = _estimate_equity(
            strength=self.scenario.strength,
            draw_potential=self.scenario.draw_potential,
            street_progress=self.scenario.street_progress,
            active_opponents=self.scenario.active_opponents,
            hi_lo=1.0 if self.family == "plo8" else 0.0,
        )
        self.scenario.range_score = _estimate_position_range_score(
            family=self.family,
            strength=self.scenario.strength,
            draw_potential=self.scenario.draw_potential,
            position=self.scenario.position,
            active_opponents=self.scenario.active_opponents,
        )


def _estimate_equity(*, strength: float, draw_potential: float, street_progress: float, active_opponents: int, hi_lo: float):
    draw_weight = max(0.05, 0.4 * (1.0 - street_progress))
    multiway_penalty = max(0.55, 1.0 - active_opponents * 0.09)
    split_bonus = 0.08 if hi_lo else 0.0
    return float(np.clip((strength * 0.72 + draw_potential * draw_weight + split_bonus) * multiway_penalty, 0.0, 1.0))


def _pot_odds(scenario: BoardScenario):
    if scenario.to_call <= 0:
        return 0.0
    return scenario.to_call / max(0.01, scenario.pot_size + scenario.to_call)


def _position_bucket(position: float):
    if position < 0.14:
        return "UTG"
    if position < 0.32:
        return "MP"
    if position < 0.52:
        return "CO"
    if position < 0.74:
        return "BTN"
    if position < 0.88:
        return "SB"
    return "BB"


def _estimate_position_range_score(
    *,
    family: str,
    strength: float,
    draw_potential: float,
    position: float,
    active_opponents: int,
):
    """GTO-inspired abstract preflop playability score.

    This is not a copied solver chart. It encodes solver-like principles:
    early seats need tighter continuing ranges, late seats can pressure wider,
    PLO values nut potential/connectedness more than raw high-card strength,
    and PLO8 rewards scoop-capable low-plus-high structures.
    """

    bucket = _position_bucket(position)
    late_credit = {"UTG": -0.05, "MP": -0.02, "CO": 0.03, "BTN": 0.09, "SB": -0.01, "BB": 0.04}[bucket]
    multiway_penalty = max(0, active_opponents - 1) * (0.035 if family in {"plo", "plo8"} else 0.02)
    if family in {"plo", "plo8"}:
        nut_potential = draw_potential * (0.62 if family == "plo" else 0.5)
        made_component = strength * (0.42 if family == "plo" else 0.34)
        scoop_bonus = 0.12 if family == "plo8" and draw_potential >= 0.48 and strength >= 0.42 else 0.0
        return float(np.clip(made_component + nut_potential + scoop_bonus + late_credit - multiway_penalty, 0.0, 1.0))
    suited_connector_proxy = draw_potential * 0.22
    made_component = strength * (0.66 if family == "nlh" else 0.58)
    return float(np.clip(made_component + suited_connector_proxy + late_credit - multiway_penalty, 0.0, 1.0))


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
    pot_limit = scenario.family in {"plo", "plo8"}
    hi_lo = scenario.family == "plo8"
    standard = scenario.tier == "standard"
    preflop = scenario.street_progress <= 0.01
    position_bucket = _position_bucket(scenario.position)
    range_score = scenario.range_score or _estimate_position_range_score(
        family=scenario.family,
        strength=scenario.strength,
        draw_potential=scenario.draw_potential,
        position=scenario.position,
        active_opponents=scenario.active_opponents,
    )
    value_threshold = 0.63 if standard else 0.72
    continue_threshold = max(0.24 if standard else 0.31, pot_odds + (0.03 if multiway else -0.02))
    semi_bluff_threshold = 0.48 if standard else 0.58
    if preflop:
        floor = POSITION_OPEN_FLOORS[scenario.family][position_bucket] + (0.04 if not standard else 0.0)
        continue_threshold = max(0.18, floor - (0.18 if position_bucket == "BB" else 0.08))
        value_threshold = max(value_threshold, floor + (0.14 if scenario.family in {"plo", "plo8"} else 0.1))
    thin_value_spot = late_position and scenario.strength >= 0.62 and equity >= (0.58 if standard else 0.66)
    isolation_spot = (
        multiway
        and late_position
        and equity >= (0.64 if standard else 0.72)
        and (scenario.draw_potential >= 0.22 if pot_limit else scenario.strength >= 0.68)
    )
    scoop_pressure_spot = hi_lo and equity >= (0.68 if standard else 0.75) and scenario.draw_potential >= 0.45

    if scenario.to_call > 0:
        if preflop and range_score < continue_threshold:
            return BOARD_ACTIONS.index("fold")
        if (equity >= value_threshold or range_score >= value_threshold or isolation_spot or scoop_pressure_spot) and scenario.raise_count < 4:
            return BOARD_ACTIONS.index("raise")
        if equity >= continue_threshold or range_score >= continue_threshold or (late_position and scenario.draw_potential >= semi_bluff_threshold):
            return BOARD_ACTIONS.index("call")
        return BOARD_ACTIONS.index("fold")

    if preflop and range_score < POSITION_OPEN_FLOORS[scenario.family][position_bucket] + (0.04 if not standard else 0.0):
        return BOARD_ACTIONS.index("check")
    if preflop:
        return BOARD_ACTIONS.index("bet")
    if equity >= value_threshold or range_score >= value_threshold or thin_value_spot:
        return BOARD_ACTIONS.index("bet")
    if standard and late_position and scenario.draw_potential >= semi_bluff_threshold and scenario.last_aggression < 0.55:
        return BOARD_ACTIONS.index("bet")
    return BOARD_ACTIONS.index("check")
