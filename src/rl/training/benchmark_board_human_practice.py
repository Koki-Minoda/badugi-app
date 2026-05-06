"""Human/practice benchmark gate for board-game ONNX policies.

This is intentionally stricter than the base fixture smoke. It separates
practice-only synthetic checks from human-log verification, so NLH/FLH/PLO/PLO8
models are not promoted on fixture pass alone.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))


DEFAULT_REPORT = PROJECT_ROOT / "rl/evaluations/board_human_practice_benchmark.json"

TIER_THRESHOLDS = {
    "beginner": {
        "minAdvancedPassRate": 0.60,
        "minAvgEVDelta": -0.12,
        "minHumanAvgEV": -80.0,
        "minWorstPositionAvgEV": -140.0,
        "minShowdownAvgEV": -120.0,
        "minAllInAvgEV": -180.0,
        "minSplitPotAvgEV": -180.0,
        "minHumanLogHands": 30,
        "minPositionBuckets": 3,
        "minShowdownHands": 3,
        "minAllInHands": 0,
        "minSplitPotHands": 0,
    },
    "standard": {
        "minAdvancedPassRate": 0.75,
        "minAvgEVDelta": -0.08,
        "minHumanAvgEV": -45.0,
        "minWorstPositionAvgEV": -90.0,
        "minShowdownAvgEV": -80.0,
        "minAllInAvgEV": -120.0,
        "minSplitPotAvgEV": -120.0,
        "minHumanLogHands": 50,
        "minPositionBuckets": 4,
        "minShowdownHands": 5,
        "minAllInHands": 1,
        "minSplitPotHands": 0,
    },
    "pro": {
        "minAdvancedPassRate": 0.88,
        "minAvgEVDelta": -0.04,
        "minHumanAvgEV": -20.0,
        "minWorstPositionAvgEV": -45.0,
        "minShowdownAvgEV": -35.0,
        "minAllInAvgEV": -60.0,
        "minSplitPotAvgEV": -60.0,
        "minHumanLogHands": 100,
        "minPositionBuckets": 5,
        "minShowdownHands": 10,
        "minAllInHands": 3,
        "minSplitPotHands": 0,
    },
}

VARIANT_GATE_OVERRIDES = {
    "B05": {
        "standard": {"minAllInHands": 2},
        "pro": {"minAllInHands": 5},
    },
    "B06": {
        "standard": {"minAllInHands": 2, "minSplitPotHands": 1},
        "pro": {"minAllInHands": 5, "minSplitPotHands": 3},
    },
}

BOARD_VARIANT_ALIASES = {
    "B01": {"B01", "nlh", "no_limit_holdem", "nl_holdem"},
    "B02": {"B02", "flh", "fixed_limit_holdem", "limit_holdem"},
    "B05": {"B05", "plo", "pot_limit_omaha"},
    "B06": {"B06", "plo8", "omaha_hi_lo", "pot_limit_omaha_hi_lo"},
}
POSITION_ORDER = ("UTG", "MP", "CO", "BTN", "SB", "BB")


def iter_json_records(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"human log path not found: {path}")
    text = path.read_text(encoding="utf8").strip()
    if not text:
        return []
    if path.suffix.lower() == ".jsonl":
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    payload = json.loads(text)
    if isinstance(payload, list):
        return [record for record in payload if isinstance(record, dict)]
    for key in ("hands", "records", "history"):
        if isinstance(payload, dict) and isinstance(payload.get(key), list):
            return [record for record in payload[key] if isinstance(record, dict)]
    return [payload] if isinstance(payload, dict) else []


def record_variant_id(record: dict[str, Any]) -> str | None:
    sources = [record]
    for key in ("humanBenchmark", "human_benchmark", "feedbackContext"):
        if isinstance(record.get(key), dict):
            sources.insert(0, record[key])
    for source in sources:
        value = source.get("variantId") or source.get("variant_id") or source.get("gameVariant")
        if value:
            return str(value)
    return None


def normalized_variant_matches(record_variant: str | None, target_variant_id: str) -> bool:
    if record_variant is None:
        return False
    aliases = {value.lower() for value in BOARD_VARIANT_ALIASES.get(target_variant_id, {target_variant_id})}
    return str(record_variant).lower() in aliases


def record_result(record: dict[str, Any]) -> str | None:
    sources = [record]
    for key in ("humanBenchmark", "human_benchmark", "result", "summary"):
        if isinstance(record.get(key), dict):
            sources.insert(0, record[key])
    for source in sources:
        for key in ("heroResult", "result", "outcome"):
            value = str(source.get(key, "")).lower()
            if value in {"win", "won", "1"}:
                return "win"
            if value in {"loss", "lost", "-1"}:
                return "loss"
            if value in {"tie", "push", "0"}:
                return "tie"
        for key in ("heroNet", "hero_net", "net", "profit", "chipDelta", "resultDelta"):
            if key not in source:
                continue
            try:
                net = float(source[key])
            except (TypeError, ValueError):
                continue
            if net > 0:
                return "win"
            if net < 0:
                return "loss"
            return "tie"
    return None


def _nested_sources(record: dict[str, Any]) -> list[dict[str, Any]]:
    sources = [record]
    for key in (
        "humanBenchmark",
        "human_benchmark",
        "feedbackContext",
        "summary",
        "result",
        "metadata",
    ):
        if isinstance(record.get(key), dict):
            sources.insert(0, record[key])
    return sources


def record_hero_net(record: dict[str, Any]) -> float | None:
    for source in _nested_sources(record):
        for key in ("heroNet", "hero_net", "net", "profit", "chipDelta", "resultDelta"):
            if key not in source:
                continue
            try:
                return float(source[key])
            except (TypeError, ValueError):
                continue
    seats = record.get("seats") if isinstance(record.get("seats"), list) else []
    for seat in seats:
        if not isinstance(seat, dict):
            continue
        is_hero = seat.get("isHero") is True or seat.get("hero") is True or seat.get("seat") == 0
        if not is_hero:
            continue
        try:
            start_stack = float(seat.get("startStack") or seat.get("initialStack"))
            end_stack = float(seat.get("endStack") or seat.get("stack"))
            return end_stack - start_stack
        except (TypeError, ValueError):
            return None
    return None


def record_position(record: dict[str, Any]) -> str | None:
    for source in _nested_sources(record):
        value = source.get("heroPosition") or source.get("position") or source.get("pos")
        if value:
            return str(value).upper()
    seats = record.get("seats") if isinstance(record.get("seats"), list) else []
    for seat in seats:
        if not isinstance(seat, dict):
            continue
        is_hero = seat.get("isHero") is True or seat.get("hero") is True or seat.get("seat") == 0
        if not is_hero:
            continue
        value = seat.get("position") or seat.get("pos")
        if value:
            return str(value).upper()
        actions = seat.get("actions") if isinstance(seat.get("actions"), list) else []
        for action in actions:
            if isinstance(action, dict) and (action.get("position") or action.get("pos")):
                return str(action.get("position") or action.get("pos")).upper()
    return None


def record_showdown(record: dict[str, Any]) -> bool:
    for source in _nested_sources(record):
        if source.get("showdown") is True or source.get("wentToShowdown") is True:
            return True
    events = record.get("events") if isinstance(record.get("events"), list) else []
    if any(isinstance(event, dict) and str(event.get("type", "")).upper() == "SHOWDOWN" for event in events):
        return True
    seats = record.get("seats") if isinstance(record.get("seats"), list) else []
    return any(
        isinstance(seat, dict)
        and (seat.get("handLabel") or seat.get("evaluation") or seat.get("finalLowRanks"))
        for seat in seats
    )


def record_all_in(record: dict[str, Any]) -> bool:
    for source in _nested_sources(record):
        if source.get("allIn") is True or source.get("isAllIn") is True:
            return True
    seats = record.get("seats") if isinstance(record.get("seats"), list) else []
    actions = []
    for seat in seats:
        if isinstance(seat, dict):
            actions.extend(seat.get("actions") if isinstance(seat.get("actions"), list) else [])
            if seat.get("allIn") is True or seat.get("isAllIn") is True:
                return True
    return any(
        isinstance(action, dict)
        and str(action.get("type") or action.get("action") or "").lower() in {"all-in", "allin"}
        for action in actions
    )


def record_split_pot(record: dict[str, Any]) -> bool:
    pots = record.get("pots") if isinstance(record.get("pots"), list) else []
    for pot in pots:
        winners = pot.get("winners") if isinstance(pot, dict) and isinstance(pot.get("winners"), list) else []
        payouts = pot.get("payouts") if isinstance(pot, dict) and isinstance(pot.get("payouts"), list) else []
        if len(winners or payouts) > 1:
            return True
    return False


def resolved_thresholds(variant_id: str, tier: str) -> dict[str, float | int]:
    thresholds = dict(TIER_THRESHOLDS[tier])
    thresholds.update(VARIANT_GATE_OVERRIDES.get(variant_id, {}).get(tier, {}))
    return thresholds


def record_vpip_pfr(record: dict[str, Any]) -> tuple[bool, bool]:
    seats = record.get("seats") if isinstance(record.get("seats"), list) else []
    hero_actions: list[dict[str, Any]] = []
    for seat in seats:
        if not isinstance(seat, dict):
            continue
        is_hero = seat.get("isHero") is True or seat.get("hero") is True or seat.get("seat") == 0
        if is_hero and isinstance(seat.get("actions"), list):
            hero_actions.extend(action for action in seat["actions"] if isinstance(action, dict))
    vpip = False
    pfr = False
    for action in hero_actions:
        action_type = str(action.get("type") or action.get("action") or "").lower()
        if action_type in {"call", "bet", "raise", "all-in", "allin"}:
            vpip = True
        street = str(action.get("street") or action.get("phase") or "").upper()
        if action_type in {"bet", "raise", "all-in", "allin"} and street in {"", "BET", "PREFLOP"}:
            pfr = True
    return vpip, pfr


def summarize_human_logs(path: Path | None, variant_id: str, min_hands: int) -> dict[str, Any]:
    if path is None:
        return {
            "path": None,
            "variantId": variant_id,
            "hands": 0,
            "decidedHands": 0,
            "wins": 0,
            "losses": 0,
            "ties": 0,
            "winRate": 0.0,
            "netChips": 0.0,
            "avgEV": 0.0,
            "evSamples": 0,
            "showdownHands": 0,
            "showdownRate": 0.0,
            "allInHands": 0,
            "splitPotHands": 0,
            "vpip": 0.0,
            "pfr": 0.0,
            "positions": {},
            "coveredPositions": [],
            "positionCoverage": 0,
            "verified": False,
        }
    records = [
        record
        for record in iter_json_records(path)
        if normalized_variant_matches(record_variant_id(record), variant_id)
    ]
    wins = losses = ties = 0
    net_values: list[float] = []
    showdown_net_values: list[float] = []
    all_in_net_values: list[float] = []
    split_pot_net_values: list[float] = []
    showdown_hands = 0
    all_in_hands = 0
    split_pot_hands = 0
    vpip_hands = 0
    pfr_hands = 0
    positions: dict[str, dict[str, Any]] = {}
    for record in records:
        result = record_result(record)
        if result == "win":
            wins += 1
        elif result == "loss":
            losses += 1
        elif result == "tie":
            ties += 1
        hero_net = record_hero_net(record)
        if hero_net is not None:
            net_values.append(hero_net)
        showdown = record_showdown(record)
        all_in = record_all_in(record)
        split_pot = record_split_pot(record)
        if showdown:
            showdown_hands += 1
            if hero_net is not None:
                showdown_net_values.append(hero_net)
        if all_in:
            all_in_hands += 1
            if hero_net is not None:
                all_in_net_values.append(hero_net)
        if split_pot:
            split_pot_hands += 1
            if hero_net is not None:
                split_pot_net_values.append(hero_net)
        vpip, pfr = record_vpip_pfr(record)
        if vpip:
            vpip_hands += 1
        if pfr:
            pfr_hands += 1
        position = record_position(record) or "UNKNOWN"
        bucket = positions.setdefault(
            position,
            {"hands": 0, "net": 0.0, "showdowns": 0, "vpipHands": 0, "pfrHands": 0},
        )
        bucket["hands"] += 1
        bucket["net"] += hero_net or 0.0
        bucket["showdowns"] += 1 if showdown else 0
        bucket["vpipHands"] += 1 if vpip else 0
        bucket["pfrHands"] += 1 if pfr else 0
    decided = wins + losses + ties
    position_summary = {}
    for position, bucket in positions.items():
        hands = bucket["hands"]
        position_summary[position] = {
            **bucket,
            "avgEV": bucket["net"] / hands if hands else 0.0,
            "showdownRate": bucket["showdowns"] / hands if hands else 0.0,
            "vpip": bucket["vpipHands"] / hands if hands else 0.0,
            "pfr": bucket["pfrHands"] / hands if hands else 0.0,
        }
    covered_positions = [
        position
        for position in POSITION_ORDER
        if position_summary.get(position, {}).get("hands", 0) > 0
    ]
    avg_ev = sum(net_values) / len(net_values) if net_values else 0.0
    covered_position_evs = [
        position_summary[position]["avgEV"]
        for position in covered_positions
        if position in position_summary
    ]
    return {
        "path": str(path),
        "variantId": variant_id,
        "hands": len(records),
        "decidedHands": decided,
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "winRate": wins / decided if decided else 0.0,
        "netChips": sum(net_values),
        "avgEV": avg_ev,
        "evSamples": len(net_values),
        "worstPositionAvgEV": min(covered_position_evs) if covered_position_evs else 0.0,
        "showdownHands": showdown_hands,
        "showdownRate": showdown_hands / len(records) if records else 0.0,
        "showdownAvgEV": sum(showdown_net_values) / len(showdown_net_values)
        if showdown_net_values
        else 0.0,
        "showdownEVSamples": len(showdown_net_values),
        "allInHands": all_in_hands,
        "allInAvgEV": sum(all_in_net_values) / len(all_in_net_values) if all_in_net_values else 0.0,
        "allInEVSamples": len(all_in_net_values),
        "splitPotHands": split_pot_hands,
        "splitPotAvgEV": sum(split_pot_net_values) / len(split_pot_net_values)
        if split_pot_net_values
        else 0.0,
        "splitPotEVSamples": len(split_pot_net_values),
        "vpip": vpip_hands / len(records) if records else 0.0,
        "pfr": pfr_hands / len(records) if records else 0.0,
        "positions": position_summary,
        "coveredPositions": covered_positions,
        "positionCoverage": len(covered_positions),
        "verified": len(records) >= min_hands and decided >= min_hands and len(net_values) >= min_hands,
    }


def build_report(args) -> dict[str, Any]:
    from rl.training.evaluate_board_onnx import evaluate

    thresholds = resolved_thresholds(args.variant_id, args.tier)
    practice = evaluate(Path(args.model), args.variant_id, advanced_gate=True)
    summary = practice["summary"]
    pass_rate = summary["passCount"] / summary["fixtureCount"] if summary["fixtureCount"] else 0.0
    human_logs = summarize_human_logs(
        Path(args.human_log) if args.human_log else None,
        args.variant_id,
        args.min_human_log_hands,
    )
    human_quality_checks = {
        "avgEV": human_logs["avgEV"] >= thresholds["minHumanAvgEV"],
        "worstPositionAvgEV": human_logs["worstPositionAvgEV"] >= thresholds["minWorstPositionAvgEV"],
        "positionCoverage": human_logs["positionCoverage"] >= thresholds["minPositionBuckets"],
        "showdownCoverage": human_logs["showdownHands"] >= thresholds["minShowdownHands"],
        "showdownEV": human_logs["showdownAvgEV"] >= thresholds["minShowdownAvgEV"],
        "allInCoverage": human_logs["allInHands"] >= thresholds["minAllInHands"],
        "allInEV": (
            thresholds["minAllInHands"] <= 0
            or human_logs["allInEVSamples"] >= thresholds["minAllInHands"]
        )
        and human_logs["allInAvgEV"] >= thresholds["minAllInAvgEV"],
        "splitPotCoverage": human_logs["splitPotHands"] >= thresholds["minSplitPotHands"],
        "splitPotEV": (
            thresholds["minSplitPotHands"] <= 0
            or human_logs["splitPotEVSamples"] >= thresholds["minSplitPotHands"]
        )
        and human_logs["splitPotAvgEV"] >= thresholds["minSplitPotAvgEV"],
    }
    checks = {
        "advancedPassRate": pass_rate >= thresholds["minAdvancedPassRate"],
        "avgEVDelta": summary["avgEVDelta"] >= thresholds["minAvgEVDelta"],
        "humanLogs": (not args.require_human_logs) or human_logs["verified"],
        "humanLogEV": (not args.require_human_logs) or human_quality_checks["avgEV"],
        "humanLogWorstPositionEV": (not args.require_human_logs) or human_quality_checks["worstPositionAvgEV"],
        "humanLogPositionCoverage": (not args.require_human_logs) or human_quality_checks["positionCoverage"],
        "humanLogShowdownCoverage": (not args.require_human_logs) or human_quality_checks["showdownCoverage"],
        "humanLogShowdownEV": (not args.require_human_logs) or human_quality_checks["showdownEV"],
        "humanLogAllInCoverage": (not args.require_human_logs) or human_quality_checks["allInCoverage"],
        "humanLogAllInEV": (not args.require_human_logs) or human_quality_checks["allInEV"],
        "humanLogSplitPotCoverage": (not args.require_human_logs) or human_quality_checks["splitPotCoverage"],
        "humanLogSplitPotEV": (not args.require_human_logs) or human_quality_checks["splitPotEV"],
    }
    return {
        "model": args.model,
        "variantId": args.variant_id,
        "tier": args.tier,
        "practiceOnly": not human_logs["verified"],
        "humanVerified": human_logs["verified"],
        "passed": all(checks.values()),
        "checks": checks,
        "thresholds": thresholds | {"minHumanLogHands": args.min_human_log_hands},
        "practice": practice,
        "humanLogs": human_logs | {"qualityChecks": human_quality_checks},
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Benchmark board ONNX against practice fixtures and optional human logs.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--variant-id", choices=["B01", "B02", "B05", "B06"], required=True)
    parser.add_argument("--tier", choices=sorted(TIER_THRESHOLDS), default="standard")
    parser.add_argument("--human-log", default=None)
    parser.add_argument("--min-human-log-hands", type=int, default=50)
    parser.add_argument("--require-human-logs", action="store_true")
    parser.add_argument("--report", default=str(DEFAULT_REPORT))
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    report = build_report(args)
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        status = "PASS" if report["passed"] else "FAIL"
        practice = report["practice"]["summary"]
        print(
            f"[BOARD HUMAN/PRACTICE] {status} variant={args.variant_id} tier={args.tier} "
            f"advancedPass={practice['passCount']}/{practice['fixtureCount']} "
            f"avgEVDelta={practice['avgEVDelta']:.3f} "
            f"humanVerified={report['humanVerified']}"
        )
        print(f"report: {report_path}")
    if not report["passed"] and not args.report_only:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
