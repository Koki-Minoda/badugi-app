"""Build bootstrap ONNX policies for 2-7 and A-5 draw games.

These models are teacher-initialized bootstrap artifacts, not long-running
self-play RL checkpoints. They provide real ONNX assets for D01/S01 and D02/S02
so the frontend can exercise per-variant draw model routing while proper draw
RL training is built.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Dict, List

try:
    import onnx
    from onnx import TensorProto, checker, helper
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: onnx. Install RL deps first: "
        "python3 -m pip install -r src/rl/requirements.txt"
    ) from exc


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_REGISTRY_PATH = PROJECT_ROOT / "src/config/ai/modelRegistry.json"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "public/models"
INPUT_SIZE = 96
OUTPUT_SIZE = 11

MODEL_SPECS = {
    "model-27draw-iron-v1": {
        "file": "27draw_iron_v1.onnx",
        "family": "low-27",
        "straight_flush_bad": True,
    },
    "model-a5draw-iron-v1": {
        "file": "a5draw_iron_v1.onnx",
        "family": "low-a5",
        "straight_flush_bad": False,
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_linear_weights(*, straight_flush_bad: bool) -> tuple[List[float], List[float]]:
    """Return W/B for a 96 -> 11 draw policy.

    Output order follows DRAW_RL_ACTIONS:
    fold, check, call, bet, raise, draw_0, draw_1, draw_2, draw_3, draw_4, draw_5.
    """
    weights = [[0.0 for _ in range(OUTPUT_SIZE)] for _ in range(INPUT_SIZE)]
    bias = [-0.7, 0.2, 0.25, 0.0, -0.15, -0.15, 0.12, 0.06, -0.1, -0.55, -0.9]

    made_cards = 15
    highest_rank = 16
    rank_sum = 17
    duplicate_ranks = 18
    duplicate_suits = 19
    straight = 20
    flush = 21
    current_bet = 25
    raise_count = 26
    low27 = 41
    low_a5 = 42

    # Made lows continue and value bet more often. Draw_0 means stand pat.
    weights[made_cards][0] = -0.75
    weights[made_cards][2] = 0.38
    weights[made_cards][3] = 0.22
    weights[made_cards][4] = 0.12
    weights[made_cards][5] = 0.82
    weights[made_cards][6] = -0.22
    weights[made_cards][7] = -0.36
    weights[made_cards][8] = -0.50

    # Higher top card and larger rank sum are weaker. Continue less and draw
    # more aggressively unless the hand is already a clean made low.
    weights[highest_rank][0] = 0.20
    weights[highest_rank][2] = -0.16
    weights[highest_rank][3] = -0.18
    weights[highest_rank][4] = -0.24
    weights[highest_rank][5] = -0.72
    weights[highest_rank][6] = 0.34
    weights[highest_rank][7] = 0.28
    weights[highest_rank][8] = 0.14
    weights[rank_sum][5] = -0.30
    weights[rank_sum][6] = 0.14
    weights[rank_sum][7] = 0.20

    # Pairs/trips must be broken in both lowball families.
    weights[duplicate_ranks][0] = 0.22
    weights[duplicate_ranks][2] = -0.10
    weights[duplicate_ranks][3] = -0.12
    weights[duplicate_ranks][5] = -1.15
    weights[duplicate_ranks][6] = 0.70
    weights[duplicate_ranks][7] = 0.82
    weights[duplicate_ranks][8] = 0.48

    if straight_flush_bad:
        # In 2-7, straights and flushes are penalties, so break them even when
        # ranks look low. Suit duplication itself is a proxy for flush pressure.
        weights[duplicate_suits][5] = -0.18
        weights[duplicate_suits][6] = 0.12
        weights[straight][5] = -1.05
        weights[straight][6] = 0.88
        weights[straight][7] = 0.18
        weights[flush][5] = -1.05
        weights[flush][6] = 0.88
        weights[flush][7] = 0.18
        weights[low27][6] = 0.06
    else:
        # In A-5, straights/flushes do not count against low; avoid teaching the
        # model to break wheels or smooth made lows because they are straight or
        # flush shaped.
        weights[straight][5] = 0.12
        weights[flush][5] = 0.12
        weights[low_a5][5] = 0.12

    # Facing pressure should make thin raises worse but should not force draws.
    weights[current_bet][0] = 0.36
    weights[current_bet][2] = -0.08
    weights[current_bet][3] = -0.16
    weights[current_bet][4] = -0.32
    weights[raise_count][0] = 0.24
    weights[raise_count][3] = -0.20
    weights[raise_count][4] = -0.48

    return [value for row in weights for value in row], bias


def make_model(model_id: str, spec: Dict[str, object]):
    weights, bias = build_linear_weights(
        straight_flush_bad=bool(spec["straight_flush_bad"]),
    )
    input_tensor = helper.make_tensor_value_info("input", TensorProto.FLOAT, [INPUT_SIZE])
    output_tensor = helper.make_tensor_value_info("output", TensorProto.FLOAT, [OUTPUT_SIZE])
    weight_tensor = helper.make_tensor("W", TensorProto.FLOAT, [INPUT_SIZE, OUTPUT_SIZE], weights)
    bias_tensor = helper.make_tensor("B", TensorProto.FLOAT, [OUTPUT_SIZE], bias)
    matmul = helper.make_node("MatMul", ["input", "W"], ["linear"], name="linear_scores")
    add = helper.make_node("Add", ["linear", "B"], ["output"], name="add_bias")
    graph = helper.make_graph(
        [matmul, add],
        f"{model_id}-graph",
        [input_tensor],
        [output_tensor],
        [weight_tensor, bias_tensor],
    )
    model = helper.make_model(
        graph,
        producer_name="mgx-draw-bootstrap-policy",
        opset_imports=[helper.make_operatorsetid("", 13)],
    )
    model.ir_version = 8
    checker.check_model(model)
    return model


def read_registry(path: Path):
    return json.loads(path.read_text(encoding="utf8"))


def write_registry(path: Path, registry):
    path.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf8")


def update_registry(registry_path: Path, checksums: Dict[str, str]):
    registry = read_registry(registry_path)
    missing = set(checksums)
    for entry in registry:
        model_id = entry.get("id")
        if model_id in checksums:
            entry["checksumSha256"] = checksums[model_id]
            entry["trainingStatus"] = "bootstrap"
            entry["trainingNotes"] = (
                "Teacher-initialized draw bootstrap ONNX. This is not a full "
                "self-play RL checkpoint; replace after variant-specific draw "
                "RL and human/practice gates pass."
            )
            missing.discard(model_id)
    if missing:
        raise ValueError(f"Registry missing model ids: {', '.join(sorted(missing))}")
    write_registry(registry_path, registry)


def build_models(output_dir: Path, registry_path: Path, should_update_registry: bool):
    output_dir.mkdir(parents=True, exist_ok=True)
    results = []
    checksums = {}
    for model_id, spec in MODEL_SPECS.items():
        model = make_model(model_id, spec)
        destination = output_dir / str(spec["file"])
        onnx.save(model, destination)
        checksum = sha256(destination)
        checksums[model_id] = checksum
        results.append(
            {
                "id": model_id,
                "family": spec["family"],
                "path": str(destination),
                "checksumSha256": checksum,
                "type": "draw-bootstrap-linear-policy",
            }
        )
    if should_update_registry:
        update_registry(registry_path, checksums)
    return results


def parse_args():
    parser = argparse.ArgumentParser(description="Build 2-7/A-5 draw bootstrap ONNX policies.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    parser.add_argument("--no-registry-update", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    results = build_models(
        Path(args.output_dir),
        Path(args.registry),
        should_update_registry=not args.no_registry_update,
    )
    if args.json:
        print(json.dumps({"models": results}, indent=2))
        return
    for result in results:
        print(
            f"Built {result['id']} ({result['family']}) -> "
            f"{result['path']} sha256={result['checksumSha256']}"
        )


if __name__ == "__main__":
    main()
