"""Shared Badugi draw policy helpers."""

from __future__ import annotations

from rl.env.badugi_env import evaluate_badugi


def best_badugi_keep(hand: list) -> list:
    """Return the subset of cards to keep for the best Badugi."""
    best_count, best_ranks = 0, []
    best_keep: list = []
    n = len(hand)
    for mask in range(1 << n):
        subset = [hand[i] for i in range(n) if mask & (1 << i)]
        if not subset:
            continue
        count, ranks = evaluate_badugi(subset)
        if count > best_count or (
            count == best_count and sum(sorted(ranks)) < sum(sorted(best_ranks))
        ):
            best_count, best_ranks, best_keep = count, ranks, subset
    return best_keep


def ideal_draw_count(hand: list) -> int:
    """Return the target draw count for a Badugi hand."""
    keep = best_badugi_keep(hand)
    return max(0, min(3, len(hand) - len(keep)))
