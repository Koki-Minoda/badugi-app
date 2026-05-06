"""Export Stud-family betting DQN checkpoints to frontend ONNX assets."""

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
VARIANT_BY_FAMILY = {
    "stud": ["ST1"],
    "stud8": ["ST2"],
    "razz": ["ST3"],
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def model_id_for(family: str, tier: str) -> str:
    return f"model-{family}-{tier}-dqn-v1"


def output_for(family: str, tier: str) -> Path:
    return PROJECT_ROOT / f"public/models/{family}_{tier}_dqn_v1.onnx"


def checkpoint_for(family: str, tier: str) -> Path:
    return PROJECT_ROOT / f"rl/models/stud_{family}_{tier}_20260506/{family}_{tier}_stud_dqn_latest.pt"


def upsert_registry_entry(registry_path: Path, *, family: str, tier: str, output: Path, checksum: str, checkpoint: Path):
    registry = json.loads(registry_path.read_text(encoding="utf8"))
    model_id = model_id_for(family, tier)
    family_label = {"stud": "Stud", "stud8": "Stud Hi-Lo", "razz": "Razz"}[family]
    entry = {
        "id": model_id,
        "version": "v1",
        "variantIds": VARIANT_BY_FAMILY[family],
        "characterIds": [],
        "tier": tier,
        "onnx": f"models/{output.name}",
        "checksumSha256": checksum,
        "trainingRun": f"stud_{family}_{tier}_dqn_20260506",
        "trainingCheckpoint": checkpoint.name,
        "trainingStatus": "bootstrap-active",
        "trainingNotes": (
            f"{family_label} {tier} betting DQN trained in a synthetic Stud-family bootstrap "
            "environment with teacher warmup, fixture replay, and action masking. "
            "This model covers value bet, pressure-fold, pot-odds continue, Razz low-strength, "
            "and Stud8 scoop-potential fixtures. It is intended as a playable Beginner/Standard "
            "CPU surface for 8Game/10Game routing, not as a Pro-strength or human-verified model. "
            "Replace or re-gate after Stud/Razz progression audits and hand-history benchmark data."
        ),
        "featureSet": "stud-betting-observation-v1",
        "productionRequired": True,
        "inputShape": [16],
        "outputShape": [6],
    }
    for index, current in enumerate(registry):
        if current.get("id") == model_id:
            registry[index] = entry
            break
    else:
        insert_at = 1 if registry and registry[0].get("id") == "model-nlh-v1" else 0
        registry.insert(insert_at, entry)
    registry_path.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf8")


def export_stud_checkpoint(
    *,
    family: str,
    tier: str,
    checkpoint: Path,
    output: Path,
    registry: Path,
    update_registry_file: bool,
    device: str,
):
    if family not in VARIANT_BY_FAMILY:
        raise ValueError(f"Unsupported family: {family}")
    if not checkpoint.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint}")
    agent = DQNAgent.load(str(checkpoint), device=device)
    if agent.obs_dim != 16:
        raise ValueError(f"Expected obs_dim 16, got {agent.obs_dim}")
    if agent.n_actions != 6:
        raise ValueError(f"Expected n_actions 6, got {agent.n_actions}")
    output.parent.mkdir(parents=True, exist_ok=True)
    agent.q_network.eval()
    dummy = torch.zeros(16, dtype=torch.float32, device=agent.device)
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
        upsert_registry_entry(
            registry,
            family=family,
            tier=tier,
            output=output,
            checksum=checksum,
            checkpoint=checkpoint,
        )
    return {
        "family": family,
        "tier": tier,
        "checkpoint": str(checkpoint),
        "output": str(output),
        "modelId": model_id_for(family, tier),
        "checksumSha256": checksum,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Export Stud-family DQN checkpoint to ONNX.")
    parser.add_argument("--family", choices=sorted(VARIANT_BY_FAMILY), required=True)
    parser.add_argument("--tier", choices=["beginner", "standard"], required=True)
    parser.add_argument("--checkpoint", default=None)
    parser.add_argument("--output", default=None)
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--no-update-registry", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    result = export_stud_checkpoint(
        family=args.family,
        tier=args.tier,
        checkpoint=Path(args.checkpoint) if args.checkpoint else checkpoint_for(args.family, args.tier),
        output=Path(args.output) if args.output else output_for(args.family, args.tier),
        registry=Path(args.registry),
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
