"""Smoke-evaluate board-game ONNX models against betting fixtures."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    import numpy as np
    import onnxruntime as ort
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: onnxruntime/numpy. Install RL deps first: "
        "python3 -m pip install -r src/rl/requirements.txt"
    ) from exc


BOARD_ACTIONS = ["fold", "check", "call", "bet", "raise", "all_in"]


def make_vector(*, family: str, strength: float, equity: float, draw: float, to_call: float, position: float):
    return np.array(
        [
            to_call,
            0.12,
            0.28,
            strength,
            equity,
            draw,
            position,
            0.33,
            to_call / max(0.01, 0.28 + to_call),
            0.0,
            1.0 if family == "plo8" else 0.0,
            1.0 if family in {"plo", "plo8"} else 0.0,
            1.0 if family == "flh" else 0.0,
            0.4,
            0.8,
            1.0 if family == "nlh" else 0.0,
        ],
        dtype=np.float32,
    )


def run_model(model_path: Path, vector: np.ndarray, legal_actions: set[str]):
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    scores = session.run([output_name], {input_name: vector})[0].astype(float).tolist()
    best_index = -1
    best_score = -float("inf")
    for index, score in enumerate(scores):
        action = BOARD_ACTIONS[index]
        if action not in legal_actions:
            continue
        if score > best_score:
            best_index = index
            best_score = score
    return {"action": BOARD_ACTIONS[best_index], "scores": scores}


def family_from_variant(variant_id: str):
    mapping = {"B01": "nlh", "B02": "flh", "B05": "plo", "B06": "plo8"}
    if variant_id not in mapping:
        raise ValueError(f"Unsupported board variant id: {variant_id}")
    return mapping[variant_id]


def fixtures_for_family(family: str):
    return [
        {
            "name": "strong-open-value-bets",
            "vector": make_vector(family=family, strength=0.9, equity=0.82, draw=0.12, to_call=0.0, position=0.65),
            "legal": {"check", "bet", "raise"},
            "expectedAny": {"bet", "raise"},
        },
        {
            "name": "strong-facing-bet-continues",
            "vector": make_vector(family=family, strength=0.82, equity=0.76, draw=0.18, to_call=0.12, position=0.45),
            "legal": {"fold", "call", "raise"},
            "expectedAny": {"call", "raise"},
        },
        {
            "name": "weak-facing-bet-folds",
            "vector": make_vector(family=family, strength=0.18, equity=0.16, draw=0.08, to_call=0.25, position=0.2),
            "legal": {"fold", "call", "raise"},
            "expectedAny": {"fold"},
        },
    ]


def evaluate(model_path: Path, variant_id: str):
    family = family_from_variant(variant_id)
    results = []
    failures = []
    for fixture in fixtures_for_family(family):
        decision = run_model(model_path, fixture["vector"], fixture["legal"])
        passed = decision["action"] in fixture["expectedAny"]
        item = {
            "name": fixture["name"],
            "family": family,
            "action": decision["action"],
            "passed": passed,
        }
        results.append(item)
        if not passed:
            failures.append(item)
    return {"variantId": variant_id, "model": str(model_path), "results": results, "failures": failures}


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate board ONNX bootstrap fixtures.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--variant-id", required=True)
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    result = evaluate(Path(args.model), args.variant_id)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        for item in result["results"]:
            status = "PASS" if item["passed"] else "FAIL"
            print(f"[{status}] {item['name']}: {item['action']}")
        if result["failures"]:
            raise SystemExit(1)


if __name__ == "__main__":
    main()

