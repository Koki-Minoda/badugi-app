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
DRAW_ACTIONS = ["draw_0", "draw_1", "draw_2", "draw_3", "draw_4", "draw_5"]


def parse_args():
    parser = argparse.ArgumentParser(description="Convert JSONL hand logs into RL dataset format.")
    parser.add_argument("--input", required=True, help="Path to exported JSONL from the app.")
    parser.add_argument("--output", required=True, help="Destination JSON file for the dataset.")
    parser.add_argument(
        "--require-clean-dataset",
        action="store_true",
        help="Fail the export if any transition has validation warnings.",
    )
    return parser.parse_args()


def _empty_vector():
    return [0.0 for _ in range(VECTOR_SIZE)]


def _normalize_action(action):
    return str(action or "").strip().lower()


def _variant_id_for(entry):
    metadata = entry.get("metadata") or {}
    return (
        metadata.get("variantId")
        or metadata.get("variant_id")
        or entry.get("variantId")
        or entry.get("variant_id")
        or entry.get("gameId")
        or entry.get("game_id")
    )


def _draw_info_for(entry):
    metadata = entry.get("metadata") or {}
    return entry.get("drawInfo") or metadata.get("drawInfo") or metadata.get("draw_info") or {}


def _draw_count_for(entry):
    draw_info = _draw_info_for(entry)
    candidates = [
        entry.get("drawCount"),
        entry.get("draw_count"),
        draw_info.get("drawCount") if isinstance(draw_info, dict) else None,
        draw_info.get("draw_count") if isinstance(draw_info, dict) else None,
    ]
    for candidate in candidates:
        if isinstance(candidate, int) and candidate >= 0:
            return candidate
    if isinstance(draw_info, dict):
        for key in ("discardIndexes", "drawIndexes", "discarded"):
            value = draw_info.get(key)
            if isinstance(value, list):
                return len(value)
    return 0


def _action_for(entry):
    action = _normalize_action(entry.get("action") or entry.get("type"))
    if action in {"draw", "draw_action"}:
        return f"draw_{min(5, max(0, _draw_count_for(entry)))}"
    if action == "pat":
        return "draw_0"
    return action


def _legal_actions_for(entry):
    explicit = entry.get("legal_actions") or entry.get("legalActions")
    if isinstance(explicit, list) and explicit:
        return [_normalize_action(action) for action in explicit if _normalize_action(action)]
    phase = str(entry.get("phase") or entry.get("street") or "").upper()
    if phase == "DRAW":
        variant_id = str(_variant_id_for(entry) or "").upper()
        if variant_id == "D03":
            return DRAW_ACTIONS[:5]
        return DRAW_ACTIONS[:]
    return ACTION_PRIORITY[:]


def _observation_from_entry(entry):
    vector = entry.get("state_vector") or entry.get("stateVector")
    if isinstance(vector, list):
        normalized = [float(value) if isinstance(value, (int, float)) else 0.0 for value in vector]
        if len(normalized) >= VECTOR_SIZE:
            return normalized[:VECTOR_SIZE]
        return normalized + [0.0 for _ in range(VECTOR_SIZE - len(normalized))]
    return _empty_vector()


def _raw_observation_vector(entry):
    if not isinstance(entry, dict):
        return None
    vector = entry.get("state_vector") or entry.get("stateVector")
    return vector if isinstance(vector, list) else None


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


def _transition_warnings(entry, action, legal_actions, observation, next_observation, done, next_entry):
    warnings = []
    if not _variant_id_for(entry):
        warnings.append("missing_variant_id")
    if _raw_observation_vector(entry) is None:
        warnings.append("missing_observation")
    if not done and _raw_observation_vector(next_entry) is None:
        warnings.append("missing_next_observation")
    if not action:
        warnings.append("missing_action")
    if action and action not in legal_actions and action not in {"collect", "showdown"}:
        warnings.append("action_not_in_legal_actions")
    if len(observation) != VECTOR_SIZE:
        warnings.append("observation_shape_mismatch")
    if len(next_observation) != VECTOR_SIZE:
        warnings.append("next_observation_shape_mismatch")
    raw_observation = _raw_observation_vector(entry)
    if raw_observation is not None and not all(isinstance(value, (int, float)) for value in raw_observation):
        warnings.append("raw_observation_non_numeric")
    if not all(isinstance(value, (int, float)) for value in observation):
        warnings.append("observation_non_numeric")
    if not all(isinstance(value, (int, float)) for value in next_observation):
        warnings.append("next_observation_non_numeric")
    if not legal_actions:
        warnings.append("missing_legal_actions")
    draw_info = _draw_info_for(entry)
    if action.startswith("draw_") and isinstance(draw_info, dict):
        discard_indexes = (
            draw_info.get("discardIndexes")
            or draw_info.get("drawIndexes")
            or draw_info.get("discarded")
            or []
        )
        if isinstance(discard_indexes, list):
            draw_count = _draw_count_for(entry)
            if draw_count != len(discard_indexes):
                warnings.append("draw_count_discard_indexes_mismatch")
    return warnings


def validation_summary(transitions):
    invalid_reasons = {}
    invalid = 0
    for transition in transitions:
        warnings = transition.get("metadata", {}).get("warnings") or []
        if warnings:
            invalid += 1
        for warning in warnings:
            invalid_reasons[warning] = invalid_reasons.get(warning, 0) + 1
    total = len(transitions)
    return {
        "total": total,
        "valid": total - invalid,
        "invalid": invalid,
        "invalidReasons": invalid_reasons,
        "trainingAllowed": invalid == 0,
    }


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
            action = _action_for(entry)
            done = next_entry is None or action in {"collect", "showdown"}
            legal_actions = _legal_actions_for(entry)
            observation = _observation_from_entry(entry)
            next_observation = _observation_from_entry(next_entry or {})
            warnings = _transition_warnings(entry, action, legal_actions, observation, next_observation, done, next_entry)
            transitions.append({
                "schema_version": SCHEMA_VERSION,
                "hand_id": hand_id,
                "seat": entry.get("seat"),
                "phase": entry.get("phase") or entry.get("street"),
                "observation": observation,
                "action": action,
                "reward": _reward_for(entry),
                "next_observation": next_observation,
                "done": done,
                "legal_actions": legal_actions,
                "metadata": {
                    "source_action_id": (entry.get("metadata") or {}).get("actionId"),
                    "variant_id": _variant_id_for(entry),
                    "warnings": warnings,
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
    summary = validation_summary(dataset)
    if args.require_clean_dataset and summary["invalid"] > 0:
        print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
        raise SystemExit(
            "Dataset validation failed; refusing export because --require-clean-dataset was set"
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as target:
        json.dump(
            {
                "schema_version": SCHEMA_VERSION,
                "format": "transition",
                "records": dataset,
                "count": len(dataset),
                "validation_summary": summary,
            },
            target,
            ensure_ascii=False,
            indent=2,
        )
    print(f"[RL] Exported {len(dataset)} records -> {output_path}")
    print(f"[RL] Validation summary: {json.dumps(summary, ensure_ascii=False, sort_keys=True)}")


if __name__ == "__main__":
    main()
