"""Bounded, model-free audit of every D03 controller decision chip ledger.

This is a rule/safety diagnostic. It is not an Iron strength evaluation or a
human-play record. Raw response ledgers remain outside the public registry.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "scripts" / "badugi-controller-v2-bridge.mjs"
GROUPS = tuple((seats, occupied, tournament) for tournament in (False, True)
               for seats, occupied in ((2, 2), (3, 3), (6, 6), (6, 2), (6, 3)))
PROFILES = ("passive", "pressure", "draw_heavy", "random_legal")
BET_LABELS = ("fold", "check", "call", "bet", "raise", None)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_ledger(response: dict, *, seats: int, pool: int, hand_index: int,
                    decision_index: int) -> dict:
    ledger = response.get("ledger")
    terminal = response.get("type") == "hand_end"
    if (not isinstance(ledger, dict) or ledger.get("terminal") is not terminal or
            ledger.get("handIndex") != hand_index or
            ledger.get("decisionIndex") != decision_index or
            ledger.get("chipPool") != pool):
        raise ValueError("missing or mismatched controller ledger identity")
    stacks = ledger.get("stacks")
    committed = ledger.get("committedBySeat")
    if (not isinstance(stacks, list) or len(stacks) != seats or
            any(type(value) is not int or value < 0 for value in stacks)):
        raise ValueError("invalid all-seat stacks")
    if terminal:
        if committed is not None:
            raise ValueError("terminal committed chips must be settled")
        accounted = sum(stacks)
    else:
        if (not isinstance(committed, list) or len(committed) != seats or
                any(type(value) is not int or value < 0 for value in committed)):
            raise ValueError("invalid all-seat committed chips")
        accounted = sum(stacks) + sum(committed)
    if ledger.get("accounted") != accounted or accounted != pool:
        raise ValueError("controller all-seat chip ledger does not balance")
    return ledger


def action_index(response: dict, profile: str, rng: random.Random) -> int:
    mask = response.get("legalMask")
    if (not isinstance(mask, list) or len(mask) != 6 or
            any(value not in (0, 1) for value in mask)):
        raise ValueError("invalid legal action mask")
    legal = [index for index, enabled in enumerate(mask) if enabled == 1]
    if not legal:
        raise ValueError("controller offered no legal action")
    if profile == "random_legal":
        return rng.choice(legal)
    if response.get("phase") == "DRAW":
        preference = ((4, 3, 2, 1, 0) if profile == "draw_heavy" else
                      (0, 1, 2, 3, 4))
    else:
        preference = ((4, 3, 2, 1, 0) if profile == "pressure" else
                      (1, 2, 0, 3, 4))
    return next(index for index in preference if index in legal)


def audit_hand(*, session_index: int, hand_index: int, response: dict,
               bridge, seats: int, pool: int, profile: str,
               rng: random.Random) -> dict:
    decisions = []
    ledgers = []
    while response.get("type") == "decision":
        index = len(decisions)
        before = validate_ledger(response, seats=seats, pool=pool,
                                 hand_index=hand_index, decision_index=index)
        seat = response.get("seat")
        if type(seat) is not int or not 0 <= seat < seats:
            raise ValueError("invalid acting seat")
        selected = action_index(response, profile, rng)
        decisions.append({"seat": seat, "phase": response["phase"],
                          "actionIndex": selected, "legalMask": response["legalMask"]})
        ledgers.append(before)
        response = bridge({"command": "step", "actionIndex": selected})
    if response.get("type") != "hand_end":
        raise ValueError("controller did not end the hand")
    terminal = validate_ledger(response, seats=seats, pool=pool,
                               hand_index=hand_index,
                               decision_index=len(decisions))
    ledgers.append(terminal)
    events = response.get("publicActionTrace")
    if not isinstance(events, list) or len(events) != len(decisions):
        raise ValueError("decision/public event count mismatch")
    for index, (decision, event) in enumerate(zip(decisions, events)):
        seat = decision["seat"]
        if event.get("seat") != seat or event.get("stackBefore") != ledgers[index]["stacks"][seat]:
            raise ValueError("action does not match its pre-decision ledger")
        amount = event.get("amount")
        if type(amount) is not int or amount < 0 or amount > event["stackBefore"]:
            raise ValueError("invalid recorded action amount")
        if decision["phase"] == "BET":
            if (event.get("type") != "BET_ACTION" or
                    event.get("action") != BET_LABELS[decision["actionIndex"]]):
                raise ValueError("bet action label differs from legal selection")
        elif decision["phase"] == "DRAW":
            if (event.get("type") != "DRAW_ACTION" or
                    event.get("drawCount") != decision["actionIndex"] or amount != 0):
                raise ValueError("draw action differs from legal selection")
        else:
            raise ValueError("unknown controller phase")
        if index + 1 < len(decisions):
            after = ledgers[index + 1]
            if (after["stacks"][seat] != ledgers[index]["stacks"][seat] - amount or
                    any(after["stacks"][other] != ledgers[index]["stacks"][other]
                        for other in range(seats) if other != seat)):
                raise ValueError("intermediate stack transition differs from public action")
    starting = response.get("startingStacks")
    ending = response.get("endingStacks")
    deltas = response.get("chipDeltaBySeat")
    if (not all(isinstance(values, list) and len(values) == seats
                for values in (starting, ending, deltas)) or
            ending != terminal["stacks"] or sum(starting) != pool or
            sum(deltas) != 0 or
            any(starting[seat] + deltas[seat] != ending[seat]
                for seat in range(seats))):
        raise ValueError("terminal all-seat chip ledger mismatch")
    return {"sessionIndex": session_index, "handIndex": hand_index,
            "startingStacks": starting, "endingStacks": ending,
            "chipDeltaBySeat": deltas, "decisions": decisions,
            "ledgers": ledgers, "publicActionTrace": events}


def audit(*, output_dir: Path, hands_per_session: int, sessions_per_profile: int,
          seed_base: int) -> dict:
    if (not 1 <= hands_per_session <= 100 or
            not 1 <= sessions_per_profile <= 10 or
            type(seed_base) is not int):
        raise ValueError("bounded positive sessions, hands, and integer seed required")
    output_dir = output_dir.resolve()
    protected = (ROOT / "public", ROOT / "src" / "config" / "ai")
    if output_dir.exists() or any(output_dir == path or path in output_dir.parents
                                  for path in protected):
        raise ValueError("output must be a new isolated directory")
    output_dir.mkdir(parents=True)
    raw_path = output_dir / "hand-ledgers.jsonl.partial"
    process = subprocess.Popen(["node", str(BRIDGE)], cwd=ROOT,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, bufsize=1)

    def send(request: dict) -> dict:
        process.stdin.write(json.dumps(request) + "\n")
        process.stdin.flush()
        line = process.stdout.readline()
        if not line:
            raise RuntimeError("controller bridge ended unexpectedly")
        response = json.loads(line)
        if response.get("type") == "error":
            raise ValueError(response.get("message", "controller bridge error"))
        return response

    counts = Counter()
    decisions = 0
    try:
        with raw_path.open("x") as output:
            for group_index, (seats, occupied, tournament) in enumerate(GROUPS):
                group = f'{seats}/{occupied}-{"mtt" if tournament else "cash"}'
                for profile_index, profile in enumerate(PROFILES):
                    for session_index in range(sessions_per_profile):
                        seed = seed_base + group_index * 100_000 + profile_index * 1000 + session_index
                        rng = random.Random(seed + 997)
                        response = send({"command": "reset", "seatCount": seats,
                                         "occupiedSeatCount": occupied,
                                         "isTournament": tournament,
                                         "includeLedger": True, "seed": seed})
                        previous_ending = None
                        for hand_index in range(hands_per_session):
                            if hand_index:
                                response = send({"command": "next_hand"})
                            row = audit_hand(session_index=session_index,
                                             hand_index=hand_index, response=response,
                                             bridge=send, seats=seats,
                                             pool=occupied * (2000 if tournament else 500),
                                             profile=profile, rng=rng)
                            if previous_ending is not None and row["startingStacks"] != previous_ending:
                                raise ValueError("inter-hand stack continuity mismatch")
                            previous_ending = row["endingStacks"]
                            row.update({"group": group, "profile": profile, "seed": seed})
                            output.write(json.dumps(row, separators=(",", ":")) + "\n")
                            counts[group + "|" + profile] += 1
                            decisions += len(row["decisions"])
    finally:
        process.stdin.close()
        process.wait(timeout=20)
        process.stdout.close()
        process.stderr.close()
    final_path = output_dir / "hand-ledgers.jsonl"
    raw_path.replace(final_path)
    report = {"schema": "mgx-d03-step-ledger-audit/v1",
              "status": "PASS_CONTROLLER_LEDGER_DIAGNOSTIC_ONLY",
              "hands": sum(counts.values()), "decisions": decisions,
              "cells": dict(counts), "handsPerSession": hands_per_session,
              "sessionsPerProfile": sessions_per_profile,
              "seedBase": seed_base,
              "bridgeSha256": sha256(BRIDGE),
              "controllerSourceSha256": sha256(ROOT / "src" / "rl" /
                                               "badugiControllerInteractiveV2Draft.js"),
              "handLedgersSha256": sha256(final_path),
              "limitations": "Scripted seats only; no ONNX strength or human-play evidence. This validates controller stacks plus committed chips at each decision and terminal stacks, but not every internal pot mutation."}
    with (output_dir / "report.json").open("x") as stream:
        json.dump(report, stream, indent=2, sort_keys=True)
        stream.write("\n")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--hands-per-session", type=int, default=20)
    parser.add_argument("--sessions-per-profile", type=int, default=2)
    parser.add_argument("--seed-base", type=int, default=991176001)
    args = parser.parse_args()
    report = audit(output_dir=args.output, hands_per_session=args.hands_per_session,
                   sessions_per_profile=args.sessions_per_profile,
                   seed_base=args.seed_base)
    print(json.dumps({key: report[key] for key in ("status", "hands", "decisions")}))


if __name__ == "__main__":
    main()
