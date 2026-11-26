"""Preflight a frozen priority M2 screen before starting the hero-only worker."""

import argparse
import json
import os
from pathlib import Path
import subprocess

from rl.training.collect_badugi_entry_m2_draft import ROOT, sha256
from rl.training.collect_badugi_entry_m2_priority import (
    mark_started, verify_ci_receipt, verify_reservation_receipt,
)
from rl.training.plan_badugi_entry_m2_priority_screen import TARGETS_SHA256, build_design, load_priority_targets
from rl.training.reconcile_badugi_entry_m2_priority_run import _read_sealed
from rl.training.recount_badugi_entry_m2_priority_screen import SCREEN_PLAN_SCHEMA, SCREEN_RESULT_SCHEMA


WORKER = ROOT / "scripts/badugi-entry-m2-priority-screen.mjs"
START_MARKER = "priority-screen-started.json"
TRACE_FILE = "priority-screen-trace.jsonl"
SELECTED_FILE = "priority-screen-selected.json"
RESULT_FILE = "priority-screen-result.json"


def preflight_screen(plan_path: Path, plan_sha: str, reservation_audit_sha: str) -> tuple[dict, dict]:
    folder = plan_path.parent
    plan = json.loads(_read_sealed(folder, plan_path.name, plan_sha))
    if (plan.get("schema") != SCREEN_PLAN_SCHEMA or plan.get("status") != "FROZEN_BEFORE_SCREEN" or
            plan.get("stage") != "PRIORITY_HERO_OPENING_CARDS_ONLY" or
            plan.get("targetsSha256") != TARGETS_SHA256 or
            plan.get("runFolder") != str(folder.resolve()) or
            plan.get("traceFile") != TRACE_FILE or plan.get("selectedFile") != SELECTED_FILE or
            plan.get("resultFile") != RESULT_FILE or
            type(plan.get("screenTimeoutSeconds")) is not int or
            not 1 <= plan["screenTimeoutSeconds"] <= 1800):
        raise ValueError("M2 priority screen requires a frozen hero-only plan and output budget")
    receipt = json.loads(_read_sealed(folder, plan["reservationAuditFile"], reservation_audit_sha))
    verify_reservation_receipt({**plan, "screenPlanSha256": plan_sha}, receipt)
    ci = json.loads(_read_sealed(folder, plan["ciReceiptFile"], plan["ciReceiptSha256"]))
    verify_ci_receipt(plan, ci)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    dirty = subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip()
    if (head != plan.get("codeGitSha") or dirty or sha256(Path(__file__)) != plan.get("screenRunnerSha256") or
            sha256(WORKER) != plan.get("screenWorkerSha256")):
        raise ValueError("M2 priority screen requires the frozen clean checkout and code hashes")

    _read_sealed(folder, plan["targetsFile"], TARGETS_SHA256)
    design = build_design(load_priority_targets(folder / plan["targetsFile"]))
    stored = json.loads(_read_sealed(folder, plan["designFile"], plan["designSha256"]))
    if stored != design:
        raise ValueError("M2 priority screen allocation differs from the reference design")
    reserved_count_bytes = design["maxReservedDeals"] * 4
    if (len(_read_sealed(folder, plan["scheduleFile"], plan["scheduleSha256"])) != reserved_count_bytes or
            len(_read_sealed(folder, plan["screenedDeckResiduesFile"],
                             plan["screenedDeckResiduesSha256"])) != reserved_count_bytes):
        raise ValueError("M2 priority screen reservation omits required slots")
    return plan, design


def run_screen(plan_path: Path, plan_sha: str, reservation_audit_sha: str) -> dict:
    plan, design = preflight_screen(plan_path, plan_sha, reservation_audit_sha)
    folder = plan_path.parent.resolve()
    mark_started(folder, plan_sha, marker_file=START_MARKER,
                 protected_files=(TRACE_FILE, SELECTED_FILE, RESULT_FILE))
    payload = {key: plan[key] for key in ("scheduleFile", "scheduleSha256", "traceFile",
                                         "selectedFile", "resultFile")}
    payload.update(folder=str(folder), design=design, screenPlanSha256=plan_sha)
    subprocess.run(["node", str(WORKER)], input=json.dumps(payload), text=True, cwd=ROOT,
                   timeout=plan["screenTimeoutSeconds"], check=True)
    result_path = folder / RESULT_FILE
    result = json.loads(result_path.read_bytes())
    previewed = result.get("previewedDeals")
    unused = result.get("unusedReservedDeals")
    accepted = result.get("acceptedAttempts")
    planned = design["plannedCompletedAttempts"]
    succeeded = result.get("status") == "SCREENED_FOR_PRIORITY_SAFETY_COLLECTION"
    if (result.get("schema") != SCREEN_RESULT_SCHEMA or result.get("screenPlanSha256") != plan_sha or
            (not succeeded and result.get("status") != "INSUFFICIENT_SCREEN_ALLOCATION") or
            type(previewed) is not int or type(unused) is not int or
            not 0 < previewed <= design["maxReservedDeals"] or unused != design["maxReservedDeals"] - previewed or
            type(accepted) is not int or not 0 <= accepted <= min(planned, previewed) or
            sha256(folder / TRACE_FILE) != result.get("screenTraceSha256")):
        raise ValueError("M2 priority screen worker did not return a bound result")
    if succeeded:
        if (accepted != planned or result.get("shortQueues") != [] or
                sha256(folder / SELECTED_FILE) != result.get("selectedSha256")):
            raise ValueError("M2 priority screen selection did not match the worker receipt")
    elif (accepted == planned or not result.get("shortQueues") or
          os.path.lexists(folder / SELECTED_FILE) or "selectedSha256" in result):
        raise ValueError("M2 priority short screen must leave no selection")
    return {**result, "screenResultSha256": sha256(result_path), "independentRecountPending": succeeded}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--plan-sha256", required=True)
    parser.add_argument("--reservation-audit-sha256", required=True)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    if args.execute:
        result = run_screen(args.plan, args.plan_sha256, args.reservation_audit_sha256)
    else:
        _, design = preflight_screen(args.plan, args.plan_sha256, args.reservation_audit_sha256)
        result = {"status": "PREFLIGHT_ONLY", "maxReservedDeals": design["maxReservedDeals"]}
    print(json.dumps(result))
    if result["status"] == "INSUFFICIENT_SCREEN_ALLOCATION":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
