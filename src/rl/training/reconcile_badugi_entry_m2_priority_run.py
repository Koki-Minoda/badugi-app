"""Verify a completed targeted M2 pilot and count opportunities without scoring EV."""

import argparse
import hashlib
import json
from pathlib import Path

from rl.training.badugi_starting_ranges import all_starting_score_keys
from rl.training.entry_m2_sampling_contract import TOTAL_INITIAL_HANDS
from rl.training.plan_badugi_entry_m2_priority_screen import (
    TARGETS_SHA256, build_design, load_priority_targets, verify_selected_schedule,
)
from rl.training.summarize_badugi_entry_m2_gaps import verify_row_against_selected
from rl.training.summarize_badugi_entry_m2_priority_attempts import summarize_priority_attempts


PLAN_SCHEMA = "mgx-d03-entry-m2-priority-collector/v2"
RESULT_SCHEMA = "mgx-d03-entry-m2-priority-result/v2"
RECOUNT_SCHEMA = "mgx-d03-entry-m2-priority-screen-recount/v2"


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _is_sha256(value: object) -> bool:
    return (isinstance(value, str) and len(value) == 64 and
            all(character in "0123456789abcdef" for character in value))


def _read_sealed(folder: Path, name: str, expected_sha: str) -> bytes:
    if not isinstance(name, str) or not name or Path(name).name != name or name in (".", ".."):
        raise ValueError("M2 priority plan requires a run-local artifact filename")
    data = (folder / name).read_bytes()
    if not _is_sha256(expected_sha) or _digest(data) != expected_sha:
        raise ValueError(f"M2 priority artifact SHA mismatch: {name}")
    return data


def bind_completed_attempt(row: dict, selected: dict, index: int) -> None:
    """Bind one raw row to the predeclared deal, allocation, and public seat."""
    verify_row_against_selected(row, selected, index)
    integer_fields = ("globalIndex", "seed", "queueIndex", "heroSeat",
                      "openingDealerSeat", "openingPosition")
    if (any(type(row.get(field)) is not int for field in integer_fields) or
            row["queueIndex"] != selected["queueIndex"] or
            row.get("openingActorCards") != selected["expectedOpeningActorCards"] or
            row.get("openingDealerSeat") != selected["expectedOpeningDealerSeat"] or
            row.get("openingPosition") != selected["expectedOpeningPosition"]):
        raise ValueError("M2 priority raw row opening evidence differs from the sealed schedule")


def reconcile_priority_run(plan_path: Path, expected_plan_sha: str,
                           expected_result_sha: str) -> dict:
    folder = plan_path.parent
    plan = json.loads(_read_sealed(folder, plan_path.name, expected_plan_sha))
    if (plan.get("schema") != PLAN_SCHEMA or plan.get("status") != "FROZEN_BEFORE_COLLECTION" or
            plan.get("stage") != "PRIORITY_ENTRY_OPPORTUNITY_SAFETY_ONLY" or
            plan.get("targetsSha256") != TARGETS_SHA256 or plan.get("plannedAttempts") != 4_900):
        raise ValueError("M2 priority plan is not a frozen 4,900-attempt safety collection")

    targets_file = plan["targetsFile"]
    _read_sealed(folder, targets_file, TARGETS_SHA256)
    targets = load_priority_targets(folder / targets_file)
    design = build_design(targets)
    stored_design = json.loads(_read_sealed(folder, plan["designFile"], plan["designSha256"]))
    if stored_design != design:
        raise ValueError("M2 priority stored allocation differs from the reference design")
    selected = json.loads(_read_sealed(folder, plan["selectedFile"], plan["selectedSha256"]))
    verify_selected_schedule(design, selected)

    recount = json.loads(_read_sealed(folder, plan["screenRecountFile"], plan["screenRecountSha256"]))
    screen_inputs = ("screenPlanSha256", "screenTraceSha256", "screenedDeckResiduesSha256")
    if (recount.get("schema") != RECOUNT_SCHEMA or recount.get("status") != "PASS" or
            recount.get("selectedSha256") != plan["selectedSha256"] or
            recount.get("designSha256") != plan["designSha256"] or
            any(not _is_sha256(plan.get(field)) or recount.get(field) != plan[field]
                for field in screen_inputs) or
            recount.get("acceptedAttempts") != 4_900):
        raise ValueError("M2 priority screen recount does not bind the selected allocation")

    result = json.loads(_read_sealed(folder, plan["resultFile"], expected_result_sha))
    if (result.get("schema") != RESULT_SCHEMA or
            result.get("status") != "COMPLETE_PRIORITY_OPPORTUNITY_SAFETY_ONLY" or
            result.get("planSha256") != expected_plan_sha or
            result.get("selectedSha256") != plan["selectedSha256"] or
            result.get("completedAttempts") != 4_900):
        raise ValueError("M2 priority result is incomplete or references another collection")
    raw = _read_sealed(folder, plan["rowsFile"], result["rowsSha256"])
    if not raw.endswith(b"\n"):
        raise ValueError("M2 priority raw collection ends with an incomplete record")
    rows = [json.loads(line) for line in raw.splitlines()]
    if len(rows) != len(selected):
        raise ValueError("M2 priority raw row count differs from the sealed schedule")
    for index, (row, expected) in enumerate(zip(rows, selected)):
        bind_completed_attempt(row, expected, index)
    cutoff = all_starting_score_keys()[int((TOTAL_INITIAL_HANDS - 1) * 0.70)]
    return {
        "status": "PRIORITY_OPPORTUNITY_COUNTS_ONLY",
        "scope": "Known artificial opponents, no policy value or range recommendation",
        "completedAttempts": len(rows),
        "conditions": summarize_priority_attempts(targets, rows, cutoff),
        "provenance": {
            "planSha256": expected_plan_sha, "targetsSha256": TARGETS_SHA256,
            "selectedSha256": plan["selectedSha256"], "rowsSha256": result["rowsSha256"],
            "screenRecountSha256": plan["screenRecountSha256"], "resultSha256": expected_result_sha,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--plan-sha256", required=True)
    parser.add_argument("--result-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError("M2 priority summary already exists")
    result = reconcile_priority_run(args.plan, args.plan_sha256, args.result_sha256)
    with args.output.open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")


if __name__ == "__main__":
    main()
