"""Draw lowball starting-hand range and 6-max teacher policy helpers.

Supports 2-7 (low-27) and A-5 (low-a5) for Triple Draw (D01/D02)
and Single Draw (S01/S02). The range logic gives the DQN teacher a sane
opening baseline before sparse terminal rewards take over.

Rank convention: Card = (rank, suit) where rank is 2..14, suit is 0..3.
Ace (rank=14) counts as low (effective rank=1) in low-a5 only.
In 2-7, straights and flushes count against you; in A-5 they do not.
"""

from __future__ import annotations

import bisect
import random
from dataclasses import dataclass
from typing import Sequence

from rl.env.draw_lowball_env import (
    Card,
    DrawFamily,
    LowballFeatures,
    _draw_adjusted_strength,
    discard_indexes_for_family,
    evaluate_lowball,
)


# ---------------------------------------------------------------------------
# Position constants (6-max)
# ---------------------------------------------------------------------------

POSITION_NAMES_BY_BUTTON_OFFSET: tuple[str, ...] = (
    "BTN", "SB", "BB", "UTG", "MP", "CO"
)
POSITION_ORDER: tuple[str, ...] = ("BTN", "CO", "MP", "UTG", "SB", "BB")


# ---------------------------------------------------------------------------
# Hand class ordering (strongest → weakest)
# ---------------------------------------------------------------------------

HAND_CLASS_ORDER: tuple[str, ...] = (
    "made_low_premium",
    "made_low_strong",
    "made_low_weak",
    "made_low_rough",
    "strong_draw",
    "moderate_draw",
    "weak_draw",
    "trash",
)

# Effective highest-rank ceilings for each made-low tier, indexed by family.
# Ranks are in "effective" space: ace=1 for A-5, raw rank for 2-7.
_PREMIUM_MADE_MAX_HIGH: dict[str, int] = {"low-27": 7, "low-a5": 5}
_STRONG_MADE_MAX_HIGH: dict[str, int]  = {"low-27": 8, "low-a5": 6}
_WEAK_MADE_MAX_HIGH: dict[str, int]    = {"low-27": 9, "low-a5": 8}

_STRONG_DRAW_THRESHOLD: float   = 0.60
_MODERATE_DRAW_THRESHOLD: float = 0.42
_WEAK_DRAW_THRESHOLD: float     = 0.26


# ---------------------------------------------------------------------------
# Position-specific thresholds (draw_adjusted_strength, Triple Draw baseline)
# ---------------------------------------------------------------------------

# First-in open thresholds, pre-draw (draw_round == 0).
# None for BB: BB checks in limped pots; uses CALL threshold when facing raises.
POSITION_OPEN_THRESHOLDS: dict[str, float | None] = {
    "UTG": 0.65,
    "MP":  0.58,
    "CO":  0.50,
    "BTN": 0.44,
    "SB":  0.48,
    "BB":  None,
}

# Facing a single open raise pre-draw; call-or-fold thresholds.
POSITION_CALL_THRESHOLDS: dict[str, float] = {
    "UTG": 0.60,
    "MP":  0.55,
    "CO":  0.47,
    "BTN": 0.43,
    "SB":  0.47,
    "BB":  0.40,
}

# ---------------------------------------------------------------------------
# 6-max CDF tables for strength normalization (100k samples, 51 points at 2%)
# ---------------------------------------------------------------------------
# _CDF_VALS_*[i] = raw draw_adjusted_strength at the (i*2)th percentile.
# Used by sixmax_normalize_strength() to convert raw strength → percentile rank.

_CDF_PERCENTILE_STEP: float = 2.0

_CDF_VALS_LOW_27: tuple[float, ...] = (
    0.0, 0.145238, 0.196984, 0.216389, 0.245099, 0.274782, 0.31625, 0.411627,
    0.41752, 0.449167, 0.457024, 0.486706, 0.501389, 0.521389, 0.524246,
    0.528175, 0.531389, 0.533889, 0.538889, 0.546389, 0.55, 0.55, 0.561667,
    0.576667, 0.581667, 0.586667, 0.601944, 0.616944, 0.624008, 0.629444,
    0.631944, 0.637821, 0.645258, 0.651329, 0.654365, 0.660437, 0.666508,
    0.674722, 0.679722, 0.690556, 0.7, 0.7, 0.70631, 0.715417, 0.72756,
    0.749147, 0.769841, 0.780556, 0.810198, 0.84881, 0.952857,
)

_CDF_VALS_LOW_A5: tuple[float, ...] = (
    0.0, 0.351111, 0.4, 0.4, 0.449167, 0.45506, 0.484742, 0.488671,
    0.494563, 0.52621, 0.530139, 0.55, 0.55, 0.55, 0.55, 0.561667,
    0.576667, 0.581667, 0.584167, 0.589167, 0.594167, 0.606944, 0.626944,
    0.631944, 0.634444, 0.641944, 0.666845, 0.677222, 0.679722, 0.68506,
    0.694167, 0.7, 0.7, 0.7, 0.7, 0.70631, 0.712381, 0.718452,
    0.724524, 0.733631, 0.746111, 0.75881, 0.773433, 0.78254, 0.802063,
    0.819306, 0.83752, 0.85, 0.85, 0.866667, 1.0,
)


def sixmax_normalize_strength(s: float, family: str) -> float:
    """Convert raw draw_adjusted_strength to a 6-max percentile rank (0–1).

    0.0 = weakest possible hand, 1.0 = strongest.
    Interpretation: 0.85 means top 15% of random 5-card deals for this family.
    Uses a precomputed CDF from 100k uniform random hand samples.
    """
    table = _CDF_VALS_LOW_27 if family == "low-27" else _CDF_VALS_LOW_A5
    n = len(table) - 1  # 50 intervals
    idx = bisect.bisect_right(table, float(s)) - 1
    idx = max(0, min(n - 1, idx))
    lo, hi = table[idx], table[idx + 1]
    frac = (float(s) - lo) / (hi - lo) if hi > lo else 0.0
    return min(1.0, (idx + max(0.0, min(1.0, frac))) / n)


# ---------------------------------------------------------------------------
# 6-max normalized-strength thresholds for sixmax_draw_teacher_action
# ---------------------------------------------------------------------------
# Keys: (family, is_single_draw)
# Values: position → min normalized strength to open (first-in bet/raise).
# VPIP targets: 2-7 TD ~40%, 2-7 SD ~28%, A-5 TD ~46%, A-5 SD ~33%
# "BB": None — BB checks free; bets only with premium (see _SIXMAX_BB_BET_THRESHOLDS).
# Policy: raise or fold — never limp (see sixmax_draw_teacher_action).

_SIXMAX_OPEN_THRESHOLDS: dict[tuple[str, bool], dict[str, float | None]] = {
    ("low-27", False): {"UTG": 0.85, "MP": 0.78, "CO": 0.70, "BTN": 0.60, "SB": 0.64, "BB": None},
    ("low-27", True):  {"UTG": 0.89, "MP": 0.84, "CO": 0.76, "BTN": 0.67, "SB": 0.72, "BB": None},
    ("low-a5", False): {"UTG": 0.80, "MP": 0.73, "CO": 0.64, "BTN": 0.53, "SB": 0.60, "BB": None},
    ("low-a5", True):  {"UTG": 0.85, "MP": 0.79, "CO": 0.71, "BTN": 0.61, "SB": 0.67, "BB": None},
}

_SIXMAX_CALL_THRESHOLDS: dict[tuple[str, bool], dict[str, float]] = {
    ("low-27", False): {"UTG": 0.81, "MP": 0.74, "CO": 0.66, "BTN": 0.56, "SB": 0.60, "BB": 0.49},
    ("low-27", True):  {"UTG": 0.85, "MP": 0.80, "CO": 0.72, "BTN": 0.63, "SB": 0.68, "BB": 0.57},
    ("low-a5", False): {"UTG": 0.76, "MP": 0.69, "CO": 0.60, "BTN": 0.49, "SB": 0.56, "BB": 0.45},
    ("low-a5", True):  {"UTG": 0.81, "MP": 0.75, "CO": 0.67, "BTN": 0.57, "SB": 0.63, "BB": 0.52},
}

# BB bet threshold in a limped pot (normalized strength, by game type)
_SIXMAX_BB_BET_THRESHOLDS: dict[tuple[str, bool], float] = {
    ("low-27", False): 0.50,
    ("low-27", True):  0.60,
    ("low-a5", False): 0.45,
    ("low-a5", True):  0.55,
}

# Limp window: how many normalized percentile points below the raise threshold
# a hand can limp (call the blind) rather than raising.
# Designed so early positions almost never limp; BTN/SB have small limp ranges.
_SIXMAX_LIMP_WINDOW: dict[str, float] = {
    "UTG": 0.02,  # < 5% limp rate (EP: almost never limp)
    "MP":  0.04,  # < 5%
    "CO":  0.06,  # ~6%
    "BTN": 0.08,  # ~8%
    "SB":  0.20,  # SB completing is accepted; wider range
}

# Raise margin above call threshold (normalized units; ~10 percentile points)
_SIXMAX_RAISE_MARGIN: float = 0.10

# Final-street tightening (normalized units)
_SIXMAX_FINAL_OPEN_ADJ: float = 0.05
_SIXMAX_FINAL_CALL_ADJ: float = 0.12

# Raise-pressure tightening when facing 2+ raises (3-bet territory)
_SIXMAX_RAISE_PRESSURE_ADJ: float = 0.06

# Mid-round tightening (draw_round 0/1/2, applied on non-final streets only)
# Gives progressively tighter play as more information is revealed each round.
_SIXMAX_ROUND_OPEN_ADJ: tuple[float, ...] = (0.0, 0.020, 0.040)
_SIXMAX_ROUND_CALL_ADJ: tuple[float, ...] = (0.0, 0.030, 0.070)

# Opponent min-draw penalty on call threshold (post-draw streets only).
# When opponents draw few cards their range is strong; tighten accordingly.
_OPP_DRAW_CALL_PENALTY: dict[int, float] = {0: 0.07, 1: 0.04, 2: 0.01}

# Pot-odds adjustment for call threshold.
# threshold += (pot_odds - baseline) * scale
# → cheaper calls (low pot_odds) loosen threshold; expensive calls tighten it.
_POT_ODDS_BASELINE: float = 0.25
_POT_ODDS_CALL_SCALE: float = 0.12

# Trap-check: on the final street with a premium hand, occasionally check
# instead of betting to induce a bluff and then raise.
_SIXMAX_TRAP_CHECK_THRESHOLD: float = 0.88  # top ~12% of hands
_SIXMAX_TRAP_CHECK_FREQ: float = 0.20

# Post-draw bluff frequency per position (final street, no bet to call only)
_SIXMAX_BLUFF_FREQ: dict[str, float] = {
    "UTG": 0.04,
    "MP":  0.05,
    "CO":  0.08,
    "BTN": 0.10,
    "SB":  0.07,
    "BB":  0.06,
}


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class LowballStartingHandRange:
    """Classification of a draw-lowball starting hand for range and teacher use."""

    family: str
    hand_class: str
    draw_strength: float
    highest_rank: int
    duplicate_ranks: int
    is_made: bool
    is_premium: bool
    is_playable: bool
    is_trash: bool
    recommended_draw_count: int
    open_from_positions: tuple[str, ...]
    call_from_positions: tuple[str, ...]


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def _compute_open_positions(draw_strength: float, tighten: float = 0.0) -> tuple[str, ...]:
    result: list[str] = []
    for pos, threshold in POSITION_OPEN_THRESHOLDS.items():
        if threshold is None:
            continue
        if draw_strength >= threshold + tighten:
            result.append(pos)
    return tuple(result)


def _compute_call_positions(draw_strength: float, tighten: float = 0.0) -> tuple[str, ...]:
    return tuple(
        pos for pos, threshold in POSITION_CALL_THRESHOLDS.items()
        if draw_strength >= threshold + tighten
    )


def classify_lowball_starting_hand(
    hand: Sequence[Card],
    family: DrawFamily,
) -> LowballStartingHandRange:
    """Classify a draw-lowball starting hand into a range category.

    ``is_made`` is True when the hand should pat (draw 0 cards) according to
    ``discard_indexes_for_family``.  Draw-strength tiers use
    ``_draw_adjusted_strength`` which already accounts for must-discard ranks
    and flush-breaking in 2-7.

    ``open_from_positions`` and ``call_from_positions`` use Triple Draw
    thresholds.  For Single Draw, apply ``SINGLE_DRAW_TIGHTEN`` offset or use
    ``sixmax_draw_teacher_action`` which handles the adjustment internally.
    """
    features: LowballFeatures = evaluate_lowball(hand, family)
    draw_strength: float = _draw_adjusted_strength(hand, family, features)
    discard_count: int = len(discard_indexes_for_family(hand, family))
    is_made: bool = discard_count == 0

    if is_made:
        high: int = int(features.highest_rank)
        if high <= _PREMIUM_MADE_MAX_HIGH[family]:
            hand_class = "made_low_premium"
        elif high <= _STRONG_MADE_MAX_HIGH[family]:
            hand_class = "made_low_strong"
        elif high <= _WEAK_MADE_MAX_HIGH[family]:
            hand_class = "made_low_weak"
        else:
            hand_class = "made_low_rough"
    elif draw_strength >= _STRONG_DRAW_THRESHOLD:
        hand_class = "strong_draw"
    elif draw_strength >= _MODERATE_DRAW_THRESHOLD:
        hand_class = "moderate_draw"
    elif draw_strength >= _WEAK_DRAW_THRESHOLD:
        hand_class = "weak_draw"
    else:
        hand_class = "trash"

    is_premium = hand_class in ("made_low_premium", "made_low_strong")
    is_trash = hand_class == "trash"
    is_playable = not is_trash

    return LowballStartingHandRange(
        family=family,
        hand_class=hand_class,
        draw_strength=round(float(draw_strength), 4),
        highest_rank=int(features.highest_rank),
        duplicate_ranks=int(features.duplicate_ranks),
        is_made=is_made,
        is_premium=is_premium,
        is_playable=is_playable,
        is_trash=is_trash,
        recommended_draw_count=discard_count,
        open_from_positions=_compute_open_positions(draw_strength),
        call_from_positions=_compute_call_positions(draw_strength),
    )


# ---------------------------------------------------------------------------
# 6-max teacher action for SixMaxDrawLowballEnv
# ---------------------------------------------------------------------------

def sixmax_draw_teacher_action(
    env,
    *,
    position: str,
    max_draws: int | None = None,
) -> int:
    """Return a legal action for SixMaxDrawLowballEnv using 6-max calibrated thresholds.

    env must expose: phase, draw_round, max_draws, current_bet, raise_count,
    players[hero_seat], family, hero_seat, and legal_action_mask().

    ``max_draws`` overrides env.max_draws (useful in tests that inject state).

    Strength is normalized to a percentile rank via sixmax_normalize_strength()
    before comparing against _SIXMAX_OPEN/CALL_THRESHOLDS, which are expressed
    as "must be in top X% of hands" (e.g. 0.88 = top 12%).
    """
    from rl.env.draw_lowball_env_sixmax_selfplay import (
        BB_AMOUNT, BET, CALL, CHECK, DRAW_0, FOLD, RAISE,
    )

    hero_seat: int = int(env.hero_seat)
    player: dict = env.players[hero_seat]
    hand: list = player["hand"]
    family: DrawFamily = env.family
    effective_max_draws: int = int(max_draws if max_draws is not None else env.max_draws)
    is_single_draw: bool = effective_max_draws == 1

    mask = env.legal_action_mask()

    # DRAW phase: always draw the optimal number of cards
    if env.phase == "DRAW":
        draw_count = len(discard_indexes_for_family(hand, family))
        return DRAW_0 + max(0, min(5, draw_count))

    # BET phase: normalize raw strength to 6-max percentile rank
    features: LowballFeatures = evaluate_lowball(hand, family)
    raw_strength: float = _draw_adjusted_strength(hand, family, features)
    norm_strength: float = sixmax_normalize_strength(raw_strength, family)

    to_call: int = max(0, int(env.current_bet) - int(player["bet"]))
    draw_round: int = int(env.draw_round)
    is_final: bool = draw_round >= effective_max_draws

    key = (family, is_single_draw)
    open_thresholds = _SIXMAX_OPEN_THRESHOLDS[key]
    call_thresholds = _SIXMAX_CALL_THRESHOLDS[key]

    # Round-aware threshold adjustments: tighten progressively each street.
    draw_round_idx: int = min(2, draw_round)
    if is_final:
        round_open_adj: float = _SIXMAX_FINAL_OPEN_ADJ
        round_call_adj: float = _SIXMAX_FINAL_CALL_ADJ
    else:
        round_open_adj = _SIXMAX_ROUND_OPEN_ADJ[draw_round_idx]
        round_call_adj = _SIXMAX_ROUND_CALL_ADJ[draw_round_idx]

    raise_pressure_adj: float = _SIXMAX_RAISE_PRESSURE_ADJ if int(env.raise_count) >= 2 else 0.0

    # Opponent min-draw penalty: when opponents drew few cards, their range is
    # stronger — tighten our call threshold accordingly (post-draw only).
    opp_call_penalty: float = 0.0
    if draw_round > 0:
        active_opps = [
            s for s in range(len(env.players))
            if s != hero_seat and not env.players[s]["folded"]
        ]
        if active_opps:
            opp_min_draw = min(env.players[opp]["last_draw"] for opp in active_opps)
            opp_call_penalty = _OPP_DRAW_CALL_PENALTY.get(min(opp_min_draw, 2), 0.0)

    def first_legal(*actions: int) -> int | None:
        for a in actions:
            if 0 <= a < len(mask) and mask[a] > 0:
                return a
        return None

    if to_call > 0:
        # Pre-draw with only blind money posted = limp spot.
        # to_call <= BB_AMOUNT means no one has voluntarily raised above the BB.
        is_limp_spot = draw_round == 0 and to_call <= int(BB_AMOUNT)
        if is_limp_spot:
            open_threshold = open_thresholds.get(position)
            if open_threshold is not None:
                threshold = open_threshold + round_open_adj
                if norm_strength >= threshold:
                    action = first_legal(RAISE, BET)
                    if action is not None:
                        return action
                else:
                    limp_threshold = threshold - _SIXMAX_LIMP_WINDOW.get(position, 0.0)
                    if norm_strength >= limp_threshold:
                        action = first_legal(CALL)
                        if action is not None:
                            return action
            return first_legal(FOLD) or FOLD

        # Facing a genuine bet or raise: call / raise / fold.
        # Pot-odds adjustment: cheap calls (low pot_odds) lower the bar slightly;
        # expensive calls raise it. Keeps position spread intact — only fine-tunes
        # the threshold within each positional tier.
        pot_odds: float = to_call / max(1, int(env.pot) + to_call)
        pot_odds_adj: float = (pot_odds - _POT_ODDS_BASELINE) * _POT_ODDS_CALL_SCALE

        call_threshold = (
            call_thresholds.get(position, 0.70)
            + round_call_adj + raise_pressure_adj + opp_call_penalty + pot_odds_adj
        )
        if norm_strength >= call_threshold:
            raise_threshold = min(1.0, call_threshold + _SIXMAX_RAISE_MARGIN)
            if norm_strength >= raise_threshold:
                action = first_legal(RAISE, CALL)
            else:
                action = first_legal(CALL, RAISE)
            if action is not None:
                return action
        return first_legal(FOLD, CALL) or FOLD

    # No bet to call: open or check.
    # Trap-check: with a premium hand on the final street, occasionally check
    # to induce a bluff, then raise when opponent bets.
    if is_final and norm_strength >= _SIXMAX_TRAP_CHECK_THRESHOLD:
        if random.random() < _SIXMAX_TRAP_CHECK_FREQ:
            action = first_legal(CHECK)
            if action is not None:
                return action

    open_threshold = open_thresholds.get(position)
    if open_threshold is None:
        # BB: check by default, bet with strong hands in limped pot
        bb_bet_thr = _SIXMAX_BB_BET_THRESHOLDS[key] + round_open_adj
        if norm_strength >= bb_bet_thr:
            action = first_legal(BET, RAISE)
            if action is not None:
                return action
    else:
        threshold = open_threshold + round_open_adj
        if norm_strength >= threshold:
            action = first_legal(BET, RAISE)
            if action is not None:
                return action

    # Post-draw bluff: only when the story is consistent with a made hand.
    # discard_count==1 → "missed 1-card draw, representing a hit" → credible.
    # discard_count==2 → weaker story, bluff at 35% frequency.
    # discard_count>=3 → no believable story; never bluff (drew 3+ cards = obvious air).
    if is_final and to_call == 0:
        discard_count = len(discard_indexes_for_family(hand, family))
        if discard_count == 1:
            bluff_freq = _SIXMAX_BLUFF_FREQ.get(position, 0.0)
        elif discard_count == 2:
            bluff_freq = _SIXMAX_BLUFF_FREQ.get(position, 0.0) * 0.35
        else:
            bluff_freq = 0.0
        if bluff_freq > 0 and random.random() < bluff_freq:
            action = first_legal(BET, RAISE)
            if action is not None:
                return action

    return first_legal(CHECK, FOLD) or FOLD


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def position_name(hero_seat: int, dealer_seat: int, num_players: int = 6) -> str:
    """Return position name for hero relative to the dealer/button."""
    offset = (int(hero_seat) - int(dealer_seat)) % num_players
    return POSITION_NAMES_BY_BUTTON_OFFSET[offset]
