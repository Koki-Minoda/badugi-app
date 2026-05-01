"""Build lightweight Badugi bootstrap ONNX policies.

These models are not a replacement for long-running RL training. They provide a
real ONNX inference artifact for the frontend ONNX path, initialized from simple
Badugi heuristics so production can exercise model loading, checksums, and
fallback behavior before stronger trained checkpoints are available.
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
except ImportError as exc:  # pragma: no cover - exercised by operator setup
    raise SystemExit(
        "Missing dependency: onnx. Install RL deps first: "
        "python3 -m pip install -r src/rl/requirements.txt"
    ) from exc


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_REGISTRY_PATH = PROJECT_ROOT / "src/config/ai/modelRegistry.json"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "public/models"
INPUT_SIZE = 96
OUTPUT_SIZE = 6

MODEL_SPECS = {
    "model-badugi-pro-v1": {
        "file": "badugi_pro_v1.onnx",
        "aggression": 0.42,
        "patience": 0.28,
    },
    "model-badugi-iron-v1": {
        "file": "badugi_iron_v1.onnx",
        "aggression": 0.24,
        "patience": 0.42,
    },
    "model-badugi-worldmaster-v1": {
        "file": "badugi_worldmaster_v1.onnx",
        "aggression": 0.58,
        "patience": 0.18,
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_linear_weights(*, aggression: float, patience: float) -> tuple[List[float], List[float]]:
    """Return W/B for a 96 -> 6 linear policy.

    Output order follows BADUGI_RL_ACTIONS:
    fold, check, call, bet, raise, all_in.
    """
    weights = [[0.0 for _ in range(OUTPUT_SIZE)] for _ in range(INPUT_SIZE)]
    bias = [-0.9, 0.36, 0.54, 0.18, 0.02, -1.8]

    made_cards = 22
    rank_sum = 23
    highest_rank = 24
    duplicate_rank = 25
    duplicate_suit = 26
    to_call = 13
    current_bet = 14
    raise_count = 15
    draws_remaining = 16
    phase = 17
    active_opponents = 21

    # Better Badugi shape should prefer continuing and value betting.
    weights[made_cards][0] = -0.9 - patience
    weights[made_cards][1] = 0.25
    weights[made_cards][2] = 0.45 + patience
    weights[made_cards][3] = 0.35 + aggression
    weights[made_cards][4] = 0.25 + aggression

    # Lower rank sum and lower top card are better in Badugi. Penalize value
    # actions as those normalized values rise.
    weights[rank_sum][2] = -0.20
    weights[rank_sum][3] = -0.18
    weights[rank_sum][4] = -0.22
    weights[highest_rank][2] = -0.15
    weights[highest_rank][3] = -0.12
    weights[highest_rank][4] = -0.15

    # Duplicates mean the hand is draw-heavy. Avoid over-aggressive betting.
    weights[duplicate_rank][0] = 0.35
    weights[duplicate_suit][0] = 0.35
    weights[duplicate_rank][4] = -0.25
    weights[duplicate_suit][4] = -0.25

    # Calling pressure and capped pots make fold/check/call safer.
    weights[to_call][0] = 0.45
    weights[to_call][2] = -0.10
    weights[to_call][4] = -0.30
    weights[current_bet][0] = 0.20
    weights[raise_count][3] = -0.25
    weights[raise_count][4] = -0.50

    # DRAW phase uses the same six scores, and the adapter decodes the max
    # index as draw count. Push pat/draw-count outputs by phase and hand shape.
    weights[phase][0] = 0.75
    weights[phase][1] = 0.42
    weights[phase][2] = 0.18
    weights[phase][3] = 0.10
    weights[draws_remaining][0] = -0.15
    weights[draws_remaining][1] = 0.08
    weights[draws_remaining][2] = 0.14
    weights[draws_remaining][3] = 0.20
    weights[active_opponents][0] = 0.08
    weights[active_opponents][3] = -0.05
    weights[active_opponents][4] = -0.05

    # Flatten row-major [96, 6].
    return [value for row in weights for value in row], bias


def make_model(model_id: str, spec: Dict[str, float]):
    weights, bias = build_linear_weights(
        aggression=float(spec["aggression"]),
        patience=float(spec["patience"]),
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
        producer_name="mgx-bootstrap-policy",
        opset_imports=[helper.make_operatorsetid("", 13)],
    )
    model.ir_version = 8
    checker.check_model(model)
    return model


def read_registry(path: Path):
    return json.loads(path.read_text(encoding="utf8"))


def write_registry(path: Path, registry):
    path.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf8")


def update_registry_checksums(registry_path: Path, checksums: Dict[str, str]):
    registry = read_registry(registry_path)
    missing = set(checksums)
    for entry in registry:
        model_id = entry.get("id")
        if model_id in checksums:
            entry["checksumSha256"] = checksums[model_id]
            missing.discard(model_id)
    if missing:
        raise ValueError(f"Registry missing model ids: {', '.join(sorted(missing))}")
    write_registry(registry_path, registry)


def build_models(output_dir: Path, registry_path: Path, update_registry: bool):
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
                "path": str(destination),
                "checksumSha256": checksum,
                "type": "bootstrap-linear-policy",
            }
        )
    if update_registry:
        update_registry_checksums(registry_path, checksums)
    return results


def parse_args():
    parser = argparse.ArgumentParser(description="Build Badugi bootstrap ONNX policies.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    parser.add_argument("--no-update-registry", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    results = build_models(
        output_dir=Path(args.output_dir),
        registry_path=Path(args.registry),
        update_registry=not args.no_update_registry,
    )
    if args.json:
        print(json.dumps({"models": results}, indent=2))
    else:
        for result in results:
            print(
                f"[ONNX] {result['id']} -> {result['path']} "
                f"sha256={result['checksumSha256']}"
            )


if __name__ == "__main__":
    main()
