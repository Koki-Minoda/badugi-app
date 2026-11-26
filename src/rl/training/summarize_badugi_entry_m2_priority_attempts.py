"""Count pre-draw entry opportunities from completed M2 pilot attempts."""

from collections import Counter
import math

from rl.training.entry_m2_sampling_contract import (
    DECK_MODULUS, GROUPS, PROFILES, audit_selected_deal,
)
from rl.training.summarize_badugi_entry_m2_gaps import (
    cell_key, hand_class, opening_position_from_public_button, row_key,
)


def summarize_priority_attempts(targets, attempts, cutoff):
    """Count each condition at most once per deal, including zero-hit attempts."""
    keys = [cell_key(target) for target in targets]
    if not keys or len(set(keys)) != len(keys):
        raise ValueError("priority conditions must be nonempty and unique")
    design = {key[:4] + (key[-1],) for key in keys}
    target_keys = set(keys)
    seen_seeds = set()
    exposure = Counter()
    first = Counter()
    any_hit = Counter()

    for attempt in attempts:
        seed = attempt.get("seed")
        profile = attempt.get("profile")
        group = attempt.get("group")
        if (type(seed) is not int or not 0 <= seed < DECK_MODULUS or
                seed in seen_seeds or not isinstance(group, (list, tuple)) or
                tuple(group) not in GROUPS or profile not in PROFILES):
            raise ValueError("priority attempt seed, table, or opponent profile is invalid")
        seen_seeds.add(seed)
        physical, occupied, mode = group
        dealer = attempt.get("openingDealerSeat")
        position = opening_position_from_public_button(
            dealer, attempt.get("heroSeat"), occupied, physical,
        )
        if type(attempt.get("openingPosition")) is not int or attempt["openingPosition"] != position:
            raise ValueError("priority attempt lacks an attested opening position")

        audit_selected_deal(attempt, attempt.get("stratum"))
        hand = hand_class(attempt["openingActorCards"], cutoff)
        block = (mode, physical, occupied, position, hand)
        if block not in design:
            raise ValueError("priority attempt is outside the planned table/position/hand class")
        exposure[block, profile] += 1

        opportunities = attempt.get("predrawOpportunities")
        if (not isinstance(opportunities, list) or
                bool(opportunities) != (attempt.get("target") is not None)):
            raise ValueError("priority attempt trace and first opportunity disagree")
        markers = attempt.get("heroPredrawDecisions")
        decision_count = attempt.get("controllerDecisions")
        if not isinstance(markers, list) or type(decision_count) is not int or not 0 < decision_count <= 200:
            raise ValueError("priority attempt lacks a valid decision count or predraw markers")
        eligible = []
        marker_indices = []
        last_index = -1
        for marker in markers:
            if not isinstance(marker, dict):
                raise ValueError("priority predraw marker is malformed")
            index, mask = marker.get("decisionIndex"), marker.get("legalMask")
            if (type(index) is not int or not last_index < index < decision_count or
                    not isinstance(mask, list) or len(mask) != 6 or
                    any(value not in (0, 1) for value in mask) or not any(mask)):
                raise ValueError("priority predraw marker index or legal mask is invalid")
            last_index = index
            marker_indices.append(index)
            if all(mask[action] for action in (0, 2, 4)):
                eligible.append((index, mask))
        if attempt.get("terminalHeroPredrawDecisionIndices") != marker_indices:
            raise ValueError("priority predraw markers differ from the terminal public trace")
        if eligible != [(item.get("decisionIndex"), item.get("legalMask"))
                        for item in opportunities if isinstance(item, dict)]:
            raise ValueError("priority opportunity trace omits or adds an eligible decision")
        previous_index = -1
        first_key = None
        hits = set()
        for item in opportunities:
            if not isinstance(item, dict):
                raise ValueError("priority opportunity is malformed")
            index = item.get("decisionIndex")
            blind = item.get("activeBigBlindChips")
            if (type(index) is not int or index <= previous_index or
                    type(blind) not in (int, float) or not math.isfinite(blind) or blind <= 0 or
                    item.get("dealerSeat") != dealer):
                raise ValueError("priority opportunity index, blind, or opening dealer is invalid")
            previous_index = index
            observation = {**attempt, "target": item}
            audit_selected_deal(observation, attempt["stratum"])
            price = item["toCallBigBets"]
            if not math.isfinite(price) or price != item["legalAmountsChips"][2] / (2 * blind):
                raise ValueError("priority opportunity price disagrees with audited CALL amount")
            if len(item["publicActions"]) != index:
                raise ValueError("priority opportunity history differs from its decision index")
            key = row_key(observation, cutoff)
            if first_key is None:
                recorded = {name: value for name, value in item.items()
                            if name not in ("decisionIndex", "activeBigBlindChips")}
                if recorded != attempt["target"]:
                    raise ValueError("priority trace does not start at the recorded first opportunity")
                first_key = key
            if key in target_keys:
                hits.add(key)
        if first_key in target_keys:
            first[first_key, profile] += 1
        any_hit.update((key, profile) for key in hits)

    return [
        {
            "condition": target,
            "byKnownArtificialProfile": {
                profile: {
                    "completedAttempts": exposure[key[:4] + (key[-1],), profile],
                    "firstOpportunityHits": first[key, profile],
                    "anyOpportunityHits": any_hit[key, profile],
                }
                for profile in PROFILES
            },
        }
        for target, key in zip(targets, keys)
    ]
