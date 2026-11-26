"""Conservative candidate-only blend with an exact fallback outside gated tables."""
from __future__ import annotations

import math


def gated_public_range_probabilities(*, baseline, learned, group,
                                     selected_groups, weight):
    """Mix public-derived posteriors; this never authorizes an action override."""
    if (type(group) is not int or group not in range(10) or
            not isinstance(selected_groups, (tuple, list)) or
            any(type(item) is not int or item not in range(10)
                for item in selected_groups) or
            len(set(selected_groups)) != len(selected_groups) or
            type(weight) not in (int, float) or not math.isfinite(weight) or
            not 0 <= weight <= 1):
        raise ValueError("gated range requires frozen public group and weight")
    for probabilities in (baseline, learned):
        if (not isinstance(probabilities, (tuple, list)) or len(probabilities) != 4 or
                any(type(value) not in (int, float) or not math.isfinite(value) or
                    value < 0 or value > 1 for value in probabilities) or
                abs(sum(probabilities) - 1) > 1e-8):
            raise ValueError("gated range requires normalized public-derived probabilities")
    if group not in selected_groups:
        return tuple(baseline)
    return tuple((1 - weight) * old + weight * new
                 for old, new in zip(baseline, learned))
