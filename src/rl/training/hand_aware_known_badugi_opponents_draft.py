"""Isolated development opponents with hand, price, seat and draw responses.

These are test distributions, not calibrated human ranges. They are deliberately
separate from both the legacy training profiles and frozen unknown-v1 holdout.
Only the acting opponent's own controller observation and legal mask are read.
"""
from __future__ import annotations

import math

HAND_AWARE_KNOWN_PROFILES = (
    "tight_value",
    "balanced_range",
    "loose_station",
    "bluff_pressure",
)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _first_legal(mask, *actions: int) -> int:
    return next((action for action in actions if mask[action] == 1),
                next(index for index, legal in enumerate(mask) if legal == 1))


def hand_aware_known_opponent_action(decision: dict, profile: str, rng) -> int:
    """Act on the opponent's own 96-slot observation, with no hidden hero data."""
    if profile not in HAND_AWARE_KNOWN_PROFILES:
        raise ValueError("unknown hand-aware development opponent")
    observation = decision.get("observation")
    mask = decision.get("legalMask")
    if not isinstance(observation, (list, tuple)) or len(observation) != 96:
        raise ValueError("development opponent requires a 96-slot actor observation")
    if not isinstance(mask, (list, tuple)) or len(mask) != 6 or not any(mask):
        raise ValueError("development opponent requires a nonempty legal mask")
    if any(value not in (0, 1) for value in mask):
        raise ValueError("development opponent requires a binary legal mask")
    phase = decision.get("phase")
    round_index = decision.get("drawRoundIndex")
    if phase not in ("BET", "DRAW") or not isinstance(round_index, int) or not 0 <= round_index <= 3:
        raise ValueError("invalid development opponent phase or round")
    if any(not isinstance(observation[i], (int, float)) or
           not math.isfinite(observation[i]) or not 0 <= observation[i] <= 1
           for i in (11, 12, 15, 18, 24, 25)):
        raise ValueError("invalid development opponent observation")
    made = round(observation[24] * 4)
    high = round(observation[25] * 12)
    if not 1 <= made <= 4 or not 0 <= high <= 12:
        raise ValueError("invalid acting opponent hand summary")

    if phase == "DRAW":
        target = 4 - made
        if profile == "bluff_pressure" and made == 3 and round_index < 2 and rng.random() < 0.08:
            target = 0  # Occasional snow, with the actor's own hand only.
        elif profile == "loose_station" and made == 4 and high >= 10 and round_index < 2 and rng.random() < 0.15:
            target = 1
        return _first_legal(mask, target, max(0, target - 1), min(4, target + 1), 0, 1, 2, 3, 4, 5)

    in_hand = max(2, round(observation[11] * 6))
    position = observation[12]  # 0 early, 1 late in the acting table.
    pot_bb = observation[15] * 400
    to_call_bb = observation[18] * 20
    price = to_call_bb / max(1e-9, pot_bb + to_call_bb)
    quality = {1: -0.4, 2: 0.5, 3: 1.6, 4: 3.0}[made] + (12 - high) * (0.06 if made <= 2 else 0.10)
    pressure = price * 3.0 + (in_hand - 2) * 0.40 + round_index * 0.12 - position * 0.20
    style_fold = {"tight_value": 0.18, "balanced_range": 0.0,
                  "loose_station": -0.30, "bluff_pressure": -0.05}[profile]

    if to_call_bb > 0 and mask[0] == 1:
        fold_probability = _clamp(0.50 + (pressure - quality) * 0.18 + style_fold, 0.01, 0.95)
        if made == 4 and high <= 8 and to_call_bb <= 2:
            fold_probability = min(fold_probability, 0.08)
        if rng.random() < fold_probability:
            return 0

    value_raise = made == 4 and high <= 8
    moderate_raise = made == 4 and high <= 11
    bluff = profile == "bluff_pressure" and round_index < 2
    if to_call_bb > 0:
        raise_probability = (0.62 if value_raise else 0.20 if moderate_raise else
                             0.12 if bluff else 0.03)
        if profile == "tight_value":
            raise_probability *= 0.8
        if profile == "loose_station":
            raise_probability *= 0.35
        if mask[4] == 1 and rng.random() < raise_probability:
            return 4
        return _first_legal(mask, 2, 1, 0, 4, 3, 5)

    bet_probability = (0.72 if value_raise else 0.38 if moderate_raise else
                       0.32 if made == 3 else 0.14 if bluff else 0.05)
    if profile == "tight_value" and not value_raise:
        bet_probability *= 0.6
    if profile == "loose_station":
        bet_probability *= 0.7
    if mask[3] == 1 and rng.random() < bet_probability:
        return 3
    return _first_legal(mask, 1, 3, 2, 0, 4, 5)
