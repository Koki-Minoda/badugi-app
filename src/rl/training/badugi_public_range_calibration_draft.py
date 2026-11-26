"""Candidate-only calibration of public-action Badugi range estimates.

Rows come from known-development controller sessions. Opponent hand labels are
used only by this offline scorer, never included in the acting seat's input.
An improved development score is not permission to override actions or use a
model in production; unknown-opponent and independent EV gates remain separate.
"""
from __future__ import annotations

import math
from collections import defaultdict

TEMPERATURES = (0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0)


def _probabilities(values):
    if (not isinstance(values, (list, tuple)) or len(values) != 4 or
            any(not isinstance(p, (int, float)) or not math.isfinite(p) or p < 0
                for p in values) or not 0.999 <= sum(values) <= 1.001):
        raise ValueError("range calibration requires four valid probabilities")
    return tuple(max(1e-12, float(p)) for p in values)


def _row(row):
    allowed = {"seed", "group", "profile", "truthBucket", "prior", "posterior",
               "events", "remainingAces", "remainingFours"}
    if isinstance(row, dict) and set(row) - allowed:
        raise ValueError("range calibration rows cannot contain private card fields")
    if not isinstance(row, dict) or type(row.get("group")) is not int or row["group"] < 0 or \
            type(row.get("truthBucket")) is not int or row["truthBucket"] not in range(4) or \
            not isinstance(row.get("profile"), str) or not row["profile"]:
        raise ValueError("range calibration requires group, profile and truth label")
    return row["group"], row["profile"], row["truthBucket"], \
        _probabilities(row.get("prior")), _probabilities(row.get("posterior"))


def apply_temperature(probabilities, temperature):
    """Reweight four-class posterior without changing its class ordering."""
    values = _probabilities(probabilities)
    if not isinstance(temperature, (int, float)) or not math.isfinite(temperature) or temperature <= 0:
        raise ValueError("temperature must be positive and finite")
    powered = [p ** (1.0 / temperature) for p in values]
    total = sum(powered)
    return tuple(p / total for p in powered)


def _brier(probabilities, truth):
    return sum((p - (index == truth)) ** 2 for index, p in enumerate(probabilities))


def fit_development_temperatures(rows, *, min_group_rows=400):
    """Fit by group only; profile labels never select an inference temperature."""
    grouped = defaultdict(list)
    for row in rows:
        group, _, truth, _, posterior = _row(row)
        grouped[group].append((truth, posterior))
    result = {}
    for group, values in grouped.items():
        if len(values) < min_group_rows:
            continue
        result[group] = min(TEMPERATURES, key=lambda temperature: (
            sum(-math.log(apply_temperature(posterior, temperature)[truth])
                for truth, posterior in values), temperature))
    return result


def validate_development_calibration(rows, temperatures, *, min_cell_rows=100):
    """Report all profile cells and fail closed on any missing/worse cell.

    This is a development diagnostic only. Even `allCellsNonWorse=True` does not
    assert human calibration, unknown-opponent robustness, EV, or promotion.
    """
    if not isinstance(temperatures, dict) or any(type(g) is not int or
            t not in TEMPERATURES for g, t in temperatures.items()):
        raise ValueError("calibration requires frozen group temperatures")
    cells = defaultdict(list)
    for row in rows:
        group, profile, truth, prior, posterior = _row(row)
        if group not in temperatures:
            raise ValueError("validation group is absent from fitted temperatures")
        calibrated = apply_temperature(posterior, temperatures[group])
        cells[(group, profile)].append((_brier(prior, truth),
                                        _brier(calibrated, truth)))
    report = []
    for (group, profile), scores in sorted(cells.items()):
        count = len(scores)
        prior = sum(a for a, _ in scores) / count
        posterior = sum(b for _, b in scores) / count
        report.append({"group": group, "profile": profile, "states": count,
                       "priorBrier": prior, "calibratedBrier": posterior,
                       "nonWorse": count >= min_cell_rows and posterior <= prior})
    return {"status": "DEVELOPMENT_DIAGNOSTIC_ONLY", "cells": report,
            "allCellsNonWorse": bool(report) and all(cell["nonWorse"] for cell in report),
            "actionOverrideAllowed": False}
