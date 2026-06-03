"""Smoke-evaluate draw ONNX models against variant-specific fixtures."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    import numpy as np
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: numpy. Install RL deps first: "
        "python3 -m pip install -r src/rl/requirements.txt"
    ) from exc

try:
    import onnxruntime as ort
except ImportError:  # pragma: no cover
    ort = None


DRAW_ACTIONS = [
    "fold",
    "check",
    "call",
    "bet",
    "raise",
    "draw_0",
    "draw_1",
    "draw_2",
    "draw_3",
    "draw_4",
    "draw_5",
]


def make_vector(
    *,
    family: str,
    made_cards: int,
    highest_rank: int,
    rank_sum: int,
    duplicate_ranks: int = 0,
    duplicate_suits: int = 0,
    straight: bool = False,
    flush: bool = False,
) -> np.ndarray:
    vector = np.zeros(96, dtype=np.float32)
    vector[2] = 1  # draw decision phase
    vector[15] = made_cards / 5
    vector[16] = highest_rank / 14
    vector[17] = rank_sum / 60
    vector[18] = duplicate_ranks / 4
    vector[19] = duplicate_suits / 4
    vector[20] = 1 if straight else 0
    vector[21] = 1 if flush else 0
    vector[22] = 1
    vector[40] = 0
    vector[41] = 1 if family == "low-27" else 0
    vector[42] = 1 if family == "low-a5" else 0
    for action_index in range(5, 11):
        vector[48 + action_index] = 1
    return vector


def run_model(model_path: Path, vector: np.ndarray):
    if ort is None:  # pragma: no cover
        raise SystemExit(
            "Missing dependency: onnxruntime. Install RL deps first: "
            "python3 -m pip install -r src/rl/requirements.txt"
        )
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    scores = session.run([output_name], {input_name: vector})[0].astype(float).tolist()
    draw_scores = scores[5:11]
    best_draw_index = max(range(len(draw_scores)), key=lambda index: draw_scores[index])
    return {
        "scores": scores,
        "drawAction": f"draw_{best_draw_index}",
        "drawCount": best_draw_index,
    }


def fixtures_for_variant(variant_id: str):
    if variant_id == "D01":
        return [
            {
                "name": "clean-seven-low-stands-pat",
                "family": "low-27",
                "vector": make_vector(family="low-27", made_cards=5, highest_rank=7, rank_sum=21),
                "expected": "draw_0",
            },
            {
                "name": "paired-rough-hand-breaks-pair",
                "family": "low-27",
                "vector": make_vector(
                    family="low-27",
                    made_cards=3,
                    highest_rank=13,
                    rank_sum=38,
                    duplicate_ranks=1,
                ),
                "notExpected": "draw_0",
            },
            {
                "name": "two-seven-straight-breaks",
                "family": "low-27",
                "vector": make_vector(
                    family="low-27",
                    made_cards=4,
                    highest_rank=7,
                    rank_sum=25,
                    straight=True,
                ),
                "notExpected": "draw_0",
            },
        ]
    if variant_id == "S01":
        return [
            {
                "name": "clean-seven-low-stands-pat",
                "family": "low-27",
                "vector": make_vector(family="low-27", made_cards=5, highest_rank=7, rank_sum=21),
                "expected": "draw_0",
            },
            {
                "name": "rough-nine-pats-in-sd",
                "family": "low-27",
                "vector": make_vector(family="low-27", made_cards=5, highest_rank=9, rank_sum=35),
                "expected": "draw_0",
            },
            {
                "name": "borderline-nine-low-with-pair",
                "family": "low-27",
                "vector": make_vector(
                    family="low-27",
                    made_cards=4,
                    highest_rank=9,
                    rank_sum=31,
                    duplicate_ranks=1,
                ),
                "notExpected": "draw_0",
            },
        ]
    if variant_id == "D02":
        return [
            {
                "name": "a5-wheel-stands-pat",
                "family": "low-a5",
                "vector": make_vector(
                    family="low-a5",
                    made_cards=5,
                    highest_rank=5,
                    rank_sum=15,
                    straight=True,
                ),
                "expected": "draw_0",
            },
            {
                "name": "a5-flush-wheel-stands-pat",
                "family": "low-a5",
                "vector": make_vector(
                    family="low-a5",
                    made_cards=5,
                    highest_rank=5,
                    rank_sum=15,
                    straight=True,
                    flush=True,
                ),
                "expected": "draw_0",
            },
            {
                "name": "a5-pair-breaks",
                "family": "low-a5",
                "vector": make_vector(
                    family="low-a5",
                    made_cards=3,
                    highest_rank=12,
                    rank_sum=34,
                    duplicate_ranks=1,
                ),
                "notExpected": "draw_0",
            },
        ]
    if variant_id == "S02":
        return [
            {
                "name": "a5-wheel-stands-pat",
                "family": "low-a5",
                "vector": make_vector(
                    family="low-a5",
                    made_cards=5,
                    highest_rank=5,
                    rank_sum=15,
                    straight=True,
                ),
                "expected": "draw_0",
            },
            {
                "name": "eight-high-a5-pats-in-sd",
                "family": "low-a5",
                "vector": make_vector(family="low-a5", made_cards=5, highest_rank=8, rank_sum=25),
                "expected": "draw_0",
                "blocking": False,
                "knownLimitation": (
                    "S02 A-5 Single Draw 8-low pat/draw exact-match is report-only; "
                    "promotion uses gate_draw_model.py aggregate metrics."
                ),
            },
            {
                "name": "nine-high-a5-context-dependent-sd",
                "family": "low-a5",
                "vector": make_vector(family="low-a5", made_cards=5, highest_rank=9, rank_sum=34),
                "expected": "draw_0",
                "blocking": False,
                "knownLimitation": (
                    "S02 A-5 Single Draw 9-low pat/draw is context-dependent and "
                    "is not a Pro promotion blocker."
                ),
            },
            {
                "name": "pair-a5-breaks-even-with-low-pair",
                "family": "low-a5",
                "vector": make_vector(
                    family="low-a5",
                    made_cards=4,
                    highest_rank=8,
                    rank_sum=24,
                    duplicate_ranks=1,
                ),
                "notExpected": "draw_0",
                "blocking": False,
                "knownLimitation": (
                    "S02 draw heuristic exact-match fixtures are report-only for "
                    "context-dependent A-5 Single Draw decisions."
                ),
            },
        ]
    raise ValueError(f"Unsupported draw variant id: {variant_id}")


def evaluate(model_path: Path, variant_id: str):
    results = []
    blocking_failures = []
    report_only_failures = []
    for fixture in fixtures_for_variant(variant_id):
        decision = run_model(model_path, fixture["vector"])
        blocking = fixture.get("blocking", True)
        passed = True
        if fixture.get("expected") and decision["drawAction"] != fixture["expected"]:
            passed = False
        if fixture.get("notExpected") and decision["drawAction"] == fixture["notExpected"]:
            passed = False
        item = {
            "name": fixture["name"],
            "family": fixture["family"],
            "drawAction": decision["drawAction"],
            "passed": passed,
            "blocking": blocking,
        }
        if fixture.get("knownLimitation"):
            item["knownLimitation"] = fixture["knownLimitation"]
        results.append(item)
        if not passed:
            if blocking:
                blocking_failures.append(item)
            else:
                report_only_failures.append(item)
    return {
        "variantId": variant_id,
        "model": str(model_path),
        "results": results,
        "failures": blocking_failures,
        "blockingFailures": blocking_failures,
        "reportOnlyFailures": report_only_failures,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate draw ONNX bootstrap fixtures.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--variant-id", required=True)
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    summary = evaluate(Path(args.model), args.variant_id)
    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        for result in summary["results"]:
            status = "PASS" if result["passed"] else ("FAIL" if result.get("blocking", True) else "REPORT")
            print(f"{status} {result['name']} -> {result['drawAction']}")
    if summary["blockingFailures"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
