"""Check a frozen priority screen reservation against independently inventoried seeds."""

import argparse
import json
from pathlib import Path

import numpy as np

from rl.training.collect_badugi_entry_m2_draft import load_residue_index
from rl.training.entry_m2_sampling_contract import DECK_MODULUS
from rl.training.plan_badugi_entry_m2_priority_screen import TARGETS_SHA256, build_design, load_priority_targets
from rl.training.reconcile_badugi_entry_m2_priority_run import _is_sha256, _read_sealed
from rl.training.recount_badugi_entry_m2_priority_screen import SCREEN_PLAN_SCHEMA


HISTORY_SCHEMA = "mgx-d03-entry-m2-priority-seed-history/v2"
AUDIT_SCHEMA = "mgx-d03-entry-m2-priority-reservation-audit/v2"
SOLVER_LAB_INDEX_SHA256 = "e8661ba55651e1f3ec12d858c6509a27af37de203fdb08df4d071275bbcc5ed6"


def collision_counts(reserved, recorded, intervals: list) -> dict:
    """Count collisions with finite uint32 values and half-open historic intervals."""
    if not isinstance(intervals, list) or not intervals:
        raise ValueError("M2 historical screen intervals are missing")
    previous_end = -1
    for interval in intervals:
        if not isinstance(interval, list) or len(interval) != 2:
            raise ValueError("M2 historical screen interval must be [start, end)")
        start, end = interval
        if (type(start) is not int or type(end) is not int or
                not 0 <= start < end <= DECK_MODULUS or start < previous_end):
            raise ValueError("M2 historical screen intervals overlap or are out of uint32 order")
        previous_end = end
    starts, ends = np.asarray(intervals, dtype=np.uint64).T
    insertion = np.searchsorted(recorded, reserved)
    finite_hit = ((insertion < len(recorded)) &
                  (recorded[np.minimum(insertion, len(recorded) - 1)] == reserved))
    interval_index = np.searchsorted(starts, reserved, side="right") - 1
    interval_hit = ((interval_index >= 0) & (reserved < ends[np.maximum(interval_index, 0)]))
    return {
        "recordedSeedCollisions": int(np.count_nonzero(finite_hit)),
        "historicalScreenCollisions": int(np.count_nonzero(interval_hit)),
        "distinctCollisions": int(np.count_nonzero(finite_hit | interval_hit)),
    }


def audit_reservation(plan_path: Path, plan_sha: str, history_sha: str) -> dict:
    folder = plan_path.parent
    plan = json.loads(_read_sealed(folder, plan_path.name, plan_sha))
    if (plan.get("schema") != SCREEN_PLAN_SCHEMA or plan.get("status") != "FROZEN_BEFORE_SCREEN" or
            plan.get("stage") != "PRIORITY_HERO_OPENING_CARDS_ONLY" or
            plan.get("targetsSha256") != TARGETS_SHA256 or plan.get("seedHistorySha256") != history_sha):
        raise ValueError("M2 priority reservation is not a frozen plan linked to seed history")
    history = json.loads(_read_sealed(folder, plan["seedHistoryFile"], history_sha))
    if (history.get("schema") != HISTORY_SCHEMA or
            history.get("status") != "INDEPENDENT_SOURCE_SCOPE_VERIFIED" or
            history.get("unresolvedSourceScopes") != [] or
            not _is_sha256(history.get("sourceInventorySha256")) or
            history.get("solverLabIndexSha256") != SOLVER_LAB_INDEX_SHA256):
        raise ValueError("M2 historical source scope remains unresolved")
    _read_sealed(folder, history["sourceInventoryFile"], history["sourceInventorySha256"])

    _read_sealed(folder, plan["targetsFile"], TARGETS_SHA256)
    design = build_design(load_priority_targets(folder / plan["targetsFile"]))
    if json.loads(_read_sealed(folder, plan["designFile"], plan["designSha256"])) != design:
        raise ValueError("M2 priority reservation allocation differs from the reference design")
    schedule_raw = _read_sealed(folder, plan["scheduleFile"], plan["scheduleSha256"])
    residues_raw = _read_sealed(folder, plan["screenedDeckResiduesFile"],
                                plan["screenedDeckResiduesSha256"])
    count = design["maxReservedDeals"]
    if len(schedule_raw) != count * 4 or len(residues_raw) != count * 4:
        raise ValueError("M2 priority reservation omits part of a planned queue")
    schedule = np.frombuffer(schedule_raw, dtype="<u4")
    reserved = np.frombuffer(residues_raw, dtype="<u4")
    if np.any(reserved[1:] <= reserved[:-1]) or not np.array_equal(np.sort(schedule), reserved):
        raise ValueError("M2 priority schedule repeats or differs from the reserved set")

    recorded = load_residue_index(history, folder, "recordedDeckResidues")
    solver = _read_sealed(folder, history["solverLabIndexFile"], SOLVER_LAB_INDEX_SHA256)
    solver_seeds = np.frombuffer(solver, dtype="<u4")
    positions = np.searchsorted(recorded, solver_seeds)
    if (len(solver_seeds) != 15_000 or np.any(positions >= len(recorded)) or
            not np.array_equal(recorded[positions], solver_seeds)):
        raise ValueError("M2 reserve audit index omits confirmed Solver Lab deals")
    intervals = json.loads(_read_sealed(
        folder, history["historicalScreenIntervalsFile"], history["historicalScreenIntervalsSha256"],
    ))
    collisions = collision_counts(reserved, recorded, intervals)
    return {
        "schema": AUDIT_SCHEMA,
        "status": "PASS_NO_RESERVATION_COLLISION" if collisions["distinctCollisions"] == 0
                  else "FAIL_RESERVATION_COLLISION",
        "scope": "Provided independently inventoried seed scope only",
        "screenPlanSha256": plan_sha, "seedHistorySha256": history_sha,
        "sourceInventorySha256": history["sourceInventorySha256"],
        "screenedDeckResiduesSha256": plan["screenedDeckResiduesSha256"],
        "recordedDeckResiduesSha256": history["recordedDeckResiduesSha256"],
        "historicalScreenIntervalsSha256": history["historicalScreenIntervalsSha256"],
        "fullReservedDeals": count, **collisions,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--plan-sha256", required=True)
    parser.add_argument("--history-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError("M2 priority reservation audit already exists")
    result = audit_reservation(args.plan, args.plan_sha256, args.history_sha256)
    with args.output.open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    if result["distinctCollisions"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
