"""Badugi starting-hand range and teacher policy helpers.

The range logic is intentionally explicit: it gives the DQN a sane opening
baseline before sparse terminal rewards take over. Ranks use the training env
encoding: 0 = Ace, 12 = King.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations
from typing import Iterable, Sequence

from rl.env.badugi_env import Card, build_deck, compare_badugi_scores, evaluate_badugi


@dataclass(frozen=True)
class StartingHandRange:
    made_cards: int
    ranks: tuple[int, ...]
    high_rank: int
    rank_sum: int
    draw_count: int
    made_score_percentile: float
    one_draw_top_half_probability: float
    is_a27_or_better: bool
    is_premium: bool
    should_continue_heads_up: bool
    recommended_draw_count: int


def _score_key(score: tuple[int, list[int]] | tuple[int, tuple[int, ...]]) -> tuple[int, int, int, int, int]:
    count, ranks_raw = score
    ranks = tuple(ranks_raw)
    padded = ranks + (13,) * (4 - len(ranks))
    # Higher tuple is better: more made cards, then lower high card, etc.
    return (count, *(13 - rank for rank in padded))


def _hand_key(hand: Sequence[Card]) -> tuple[Card, ...]:
    return tuple(sorted((int(rank), int(suit)) for rank, suit in hand))


@lru_cache(maxsize=1)
def all_starting_score_keys() -> tuple[tuple[int, int, int, int, int], ...]:
    keys = [_score_key(evaluate_badugi(hand)) for hand in combinations(build_deck(), 4)]
    return tuple(sorted(keys))


@lru_cache(maxsize=1)
def median_starting_score_key() -> tuple[int, int, int, int, int]:
    keys = all_starting_score_keys()
    return keys[len(keys) // 2]


def score_percentile(score: tuple[int, Sequence[int]]) -> float:
    keys = all_starting_score_keys()
    key = _score_key((score[0], tuple(score[1])))
    # Manual binary search avoids importing bisect in hot paths and keeps the
    # "at least as strong" interpretation clear.
    lo = 0
    hi = len(keys)
    while lo < hi:
        mid = (lo + hi) // 2
        if keys[mid] <= key:
            lo = mid + 1
        else:
            hi = mid
    return lo / max(1, len(keys))


def best_badugi_keep(hand: Sequence[Card]) -> list[Card]:
    best_subset: tuple[Card, ...] = ()
    best_score: tuple[int, list[int]] = (0, [])
    for subset_size in range(1, min(4, len(hand)) + 1):
        for subset in combinations(hand, subset_size):
            ranks = [rank for rank, _suit in subset]
            suits = [suit for _rank, suit in subset]
            if len(set(ranks)) != len(ranks) or len(set(suits)) != len(suits):
                continue
            score = (len(subset), sorted(ranks))
            if compare_badugi_scores(score, best_score) > 0:
                best_score = score
                best_subset = subset
    return list(best_subset)


def _estimated_multi_draw_top_half_probability(count: int, ranks: Sequence[int]) -> float:
    """Fast range-table estimate for hands drawing two or more cards.

    Exact enumeration is reserved for three-card one-away hands, where the
    decision changes materially. Two-card and one-card keeps are common during
    teacher warmup, and exact C(48, 2/3) expansion per state is too slow for
    training without adding much strategic signal.
    """
    if count <= 1 or not ranks:
        return 0.05
    high_rank = max(ranks)
    rank_sum = sum(ranks)
    if count == 2:
        # Strong two-card lows can improve, but they are not automatic opens
        # in fixed-limit Badugi unless price/position is favorable.
        low_bonus = max(0.0, (8 - high_rank) * 0.045)
        wheel_bonus = 0.08 if 0 in ranks and 1 in ranks else 0.0
        compact_bonus = max(0.0, (10 - rank_sum) * 0.015)
        return min(0.48, 0.16 + low_bonus + wheel_bonus + compact_bonus)
    return 0.0


@lru_cache(maxsize=200_000)
def one_draw_top_half_probability_cached(hand_key: tuple[Card, ...]) -> float:
    hand = list(hand_key)
    keep = best_badugi_keep(hand)
    draw_count = max(0, 4 - len(keep))
    if draw_count <= 0:
        return 1.0 if _score_key(evaluate_badugi(hand)) >= median_starting_score_key() else 0.0
    if draw_count >= 2:
        score = evaluate_badugi(keep)
        return _estimated_multi_draw_top_half_probability(score[0], tuple(score[1]))
    unavailable = set(hand)
    deck = [card for card in build_deck() if card not in unavailable]
    total = 0
    top_half = 0
    median_key = median_starting_score_key()
    for draw_cards in combinations(deck, draw_count):
        total += 1
        next_hand = keep + list(draw_cards)
        if _score_key(evaluate_badugi(next_hand)) >= median_key:
            top_half += 1
    return top_half / max(1, total)


def one_draw_top_half_probability(hand: Sequence[Card]) -> float:
    return one_draw_top_half_probability_cached(_hand_key(hand))


def classify_starting_hand(hand: Sequence[Card]) -> StartingHandRange:
    score = evaluate_badugi(hand)
    count, ranks_raw = score
    ranks = tuple(sorted(ranks_raw))
    high_rank = max(ranks) if ranks else 12
    rank_sum = sum(ranks) if ranks else 99
    draw_count = max(0, 4 - count)
    percentile = score_percentile((count, ranks))
    improvement = one_draw_top_half_probability(hand)
    is_a27_or_better = count >= 3 and high_rank <= 6 and 0 in ranks and 1 in ranks
    is_premium = (
        (count == 4 and high_rank <= 8)
        or is_a27_or_better
        or (count == 3 and improvement >= 0.62 and high_rank <= 8)
    )
    should_continue = (
        is_premium
        or percentile >= 0.5
        or improvement >= 0.5
        or (count == 4 and high_rank <= 11)
    )
    return StartingHandRange(
        made_cards=count,
        ranks=ranks,
        high_rank=high_rank,
        rank_sum=rank_sum,
        draw_count=draw_count,
        made_score_percentile=percentile,
        one_draw_top_half_probability=improvement,
        is_a27_or_better=is_a27_or_better,
        is_premium=is_premium,
        should_continue_heads_up=should_continue,
        recommended_draw_count=min(3, draw_count),
    )


def teacher_action(env) -> int:
    """Return a legal Badugi action index for the current training env state."""
    hand_range = classify_starting_hand(env.player_hand)
    mask = env.legal_action_mask()
    if env.phase == "DRAW":
        action = hand_range.recommended_draw_count
        return action if action < len(mask) and mask[action] > 0 else env.safe_fallback_action()

    to_call = max(0, env.current_bet - env.player_bet)
    can_raise = env.bet_round < env.max_bets and env.player_stack > to_call
    is_final_bet = env.round >= env.max_rounds
    made_badugi = hand_range.made_cards >= 4
    rough_badugi = made_badugi and hand_range.high_rank >= 10
    strong_made = made_badugi and hand_range.high_rank <= 8
    opponent_drew_multiple = getattr(env, "opponent_last_draw", 0) >= 2
    table_size = getattr(env, "table_size", 2)
    position_fraction = env._position_fraction() if hasattr(env, "_position_fraction") else 0.5
    is_sixmax = table_size >= 6
    late_position = position_fraction >= 0.6
    if to_call > 0:
        ev = None
        if hasattr(env, "_bet_ev_diagnostic") and hasattr(env, "_hand_features"):
            ev = env._bet_ev_diagnostic(env._hand_features(env.player_hand), to_call)
        cheap_developing_call = (
            ev is not None
            and not is_final_bet
            and ev.cheap_draw_continue_value >= 0.35
            and ev.pot_odds <= 0.30
            and hand_range.made_cards >= 2
        )
        profitable_continue = (
            ev is not None
            and ev.call_ev > ev.fold_ev + 0.10
            and (hand_range.made_cards >= 3 or cheap_developing_call)
        )
        isolation_raise = (
            is_sixmax
            and can_raise
            and ev is not None
            and (
                strong_made
                or (
                    hand_range.made_cards == 3
                    and hand_range.high_rank <= 6
                    and ev.future_street_value >= 0.45
                )
            )
            and ev.raise_ev >= ev.call_ev + (0.05 if strong_made else 0.12)
        )
        if is_final_bet:
            if not made_badugi and mask[0] > 0:
                return 0
            if rough_badugi and not opponent_drew_multiple and mask[0] > 0:
                return 0
            if strong_made and can_raise and mask[4] > 0:
                return 4
            return 2 if mask[2] > 0 else env.safe_fallback_action()
        if isolation_raise and mask[4] > 0:
            return 4
        if cheap_developing_call and mask[2] > 0:
            return 2
        if profitable_continue and mask[2] > 0:
            return 2
        if not hand_range.should_continue_heads_up and mask[0] > 0:
            return 0
        if hand_range.is_premium and can_raise and mask[4] > 0:
            return 4
        return 2 if mask[2] > 0 else env.safe_fallback_action()

    if is_final_bet:
        if strong_made and can_raise:
            if mask[4] > 0:
                return 4
            if mask[3] > 0:
                return 3
        if made_badugi and (not rough_badugi or opponent_drew_multiple) and mask[3] > 0:
            return 3
        return 1 if mask[1] > 0 else env.safe_fallback_action()

    if is_sixmax and strong_made and can_raise:
        if mask[3] > 0:
            return 3
        if mask[4] > 0:
            return 4
    if (
        is_sixmax
        and late_position
        and hand_range.made_cards == 3
        and hand_range.high_rank <= 8
        and hand_range.one_draw_top_half_probability >= 0.5
        and can_raise
    ):
        if mask[3] > 0:
            return 3
        if mask[4] > 0:
            return 4
    if hand_range.is_premium and can_raise:
        if mask[4] > 0:
            return 4
        if mask[3] > 0:
            return 3
    if hand_range.should_continue_heads_up and can_raise and hand_range.one_draw_top_half_probability >= 0.6:
        if mask[3] > 0:
            return 3
    return 1 if mask[1] > 0 else env.safe_fallback_action()
