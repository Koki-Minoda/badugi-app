"""Public-only features for an isolated Badugi hand-range calibration study."""
from __future__ import annotations

import math
from collections import Counter

from rl.training.badugi_public_range_belief_draft import _cards, _event
from rl.training.badugi_public_style_draft import estimate_public_style

GROUPS = ((2, 2, False), (3, 3, False), (6, 6, False), (6, 2, False),
          (6, 3, False), (2, 2, True), (3, 3, True), (6, 6, True),
          (6, 2, True), (6, 3, True))
ACTIONS = ("FOLD", "CHECK", "CALL", "BET", "RAISE")
FIELDS = {"baseProbabilities", "profiledProbabilities",
          "estimatedProfileProbabilities", "group", "street", "activePlayers",
          "priceToCallBb", "heroMade", "actorSeenCards", "publicActions",
          "targetSeat", "opponentPublicHistory"}


def public_range_features(evidence):
    """Numerical features from a hero decision, without target private cards."""
    if not isinstance(evidence, dict) or set(evidence) != FIELDS:
        raise ValueError("direct range requires exact public-only feature fields")
    group = evidence["group"]
    if type(group) is not int or group not in range(len(GROUPS)):
        raise ValueError("direct range requires a known public table group")
    target = evidence["targetSeat"]
    if type(target) is not int or target < 0:
        raise ValueError("direct range requires a public target seat")
    for key in ("baseProbabilities", "profiledProbabilities",
                "estimatedProfileProbabilities"):
        values = evidence[key]
        if (not isinstance(values, (tuple, list)) or len(values) != 4 or
                any(type(value) not in (int, float) or not math.isfinite(value) or
                    value < 0 or value > 1
                    for value in values) or abs(sum(values) - 1) > 1e-8):
            raise ValueError("direct range requires normalized public-derived probabilities")
    if (type(evidence["street"]) is not int or evidence["street"] not in range(4) or
            type(evidence["activePlayers"]) is not int or
            evidence["activePlayers"] not in range(1, 7) or
            type(evidence["heroMade"]) is not int or
            evidence["heroMade"] not in range(1, 5) or
            type(evidence["priceToCallBb"]) not in (int, float) or
            not math.isfinite(evidence["priceToCallBb"]) or
            evidence["priceToCallBb"] < 0):
        raise ValueError("direct range requires valid public decision context")
    seen = Counter(rank for rank, _ in _cards(evidence["actorSeenCards"]))
    history = evidence["opponentPublicHistory"]
    estimate_public_style(history)
    public_events = evidence["publicActions"]
    if not isinstance(public_events, (list, tuple)):
        raise ValueError("direct range requires ordered public actions")
    for event in public_events:
        _event(event, target)
    relevant = [event for event in public_events if event["seat"] == target]
    bets = [event for event in relevant if event["type"] == "BET_ACTION"]
    draws = [event for event in relevant if event["type"] == "DRAW_ACTION"]
    last = bets[-1] if bets else None
    if last is not None and not {"legalActions", "toCallBb", "potBb"} <= set(last):
        raise ValueError("direct range requires recorded public legal context")
    action_counts = Counter(event["action"] for event in bets)
    seats, occupied, tournament = GROUPS[group]
    return tuple(float(value) for value in (
        *evidence["baseProbabilities"],
        *evidence["profiledProbabilities"],
        *evidence["estimatedProfileProbabilities"],
        seats, occupied, int(tournament), evidence["street"],
        evidence["activePlayers"], evidence["priceToCallBb"],
        evidence["heroMade"], len(evidence["actorSeenCards"]), seen[0], seen[3],
        *(action_counts[action] for action in ACTIONS),
        len(draws), sum(event["drawCount"] for event in draws),
        last["amountBb"] if last else 0,
        last["toCallBb"] if last else 0,
        last["potBb"] if last else 0,
        *(int(index in last["legalActions"]) if last else 0 for index in range(5)),
        history["handsObserved"], history["facedBetOpportunities"],
        history["foldedFacingBet"], history["calledFacingBet"],
        history["raisedFacingBet"], history["freeBetOpportunities"],
        history["betWhenFree"],
    ))
