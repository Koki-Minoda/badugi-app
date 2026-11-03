"""Audit public Badugi event reconstruction against pre-inference snapshots.

This is a local diagnostic. It does not connect a training encoder to live play.
"""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path


def audit_snapshot(row, previous_events, expected_total_chips):
    events = row["publicEvents"]
    problems = []
    if events[: len(previous_events)] != previous_events:
        problems.append("event history is not append-only")
    if row["playerCount"] != 6 or len(row["players"]) != 6:
        problems.append("not a six-seat snapshot")
    if row["totalStacks"] + row["totalInvested"] != expected_total_chips:
        problems.append("stack plus invested chip conservation failed")

    event_invested = 0
    draw_round = 0
    previous_action_phase = "BET"
    last_draw = [None] * 6
    opened_by_round = [[False] * 6 for _ in range(4)]
    draw_history = [[0] * 3 for _ in range(6)]
    for event in events:
        kind = event["type"]
        if kind == "BLINDS_POSTED":
            event_invested += (event.get("sbAmount") or 0) + (event.get("bbAmount") or 0)
        elif kind == "ANTE_POSTED":
            event_invested += event.get("amount") or 0
        elif kind == "BET_ACTION":
            if previous_action_phase == "DRAW":
                draw_round += 1
            previous_action_phase = "BET"
            event_invested += event.get("amount") or 0
            seat = event.get("seat")
            if isinstance(seat, int) and 0 <= seat < 6 and draw_round < 4:
                if event.get("action") in ("bet", "raise"):
                    opened_by_round[draw_round][seat] = True
        elif kind == "DRAW_ACTION":
            previous_action_phase = "DRAW"
            seat = event.get("seat")
            if isinstance(seat, int) and 0 <= seat < 6:
                last_draw[seat] = event.get("drawCount")
                if draw_round < 3:
                    draw_history[seat][draw_round] = event.get("drawCount") or 0

    expected_round = draw_round + int(row["phase"] == "BET" and previous_action_phase == "DRAW")
    if expected_round != row["drawRound"]:
        problems.append(f"draw round differs: events={expected_round}, controller={row['drawRound']}")
    if event_invested != row["totalInvested"]:
        problems.append(f"invested chips differ: events={event_invested}, controller={row['totalInvested']}")
    for seat, player in enumerate(row["players"]):
        if last_draw[seat] != player["lastDrawCount"]:
            problems.append(f"seat {seat} last draw differs")

    return problems, {
        "eventInvested": event_invested,
        "eventDrawRound": expected_round,
        "lastDraw": last_draw,
        "openedByBetRound": opened_by_round,
        "drawHistory": draw_history,
    }


def audit_report(path):
    payload = json.loads(path.read_text())
    rows = payload["rows"]
    issues = []
    if not rows:
        issues.append("empty report")
        return {"mode": payload.get("mode"), "snapshots": 0, "issues": issues}
    expected_chips = rows[0]["totalStacks"] + rows[0]["totalInvested"]
    hand_ids = {row["handId"] for row in rows}
    if len(hand_ids) != 1:
        issues.append("report contains multiple hands")
    previous_events = []
    reconstructed = []
    for index, row in enumerate(rows):
        problems, fields = audit_snapshot(row, previous_events, expected_chips)
        issues.extend(f"snapshot {index}: {problem}" for problem in problems)
        previous_events = row["publicEvents"]
        reconstructed.append(fields)
    return {
        "mode": payload["mode"],
        "seed": payload["seed"],
        "hands": len(hand_ids),
        "snapshots": len(rows),
        "byPhase": dict(Counter(row["phase"] for row in rows)),
        "expectedTotalChips": expected_chips,
        "eventInvestedMatches": sum(fields["eventInvested"] == row["totalInvested"]
                                    for fields, row in zip(reconstructed, rows)),
        "eventDrawRoundMatches": sum(fields["eventDrawRound"] == row["drawRound"]
                                     for fields, row in zip(reconstructed, rows)),
        "lastDrawSeatMatches": sum(fields["lastDraw"][seat] == row["players"][seat]["lastDrawCount"]
                                   for fields, row in zip(reconstructed, rows) for seat in range(6)),
        "issues": issues,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("reports", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    observations = [audit_report(path) for path in args.reports]
    report = {
        "status": "PUBLIC_EVENT_RECONSTRUCTION_MATCH_PILOT_ONLY" if all(
            not observation["issues"] for observation in observations
        ) else "PUBLIC_EVENT_RECONSTRUCTION_MISMATCH",
        "scope": "Pre-inference public event and chip reconstruction for the supplied hands only; no model-strength inference.",
        "inputReports": [{"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                         for path in args.reports],
        "observations": observations,
        "limitations": [
            "Only sampled hands and reached states were checked; skipped/zero-action rounds may need separate handling.",
            "Bet-history flags can be derived but were not checked against live ground truth; actor discarded-card values were not captured.",
            "Training stack, blind, bet-size and opponent distributions differ from current live cash/MTT play.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "observations": observations}))
    return 0 if report["status"] == "PUBLIC_EVENT_RECONSTRUCTION_MATCH_PILOT_ONLY" else 1


if __name__ == "__main__":
    raise SystemExit(main())
