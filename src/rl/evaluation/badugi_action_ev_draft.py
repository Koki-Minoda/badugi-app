"""Offline paired legal-action diagnostics for an isolated Badugi candidate.

This module summarizes realized controller rollouts. It does not infer a
counterfactual from a single observed outcome and cannot authorize a live
action or model promotion.
"""

from __future__ import annotations

import math
import random
from collections import defaultdict


def summarize_paired_action_ev(rows, *, minimum_sessions_per_cell=20,
                               bootstrap_repetitions=5000, seed=20261118):
    """Compare two legal branches with session-clustered uncertainty.

    Each row is one frozen target in one independent controller session. A
    session may contain multiple targets; those targets remain one bootstrap
    unit. Big bet units are fixed by the controller at the target decision.
    """
    if (type(minimum_sessions_per_cell) is not int or minimum_sessions_per_cell < 2 or
            type(bootstrap_repetitions) is not int or bootstrap_repetitions < 100 or
            type(seed) is not int):
        raise ValueError("invalid paired-action evaluation settings")
    by_cell = defaultdict(lambda: defaultdict(list))
    seen_targets = set()
    session_cells = {}
    for row in rows:
        if not isinstance(row, dict) or set(row) != {
                "sessionId", "stateId", "group", "profile", "legalMask",
                "baseAction", "alternateAction", "activeBigBlind",
                "baseChipDeltaBySeat", "alternateChipDeltaBySeat", "heroSeat"}:
            raise ValueError("paired row has missing or unexpected fields")
        session, state, group, profile = (row[key] for key in
                                           ("sessionId", "stateId", "group", "profile"))
        if (type(session) is not int or type(state) is not int or state < 0 or
                type(group) is not int or group not in range(10) or
                not isinstance(profile, str) or not profile):
            raise ValueError("invalid independent target identity")
        target = (session, state)
        if target in seen_targets:
            raise ValueError("a target was counted twice")
        seen_targets.add(target)
        cell = (group, profile)
        if session in session_cells and session_cells[session] != cell:
            raise ValueError("one session cannot span table/profile cells")
        session_cells[session] = cell
        mask = row["legalMask"]
        base, alternate = row["baseAction"], row["alternateAction"]
        if (not isinstance(mask, (list, tuple)) or len(mask) != 6 or
                any(type(value) is not int or value not in (0, 1) for value in mask) or
                type(base) is not int or type(alternate) is not int or
                base not in range(5) or alternate not in range(5) or
                base == alternate or mask[base] != 1 or mask[alternate] != 1):
            raise ValueError("paired branches must be distinct legal BET actions")
        blind = row["activeBigBlind"]
        if type(blind) not in (int, float) or not math.isfinite(blind) or blind <= 0:
            raise ValueError("invalid target big blind")
        hero = row["heroSeat"]
        deltas = (row["baseChipDeltaBySeat"], row["alternateChipDeltaBySeat"])
        if (type(hero) is not int or not isinstance(deltas[0], (list, tuple)) or
                not isinstance(deltas[1], (list, tuple)) or
                len(deltas[0]) != len(deltas[1]) or len(deltas[0]) not in (2, 3, 6) or
                not 0 <= hero < len(deltas[0]) or
                any(type(value) not in (int, float) or not math.isfinite(value)
                    for arm in deltas for value in arm) or
                any(abs(sum(arm)) > 1e-8 for arm in deltas)):
            raise ValueError("paired controller chip deltas must conserve chips")
        # Fixed-limit Badugi's big bet is twice the active big blind.
        gain = (deltas[1][hero] - deltas[0][hero]) / (2 * blind)
        by_cell[(group, profile)][session].append(gain)
    if not by_cell:
        raise ValueError("no paired controller outcomes")
    rng = random.Random(seed)
    cells = []
    for (group, profile), sessions in sorted(by_cell.items()):
        means = [sum(values) / len(values) for values in sessions.values()]
        session_count = len(means)
        estimates = []
        for _ in range(bootstrap_repetitions):
            estimates.append(sum(means[rng.randrange(session_count)]
                                 for _ in means) / session_count)
        estimates.sort()
        cells.append({"group": group, "profile": profile,
                      "independentSessions": session_count,
                      "pairedTargets": sum(map(len, sessions.values())),
                      "meanBigBetsPerSelectedDecision": sum(means) / session_count,
                      "descriptive95PercentInterval": [
                          estimates[int(.025 * bootstrap_repetitions)],
                          estimates[int(.975 * bootstrap_repetitions)]],
                      "sufficientSessionCoverage":
                          session_count >= minimum_sessions_per_cell})
    return {"status": "KNOWN_DEVELOPMENT_ACTION_DIAGNOSTIC_ONLY",
            "cells": cells,
            "allObservedCellsCovered": all(c["sufficientSessionCoverage"]
                                           for c in cells),
            "complete40CellMatrix": len(cells) == 40 and
                all(c["sufficientSessionCoverage"] for c in cells),
            "actionOverrideAllowed": False,
            "promotionEligible": False,
            "unit": "big bets per selected decision; not big bets per 100 hands"}
