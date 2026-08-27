"""Resumable clean-evaluation inventory for Badugi six-max checkpoints.

The report is atomically updated after the baseline and after every checkpoint,
so an interrupted Windows CPU run can continue without repeating completed work.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.training.evaluate_badugi_sixmax_clean import (
    DEFAULT_MAX_FALLBACK_RATE,
    DEFAULT_MIN_ONNX_USAGE_RATE,
    DEFAULT_PROFILES,
    checkpoint_episode,
    evaluate_checkpoint,
    list_checkpoint_candidates,
    parse_milestones,
    select_milestone_checkpoints,
)
from rl.training.gate_badugi_model import parse_csv, parse_seeds


DEFAULT_MILESTONES = tuple(range(10_000, 100_001, 10_000))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    try:
        temporary.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf8",
        )
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def _eval_args(args) -> SimpleNamespace:
    return SimpleNamespace(
        onnx_dir=Path(args.onnx_dir),
        device=args.device,
        episodes=args.episodes,
        max_steps=args.max_steps,
        seeds=args.seeds,
        opponent_profiles=args.opponent_profiles,
        allow_torch_fallback=False,
        min_onnx_usage_rate=args.min_onnx_usage_rate,
        max_fallback_rate=args.max_fallback_rate,
    )


def _off_summary(result: dict) -> dict:
    return result["cleanEval"]["proOverlayOff"]["summary"]


def _profile_reward(summary: dict, profile: str) -> float | None:
    row = summary.get("profileSummaries", {}).get(profile)
    return None if not row else float(row["avgReward"])


def compare_to_baseline(result: dict, baseline_result: dict, args) -> dict:
    candidate = _off_summary(result)
    baseline = _off_summary(baseline_result)
    profile = args.guard_profile
    profile_candidate = _profile_reward(candidate, profile)
    profile_baseline = _profile_reward(baseline, profile)
    profile_delta = (
        None
        if profile_candidate is None or profile_baseline is None
        else profile_candidate - profile_baseline
    )
    deltas = {
        "avgReward": float(candidate["avgReward"]) - float(baseline["avgReward"]),
        "worstProfileAvgReward": (
            float(candidate["worstProfileAvgReward"])
            - float(baseline["worstProfileAvgReward"])
        ),
        "guardProfile": profile_delta,
        "valueBetRate": float(candidate["valueBetRate"]) - float(baseline["valueBetRate"]),
    }
    checks = {
        "sourceHealth": bool(result["cleanEval"]["proOverlayOff"]["gate"]["passed"]),
        "avgRewardDelta": deltas["avgReward"] >= args.min_avg_delta,
        "worstProfileDelta": deltas["worstProfileAvgReward"] >= args.min_worst_delta,
        "guardProfileDelta": profile_delta is not None and profile_delta >= args.min_guard_profile_delta,
        "valueBetRateDelta": deltas["valueBetRate"] >= args.min_value_bet_delta,
    }
    return {
        "checkpoint": result["checkpoint"],
        "episode": result["episode"],
        "passedRegressionGate": all(checks.values()),
        "checks": checks,
        "deltas": deltas,
        "candidate": {
            "avgReward": candidate["avgReward"],
            "worstProfile": candidate["worstProfile"],
            "worstProfileAvgReward": candidate["worstProfileAvgReward"],
            "guardProfile": profile,
            "guardProfileAvgReward": profile_candidate,
            "valueBetRate": candidate["valueBetRate"],
            "foldRate": candidate["foldRate"],
            "showdownWinRate": candidate["showdownWinRate"],
        },
    }


def select_best(comparisons: list[dict]) -> dict | None:
    if not comparisons:
        return None
    eligible = [row for row in comparisons if row["passedRegressionGate"]]
    if not eligible:
        return None
    return max(
        eligible,
        key=lambda row: (
            row["candidate"]["worstProfileAvgReward"],
            row["candidate"]["avgReward"],
            row["candidate"]["valueBetRate"],
        ),
    )


def select_best_observed(comparisons: list[dict]) -> dict | None:
    if not comparisons:
        return None
    return max(
        comparisons,
        key=lambda row: (
            row["candidate"]["worstProfileAvgReward"],
            row["candidate"]["avgReward"],
            row["candidate"]["valueBetRate"],
        ),
    )


def _new_report(args, missing: list[dict]) -> dict:
    return {
        "schemaVersion": "badugi-sixmax-checkpoint-inventory-v1",
        "startedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "updatedAt": None,
        "status": "running",
        "config": {
            "checkpointDir": str(Path(args.checkpoint_dir)),
            "baseline": str(Path(args.baseline)),
            "milestones": args.milestones,
            "episodesPerSeedProfile": args.episodes,
            "maxSteps": args.max_steps,
            "seeds": args.seeds,
            "opponentProfiles": args.opponent_profiles,
            "selectionPolicy": (
                "pass all regression checks, then maximize worst-profile reward, "
                "average reward, and value-bet rate"
            ),
            "thresholds": {
                "minAvgDelta": args.min_avg_delta,
                "minWorstDelta": args.min_worst_delta,
                "guardProfile": args.guard_profile,
                "minGuardProfileDelta": args.min_guard_profile_delta,
                "minValueBetDelta": args.min_value_bet_delta,
            },
        },
        "missingMilestones": missing,
        "baseline": None,
        "results": [],
        "comparisons": [],
        "bestCheckpoint": None,
        "bestObservedCheckpoint": None,
        "recommendedAction": None,
    }


def compact_summary(report: dict) -> dict:
    baseline_result = (report.get("baseline") or {}).get("result")
    baseline_summary = _off_summary(baseline_result) if baseline_result else None
    return {
        "schemaVersion": "badugi-sixmax-checkpoint-inventory-summary-v1",
        "updatedAt": report.get("updatedAt"),
        "status": report.get("status"),
        "config": report.get("config"),
        "missingMilestones": report.get("missingMilestones", []),
        "baseline": {
            "checkpoint": baseline_result.get("checkpoint") if baseline_result else None,
            "sha256": (report.get("baseline") or {}).get("sha256"),
            "summary": baseline_summary,
        },
        "comparisons": report.get("comparisons", []),
        "bestCheckpoint": report.get("bestCheckpoint"),
        "bestObservedCheckpoint": report.get("bestObservedCheckpoint"),
        "recommendedAction": report.get("recommendedAction"),
    }


def run_inventory(args) -> dict:
    checkpoint_dir = Path(args.checkpoint_dir)
    baseline_path = Path(args.baseline)
    report_path = Path(args.report)
    if not baseline_path.exists():
        raise FileNotFoundError(f"baseline checkpoint not found: {baseline_path}")
    candidates = list_checkpoint_candidates(checkpoint_dir, parse_csv(args.patterns))
    selected, missing = select_milestone_checkpoints(candidates, args.milestones)
    if not selected:
        raise FileNotFoundError(f"no milestone checkpoints found under {checkpoint_dir}")

    report = _new_report(args, missing)
    if report_path.exists() and not args.force:
        existing = json.loads(report_path.read_text(encoding="utf8"))
        if existing.get("schemaVersion") == report["schemaVersion"] and existing.get("config") == report["config"]:
            report = existing
            report["status"] = "running"

    eval_args = _eval_args(args)
    baseline_sha = sha256_file(baseline_path)
    if (report.get("baseline") or {}).get("sha256") != baseline_sha:
        baseline_result = evaluate_checkpoint(
            checkpoint=baseline_path,
            milestone=checkpoint_episode(baseline_path),
            episode=checkpoint_episode(baseline_path),
            exact=True,
            args=eval_args,
        )
        report["baseline"] = {"sha256": baseline_sha, "result": baseline_result}
        report["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        atomic_write_json(report_path, report)
    baseline_result = report["baseline"]["result"]

    completed = {
        (row["checkpoint"], row["sha256"]): row
        for row in report.get("results", [])
    }
    for item in selected:
        checkpoint = item["checkpoint"]
        checksum = sha256_file(checkpoint)
        key = (str(checkpoint), checksum)
        if key in completed:
            continue
        result = evaluate_checkpoint(
            checkpoint=checkpoint,
            milestone=item["milestone"],
            episode=item["episode"],
            exact=item["exact"],
            args=eval_args,
        )
        report.setdefault("results", []).append(
            {"checkpoint": str(checkpoint), "sha256": checksum, "result": result}
        )
        report["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        atomic_write_json(report_path, report)

    report["results"] = sorted(
        report["results"],
        key=lambda row: (checkpoint_episode(Path(row["checkpoint"])) or -1, row["checkpoint"]),
    )
    comparisons = [
        compare_to_baseline(row["result"], baseline_result, args)
        for row in report["results"]
    ]
    best = select_best(comparisons)
    best_observed = select_best_observed(comparisons)
    report["comparisons"] = comparisons
    report["bestCheckpoint"] = best
    report["bestObservedCheckpoint"] = best_observed
    report["recommendedAction"] = "promote-checkpoint-for-confirmation" if best else "retain-baseline"
    report["status"] = "complete" if not missing else "complete-with-missing"
    report["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    atomic_write_json(report_path, report)
    summary_path = report_path.with_name(f"{report_path.stem}-summary.json")
    atomic_write_json(summary_path, compact_summary(report))
    return report


def parse_args(argv: list[str] | None = None):
    parser = argparse.ArgumentParser(description="Resume-safe Badugi six-max checkpoint inventory.")
    parser.add_argument("--checkpoint-dir", required=True)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--patterns", default="badugi_sixmax_dqn_*.pt")
    parser.add_argument(
        "--milestones",
        type=parse_milestones,
        default=list(DEFAULT_MILESTONES),
    )
    parser.add_argument("--episodes", type=int, default=120)
    parser.add_argument("--max-steps", type=int, default=120)
    parser.add_argument("--seeds", type=parse_seeds, default=parse_seeds("20260602,20260603"))
    parser.add_argument("--opponent-profiles", type=parse_csv, default=list(DEFAULT_PROFILES))
    parser.add_argument("--onnx-dir", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--min-onnx-usage-rate", type=float, default=DEFAULT_MIN_ONNX_USAGE_RATE)
    parser.add_argument("--max-fallback-rate", type=float, default=DEFAULT_MAX_FALLBACK_RATE)
    parser.add_argument("--min-avg-delta", type=float, default=0.0)
    parser.add_argument("--min-worst-delta", type=float, default=-0.02)
    parser.add_argument("--guard-profile", default="loose_aggressive")
    parser.add_argument("--min-guard-profile-delta", type=float, default=-0.02)
    parser.add_argument("--min-value-bet-delta", type=float, default=-0.05)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    report = run_inventory(args)
    best = report["bestCheckpoint"]
    if best:
        print(
            "[BADUGI INVENTORY BEST] "
            f"checkpoint={Path(best['checkpoint']).name} "
            f"episode={best['episode']} "
            f"avg={best['candidate']['avgReward']:.6f} "
            f"worst={best['candidate']['worstProfileAvgReward']:.6f}"
        )
    else:
        observed = report.get("bestObservedCheckpoint")
        observed_label = Path(observed["checkpoint"]).name if observed else "none"
        print(f"[BADUGI INVENTORY BEST] none passed; retain baseline (best observed={observed_label})")
    print(f"[BADUGI INVENTORY REPORT] {args.report}")
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
