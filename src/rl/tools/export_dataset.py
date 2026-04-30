#!/usr/bin/env python3
"""
Convert Badugi action logs (JSONL) into a transition-style RL dataset.

Usage:
    python rl/tools/export_dataset.py --input hand_logs.jsonl --output dataset.json
"""

import argparse
import json
from pathlib import Path

SCHEMA_VERSION = "badugi-observation-v1"
VECTOR_SIZE = 96
ACTION_PRIORITY = ["fold", "check", "call", "bet", "raise", "all_in"]


def parse_args():
    parser = argparse.ArgumentParser(description="Convert JSONL hand logs into RL dataset format.")
    parser.add_argument("--input", required=True, help="Path to exported JSONL from the app.")
    parser.add_argument("--output", required=True, help="Destination JSON file for the dataset.")
    return parser.parse_args()


def _empty_vector():
    return [0.0 for _ in range(VECTOR_SIZE)]


def _normalize_action(action):
    return str(action or "").strip().lower()


def _legal_actions_for(entry):
    explicit = entry.get("legal_actions") or entry.get("legalActions")
    if isinstance(explicit, list) and explicit:
        return [_normalize_action(action) for action in explicit if _normalize_action(action)]
    phase = str(entry.get("phase") or entry.get("street") or "").upper()
    if phase == "DRAW":
        return ["draw_0", "draw_1", "draw_2", "draw_3", "draw_4"]
    return ACTION_PRIORITY[:]


def _observation_from_entry(entry):
    vector = entry.get("state_vector") or entry.get("stateVector")
    if isinstance(vector, list):
        normalized = [float(value) if isinstance(value, (int, float)) else 0.0 for value in vector]
        if len(normalized) >= VECTOR_SIZE:
            return normalized[:VECTOR_SIZE]
        return normalized + [0.0 for _ in range(VECTOR_SIZE - len(normalized))]
    return _empty_vector()


def _reward_for(entry):
    if isinstance(entry.get("reward"), (int, float)):
        return float(entry["reward"])
    action = _normalize_action(entry.get("action"))
    if action == "fold":
        return -1.0
    paid = entry.get("paid")
    if isinstance(paid, (int, float)) and paid > 0:
        return -min(float(paid), 100.0) / 100.0
    return 0.0


def _iter_action_entries(record):
    actions = record.get("actions")
    if isinstance(actions, list):
        for action in actions:
            if isinstance(action, dict):
                merged = {**record, **action}
                yield merged
        return
    yield record


def build_transitions(lines):
    grouped = {}
    for line in lines:
        line = line.strip()
        if not line:
            continue
        record = json.loads(line)
        for entry in _iter_action_entries(record):
            hand_id = entry.get("handId") or entry.get("hand_id") or "unknown-hand"
            grouped.setdefault(hand_id, []).append(entry)

    transitions = []
    for hand_id, entries in grouped.items():
        for index, entry in enumerate(entries):
            next_entry = entries[index + 1] if index + 1 < len(entries) else None
            done = next_entry is None or _normalize_action(entry.get("action")) in {"collect", "showdown"}
            transitions.append({
                "schema_version": SCHEMA_VERSION,
                "hand_id": hand_id,
                "seat": entry.get("seat"),
                "phase": entry.get("phase") or entry.get("street"),
                "observation": _observation_from_entry(entry),
                "action": _normalize_action(entry.get("action")),
                "reward": _reward_for(entry),
                "next_observation": _observation_from_entry(next_entry or {}),
                "done": done,
                "legal_actions": _legal_actions_for(entry),
                "metadata": {
                    "source_action_id": (entry.get("metadata") or {}).get("actionId"),
                    "variant_id": (entry.get("metadata") or {}).get("variantId") or entry.get("gameId"),
                },
            })
    return transitions


def build_dataset(lines):
    return build_transitions(lines)


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
        json.dump(
            {
                "schema_version": SCHEMA_VERSION,
                "format": "transition",
                "records": dataset,
                "count": len(dataset),
            },
            target,
            ensure_ascii=False,
            indent=2,
        )
    print(f"[RL] Exported {len(dataset)} records -> {output_path}")


if __name__ == "__main__":
    main()
