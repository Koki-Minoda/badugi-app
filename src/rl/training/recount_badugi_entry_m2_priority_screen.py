"""Reproduce an archived priority M2 hero-only screen and verify its selection."""

import argparse
import json
from pathlib import Path

import numpy as np

from rl.training.collect_badugi_entry_m2_draft import sha256
from rl.training.entry_m2_sampling_contract import PROFILES, best_badugi, parse_cards, stratum
from rl.training.plan_badugi_entry_m2_priority_screen import (
    TARGETS_SHA256, build_design, load_priority_targets, verify_selected_schedule,
)
from rl.training.reconcile_badugi_entry_m2_priority_run import RECOUNT_SCHEMA, _read_sealed


SCREEN_PLAN_SCHEMA = "mgx-d03-entry-m2-priority-screen/v2"
SCREEN_RESULT_SCHEMA = "mgx-d03-entry-m2-priority-screen-result/v2"
UINT32_MASK = 2**32 - 1
ORDERED_DECK = tuple(f"{rank}{suit}" for suit in "SHDC"
                     for rank in ("A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"))


def preview_own_cards(seed: int, hero_seat: int) -> list[str]:
    """Independent integer reproduction of the JS hand-zero shuffle and pop order."""
    deck = list(ORDERED_DECK)
    state = seed
    for index in range(len(deck) - 1, 0, -1):
        state = (state + 0x6D2B79F5) & UINT32_MASK
        value = ((state ^ (state >> 15)) * (state | 1)) & UINT32_MASK
        value ^= (value + ((value ^ (value >> 7)) * (value | 61))) & UINT32_MASK
        random_u32 = value ^ (value >> 14)
        target = (random_u32 * (index + 1)) >> 32
        deck[index], deck[target] = deck[target], deck[index]
    start = len(deck) - 4 * hero_seat
    return list(reversed(deck[start - 4:start]))


def recount_prefixes(design: dict, schedule, trace) -> tuple[list[dict], int]:
    """Require the exact contiguous prefix up to the last eligible own hand."""
    selected = []
    preview_count = 0
    rows = iter(trace)
    end = object()
    for queue in design["queues"]:
        matches = 0
        for ordinal in range(queue["maxPreviews"]):
            row = next(rows, end)
            if not isinstance(row, dict):
                raise ValueError("M2 priority screen trace ended before its queue was complete")
            reserved_index = queue["reservedOffset"] + ordinal
            seed = int(schedule[reserved_index])
            hero_seat = queue["heroSeat"]
            for field, expected in (("queueIndex", queue["queueIndex"]), ("screenOrdinal", ordinal),
                                    ("reservedIndex", reserved_index), ("heroSeat", hero_seat),
                                    ("seed", seed)):
                if type(row.get(field)) is not int or row[field] != expected:
                    raise ValueError("M2 priority screen row differs from its reserved prefix")
            cards = preview_own_cards(seed, hero_seat)
            opening_class = stratum(*best_badugi(parse_cards(cards)))
            if (row.get("cards") != cards or row.get("stratum") != opening_class):
                raise ValueError("M2 priority screen cards or class disagree with the reproduced deal")
            preview_count += 1
            if opening_class != queue["stratum"]:
                continue
            selected.append({
                "queueIndex": queue["queueIndex"], "screenOrdinal": ordinal,
                "reservedIndex": reserved_index, "seed": seed, "group": queue["group"],
                "profile": PROFILES[matches % len(PROFILES)], "stratum": opening_class,
                "heroSeat": hero_seat, "expectedOpeningDealerSeat": queue["expectedOpeningDealerSeat"],
                "expectedOpeningPosition": queue["openingPosition"], "expectedOpeningActorCards": cards,
            })
            matches += 1
            if matches == queue["requiredAccepts"]:
                break
        if matches != queue["requiredAccepts"]:
            raise ValueError("M2 priority screen exhausted a queue before reaching its allocation")
    if next(rows, end) is not end:
        raise ValueError("M2 priority screen includes rows after the selected prefixes")
    return selected, preview_count


def recount_screen(plan_path: Path, plan_sha: str, result_sha: str) -> dict:
    folder = plan_path.parent
    plan = json.loads(_read_sealed(folder, plan_path.name, plan_sha))
    if (plan.get("schema") != SCREEN_PLAN_SCHEMA or plan.get("status") != "FROZEN_BEFORE_SCREEN" or
            plan.get("stage") != "PRIORITY_HERO_OPENING_CARDS_ONLY" or
            plan.get("targetsSha256") != TARGETS_SHA256):
        raise ValueError("M2 priority screen requires a frozen hero-only plan")
    _read_sealed(folder, plan["targetsFile"], TARGETS_SHA256)
    design = build_design(load_priority_targets(folder / plan["targetsFile"]))
    stored = json.loads(_read_sealed(folder, plan["designFile"], plan["designSha256"]))
    if stored != design:
        raise ValueError("M2 priority screen allocation differs from the reference design")

    schedule_raw = _read_sealed(folder, plan["scheduleFile"], plan["scheduleSha256"])
    residues_raw = _read_sealed(folder, plan["screenedDeckResiduesFile"],
                                plan["screenedDeckResiduesSha256"])
    n = design["maxReservedDeals"]
    if len(schedule_raw) != n * 4 or len(residues_raw) != n * 4:
        raise ValueError("M2 priority screen reservation does not cover all queue suffixes")
    schedule = np.frombuffer(schedule_raw, dtype="<u4")
    residues = np.frombuffer(residues_raw, dtype="<u4")
    if np.any(residues[1:] <= residues[:-1]) or not np.array_equal(np.sort(schedule), residues):
        raise ValueError("M2 priority reservations repeat or differ from the full residue index")

    result = json.loads(_read_sealed(folder, plan["resultFile"], result_sha))
    if (result.get("schema") != SCREEN_RESULT_SCHEMA or
            result.get("status") != "SCREENED_FOR_PRIORITY_SAFETY_COLLECTION" or
            result.get("screenPlanSha256") != plan_sha):
        raise ValueError("M2 priority screen is incomplete or references a different plan")
    selected = json.loads(_read_sealed(folder, plan["selectedFile"], result["selectedSha256"]))
    verify_selected_schedule(design, selected)
    name = plan["traceFile"]
    if not isinstance(name, str) or not name or Path(name).name != name or name in (".", ".."):
        raise ValueError("M2 priority screen trace must be a run-local file")
    trace_path = folder / name
    trace_sha = result["screenTraceSha256"]
    if sha256(trace_path) != trace_sha:
        raise ValueError("M2 priority screen trace SHA differs")
    with trace_path.open("rb") as trace:
        def read_rows():
            for line in trace:
                if not line.endswith(b"\n"):
                    raise ValueError("M2 priority screen trace ends with an incomplete record")
                yield json.loads(line)
        recounted, preview_count = recount_prefixes(design, schedule, read_rows())
    if (sha256(trace_path) != trace_sha or recounted != selected or
            result.get("previewedDeals") != preview_count or
            result.get("unusedReservedDeals") != n - preview_count):
        raise ValueError("M2 priority selection or preview/unused counts differ from the recount")
    return {
        "schema": RECOUNT_SCHEMA, "status": "PASS",
        "scope": "Archived screen selection and full reservation identity only",
        "screenPlanSha256": plan_sha, "screenResultSha256": result_sha,
        "designSha256": plan["designSha256"], "screenTraceSha256": trace_sha,
        "selectedSha256": result["selectedSha256"],
        "screenedDeckResiduesSha256": plan["screenedDeckResiduesSha256"],
        "acceptedAttempts": len(selected), "previewedDeals": preview_count,
        "unusedReservedDeals": n - preview_count, "fullReservedDeals": n,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--plan-sha256", required=True)
    parser.add_argument("--result-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError("M2 priority recount already exists")
    result = recount_screen(args.plan, args.plan_sha256, args.result_sha256)
    with args.output.open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")


if __name__ == "__main__":
    main()
