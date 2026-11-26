"""Guarded, single-attempt entry point for the targeted M2 safety pilot."""

import argparse
import json
import os
from pathlib import Path
import subprocess

from rl.training.audit_badugi_entry_m2_priority_reservation import AUDIT_SCHEMA
from rl.training.collect_badugi_entry_m2_draft import (
    AuditBridge, BRIDGE, OPPONENT, ROOT, collect_hand, sha256,
)
from rl.training.reconcile_badugi_entry_m2_priority_run import (
    RESULT_SCHEMA, _is_sha256, _read_sealed, bind_completed_attempt, load_collection_inputs,
)
from rl.training.validate_badugi_controller_v2_draft import OnnxAgent


START_MARKER = "priority-collection-started.json"
ROWS_FILE = "priority-collection-rows.jsonl"
RESULT_FILE = "priority-collection-result.json"
ATTEMPTS = 4_900
RESERVED_DEALS = 1_391_100
REQUIRED_QA = frozenset({
    "backend", "cash-playability-qa", "chinese-qa", "core5-device-qa (android)",
    "core5-device-qa (desktop)", "core5-qa", "dependency-security", "dramaha-qa",
    "history-qa", "learning-qa", "mobile-webkit-qa", "nlh-qa", "omaha-qa",
    "p2p-qa", "quality", "release-candidate-browser-qa", "stud-razz-qa", "tournament-qa",
})


def verify_reservation_receipt(plan: dict, receipt: dict) -> None:
    if (receipt.get("schema") != AUDIT_SCHEMA or
            receipt.get("status") != "PASS_NO_RESERVATION_COLLISION" or
            receipt.get("fullReservedDeals") != RESERVED_DEALS or
            any(type(receipt.get(key)) is not int or receipt[key] != 0 for key in
                ("recordedSeedCollisions", "historicalScreenCollisions", "distinctCollisions")) or
            any(not _is_sha256(plan.get(key)) or receipt.get(key) != plan[key] for key in
                ("screenPlanSha256", "seedHistorySha256", "screenedDeckResiduesSha256"))):
        raise ValueError("M2 priority reservation receipt does not cover this collection")


def verify_ci_receipt(plan: dict, ci: dict) -> None:
    jobs = ci.get("jobConclusions")
    if (ci.get("repository") != "Koki-Minoda/badugi-app" or
            ci.get("workflowName") != "Deploy mgx-prod-01" or
            ci.get("event") != "pull_request" or ci.get("baseRef") != "main" or
            ci.get("headSha") != plan.get("codeGitSha") or ci.get("conclusion") != "success" or
            type(ci.get("runId")) is not int or ci["runId"] <= 0 or
            not isinstance(jobs, dict) or jobs.get("deploy") != "skipped" or
            any(jobs.get(job) != "success" for job in REQUIRED_QA)):
        raise ValueError("M2 priority collection lacks successful required CI for the frozen code")


def preflight(plan_path: Path, plan_sha: str) -> tuple[dict, list, Path]:
    folder = plan_path.parent
    plan, _, selected = load_collection_inputs(plan_path, plan_sha)
    run_folder = Path(plan["runFolder"])
    if (plan.get("rowsFile") != ROWS_FILE or plan.get("resultFile") != RESULT_FILE or
            not run_folder.is_absolute() or run_folder != folder.resolve() or
            len(selected) != ATTEMPTS or plan.get("handsPerSession") != 1 or
            type(plan.get("controllerDeadlineSeconds")) is not int or
            not 1 <= plan["controllerDeadlineSeconds"] <= 30 or
            type(plan.get("inferenceDeadlineMs")) is not int or
            not 1 <= plan["inferenceDeadlineMs"] <= 2000):
        raise ValueError("M2 priority collection output names or safety budget differ")
    reserved = json.loads(_read_sealed(folder, plan["reservationAuditFile"],
                                      plan["reservationAuditSha256"]))
    verify_reservation_receipt(plan, reserved)
    ci = json.loads(_read_sealed(folder, plan["ciReceiptFile"], plan["ciReceiptSha256"]))
    verify_ci_receipt(plan, ci)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    dirty = subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip()
    if head != plan.get("codeGitSha") or dirty:
        raise ValueError("M2 priority collection requires the exact clean frozen checkout")
    collector = Path(__file__).with_name("collect_badugi_entry_m2_draft.py")
    sources = {"runnerSha256": Path(__file__), "collectorSha256": collector,
               "bridgeSha256": BRIDGE, "opponentSha256": OPPONENT}
    if any(sha256(path) != plan.get(field) for field, path in sources.items()):
        raise ValueError("M2 priority collection implementation differs from frozen hashes")
    model_path = Path(plan["modelPath"])
    if not model_path.is_absolute() or sha256(model_path) != plan.get("modelSha256"):
        raise ValueError("M2 priority ONNX model differs from the frozen candidate")
    return plan, selected, model_path


def mark_started(folder: Path, plan_sha: str) -> None:
    if os.path.lexists(folder / ROWS_FILE) or os.path.lexists(folder / RESULT_FILE):
        raise FileExistsError("M2 priority original already exists; no automatic resume")
    with (folder / START_MARKER).open("x") as marker:
        json.dump({"status": "STARTED_NO_AUTOMATIC_RESUME", "planSha256": plan_sha}, marker)
        marker.write("\n")
        marker.flush()
        os.fsync(marker.fileno())
    directory = os.open(folder, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def collect_priority_run(plan_path: Path, plan_sha: str) -> dict:
    plan, selected, model = preflight(plan_path, plan_sha)
    folder = plan_path.parent
    mark_started(folder, plan_sha)
    # Preserve the marker even if setup fails or a deal starts but never reaches
    # the raw ledger. Such a seed must not be automatically offered again.
    agent = OnnxAgent(model)
    if sha256(model) != plan["modelSha256"]:
        raise ValueError("M2 priority model changed during ONNX initialization")
    rows = folder / ROWS_FILE
    calls = 0
    max_inference = 0.0
    bridge = AuditBridge(plan["controllerDeadlineSeconds"])
    try:
        with rows.open("x") as out:
            for index, scheduled in enumerate(selected):
                captured = collect_hand(bridge, agent, scheduled, plan["inferenceDeadlineMs"],
                                        capture_predraw_attempt=True)
                row = {key: scheduled[key] for key in ("seed", "group", "profile", "heroSeat",
                                                       "stratum", "queueIndex")}
                row.update(globalIndex=index, **captured)
                bind_completed_attempt(row, scheduled, index)
                out.write(json.dumps(row, separators=(",", ":"), allow_nan=False) + "\n")
                out.flush()
                os.fsync(out.fileno())
                calls += row["modelCalls"]
                max_inference = max(max_inference, row["maxInferenceMs"])
    finally:
        bridge.close()
    if calls <= 0:
        raise ValueError("M2 priority run did not exercise the ONNX candidate")
    result = {
        "schema": RESULT_SCHEMA, "status": "COMPLETE_PRIORITY_OPPORTUNITY_SAFETY_ONLY",
        "planSha256": plan_sha, "selectedSha256": plan["selectedSha256"],
        "codeGitSha": plan["codeGitSha"], "modelSha256": plan["modelSha256"],
        "completedAttempts": len(selected), "rowsSha256": sha256(rows),
        "heroOnnxCalls": calls, "maxInferenceMs": max_inference, "fallbackCalls": 0,
        "scope": "Opportunity counts and safety only",
    }
    result_path = folder / RESULT_FILE
    with result_path.open("x") as out:
        json.dump(result, out, indent=2)
        out.write("\n")
        out.flush()
        os.fsync(out.fileno())
    return {**result, "resultSha256": sha256(result_path)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--plan-sha256", required=True)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    if args.execute:
        result = collect_priority_run(args.plan, args.plan_sha256)
    else:
        _, selected, _ = preflight(args.plan, args.plan_sha256)
        result = {"status": "PREFLIGHT_ONLY", "plannedAttempts": len(selected)}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
