"""Isolated development opponents that react to a public pat signal.

These synthetic profiles test whether an Iron snow can exploit or be punished by
opponents who interpret a public PAT. They are not calibrated human opponents
and are never included in the published model route.
"""

from __future__ import annotations

import math

from rl.training.hand_aware_known_badugi_opponents_draft import (
    _clamp, _first_legal, hand_aware_known_opponent_action)


PAT_SIGNAL_PROFILES = ('pat_respect', 'pat_skeptic')


def public_opponent_pat_signal(decision: dict) -> bool:
    """Read only public draw events from the previous draw round in heads-up play."""
    evidence = decision.get('beliefEvidence')
    if not isinstance(evidence, dict):
        raise ValueError('candidate pat-signal opponent needs public evidence')
    context = evidence.get('currentPublicBetContext')
    events = evidence.get('publicActions')
    if not isinstance(context, dict) or not isinstance(events, list):
        raise ValueError('missing public bet context or actions')
    if context.get('activePlayers') != 2 or decision.get('phase') != 'BET':
        return False
    street = decision.get('drawRoundIndex')
    seat = decision.get('seat')
    if not isinstance(street, int) or not 1 <= street <= 3 or not isinstance(seat, int):
        return False
    opponent_draws = [event for event in events
                      if event.get('type') == 'DRAW_ACTION' and event.get('seat') != seat
                      and event.get('drawRoundIndex') == street - 1]
    if len(opponent_draws) != 1:
        return False
    return opponent_draws[0].get('drawCount') == 0


def pat_signal_opponent_action(decision: dict, profile: str, rng) -> int:
    """Balanced hand-aware behavior plus a fixed public-PAT fold response."""
    if profile not in PAT_SIGNAL_PROFILES:
        raise ValueError('unknown pat-signal development opponent')
    observation = decision.get('observation')
    mask = decision.get('legalMask')
    if (not isinstance(observation, (list, tuple)) or len(observation) != 96 or
            not isinstance(mask, (list, tuple)) or len(mask) != 6):
        raise ValueError('candidate pat-signal opponent requires 96-slot actor observation')
    if decision.get('phase') != 'BET' or mask[0] != 1 or mask[2] != 1:
        return hand_aware_known_opponent_action(decision, 'balanced_range', rng)
    if not public_opponent_pat_signal(decision):
        return hand_aware_known_opponent_action(decision, 'balanced_range', rng)
    for index in (11, 12, 15, 18, 24, 25):
        if not isinstance(observation[index], (int, float)) or not math.isfinite(observation[index]):
            raise ValueError('non-finite actor observation')
    made = round(observation[24] * 4)
    high = round(observation[25] * 12)
    if not 1 <= made <= 4 or not 0 <= high <= 12:
        raise ValueError('invalid actor hand summary')
    in_hand = max(2, round(observation[11] * 6))
    position = observation[12]
    pot_bb = observation[15] * 400
    to_call_bb = observation[18] * 20
    price = to_call_bb / max(1e-9, pot_bb + to_call_bb)
    quality = {1: -0.4, 2: 0.5, 3: 1.6, 4: 3.0}[made] + (12 - high) * (
        0.06 if made <= 2 else 0.10)
    pressure = price * 3.0 + (in_hand - 2) * 0.40 + decision['drawRoundIndex'] * 0.12 - position * 0.20
    shift = 0.25 if profile == 'pat_respect' else -0.20
    fold_probability = _clamp(0.50 + (pressure - quality) * 0.18 + shift, 0.01, 0.95)
    if made == 4 and high <= 8 and to_call_bb <= 2:
        fold_probability = min(fold_probability, 0.08)
    if rng.random() < fold_probability:
        return 0
    value_raise = made == 4 and high <= 8
    moderate_raise = made == 4 and high <= 11
    raise_probability = 0.62 if value_raise else 0.20 if moderate_raise else 0.03
    if mask[4] == 1 and rng.random() < raise_probability:
        return 4
    return _first_legal(mask, 2, 1, 0, 4, 3, 5)
