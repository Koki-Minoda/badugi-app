"""Candidate-only hand-conditioned action model with latent public opponent style.

Offline profile and hand labels are used only by fit. Inference receives a
hypothetical particle bucket, public BET event and prior public action counts.
No private opponent cards or offline profile labels are accepted online.
"""
from __future__ import annotations

import math
from collections import defaultdict

from rl.training.badugi_conditional_action_model_draft import (
    conditional_action_probability, fit_conditional_action_model,
)
from rl.training.badugi_public_style_draft import estimate_public_style

STYLES = ("tight_value", "balanced_range", "loose_station", "bluff_pressure")
CATEGORIES = ("faced_fold", "faced_call", "faced_raise", "free_check", "free_bet")


def _category(event):
    legal = event["legalActions"]
    action = event["action"]
    if 0 in legal and 2 in legal and action in ("FOLD", "CALL", "RAISE"):
        return "faced_" + action.lower()
    if 1 in legal and action in ("CHECK", "BET"):
        return "free_" + action.lower()
    return None


def fit_profiled_action_model(rows, *, min_sessions_per_style=100,
                              prior_strength=8.0):
    """Fit style-conditional population action distributions from offline rows."""
    if (type(min_sessions_per_style) is not int or min_sessions_per_style < 1 or
            type(prior_strength) not in (int, float) or
            not math.isfinite(prior_strength) or prior_strength <= 0):
        raise ValueError("profiled fit requires positive frozen settings")
    by_style = {style: [] for style in STYLES}
    sessions = defaultdict(list)
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {
                "sessionId", "stateId", "truthBucket", "publicEvent", "profile"}:
            raise ValueError("profiled fit requires exact offline fields")
        profile = row["profile"]
        if profile not in STYLES:
            raise ValueError("profiled fit requires a known offline profile")
        key = (row["sessionId"], row["stateId"])
        if key in seen:
            raise ValueError("profiled fit cannot reuse a state")
        seen.add(key)
        clean = {key: row[key] for key in
                 ("sessionId", "stateId", "truthBucket", "publicEvent")}
        by_style[profile].append(clean)
        sessions[(profile, row["sessionId"])].append(row["publicEvent"])
    models = {}
    for style in STYLES:
        model = fit_conditional_action_model(by_style[style],
            min_sessions=min_sessions_per_style, prior_strength=prior_strength)
        if model["status"] != "DEVELOPMENT_FIT_ONLY":
            return {"status": "INSUFFICIENT_SESSIONS",
                    "sessionsByStyle": {style: len({r["sessionId"] for r in by_style[style]})
                                        for style in STYLES},
                    "actionOverrideAllowed": False}
        models[style] = model
    counts = {style: {category: 1.0 for category in CATEGORIES}
              for style in STYLES}
    for (style, _), events in sessions.items():
        contribution = 1.0 / len(events)
        for event in events:
            category = _category(event)
            if category:
                counts[style][category] += contribution
    probabilities = {}
    for style in STYLES:
        faced = sum(counts[style][category] for category in CATEGORIES[:3])
        free = sum(counts[style][category] for category in CATEGORIES[3:])
        probabilities[style] = {
            category: counts[style][category] /
            (faced if category.startswith("faced") else free)
            for category in CATEGORIES}
    return {"status": "DEVELOPMENT_FIT_ONLY", "profiles": models,
            "styleActionProbabilities": probabilities,
            "styleEvidencePower": 1.0,
            "actionOverrideAllowed": False}


def public_profile_probabilities(model, history):
    """Infer a style mixture from aggregate prior-hand *public* opportunities."""
    if (not isinstance(model, dict) or model.get("status") != "DEVELOPMENT_FIT_ONLY" or
            model.get("actionOverrideAllowed") is not False or
            set(model.get("profiles", {})) != set(STYLES) or
            set(model.get("styleActionProbabilities", {})) != set(STYLES)):
        raise ValueError("profiled inference requires a fitted research model")
    if history is None:
        return (0.25,) * 4
    estimate_public_style(history)  # Enforce the exact public-only history schema.
    counts = {"faced_fold": history["foldedFacingBet"],
              "faced_call": history["calledFacingBet"],
              "faced_raise": history["raisedFacingBet"],
              "free_check": history["freeBetOpportunities"] - history["betWhenFree"],
              "free_bet": history["betWhenFree"]}
    if (any(type(count) is not int or count < 0 for count in counts.values()) or
            sum(counts[category] for category in CATEGORIES[:3]) >
            history["facedBetOpportunities"]):
        raise ValueError("profiled inference requires consistent public opportunities")
    power = model["styleEvidencePower"]
    logits = [power * sum(counts[category] *
              math.log(model["styleActionProbabilities"][style][category])
              for category in CATEGORIES) for style in STYLES]
    center = max(logits)
    weights = [math.exp(value - center) for value in logits]
    return tuple(value / sum(weights) for value in weights)


def profiled_action_probability(model, event, hypothetical_bucket, history):
    """Marginal P(action | hypothetical hand, public context/history)."""
    mixture = public_profile_probabilities(model, history)
    return sum(weight * conditional_action_probability(
        model["profiles"][style], event, hypothetical_bucket)
        for style, weight in zip(STYLES, mixture))
