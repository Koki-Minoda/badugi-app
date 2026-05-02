"""Human/practice benchmark gate for Badugi ONNX policies.

This benchmark is intentionally separate from the synthetic promotion gate.
Practice profiles are still scripted approximations, while optional human logs
are the only path to claiming human-verified strength.
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

from rl.training.evaluate_badugi_onnx import evaluate_model
from rl.training.gate_badugi_model import parse_seeds, summarize_runs


DEFAULT_MODEL = PROJECT_ROOT / "public/models/badugi_pro_v1.onnx"
DEFAULT_REPORT = PROJECT_ROOT / "rl/evaluations/badugi_human_practice_benchmark.json"

HUMAN_PRACTICE_PROFILES = {
    "recreational": ["loose_passive", "draw_heavy"],
    "solid_regular": ["balanced", "tight_passive"],
    "aggressive_regular": ["loose_aggressive", "tight_aggressive"],
    "pat_pressure": ["pat_heavy", "balanced"],
}

TIER_THRESHOLDS = {
    "pro": {
        "minAvgReward": 1.0,
        "minShowdownWinRate": 0.60,
        "maxFoldRate": 0.22,
        "minWorstProfileAvgReward": 0.50,
    },
    "iron": {
        "minAvgReward": 1.4,
        "minShowdownWinRate": 0.64,
        "maxFoldRate": 0.18,
        "minWorstProfileAvgReward": 0.85,
    },
    "worldmaster": {
        "minAvgReward": 1.8,
        "minShowdownWinRate": 0.68,
        "maxFoldRate": 0.16,
        "minWorstProfileAvgReward": 1.15,
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
    if isinstance(payload, dict) and isinstance(payload.get("hands"), list):
        return [record for record in payload["hands"] if isinstance(record, dict)]
    if isinstance(payload, dict) and isinstance(payload.get("records"), list):
        return [record for record in payload["records"] if isinstance(record, dict)]
    return [payload] if isinstance(payload, dict) else []


def record_result(record: dict[str, Any]) -> str | None:
    sources = [record]
    if isinstance(record.get("humanBenchmark"), dict):
        sources.insert(0, record["humanBenchmark"])
    if isinstance(record.get("human_benchmark"), dict):
        sources.insert(0, record["human_benchmark"])
    for source in sources:
        for key in ("heroResult", "result", "outcome"):
            value = str(source.get(key, "")).lower()
            if value in {"win", "won", "1"}:
                return "win"
            if value in {"loss", "lost", "-1"}:
                return "loss"
            if value in {"tie", "push", "0"}:
                return "tie"
        if "heroNet" in source:
            try:
                net = float(source["heroNet"])
            except (TypeError, ValueError):
                continue
            if net > 0:
                return "win"
            if net < 0:
                return "loss"
            return "tie"
    return None


def summarize_human_logs(path: Path | None, min_hands: int) -> dict[str, Any]:
    if path is None:
        return {
            "path": None,
            "hands": 0,
            "wins": 0,
            "losses": 0,
            "ties": 0,
            "winRate": 0.0,
            "verified": False,
        }
    records = iter_json_records(path)
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
        "hands": len(records),
        "decidedHands": decided,
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "winRate": wins / decided if decided else 0.0,
        "verified": len(records) >= min_hands and decided >= min_hands,
    }


def run_practice_profiles(args) -> dict[str, Any]:
    runs = []
    profile_runs: dict[str, list[dict[str, Any]]] = {}
    for human_profile, opponent_profiles in HUMAN_PRACTICE_PROFILES.items():
        profile_runs[human_profile] = []
        for seed in args.seeds:
            for opponent_profile in opponent_profiles:
                run = evaluate_model(
                    model=Path(args.model),
                    episodes=args.episodes,
                    max_steps=args.max_steps,
                    epsilon=0.0,
                    seed=seed,
                    opponent_profile=opponent_profile,
                    table_size=args.table_size,
                    feature_set=args.feature_set,
                )
                run["humanPracticeProfile"] = human_profile
                runs.append(run)
                profile_runs[human_profile].append(run)
    return {
        "summary": summarize_runs(runs),
        "profileSummaries": {
            profile: summarize_runs(profile_profile_runs)
            for profile, profile_profile_runs in profile_runs.items()
        },
        "runs": runs,
    }


def build_report(args) -> dict[str, Any]:
    threshold = TIER_THRESHOLDS[args.tier]
    practice = run_practice_profiles(args)
    summary = practice["summary"]
    human_logs = summarize_human_logs(Path(args.human_log) if args.human_log else None, args.min_human_log_hands)
    checks = {
        "avgReward": summary["avgReward"] >= threshold["minAvgReward"],
        "showdownWinRate": summary["showdownWinRate"] >= threshold["minShowdownWinRate"],
        "foldRate": summary["foldRate"] <= threshold["maxFoldRate"],
        "worstProfileAvgReward": summary["worstProfileAvgReward"] >= threshold["minWorstProfileAvgReward"],
        "humanLogs": (not args.require_human_logs) or human_logs["verified"],
    }
    return {
        "model": args.model,
        "tier": args.tier,
        "practiceOnly": not human_logs["verified"],
        "humanVerified": human_logs["verified"],
        "passed": all(checks.values()),
        "checks": checks,
        "thresholds": threshold | {"minHumanLogHands": args.min_human_log_hands},
        "practice": practice,
        "humanLogs": human_logs,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Benchmark Badugi ONNX against human-like practice profiles.")
    parser.add_argument("--model", default=str(DEFAULT_MODEL))
    parser.add_argument("--tier", choices=sorted(TIER_THRESHOLDS), default="pro")
    parser.add_argument("--episodes", type=int, default=200)
    parser.add_argument("--max-steps", type=int, default=200)
    parser.add_argument("--table-size", type=int, default=6)
    parser.add_argument(
        "--feature-set",
        default="badugi-observation-v1-ev-range",
        choices=["badugi-observation-v1", "badugi-observation-v1-ev", "badugi-observation-v1-ev-range"],
    )
    parser.add_argument("--seeds", type=parse_seeds, default=parse_seeds("20260502,20260503"))
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
        summary = report["practice"]["summary"]
        print(
            "[BADUGI HUMAN PRACTICE] "
            f"status={'PASS' if report['passed'] else 'FAIL'} "
            f"tier={report['tier']} "
            f"practiceOnly={report['practiceOnly']} "
            f"humanVerified={report['humanVerified']} "
            f"avgReward={summary['avgReward']:.3f} "
            f"showdownWinRate={summary['showdownWinRate']:.3f} "
            f"foldRate={summary['foldRate']:.3f} "
            f"worstProfile={summary['worstProfile']} "
            f"worstProfileAvgReward={summary['worstProfileAvgReward']:.3f}"
        )
        print(f"[BADUGI HUMAN PRACTICE CHECKS] {report['checks']}")
        print(f"[BADUGI HUMAN PRACTICE REPORT] {report_path}")
    if not report["passed"] and not args.report_only:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
