"""Candidate-only public-state eligibility for a street-by-street fold study.

This function never selects an action for the live game. The caller must keep
the frozen study plan, use real-controller legal masks, and compare paired
natural 20-hand policy outcomes before making any strength claim.
"""
from __future__ import annotations

import math


STREET_LABELS = {
    0: "before_first_draw",
    1: "after_first_draw",
    2: "after_second_draw",
    3: "after_third_draw",
}


def eligible_postdraw_fold_street(*, street, natural_action, legal_mask,
                                  to_call_bb, made_cards, made_card_gain,
                                  active_players):
    """Return the eligible post-draw street, or None for no intervention.

    Price uses big-blind units from the public controller. Full small-bet
    price after the first draw is 1 bb; full big-bet price after the second
    and third draws is 2 bb. The fixed-limit big bet is 2 bb.
    """
    if (type(street) is not int or street not in STREET_LABELS or
            type(natural_action) is not int or natural_action not in range(5) or
            not isinstance(legal_mask, (list, tuple)) or len(legal_mask) != 6 or
            any(type(value) is not int or value not in (0, 1)
                for value in legal_mask) or
            legal_mask[natural_action] != 1 or
            type(to_call_bb) not in (int, float) or not math.isfinite(to_call_bb) or
            to_call_bb < 0 or
            type(made_cards) is not int or not 1 <= made_cards <= 4 or
            type(made_card_gain) is not int or not -3 <= made_card_gain <= 3 or
            type(active_players) is not int or not 1 <= active_players <= 6):
        raise ValueError("invalid public controller fold opportunity")
    if street == 0:
        return None  # No prior draw: 'no improvement' has a different meaning.
    full_street_bet_bb = 1 if street == 1 else 2
    if (natural_action == 2 and legal_mask[0] == 1 and legal_mask[2] == 1 and
            to_call_bb >= full_street_bet_bb and made_cards == 3 and
            made_card_gain == 0 and active_players >= 3):
        return street
    return None
