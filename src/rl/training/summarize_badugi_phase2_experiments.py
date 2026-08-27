"""Aggregate Phase 2 Badugi experiment screens and enforce extension stops."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path


EXPECTED_RUNS = (
    "e0_control_10k",
    "e1_profile_diversity_10k",
    "e2_low_lr_10k",
    "e3_low_epsilon_10k",
)


def atomic_write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    try:
        temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf8")
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def stop_reasons(comparison: dict) -> list[str]:
    deltas = comparison["deltas"]
    thresholds = {
        "AVG_DELTA_BELOW_-0.03": ("avgReward", -0.03),
        "WORST_DELTA_BELOW_-0.05": ("worstProfileAvgReward", -0.05),
        "LOOSE_AGGRESSIVE_DELTA_BELOW_-0.05": ("guardProfile", -0.05),
        "VALUE_BET_DELTA_BELOW_-0.10": ("valueBetRate", -0.10),
    }
    return [reason for reason, (key, floor) in thresholds.items() if float(deltas[key]) < floor]


def load_run(run_dir: Path) -> dict:
    status_path = run_dir / "phase2-status.json"
    screen_path = run_dir / "screen-inventory-summary.json"
    manifest_path = run_dir / "badugi_sixmax_run_manifest.json"
    if not status_path.exists() or not screen_path.exists() or not manifest_path.exists():
        return {"run": run_dir.name, "complete": False, "missing": [
            str(path) for path in (status_path, screen_path, manifest_path) if not path.exists()
        ]}
    status = json.loads(status_path.read_text(encoding="utf-8-sig"))
    screen = json.loads(screen_path.read_text(encoding="utf-8-sig"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    comparisons = screen.get("comparisons", [])
    if status.get("stage") != "complete" or len(comparisons) != 1:
        return {
            "run": run_dir.name,
            "complete": False,
            "stage": status.get("stage"),
            "comparisonCount": len(comparisons),
        }
    comparison = comparisons[0]
    stops = stop_reasons(comparison)
    return {
        "run": run_dir.name,
        "complete": True,
        "checkpoint": comparison["checkpoint"],
        "manifest": str(manifest_path),
        "config": manifest["config"],
        "passedRegressionGate": bool(comparison["passedRegressionGate"]),
        "stopTriggered": bool(stops),
        "stopReasons": stops,
        "extensionEligible": bool(comparison["passedRegressionGate"]) and not stops,
        "checks": comparison["checks"],
        "deltas": comparison["deltas"],
        "candidate": comparison["candidate"],
    }


def choose_winner(runs: list[dict]) -> dict | None:
    eligible = [run for run in runs if run.get("extensionEligible")]
    if not eligible:
        return None
    return max(
        eligible,
        key=lambda run: (
            run["candidate"]["worstProfileAvgReward"],
            run["candidate"]["avgReward"],
            run["candidate"]["valueBetRate"],
        ),
    )


def build_summary(root: Path, run_names: list[str]) -> dict:
    runs = [load_run(root / name) for name in run_names]
    complete = all(run.get("complete") for run in runs)
    winner = choose_winner(runs) if complete else None
    return {
        "schemaVersion": "badugi-phase2-experiment-comparison-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "root": str(root),
        "complete": complete,
        "stopThresholds": {
            "minAvgRewardDeltaExclusive": -0.03,
            "minWorstProfileDeltaExclusive": -0.05,
            "minLooseAggressiveDeltaExclusive": -0.05,
            "minValueBetDeltaExclusive": -0.10,
        },
        "runs": runs,
        "winner": winner,
        "extensionRecommendation": (
            {"action": "extend-winner-to-25k", "run": winner["run"]}
            if winner
            else {"action": "do-not-extend"}
        ),
    }


def parse_args(argv: list[str] | None = None):
    parser = argparse.ArgumentParser(description="Summarize Badugi Phase 2 experiment screens.")
    parser.add_argument("--root", required=True)
    parser.add_argument("--runs", default=",".join(EXPECTED_RUNS))
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    run_names = [item.strip() for item in args.runs.split(",") if item.strip()]
    summary = build_summary(Path(args.root), run_names)
    atomic_write_json(Path(args.output), summary)
    print(
        "[BADUGI PHASE2] "
        f"complete={summary['complete']} "
        f"action={summary['extensionRecommendation']['action']}"
    )
    if not summary["complete"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
