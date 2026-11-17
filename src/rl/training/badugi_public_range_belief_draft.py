"""Candidate-only Badugi range particles from cards the actor saw and public actions.

The action likelihoods below are research assumptions, not calibrated human
frequencies. No production model or frozen evaluation reads this module.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass

from rl.env.badugi_env import build_deck, evaluate_badugi
from rl.training.badugi_starting_ranges import best_badugi_keep
from rl.training.badugi_public_style_draft import estimate_public_style

DECK = tuple(build_deck())
BUCKETS = ("one_or_two", "three", "ten_to_king_badugi", "nine_or_better_badugi")
BET_ACTIONS = ("FOLD", "CHECK", "CALL", "BET", "RAISE")


def _cards(cards):
    result = tuple(tuple(card) for card in cards)
    if any(len(card) != 2 or type(card[0]) is not int or type(card[1]) is not int or
           not 0 <= card[0] <= 12 or not 0 <= card[1] <= 3 for card in result):
        raise ValueError("only actor-visible rank/suit cards are accepted")
    if len(set(result)) != len(result):
        raise ValueError("a visible card was counted twice")
    return result


def remaining_rank_counts(actor_seen_cards):
    """Exact card removal: rank 0 is Ace, rank 3 is four."""
    seen = _cards(actor_seen_cards)
    counts = [4] * 13
    for rank, _ in seen:
        counts[rank] -= 1
    return tuple(counts)


def _bucket(hand):
    made, ranks = evaluate_badugi(hand)
    if made <= 2:
        return 0
    if made == 3:
        return 1
    return 3 if max(ranks) <= 8 else 2


def _event(event, target_seat):
    if not isinstance(event, dict) or set(event) - {
            "type", "seat", "action", "amountBb", "drawCount", "drawRoundIndex",
            "legalActions", "toCallBb", "potBb", "activePlayers"}:
        raise ValueError("range input must contain public action fields only")
    if type(event.get("seat")) is not int or event["seat"] < 0:
        raise ValueError("range event requires a seat")
    kind = event.get("type")
    if kind == "BET_ACTION":
        if event.get("action") not in ("FOLD", "CHECK", "CALL", "BET", "RAISE") or not isinstance(event.get("amountBb"), (int, float)) or not math.isfinite(event["amountBb"]) or event["amountBb"] < 0:
            raise ValueError("range event requires public bet action and amount")
        context = {"legalActions", "toCallBb", "potBb", "activePlayers"}
        if context & event.keys():
            if not context <= event.keys():
                raise ValueError("range event requires complete public legal context")
            legal = event["legalActions"]
            if (not isinstance(legal, (list, tuple)) or not legal or
                    any(type(index) is not int or index not in range(5) for index in legal) or
                    tuple(legal) != tuple(sorted(set(legal))) or
                    BET_ACTIONS.index(event["action"]) not in legal or
                    any(type(event[key]) not in (int, float) or
                        not math.isfinite(event[key]) or event[key] < 0
                        for key in ("toCallBb", "potBb")) or
                    type(event["activePlayers"]) is not int or
                    not 1 <= event["activePlayers"] <= 6):
                raise ValueError("range event has invalid public legal context")
    elif kind == "DRAW_ACTION":
        if (type(event.get("drawCount")) is not int or not 0 <= event["drawCount"] <= 4 or
                {"legalActions", "toCallBb", "potBb", "activePlayers"} & event.keys()):
            raise ValueError("range event requires public draw count")
    else:
        raise ValueError("range event type is not public BET or DRAW")
    return event["seat"] == target_seat


def _likelihood(event, bucket, made):
    if event["type"] == "DRAW_ACTION":
        target = 4 - made
        distance = abs(event["drawCount"] - target)
        return (0.75, 0.17, 0.05, 0.02, 0.01)[distance]
    action = event["action"]
    # Every bucket retains bluff and trap mass; size is public fixed-limit units.
    strength = (0.10, 0.32, 0.62, 0.84)[bucket]
    size = min(2.0, float(event["amountBb"]))
    if action in ("RAISE", "BET"):
        return max(0.03, 0.08 + strength * (0.55 + 0.12 * size))
    if action == "FOLD":
        return max(0.03, 0.65 - strength * 0.58)
    if action == "CALL":
        return 0.30 + strength * 0.10
    return 0.40 - strength * 0.10


def _public_action_likelihood(event, bucket, made):
    """Normalize against the public legal menu, when that menu was recorded.

    Legacy events without a menu retain their frozen diagnostic likelihood.
    No uncalibrated style mixing is allowed to change the posterior here.
    """
    if event["type"] != "BET_ACTION" or "legalActions" not in event:
        return _likelihood(event, bucket, made)
    # In fixed limit, each alternative has its own public contribution. Using
    # the observed raise amount for CHECK or CALL would make the probabilities
    # depend on which alternative happened to be observed.
    unit = 2 if event.get("drawRoundIndex", 0) >= 2 else 1
    def candidate(index):
        action = BET_ACTIONS[index]
        amount = (0 if index <= 1 else event["toCallBb"] if index == 2 else
                  unit if index == 3 else event["toCallBb"] + unit)
        return _likelihood({**event, "action": action, "amountBb": amount}, bucket, made)
    baseline = candidate(BET_ACTIONS.index(event["action"]))
    total = sum(candidate(index)
                for index in event["legalActions"])
    return baseline / total


def _after_draw(hand, used_cards, draw_count, unseen, rng):
    if draw_count == 0:
        return hand, used_cards
    keep = best_badugi_keep(hand)
    wanted = 4 - draw_count
    if len(keep) > wanted:
        keep = keep[:wanted]
    elif len(keep) < wanted:
        keep += [card for card in hand if card not in keep][:wanted - len(keep)]
    pool = [card for card in unseen if card not in used_cards]
    if len(pool) < draw_count:
        raise ValueError("insufficient unseen cards for public draw")
    drawn = rng.sample(pool, draw_count)
    return tuple(keep + drawn), used_cards | frozenset(drawn)


@dataclass(frozen=True)
class RangeEstimate:
    probabilities: tuple[float, float, float, float]
    remaining_aces: int
    remaining_fours: int
    public_events_used: int
    particles: int
    calibrated: bool = False
    style_weight_applied: float = 0.0


def estimate_public_range(*, actor_seen_cards, public_events, target_seat, seed,
                          particles=2048, opponent_public_history=None,
                          style_weight=0.0, action_model=None):
    """Particle posterior for a single opponent, with no private-opponent input.

    Rebuild from all actor-visible cards and chronological public events. This
    also conditions earlier particle hands on cards revealed to the actor later.
    """
    seen = _cards(actor_seen_cards)
    if type(target_seat) is not int or target_seat < 0 or type(seed) is not int or type(particles) is not int or particles < 64:
        raise ValueError("range estimate requires seat, deterministic seed and >=64 particles")
    if not isinstance(public_events, (list, tuple)):
        raise ValueError("range estimate requires ordered public events")
    if type(style_weight) not in (int, float) or not math.isfinite(style_weight) or not 0 <= style_weight <= 1:
        raise ValueError("style weight must be finite and inside [0, 1]")
    if opponent_public_history is not None:
        estimate_public_style(opponent_public_history)  # Validate public-only history.
    if style_weight != 0:
        raise ValueError("uncalibrated style mixture is disabled")
    unseen = tuple(card for card in DECK if card not in seen)
    if len(unseen) < 8:
        raise ValueError("insufficient unseen cards")
    rng = random.Random(seed)
    hands = [tuple(rng.sample(unseen, 4)) for _ in range(particles)]
    used_cards = [frozenset(hand) for hand in hands]
    weights = [1.0 / particles] * particles
    used = 0
    for event in public_events:
        if not _event(event, target_seat):
            continue
        used += 1
        modeled_buckets = None
        if action_model is not None and event["type"] == "BET_ACTION":
            from rl.training.badugi_conditional_action_model_draft import conditional_action_probability
            modeled_buckets = tuple(conditional_action_probability(action_model, event, bucket)
                                    for bucket in range(4))
        next_weights = []
        for hand, weight in zip(hands, weights):
            made = evaluate_badugi(hand)[0]
            bucket = _bucket(hand)
            likelihood = (modeled_buckets[bucket] if modeled_buckets is not None else
                          _public_action_likelihood(event, bucket, made))
            next_weights.append(weight * likelihood)
        total = sum(next_weights)
        if total <= 0 or not math.isfinite(total):
            raise ValueError("range weights collapsed")
        weights = [weight / total for weight in next_weights]
        if event["type"] == "DRAW_ACTION":
            advanced = [_after_draw(hand, used, event["drawCount"], unseen, rng)
                        for hand, used in zip(hands, used_cards)]
            hands = [hand for hand, _ in advanced]
            used_cards = [used for _, used in advanced]
        # Deterministic systematic resampling prevents a few particles from
        # carrying the entire range over many streets.
        if 1.0 / sum(weight * weight for weight in weights) < particles / 2:
            step = 1.0 / particles
            pointer = rng.random() * step
            cumulative = weights[0]
            index = 0
            selected = []
            selected_used = []
            for _ in range(particles):
                while pointer > cumulative and index < particles - 1:
                    index += 1
                    cumulative += weights[index]
                selected.append(hands[index])
                selected_used.append(used_cards[index])
                pointer += step
            hands = selected
            used_cards = selected_used
            weights = [step] * particles
    probabilities = [0.0] * 4
    for hand, weight in zip(hands, weights):
        probabilities[_bucket(hand)] += weight
    counts = remaining_rank_counts(seen)
    return RangeEstimate(tuple(probabilities), counts[0], counts[3], used, particles,
                         style_weight_applied=0.0)


def guarded_range_action(*, base_action, legal_mask, hero_made, hero_high,
                         to_call_bb, estimate):
    """Research-only action variant; uncertain or uncalibrated ranges fall back.

    A trained/calibrated likelihood and independent EV gate are required before
    enabling any override. This currently exposes the fallback contract only.
    """
    if len(legal_mask) != 6 or not 0 <= base_action < 6 or legal_mask[base_action] != 1:
        raise ValueError("base action must be legal")
    if not isinstance(estimate, RangeEstimate) or not estimate.calibrated:
        return base_action
    if estimate.public_events_used < 2:
        return base_action
    if hero_made == 4 and hero_high <= 8 and estimate.probabilities[3] < 0.12 and legal_mask[4]:
        return 4
    if hero_made <= 2 and to_call_bb >= 1 and estimate.probabilities[3] > 0.55 and legal_mask[0]:
        return 0
    return base_action
