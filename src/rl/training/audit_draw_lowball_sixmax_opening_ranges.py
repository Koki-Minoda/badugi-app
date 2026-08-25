"""Audit 6-max Draw Lowball DQN opening ranges and draw decisions.

Supports all four variants:
  S01 — 2-7 Single Draw   (family="low-27", max_draws=1)
  D01 — 2-7 Triple Draw   (family="low-27", max_draws=3)
  S02 — A-5 Single Draw   (family="low-a5", max_draws=1)
  D02 — A-5 Triple Draw   (family="low-a5", max_draws=3)

The script loads a checkpoint, runs SixMaxDrawLowballEnv, records every
BET-phase and DRAW-phase hero decision, then produces a structured JSON
report with summaries, warnings, and representative findings.

It intentionally does not train or mutate checkpoints.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Sequence

import numpy as np
import torch

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.agents.dqn_agent import DQNAgent
from rl.env.draw_lowball_env import (
    DRAW_OBSERVATION_VECTOR_SIZE,
    discard_indexes_for_family,
    evaluate_lowball,
)
from rl.env.draw_lowball_env_sixmax_selfplay import (
    BB_AMOUNT,
    BET,
    CALL,
    CHECK,
    DRAW_0,
    DRAW_5,
    FOLD,
    RAISE,
    SixMaxDrawLowballEnv,
)
from rl.training.draw_lowball_starting_ranges import (
    HAND_CLASS_ORDER,
    POSITION_NAMES_BY_BUTTON_OFFSET,
    LowballStartingHandRange,
    classify_lowball_starting_hand,
    position_name,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VARIANT_CONFIGS: dict[str, tuple[str, int]] = {
    "S01": ("low-27", 1),
    "D01": ("low-27", 3),
    "S02": ("low-a5", 1),
    "D02": ("low-a5", 3),
}

POSITION_ORDER: tuple[str, ...] = ("BTN", "CO", "MP", "UTG", "SB", "BB")
SPOT_ORDER: tuple[str, ...] = ("unopened", "facing_open", "sb_completion", "bb_option")
FACING_ACTION_ORDER: tuple[str, ...] = ("facing_bet", "unopened")

# All possible draw counts (0 = pat, 5 = draw all)
DRAW_COUNT_LABELS: tuple[str, ...] = ("0", "1", "2", "3", "4", "5")

ACTION_NAMES: dict[int, str] = {
    FOLD:   "FOLD",
    CHECK:  "CHECK",
    CALL:   "CALL",
    BET:    "BET",
    RAISE:  "RAISE",
    DRAW_0: "DRAW_0",
    DRAW_0 + 1: "DRAW_1",
    DRAW_0 + 2: "DRAW_2",
    DRAW_0 + 3: "DRAW_3",
    DRAW_0 + 4: "DRAW_4",
    DRAW_5: "DRAW_5",
}

_RANK_LABELS = ("2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A")
_SUIT_LABELS = ("c", "d", "h", "s")

MAX_HAND_STEPS = 120


# ---------------------------------------------------------------------------
# Card / hand helpers
# ---------------------------------------------------------------------------

def card_label(card: tuple[int, int]) -> str:
    rank, suit = int(card[0]), int(card[1])
    return f"{_RANK_LABELS[rank - 2]}{_SUIT_LABELS[suit]}"


def hand_info_dict(hr: LowballStartingHandRange, hand: list) -> dict:
    return {
        "cards": [card_label(c) for c in hand],
        "hand_class": hr.hand_class,
        "draw_strength": hr.draw_strength,
        "highest_rank": hr.highest_rank,
        "duplicate_ranks": hr.duplicate_ranks,
        "is_made": hr.is_made,
        "is_premium": hr.is_premium,
        "is_playable": hr.is_playable,
        "is_trash": hr.is_trash,
        "recommended_draw_count": hr.recommended_draw_count,
    }


# ---------------------------------------------------------------------------
# Action categorization
# ---------------------------------------------------------------------------

def action_bucket(action: int) -> str:
    if action == FOLD:
        return "fold"
    if action in (CHECK, CALL):
        return "call_check"
    if action in (BET, RAISE):
        return "raise_bet"
    return "other"


def is_vpip_action(action: int) -> bool:
    return action in (CALL, BET, RAISE)


def is_pfr_action(action: int) -> bool:
    return action in (BET, RAISE)


def bet_round_key(draw_round: int) -> str:
    return f"round{max(0, int(draw_round))}"


def facing_action_type(*, to_call: int) -> str:
    return "facing_bet" if int(to_call) > 0 else "unopened"


def spot_type(*, position: str, current_bet: int, to_call: int) -> str:
    if current_bet > BB_AMOUNT or to_call > BB_AMOUNT:
        return "facing_open"
    if position == "SB" and current_bet == BB_AMOUNT and 0 < to_call <= 1:
        return "sb_completion"
    if position == "BB" and current_bet == BB_AMOUNT and to_call == 0:
        return "bb_option"
    return "unopened"


# ---------------------------------------------------------------------------
# Q-value utils
# ---------------------------------------------------------------------------

def legal_argmax(q_values: Sequence[float], action_mask: Sequence[float]) -> int:
    q = np.asarray(q_values, dtype=np.float32).reshape(-1).copy()
    mask = np.asarray(action_mask, dtype=np.float32).reshape(-1)
    q[mask <= 0] = -1e9
    return int(np.argmax(q))


# ---------------------------------------------------------------------------
# Record builders
# ---------------------------------------------------------------------------

def make_bet_decision_record(
    *,
    env: SixMaxDrawLowballEnv,
    q_values: np.ndarray,
    action_mask: np.ndarray,
    action: int,
    sample_index: int,
    bet_decision_index: int,
) -> dict:
    hero_seat = int(env.hero_seat)
    hand = list(env.players[hero_seat]["hand"])
    hr = classify_lowball_starting_hand(hand, env.family)

    to_call = max(0, int(env.current_bet) - int(env.players[hero_seat]["bet"]))
    pos = position_name(hero_seat, env.dealer_seat)
    q_list = [float(v) for v in np.asarray(q_values, dtype=np.float32).reshape(-1)]
    legal_q = [q_list[i] for i, m in enumerate(action_mask) if m > 0 and i < len(q_list)]
    best_legal_q = max(legal_q) if legal_q else None
    selected_q = q_list[action] if 0 <= action < len(q_list) else None

    bet_actions = {FOLD, CHECK, CALL, BET, RAISE}
    legal_actions = [
        {"index": int(i), "name": ACTION_NAMES.get(i, str(i))}
        for i, m in enumerate(action_mask)
        if m > 0 and i in bet_actions
    ]
    q_named = {ACTION_NAMES.get(i, str(i)): q_list[i] for i in range(min(len(q_list), 5))}

    return {
        "sampleIndex": int(sample_index),
        "betDecisionIndex": int(bet_decision_index),
        "position": pos,
        "spotType": spot_type(
            position=pos,
            current_bet=int(env.current_bet),
            to_call=int(to_call),
        ),
        "betRound": bet_round_key(int(env.draw_round)),
        "facingAction": facing_action_type(to_call=int(to_call)),
        "handClass": hr.hand_class,
        "heroSeat": hero_seat,
        "dealerSeat": int(env.dealer_seat),
        "drawRound": int(env.draw_round),
        "phase": str(env.phase),
        "pot": int(env.pot),
        "currentBet": int(env.current_bet),
        "heroBet": int(env.players[hero_seat]["bet"]),
        "toCall": int(to_call),
        "legalActions": legal_actions,
        "selectedAction": int(action),
        "selectedActionName": ACTION_NAMES.get(int(action), str(action)),
        "selectedActionBucket": action_bucket(action),
        "qValues": q_named,
        "selectedQ": selected_q,
        "bestLegalQ": best_legal_q,
        "legalQMargin": float(selected_q - best_legal_q)
            if selected_q is not None and best_legal_q is not None else None,
        "hand": hand_info_dict(hr, hand),
        "vpip": is_vpip_action(action),
        "pfr": is_pfr_action(action),
    }


def make_draw_decision_record(
    *,
    env: SixMaxDrawLowballEnv,
    q_values: np.ndarray,
    action_mask: np.ndarray,
    action: int,
    sample_index: int,
) -> dict:
    hero_seat = int(env.hero_seat)
    hand = list(env.players[hero_seat]["hand"])
    hr = classify_lowball_starting_hand(hand, env.family)

    draw_count = max(0, min(5, int(action) - DRAW_0))
    ideal_count = int(hr.recommended_draw_count)
    q_list = [float(v) for v in np.asarray(q_values, dtype=np.float32).reshape(-1)]
    q_draw = {f"DRAW_{i}": q_list[DRAW_0 + i] for i in range(6) if DRAW_0 + i < len(q_list)}
    selected_q = q_list[action] if 0 <= action < len(q_list) else None

    return {
        "sampleIndex": int(sample_index),
        "position": position_name(hero_seat, env.dealer_seat),
        "betRound": bet_round_key(int(env.draw_round)),
        "drawRound": int(env.draw_round),
        "handClass": hr.hand_class,
        "hand": hand_info_dict(hr, hand),
        "selectedAction": int(action),
        "drawCount": draw_count,
        "idealDrawCount": ideal_count,
        "drawAccurate": draw_count == ideal_count,
        "qValues": q_draw,
        "selectedQ": selected_q,
    }


# ---------------------------------------------------------------------------
# Bucket helpers
# ---------------------------------------------------------------------------

def _empty_bet_counts() -> Counter:
    return Counter({"fold": 0, "call_check": 0, "raise_bet": 0})


def _pct(numerator: int | float, denominator: int | float) -> float:
    return round(float(numerator) / float(denominator) * 100.0, 4) if denominator else 0.0


def _summarize_bet_bucket(records: list[dict]) -> dict:
    counts = _empty_bet_counts()
    check = 0
    vpip = 0
    pfr = 0
    q_fold: list[float] = []
    q_call: list[float] = []
    q_raise: list[float] = []
    for rec in records:
        a = int(rec["selectedAction"])
        counts[action_bucket(a)] += 1
        check += int(a == CHECK)
        vpip += int(is_vpip_action(a))
        pfr += int(is_pfr_action(a))
        q = rec["qValues"]
        if "FOLD" in q:
            q_fold.append(float(q["FOLD"]))
        if "CALL" in q:
            q_call.append(float(q["CALL"]))
        if "RAISE" in q:
            q_raise.append(float(q["RAISE"]))
    n = len(records)
    return {
        "samples": n,
        "foldPct": _pct(counts["fold"], n),
        "checkPct": _pct(check, n),
        "callCheckPct": _pct(counts["call_check"], n),
        "raiseBetPct": _pct(counts["raise_bet"], n),
        "vpipPct": _pct(vpip, n),
        "pfrPct": _pct(pfr, n),
        "actionCounts": dict(counts),
        "avgQFold":  round(float(np.mean(q_fold)),  6) if q_fold  else None,
        "avgQCall":  round(float(np.mean(q_call)),  6) if q_call  else None,
        "avgQRaise": round(float(np.mean(q_raise)), 6) if q_raise else None,
    }


def _summarize_draw_bucket(records: list[dict]) -> dict:
    if not records:
        return {"samples": 0}
    n = len(records)
    counts = Counter(int(r["drawCount"]) for r in records)
    ideal_counts = Counter(int(r["idealDrawCount"]) for r in records)
    accurate = sum(1 for r in records if r["drawAccurate"])
    pats = counts.get(0, 0)
    return {
        "samples": n,
        "drawCounts": {str(k): v for k, v in sorted(counts.items())},
        "idealDrawCounts": {str(k): v for k, v in sorted(ideal_counts.items())},
        "accuracyRate": _pct(accurate, n),
        "patRate": _pct(pats, n),
        "avgDrawCount": round(
            sum(int(r["drawCount"]) for r in records) / n, 4
        ),
    }


# ---------------------------------------------------------------------------
# Summarize opening decisions (draw_round == 0 BET decisions)
# ---------------------------------------------------------------------------

def summarize_opening_decisions(records: list[dict]) -> dict:
    by_pos: dict[str, list[dict]] = {p: [] for p in POSITION_ORDER}
    by_spot: dict[str, list[dict]] = {s: [] for s in SPOT_ORDER}
    by_pos_spot: dict[str, list[dict]] = {
        f"{p}.{s}": [] for p in POSITION_ORDER for s in SPOT_ORDER
    }
    by_hc: dict[str, list[dict]] = {h: [] for h in HAND_CLASS_ORDER}
    by_hc_spot: dict[str, list[dict]] = {
        f"{h}.{s}": [] for h in HAND_CLASS_ORDER for s in SPOT_ORDER
    }
    by_pos_spot_hc: dict[str, list[dict]] = {
        f"{p}.{s}.{h}": [] for p in POSITION_ORDER for s in SPOT_ORDER for h in HAND_CLASS_ORDER
    }

    for rec in records:
        pos = rec["position"]
        spot = rec.get("spotType", "unopened")
        hc = rec["handClass"]
        by_pos.setdefault(pos, []).append(rec)
        by_spot.setdefault(spot, []).append(rec)
        by_pos_spot.setdefault(f"{pos}.{spot}", []).append(rec)
        by_hc.setdefault(hc, []).append(rec)
        by_hc_spot.setdefault(f"{hc}.{spot}", []).append(rec)
        by_pos_spot_hc.setdefault(f"{pos}.{spot}.{hc}", []).append(rec)

    premium = [r for r in records if r["hand"]["is_premium"]]
    trash = [r for r in records if r["hand"]["is_trash"]]
    premium_folds = [r for r in premium if int(r["selectedAction"]) == FOLD]
    trash_played = [r for r in trash if is_vpip_action(int(r["selectedAction"]))]

    return {
        "overall": _summarize_bet_bucket(records),
        "byPosition": {p: _summarize_bet_bucket(by_pos.get(p, [])) for p in POSITION_ORDER},
        "bySpot": {s: _summarize_bet_bucket(by_spot.get(s, [])) for s in SPOT_ORDER},
        "byPositionAndSpot": {
            f"{p}.{s}": _summarize_bet_bucket(by_pos_spot.get(f"{p}.{s}", []))
            for p in POSITION_ORDER for s in SPOT_ORDER
        },
        "byHandClass": {
            h: _summarize_bet_bucket(by_hc.get(h, [])) for h in HAND_CLASS_ORDER
        },
        "byHandClassAndSpot": {
            f"{h}.{s}": _summarize_bet_bucket(by_hc_spot.get(f"{h}.{s}", []))
            for h in HAND_CLASS_ORDER for s in SPOT_ORDER
        },
        "byPositionSpotAndHandClass": {
            f"{p}.{s}.{h}": _summarize_bet_bucket(by_pos_spot_hc.get(f"{p}.{s}.{h}", []))
            for p in POSITION_ORDER for s in SPOT_ORDER for h in HAND_CLASS_ORDER
        },
        "rates": {
            "trashPlayRate": _pct(len(trash_played), len(trash)),
            "premiumFoldRate": _pct(len(premium_folds), len(premium)),
        },
    }


# ---------------------------------------------------------------------------
# Summarize all BET-phase decisions across draw rounds
# ---------------------------------------------------------------------------

def summarize_bet_decisions(records: list[dict], *, max_draws: int) -> dict:
    rounds = [bet_round_key(r) for r in range(max_draws + 1)]
    by_round: dict[str, list[dict]] = {rk: [] for rk in rounds}
    by_round_fa: dict[str, list[dict]] = {
        f"{rk}.{fa}": [] for rk in rounds for fa in FACING_ACTION_ORDER
    }
    by_round_hc: dict[str, list[dict]] = {
        f"{rk}.{h}": [] for rk in rounds for h in HAND_CLASS_ORDER
    }
    by_round_hc_pos: dict[str, list[dict]] = {
        f"{rk}.{h}.{p}": [] for rk in rounds for h in HAND_CLASS_ORDER for p in POSITION_ORDER
    }

    for rec in records:
        rk = rec.get("betRound") or bet_round_key(int(rec.get("drawRound", 0)))
        fa = rec.get("facingAction") or facing_action_type(to_call=int(rec.get("toCall", 0)))
        hc = rec["handClass"]
        pos = rec["position"]
        by_round.setdefault(rk, []).append(rec)
        by_round_fa.setdefault(f"{rk}.{fa}", []).append(rec)
        by_round_hc.setdefault(f"{rk}.{hc}", []).append(rec)
        by_round_hc_pos.setdefault(f"{rk}.{hc}.{pos}", []).append(rec)

    return {
        "byBetRound": {
            rk: _summarize_bet_bucket(by_round.get(rk, [])) for rk in rounds
        },
        "byBetRoundFacingAction": {
            f"{rk}.{fa}": _summarize_bet_bucket(by_round_fa.get(f"{rk}.{fa}", []))
            for rk in rounds for fa in FACING_ACTION_ORDER
        },
        "byBetRoundAndHandClass": {
            f"{rk}.{h}": _summarize_bet_bucket(by_round_hc.get(f"{rk}.{h}", []))
            for rk in rounds for h in HAND_CLASS_ORDER
        },
        "byBetRoundHandClassPosition": {
            f"{rk}.{h}.{p}": _summarize_bet_bucket(by_round_hc_pos.get(f"{rk}.{h}.{p}", []))
            for rk in rounds for h in HAND_CLASS_ORDER for p in POSITION_ORDER
        },
    }


# ---------------------------------------------------------------------------
# Summarize DRAW-phase decisions
# ---------------------------------------------------------------------------

def summarize_draw_decisions(records: list[dict], *, max_draws: int) -> dict:
    rounds = [bet_round_key(r) for r in range(max_draws)]
    by_round: dict[str, list[dict]] = {rk: [] for rk in rounds}
    by_hc: dict[str, list[dict]] = {h: [] for h in HAND_CLASS_ORDER}
    by_round_hc: dict[str, list[dict]] = {
        f"{rk}.{h}": [] for rk in rounds for h in HAND_CLASS_ORDER
    }

    for rec in records:
        rk = rec.get("betRound") or bet_round_key(int(rec.get("drawRound", 1)))
        hc = rec["handClass"]
        by_round.setdefault(rk, []).append(rec)
        by_hc.setdefault(hc, []).append(rec)
        by_round_hc.setdefault(f"{rk}.{hc}", []).append(rec)

    made_recs = [r for r in records if r["hand"]["is_made"]]
    made_nonpat = [r for r in made_recs if int(r["drawCount"]) > 0]

    return {
        "overall": _summarize_draw_bucket(records),
        "byDrawRound": {
            rk: _summarize_draw_bucket(by_round.get(rk, [])) for rk in rounds
        },
        "byHandClass": {
            h: _summarize_draw_bucket(by_hc.get(h, [])) for h in HAND_CLASS_ORDER
        },
        "byDrawRoundAndHandClass": {
            f"{rk}.{h}": _summarize_draw_bucket(by_round_hc.get(f"{rk}.{h}", []))
            for rk in rounds for h in HAND_CLASS_ORDER
        },
        "rates": {
            "madeHandNonPatRate": _pct(len(made_nonpat), len(made_recs)),
        },
    }


# ---------------------------------------------------------------------------
# Warnings
# ---------------------------------------------------------------------------

def build_warnings(summary: dict, *, variant_id: str, max_draws: int) -> list[str]:
    warnings: list[str] = []
    opening = summary.get("opening", {})
    bet = summary.get("bet", {})
    draw = summary.get("draw", {})

    overall_vpip = opening.get("overall", {}).get("vpipPct", 0.0)
    by_pos = opening.get("byPosition", {})
    by_pos_spot = opening.get("byPositionAndSpot", {})
    by_pos_spot_hc = opening.get("byPositionSpotAndHandClass", {})
    opening_rates = opening.get("rates", {})

    utg_vpip = by_pos.get("UTG", {}).get("vpipPct", 0.0)
    btn_vpip = by_pos.get("BTN", {}).get("vpipPct", 0.0)
    co_vpip  = by_pos.get("CO",  {}).get("vpipPct", 0.0)

    # --- Opening range sanity ---
    if overall_vpip > 55.0:
        warnings.append(f"overall_opening_vpip > 55 ({overall_vpip:.2f})")
    if utg_vpip > 38.0:
        warnings.append(f"UTG_opening_vpip > 38 ({utg_vpip:.2f})")
    if btn_vpip < co_vpip:
        warnings.append(f"BTN_vpip < CO_vpip ({btn_vpip:.2f} < {co_vpip:.2f})")
    if btn_vpip < utg_vpip:
        warnings.append(f"BTN_vpip < UTG_vpip ({btn_vpip:.2f} < {utg_vpip:.2f})")
    if opening_rates.get("trashPlayRate", 0.0) > 15.0:
        warnings.append(f"trash_play_rate > 15 ({opening_rates['trashPlayRate']:.2f})")
    if opening_rates.get("premiumFoldRate", 0.0) > 5.0:
        warnings.append(f"premium_fold_rate > 5 ({opening_rates['premiumFoldRate']:.2f})")

    # Position-specific facing-open trash play
    trash_limits = {"CO": 10.0, "BTN": 15.0, "SB": 10.0, "BB": 25.0}
    for pos, limit in trash_limits.items():
        key = f"{pos}.facing_open.trash"
        rate = by_pos_spot_hc.get(key, {}).get("vpipPct", 0.0)
        if rate > limit:
            warnings.append(f"{pos}_facing_open_trash_play_rate > {limit:.0f} ({rate:.2f})")

    # --- Bet-round aggression checks ---
    by_round_hc = bet.get("byBetRoundAndHandClass", {})
    by_round_fa = bet.get("byBetRoundFacingAction", {})
    final_rk = f"round{max_draws}"

    # Made hands on final street should value bet, not check
    for hc in ("made_low_premium", "made_low_strong"):
        key = f"{final_rk}.{hc}"
        bucket = by_round_hc.get(key, {})
        if bucket.get("samples", 0) >= 5 and bucket.get("raiseBetPct", 0.0) < 20.0:
            warnings.append(
                f"{hc}_{final_rk}_raise_bet_pct < 20 ({bucket.get('raiseBetPct', 0.0):.2f})"
            )
    # Weak hands on final street should fold, not call
    final_facing_bet = by_round_fa.get(f"{final_rk}.facing_bet", {})
    if final_facing_bet.get("samples", 0) >= 5 and final_facing_bet.get("foldPct", 0.0) < 25.0:
        warnings.append(
            f"{final_rk}_facing_bet_fold_pct < 25 ({final_facing_bet.get('foldPct', 0.0):.2f})"
        )

    # Single-draw specific: pre-draw fold rate should be higher (fewer speculative hands)
    if max_draws == 1:
        rd0 = bet.get("byBetRound", {}).get("round0", {})
        if rd0.get("samples", 0) >= 20 and rd0.get("vpipPct", 0.0) > 58.0:
            warnings.append(f"SD_round0_vpip > 58 ({rd0['vpipPct']:.2f})")

    # --- Draw decision checks ---
    draw_overall = draw.get("overall", {})
    if draw_overall.get("samples", 0) >= 20:
        acc = draw_overall.get("accuracyRate", 100.0)
        if acc < 70.0:
            warnings.append(f"draw_accuracy_rate < 70 ({acc:.2f})")
    draw_rates = draw.get("rates", {})
    if draw_rates.get("madeHandNonPatRate", 0.0) > 5.0:
        warnings.append(
            f"made_hand_non_pat_rate > 5 ({draw_rates['madeHandNonPatRate']:.2f})"
        )

    return warnings


# ---------------------------------------------------------------------------
# Compact helpers for findings
# ---------------------------------------------------------------------------

def _compact_bet(rec: dict) -> dict:
    return {
        "sampleIndex": rec["sampleIndex"],
        "position": rec["position"],
        "spotType": rec.get("spotType"),
        "betRound": rec.get("betRound"),
        "facingAction": rec.get("facingAction"),
        "action": rec["selectedActionName"],
        "toCall": rec["toCall"],
        "qValues": rec["qValues"],
        "selectedQ": rec["selectedQ"],
        "handCards": rec["hand"]["cards"],
        "handClass": rec["hand"]["hand_class"],
        "drawStrength": rec["hand"]["draw_strength"],
        "highestRank": rec["hand"]["highest_rank"],
        "isMade": rec["hand"]["is_made"],
    }


def _compact_draw(rec: dict) -> dict:
    return {
        "sampleIndex": rec["sampleIndex"],
        "position": rec["position"],
        "betRound": rec.get("betRound"),
        "handCards": rec["hand"]["cards"],
        "handClass": rec["hand"]["hand_class"],
        "drawCount": rec["drawCount"],
        "idealDrawCount": rec["idealDrawCount"],
        "drawAccurate": rec["drawAccurate"],
        "qValues": rec.get("qValues", {}),
    }


def _top_bet(records: list[dict], predicate, *, limit: int = 20) -> list[dict]:
    matches = [r for r in records if predicate(r)]
    matches.sort(
        key=lambda r: (r["selectedQ"] if r["selectedQ"] is not None else -1e9),
        reverse=True,
    )
    return [_compact_bet(r) for r in matches[:limit]]


def _top_draw(records: list[dict], predicate, *, limit: int = 20) -> list[dict]:
    matches = [r for r in records if predicate(r)]
    return [_compact_draw(r) for r in matches[:limit]]


def build_findings(
    opening_records: list[dict],
    bet_records: list[dict],
    draw_records: list[dict],
    *,
    max_draws: int,
) -> dict:
    final_rk = f"round{max_draws}"
    return {
        "trashPlayedTop20": _top_bet(
            opening_records,
            lambda r: r["hand"]["is_trash"] and is_vpip_action(int(r["selectedAction"])),
        ),
        "premiumFoldedTop20": _top_bet(
            opening_records,
            lambda r: r["hand"]["is_premium"] and int(r["selectedAction"]) == FOLD,
        ),
        "facingOpenTrashPlayedTop20": _top_bet(
            opening_records,
            lambda r: (
                r.get("spotType") == "facing_open"
                and r["hand"]["is_trash"]
                and is_vpip_action(int(r["selectedAction"]))
            ),
        ),
        "premiumFoldedFacingBetTop20": _top_bet(
            bet_records,
            lambda r: (
                r["hand"]["is_premium"]
                and r.get("facingAction") == "facing_bet"
                and int(r["selectedAction"]) == FOLD
            ),
        ),
        f"{final_rk}_madeHandCheckedTop20": _top_bet(
            bet_records,
            lambda r: (
                r.get("betRound") == final_rk
                and r["hand"]["is_made"]
                and r.get("facingAction") == "unopened"
                and int(r["selectedAction"]) == CHECK
            ),
        ),
        f"{final_rk}_trashCalledTop20": _top_bet(
            bet_records,
            lambda r: (
                r.get("betRound") == final_rk
                and r["hand"]["is_trash"]
                and int(r["selectedAction"]) in (CALL, RAISE)
            ),
        ),
        "drawInaccurateTop20": _top_draw(
            draw_records,
            lambda r: not r["drawAccurate"],
            limit=20,
        ),
        "madeHandNonPatTop20": _top_draw(
            draw_records,
            lambda r: r["hand"]["is_made"] and int(r["drawCount"]) > 0,
            limit=20,
        ),
    }


# ---------------------------------------------------------------------------
# Main audit loop
# ---------------------------------------------------------------------------

def audit_checkpoint(
    *,
    checkpoint: Path,
    variant_id: str,
    episodes: int | None = None,
    samples: int | None = None,
    device: str = "cpu",
    seed: int = 20260607,
) -> dict:
    if episodes is None and samples is None:
        raise ValueError("episodes or samples is required")

    variant_id = variant_id.upper()
    if variant_id not in VARIANT_CONFIGS:
        raise ValueError(f"Unsupported variant_id={variant_id!r}; expected one of: {sorted(VARIANT_CONFIGS)}")
    family, max_draws = VARIANT_CONFIGS[variant_id]

    agent = DQNAgent.load(str(checkpoint), device=device)
    env = SixMaxDrawLowballEnv(family=family, max_draws=max_draws, seed=seed, opp_epsilon=0.0)
    env.set_agents(agent, agent)

    obs_dim = int(env.observation_space.shape[0])
    n_actions = int(env.action_space.n)
    if int(agent.obs_dim) != obs_dim or int(agent.n_actions) != n_actions:
        raise ValueError(
            f"checkpoint shape mismatch: checkpoint obs_dim={agent.obs_dim} "
            f"n_actions={agent.n_actions}, env obs_dim={obs_dim} n_actions={n_actions}"
        )
    if obs_dim != DRAW_OBSERVATION_VECTOR_SIZE:
        raise ValueError(f"unexpected observation size: {obs_dim} (expected {DRAW_OBSERVATION_VECTOR_SIZE})")

    opening_records: list[dict] = []
    bet_records: list[dict] = []
    draw_records: list[dict] = []
    hands_seen = 0
    skipped: Counter = Counter()
    device_t = torch.device(device)

    max_hands = int(episodes) if episodes is not None else max(int(samples or 0) * 50, (samples or 0) + 50)
    target_samples = int(samples) if samples is not None else None

    while hands_seen < max_hands and (target_samples is None or len(opening_records) < target_samples):
        hands_seen += 1
        obs, _ = env.reset()

        recorded_opening = False
        done = False
        steps = 0

        while not done and steps < MAX_HAND_STEPS:
            steps += 1
            action_mask = env.legal_action_mask()

            with torch.no_grad():
                obs_t = torch.as_tensor(obs, dtype=torch.float32, device=device_t).reshape(1, -1)
                q_values = agent.q_network(obs_t).detach().cpu().numpy()[0]

            if env.phase == "BET":
                if not getattr(env, "bet_queue", None) or env.bet_queue[0] != env.hero_seat:
                    skipped["hero_not_in_bet_queue"] += 1
                    break
                action = legal_argmax(q_values, action_mask)
                rec = make_bet_decision_record(
                    env=env,
                    q_values=q_values,
                    action_mask=action_mask,
                    action=action,
                    sample_index=len(bet_records),
                    bet_decision_index=len(bet_records),
                )
                bet_records.append(rec)
                if not recorded_opening and int(env.draw_round) == 0:
                    opening_rec = dict(rec)
                    opening_rec["sampleIndex"] = len(opening_records)
                    opening_records.append(opening_rec)
                    recorded_opening = True

            elif env.phase == "DRAW":
                action = legal_argmax(q_values, action_mask)
                draw_rec = make_draw_decision_record(
                    env=env,
                    q_values=q_values,
                    action_mask=action_mask,
                    action=action,
                    sample_index=len(draw_records),
                )
                draw_records.append(draw_rec)

            else:
                skipped[f"unknown_phase_{env.phase}"] += 1
                break

            obs, _reward, terminated, truncated, _info = env.step(action)
            done = bool(terminated or truncated)

        if steps >= MAX_HAND_STEPS:
            skipped["hand_step_cap"] += 1

    opening_summary = summarize_opening_decisions(opening_records)
    bet_summary = summarize_bet_decisions(bet_records, max_draws=max_draws)
    draw_summary = summarize_draw_decisions(draw_records, max_draws=max_draws)
    full_summary = {"opening": opening_summary, "bet": bet_summary, "draw": draw_summary}

    return {
        "schemaVersion": "draw-lowball-sixmax-opening-range-audit-v1",
        "createdAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "variantId": variant_id,
        "family": family,
        "maxDraws": max_draws,
        "checkpoint": str(checkpoint),
        "device": str(device),
        "seed": int(seed),
        "episodesRequested": episodes,
        "samplesRequested": samples,
        "handsSeen": int(hands_seen),
        "openingSamplesCollected": len(opening_records),
        "betRoundSamplesCollected": len(bet_records),
        "drawSamplesCollected": len(draw_records),
        "skipped": dict(skipped),
        "model": {
            "obsDim": int(agent.obs_dim),
            "envObsDim": obs_dim,
            "hiddenDim": int(agent.q_network.net[0].out_features),
            "nActions": int(agent.n_actions),
        },
        "summary": full_summary,
        "warnings": build_warnings(full_summary, variant_id=variant_id, max_draws=max_draws),
        "findings": build_findings(opening_records, bet_records, draw_records, max_draws=max_draws),
        "openingDecisions": opening_records,
        "betRoundDecisions": bet_records,
        "drawDecisions": draw_records,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument(
        "--variant-id", required=True,
        choices=sorted(VARIANT_CONFIGS),
        help="S01=2-7 SD, D01=2-7 TD, S02=A-5 SD, D02=A-5 TD",
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--episodes", type=int)
    mode.add_argument("--samples", type=int)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--seed", type=int, default=20260607)
    parser.add_argument("--output-json", type=Path)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> dict:
    args = parse_args(argv)
    report = audit_checkpoint(
        checkpoint=args.checkpoint,
        variant_id=args.variant_id,
        episodes=args.episodes,
        samples=args.samples,
        device=args.device,
        seed=args.seed,
    )
    payload = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output_json:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(payload, encoding="utf8")
    print(payload, end="")
    return report


if __name__ == "__main__":
    main()
