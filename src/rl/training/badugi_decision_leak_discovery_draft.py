"""Candidate-only Badugi decision leak discovery from real-controller rows.

This is a development triage tool. It counts *legal opportunities* before
ranking same-state branch differences. It never approves a policy or model.
Every ranked slice must be confirmed on fresh deck seeds and then by natural
multi-hand policy EV. Hidden opponent cards are not an accepted input.
"""
from __future__ import annotations

import itertools
import math
from collections import Counter, defaultdict


_FORBIDDEN_KEYS = {"opponenthand", "opponentcards", "opponentprivatecards",
                   "holecards", "showdowncards", "hiddenhand", "hiddenhands",
                   "deckcards", "truthhand"}
_DIMENSIONS = ("street", "madeCards", "madeCardGain", "activePlayers",
               "highRank", "price", "mode", "profile",
               "opponentLastDraw", "publicBetActions")
_STREET_NAMES = ("before_first_draw", "after_first_draw",
                 "after_second_draw", "after_third_draw")


def _reject_hidden(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str):
                raise ValueError("trace keys must be strings")
            if "".join(ch for ch in key.lower() if ch.isalnum()) in _FORBIDDEN_KEYS:
                raise ValueError("opponent private or post-hand cards in trace")
            _reject_hidden(child)
    elif isinstance(value, (list, tuple)):
        for child in value:
            _reject_hidden(child)


def _integer(value, low, high=None):
    return type(value) is int and value >= low and (high is None or value <= high)


def _bucket_made_gain(value):
    return "improved" if value > 0 else "unchanged" if value == 0 else "worsened"


def _bucket_price(to_call_bb):
    return "two_or_more_big_bets" if to_call_bb >= 4 else (
        "one_big_bet" if to_call_bb >= 2 else "small_bet")


def _bucket_rank(high_rank):
    return "9_or_better" if high_rank <= 8 else "T_to_K"


def _features(row, decision, *, progress, public_context=None):
    group = row["group"]
    last_draws = (public_context or {}).get("opponentLastDrawCounts", {})
    draw_pattern = ("pat_seen" if 0 in last_draws.values() else
                    "one_card_draw_seen" if 1 in last_draws.values() else
                    "multi_card_draw_only" if last_draws else "not_observed")
    bet_actions = (public_context or {}).get("sameHandPublicBetActions", 0)
    return {"street": decision["street"], "madeCards": decision["madeCards"],
            "madeCardGain": _bucket_made_gain(progress),
            "activePlayers": "2" if decision["activePlayers"] == 2 else "3_plus",
            "highRank": _bucket_rank(decision["highRank"]),
            "price": _bucket_price(decision["toCallBb"]),
            "mode": group[2], "profile": row["profile"],
            "opponentLastDraw": draw_pattern,
            "publicBetActions": "two_plus" if bet_actions >= 2 else str(bet_actions)}


def _cell_key(features, dimensions):
    return "|".join(f"{key}={features[key]}" for key in dimensions)


def _branch_stats(values):
    n = len(values)
    mean = sum(values) / n
    if n > 1:
        se = math.sqrt(sum((value - mean) ** 2 for value in values) / (n * (n - 1)))
        interval = [mean - 1.96 * se, mean + 1.96 * se]
    else:
        interval = None
    return {"sessions": n, "callMinusFoldBigBetsPerSelectedHand": mean,
            "descriptive95": interval}


def discover_badugi_decision_leaks(rows, *, minimum_branch_sessions=30,
                                   max_ranked_hypotheses=12):
    """Return opportunity counts and ranked *hypotheses*, never policy approval.

    Input is one real-controller hand per unique deck seed. A row may have one
    same-state FOLD/CALL branch selected before branch returns were observed.
    The caller is responsible for checking the frozen source and model hashes.
    """
    if not _integer(minimum_branch_sessions, 2) or not _integer(max_ranked_hypotheses, 1):
        raise ValueError("invalid discovery display limits")
    opportunities = defaultdict(Counter)
    street_hands = defaultdict(set)
    street_target_hands = defaultdict(set)
    branches = defaultdict(list)
    branch_members = defaultdict(set)
    seen_pairs = set()
    seen_decks = set()
    branch_count = 0
    hand_count = 0
    for row in rows:
        _reject_hidden(row)
        if (not isinstance(row, dict) or
                not _integer(row.get("pairIndex"), 0) or
                not _integer(row.get("seed"), 0) or
                not _integer(row.get("heroSeat"), 0, 5) or
                not isinstance(row.get("group"), list) or len(row["group"]) != 3 or
                not all(_integer(v, 2, 6) for v in row["group"][:2]) or
                row["group"][1] > row["group"][0] or
                row["group"][2] not in ("cash", "mtt") or
                not isinstance(row.get("profile"), str) or not row["profile"] or
                not isinstance(row.get("arms"), dict) or
                set(row["arms"]) != {"checkpoint31"}):
            raise ValueError("invalid one-hand real-controller row")
        if row["heroSeat"] >= row["group"][0]:
            raise ValueError("hero seat is outside the occupied table")
        if row["pairIndex"] in seen_pairs or row["seed"] % 2**32 in seen_decks:
            raise ValueError("duplicate pair or actual deck seed")
        seen_pairs.add(row["pairIndex"])
        seen_decks.add(row["seed"] % 2**32)
        hand_count += 1
        decisions = row["arms"]["checkpoint31"].get("heroBetDecisions")
        if not isinstance(decisions, list):
            raise ValueError("missing hero BET decision records")
        selected = None
        for ordinal, decision in enumerate(decisions):
            mask = decision.get("legalMask")
            action = decision.get("action")
            if (not _integer(decision.get("street"), 0, 3) or
                    not _integer(decision.get("madeCards"), 1, 4) or
                    not _integer(decision.get("highRank"), 0, 12) or
                    not _integer(decision.get("madeCardGain"), -3, 3) or
                    not _integer(decision.get("activePlayers"), 1, row["group"][1]) or
                    not isinstance(mask, list) or len(mask) != 6 or
                    any(v not in (0, 1) for v in mask) or
                    not _integer(action, 0, 4) or mask[action] != 1 or
                    type(decision.get("toCallBb")) not in (int, float) or
                    not math.isfinite(decision["toCallBb"]) or
                    type(decision.get("potBb")) not in (int, float) or
                    not math.isfinite(decision["potBb"])):
                raise ValueError("malformed or illegal hero BET decision")
            if not mask[0] or decision["toCallBb"] <= 0:
                continue
            if decision["activePlayers"] < 2 or not mask[2]:
                raise ValueError("facing-bet opportunity has no legal call or opponent")
            street_hands[decision["street"]].add(row["pairIndex"])
            if (decision["street"] >= 1 and
                    decision["madeCards"] == 3 and decision["madeCardGain"] == 0 and
                    decision["activePlayers"] >= 3 and action == 2 and
                    decision["toCallBb"] >= (1 if decision["street"] <= 1 else 2)):
                street_target_hands[decision["street"]].add(row["pairIndex"])
            features = _features(row, decision, progress=decision["madeCardGain"])
            for dimensions in (("street",), ("street", "activePlayers"),
                               ("street", "madeCards"),
                               ("street", "madeCards", "madeCardGain", "activePlayers")):
                counter = opportunities[_cell_key(features, dimensions)]
                counter["facingBet"] += 1
                counter[{0: "fold", 1: "check", 2: "call", 3: "bet", 4: "raise"}[action]] += 1
            if (selected is None and decision["street"] == 2 and action == 2 and
                    mask[2] == 1 and decision["toCallBb"] >= 2):
                selected = ordinal
        branch = row.get("branch")
        if (branch is None) != (selected is None):
            raise ValueError("missing or unexpected pre-return selected branch")
        if branch is None:
            continue
        if (not isinstance(branch, dict) or branch.get("targetBetOrdinal") != selected or
                type(branch.get("callBigBets")) not in (int, float) or
                type(branch.get("foldBigBets")) not in (int, float) or
                not math.isfinite(branch["callBigBets"]) or
                not math.isfinite(branch["foldBigBets"])):
            raise ValueError("invalid paired branch")
        decision = decisions[selected]
        context = branch.get("context")
        if (not isinstance(context, dict) or
                context.get("madeCardGain") != decision["madeCardGain"] or
                context.get("toCallBb") != decision["toCallBb"] or
                context.get("activePlayers") != decision["activePlayers"] or
                not isinstance(context.get("opponentLastDrawCounts", {}), dict) or
                any(not _integer(v, 0, 4) for v in
                    context.get("opponentLastDrawCounts", {}).values()) or
                not _integer(context.get("sameHandPublicBetActions", 0), 0) or
                not isinstance(context.get("current"), dict) or
                context["current"].get("madeCards") != decision["madeCards"] or
                context["current"].get("highRank") != decision["highRank"]):
            raise ValueError("branch does not match the source decision")
        branch_count += 1
        delta = branch["callBigBets"] - branch["foldBigBets"]
        features = _features(row, decision, progress=decision["madeCardGain"],
                             public_context=context)
        branches["all"].append(delta)
        branch_members["all"].add(row["pairIndex"])
        for size in (1, 2, 3):
            for dimensions in itertools.combinations(_DIMENSIONS, size):
                key = _cell_key(features, dimensions)
                branches[key].append(delta)
                branch_members[key].add(row["pairIndex"])
    if hand_count == 0:
        raise ValueError("empty discovery source")
    cells = []
    for name, values in branches.items():
        if len(values) < minimum_branch_sessions:
            continue
        item = {"slice": name, **_branch_stats(values)}
        if item["callMinusFoldBigBetsPerSelectedHand"] < 0:
            item["triageScore"] = (-item["callMinusFoldBigBetsPerSelectedHand"] *
                                    len(values) / branch_count)
            cells.append(item)
    cells.sort(key=lambda item: (-item["triageScore"], -item["sessions"], item["slice"]))
    unique_cells = []
    seen_memberships = set()
    for item in cells:
        membership = frozenset(branch_members[item["slice"]])
        if membership in seen_memberships:
            continue
        seen_memberships.add(membership)
        unique_cells.append(item)
        if len(unique_cells) >= max_ranked_hypotheses:
            break
    return {"status": "DISCOVERY_ONLY", "hands": hand_count,
            "pairedBranchSessions": branch_count,
            "streetOpportunitySummary": [
                {"street": street, "label": _STREET_NAMES[street],
                 "facingBetDecisions": opportunities.get(f"street={street}", {}).get("facingBet", 0),
                 "handsWithFacingBet": len(street_hands[street]),
                 "threeCardUnchangedMultiwayNaturalCallHands":
                     len(street_target_hands[street]) if street >= 1 else None}
                for street in range(4)],
            "opportunityCells": {name: dict(counts)
                                 for name, counts in sorted(opportunities.items())},
            "rankedHypotheses": unique_cells,
            "screenedSliceCount": len(branches),
            "minimumBranchSessionsForDisplay": minimum_branch_sessions,
            "actionOverrideAllowed": False, "modelPromotionAllowed": False,
            "requiresFreshSeedConfirmation": True,
            "requiresNaturalMultiHandPolicyEv": True,
            "uncertaintyNote": "Descriptive intervals are unadjusted across many discovered slices. Multiple decisions per hand are counts, not independent samples. This source contains paired FOLD/CALL returns only after the second draw; first and third draw branch EV and natural multi-hand policy EV are unmeasured. No final holdout or action authorization."}
