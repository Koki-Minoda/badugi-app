"""Audit 6-max Badugi DQN pre-draw opening ranges.

This tool intentionally does not train or mutate checkpoints. It loads a
checkpoint through DQNAgent.load, runs SixMaxBadugiEnv, preserves the opening
range audit, and also records hero betting decisions by Badugi bet round.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
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
from rl.env.badugi_env import Card, BADUGI_OBSERVATION_VECTOR_SIZE, evaluate_badugi
from rl.env.badugi_env_selfplay import _best_badugi_keep
from rl.env.badugi_env_sixmax_selfplay import (
    ALL_IN,
    BET,
    BB_AMOUNT,
    CALL,
    CHECK,
    FOLD,
    RAISE,
    SixMaxBadugiEnv,
)
from rl.training.train_sixmax_selfplay_badugi_dqn import hero_position_name


ACTION_NAMES = {
    FOLD: "FOLD",
    CHECK: "CHECK",
    CALL: "CALL",
    BET: "BET",
    RAISE: "RAISE",
    ALL_IN: "ALL_IN",
}
POSITION_ORDER = ("BTN", "CO", "MP", "UTG", "SB", "BB")
SPOT_ORDER = ("unopened", "facing_open", "sb_completion", "bb_option")
BET_ROUND_ORDER = ("round0", "round1", "round2", "round3")
FACING_ACTION_ORDER = ("facing_bet", "unopened")
HAND_CLASS_ORDER = (
    "made_badugi",
    "3-card",
    "2-card",
    "1-card",
    "premium_3card",
    "weak_2card",
    "weak_3card",
    "trash",
)
AGGRESSION_HAND_CLASS_ORDER = (
    "made_badugi",
    "strong_3card",
    "weak_3card",
    "weak_2card",
    "trash",
)


@dataclass(frozen=True)
class OpeningHandInfo:
    cards: list[str]
    raw_cards: list[list[int]]
    hand_class: str
    class_labels: list[str]
    made_cards: int
    made_label: str
    ranks: list[int]
    high_card: int
    high_card_label: str
    rank_sum: int
    smoothness: float
    roughness: float
    paired_rank_count: int
    duplicate_suit_count: int
    is_premium: bool
    is_playable: bool
    is_trash: bool


def card_label(card: Card) -> str:
    rank, suit = int(card[0]), int(card[1])
    rank_labels = ("A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K")
    suit_labels = ("c", "d", "h", "s")
    return f"{rank_labels[rank]}{suit_labels[suit]}"


def high_card_label(rank: int) -> str:
    if rank < 0 or rank > 12:
        return "NA"
    return ("A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K")[rank]


def legal_argmax(q_values: Sequence[float], action_mask: Sequence[float]) -> int:
    q = np.asarray(q_values, dtype=np.float32).reshape(-1).copy()
    mask = np.asarray(action_mask, dtype=np.float32).reshape(-1)
    q[mask <= 0] = -1e9
    return int(np.argmax(q))


def classify_opening_hand(hand: Sequence[Card]) -> OpeningHandInfo:
    hand_list = [(int(rank), int(suit)) for rank, suit in hand]
    count, ranks_raw = evaluate_badugi(hand_list)
    ranks = sorted(int(rank) for rank in ranks_raw)
    high = max(ranks) if ranks else 13
    rank_sum = sum(ranks) if ranks else 99
    ranks_all = [rank for rank, _suit in hand_list]
    suits_all = [suit for _rank, suit in hand_list]
    paired_rank_count = len(ranks_all) - len(set(ranks_all))
    duplicate_suit_count = len(suits_all) - len(set(suits_all))

    if len(ranks) >= 2:
        span = max(ranks) - min(ranks)
        smoothness = max(0.0, 1.0 - span / 12.0)
    else:
        smoothness = 0.0
    roughness = min(1.0, high / 12.0) if high <= 12 else 1.0

    made_label = f"{count}-card" if count < 4 else "badugi"
    labels: list[str] = ["made_badugi" if count == 4 else f"{count}-card"]

    premium_3card = count == 3 and high <= 6 and rank_sum <= 12
    weak_2card = count == 2 and high >= 8
    weak_3card = count == 3 and high >= 7
    is_premium = (count == 4 and high <= 8) or premium_3card
    is_trash = count <= 1 or weak_2card or (count == 3 and high >= 10)
    is_playable = not is_trash

    if premium_3card:
        labels.append("premium_3card")
    if weak_2card:
        labels.append("weak_2card")
    if weak_3card:
        labels.append("weak_3card")
    if is_trash:
        labels.append("trash")

    if count == 4:
        hand_class = "made_badugi"
    elif premium_3card:
        hand_class = "premium_3card"
    elif weak_3card:
        hand_class = "weak_3card"
    elif is_trash:
        hand_class = "trash"
    else:
        hand_class = f"{count}-card"

    return OpeningHandInfo(
        cards=[card_label(card) for card in hand_list],
        raw_cards=[[rank, suit] for rank, suit in hand_list],
        hand_class=hand_class,
        class_labels=labels,
        made_cards=count,
        made_label=made_label,
        ranks=ranks,
        high_card=high if high <= 12 else -1,
        high_card_label=high_card_label(high if high <= 12 else -1),
        rank_sum=rank_sum,
        smoothness=round(float(smoothness), 4),
        roughness=round(float(roughness), 4),
        paired_rank_count=paired_rank_count,
        duplicate_suit_count=duplicate_suit_count,
        is_premium=bool(is_premium),
        is_playable=bool(is_playable),
        is_trash=bool(is_trash),
    )


def action_bucket(action: int) -> str:
    if action == FOLD:
        return "fold"
    if action in (CHECK, CALL):
        return "call_check"
    if action in (BET, RAISE, ALL_IN):
        return "raise_bet"
    return "other"


def bet_round_key(draw_round: int) -> str:
    return f"round{max(0, min(3, int(draw_round)))}"


def facing_action_type(*, to_call: int) -> str:
    return "facing_bet" if int(to_call) > 0 else "unopened"


def aggression_hand_class_from_info(hand_info: OpeningHandInfo) -> str:
    labels = set(hand_info.class_labels)
    if hand_info.made_cards >= 4 or "made_badugi" in labels:
        return "made_badugi"
    if "weak_3card" in labels:
        return "weak_3card"
    if "weak_2card" in labels:
        return "weak_2card"
    if hand_info.made_cards == 3 and not hand_info.is_trash:
        return "strong_3card"
    return "trash"


def aggression_hand_class(record: dict) -> str:
    hand = record.get("hand", {})
    labels = set(hand.get("class_labels", []))
    made_cards = int(hand.get("made_cards", 0) or 0)
    if made_cards >= 4 or "made_badugi" in labels:
        return "made_badugi"
    if "weak_3card" in labels:
        return "weak_3card"
    if "weak_2card" in labels:
        return "weak_2card"
    if made_cards == 3 and not bool(hand.get("is_trash", False)):
        return "strong_3card"
    return "trash"


def is_vpip_action(action: int) -> bool:
    return action in (CALL, BET, RAISE, ALL_IN)


def is_pfr_action(action: int) -> bool:
    return action in (BET, RAISE, ALL_IN)


def spot_type(*, position: str, current_bet: int, to_call: int) -> str:
    if current_bet > BB_AMOUNT or to_call > BB_AMOUNT:
        return "facing_open"
    if position == "SB" and current_bet == BB_AMOUNT and to_call == 1:
        return "sb_completion"
    if position == "BB" and current_bet == BB_AMOUNT and to_call == 0:
        return "bb_option"
    return "unopened"


def make_decision_record(
    *,
    env: SixMaxBadugiEnv,
    obs: np.ndarray,
    q_values: Sequence[float],
    action_mask: Sequence[float],
    action: int,
    sample_index: int,
) -> dict:
    hero_seat = int(env.hero_seat)
    hand = list(env.players[hero_seat]["hand"])
    hand_info = classify_opening_hand(hand)
    legal_actions = [
        {"index": int(idx), "name": ACTION_NAMES.get(int(idx), str(idx))}
        for idx, allowed in enumerate(action_mask)
        if allowed > 0
    ]
    q_list = [float(v) for v in np.asarray(q_values, dtype=np.float32).reshape(-1)]
    to_call = max(0, int(env.current_bet - env.players[hero_seat]["bet"]))
    position = hero_position_name(hero_seat, env.dealer_seat)
    keep = _best_badugi_keep(hand)
    selected_q = q_list[action] if 0 <= action < len(q_list) else None
    legal_q = [q_list[idx] for idx, allowed in enumerate(action_mask) if allowed > 0 and idx < len(q_list)]
    best_legal_q = max(legal_q) if legal_q else selected_q
    return {
        "sampleIndex": int(sample_index),
        "position": position,
        "spotType": spot_type(position=position, current_bet=int(env.current_bet), to_call=int(to_call)),
        "betRound": bet_round_key(int(env.draw_round)),
        "facingAction": facing_action_type(to_call=int(to_call)),
        "aggressionHandClass": aggression_hand_class_from_info(hand_info),
        "handClass": hand_info.hand_class,
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
        "qValues": {ACTION_NAMES.get(i, str(i)): q_list[i] for i in range(min(len(q_list), 6))},
        "selectedQ": selected_q,
        "bestLegalQ": best_legal_q,
        "legalQMargin": float(selected_q - best_legal_q) if selected_q is not None and best_legal_q is not None else None,
        "obsActionMask": [float(x) for x in obs[32:38]],
        "hand": asdict(hand_info),
        "recommendedDrawCount": max(0, min(3, len(hand) - len(keep))),
        "vpip": is_vpip_action(action),
        "pfr": is_pfr_action(action),
        "vpipIncluded": is_vpip_action(action),
        "pfrIncluded": is_pfr_action(action),
    }


def _empty_action_counts() -> Counter:
    return Counter({"fold": 0, "call_check": 0, "raise_bet": 0, "other": 0})


def _pct(numerator: int | float, denominator: int | float) -> float:
    return round((float(numerator) / float(denominator) * 100.0), 4) if denominator else 0.0


def _summarize_bucket(records: list[dict]) -> dict:
    counts = _empty_action_counts()
    check = 0
    vpip = 0
    pfr = 0
    q_fold: list[float] = []
    q_call: list[float] = []
    q_raise: list[float] = []
    for record in records:
        action = int(record["selectedAction"])
        counts[action_bucket(action)] += 1
        check += int(action == CHECK)
        vpip += int(is_vpip_action(action))
        pfr += int(is_pfr_action(action))
        q = record["qValues"]
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
        "avgQFold": round(float(np.mean(q_fold)), 6) if q_fold else None,
        "avgQCall": round(float(np.mean(q_call)), 6) if q_call else None,
        "avgQRaise": round(float(np.mean(q_raise)), 6) if q_raise else None,
        "actionCounts": dict(counts),
    }


def _summarize_aggression_bucket(records: list[dict], *, include_vpip: bool = True) -> dict:
    fold = 0
    call = 0
    raise_count = 0
    vpip = 0
    counts = Counter({name: 0 for name in ACTION_NAMES.values()})
    for record in records:
        action = int(record["selectedAction"])
        action_name = ACTION_NAMES.get(action, str(action))
        counts[action_name] += 1
        fold += int(action == FOLD)
        call += int(action in (CHECK, CALL))
        raise_count += int(action in (BET, RAISE, ALL_IN))
        vpip += int(is_vpip_action(action))
    n = len(records)
    summary = {
        "samples": n,
        "foldPct": _pct(fold, n),
        "callPct": _pct(call, n),
        "raisePct": _pct(raise_count, n),
        "actionCounts": dict(counts),
    }
    if include_vpip:
        summary["vpipPct"] = _pct(vpip, n)
    return summary


def _summarize_aggression_q_bucket(records: list[dict]) -> dict:
    q_fold: list[float] = []
    q_call: list[float] = []
    q_raise: list[float] = []
    for record in records:
        q = record.get("qValues", {})
        if "FOLD" in q:
            q_fold.append(float(q["FOLD"]))
        if "CALL" in q:
            q_call.append(float(q["CALL"]))
        if "RAISE" in q:
            q_raise.append(float(q["RAISE"]))
    return {
        "samples": len(records),
        "avgQFold": round(float(np.mean(q_fold)), 6) if q_fold else None,
        "avgQCall": round(float(np.mean(q_call)), 6) if q_call else None,
        "avgQRaise": round(float(np.mean(q_raise)), 6) if q_raise else None,
    }


def summarize_aggression_decisions(records: list[dict]) -> dict:
    by_bet_round_records: dict[str, list[dict]] = {round_key: [] for round_key in BET_ROUND_ORDER}
    by_bet_round_facing_action_records: dict[str, list[dict]] = {
        f"{round_key}.{facing_action}": []
        for round_key in BET_ROUND_ORDER
        for facing_action in FACING_ACTION_ORDER
    }
    by_bet_round_and_hand_class_records: dict[str, list[dict]] = {
        f"{round_key}.{hand_class}": []
        for round_key in BET_ROUND_ORDER
        for hand_class in AGGRESSION_HAND_CLASS_ORDER
    }
    by_bet_round_hand_class_position_records: dict[str, list[dict]] = {
        f"{round_key}.{hand_class}.{position}": []
        for round_key in BET_ROUND_ORDER
        for hand_class in AGGRESSION_HAND_CLASS_ORDER
        for position in POSITION_ORDER
    }

    for record in records:
        round_key = record.get("betRound") or bet_round_key(int(record.get("drawRound", 0)))
        facing_action = record.get("facingAction") or facing_action_type(to_call=int(record.get("toCall", 0)))
        hand_class = record.get("aggressionHandClass") or aggression_hand_class(record)
        position = record.get("position", "NA")
        by_bet_round_records.setdefault(round_key, []).append(record)
        by_bet_round_facing_action_records.setdefault(f"{round_key}.{facing_action}", []).append(record)
        by_bet_round_and_hand_class_records.setdefault(f"{round_key}.{hand_class}", []).append(record)
        by_bet_round_hand_class_position_records.setdefault(f"{round_key}.{hand_class}.{position}", []).append(record)

    return {
        "byBetRound": {
            round_key: _summarize_aggression_bucket(by_bet_round_records.get(round_key, []))
            for round_key in BET_ROUND_ORDER
        },
        "byBetRoundFacingAction": {
            f"{round_key}.{facing_action}": _summarize_aggression_bucket(
                by_bet_round_facing_action_records.get(f"{round_key}.{facing_action}", [])
            )
            for round_key in BET_ROUND_ORDER
            for facing_action in FACING_ACTION_ORDER
        },
        "byBetRoundAndHandClass": {
            f"{round_key}.{hand_class}": _summarize_aggression_bucket(
                by_bet_round_and_hand_class_records.get(f"{round_key}.{hand_class}", []),
                include_vpip=False,
            )
            for round_key in BET_ROUND_ORDER
            for hand_class in AGGRESSION_HAND_CLASS_ORDER
        },
        "byBetRoundHandClassPosition": {
            f"{round_key}.{hand_class}.{position}": _summarize_aggression_bucket(
                by_bet_round_hand_class_position_records.get(f"{round_key}.{hand_class}.{position}", []),
                include_vpip=False,
            )
            for round_key in BET_ROUND_ORDER
            for hand_class in AGGRESSION_HAND_CLASS_ORDER
            for position in POSITION_ORDER
        },
        "byBetRoundAndHandClassQ": {
            f"{round_key}.{hand_class}": _summarize_aggression_q_bucket(
                by_bet_round_and_hand_class_records.get(f"{round_key}.{hand_class}", [])
            )
            for round_key in BET_ROUND_ORDER
            for hand_class in AGGRESSION_HAND_CLASS_ORDER
        },
    }


def summarize_decisions(records: list[dict]) -> dict:
    by_position_records: dict[str, list[dict]] = {position: [] for position in POSITION_ORDER}
    by_spot_records: dict[str, list[dict]] = {spot: [] for spot in SPOT_ORDER}
    by_position_and_spot_records: dict[str, list[dict]] = {
        f"{position}.{spot}": [] for position in POSITION_ORDER for spot in SPOT_ORDER
    }
    by_hand_class_records: dict[str, list[dict]] = {label: [] for label in HAND_CLASS_ORDER}
    by_hand_class_and_spot_records: dict[str, list[dict]] = {
        f"{label}.{spot}": [] for label in HAND_CLASS_ORDER for spot in SPOT_ORDER
    }
    by_position_spot_and_hand_class_records: dict[str, list[dict]] = {
        f"{position}.{spot}.{label}": []
        for position in POSITION_ORDER
        for spot in SPOT_ORDER
        for label in HAND_CLASS_ORDER
    }
    for record in records:
        position = record["position"]
        spot = record.get("spotType", "unopened")
        by_position_records.setdefault(position, []).append(record)
        by_spot_records.setdefault(spot, []).append(record)
        by_position_and_spot_records.setdefault(f"{position}.{spot}", []).append(record)
        for label in record["hand"]["class_labels"]:
            by_hand_class_records.setdefault(label, []).append(record)
            by_hand_class_and_spot_records.setdefault(f"{label}.{spot}", []).append(record)
            by_position_spot_and_hand_class_records.setdefault(f"{position}.{spot}.{label}", []).append(record)

    by_position = {
        position: _summarize_bucket(by_position_records.get(position, []))
        for position in POSITION_ORDER
    }
    by_spot = {
        spot: _summarize_bucket(by_spot_records.get(spot, []))
        for spot in SPOT_ORDER
    }
    by_position_and_spot = {
        f"{position}.{spot}": _summarize_bucket(by_position_and_spot_records.get(f"{position}.{spot}", []))
        for position in POSITION_ORDER
        for spot in SPOT_ORDER
    }
    by_hand_class = {
        hand_class: _summarize_bucket(by_hand_class_records.get(hand_class, []))
        for hand_class in HAND_CLASS_ORDER
    }
    by_hand_class_and_spot = {
        f"{hand_class}.{spot}": _summarize_bucket(
            by_hand_class_and_spot_records.get(f"{hand_class}.{spot}", [])
        )
        for hand_class in HAND_CLASS_ORDER
        for spot in SPOT_ORDER
    }
    by_position_spot_and_hand_class = {
        f"{position}.{spot}.{hand_class}": _summarize_bucket(
            by_position_spot_and_hand_class_records.get(f"{position}.{spot}.{hand_class}", [])
        )
        for position in POSITION_ORDER
        for spot in SPOT_ORDER
        for hand_class in HAND_CLASS_ORDER
    }
    overall = _summarize_bucket(records)
    trash_records = [record for record in records if record["hand"]["is_trash"]]
    facing_open = [record for record in records if record.get("spotType") == "facing_open"]
    facing_open_trash = [record for record in facing_open if record["hand"]["is_trash"]]
    facing_open_weak_2card = [
        record for record in facing_open if "weak_2card" in record["hand"]["class_labels"]
    ]
    facing_open_weak_3card = [
        record for record in facing_open if "weak_3card" in record["hand"]["class_labels"]
    ]
    weak_early = [
        record
        for record in records
        if "weak_3card" in record["hand"]["class_labels"] and record["position"] in ("UTG", "MP")
    ]
    premium_records = [record for record in records if record["hand"]["is_premium"]]
    premium_folds = [record for record in premium_records if int(record["selectedAction"]) == FOLD]
    trash_played = [record for record in trash_records if is_vpip_action(int(record["selectedAction"]))]
    weak_early_played = [record for record in weak_early if is_vpip_action(int(record["selectedAction"]))]
    facing_open_trash_played = [
        record for record in facing_open_trash if is_vpip_action(int(record["selectedAction"]))
    ]
    facing_open_weak_2card_played = [
        record for record in facing_open_weak_2card if is_vpip_action(int(record["selectedAction"]))
    ]
    facing_open_weak_3card_played = [
        record for record in facing_open_weak_3card if is_vpip_action(int(record["selectedAction"]))
    ]

    return {
        "overall": overall,
        "byPosition": by_position,
        "bySpot": by_spot,
        "byPositionAndSpot": by_position_and_spot,
        "byHandClass": by_hand_class,
        "byHandClassAndSpot": by_hand_class_and_spot,
        "byPositionSpotAndHandClass": by_position_spot_and_hand_class,
        "rates": {
            "trashPlayRate": _pct(len(trash_played), len(trash_records)),
            "weak3cardEarlyPlayRate": _pct(len(weak_early_played), len(weak_early)),
            "premiumFoldRate": _pct(len(premium_folds), len(premium_records)),
            "facingOpenTrashPlayRate": _pct(len(facing_open_trash_played), len(facing_open_trash)),
            "facingOpenWeak2CardPlayRate": _pct(
                len(facing_open_weak_2card_played), len(facing_open_weak_2card)
            ),
            "facingOpenWeak3CardPlayRate": _pct(
                len(facing_open_weak_3card_played), len(facing_open_weak_3card)
            ),
        },
    }


def compact_decision(record: dict) -> dict:
    return {
        "sampleIndex": record["sampleIndex"],
        "position": record["position"],
        "spotType": record.get("spotType", "unopened"),
        "betRound": record.get("betRound") or bet_round_key(int(record.get("drawRound", 0))),
        "facingAction": record.get("facingAction") or facing_action_type(to_call=int(record.get("toCall", 0))),
        "aggressionHandClass": record.get("aggressionHandClass") or aggression_hand_class(record),
        "action": record["selectedActionName"],
        "toCall": record["toCall"],
        "qValues": record["qValues"],
        "selectedQ": record["selectedQ"],
        "handCards": record["hand"]["cards"],
        "handClass": record["hand"]["hand_class"],
        "madeCards": record["hand"]["made_cards"],
        "highCard": record["hand"]["high_card_label"],
        "smoothness": record["hand"]["smoothness"],
        "roughness": record["hand"]["roughness"],
        "pairedRankCount": record["hand"]["paired_rank_count"],
        "duplicateSuitCount": record["hand"]["duplicate_suit_count"],
    }


def top_decisions(records: list[dict], predicate, *, limit: int = 20) -> list[dict]:
    matches = [record for record in records if predicate(record)]
    matches.sort(key=lambda record: (record["selectedQ"] if record["selectedQ"] is not None else -1e9), reverse=True)
    return [compact_decision(record) for record in matches[:limit]]


def compact_weak_aggression_decision(record: dict) -> dict:
    q = record.get("qValues", {})
    return {
        "round": record.get("betRound") or bet_round_key(int(record.get("drawRound", 0))),
        "position": record.get("position"),
        "hand": record.get("hand", {}).get("cards", []),
        "handClass": record.get("aggressionHandClass") or aggression_hand_class(record),
        "action": record.get("selectedActionName"),
        "qFold": q.get("FOLD"),
        "qCall": q.get("CALL"),
        "qRaise": q.get("RAISE"),
        "pot": record.get("pot"),
        "toCall": record.get("toCall"),
    }


def top_weak_aggression_decisions(records: list[dict], predicate, *, limit: int = 20) -> list[dict]:
    matches = [record for record in records if predicate(record)]
    matches.sort(
        key=lambda record: (
            float(record.get("qValues", {}).get("RAISE", -1e9) or -1e9),
            record["selectedQ"] if record.get("selectedQ") is not None else -1e9,
        ),
        reverse=True,
    )
    return [compact_weak_aggression_decision(record) for record in matches[:limit]]


def build_findings(records: list[dict], aggression_records: list[dict] | None = None) -> dict:
    aggression_records = records if aggression_records is None else aggression_records
    return {
        "trashPlayedTop20": top_decisions(
            records,
            lambda record: record["hand"]["is_trash"] and is_vpip_action(int(record["selectedAction"])),
        ),
        "facingOpenTrashPlayedTop20": top_decisions(
            records,
            lambda record: (
                record.get("spotType") == "facing_open"
                and record["hand"]["is_trash"]
                and is_vpip_action(int(record["selectedAction"]))
            ),
        ),
        "coFacingOpenTrashPlayedTop20": top_decisions(
            records,
            lambda record: (
                record["position"] == "CO"
                and record.get("spotType") == "facing_open"
                and record["hand"]["is_trash"]
                and is_vpip_action(int(record["selectedAction"]))
            ),
        ),
        "btnFacingOpenTrashPlayedTop20": top_decisions(
            records,
            lambda record: (
                record["position"] == "BTN"
                and record.get("spotType") == "facing_open"
                and record["hand"]["is_trash"]
                and is_vpip_action(int(record["selectedAction"]))
            ),
        ),
        "sbFacingOpenTrashPlayedTop20": top_decisions(
            records,
            lambda record: (
                record["position"] == "SB"
                and record.get("spotType") == "facing_open"
                and record["hand"]["is_trash"]
                and is_vpip_action(int(record["selectedAction"]))
            ),
        ),
        "bbFacingOpenTrashPlayedTop20": top_decisions(
            records,
            lambda record: (
                record["position"] == "BB"
                and record.get("spotType") == "facing_open"
                and record["hand"]["is_trash"]
                and is_vpip_action(int(record["selectedAction"]))
            ),
        ),
        "facingOpenWeak2CardPlayedTop20": top_decisions(
            records,
            lambda record: (
                record.get("spotType") == "facing_open"
                and "weak_2card" in record["hand"]["class_labels"]
                and is_vpip_action(int(record["selectedAction"]))
            ),
        ),
        "facingOpenWeak3CardPlayedTop20": top_decisions(
            records,
            lambda record: (
                record.get("spotType") == "facing_open"
                and "weak_3card" in record["hand"]["class_labels"]
                and is_vpip_action(int(record["selectedAction"]))
            ),
        ),
        "facingOpenWeakHandRaisedTop20": top_decisions(
            records,
            lambda record: (
                record.get("spotType") == "facing_open"
                and (
                    record["hand"]["is_trash"]
                    or "weak_2card" in record["hand"]["class_labels"]
                    or "weak_3card" in record["hand"]["class_labels"]
                )
                and is_pfr_action(int(record["selectedAction"]))
            ),
        ),
        "weak3cardEarlyPlayedTop20": top_decisions(
            records,
            lambda record: (
                "weak_3card" in record["hand"]["class_labels"]
                and record["position"] in ("UTG", "MP")
                and is_vpip_action(int(record["selectedAction"]))
            ),
        ),
        "premiumFoldedTop20": top_decisions(
            records,
            lambda record: record["hand"]["is_premium"] and int(record["selectedAction"]) == FOLD,
        ),
        "btnPlayableFoldedTop20": top_decisions(
            records,
            lambda record: (
                record["position"] == "BTN"
                and record["hand"]["is_playable"]
                and int(record["selectedAction"]) == FOLD
            ),
        ),
        "round2_strong_hand_folded": top_decisions(
            aggression_records,
            lambda record: (
                (record.get("betRound") or bet_round_key(int(record.get("drawRound", 0)))) == "round2"
                and (record.get("aggressionHandClass") or aggression_hand_class(record))
                in ("made_badugi", "strong_3card")
                and int(record["selectedAction"]) == FOLD
            ),
        ),
        "round3_made_badugi_checked": top_decisions(
            aggression_records,
            lambda record: (
                (record.get("betRound") or bet_round_key(int(record.get("drawRound", 0)))) == "round3"
                and (record.get("aggressionHandClass") or aggression_hand_class(record)) == "made_badugi"
                and int(record["selectedAction"]) == CHECK
            ),
        ),
        "round3_made_badugi_called_not_raised": top_decisions(
            aggression_records,
            lambda record: (
                (record.get("betRound") or bet_round_key(int(record.get("drawRound", 0)))) == "round3"
                and (record.get("aggressionHandClass") or aggression_hand_class(record)) == "made_badugi"
                and int(record["selectedAction"]) == CALL
            ),
        ),
        "round3_strong_3card_folded": top_decisions(
            aggression_records,
            lambda record: (
                (record.get("betRound") or bet_round_key(int(record.get("drawRound", 0)))) == "round3"
                and (record.get("aggressionHandClass") or aggression_hand_class(record)) == "strong_3card"
                and int(record["selectedAction"]) == FOLD
            ),
        ),
        "round1_trash_raised_top20": top_weak_aggression_decisions(
            aggression_records,
            lambda record: (
                (record.get("betRound") or bet_round_key(int(record.get("drawRound", 0)))) == "round1"
                and (record.get("aggressionHandClass") or aggression_hand_class(record)) == "trash"
                and is_pfr_action(int(record["selectedAction"]))
            ),
        ),
        "round2_trash_raised_top20": top_weak_aggression_decisions(
            aggression_records,
            lambda record: (
                (record.get("betRound") or bet_round_key(int(record.get("drawRound", 0)))) == "round2"
                and (record.get("aggressionHandClass") or aggression_hand_class(record)) == "trash"
                and is_pfr_action(int(record["selectedAction"]))
            ),
        ),
        "round1_weak3_raised_top20": top_weak_aggression_decisions(
            aggression_records,
            lambda record: (
                (record.get("betRound") or bet_round_key(int(record.get("drawRound", 0)))) == "round1"
                and (record.get("aggressionHandClass") or aggression_hand_class(record)) == "weak_3card"
                and is_pfr_action(int(record["selectedAction"]))
            ),
        ),
        "round2_weak3_raised_top20": top_weak_aggression_decisions(
            aggression_records,
            lambda record: (
                (record.get("betRound") or bet_round_key(int(record.get("drawRound", 0)))) == "round2"
                and (record.get("aggressionHandClass") or aggression_hand_class(record)) == "weak_3card"
                and is_pfr_action(int(record["selectedAction"]))
            ),
        ),
    }


def build_warnings(summary: dict) -> list[str]:
    warnings: list[str] = []
    overall_vpip = summary["overall"]["vpipPct"]
    by_pos = summary["byPosition"]
    by_pos_spot = summary.get("byPositionAndSpot", {})
    by_pos_spot_hand = summary.get("byPositionSpotAndHandClass", {})
    by_round_facing = summary.get("byBetRoundFacingAction", {})
    by_round_hand = summary.get("byBetRoundAndHandClass", {})
    rates = summary["rates"]
    utg_vpip = by_pos["UTG"]["vpipPct"]
    btn_vpip = by_pos["BTN"]["vpipPct"]
    co_vpip = by_pos["CO"]["vpipPct"]
    if overall_vpip > 40.0:
        warnings.append(f"overall_vpip > 40 ({overall_vpip:.2f})")
    if utg_vpip > 30.0:
        warnings.append(f"UTG_vpip > 30 ({utg_vpip:.2f})")
    if btn_vpip < co_vpip:
        warnings.append(f"BTN_vpip < CO_vpip ({btn_vpip:.2f} < {co_vpip:.2f})")
    if btn_vpip < utg_vpip:
        warnings.append(f"BTN_vpip < UTG_vpip ({btn_vpip:.2f} < {utg_vpip:.2f})")
    if rates["trashPlayRate"] > 10.0:
        warnings.append(f"trash_play_rate > 10 ({rates['trashPlayRate']:.2f})")
    if rates["weak3cardEarlyPlayRate"] > 20.0:
        warnings.append(f"weak_3card_early_play_rate > 20 ({rates['weak3cardEarlyPlayRate']:.2f})")
    if rates["premiumFoldRate"] > 5.0:
        warnings.append(f"premium_fold_rate > 5 ({rates['premiumFoldRate']:.2f})")
    if rates.get("facingOpenTrashPlayRate", 0.0) > 15.0:
        warnings.append(f"facing_open_trash_play_rate > 15 ({rates['facingOpenTrashPlayRate']:.2f})")
    if rates.get("facingOpenWeak2CardPlayRate", 0.0) > 20.0:
        warnings.append(f"facing_open_weak_2card_play_rate > 20 ({rates['facingOpenWeak2CardPlayRate']:.2f})")
    if rates.get("facingOpenWeak3CardPlayRate", 0.0) > 25.0:
        warnings.append(f"facing_open_weak_3card_play_rate > 25 ({rates['facingOpenWeak3CardPlayRate']:.2f})")
    facing_open_trash_limits = {
        "CO": 10.0,
        "BTN": 15.0,
        "SB": 10.0,
        "BB": 25.0,
    }
    for position, limit in facing_open_trash_limits.items():
        key = f"{position}.facing_open.trash"
        rate = by_pos_spot_hand.get(key, {}).get("vpipPct", 0.0)
        if rate > limit:
            warnings.append(f"{position}_facing_open_trash_play_rate > {limit:.0f} ({rate:.2f})")
    facing_open_weak2_limits = {
        "CO": 15.0,
        "BTN": 25.0,
        "SB": 15.0,
        "BB": 35.0,
    }
    for position, limit in facing_open_weak2_limits.items():
        key = f"{position}.facing_open.weak_2card"
        rate = by_pos_spot_hand.get(key, {}).get("vpipPct", 0.0)
        if rate > limit:
            warnings.append(f"{position}_facing_open_weak2card_play_rate > {limit:.0f} ({rate:.2f})")
    facing_open_position_limits = {
        "CO": 30.0,
        "BTN": 45.0,
        "SB": 40.0,
        "BB": 65.0,
    }
    for position, limit in facing_open_position_limits.items():
        key = f"{position}.facing_open"
        vpip = by_pos_spot.get(key, {}).get("vpipPct", 0.0)
        if vpip > limit:
            warnings.append(f"{position}_facing_open_vpip > {limit:.0f} ({vpip:.2f})")
    if utg_vpip > co_vpip or utg_vpip > btn_vpip:
        warnings.append(
            f"UTG_play_rate_above_CO_or_BTN (UTG={utg_vpip:.2f}, CO={co_vpip:.2f}, BTN={btn_vpip:.2f})"
        )
    round2_facing_bet = by_round_facing.get("round2.facing_bet", {})
    if round2_facing_bet.get("samples", 0) >= 5 and round2_facing_bet.get("foldPct", 0.0) > 75.0:
        warnings.append(
            f"round2_facing_bet_fold_rate > 75 ({round2_facing_bet.get('foldPct', 0.0):.2f})"
        )
    round3_facing_bet = by_round_facing.get("round3.facing_bet", {})
    if round3_facing_bet.get("samples", 0) >= 5 and round3_facing_bet.get("foldPct", 0.0) > 70.0:
        warnings.append(
            f"round3_facing_bet_fold_rate > 70 ({round3_facing_bet.get('foldPct', 0.0):.2f})"
        )
    made_badugi_round2 = by_round_hand.get("round2.made_badugi", {})
    if made_badugi_round2.get("samples", 0) >= 5 and made_badugi_round2.get("raisePct", 0.0) < 20.0:
        warnings.append(
            f"made_badugi_round2_raise_rate < 20 ({made_badugi_round2.get('raisePct', 0.0):.2f})"
        )
    made_badugi_round3 = by_round_hand.get("round3.made_badugi", {})
    if made_badugi_round3.get("samples", 0) >= 5 and made_badugi_round3.get("raisePct", 0.0) < 25.0:
        warnings.append(
            f"made_badugi_round3_raise_rate < 25 ({made_badugi_round3.get('raisePct', 0.0):.2f})"
        )
    strong_3card_round2 = by_round_hand.get("round2.strong_3card", {})
    if strong_3card_round2.get("samples", 0) >= 5 and strong_3card_round2.get("foldPct", 0.0) > 60.0:
        warnings.append(
            f"strong_3card_round2_fold_rate > 60 ({strong_3card_round2.get('foldPct', 0.0):.2f})"
        )
    round1_trash = by_round_hand.get("round1.trash", {})
    if round1_trash.get("samples", 0) >= 20 and round1_trash.get("raisePct", 0.0) > 50.0:
        warnings.append(f"round1_trash_raise_rate > 50 ({round1_trash.get('raisePct', 0.0):.2f})")
    round2_trash = by_round_hand.get("round2.trash", {})
    if round2_trash.get("samples", 0) >= 20 and round2_trash.get("raisePct", 0.0) > 40.0:
        warnings.append(f"round2_trash_raise_rate > 40 ({round2_trash.get('raisePct', 0.0):.2f})")
    round1_weak3 = by_round_hand.get("round1.weak_3card", {})
    if round1_weak3.get("samples", 0) >= 20 and round1_weak3.get("raisePct", 0.0) > 50.0:
        warnings.append(f"round1_weak3_raise_rate > 50 ({round1_weak3.get('raisePct', 0.0):.2f})")
    round2_weak3 = by_round_hand.get("round2.weak_3card", {})
    if round2_weak3.get("samples", 0) >= 20 and round2_weak3.get("raisePct", 0.0) > 40.0:
        warnings.append(f"round2_weak3_raise_rate > 40 ({round2_weak3.get('raisePct', 0.0):.2f})")
    return warnings


def audit_checkpoint(
    *,
    checkpoint: Path,
    episodes: int | None = None,
    samples: int | None = None,
    device: str = "cpu",
    seed: int = 20260607,
) -> dict:
    if episodes is None and samples is None:
        raise ValueError("episodes or samples is required")
    agent = DQNAgent.load(str(checkpoint), device=device)
    env = SixMaxBadugiEnv(seed=seed, opp_epsilon=0.0)
    env.set_agents(agent, agent)
    obs_dim = int(env.observation_space.shape[0])
    n_actions = int(env.action_space.n)
    if int(agent.obs_dim) != obs_dim or int(agent.n_actions) != n_actions:
        raise ValueError(
            f"checkpoint shape mismatch: checkpoint obs_dim={agent.obs_dim} n_actions={agent.n_actions}, "
            f"env obs_dim={obs_dim} n_actions={n_actions}"
        )
    if obs_dim != BADUGI_OBSERVATION_VECTOR_SIZE:
        raise ValueError(f"unexpected Badugi observation size: {obs_dim}")

    records: list[dict] = []
    aggression_records: list[dict] = []
    hands_seen = 0
    skipped = Counter()
    max_hands = int(episodes) if episodes is not None else max(int(samples or 0) * 50, int(samples or 0) + 50)
    target_samples = int(samples) if samples is not None else None
    device_t = torch.device(device)

    while hands_seen < max_hands and (target_samples is None or len(records) < target_samples):
        hands_seen += 1
        obs, _ = env.reset()
        if env.phase != "BET" or env.draw_round != 0:
            skipped["not_initial_predraw_bet"] += 1
            continue
        if not getattr(env, "bet_queue", None) or env.bet_queue[0] != env.hero_seat:
            skipped["hero_not_to_act"] += 1
            continue
        recorded_opening = False
        done = False
        steps_this_hand = 0
        while not done and steps_this_hand < 100:
            steps_this_hand += 1
            if env.phase == "BET":
                if not getattr(env, "bet_queue", None) or env.bet_queue[0] != env.hero_seat:
                    skipped["hero_not_to_act_midhand"] += 1
                    break
                action_mask = env.legal_action_mask()
                with torch.no_grad():
                    obs_t = torch.as_tensor(obs, dtype=torch.float32, device=device_t).reshape(1, -1)
                    q_values = agent.q_network(obs_t).detach().cpu().numpy()[0]
                action = legal_argmax(q_values, action_mask)
                aggression_record = make_decision_record(
                    env=env,
                    obs=obs,
                    q_values=q_values,
                    action_mask=action_mask,
                    action=action,
                    sample_index=len(aggression_records),
                )
                aggression_records.append(aggression_record)
                if not recorded_opening and int(env.draw_round) == 0:
                    opening_record = dict(aggression_record)
                    opening_record["sampleIndex"] = len(records)
                    opening_record["betDecisionIndex"] = int(aggression_record["sampleIndex"])
                    records.append(opening_record)
                    recorded_opening = True
                obs, _reward, terminated, truncated, _info = env.step(action)
                done = bool(terminated or truncated)
            elif env.phase == "DRAW":
                action_mask = env.legal_action_mask()
                with torch.no_grad():
                    obs_t = torch.as_tensor(obs, dtype=torch.float32, device=device_t).reshape(1, -1)
                    q_values = agent.q_network(obs_t).detach().cpu().numpy()[0]
                action = legal_argmax(q_values, action_mask)
                obs, _reward, terminated, truncated, _info = env.step(action)
                done = bool(terminated or truncated)
            else:
                skipped[f"unknown_phase_{env.phase}"] += 1
                break
        if steps_this_hand >= 100:
            skipped["hand_step_cap"] += 1

    summary = summarize_decisions(records)
    summary.update(summarize_aggression_decisions(aggression_records))
    report = {
        "schemaVersion": "badugi-sixmax-opening-range-audit-v2",
        "createdAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "checkpoint": str(checkpoint),
        "device": str(device),
        "seed": int(seed),
        "episodesRequested": episodes,
        "samplesRequested": samples,
        "handsSeen": int(hands_seen),
        "samplesCollected": len(records),
        "betRoundSamplesCollected": len(aggression_records),
        "skipped": dict(skipped),
        "model": {
            "obsDim": int(agent.obs_dim),
            "envObsDim": obs_dim,
            "hiddenDim": int(agent.q_network.net[0].out_features),
            "nActions": int(agent.n_actions),
        },
        "summary": summary,
        "warnings": build_warnings(summary),
        "findings": build_findings(records, aggression_records),
        "decisions": records,
        "betRoundDecisions": aggression_records,
    }
    return report


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", required=True, type=Path)
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
