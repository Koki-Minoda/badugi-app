"""Export a trained Badugi DQN checkpoint to frontend-compatible ONNX."""

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
DEFAULT_CHECKPOINT = PROJECT_ROOT / "rl/models/badugi_dqn_latest.pt"
DEFAULT_OUTPUT = PROJECT_ROOT / "public/models/badugi_worldmaster_v1.onnx"
DEFAULT_MODEL_ID = "model-badugi-worldmaster-v1"
INPUT_SIZE = 96
OUTPUT_SIZE = 6


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def update_registry_checksum(registry_path: Path, model_id: str, checksum: str):
    registry = json.loads(registry_path.read_text(encoding="utf8"))
    for entry in registry:
        if entry.get("id") == model_id:
            entry["checksumSha256"] = checksum
            registry_path.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf8")
            return
    raise ValueError(f"Model id not found in registry: {model_id}")


def export_checkpoint(
    *,
    checkpoint: Path,
    output: Path,
    registry: Path,
    model_id: str,
    update_registry: bool,
    device: str,
):
    if not checkpoint.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint}")
    output.parent.mkdir(parents=True, exist_ok=True)
    agent = DQNAgent.load(str(checkpoint), device=device)
    if agent.obs_dim != INPUT_SIZE:
        raise ValueError(f"Expected obs_dim {INPUT_SIZE}, got {agent.obs_dim}")
    if agent.n_actions != OUTPUT_SIZE:
        raise ValueError(f"Expected n_actions {OUTPUT_SIZE}, got {agent.n_actions}")

    agent.q_network.eval()
    dummy = torch.zeros(INPUT_SIZE, dtype=torch.float32, device=agent.device)
    torch.onnx.export(
        agent.q_network,
        dummy,
        str(output),
        input_names=["input"],
        output_names=["output"],
        opset_version=18,
        # Keep production assets browser-friendly: one .onnx file under
        # public/models instead of a model file plus external .onnx.data.
        external_data=False,
    )
    checksum = sha256(output)
    if update_registry:
        update_registry_checksum(registry, model_id, checksum)
    return {
        "checkpoint": str(checkpoint),
        "output": str(output),
        "modelId": model_id,
        "checksumSha256": checksum,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Export a Badugi DQN checkpoint to ONNX.")
    parser.add_argument("--checkpoint", default=str(DEFAULT_CHECKPOINT))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    parser.add_argument("--model-id", default=DEFAULT_MODEL_ID)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--no-update-registry", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    result = export_checkpoint(
        checkpoint=Path(args.checkpoint),
        output=Path(args.output),
        registry=Path(args.registry),
        model_id=args.model_id,
        update_registry=not args.no_update_registry,
        device=args.device,
    )
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(
            f"[ONNX] {result['modelId']} {result['checkpoint']} -> {result['output']} "
            f"sha256={result['checksumSha256']}"
        )


if __name__ == "__main__":
    main()
