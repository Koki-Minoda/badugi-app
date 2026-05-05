"""Export trained 2-7/A-5 draw DQN checkpoints to frontend ONNX assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

try:
    import torch
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: torch. Install RL deps first: "
        "python3 -m pip install -r src/rl/requirements.txt"
    ) from exc

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.agents.dqn_agent import DQNAgent

DEFAULT_REGISTRY_PATH = PROJECT_ROOT / "src/config/ai/modelRegistry.json"
MODEL_BY_FAMILY = {
    "low-27": {
        "checkpoint": PROJECT_ROOT / "rl/models/draw/low-27_draw_dqn_latest.pt",
        "output": PROJECT_ROOT / "public/models/27draw_iron_v1.onnx",
        "model_id": "model-27draw-iron-v1",
        "training_run": "draw_low27_dqn",
    },
    "low-a5": {
        "checkpoint": PROJECT_ROOT / "rl/models/draw/low-a5_draw_dqn_latest.pt",
        "output": PROJECT_ROOT / "public/models/a5draw_iron_v1.onnx",
        "model_id": "model-a5draw-iron-v1",
        "training_run": "draw_a5_dqn",
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def update_registry(registry_path: Path, model_id: str, checksum: str, checkpoint: Path):
    registry = json.loads(registry_path.read_text(encoding="utf8"))
    for entry in registry:
        if entry.get("id") == model_id:
            entry["checksumSha256"] = checksum
            entry["trainingStatus"] = "active"
            entry["trainingCheckpoint"] = checkpoint.name
            entry["trainingNotes"] = (
                "Variant-specific draw DQN trained in the simplified fixed-limit "
                "lowball environment with teacher warmup and mixed opponent "
                "profiles. Requires human/practice benchmark before promotion "
                "above Iron."
            )
            registry_path.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf8")
            return
    raise ValueError(f"Model id not found in registry: {model_id}")


def export_draw_checkpoint(
    *,
    family: str,
    checkpoint: Path,
    output: Path,
    registry: Path,
    model_id: str,
    update_registry_file: bool,
    device: str,
):
    if not checkpoint.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint}")
    agent = DQNAgent.load(str(checkpoint), device=device)
    if agent.obs_dim != 96:
        raise ValueError(f"Expected obs_dim 96, got {agent.obs_dim}")
    if agent.n_actions != 11:
        raise ValueError(f"Expected n_actions 11, got {agent.n_actions}")
    output.parent.mkdir(parents=True, exist_ok=True)
    agent.q_network.eval()
    dummy = torch.zeros(96, dtype=torch.float32, device=agent.device)
    torch.onnx.export(
        agent.q_network,
        dummy,
        str(output),
        input_names=["input"],
        output_names=["output"],
        opset_version=18,
        external_data=False,
    )
    checksum = sha256(output)
    if update_registry_file:
        update_registry(registry, model_id, checksum, checkpoint)
    return {
        "family": family,
        "checkpoint": str(checkpoint),
        "output": str(output),
        "modelId": model_id,
        "checksumSha256": checksum,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Export draw DQN checkpoint to ONNX.")
    parser.add_argument("--family", choices=sorted(MODEL_BY_FAMILY), required=True)
    parser.add_argument("--checkpoint", default=None)
    parser.add_argument("--output", default=None)
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    parser.add_argument("--model-id", default=None)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--no-update-registry", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    defaults = MODEL_BY_FAMILY[args.family]
    result = export_draw_checkpoint(
        family=args.family,
        checkpoint=Path(args.checkpoint) if args.checkpoint else defaults["checkpoint"],
        output=Path(args.output) if args.output else defaults["output"],
        registry=Path(args.registry),
        model_id=args.model_id or str(defaults["model_id"]),
        update_registry_file=not args.no_update_registry,
        device=args.device,
    )
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(
            f"[ONNX] {result['modelId']} {result['checkpoint']} -> "
            f"{result['output']} sha256={result['checksumSha256']}"
        )


if __name__ == "__main__":
    main()
