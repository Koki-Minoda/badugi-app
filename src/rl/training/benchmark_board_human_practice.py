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
        "minHumanLogHands": 30,
    },
    "standard": {
        "minAdvancedPassRate": 0.75,
        "minAvgEVDelta": -0.08,
        "minHumanLogHands": 50,
    },
    "pro": {
        "minAdvancedPassRate": 0.88,
        "minAvgEVDelta": -0.04,
        "minHumanLogHands": 100,
    },
}


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
        for key in ("heroNet", "net", "profit"):
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
            "verified": False,
        }
    records = [
        record
        for record in iter_json_records(path)
        if record_variant_id(record) in {None, variant_id}
    ]
    wins = losses = ties = 0
    for record in records:
        result = record_result(record)
        if result == "win":
            wins += 1
        elif result == "loss":
            losses += 1
        elif result == "tie":
            ties += 1
    decided = wins + losses + ties
    return {
        "path": str(path),
        "variantId": variant_id,
        "hands": len(records),
        "decidedHands": decided,
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "winRate": wins / decided if decided else 0.0,
        "verified": len(records) >= min_hands and decided >= min_hands,
    }


def build_report(args) -> dict[str, Any]:
    from rl.training.evaluate_board_onnx import evaluate

    thresholds = TIER_THRESHOLDS[args.tier]
    practice = evaluate(Path(args.model), args.variant_id, advanced_gate=True)
    summary = practice["summary"]
    pass_rate = summary["passCount"] / summary["fixtureCount"] if summary["fixtureCount"] else 0.0
    human_logs = summarize_human_logs(
        Path(args.human_log) if args.human_log else None,
        args.variant_id,
        args.min_human_log_hands,
    )
    checks = {
        "advancedPassRate": pass_rate >= thresholds["minAdvancedPassRate"],
        "avgEVDelta": summary["avgEVDelta"] >= thresholds["minAvgEVDelta"],
        "humanLogs": (not args.require_human_logs) or human_logs["verified"],
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
        "humanLogs": human_logs,
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
