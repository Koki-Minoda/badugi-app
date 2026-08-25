"""Promotion gate for Draw Lowball DQN checkpoints.

This gate is variant-specific for:
- D01: 2-7 Triple Draw
- D02: A-5 Triple Draw
- S01: 2-7 Single Draw
- S02: A-5 Single Draw

Single-draw variants must not be promoted to Pro/Iron from a generic TD
checkpoint. Use an explicit S01/S02/SD/single-draw checkpoint name for those
tiers, or keep the model at Standard while a variant-specific model is trained.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.agents.dqn_agent import DQNAgent
from rl.training.evaluate_selfplay_draw import (
    DEFAULT_REPORT_DIR,
    DRAW_VARIANTS,
    build_report_payload,
    evaluate_against_profiles,
    infer_variant_config,
)


GATE_THRESHOLDS = {
    "D01": {
        "standard": {
            "minAvgReward": -0.10,
            "minWinRate": 0.46,
            "minShowdownWinRate": 0.42,
            "maxFoldRate": 0.45,
            "minPatRateWithStrongLow": 0.78,
            "minDrawAccuracy": 0.58,
            "maxDrawMistakeRate": 0.42,
            "minWorstProfileAvgReward": -0.35,
        },
        "pro": {
            "minAvgReward": 0.20,
            "minWinRate": 0.52,
            "minShowdownWinRate": 0.48,
            "maxFoldRate": 0.38,
            "minPatRateWithStrongLow": 0.86,
            "minDrawAccuracy": 0.66,
            "maxDrawMistakeRate": 0.34,
            "minWorstProfileAvgReward": -0.10,
        },
        "iron": {
            "minAvgReward": 0.45,
            "minWinRate": 0.56,
            "minShowdownWinRate": 0.52,
            "maxFoldRate": 0.34,
            "minPatRateWithStrongLow": 0.90,
            "minDrawAccuracy": 0.72,
            "maxDrawMistakeRate": 0.28,
            "minWorstProfileAvgReward": 0.05,
        },
    },
    "D02": {
        "standard": {
            "minAvgReward": -0.05,
            "minWinRate": 0.47,
            "minShowdownWinRate": 0.43,
            "maxFoldRate": 0.43,
            "minPatRateWithStrongLow": 0.82,
            "minDrawAccuracy": 0.60,
            "maxDrawMistakeRate": 0.40,
            "minWorstProfileAvgReward": -0.30,
        },
        "pro": {
            "minAvgReward": 0.25,
            "minWinRate": 0.53,
            "minShowdownWinRate": 0.49,
            "maxFoldRate": 0.36,
            "minPatRateWithStrongLow": 0.88,
            "minDrawAccuracy": 0.68,
            "maxDrawMistakeRate": 0.32,
            "minWorstProfileAvgReward": -0.05,
        },
        "iron": {
            "minAvgReward": 0.50,
            "minWinRate": 0.57,
            "minShowdownWinRate": 0.53,
            "maxFoldRate": 0.32,
            "minPatRateWithStrongLow": 0.92,
            "minDrawAccuracy": 0.74,
            "maxDrawMistakeRate": 0.26,
            "minWorstProfileAvgReward": 0.10,
        },
    },
    "S01": {
        "standard": {
            "minAvgReward": -0.15,
            "minWinRate": 0.45,
            "minShowdownWinRate": 0.40,
            "maxFoldRate": 0.48,
            "minPatRateWithStrongLow": 0.80,
            "minDrawAccuracy": 0.56,
            "maxDrawMistakeRate": 0.44,
            "minWorstProfileAvgReward": -0.40,
        },
        "pro": {
            "minAvgReward": 0.18,
            "minWinRate": 0.51,
            "minShowdownWinRate": 0.47,
            "maxFoldRate": 0.40,
            "minPatRateWithStrongLow": 0.88,
            "minDrawAccuracy": 0.66,
            "maxDrawMistakeRate": 0.34,
            "minWorstProfileAvgReward": -0.12,
        },
        "iron": {
            "minAvgReward": 0.42,
            "minWinRate": 0.55,
            "minShowdownWinRate": 0.51,
            "maxFoldRate": 0.35,
            "minPatRateWithStrongLow": 0.92,
            "minDrawAccuracy": 0.72,
            "maxDrawMistakeRate": 0.28,
            "minWorstProfileAvgReward": 0.05,
        },
    },
    "S02": {
        "standard": {
            "minAvgReward": -0.12,
            "minWinRate": 0.46,
            "minShowdownWinRate": 0.41,
            "maxFoldRate": 0.47,
            "minPatRateWithStrongLow": 0.82,
            "minWorstProfileAvgReward": -0.38,
        },
        "pro": {
            "minAvgReward": 0.20,
            "minWinRate": 0.52,
            "minShowdownWinRate": 0.48,
            "maxFoldRate": 0.39,
            "minPatRateWithStrongLow": 0.90,
            "minWorstProfileAvgReward": -0.10,
        },
        "iron": {
            "minAvgReward": 0.45,
            "minWinRate": 0.56,
            "minShowdownWinRate": 0.52,
            "maxFoldRate": 0.34,
            "minPatRateWithStrongLow": 0.94,
            "minWorstProfileAvgReward": 0.08,
        },
    },
}


def parse_csv(value: str) -> tuple[str, ...]:
    items = tuple(item.strip() for item in value.split(",") if item.strip())
    if not items:
        raise argparse.ArgumentTypeError("at least one profile is required")
    return items


def checkpoint_allows_variant(checkpoint: Path, variant_id: str, tier: str) -> tuple[bool, str | None]:
    if variant_id not in {"S01", "S02"} or tier == "standard":
        return True, None
    name = checkpoint.as_posix().lower()
    allowed_tokens = {
        variant_id.lower(),
        "sd",
        "single",
        "single-draw",
        "singledraw",
    }
    if any(token in name for token in allowed_tokens):
        return True, None
    return False, "SD_PRO_REQUIRES_VARIANT_SPECIFIC_CHECKPOINT"


S02_REPORT_ONLY_METRICS = {"drawAccuracy", "drawMistakeRate"}


def build_metric_checks(summary: dict, thresholds: dict, variant_id: str | None = None) -> dict:
    checks = {
        "avgReward": summary["avgReward"] >= thresholds["minAvgReward"],
        "winRate": summary["winRate"] >= thresholds["minWinRate"],
        "showdownWinRate": summary["showdownWinRate"] >= thresholds["minShowdownWinRate"],
        "foldRate": summary["foldRate"] <= thresholds["maxFoldRate"],
        "patRateWithStrongLow": summary["patRateWithStrongLow"] >= thresholds["minPatRateWithStrongLow"],
        "worstProfileAvgReward": summary["worstProfileAvgReward"] >= thresholds["minWorstProfileAvgReward"],
    }
    if variant_id != "S02":
        checks.update(
            {
                "drawAccuracy": summary["drawAccuracy"] >= thresholds["minDrawAccuracy"],
                "drawMistakeRate": summary["drawMistakeRate"] <= thresholds["maxDrawMistakeRate"],
            }
        )
    return checks


def build_gate_report(args) -> dict:
    checkpoint_path = Path(args.checkpoint)
    if not checkpoint_path.is_absolute():
        checkpoint_path = PROJECT_ROOT / checkpoint_path
    variant_config = infer_variant_config(args.variant_id, args.family, args.max_draws)
    variant_id = variant_config["variantId"]
    thresholds = GATE_THRESHOLDS[variant_id][args.tier]

    checkpoint_exists = checkpoint_path.exists()
    eligibility_ok, eligibility_reason = checkpoint_allows_variant(checkpoint_path, variant_id, args.tier)
    if not checkpoint_exists:
        return {
            "passed": False,
            "variantId": variant_id,
            "tier": args.tier,
            "checkpoint": str(checkpoint_path),
            "checks": {"checkpointExists": False, "variantCheckpointEligible": eligibility_ok},
            "failReasons": [f"CHECKPOINT_NOT_FOUND:{checkpoint_path}"],
            "thresholds": thresholds,
            "evaluation": None,
        }

    agent = DQNAgent.load(str(checkpoint_path), device=args.device or "cpu")
    profiles = parse_csv(args.profiles)
    results = evaluate_against_profiles(
        agent=agent,
        family=variant_config["family"],
        variant_id=variant_id,
        max_draws=variant_config["maxDraws"],
        episodes_per_profile=args.episodes,
        max_steps=args.max_steps,
        profiles=profiles,
        seed=args.seed,
    )
    payload = build_report_payload(
        checkpoint_path=checkpoint_path,
        variant_id=variant_id,
        family=variant_config["family"],
        max_draws=variant_config["maxDraws"],
        episodes=args.episodes,
        max_steps=args.max_steps,
        seed=args.seed,
        profiles=profiles,
        results=results,
    )
    summary = payload["summary"]
    metric_checks = build_metric_checks(summary, thresholds, variant_id=variant_id)
    checks = {
        "checkpointExists": True,
        "variantCheckpointEligible": eligibility_ok,
        **metric_checks,
    }
    fail_reasons = []
    if not eligibility_ok:
        fail_reasons.append(eligibility_reason)
    fail_reasons.extend(key for key, passed in metric_checks.items() if not passed)
    passed = all(checks.values())
    return {
        "passed": passed,
        "variantId": variant_id,
        "variantLabel": variant_config["label"],
        "tier": args.tier,
        "checkpoint": str(checkpoint_path),
        "checks": checks,
        "failReasons": fail_reasons,
        "thresholds": thresholds,
        "reportOnlyMetrics": (
            {key: summary[key] for key in sorted(S02_REPORT_ONLY_METRICS)}
            if variant_id == "S02" else {}
        ),
        "evaluation": payload,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Gate a Draw Lowball checkpoint by variant.")
    parser.add_argument("--variant-id", required=True, choices=sorted(DRAW_VARIANTS))
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--tier", required=True, choices=["standard", "pro", "iron"])
    parser.add_argument("--episodes", type=int, default=500)
    parser.add_argument("--max-steps", type=int, default=80)
    parser.add_argument("--family", choices=["low-27", "low-a5"], default="low-27")
    parser.add_argument("--max-draws", type=int, default=None)
    parser.add_argument("--profiles", default=",".join(["beginner", "standard", "tight", "loose", "aggressive"]))
    parser.add_argument("--seed", type=int, default=20260601)
    parser.add_argument("--device", default=None)
    parser.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    parser.add_argument("--report", default=None)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_gate_report(args)
    report_path = Path(args.report) if args.report else (
        Path(args.report_dir)
        / f"draw-lowball-gate-{args.variant_id}-{args.tier}-{datetime.now().strftime('%Y%m%d')}.json"
    )
    if not report_path.is_absolute():
        report_path = PROJECT_ROOT / report_path
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        summary = (report.get("evaluation") or {}).get("summary", {})
        print(
            "[DRAW GATE] "
            f"status={'PASS' if report['passed'] else 'FAIL'} "
            f"variant={report['variantId']} tier={report['tier']} "
            f"avgReward={summary.get('avgReward')} "
            f"winRate={summary.get('winRate')} "
            f"showdownWinRate={summary.get('showdownWinRate')} "
            f"foldRate={summary.get('foldRate')} "
            f"drawAccuracy={summary.get('drawAccuracy')} "
            f"worstProfileAvgReward={summary.get('worstProfileAvgReward')} "
            f"report={report_path}"
        )
        if report["failReasons"]:
            print(f"[DRAW GATE FAIL REASONS] {report['failReasons']}")

    if not report["passed"] and not args.report_only:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
