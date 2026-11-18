"""Fixed-look, session-level analysis for an isolated three-street study."""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from statistics import NormalDist


ARMS = ("baseline", "street1", "street2", "street3")
CONTRASTS = (("street1", "baseline"), ("street2", "baseline"),
             ("street3", "baseline"), ("street1", "street2"),
             ("street1", "street3"), ("street2", "street3"))


class OnlineMean:
    def __init__(self):
        self.n = 0
        self.mean = 0.0
        self.m2 = 0.0

    def add(self, value):
        self.n += 1
        delta = value - self.mean
        self.mean += delta / self.n
        self.m2 += delta * (value - self.mean)

    def interval(self, z):
        if self.n < 2:
            return None
        se = math.sqrt(self.m2 / ((self.n - 1) * self.n))
        return [self.mean - z * se, self.mean + z * se]

    def report(self, z):
        return {"pairedSessions": self.n,
                "differenceBigBetsPer100ScheduledHands": self.mean,
                "interval": self.interval(z)}


def analyze_street_fold_sessions(rows, *, sessions_per_cell, horizon=20,
                                 minimum_overrides_per_mode=5000):
    if (type(sessions_per_cell) is not int or sessions_per_cell < 2 or
            type(horizon) is not int or horizon < 1 or
            type(minimum_overrides_per_mode) is not int or
            minimum_overrides_per_mode < 1):
        raise ValueError("invalid frozen analysis parameters")
    groups = ((3, 3, "cash"), (6, 3, "cash"), (6, 6, "cash"),
              (3, 3, "mtt"), (6, 3, "mtt"), (6, 6, "mtt"))
    profiles = ("tight_value", "balanced_range", "loose_station",
                "bluff_pressure", "legacy_passive")
    expected = len(groups) * len(profiles) * sessions_per_cell
    z_simultaneous = NormalDist().inv_cdf(1 - 0.01 / (2 * len(CONTRASTS)))
    z_descriptive = NormalDist().inv_cdf(0.995)
    overall = {contrast: OnlineMean() for contrast in CONTRASTS}
    by_cell = defaultdict(OnlineMean)
    by_seat = defaultdict(OnlineMean)
    overrides = Counter()
    active_hands = Counter()
    count = 0
    for row in rows:
        if count >= expected:
            raise ValueError("more than frozen paired sessions")
        group_index = count // (len(profiles) * sessions_per_cell)
        profile_index = (count // sessions_per_cell) % len(profiles)
        session_index = count % sessions_per_cell
        group = groups[group_index]
        profile = profiles[profile_index]
        if (row.get("globalIndex") != count or row.get("group") != list(group) or
                row.get("profile") != profile or
                row.get("heroSeat") != session_index % group[1] or
                set(row.get("arms", {})) != set(ARMS)):
            raise ValueError("row order or paired group mismatch")
        profits = {}
        for arm in ARMS:
            metric = row["arms"][arm]
            profit = metric.get("heroProfitBigBets", 0)
            hands = metric.get("completedHeroHands", 0)
            calls = metric.get("modelCalls", 0)
            if (type(profit) not in (int, float) or not math.isfinite(profit) or
                    type(hands) is not int or not 0 <= hands <= horizon or
                    type(calls) is not int or calls <= 0 or
                    (hands == 0 and profit != 0)):
                raise ValueError("invalid real-model arm outcome")
            profits[arm] = profit
            active_hands[(arm, group[2])] += hands
            if arm != "baseline":
                value = metric.get(f"override|{arm}", 0)
                if type(value) is not int or not 0 <= value <= hands:
                    raise ValueError("invalid legal override count")
                overrides[(arm, group[2])] += value
                if value == 0 and profit != profits["baseline"]:
                    raise ValueError("zero-override session differs from baseline")
        multiplier = 100 / horizon
        for contrast in CONTRASTS:
            left, right = contrast
            difference = (profits[left] - profits[right]) * multiplier
            overall[contrast].add(difference)
            by_cell[(contrast, group, profile)].add(difference)
            by_seat[(contrast, group, row["heroSeat"])].add(difference)
        count += 1
    if count != expected:
        raise ValueError("incomplete fixed sample")
    def direction(left, right):
        if (left, right) in overall:
            return overall[(left, right)].interval(z_simultaneous)
        lower, upper = overall[(right, left)].interval(z_simultaneous)
        return [-upper, -lower]
    adequate = all(overrides[(arm, mode)] >= minimum_overrides_per_mode
                   for arm in ARMS[1:] for mode in ("cash", "mtt"))
    winners = [arm for arm in ARMS[1:] if all(
        direction(arm, other)[0] > 0 for other in ARMS if other != arm)]
    state = ("INSUFFICIENT_STREET_EXPOSURE" if not adequate else
             "DEVELOPMENT_STREET_RANK_RESOLVED" if winners else
             "DEVELOPMENT_STREET_RANK_UNRESOLVED")
    negative_cells = []
    for key, stats in by_cell.items():
        contrast, group, profile = key
        if contrast[1] != "baseline":
            continue
        interval = stats.interval(z_descriptive)
        if interval is not None and interval[1] < 0:
            negative_cells.append({"arm": contrast[0], "group": list(group),
                                   "profile": profile, **stats.report(z_descriptive)})
    return {
        "status": state, "pairedSessions": count,
        "scheduledHandsPerArm": count * horizon,
        "streetWinner": winners[0] if adequate and len(winners) == 1 else None,
        "minimumOverridesPerMode": minimum_overrides_per_mode,
        "overridesByMode": {f"{arm}|{mode}": overrides[(arm, mode)]
                            for arm in ARMS[1:] for mode in ("cash", "mtt")},
        "heroActiveHandsByMode": {f"{arm}|{mode}": active_hands[(arm, mode)]
                                  for arm in ARMS for mode in ("cash", "mtt")},
        "simultaneous99Contrasts": {f"{a}-{b}": stats.report(z_simultaneous)
                                    for (a, b), stats in overall.items()},
        "descriptive99NegativeCells": negative_cells,
        "descriptive99ByGroupProfile": [
            {"arm": contrast[0], "group": list(group), "profile": profile,
             **stats.report(z_descriptive)}
            for (contrast, group, profile), stats in sorted(by_cell.items())
            if contrast[1] == "baseline"],
        "descriptive99ByPhysicalSeat": [
            {"arm": contrast[0], "group": list(group), "heroSeat": seat,
             **stats.report(z_descriptive)}
            for (contrast, group, seat), stats in sorted(by_seat.items())
            if contrast[1] == "baseline"],
        "multipleComparisonRule": "Bonferroni two-sided familywise alpha=0.01 across six predeclared session-level contrasts",
        "denominator": "20 scheduled hands per paired session; actual hero-active hands separately reported",
        "scope": "known synthetic development only; no strength promotion, no final holdout"}
