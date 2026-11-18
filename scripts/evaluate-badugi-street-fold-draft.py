#!/usr/bin/env python3
"""Frozen, candidate-only 20-hand comparison of three Badugi fold streets.

This runner never trains or changes the live model. A separate prepare step
must freeze and audit every actual controller deck seed before execution.
It prints only collection progress, never interim returns.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import selectors
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from rl.training.badugi_street_fold_eligibility_draft import eligible_postdraw_fold_street
from rl.training.train_badugi_controller_v2_draft import (
    HAND_AWARE_TRAINING_PROFILES, check_decision, training_opponent_action)
from rl.training.validate_badugi_controller_v2_draft import OnnxAgent

GROUPS = [(physical, occupied, mode) for mode in ("cash", "mtt")
          for physical, occupied in ((3, 3), (6, 3), (6, 6))]
ARMS = ("baseline", "street1", "street2", "street3")


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class ControllerBridge:
    def __init__(self, deadline_seconds):
        self.deadline_seconds = deadline_seconds
        self.failed = False
        self.proc = subprocess.Popen(
            ["node", str(ROOT / "scripts/badugi-controller-belief-v3-bridge.mjs")],
            cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, bufsize=1)
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.proc.stdout, selectors.EVENT_READ)

    def send(self, request):
        self.proc.stdin.write(json.dumps(request) + "\n")
        self.proc.stdin.flush()
        if not self.selector.select(self.deadline_seconds):
            self.failed = True
            self.proc.kill()
            raise TimeoutError("real controller response deadline exceeded")
        line = self.proc.stdout.readline()
        if not line:
            self.failed = True
            raise RuntimeError("real controller exited before response")
        response = json.loads(line)
        if response.get("type") == "error":
            self.failed = True
            raise ValueError(response)
        return response

    def close(self):
        self.selector.close()
        if self.proc.poll() is None:
            self.proc.stdin.close()
            self.proc.wait(timeout=10)
        if self.proc.returncode and not self.failed:
            raise RuntimeError("real controller failed")


def run_arm(bridge, agent, *, seed, hero, profile, group, arm, horizon,
            inference_deadline_ms):
    physical, occupied, mode = group
    tournament = mode == "mtt"
    rng = random.Random(seed + 997)
    decision = bridge.send({"command": "reset", "seatCount": physical,
                            "occupiedSeatCount": occupied,
                            "isTournament": tournament, "seed": seed,
                            "includeLedger": True})
    totals = Counter()
    for hand_index in range(horizon):
        if hand_index:
            decision = bridge.send({"command": "next_hand"})
        if decision["type"] == "hand_end" and decision.get("decisionCount") == 0:
            break
        if decision["type"] != "decision":
            raise ValueError("expected active controller hand")
        if hero not in decision["eligibleSeats"]:
            if hand_index == 0:
                raise ValueError("hero is unavailable in the first hand")
            totals["heroBustedBeforeHorizon"] = 1
            break
        blind = decision["activeBigBlind"]
        if type(blind) not in (int, float) or blind <= 0:
            raise ValueError("invalid big blind")
        used_override = False
        voluntary = False
        hand_decisions = 0
        while decision["type"] == "decision":
            check_decision(decision, physical, occupied, tournament)
            if decision["ledger"]["accounted"] != decision["ledger"]["chipPool"]:
                raise ValueError("decision chip ledger mismatch")
            if decision["seat"] == hero:
                observation = np.asarray(decision["observation"], dtype=np.float32)
                mask = np.asarray(decision["legalMask"], dtype=np.float32)
                started = time.monotonic()
                action = agent.act(observation, 0.0, mask)
                if (time.monotonic() - started) * 1000 > inference_deadline_ms:
                    raise TimeoutError("real ONNX inference deadline exceeded")
                totals["modelCalls"] += 1
                if decision["phase"] == "BET":
                    street = decision["drawRoundIndex"]
                    public = decision["beliefEvidence"]["currentPublicBetContext"]
                    progress = decision["beliefEvidence"]["actorHandProgress"]
                    if mask[0] == 1 and mask[2] == 1 and public["toCallBb"] > 0:
                        totals[f"facingBet|street{street}"] += 1
                        totals[f"naturalFold|street{street}"] += int(action == 0)
                        totals[f"naturalCall|street{street}"] += int(action == 2)
                    eligible = eligible_postdraw_fold_street(
                        street=street, natural_action=action,
                        legal_mask=[int(value) for value in mask],
                        to_call_bb=public["toCallBb"],
                        made_cards=progress["current"]["madeCards"],
                        made_card_gain=progress["madeCardGain"],
                        active_players=public["activePlayers"])
                    if eligible is not None:
                        totals[f"eligible|street{eligible}"] += 1
                        if arm == f"street{eligible}" and not used_override:
                            action = 0
                            used_override = True
                            totals[f"override|street{eligible}"] += 1
                    if street == 0 and action in (2, 3, 4):
                        voluntary = True
            else:
                action = training_opponent_action(
                    decision, profile, rng, "hand-aware-v1")
            if decision["legalMask"][action] != 1:
                raise ValueError("illegal action")
            decision = bridge.send({"command": "step", "actionIndex": action})
            hand_decisions += 1
            if hand_decisions > 200:
                raise ValueError("hand decision limit exceeded")
        if (decision["type"] != "hand_end" or
                decision["decisionCount"] != hand_decisions or
                not decision["ledger"]["terminal"] or
                decision["ledger"]["accounted"] != decision["ledger"]["chipPool"] or
                sum(decision["chipDeltaBySeat"]) != 0):
            raise ValueError("terminal chip conservation failed")
        totals["completedHeroHands"] += 1
        totals["heroVpipHands"] += int(voluntary)
        totals["heroProfitBigBets"] += decision["chipDeltaBySeat"][hero] / (2 * blind)
        totals["controllerDecisions"] += hand_decisions
    return dict(totals)


def validate_resume(path, seeds, groups, profiles, sessions_per_cell, horizon):
    rows = 0
    if not path.exists():
        return rows
    with path.open() as source:
        for line in source:
            if rows >= len(seeds):
                raise ValueError("resume exceeds frozen schedule")
            value = json.loads(line)
            group_index = rows // (len(profiles) * sessions_per_cell)
            profile_index = (rows // sessions_per_cell) % len(profiles)
            session_index = rows % sessions_per_cell
            expected_group = groups[group_index]
            if (value.get("globalIndex") != rows or value.get("seed") != seeds[rows] or
                    value.get("group") != list(expected_group) or
                    value.get("profile") != profiles[profile_index] or
                    value.get("heroSeat") != session_index % expected_group[1] or
                    set(value.get("arms", {})) != set(ARMS) or
                    any(arm.get("completedHeroHands", 0) > horizon or
                        arm.get("completedHeroHands", 0) < 0 or
                        arm.get("modelCalls", 0) < 0 for arm in value["arms"].values())):
                raise ValueError("resume row does not match the frozen schedule")
            rows += 1
    if rows > len(seeds):
        raise ValueError("resume exceeds frozen schedule")
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", type=Path, required=True)
    args = parser.parse_args()
    plan_path = args.plan.resolve()
    plan = json.loads(plan_path.read_text())
    here = plan_path.parent
    seeds = json.loads((here / "seeds.json").read_text())
    head = subprocess.check_output(["git", "rev-parse", "HEAD"],
                                   cwd=ROOT, text=True).strip()
    clean = subprocess.check_output(["git", "status", "--porcelain"],
                                    cwd=ROOT, text=True).strip()
    profiles = list(HAND_AWARE_TRAINING_PROFILES)
    if (plan.get("status") != "FROZEN_BEFORE_COLLECTION" or
            head != plan.get("codeGitSha") or clean or
            sha(__file__) != plan.get("collectorSha256") or
            sha(here / "seeds.json") != plan.get("seedListSha256") or
            sha(ROOT / "scripts/badugi-controller-belief-v3-bridge.mjs") !=
                plan.get("bridgeSha256") or
            sha(ROOT / "src/rl/training/hand_aware_known_badugi_opponents_draft.py") !=
                plan.get("opponentSha256") or
            sha(plan["modelPath"]) != plan.get("modelSha256") or
            plan.get("groups") != [list(group) for group in GROUPS] or
            plan.get("profiles") != profiles or
            plan.get("arms") != list(ARMS) or
            plan.get("sessionsPerCell") != 4000 or
            plan.get("handsPerSessionMax") != 20 or
            plan.get("seedAudit", {}).get("status") !=
                "PASS_NO_RECORDED_ACTUAL_DECK_COLLISION" or
            os.environ.get("OMP_NUM_THREADS") != "1"):
        raise ValueError("frozen study/runtime mismatch")
    expected = len(GROUPS) * len(profiles) * plan["sessionsPerCell"]
    if len(seeds) != expected or len(set(seeds)) != expected:
        raise ValueError("frozen session seed schedule mismatch")
    if len({(seed + 1009 * hand) % 2**32
            for seed in seeds for hand in range(20)}) != expected * 20:
        raise ValueError("actual controller deck seed aliases within study")
    out_path = here / "paired-sessions.jsonl.partial"
    next_index = validate_resume(out_path, seeds, GROUPS, profiles,
                                 plan["sessionsPerCell"], 20)
    if (here / "collection-result.json").exists():
        raise ValueError("completed collection original already exists")
    agent = OnnxAgent(plan["modelPath"])
    bridge = ControllerBridge(plan["controllerDeadlineSeconds"])
    started = time.monotonic()
    try:
        with out_path.open("a") as output:
            for index in range(next_index, expected):
                group_index = index // (len(profiles) * plan["sessionsPerCell"])
                profile_index = (index // plan["sessionsPerCell"]) % len(profiles)
                session_index = index % plan["sessionsPerCell"]
                group = GROUPS[group_index]
                profile = profiles[profile_index]
                hero = session_index % group[1]
                arms = {name: run_arm(
                    bridge, agent, seed=seeds[index], hero=hero,
                    profile=profile, group=group, arm=name, horizon=20,
                    inference_deadline_ms=plan["inferenceDeadlineMs"])
                    for name in ARMS}
                for name in ARMS[1:]:
                    if (arms[name].get(f"override|{name}", 0) == 0 and
                            arms[name].get("heroProfitBigBets", 0) !=
                            arms["baseline"].get("heroProfitBigBets", 0)):
                        raise ValueError("no-override policy parity failed")
                output.write(json.dumps({"globalIndex": index, "seed": seeds[index],
                    "group": list(group), "profile": profile, "heroSeat": hero,
                    "arms": arms}, separators=(",", ":")) + "\n")
                if (index + 1) % 25 == 0:
                    output.flush()
                    os.fsync(output.fileno())
                if (index + 1) % 250 == 0:
                    print(json.dumps({"completedPairedSessions": index + 1,
                                      "plannedPairedSessions": expected,
                                      "elapsedSeconds": round(time.monotonic() - started)}),
                          flush=True)
            output.flush()
            os.fsync(output.fileno())
    finally:
        bridge.close()
    result = {"status": "COMPLETE", "planSha256": sha(plan_path),
              "rowsSha256": sha(out_path), "pairedSessions": expected,
              "scope": "known artificial opponents development; no independent final holdout or promotion"}
    with (here / "collection-result.json").open("x") as output:
        json.dump(result, output, indent=2)
        output.write("\n")
    print(json.dumps({"status": result["status"],
                      "pairedSessions": expected, "rowsSha256": result["rowsSha256"]}))


if __name__ == "__main__":
    main()
