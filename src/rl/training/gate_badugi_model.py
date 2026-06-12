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
DEFAULT_MIN_ONNX_USAGE_RATE = 0.99
DEFAULT_MAX_FALLBACK_RATE = 0.01
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
        "minAvgReward": 0.55,
        "minShowdownWinRate": 0.50,
        "maxFoldRate": 0.38,
        "minBaselineAvgDelta": 0.05,
        "minWorstProfileAvgReward": 0.35,
        "maxProOverlayRate": 0.15,
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


def promotion_tiers(*, max_pro_overlay_rate: float | None = None) -> list[dict]:
    tiers = [dict(tier) for tier in PROMOTION_TIERS]
    if max_pro_overlay_rate is None:
        return tiers
    for tier in tiers:
        if "maxProOverlayRate" in tier:
            tier["maxProOverlayRate"] = float(max_pro_overlay_rate)
    return tiers


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


def baseline_delta_check(avg_delta: float | None, min_delta: float) -> bool:
    if float(min_delta) <= 0:
        return True
    return avg_delta is not None and avg_delta >= float(min_delta)


def pro_overlay_check(candidate_summary: dict, max_rate: float | None) -> bool:
    if max_rate is None:
        return True
    overlay_rate = candidate_summary.get("proOverlayRate")
    if overlay_rate is None:
        return False
    return float(overlay_rate) <= float(max_rate)


def build_promotion_report(
    candidate_summary: dict,
    avg_delta: float | None,
    *,
    max_pro_overlay_rate: float | None = None,
) -> dict:
    eligible = []
    failed = {}
    tiers = promotion_tiers(max_pro_overlay_rate=max_pro_overlay_rate)
    for tier in tiers:
        max_overlay_rate = tier.get("maxProOverlayRate")
        checks = {
            "avgReward": candidate_summary["avgReward"] >= tier["minAvgReward"],
            "showdownWinRate": candidate_summary["showdownWinRate"] >= tier["minShowdownWinRate"],
            "foldRate": candidate_summary["foldRate"] <= tier["maxFoldRate"],
            "worstProfileAvgReward": (
                candidate_summary.get("worstProfileAvgReward", 0.0)
                >= tier["minWorstProfileAvgReward"]
            ),
            "baselineAvgDelta": baseline_delta_check(avg_delta, tier["minBaselineAvgDelta"]),
        }
        if max_overlay_rate is not None:
            checks["proOverlayRate"] = pro_overlay_check(candidate_summary, max_overlay_rate)
        if all(checks.values()):
            eligible.append(tier["tier"])
        else:
            failed[tier["tier"]] = checks
    recommended = eligible[-1] if eligible else "beginner"
    return {
        "recommendedTier": recommended,
        "eligibleTiers": eligible,
        "failedTierChecks": failed,
        "tierThresholds": tiers,
    }


def normalize_gate_summary(summary: dict) -> dict:
    """Return a gate-compatible summary for legacy and clean-eval reports."""
    normalized = dict(summary or {})
    episodes = int(normalized.get("episodes", 0))
    showdowns = int(normalized.get("showdowns", 0))
    wins = int(normalized.get("wins", 0))
    folds = int(normalized.get("folds", 0))
    normalized.setdefault("runs", int(normalized.get("runs", 1 if episodes else 0)))
    normalized.setdefault("avgReward", 0.0)
    normalized.setdefault("minAvgReward", normalized.get("avgReward", 0.0))
    normalized.setdefault("showdownWinRate", wins / showdowns if showdowns else 0.0)
    normalized.setdefault("foldRate", folds / episodes if episodes else 0.0)
    normalized.setdefault("actionCounts", {})
    normalized.setdefault("evDiagnostics", {})
    normalized.setdefault("profileSummaries", {})
    normalized.setdefault("positionSummaries", {})
    normalized.setdefault("worstProfile", None)
    normalized.setdefault("worstProfileAvgReward", 0.0)
    normalized.setdefault("valueBetRate", 0.0)
    normalized.setdefault("bluffRate", 0.0)
    normalized.setdefault("patFrequency", 0.0)
    normalized.setdefault("drawDecisionAccuracy", 0.0)
    normalized.setdefault("onnxUsageRate", None)
    normalized.setdefault("fallbackRate", None)
    normalized.setdefault("proOverlayRate", None)
    normalized["episodes"] = episodes
    normalized["showdowns"] = showdowns
    normalized["wins"] = wins
    normalized["folds"] = folds
    return normalized


def build_source_health_gate(
    summary: dict,
    *,
    min_onnx_usage_rate: float,
    max_fallback_rate: float,
) -> dict:
    onnx_rate = summary.get("onnxUsageRate")
    fallback_rate = summary.get("fallbackRate")
    checks = {
        "episodes": int(summary.get("episodes", 0)) > 0,
        "onnxUsageRate": (
            onnx_rate is None or float(onnx_rate) >= float(min_onnx_usage_rate)
        ),
        "fallbackRate": (
            fallback_rate is None or float(fallback_rate) <= float(max_fallback_rate)
        ),
    }
    fail_reasons = []
    if not checks["episodes"]:
        fail_reasons.append("NO_EVALUATION_EPISODES")
    if not checks["onnxUsageRate"]:
        fail_reasons.append(f"ONNX_USAGE_LOW:{float(onnx_rate or 0.0):.4f}")
    if not checks["fallbackRate"]:
        fail_reasons.append(f"FALLBACK_RATE_HIGH:{float(fallback_rate or 0.0):.4f}")
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "failReasons": fail_reasons,
        "thresholds": {
            "minOnnxUsageRate": float(min_onnx_usage_rate),
            "maxFallbackRate": float(max_fallback_rate),
        },
    }


def extract_clean_eval_summaries(report: dict, mode: str) -> list[dict]:
    results = report.get("results", [])
    summaries = []
    for result in results:
        clean_eval = result.get("cleanEval", {})
        mode_result = clean_eval.get(mode)
        if not mode_result:
            continue
        summary = normalize_gate_summary(mode_result.get("summary", {}))
        summaries.append(
            {
                "checkpoint": result.get("checkpoint"),
                "episode": result.get("episode"),
                "milestone": result.get("milestone"),
                "summary": summary,
                "sourceGate": mode_result.get("gate"),
                "promotion": mode_result.get("promotion"),
            }
        )
    return summaries


def load_clean_eval_baseline_summary(report_path: str | None, mode: str) -> dict | None:
    if not report_path:
        return None
    path = Path(report_path)
    if not path.exists():
        return None
    report = json.loads(path.read_text(encoding="utf8"))
    summaries = extract_clean_eval_summaries(report, mode)
    if not summaries:
        return None
    return summaries[-1]["summary"]


def build_clean_eval_gate_report(args) -> dict:
    report_path = Path(args.clean_eval_report)
    baseline_report_path = getattr(args, "baseline_clean_eval_report", None)
    baseline_mode = getattr(args, "baseline_clean_eval_mode", None) or args.clean_eval_mode
    max_pro_overlay_rate = getattr(args, "max_pro_overlay_rate", None)
    if not report_path.exists():
        empty_summary = normalize_gate_summary({})
        return {
            "passed": False,
            "checks": {
                "checkpoint": {
                    "cleanEvalReportExists": False,
                    "checkpointExists": False,
                },
                "cleanEval": [],
                "source": [],
            },
            "failReasons": [f"CLEAN_EVAL_REPORT_NOT_FOUND:{report_path}"],
            "thresholds": {
                "minAvgReward": args.min_avg_reward,
                "minShowdownWinRate": args.min_showdown_win_rate,
                "maxFoldRate": args.max_fold_rate,
                "minWorstProfileAvgReward": args.min_worst_profile_avg_reward,
                "minBaselineAvgDelta": args.min_baseline_avg_delta,
                "maxProOverlayRate": max_pro_overlay_rate,
                "minOnnxUsageRate": args.min_onnx_usage_rate,
                "maxFallbackRate": args.max_fallback_rate,
            },
            "avgRewardDeltaVsBaseline": None,
            "promotion": build_promotion_report(
                empty_summary,
                avg_delta=None,
                max_pro_overlay_rate=max_pro_overlay_rate,
            ),
            "candidate": {
                "model": str(report_path),
                "summary": empty_summary,
                "runs": [],
            },
            "baseline": None,
            "cleanEvaluation": {
                "report": str(report_path),
                "mode": args.clean_eval_mode,
                "missingMilestones": [],
                "evaluated": [],
            },
        }
    clean_report = json.loads(report_path.read_text(encoding="utf8"))
    summaries = extract_clean_eval_summaries(clean_report, args.clean_eval_mode)
    baseline_summary = load_clean_eval_baseline_summary(baseline_report_path, baseline_mode)
    missing_milestones = clean_report.get("missingMilestones", [])
    checkpoint_checks = {
        "cleanEvalReportExists": report_path.exists(),
        "checkpointExists": not missing_milestones and bool(summaries),
        "baselineExists": baseline_summary is not None or float(args.min_baseline_avg_delta) <= 0,
    }
    checkpoint_fail_reasons = []
    if missing_milestones:
        checkpoint_fail_reasons.extend(
            f"CHECKPOINT_NOT_FOUND:{row.get('milestone')}" for row in missing_milestones
        )
    if not summaries:
        checkpoint_fail_reasons.append(f"CLEAN_EVAL_MODE_NOT_FOUND:{args.clean_eval_mode}")
    if baseline_summary is None and float(args.min_baseline_avg_delta) > 0:
        checkpoint_fail_reasons.append("BASELINE_REQUIRED_FOR_DELTA")

    evaluated = []
    for row in summaries:
        summary = row["summary"]
        avg_delta = (
            summary["avgReward"] - baseline_summary["avgReward"]
            if baseline_summary is not None
            else None
        )
        metric_checks = {
            "avgReward": summary["avgReward"] >= args.min_avg_reward,
            "showdownWinRate": summary["showdownWinRate"] >= args.min_showdown_win_rate,
            "foldRate": summary["foldRate"] <= args.max_fold_rate,
            "worstProfileAvgReward": summary["worstProfileAvgReward"]
            >= args.min_worst_profile_avg_reward,
            "baselineAvgDelta": baseline_delta_check(avg_delta, args.min_baseline_avg_delta),
        }
        if max_pro_overlay_rate is not None:
            metric_checks["proOverlayRate"] = pro_overlay_check(summary, max_pro_overlay_rate)
        source_gate = build_source_health_gate(
            summary,
            min_onnx_usage_rate=args.min_onnx_usage_rate,
            max_fallback_rate=args.max_fallback_rate,
        )
        promotion = build_promotion_report(
            summary,
            avg_delta,
            max_pro_overlay_rate=max_pro_overlay_rate,
        )
        evaluated.append(
            {
                **row,
                "checks": metric_checks,
                "sourceGate": source_gate,
                "passed": all(metric_checks.values()) and source_gate["passed"],
                "promotion": promotion,
                "avgRewardDeltaVsBaseline": avg_delta,
            }
        )

    passed = (
        all(checkpoint_checks.values())
        and not checkpoint_fail_reasons
        and bool(evaluated)
        and all(row["passed"] for row in evaluated)
    )
    candidate_summary = evaluated[-1]["summary"] if evaluated else normalize_gate_summary({})
    return {
        "passed": passed,
        "checks": {
            "checkpoint": checkpoint_checks,
            "cleanEval": [row["checks"] for row in evaluated],
            "source": [row["sourceGate"]["checks"] for row in evaluated],
        },
        "failReasons": checkpoint_fail_reasons
        + [
            reason
            for row in evaluated
            for reason in row["sourceGate"].get("failReasons", [])
        ],
        "thresholds": {
            "minAvgReward": args.min_avg_reward,
            "minShowdownWinRate": args.min_showdown_win_rate,
            "maxFoldRate": args.max_fold_rate,
            "minWorstProfileAvgReward": args.min_worst_profile_avg_reward,
            "minBaselineAvgDelta": args.min_baseline_avg_delta,
            "maxProOverlayRate": max_pro_overlay_rate,
            "minOnnxUsageRate": args.min_onnx_usage_rate,
            "maxFallbackRate": args.max_fallback_rate,
        },
        "avgRewardDeltaVsBaseline": (
            candidate_summary["avgReward"] - baseline_summary["avgReward"]
            if baseline_summary is not None
            else None
        ),
        "promotion": build_promotion_report(
            candidate_summary,
            candidate_summary["avgReward"] - baseline_summary["avgReward"]
            if baseline_summary is not None
            else None,
            max_pro_overlay_rate=max_pro_overlay_rate,
        ),
        "candidate": {
            "model": str(report_path),
            "summary": candidate_summary,
            "runs": [],
        },
        "baseline": {
            "report": str(baseline_report_path) if baseline_report_path else None,
            "mode": baseline_mode,
            "summary": baseline_summary,
        } if baseline_summary is not None else None,
        "cleanEvaluation": {
            "report": str(report_path),
            "mode": args.clean_eval_mode,
            "missingMilestones": missing_milestones,
            "evaluated": evaluated,
        },
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
    if args.clean_eval_report:
        return build_clean_eval_gate_report(args)
    max_pro_overlay_rate = getattr(args, "max_pro_overlay_rate", None)

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
        "baselineAvgDelta": baseline_delta_check(avg_delta, args.min_baseline_avg_delta),
    }
    if max_pro_overlay_rate is not None:
        checks["proOverlayRate"] = pro_overlay_check(candidate_summary, max_pro_overlay_rate)
    passed = all(checks.values())
    promotion = build_promotion_report(
        candidate_summary,
        avg_delta,
        max_pro_overlay_rate=max_pro_overlay_rate,
    )
    return {
        "passed": passed,
        "checks": checks,
        "thresholds": {
            "minAvgReward": args.min_avg_reward,
            "minShowdownWinRate": args.min_showdown_win_rate,
            "maxFoldRate": args.max_fold_rate,
            "minWorstProfileAvgReward": args.min_worst_profile_avg_reward,
            "minBaselineAvgDelta": args.min_baseline_avg_delta,
            "maxProOverlayRate": max_pro_overlay_rate,
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
    parser.add_argument("--clean-eval-report", default=None)
    parser.add_argument("--baseline-clean-eval-report", default=None)
    parser.add_argument(
        "--clean-eval-mode",
        default="proOverlayOff",
        choices=["proOverlayOff", "proOverlayOn"],
    )
    parser.add_argument(
        "--baseline-clean-eval-mode",
        default=None,
        choices=["proOverlayOff", "proOverlayOn"],
    )
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
    parser.add_argument("--max-pro-overlay-rate", type=float, default=None)
    parser.add_argument("--min-onnx-usage-rate", type=float, default=DEFAULT_MIN_ONNX_USAGE_RATE)
    parser.add_argument("--max-fallback-rate", type=float, default=DEFAULT_MAX_FALLBACK_RATE)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    if args.baseline_clean_eval_mode is None:
        args.baseline_clean_eval_mode = args.clean_eval_mode
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
            f"candidateProOverlayRate={candidate.get('proOverlayRate')} "
            f"candidateWorstProfile={candidate.get('worstProfile')} "
            f"candidateWorstProfileAvgReward={candidate.get('worstProfileAvgReward', 0.0):.3f} "
            f"avgRewardDeltaVsBaseline={report['avgRewardDeltaVsBaseline']}"
        )
        if baseline:
            print(
                "[BADUGI GATE BASELINE] "
                f"avgReward={baseline['avgReward']:.3f} "
                f"showdownWinRate={baseline['showdownWinRate']:.3f} "
                f"foldRate={baseline['foldRate']:.3f} "
                f"worstProfile={baseline.get('worstProfile')} "
                f"worstProfileAvgReward={baseline.get('worstProfileAvgReward', 0.0):.3f}"
            )
        print(f"[BADUGI GATE CHECKS] {report['checks']}")
        if report.get("failReasons"):
            print(f"[BADUGI GATE FAIL REASONS] {report['failReasons']}")
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
