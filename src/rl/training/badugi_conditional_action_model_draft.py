"""Offline-fit Badugi action likelihood for candidate-only range research.

Private opponent hand quality appears only as an offline fit label. Prediction
accepts a public event and a hypothetical particle bucket, never actual hidden
cards. The model cannot authorize an action override or production adoption.
"""
from __future__ import annotations

import math
from collections import defaultdict

from rl.training.badugi_public_range_belief_draft import (
    BET_ACTIONS, _event, _public_action_likelihood,
)


def _context(event):
    _event(event, event.get("seat"))
    if event["type"] != "BET_ACTION" or "legalActions" not in event:
        raise ValueError("conditional action model requires public BET legal context")
    street = event.get("drawRoundIndex")
    if type(street) is not int or not 0 <= street <= 3:
        raise ValueError("conditional action model requires a public street")
    players = 2 if event["activePlayers"] <= 2 else 3 if event["activePlayers"] == 3 else 4
    to_call = event["toCallBb"]
    price = to_call / max(1e-9, event["potBb"] + to_call)
    price_bin = 0 if to_call == 0 else 1 if price < 0.1 else 2 if price < 0.25 else 3
    menu = "".join(str(action) for action in event["legalActions"])
    return f"{street}:{players}:{price_bin}:{menu}", menu


def _valid_row(row):
    if not isinstance(row, dict) or set(row) != {
            "sessionId", "stateId", "truthBucket", "publicEvent"}:
        raise ValueError("conditional fit requires exact offline fields")
    if (type(row["sessionId"]) is not int or row["sessionId"] < 0 or
            type(row["stateId"]) is not int or row["stateId"] < 0 or
            type(row["truthBucket"]) is not int or row["truthBucket"] not in range(4)):
        raise ValueError("conditional fit requires independent IDs and a 4-class label")
    return _context(row["publicEvent"])


def fit_conditional_action_model(rows, *, min_sessions=100, prior_strength=8.0):
    """Fit population action responses, weighting each session equally."""
    if (type(min_sessions) is not int or min_sessions < 1 or
            type(prior_strength) not in (int, float) or
            not math.isfinite(prior_strength) or prior_strength <= 0):
        raise ValueError("conditional fit requires positive frozen settings")
    by_session = defaultdict(list)
    seen = set()
    for row in rows:
        context, menu = _valid_row(row)
        key = row["sessionId"], row["stateId"]
        if key in seen:
            raise ValueError("conditional fit cannot reuse a state")
        seen.add(key)
        by_session[row["sessionId"]].append((context, menu, row))
    if len(by_session) < min_sessions:
        return {"status": "INSUFFICIENT_SESSIONS", "sessions": len(by_session),
                "actionOverrideAllowed": False}
    by_context = defaultdict(lambda: [0.0] * 5)
    by_bucket_menu = defaultdict(lambda: [0.0] * 5)
    by_menu = defaultdict(lambda: [0.0] * 5)
    for entries in by_session.values():
        contribution = 1.0 / len(entries)
        for context, menu, row in entries:
            action = BET_ACTIONS.index(row["publicEvent"]["action"])
            bucket = row["truthBucket"]
            by_context[f"{bucket}:{context}"][action] += contribution
            by_bucket_menu[f"{bucket}:{menu}"][action] += contribution
            by_menu[menu][action] += contribution
    return {"status": "DEVELOPMENT_FIT_ONLY", "sessions": len(by_session),
            "priorStrength": float(prior_strength),
            "contextCounts": dict(by_context), "bucketMenuCounts": dict(by_bucket_menu),
            "menuCounts": dict(by_menu), "actionOverrideAllowed": False}


def conditional_action_probability(model, event, hypothetical_bucket):
    """P(public action | hypothetical hand bucket, public context)."""
    context, menu = _context(event)
    if (not isinstance(model, dict) or model.get("status") != "DEVELOPMENT_FIT_ONLY" or
            model.get("actionOverrideAllowed") is not False or
            type(hypothetical_bucket) is not int or hypothetical_bucket not in range(4)):
        raise ValueError("conditional inference requires a fitted research model")
    legal = event["legalActions"]
    bucket = hypothetical_bucket
    # The old public likelihood is the prior, normalized on the observed legal
    # menu. Both levels of empirical counts retain the hand bucket interaction.
    prior = [_public_action_likelihood({**event, "action": BET_ACTIONS[action]}, bucket,
                                       max(1, 4 if bucket >= 2 else bucket + 1))
             for action in legal]
    global_counts = model["bucketMenuCounts"].get(f"{bucket}:{menu}", [0.0] * 5)
    alpha = model["priorStrength"]
    global_total = sum(global_counts[action] for action in legal)
    global_probability = [(global_counts[action] + alpha * prior[i]) /
                          (global_total + alpha) for i, action in enumerate(legal)]
    local_counts = model["contextCounts"].get(f"{bucket}:{context}", [0.0] * 5)
    local_total = sum(local_counts[action] for action in legal)
    conditional = [(local_counts[action] + alpha * global_probability[i]) /
                   (local_total + alpha) for i, action in enumerate(legal)]
    return conditional[legal.index(BET_ACTIONS.index(event["action"]))]
