"""Session-weighted development check for candidate-only public-style mixing.

The truth bucket is an offline scorer label. It must never be passed to the
acting model, and a positive result here does not authorize action overrides.
"""
from __future__ import annotations

import math
from collections import defaultdict

WEIGHTS = ("0", "0.25", "0.5", "0.75")
_FIELDS = {"sessionId", "stateId", "group", "profile", "truthBucket", "probabilities"}


def _row(row):
    if not isinstance(row, dict) or set(row) != _FIELDS:
        raise ValueError("style fit requires exact offline score fields")
    if (type(row["sessionId"]) is not int or row["sessionId"] < 0 or
            type(row["stateId"]) is not int or row["stateId"] < 0 or
            type(row["group"]) is not int or not 0 <= row["group"] < 10 or
            not isinstance(row["profile"], str) or not row["profile"] or
            type(row["truthBucket"]) is not int or row["truthBucket"] not in range(4)):
        raise ValueError("style fit requires session, cell and offline bucket")
    variants = row["probabilities"]
    if not isinstance(variants, dict) or set(variants) != set(WEIGHTS):
        raise ValueError("style fit requires every frozen weight")
    for values in variants.values():
        if (not isinstance(values, (list, tuple)) or len(values) != 4 or
                any(type(p) not in (int, float) or not math.isfinite(p) or p < 0
                    for p in values) or not 0.999 <= sum(values) <= 1.001):
            raise ValueError("style fit requires four valid probabilities")
    return row


def _brier(values, truth):
    return sum((p - (i == truth)) ** 2 for i, p in enumerate(values))


def _sessions(rows):
    grouped = defaultdict(list)
    identity = {}
    seen_states = set()
    for item in rows:
        row = _row(item)
        session = row["sessionId"]
        cell = (row["group"], row["profile"])
        state = (session, row["stateId"])
        if state in seen_states:
            raise ValueError("style fit cannot count the same state twice")
        seen_states.add(state)
        if session in identity and identity[session] != cell:
            raise ValueError("one session cannot span multiple cells")
        identity[session] = cell
        grouped[session].append(row)
    return grouped, identity


def fit_style_weight(rows, *, min_sessions=100):
    """Choose one global weight on fit sessions, counting each session once."""
    sessions, _ = _sessions(rows)
    if len(sessions) < min_sessions:
        return {"status": "INSUFFICIENT_FIT_SESSIONS", "weight": None,
                "sessions": len(sessions), "actionOverrideAllowed": False}
    means = {weight: sum(
        sum(_brier(row["probabilities"][weight], row["truthBucket"])
            for row in entries) / len(entries) for entries in sessions.values()
    ) / len(sessions) for weight in WEIGHTS}
    chosen = min(WEIGHTS, key=lambda weight: (means[weight], WEIGHTS.index(weight)))
    return {"status": "DEVELOPMENT_FIT_ONLY", "weight": chosen,
            "sessions": len(sessions), "sessionMeanBrier": means,
            "actionOverrideAllowed": False}


def validate_style_weight(rows, fitted, *, profiles,
                          min_sessions_per_cell=5, min_states_per_cell=20,
                          minimum_global_brier_gain=0.002):
    """Keep all cells, missing evidence and negative cells visible."""
    if (not isinstance(fitted, dict) or fitted.get("status") != "DEVELOPMENT_FIT_ONLY" or
            fitted.get("weight") not in WEIGHTS or
            not isinstance(profiles, (list, tuple)) or not profiles or
            len(set(profiles)) != len(profiles)):
        raise ValueError("validation requires a frozen fit result and profiles")
    sessions, identity = _sessions(rows)
    expected = [(group, profile) for group in range(10) for profile in profiles]
    unexpected = set(identity.values()) - set(expected)
    if unexpected:
        raise ValueError("validation contains a cell outside the frozen profile set")
    cell_sessions = defaultdict(list)
    weight = fitted["weight"]
    for session, entries in sessions.items():
        base = sum(_brier(row["probabilities"]["0"], row["truthBucket"])
                   for row in entries) / len(entries)
        candidate = sum(_brier(row["probabilities"][weight], row["truthBucket"])
                        for row in entries) / len(entries)
        cell_sessions[identity[session]].append((len(entries), base, candidate))
    cells = []
    for group, profile in expected:
        values = cell_sessions[(group, profile)]
        n = len(values)
        states = sum(item[0] for item in values)
        base = sum(item[1] for item in values) / n if n else None
        candidate = sum(item[2] for item in values) / n if n else None
        cells.append({"group": group, "profile": profile, "sessions": n,
                      "states": states, "baseSessionBrier": base,
                      "candidateSessionBrier": candidate,
                      "nonWorse": n >= min_sessions_per_cell and
                      states >= min_states_per_cell and candidate <= base})
    base_all = sum(item[1] for values in cell_sessions.values() for item in values) / len(sessions) if sessions else None
    candidate_all = sum(item[2] for values in cell_sessions.values() for item in values) / len(sessions) if sessions else None
    return {"status": "DEVELOPMENT_VALIDATION_ONLY", "weight": weight,
            "sessions": len(sessions), "cells": cells,
            "globalSessionBrierBase": base_all,
            "globalSessionBrierCandidate": candidate_all,
            "minimumGlobalGainMet": bool(sessions) and
                base_all - candidate_all >= minimum_global_brier_gain,
            "allCellsNonWorse": all(cell["nonWorse"] for cell in cells),
            "actionOverrideAllowed": False}
