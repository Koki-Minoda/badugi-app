"""Candidate-only first-draw count experiment for the D03 Iron evaluation path.

The published model and registry do not import this module. The caller supplies
one actor-visible controller decision and the ONNX model's natural action.
"""
from __future__ import annotations

from collections.abc import Mapping


def first_draw_count_action(
    decision: Mapping[str, object], natural_action: int, *, already_overridden: bool = False
) -> tuple[int, bool]:
    """Use a legal two-card draw from a made-two hand with 3+ active players.

    Returns ``(action, did_override)``. The caller enforces at most one override
    per hand, and must continue to validate the controller's legal mask.
    """
    if type(natural_action) is not int or type(already_overridden) is not bool:
        raise TypeError("candidate action and override state must be exact types")
    if decision.get("phase") != "DRAW" or decision.get("drawRoundIndex") != 0:
        return natural_action, False
    if already_overridden or natural_action != 1:
        return natural_action, False
    try:
        mask = decision["legalMask"]
        belief = decision["beliefEvidence"]
        made = belief["actorHandProgress"]["current"]["madeCards"]
        active = belief["currentPublicDrawContext"]["activePlayers"]
    except (KeyError, TypeError, IndexError) as error:
        raise ValueError("actor-visible first-draw evidence is incomplete") from error
    if (type(made) is not int or type(active) is not int or
            len(mask) <= 2 or mask[1] != 1 or mask[2] not in (0, 1)):
        raise ValueError("first-draw evidence or legal mask is invalid")
    if made == 2 and active >= 3 and mask[2] == 1:
        return 2, True
    return natural_action, False
