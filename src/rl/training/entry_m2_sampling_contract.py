"""M2-only stratified entry-opportunity design and collector input audit.

This module never runs a game, estimates action EV, or changes a model.  A
future collector may use rejection sampling of *unaltered* real-controller
deals; its full seed schedule must be sealed and history-audited separately.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import gzip
import json
from pathlib import Path

DECK_MODULUS = 2**32
TOTAL_INITIAL_HANDS = 270725
STRATA = ("A6T_boundary", "A2_A6_two_card", "T_K_four_card", "other")
GROUPS = tuple((seats, occupied, mode) for mode in ("cash", "mtt")
               for seats, occupied in ((2, 2), (3, 3), (6, 2), (6, 3), (6, 6)))
PROFILES = ("tight_value", "balanced_range", "loose_station",
            "bluff_pressure", "legacy_passive")
RANKS = {name: index for index, name in enumerate(
    ("A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"))}
RANKS["T"] = 9
SUITS = "CDHS"


def parse_cards(cards: list[str]) -> tuple[tuple[int, int], ...]:
    if not isinstance(cards, list) or len(cards) != 4:
        raise ValueError("exactly four actor cards required")
    parsed = []
    for card in cards:
        if not isinstance(card, str) or len(card) < 2:
            raise ValueError("invalid actor card")
        rank, suit = card[:-1].upper(), card[-1].upper()
        if rank not in RANKS or suit not in SUITS:
            raise ValueError("invalid actor card")
        parsed.append((RANKS[rank], SUITS.index(suit)))
    if len(set(parsed)) != 4:
        raise ValueError("duplicate actor card")
    return tuple(parsed)


def best_badugi(cards: tuple[tuple[int, int], ...]) -> tuple[int, tuple[int, ...]]:
    best: tuple[int, tuple[int, ...]] | None = None
    for mask in range(1, 16):
        kept = [cards[index] for index in range(4) if mask & (1 << index)]
        if len({rank for rank, _ in kept}) != len(kept) or len({suit for _, suit in kept}) != len(kept):
            continue
        ranks = tuple(sorted(rank for rank, _ in kept))
        candidate = (len(kept), ranks)
        if best is None or (candidate[0], tuple(-rank for rank in reversed(candidate[1]))) > (
                best[0], tuple(-rank for rank in reversed(best[1]))):
            best = candidate
    if best is None:
        raise ValueError("four-card hand lacks any valid subset")
    return best


def stratum(made: int, ranks: tuple[int, ...] | list[int]) -> str:
    ranks = tuple(ranks)
    if made == 3 and ranks == (0, 5, 9):
        return "A6T_boundary"
    if made == 2 and ranks[0] == 0 and 1 <= ranks[1] <= 5:
        return "A2_A6_two_card"
    if made == 4 and ranks[-1] >= 9:
        return "T_K_four_card"
    return "other"


def catalog_counts(path: Path) -> dict[str, int]:
    counts = Counter()
    with gzip.open(path, "rt") as source:
        for line in source:
            row = json.loads(line)
            counts[stratum(row["made"], row["ranks"])] += 1
    if sum(counts.values()) != TOTAL_INITIAL_HANDS or set(counts) != set(STRATA):
        raise ValueError("incomplete initial-hand catalog")
    return {name: counts[name] for name in STRATA}


@dataclass(frozen=True)
class Design:
    counts: dict[str, int]
    accepted_per_cell_stratum: int

    def summary(self) -> dict:
        if self.accepted_per_cell_stratum < 1:
            raise ValueError("positive allocation required")
        if (set(self.counts) != set(STRATA) or
                any(type(value) is not int or value <= 0 for value in self.counts.values()) or
                sum(self.counts.values()) != TOTAL_INITIAL_HANDS):
            raise ValueError("exact full initial-hand catalog counts required")
        env_cells = len(GROUPS) * len(PROFILES)
        accepted_each = env_cells * self.accepted_per_cell_stratum
        total_accepted = accepted_each * len(STRATA)
        return {
            "scope": "OPPORTUNITY_AND_SAFETY_ONLY_NOT_EV",
            "environmentCells": env_cells,
            "strata": {
                name: {"catalogHands": self.counts[name],
                       "naturalProbability": self.counts[name] / TOTAL_INITIAL_HANDS,
                       "acceptedSessions": accepted_each,
                       "samplingProbability": accepted_each / total_accepted,
                       "naturalOverSamplingWeight":
                           (self.counts[name] / TOTAL_INITIAL_HANDS) /
                           (accepted_each / total_accepted),
                       "expectedRawDealsToFill":
                           accepted_each * TOTAL_INITIAL_HANDS / self.counts[name]}
                for name in STRATA
            },
            "acceptedSessions": total_accepted,
            "selection": "Reject or accept an unmodified controller deal by the designated hero's opening four cards; never inject a hand or inspect opponent private cards for actor policy",
            "samplingLimit": "Expected screened deals are planning values, not a stopping rule; seal a finite max before collection and report shortages",
            "naturalReturn": "Use p_s/q_s for descriptive natural opportunity rates only after full accepted-count and selection audits; M3 local EV and M4 natural 20-hand policy comparisons use new seeds and ordinary deals",
        }


def check_seed_schedule(seeds: list[int], prior_deck_residues: set[int]) -> None:
    if not seeds or any(type(seed) is not int or seed < 0 for seed in seeds):
        raise ValueError("nonempty nonnegative integer seed schedule required")
    residues = [seed % DECK_MODULUS for seed in seeds]
    if len(set(residues)) != len(residues):
        raise ValueError("planned deck seeds repeat modulo 2^32")
    if set(residues) & prior_deck_residues:
        raise ValueError("planned deck seed collides with recorded prior deck")


def audit_selected_opportunity(row: dict, intended_stratum: str) -> dict:
    """Audit one accepted collector row; the real controller ledger remains separate."""
    if intended_stratum not in STRATA or row.get("chipLedgerPass") is not True:
        raise ValueError("invalid stratum or missing collection-time ledger pass")
    target = row.get("target")
    if not isinstance(target, dict):
        raise ValueError("accepted row has no legal FOLD/CALL opportunity")
    cards = parse_cards(target.get("actorCurrentCards"))
    made, ranks = best_badugi(cards)
    if stratum(made, ranks) != intended_stratum:
        raise ValueError("selected hand does not match frozen stratum")
    if target.get("madeCards") != made or target.get("highRankZeroBased") != ranks[-1]:
        raise ValueError("actor-visible hand summary mismatch")
    mask = target.get("legalMask")
    amounts = target.get("legalAmountsChips")
    if (not isinstance(mask, list) or len(mask) != 6 or
            not isinstance(amounts, list) or len(amounts) != 6 or
            any(value not in (0, 1) for value in mask) or
            mask[0] != 1 or mask[2] != 1 or mask[4] != 1 or
            any(type(amounts[index]) not in (int, float) or amounts[index] < 0
                for index in (0, 2, 4)) or
            amounts[0] != 0 or amounts[2] <= 0 or amounts[4] <= amounts[2]):
        raise ValueError("FOLD/CALL/RAISE legality or amount mismatch")
    if target.get("naturalAction") not in (0, 2, 4):
        raise ValueError("natural model action is not legal among F/C/R")
    if (type(target.get("toCallBigBets")) not in (int, float) or
            target["toCallBigBets"] <= 0 or
            type(target.get("openingPosition")) is not int or
            target["openingPosition"] < 0 or
            not isinstance(target.get("publicActions"), list)):
        raise ValueError("missing actor-visible price, position, or public action history")
    return {"stratum": intended_stratum, "made": made, "ranks": ranks,
            "toCallBigBets": target["toCallBigBets"],
            "openingPosition": target["openingPosition"]}


def audit_selected_deal(row: dict, intended_stratum: str) -> dict:
    """Keep no-opportunity deals in the denominator of a selected hand class.

    A future bridge must disclose the designated hero's *own* opening cards in
    an audit-only field before screening. The pilot bridge lacks this field,
    so its no-opportunity rows cannot be retroactively strata-verified.
    """
    if row.get("chipLedgerPass") is not True:
        raise ValueError("missing full-hand chip ledger pass")
    opening = row.get("openingActorCards")
    made, ranks = best_badugi(parse_cards(opening))
    if stratum(made, ranks) != intended_stratum:
        raise ValueError("opening hand differs from frozen selection stratum")
    target = row.get("target")
    if target is None:
        return {"stratum": intended_stratum, "legalThreeActionOpportunity": False}
    if target.get("actorCurrentCards") != opening:
        raise ValueError("predraw opportunity hand differs from screened opening hand")
    audited = audit_selected_opportunity(row, intended_stratum)
    return {**audited, "legalThreeActionOpportunity": True}
