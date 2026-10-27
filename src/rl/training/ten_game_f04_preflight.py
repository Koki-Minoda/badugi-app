"""Read-only Windows resource gate for a bounded 10-Game RL checkpoint probe.

Passing this gate permits planning a small save/restore trial. It does not
verify restore semantics or authorize a long training run.
"""

from __future__ import annotations

import argparse
import json
from pathlib import PureWindowsPath

GIB = 1024**3


def evaluate_probe_readiness(
    *,
    artifact_root: str,
    system_drive: str,
    root_exists: bool,
    marker_exists: bool,
    free_bytes: int,
    available_memory_bytes: int,
    running_trainers: int,
    minimum_free_gb: float = 20.0,
    minimum_available_memory_gb: float = 4.0,
) -> dict:
    root = PureWindowsPath(artifact_root)
    system = PureWindowsPath(system_drive)
    reasons: list[str] = []
    if not root.is_absolute() or root.parent == root or len(root.drive) != 2 or not root.drive.endswith(":"):
        reasons.append("artifact root must be an absolute directory below a drive root")
    if not system.drive:
        reasons.append("system drive is unknown")
    if root.drive.upper() == system.drive.upper():
        reasons.append("artifact root must be on a non-system drive")
    if not root_exists:
        reasons.append("artifact root does not exist")
    if not marker_exists:
        reasons.append("artifact marker .mgx-rl-artifacts is missing")
    if free_bytes < minimum_free_gb * GIB:
        reasons.append(f"artifact drive has less than {minimum_free_gb:g} GiB free")
    if available_memory_bytes < minimum_available_memory_gb * GIB:
        reasons.append(f"available physical memory is below {minimum_available_memory_gb:g} GiB")
    if running_trainers > 0:
        reasons.append("another RL trainer is running")
    return {
        "probeReady": not reasons,
        "longRunReady": False,
        "reasons": reasons,
        "artifactRoot": str(root),
        "freeGiB": round(free_bytes / GIB, 2),
        "availableMemoryGiB": round(available_memory_bytes / GIB, 2),
        "runningTrainers": running_trainers,
        "remainingGates": [
            "bounded checkpoint save and SHA-256 evidence",
            "restore into a separate output directory with optimizer/counters verified",
            "peak memory measurement and one-job stop budget",
            "F03 live observation parity and independent model evaluation",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only 10-Game F04 probe preflight")
    parser.add_argument("--artifact-root", required=True)
    parser.add_argument("--system-drive", required=True)
    parser.add_argument("--root-exists", type=int, choices=(0, 1), required=True)
    parser.add_argument("--marker-exists", type=int, choices=(0, 1), required=True)
    parser.add_argument("--free-bytes", type=int, required=True)
    parser.add_argument("--available-memory-bytes", type=int, required=True)
    parser.add_argument("--running-trainers", type=int, required=True)
    parser.add_argument("--minimum-free-gb", type=float, default=20.0)
    parser.add_argument("--minimum-available-memory-gb", type=float, default=4.0)
    args = parser.parse_args()
    if min(args.free_bytes, args.available_memory_bytes, args.running_trainers) < 0:
        parser.error("resource counts cannot be negative")
    if args.minimum_free_gb <= 0 or args.minimum_available_memory_gb <= 0:
        parser.error("resource thresholds must be positive")
    result = evaluate_probe_readiness(
        artifact_root=args.artifact_root,
        system_drive=args.system_drive,
        root_exists=bool(args.root_exists),
        marker_exists=bool(args.marker_exists),
        free_bytes=args.free_bytes,
        available_memory_bytes=args.available_memory_bytes,
        running_trainers=args.running_trainers,
        minimum_free_gb=args.minimum_free_gb,
        minimum_available_memory_gb=args.minimum_available_memory_gb,
    )
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["probeReady"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
