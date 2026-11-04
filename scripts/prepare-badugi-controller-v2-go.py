#!/usr/bin/env python3
"""Verify pretraining evidence and write a one-run Mac GO manifest; never train."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.rl.training.train_badugi_controller_v2_draft import (  # noqa: E402
    BRIDGE, PLAN, SCHEMA, checkout_identity, contract_hash,
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load(path):
    return json.loads(path.read_text())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", type=Path, action="append", required=True)
    parser.add_argument("--bridge-report", type=Path, required=True)
    parser.add_argument("--ui-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--followup", action="store_true")
    parser.add_argument("--diagnosis-run", type=Path)
    parser.add_argument("--candidate-validation", type=Path)
    parser.add_argument("--reference-validation", type=Path)
    args = parser.parse_args()
    require(not args.out.exists(), "GO output already exists")
    require(len(args.audit_dir) == 2, "require both native and sparse independent audits")
    code_sha, dirty = checkout_identity()
    require(not dirty, "training checkout must be committed and clean")
    plan = load(PLAN)
    expected_status = ("FROZEN_FOR_CAUSE_BASED_BOOTSTRAP_RUN" if args.followup
                       else "FROZEN_FOR_FIRST_MAC_RUN")
    require(plan.get("status") == expected_status and
            plan.get("schemaVersion") == SCHEMA and
            plan.get("firstTrainingRunHands") == 200 and
            len(plan.get("trainingGroups", [])) == 10,
            "training plan is not frozen for the requested Mac run")
    audit_evidence = []
    covered = set()
    for directory in args.audit_dir:
        audit_path, rollout_path = directory / "audit.json", directory / "rollouts.json"
        audit, rollout = load(audit_path), load(rollout_path)
        require(audit.get("status") == "PASS" and audit.get("mismatchCount") == 0 and
                audit.get("rolloutSha256") == digest(rollout_path) and
                audit.get("slotsCompared") == audit.get("decisions", 0) * 96 and
                audit.get("bet", 0) > 0 and audit.get("draw", 0) > 0 and
                not audit.get("learnedPolicy") and not audit.get("strengthEvaluation"),
                f"independent slot audit failed: {directory}")
        covered.update((session["seatCount"], session.get("occupiedSeatCount", session["seatCount"]),
                        session["isTournament"]) for session in rollout["sessions"])
        for session in rollout["sessions"]:
            first_hand = session["hands"][0]
            raw = first_hand["decisions"][0]["auditInput"]
            bb = raw["blindStructure"][raw["blindLevelIndex"]]["bb"]
            initial_bb = 40 if session["isTournament"] else 25
            require([stack / bb for stack in first_hand["startingStacks"] if stack > 0] ==
                    [initial_bb] * session["occupiedSeatCount"],
                    f"controller starting stack/BB differs from live UI: {directory}")
        audit_evidence.append({"audit": str(audit_path), "auditSha256": digest(audit_path),
                               "rolloutSha256": digest(rollout_path),
                               "decisions": audit["decisions"],
                               "slotsCompared": audit["slotsCompared"]})
    required_groups = {(seats, occupied, mode) for mode in (False, True)
                       for seats, occupied in ((2, 2), (3, 3), (6, 6), (6, 2), (6, 3))}
    require(covered == required_groups, "independent audit lacks a physical/occupied group")
    bridge = load(args.bridge_report)
    bridge_groups = {(row["seatCount"], row["occupiedSeatCount"], row["isTournament"],
                      row["profile"]) for row in bridge.get("groups", [])}
    require(bridge.get("status") == "BRIDGE_PREFLIGHT_ONLY" and
            bridge.get("totalHands") >= 200 and bridge.get("totalDecisions", 0) > 0 and
            len(bridge_groups) == 40 and
            bridge.get("bridgeSourceSha256") == digest(BRIDGE) and
            not bridge.get("learnedPolicy") and not bridge.get("modelUsed"),
            "controller action preflight is incomplete")
    ui_evidence = []
    for mode, occupants in (("cash", 6), ("tournament", 2), ("tournament", 3),
                            ("tournament", 6)):
        path = args.ui_dir / f"{mode}-{occupants}seat-persisted.json"
        result = load(path)
        rows, persisted = result.get("rows", []), result.get("persisted", {})
        require(result.get("mode") == mode and result.get("seatCount") == occupants and
                not result.get("errors") and rows and
                any(row["phase"] == "BET" for row in rows) and
                any(row["phase"] == "DRAW" for row in rows) and
                all(row["v2Diagnostic"]["ready"] and row["playerCount"] == 6 and
                    row["occupiedCount"] == occupants and
                    row["v2Diagnostic"]["physicalSeatSlot"] == 1 and
                    row["v2Diagnostic"]["continuingSeatSlot"] <= occupants / 6 + 1e-6
                    for row in rows) and
                persisted.get("handCount", 0) > 0 and persisted.get("actions"),
                f"persisted live UI event evidence failed: {path}")
        require(any(event["type"] == "DRAW_ACTION" for event in persisted["actions"]) and
                all(event["type"] != "DRAW_ACTION" or
                    len(event.get("replacedCards") or []) == event.get("drawCount")
                    for event in persisted["actions"]),
                f"persisted DRAW event evidence failed: {path}")
        seen = [(event["type"], event["seat"], event.get("action"),
                 event.get("drawRoundIndex"), event.get("betRoundIndex"),
                 event.get("drawCount")) for event in rows[-1]["publicEvents"]
                if event["type"] in ("BET_ACTION", "DRAW_ACTION")]
        saved = [(event["type"], event["seat"], event.get("action"),
                  event.get("drawRoundIndex"), event.get("betRoundIndex"),
                  event.get("drawCount")) for event in persisted["actions"][:len(seen)]]
        require(seen == saved, f"UI event prefix differs from persisted history: {path}")
        ui_evidence.append({"file": str(path), "sha256": digest(path),
                            "inferenceDecisions": len(rows),
                            "persistedActions": len(persisted["actions"])})
    free = shutil.disk_usage(ROOT).free
    mem = int(subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True).strip())
    require(free >= 20 * 1024 ** 3 and mem >= 16 * 1024 ** 3,
            "Mac resource floor for first run not met")
    followup_evidence = None
    if args.followup:
        require(all((args.diagnosis_run, args.candidate_validation,
                     args.reference_validation)), "followup requires training and both validation reports")
        prior = load(args.diagnosis_run / "run-summary.json")
        candidate_summary = load(args.candidate_validation / "summary.json")
        reference_summary = load(args.reference_validation / "summary.json")
        candidate_rows = [json.loads(line) for line in
                          (args.candidate_validation / "sessions.jsonl").read_text().splitlines()]
        reference_rows = [json.loads(line) for line in
                          (args.reference_validation / "sessions.jsonl").read_text().splitlines()]
        candidate_actions = {action for row in candidate_rows for action in row["heroActions"]}
        def pressure_mean(rows):
            values = [row["chipPerHand"] / (50 if row["isTournament"] else 20)
                      for row in rows if row["profile"] == "pressure"]
            return sum(values) / len(values)
        require(prior.get("status") == "TRAINING_CHECKPOINT" and
                prior.get("trained") and prior.get("hands") == 200 and
                prior.get("optimizerSteps", 0) > 0 and
                prior.get("zeroSumHands") == 200 and
                candidate_summary.get("modelSha256") == digest(args.diagnosis_run / "candidate.pt") and
                candidate_summary.get("sessions") == reference_summary.get("sessions") == 240 and
                candidate_summary.get("hands") == reference_summary.get("hands") == 4800 and
                candidate_summary.get("zeroSumSessions") == 240 and
                reference_summary.get("zeroSumSessions") == 240 and
                "BET:0" not in candidate_actions and "DRAW:0" not in candidate_actions and
                pressure_mean(candidate_rows) < 0 and
                pressure_mean(reference_rows) > pressure_mean(candidate_rows),
                "followup cause evidence does not match the documented action collapse")
        followup_evidence = {
            "firstRunSummarySha256": digest(args.diagnosis_run / "run-summary.json"),
            "firstCandidateSha256": digest(args.diagnosis_run / "candidate.pt"),
            "candidateValidationSha256": digest(args.candidate_validation / "sessions.jsonl"),
            "referenceValidationSha256": digest(args.reference_validation / "sessions.jsonl"),
            "candidatePressureBbPerHand": pressure_mean(candidate_rows),
            "referencePressureBbPerHand": pressure_mean(reference_rows),
            "candidateActions": sorted(candidate_actions),
        }
    max_hands = plan["followupTrainingRunHands"] if args.followup else 200
    manifest = {
        "status": "GO", "tier": "beginner", "trainingHost": "mac", "maxHands": max_hands,
        "bootstrapHands": plan["followupBootstrapHands"] if args.followup else 0,
        "imitationSteps": plan["followupImitationSteps"] if args.followup else 0,
        "schemaVersion": SCHEMA, "codeGitSha": code_sha,
        "contractSha256": contract_hash(), "bridgeSha256": digest(BRIDGE),
        "planSha256": digest(PLAN),
        "independentSlotAuditPassed": True, "uiEventAuditPassed": True,
        "controllerActionAuditPassed": True, "seedAndOpponentPlanFrozen": True,
        "macResourcePassed": True, "preparedAtUtc": datetime.now(timezone.utc).isoformat(),
        "freeBytes": free, "memoryBytes": mem,
        "independentAudits": audit_evidence,
        "controllerBridgePreflight": {"file": str(args.bridge_report),
                                      "sha256": digest(args.bridge_report),
                                      "hands": bridge["totalHands"],
                                      "decisions": bridge["totalDecisions"]},
        "uiEvents": ui_evidence,
        "causeBasedFollowup": followup_evidence,
        "notProductApproval": "No learned model, browser model-use/fallback or independent chip/hand strength claim",
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"status": "GO", "tier": "beginner", "maxHands": max_hands,
                      "codeGitSha": code_sha, "manifestSha256": digest(args.out)}, indent=2))


if __name__ == "__main__":
    main()
