"""Evaluation-only Badugi opponents withheld from the training profile set."""
from __future__ import annotations

UNKNOWN_PROFILES = ("tight_range", "loose_caller", "bluff_early", "style_switch")


def unknown_opponent_action(decision: dict, profile: str, rng) -> int:
    """Choose from the acting opponent's own observation and legal mask only."""
    if profile not in UNKNOWN_PROFILES:
        raise ValueError("unknown evaluation opponent profile")
    mask = decision["legalMask"]
    allowed = [index for index, legal in enumerate(mask) if legal == 1]
    if not allowed:
        raise ValueError("empty legal mask for evaluation opponent")
    observation = decision["observation"]
    made = round(observation[24] * 4)
    high = round(observation[25] * 12)
    round_index = int(decision["drawRoundIndex"])
    if profile == "style_switch":
        profile = "bluff_early" if round_index < 2 else "tight_range"
    if decision["phase"] == "DRAW":
        if profile == "tight_range":
            target = min(4, max(0, 4 - made))
            order = (target, 1, 2, 0, 3, 4)
        elif profile == "loose_caller":
            order = (3, 2, 4, 1, 0)
        else:
            order = (0, 1, 2, 3, 4)
    elif decision["phase"] == "BET":
        to_call = observation[18] * 20
        if profile == "tight_range":
            if made == 4 and high <= 7:
                order = (4, 3, 2, 1, 0)
            elif to_call > 0 and made < 4:
                order = (0, 2, 1, 4, 3)
            else:
                order = (1, 2, 0, 3, 4)
        elif profile == "loose_caller":
            order = (2, 1, 3, 4, 0)
        elif round_index < 2 and rng.random() < 0.85:
            order = (4, 3, 2, 1, 0)
        else:
            order = (1, 2, 0, 3, 4)
    else:
        raise ValueError("invalid evaluation opponent phase")
    return next((action for action in order if action in allowed), allowed[0])
