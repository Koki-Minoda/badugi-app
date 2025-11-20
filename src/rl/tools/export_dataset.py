#!/usr/bin/env python3
"""
Convert Badugi action logs (JSONL) into a simplified RL dataset.

Usage:
    python rl/tools/export_dataset.py --input hand_logs.jsonl --output dataset.json
"""

import argparse
import json
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Convert JSONL hand logs into RL dataset format.")
    parser.add_argument("--input", required=True, help="Path to exported JSONL from the app.")
    parser.add_argument("--output", required=True, help="Destination JSON file for the dataset.")
    return parser.parse_args()


def build_dataset(lines):
    dataset = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        record = json.loads(line)
        observation = {
            "handId": record.get("handId"),
            "gameId": record.get("gameId"),
            "dealerIdx": record.get("dealerIdx"),
            "players": record.get("players"),
        }
        rewards = record.get("winners", [])
        dataset.append({
            "observation": observation,
            "actions": record.get("actions", []),
            "reward": rewards,
        })
    return dataset


def main():
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")
    with input_path.open("r", encoding="utf-8") as source:
        dataset = build_dataset(source.readlines())
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as target:
        json.dump({"records": dataset, "count": len(dataset)}, target, ensure_ascii=False, indent=2)
    print(f"[RL] Exported {len(dataset)} records -> {output_path}")


if __name__ == "__main__":
    main()
