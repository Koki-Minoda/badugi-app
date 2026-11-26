"""Bounded, sealed M2 one-hand opportunity collector; never scores reward."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import random
import selectors
import subprocess
import time

from collections import Counter

import numpy as np

from rl.training.entry_m2_sampling_contract import (
    GROUPS, PROFILES, STRATA, DECK_MODULUS, audit_selected_deal, check_seed_schedule,
)
from rl.training.train_badugi_controller_v2_draft import (
    check_decision, training_opponent_action,
)
from rl.training.validate_badugi_controller_v2_draft import OnnxAgent

ROOT = Path(__file__).resolve().parents[3]
BRIDGE = ROOT / "scripts/badugi-entry-m2-bridge-draft.mjs"
OPPONENT = ROOT / "src/rl/training/hand_aware_known_badugi_opponents_draft.py"
SCHEMA = "mgx-d03-entry-m2-collector/v1"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class AuditBridge:
    def __init__(self, deadline_seconds: int):
        self.failed = False
        self.deadline_seconds = deadline_seconds
        self.proc = subprocess.Popen(["node", str(BRIDGE)], cwd=ROOT,
                                     text=True, bufsize=1, stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.proc.stdout, selectors.EVENT_READ)

    def send(self, request: dict) -> dict:
        self.proc.stdin.write(json.dumps(request) + "\n")
        self.proc.stdin.flush()
        if not self.selector.select(self.deadline_seconds):
            self.failed = True
            self.proc.kill()
            raise TimeoutError("M2 real-controller bridge deadline exceeded")
        line = self.proc.stdout.readline()
        if not line:
            self.failed = True
            raise RuntimeError("M2 bridge terminated before response")
        response = json.loads(line)
        if response.get("type") == "error":
            self.failed = True
            raise RuntimeError(response.get("message", "M2 bridge error"))
        return response

    def close(self) -> None:
        self.selector.close()
        if self.proc.poll() is None:
            self.proc.stdin.close()
            self.proc.wait(timeout=10)
        if self.proc.returncode and not self.failed:
            raise RuntimeError("M2 bridge failed")


def next_seat(seat: int, occupied: int, physical: int) -> int:
    for offset in range(1, physical + 1):
        found = (seat + offset) % physical
        if found < occupied:
            return found
    raise ValueError("no occupied next seat")


def opening_order(dealer: int, occupied: int, physical: int) -> list[int]:
    if occupied == 2:
        first = dealer
    else:
        sb = next_seat(dealer, occupied, physical)
        bb = next_seat(sb, occupied, physical)
        first = next_seat(bb, occupied, physical)
    order = [first]
    while len(order) < occupied:
        order.append(next_seat(order[-1], occupied, physical))
    return order


def collect_hand(bridge: AuditBridge, agent: OnnxAgent, record: dict,
                 inference_deadline_ms: int) -> dict:
    physical, occupied, mode = record["group"]
    hero = record["heroSeat"]
    rng = random.Random(record["seed"] + 997)
    decision = bridge.send({"command": "reset", "seatCount": physical,
                            "occupiedSeatCount": occupied, "isTournament": mode == "mtt",
                            "seed": record["seed"], "heroSeat": hero,
                            "includeLedger": True})
    if (decision.get("auditHeroSeat") != hero or decision.get("auditOpeningHandIndex") != 0):
        raise ValueError("designated hero opening audit missing")
    opening = decision.get("auditOpeningHeroCards")
    if opening != record["expectedOpeningActorCards"]:
        raise ValueError("real controller opening hand differs from sealed seed screen")
    target = None
    decisions = model_calls = 0
    max_inference_ms = 0.0
    while decision["type"] == "decision":
        check_decision(decision, physical, occupied, mode == "mtt")
        if decision["ledger"]["accounted"] != decision["ledger"]["chipPool"]:
            raise ValueError("M2 nonterminal all-seat chip ledger mismatch")
        if decision["seat"] == hero:
            started = time.monotonic()
            action = agent.act(np.asarray(decision["observation"], np.float32), 0.0,
                               np.asarray(decision["legalMask"], np.float32))
            elapsed = (time.monotonic() - started) * 1000
            max_inference_ms = max(max_inference_ms, elapsed)
            if elapsed > inference_deadline_ms:
                raise TimeoutError("M2 ONNX inference exceeded deadline")
            model_calls += 1
            if (target is None and decision["phase"] == "BET" and
                    decision["drawRoundIndex"] == 0 and
                    decision["legalMask"][0] == 1 and decision["legalMask"][2] == 1 and
                    decision["legalMask"][4] == 1):
                visible = decision["auditActorVisible"]
                evidence = decision["beliefEvidence"]
                order = opening_order(visible["dealerSeat"], occupied, physical)
                target = {
                    "actorCurrentCards": visible["actorCurrentCards"],
                    "openingPosition": order.index(hero),
                    "madeCards": evidence["actorHandProgress"]["current"]["madeCards"],
                    "highRankZeroBased": evidence["actorHandProgress"]["current"]["highRank"],
                    "toCallBigBets": evidence["currentPublicBetContext"]["toCallBb"] / 2,
                    "potBigBets": evidence["currentPublicBetContext"]["potBb"] / 2,
                    "activePlayers": evidence["currentPublicBetContext"]["activePlayers"],
                    "priorRaiseCount": sum(event["type"] == "BET_ACTION" and
                                           event["drawRoundIndex"] == 0 and
                                           event["action"] == "RAISE"
                                           for event in evidence["publicActions"]),
                    "publicActions": evidence["publicActions"],
                    "legalMask": decision["legalMask"],
                    "legalAmountsChips": visible["legalAmountsChips"],
                    "naturalAction": action,
                }
        else:
            action = training_opponent_action(decision, record["profile"], rng,
                                              "hand-aware-v1")
        if decision["legalMask"][action] != 1:
            raise ValueError("M2 illegal selected action")
        decision = bridge.send({"command": "step", "actionIndex": action})
        decisions += 1
        if decisions > 200:
            raise ValueError("M2 controller decision cap exceeded")
    if (decision["type"] != "hand_end" or decision["decisionCount"] != decisions or
            not decision["ledger"]["terminal"] or
            decision["ledger"]["accounted"] != decision["ledger"]["chipPool"] or
            sum(decision["chipDeltaBySeat"]) != 0):
        raise ValueError("M2 terminal ledger or zero-sum mismatch")
    result = {"source": "real-controller", "openingActorCards": opening,
              "target": target, "modelCalls": model_calls,
              "maxInferenceMs": max_inference_ms,
              "controllerDecisions": decisions, "chipLedgerPass": True}
    audit_selected_deal(result, record["stratum"])
    return result


def check_recorded_seed_history(plan: dict, rows: list[dict], folder: Path) -> None:
    """Check the frozen actual-deck residue index, not an asserted PASS flag.

    The index is a sorted, strictly unique little-endian uint32 binary file
    produced by an independent inventory of recorded prior actual deck seeds.
    """
    name = plan.get("recordedDeckResiduesFile")
    count = plan.get("recordedDeckResiduesCount")
    digest = plan.get("recordedDeckResiduesSha256")
    if (not isinstance(name, str) or not name or Path(name).is_absolute() or
            Path(name).name != name or type(count) is not int or count < 1 or
            not isinstance(digest, str) or len(digest) != 64):
        raise ValueError("M2 recorded deck index provenance missing")
    path = folder / name
    if path.stat().st_size != count * 4 or sha256(path) != digest:
        raise ValueError("M2 recorded deck index size or SHA mismatch")
    prior = np.memmap(path, dtype="<u4", mode="r", shape=(count,))
    previous = None
    for start in range(0, count, 1_000_000):
        block = prior[start:start + 1_000_000]
        if (previous is not None and int(block[0]) <= previous) or np.any(block[1:] <= block[:-1]):
            raise ValueError("M2 recorded deck index is not sorted and unique")
        previous = int(block[-1])
    residues = np.asarray([row["seed"] % DECK_MODULUS for row in rows], dtype="<u4")
    positions = np.searchsorted(prior, residues)
    if np.any((positions < count) & (prior[np.minimum(positions, count - 1)] == residues)):
        raise ValueError("M2 selected deck seed collides with recorded prior deck")


def validate_plan(plan: dict, rows: list[dict], plan_folder: Path) -> None:
    if (plan.get("schema") != SCHEMA or plan.get("status") != "FROZEN_BEFORE_COLLECTION" or
            plan.get("stage") != "ENTRY_OPPORTUNITY_SAFETY_ONLY" or
            plan.get("handsPerSession") != 1 or
            len(rows) != plan.get("plannedSessions") or len(rows) != 5000 or
            plan.get("seedListSha256") != sha256(plan_folder / plan["selectedSeedsFile"]) or
            plan.get("collectorSha256") != sha256(Path(__file__)) or
            plan.get("bridgeSha256") != sha256(BRIDGE) or
            plan.get("opponentSha256") != sha256(OPPONENT) or
            plan.get("modelSha256") != sha256(Path(plan["modelPath"])) or
            plan.get("codeGitSha") != subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip() or
            subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip() or
            not isinstance(plan.get("controllerDeadlineSeconds"), int) or
            not 1 <= plan["controllerDeadlineSeconds"] <= 30 or
            not isinstance(plan.get("inferenceDeadlineMs"), int) or
            not 1 <= plan["inferenceDeadlineMs"] <= 2000):
        raise ValueError("M2 frozen plan provenance or budget mismatch")
    if tuple(plan.get("groups", [])) == () or tuple(plan.get("profiles", [])) == ():
        raise ValueError("M2 group/profile plan missing")
    if plan["groups"] != [list(group) for group in GROUPS] or plan["profiles"] != list(PROFILES):
        raise ValueError("M2 opponent or seat matrix changed")
    if (plan.get("strata") != list(STRATA) or plan.get("acceptedPerCellStratum") != 25 or
            type(plan.get("progressEverySessions")) is not int or
            not 1 <= plan["progressEverySessions"] <= 5000):
        raise ValueError("M2 stratified safety allocation or progress interval changed")
    check_seed_schedule([row["seed"] for row in rows], set())
    if (any(row.get("group") not in [list(group) for group in GROUPS] or
            row.get("profile") not in PROFILES or
            type(row.get("heroSeat")) is not int or
            not 0 <= row["heroSeat"] < row["group"][1] or
            row.get("stratum") not in plan["strata"] or
            not isinstance(row.get("expectedOpeningActorCards"), list)
            for row in rows)):
        raise ValueError("M2 selected seed schedule has an invalid cell")
    cell_counts = Counter((tuple(row["group"]), row["profile"], row["stratum"])
                          for row in rows)
    if (len(cell_counts) != len(GROUPS) * len(PROFILES) * len(STRATA) or
            set(cell_counts.values()) != {25}):
        raise ValueError("M2 selected seed allocation differs from frozen 25-per-cell design")
    check_recorded_seed_history(plan, rows, plan_folder)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True, type=Path)
    plan_path = parser.parse_args().plan.resolve()
    plan = json.loads(plan_path.read_text())
    folder = plan_path.parent
    selected = json.loads((folder / plan["selectedSeedsFile"]).read_text())
    validate_plan(plan, selected, folder)
    output = folder / plan["outputFile"]
    with (folder / (plan["outputFile"] + ".lock")).open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        completed = 0
        if output.exists():
            for line in output.open():
                row = json.loads(line)
                scheduled = selected[completed]
                if (row["globalIndex"] != completed or row["seed"] != scheduled["seed"] or
                        row["group"] != scheduled["group"] or
                        row["profile"] != scheduled["profile"] or
                        row["heroSeat"] != scheduled["heroSeat"] or
                        row["stratum"] != scheduled["stratum"]):
                    raise ValueError("M2 resume boundary differs from frozen seed schedule")
                audit_selected_deal(row, scheduled["stratum"])
                completed += 1
        bridge = AuditBridge(plan["controllerDeadlineSeconds"])
        agent = OnnxAgent(Path(plan["modelPath"]))
        try:
            with output.open("a") as stream:
                for index in range(completed, len(selected)):
                    schedule = selected[index]
                    result = collect_hand(bridge, agent, schedule, plan["inferenceDeadlineMs"])
                    row = {"globalIndex": index, "seed": schedule["seed"],
                           "group": schedule["group"], "profile": schedule["profile"],
                           "heroSeat": schedule["heroSeat"], "stratum": schedule["stratum"],
                           **result}
                    stream.write(json.dumps(row, separators=(",", ":")) + "\n")
                    if (index + 1) % plan["progressEverySessions"] == 0:
                        stream.flush()
                        os.fsync(stream.fileno())
                        print(json.dumps({"collectedSessions": index + 1}), flush=True)
                stream.flush()
                os.fsync(stream.fileno())
        finally:
            bridge.close()
        result_file = folder / plan["resultFile"]
        if result_file.exists():
            raise FileExistsError("M2 result already exists")
        result = {"status": "COMPLETE_OPPORTUNITY_SAFETY_ONLY", "sessions": len(selected),
                  "planSha256": sha256(plan_path), "rowsSha256": sha256(output),
                  "limit": "No action EV, range adoption, or strength claim"}
        with result_file.open("x") as stream:
            json.dump(result, stream, indent=2)
            stream.write("\n")
        print(json.dumps(result))


if __name__ == "__main__":
    main()
