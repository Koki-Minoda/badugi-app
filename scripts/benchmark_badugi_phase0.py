"""Bounded D03 real-controller throughput probe.

This never invokes the production trainer, loads a training checkpoint, or
writes a model. The update mode starts a fresh DQN in memory and discards it.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import random
import statistics
import subprocess
import sys
import threading
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import onnxruntime as ort
import psutil
import torch

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams  # noqa: E402
from rl.training.train_badugi_controller_v2_draft import (  # noqa: E402
    ControllerBridge,
    FrozenOnnxPolicy,
    observable_reference_action,
    run_hand,
)
from rl.utils.replay_buffer import ReplayBuffer  # noqa: E402

PRO_MODEL_ID = "model-badugi-pro-controller-v2-20261105"
PROFILES = ("passive", "pressure", "draw_heavy", "random_legal")
MODES = ("duel", "inference", "scratch-update")
FORMATS = ("cash", "mtt")
SEATS = (2, 3, 6)
TARGET_HANDS = (1_000_000, 5_000_000, 10_000_000)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def parse_items(raw: str, allowed: tuple) -> tuple:
    values = tuple(int(x) if isinstance(allowed[0], int) else x
                   for x in raw.split(","))
    if not values or len(values) != len(set(values)) or any(x not in allowed for x in values):
        raise argparse.ArgumentTypeError(f"expected unique comma-separated values from {allowed}")
    return values


class PublicReferencePolicy:
    def act(self, obs: np.ndarray, epsilon: float, action_mask: np.ndarray) -> int:
        if epsilon:
            raise ValueError("reference policy must be deterministic")
        return observable_reference_action({
            "phase": "DRAW" if obs[8] > 0.5 else "BET",
            "observation": obs,
            "legalMask": action_mask,
        })


def cpu_seconds(processes: tuple[psutil.Process, ...]) -> float:
    total = 0.0
    for proc in processes:
        try:
            used = proc.cpu_times()
            total += used.user + used.system
        except psutil.Error:
            pass
    return total


def rss_bytes(processes: tuple[psutil.Process, ...]) -> int:
    total = 0
    for proc in processes:
        try:
            total += proc.memory_info().rss
        except psutil.Error:
            pass
    return total


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    low = int(position)
    return ordered[low] + (ordered[min(low + 1, len(ordered) - 1)] - ordered[low]) * (position - low)


def run_group(*, mode: str, seats: int, tournament: bool, seed: int,
              hands: int, warmup_hands: int, torch_threads: int,
              model_path: Path, deadline: float) -> dict:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(torch_threads)
    agent = (PublicReferencePolicy() if mode == "duel" else
             FrozenOnnxPolicy(model_path) if mode == "inference" else
             DQNAgent(96, 6, device="cpu", hidden_dim=256,
                      hyperparams=DQNHyperParams(lr=0.0001, batch_size=64)))
    buffer = (ReplayBuffer(capacity=4_096, seed=seed) if mode == "scratch-update"
              else None)
    bridge = ControllerBridge()
    parent = psutil.Process()
    child = psutil.Process(bridge.process.pid)
    processes = (parent, child)
    samples: list[int] = []
    stop_sampling = threading.Event()

    def sample_rss() -> None:
        while not stop_sampling.wait(0.1):
            samples.append(rss_bytes(processes))

    sampler = threading.Thread(target=sample_rss, daemon=True)
    outcomes = []
    timings = []
    rss_at_hand = []
    profiles = Counter()
    try:
        for index in range(warmup_hands):
            response = bridge.send({
                "command": "reset", "seatCount": seats, "occupiedSeatCount": seats,
                "isTournament": tournament, "seed": seed - 100_000 - index,
            })
            run_hand(bridge, response, agent, random.Random(seed - index),
                     index % seats, PROFILES[index % len(PROFILES)], 0.0,
                     seats, seats, tournament, buffer=buffer, warmup=64)
        rss_start = rss_bytes(processes)
        cpu_start = cpu_seconds(processes)
        wall_start = time.perf_counter()
        sampler.start()
        for index in range(hands):
            if time.monotonic() > deadline:
                raise TimeoutError("benchmark exceeded --max-seconds")
            profile = PROFILES[index % len(PROFILES)]
            hand_start = time.perf_counter()
            response = bridge.send({
                "command": "reset", "seatCount": seats, "occupiedSeatCount": seats,
                "isTournament": tournament, "seed": seed + index * 1009,
            })
            result = run_hand(bridge, response, agent, random.Random(seed + index),
                              index % seats, profile, 0.0, seats, seats, tournament,
                              buffer=buffer, warmup=64)
            elapsed = time.perf_counter() - hand_start
            timings.append(elapsed)
            rss_at_hand.append(rss_bytes(processes))
            profiles[profile] += 1
            outcomes.append(result)
        wall = time.perf_counter() - wall_start
        cpu = cpu_seconds(processes) - cpu_start
        rss_end = rss_bytes(processes)
    finally:
        stop_sampling.set()
        if sampler.is_alive():
            sampler.join(timeout=1)
        bridge.close()

    return {
        "mode": mode, "seats": seats, "format": "mtt" if tournament else "cash",
        "seed": seed, "warmupHands": warmup_hands, "hands": len(outcomes),
        "profiles": dict(profiles), "wallSeconds": wall,
        "handsPerSecond": len(outcomes) / wall,
        "cpuSeconds": cpu, "effectiveCpuCores": cpu / wall,
        "rssStartMiB": rss_start / 2**20, "rssEndMiB": rss_end / 2**20,
        "rssPeakSampledMiB": max(samples + rss_at_hand + [rss_start, rss_end]) / 2**20,
        "rssEndMinusStartMiB": (rss_end - rss_start) / 2**20,
        "handSecondsP50": statistics.median(timings),
        "handSecondsP95": percentile(timings, 0.95),
        "totalDecisions": sum(x["decisions"] for x in outcomes),
        "heroDecisions": sum(x["heroActualDecisions"] for x in outcomes),
        "scratchUpdates": sum(x["updates"] for x in outcomes),
        "chipBalancedHands": sum(sum(x["chipDeltaBySeat"]) == 0 for x in outcomes),
        "perHandSeconds": timings,
        "rssAtHandMiB": [x / 2**20 for x in rss_at_hand],
        "linearExtrapolationHours": {
            str(target): target / (len(outcomes) / wall) / 3600
            for target in TARGET_HANDS
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--modes", default=",".join(MODES))
    parser.add_argument("--seats", default="2,3,6")
    parser.add_argument("--formats", default="cash,mtt")
    parser.add_argument("--seeds", default="20261116,20261117")
    parser.add_argument("--hands", type=int, default=60)
    parser.add_argument("--warmup-hands", type=int, default=5)
    parser.add_argument("--torch-threads", type=int, default=1)
    parser.add_argument("--max-seconds", type=int, default=900)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    modes = parse_items(args.modes, MODES)
    seats = parse_items(args.seats, SEATS)
    formats = parse_items(args.formats, FORMATS)
    seeds = tuple(int(x) for x in args.seeds.split(","))
    if (not seeds or len(seeds) != len(set(seeds)) or
            not 1 <= args.hands <= 5_000 or not 0 <= args.warmup_hands <= 100 or
            not 1 <= args.torch_threads <= 8 or
            not 30 <= args.max_seconds <= 7_200):
        parser.error("invalid bounded measurement options")
    output = args.output.resolve()
    protected = (ROOT / "public" / "models", ROOT / "src" / "config" / "ai",
                 ROOT / "src" / "ai")
    if output.suffix != ".json" or output.exists() or any(
            output == path or path in output.parents for path in protected):
        parser.error("output must be a new JSON path outside model/runtime directories")
    registry = json.loads((ROOT / "src/config/ai/modelRegistry.json").read_text())
    entries = registry if isinstance(registry, list) else registry.get("models", [])
    model = next(entry for entry in entries if entry.get("id") == PRO_MODEL_ID)
    model_path = ROOT / "public" / model["onnx"]
    if digest(model_path) != model["checksumSha256"]:
        raise ValueError("published Pro model checksum mismatch")
    report = {
        "schema": "mgx-d03-phase0-throughput/v1",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "scope": "real-controller bridge; no production trainer/checkpoint/model writes",
        "sourceCommit": git("rev-parse", "HEAD"),
        "sourceDirty": bool(git("status", "--porcelain")),
        "benchmarkSha256": digest(Path(__file__)),
        "bridgeSha256": digest(ROOT / "scripts/badugi-controller-v2-bridge.mjs"),
        "packageLockSha256": digest(ROOT / "package-lock.json"),
        "proModelId": PRO_MODEL_ID,
        "proModelSha256": digest(model_path),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "python": sys.version.split()[0],
        "node": subprocess.check_output(["node", "--version"], text=True).strip(),
        "versions": {
            "numpy": np.__version__, "torch": torch.__version__,
            "onnxruntime": ort.__version__, "psutil": psutil.__version__,
        },
        "cpuCountLogical": psutil.cpu_count(logical=True),
        "memoryTotalGiB": psutil.virtual_memory().total / 2**30,
        "torchThreads": args.torch_threads,
        "loadAverageAtStart": os.getloadavg(),
        "arguments": {
            "modes": modes, "seats": seats, "formats": formats, "seeds": seeds,
            "hands": args.hands, "warmupHands": args.warmup_hands,
            "maxSeconds": args.max_seconds,
        },
        "groups": [],
    }
    deadline = time.monotonic() + args.max_seconds
    for mode in modes:
        for seat_count in seats:
            for game_format in formats:
                for seed in seeds:
                    group = run_group(
                        mode=mode, seats=seat_count, tournament=game_format == "mtt",
                        seed=seed, hands=args.hands, warmup_hands=args.warmup_hands,
                        torch_threads=args.torch_threads, model_path=model_path,
                        deadline=deadline,
                    )
                    report["groups"].append(group)
                    print(f'{mode} {seat_count} {game_format} seed={seed}: '
                          f'{group["handsPerSecond"]:.2f} hand/s, '
                          f'{group["rssPeakSampledMiB"]:.1f} MiB sampled peak', flush=True)
    report["loadAverageAtEnd"] = os.getloadavg()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x") as file:
        json.dump(report, file, indent=2)
        file.write("\n")
    print(output)


if __name__ == "__main__":
    main()
