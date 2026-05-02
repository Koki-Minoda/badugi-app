"""Export and gate-evaluate Badugi DQN checkpoints at fixed milestones."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.training.export_badugi_dqn_onnx import export_checkpoint
from rl.training.gate_badugi_model import (
    build_promotion_report,
    evaluate_across_seeds,
    parse_csv,
    parse_seeds,
)


DEFAULT_BASELINE = PROJECT_ROOT / "public/models/badugi_standard_dqn_v1.onnx"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "rl/evaluations/badugi_checkpoints"


def checkpoint_sort_key(path: Path) -> tuple[int, str]:
    parts = path.stem.split("_")
    for part in parts:
        if part.isdigit():
            return (int(part), path.name)
    if path.stem.endswith("latest"):
        return (10**12, path.name)
    return (0, path.name)


def list_checkpoints(checkpoint_dir: Path, pattern: str) -> list[Path]:
    checkpoints = sorted(checkpoint_dir.glob(pattern), key=checkpoint_sort_key)
    return [path for path in checkpoints if path.is_file()]


def evaluate_checkpoint(
    *,
    checkpoint: Path,
    baseline_summary: dict | None,
    args,
) -> dict:
    onnx_output = args.output_dir / f"{checkpoint.stem}.onnx"
    export_result = export_checkpoint(
        checkpoint=checkpoint,
        output=onnx_output,
        registry=PROJECT_ROOT / "src/config/ai/modelRegistry.json",
        model_id="checkpoint-eval",
        update_registry=False,
        device=args.device,
    )
    candidate = evaluate_across_seeds(
        onnx_output,
        seeds=args.seeds,
        opponent_profiles=args.opponent_profiles,
        episodes=args.episodes,
        max_steps=args.max_steps,
        table_size=args.table_size,
        feature_set=args.candidate_feature_set,
    )
    candidate_summary = candidate["summary"]
    avg_delta = (
        candidate_summary["avgReward"] - baseline_summary["avgReward"]
        if baseline_summary is not None
        else None
    )
    promotion = build_promotion_report(candidate_summary, avg_delta)
    return {
        "checkpoint": str(checkpoint),
        "onnx": export_result["output"],
        "checksumSha256": export_result["checksumSha256"],
        "avgRewardDeltaVsBaseline": avg_delta,
        "promotion": promotion,
        "candidate": candidate,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate Badugi DQN checkpoints before long runs.")
    parser.add_argument("--checkpoint-dir", required=True)
    parser.add_argument("--pattern", default="badugi_dqn_*.pt")
    parser.add_argument("--baseline", default=str(DEFAULT_BASELINE))
    parser.add_argument("--episodes", type=int, default=100)
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
    parser.add_argument("--seeds", type=parse_seeds, default=parse_seeds("20260502,20260503"))
    parser.add_argument(
        "--opponent-profiles",
        type=parse_csv,
        default=parse_csv("balanced,loose_aggressive,tight_passive"),
    )
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--report", default=None)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    args.output_dir = Path(args.output_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_dir = Path(args.checkpoint_dir)
    checkpoints = list_checkpoints(checkpoint_dir, args.pattern)
    if not checkpoints:
        raise SystemExit(f"No checkpoints found in {checkpoint_dir} matching {args.pattern}")

    baseline_path = Path(args.baseline)
    baseline = None
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
    baseline_summary = baseline["summary"] if baseline else None

    results = [
        evaluate_checkpoint(
            checkpoint=checkpoint,
            baseline_summary=baseline_summary,
            args=args,
        )
        for checkpoint in checkpoints
    ]
    report = {
        "checkpointDir": str(checkpoint_dir),
        "pattern": args.pattern,
        "baseline": baseline,
        "results": results,
    }
    report_path = Path(args.report) if args.report else args.output_dir / "checkpoint_report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")

    if args.json:
        print(json.dumps(report, indent=2))
        return
    for result in results:
        summary = result["candidate"]["summary"]
        print(
            "[BADUGI CHECKPOINT] "
            f"checkpoint={Path(result['checkpoint']).name} "
            f"avgReward={summary['avgReward']:.3f} "
            f"showdownWinRate={summary['showdownWinRate']:.3f} "
            f"foldRate={summary['foldRate']:.3f} "
            f"avgRewardDeltaVsBaseline={result['avgRewardDeltaVsBaseline']} "
            f"recommendedTier={result['promotion']['recommendedTier']}"
        )
    print(f"[BADUGI CHECKPOINT REPORT] {report_path}")


if __name__ == "__main__":
    main()
