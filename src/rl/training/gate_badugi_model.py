"""Promotion gate for Badugi ONNX policies.

This script is intentionally stricter than the smoke evaluator. It answers the
operational question "is this model ready to move to a stronger CPU tier?" and
fails unless the candidate clears absolute performance and baseline-delta gates.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.training.evaluate_badugi_onnx import evaluate_model


DEFAULT_CANDIDATE = PROJECT_ROOT / "public/models/badugi_beginner_dqn_v1.onnx"
DEFAULT_BASELINE = PROJECT_ROOT / "public/models/badugi_worldmaster_v1.onnx"
PROMOTION_TIERS = [
    {
        "tier": "standard",
        "minAvgReward": 0.0,
        "minShowdownWinRate": 0.25,
        "maxFoldRate": 0.45,
        "minBaselineAvgDelta": 0.25,
        "minWorstProfileAvgReward": -0.25,
    },
    {
        "tier": "pro",
        "minAvgReward": 0.5,
        "minShowdownWinRate": 0.35,
        "maxFoldRate": 0.40,
        "minBaselineAvgDelta": 0.50,
        "minWorstProfileAvgReward": 0.25,
    },
    {
        "tier": "iron",
        "minAvgReward": 1.0,
        "minShowdownWinRate": 0.42,
        "maxFoldRate": 0.35,
        "minBaselineAvgDelta": 0.75,
        "minWorstProfileAvgReward": 0.75,
    },
    {
        "tier": "worldmaster",
        "minAvgReward": 1.5,
        "minShowdownWinRate": 0.50,
        "maxFoldRate": 0.30,
        "minBaselineAvgDelta": 1.00,
        "minWorstProfileAvgReward": 1.00,
    },
]


def parse_seeds(value: str) -> list[int]:
    seeds = [int(item.strip()) for item in value.split(",") if item.strip()]
    if not seeds:
        raise argparse.ArgumentTypeError("at least one seed is required")
    return seeds


def parse_csv(value: str) -> list[str]:
    items = [item.strip() for item in value.split(",") if item.strip()]
    if not items:
        raise argparse.ArgumentTypeError("at least one value is required")
    return items


def summarize_runs(runs: list[dict]) -> dict:
    episodes = sum(int(run["episodes"]) for run in runs)
    showdowns = sum(int(run["showdowns"]) for run in runs)
    wins = sum(int(run["wins"]) for run in runs)
    folds = sum(int(run["folds"]) for run in runs)
    action_counts: dict[str, int] = {}
    ev_diagnostics: dict[str, int] = {}
    profile_summaries: dict[str, dict] = {}
    for run in runs:
        for action, count in run.get("actionCounts", {}).items():
            action_counts[action] = action_counts.get(action, 0) + int(count)
        for key, count in run.get("evDiagnostics", {}).items():
            ev_diagnostics[key] = ev_diagnostics.get(key, 0) + int(count)
        profile = str(run.get("opponentProfile", "unknown"))
        summary = profile_summaries.setdefault(
            profile,
            {
                "runs": 0,
                "episodes": 0,
                "avgRewards": [],
                "showdowns": 0,
                "wins": 0,
                "folds": 0,
            },
        )
        summary["runs"] += 1
        summary["episodes"] += int(run["episodes"])
        summary["avgRewards"].append(float(run["avgReward"]))
        summary["showdowns"] += int(run["showdowns"])
        summary["wins"] += int(run["wins"])
        summary["folds"] += int(run["folds"])
    normalized_profile_summaries = {}
    for profile, summary in profile_summaries.items():
        profile_episodes = int(summary["episodes"])
        profile_showdowns = int(summary["showdowns"])
        normalized_profile_summaries[profile] = {
            "runs": int(summary["runs"]),
            "episodes": profile_episodes,
            "avgReward": statistics.fmean(summary["avgRewards"]),
            "showdownWinRate": summary["wins"] / profile_showdowns if profile_showdowns else 0.0,
            "foldRate": summary["folds"] / profile_episodes if profile_episodes else 0.0,
            "showdowns": profile_showdowns,
            "folds": int(summary["folds"]),
            "wins": int(summary["wins"]),
        }
    worst_profile = min(
        normalized_profile_summaries.items(),
        key=lambda item: item[1]["avgReward"],
        default=(None, {"avgReward": 0.0}),
    )
    return {
        "runs": len(runs),
        "episodes": episodes,
        "avgReward": statistics.fmean(float(run["avgReward"]) for run in runs),
        "minAvgReward": min(float(run["avgReward"]) for run in runs),
        "showdownWinRate": wins / showdowns if showdowns else 0.0,
        "foldRate": folds / episodes if episodes else 0.0,
        "showdowns": showdowns,
        "folds": folds,
        "wins": wins,
        "actionCounts": action_counts,
        "evDiagnostics": ev_diagnostics,
        "profileSummaries": normalized_profile_summaries,
        "worstProfile": worst_profile[0],
        "worstProfileAvgReward": worst_profile[1]["avgReward"],
    }


def build_promotion_report(candidate_summary: dict, avg_delta: float | None) -> dict:
    eligible = []
    failed = {}
    for tier in PROMOTION_TIERS:
        checks = {
            "avgReward": candidate_summary["avgReward"] >= tier["minAvgReward"],
            "showdownWinRate": candidate_summary["showdownWinRate"] >= tier["minShowdownWinRate"],
            "foldRate": candidate_summary["foldRate"] <= tier["maxFoldRate"],
            "worstProfileAvgReward": (
                candidate_summary.get("worstProfileAvgReward", 0.0)
                >= tier["minWorstProfileAvgReward"]
            ),
            "baselineAvgDelta": (
                True if avg_delta is None else avg_delta >= tier["minBaselineAvgDelta"]
            ),
        }
        if all(checks.values()):
            eligible.append(tier["tier"])
        else:
            failed[tier["tier"]] = checks
    recommended = eligible[-1] if eligible else "beginner"
    return {
        "recommendedTier": recommended,
        "eligibleTiers": eligible,
        "failedTierChecks": failed,
        "tierThresholds": PROMOTION_TIERS,
    }


def evaluate_across_seeds(
    model: Path,
    *,
    seeds: list[int],
    opponent_profiles: list[str],
    episodes: int,
    max_steps: int,
    table_size: int,
    feature_set: str,
) -> dict:
    runs = [
        evaluate_model(
            model=model,
            episodes=episodes,
            max_steps=max_steps,
            epsilon=0.0,
            seed=seed,
            opponent_profile=profile,
            table_size=table_size,
            feature_set=feature_set,
        )
        for seed in seeds
        for profile in opponent_profiles
    ]
    return {
        "model": str(model),
        "summary": summarize_runs(runs),
        "runs": runs,
    }


def build_gate_report(args) -> dict:
    candidate = evaluate_across_seeds(
        Path(args.candidate),
        seeds=args.seeds,
        opponent_profiles=args.opponent_profiles,
        episodes=args.episodes,
        max_steps=args.max_steps,
        table_size=args.table_size,
        feature_set=args.candidate_feature_set,
    )
    baseline = None
    if args.baseline:
        baseline_path = Path(args.baseline)
        if baseline_path.exists():
            baseline = evaluate_across_seeds(
                baseline_path,
                seeds=args.seeds,
                opponent_profiles=args.opponent_profiles,
                episodes=args.episodes,
                max_steps=args.max_steps,
                table_size=args.table_size,
                feature_set=args.baseline_feature_set,
            )

    candidate_summary = candidate["summary"]
    baseline_summary = baseline["summary"] if baseline else None
    avg_delta = (
        candidate_summary["avgReward"] - baseline_summary["avgReward"]
        if baseline_summary is not None
        else None
    )
    checks = {
        "avgReward": candidate_summary["avgReward"] >= args.min_avg_reward,
        "showdownWinRate": candidate_summary["showdownWinRate"] >= args.min_showdown_win_rate,
        "foldRate": candidate_summary["foldRate"] <= args.max_fold_rate,
        "worstProfileAvgReward": candidate_summary["worstProfileAvgReward"]
        >= args.min_worst_profile_avg_reward,
        "baselineAvgDelta": (
            True if avg_delta is None else avg_delta >= args.min_baseline_avg_delta
        ),
    }
    passed = all(checks.values())
    promotion = build_promotion_report(candidate_summary, avg_delta)
    return {
        "passed": passed,
        "checks": checks,
        "thresholds": {
            "minAvgReward": args.min_avg_reward,
            "minShowdownWinRate": args.min_showdown_win_rate,
            "maxFoldRate": args.max_fold_rate,
            "minWorstProfileAvgReward": args.min_worst_profile_avg_reward,
            "minBaselineAvgDelta": args.min_baseline_avg_delta,
        },
        "avgRewardDeltaVsBaseline": avg_delta,
        "promotion": promotion,
        "candidate": candidate,
        "baseline": baseline,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Gate a Badugi ONNX policy for tier promotion.")
    parser.add_argument("--candidate", default=str(DEFAULT_CANDIDATE))
    parser.add_argument("--baseline", default=str(DEFAULT_BASELINE))
    parser.add_argument("--episodes", type=int, default=500)
    parser.add_argument("--max-steps", type=int, default=200)
    parser.add_argument("--table-size", type=int, default=2)
    parser.add_argument(
        "--candidate-feature-set",
        default="badugi-observation-v1-ev-range",
        choices=["badugi-observation-v1", "badugi-observation-v1-ev", "badugi-observation-v1-ev-range"],
    )
    parser.add_argument(
        "--baseline-feature-set",
        default="badugi-observation-v1-ev",
        choices=["badugi-observation-v1", "badugi-observation-v1-ev", "badugi-observation-v1-ev-range"],
    )
    parser.add_argument("--seeds", type=parse_seeds, default=parse_seeds("20260502,20260503,20260504"))
    parser.add_argument(
        "--opponent-profiles",
        type=parse_csv,
        default=parse_csv("balanced,loose_passive,loose_aggressive,tight_passive,tight_aggressive"),
    )
    parser.add_argument("--min-avg-reward", type=float, default=0.0)
    parser.add_argument("--min-showdown-win-rate", type=float, default=0.35)
    parser.add_argument("--max-fold-rate", type=float, default=0.45)
    parser.add_argument("--min-worst-profile-avg-reward", type=float, default=0.0)
    parser.add_argument("--min-baseline-avg-delta", type=float, default=0.25)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    report = build_gate_report(args)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        candidate = report["candidate"]["summary"]
        baseline = report["baseline"]["summary"] if report["baseline"] else None
        print(
            "[BADUGI GATE] "
            f"status={'PASS' if report['passed'] else 'FAIL'} "
            f"candidateAvgReward={candidate['avgReward']:.3f} "
            f"candidateShowdownWinRate={candidate['showdownWinRate']:.3f} "
            f"candidateFoldRate={candidate['foldRate']:.3f} "
            f"avgRewardDeltaVsBaseline={report['avgRewardDeltaVsBaseline']}"
        )
        if baseline:
            print(
                "[BADUGI GATE BASELINE] "
                f"avgReward={baseline['avgReward']:.3f} "
                f"showdownWinRate={baseline['showdownWinRate']:.3f} "
                f"foldRate={baseline['foldRate']:.3f}"
            )
        print(f"[BADUGI GATE CHECKS] {report['checks']}")
        promotion = report["promotion"]
        print(
            "[BADUGI PROMOTION] "
            f"recommendedTier={promotion['recommendedTier']} "
            f"eligibleTiers={promotion['eligibleTiers']}"
        )
    if not report["passed"] and not args.report_only:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
