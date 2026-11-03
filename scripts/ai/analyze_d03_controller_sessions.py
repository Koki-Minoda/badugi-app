#!/usr/bin/env python3
"""Validate D03 controller session reports and describe unpaired session outcomes.

This never makes an automatic model promotion or tier-strength decision.
"""

import argparse
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from statistics import mean, stdev


MODEL_IDS = {
    "beginner": "model-badugi-sixmax-standard-dqn-v2",
    "standard": "model-badugi-sixmax-standard-e11",
    "pro": "model-badugi-pro-v1",
    "iron": "model-badugi-iron-v1",
    "worldmaster": "model-badugi-worldmaster-v1",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def describe(values):
    count = len(values)
    average = mean(values)
    if count < 2:
        return {"sessions": count, "mean": average, "sd": None,
                "se": None, "descriptive95": None}
    sd = stdev(values)
    se = sd / math.sqrt(count)
    return {"sessions": count, "mean": average, "sd": sd, "se": se,
            "descriptive95": [average - 1.96 * se, average + 1.96 * se]}


def analyze(manifest_path, reports_dir):
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
    specs = manifest.get("sessions")
    require(manifest.get("purpose") == "pilot-only" and isinstance(specs, list) and specs,
            "Only explicit pilot manifests are accepted")
    frozen_head = manifest.get("sourceHead")
    frozen_model_hashes = manifest.get("modelHashes", {})
    require(frozen_head is None or isinstance(frozen_head, str) and len(frozen_head) == 40,
            "Frozen source commit must be a full SHA")
    require(isinstance(frozen_model_hashes, dict), "Frozen model hashes must be a map")
    ids = [spec.get("sessionId") for spec in specs]
    seeds = [spec.get("seed") for spec in specs]
    require(len(ids) == len(set(ids)) and all(ids), "Session IDs must be unique")
    require(len(seeds) == len(set(seeds)) and all(isinstance(seed, int) and seed > 0 for seed in seeds),
            "Independent sessions require distinct positive seeds")
    require(set(path.stem for path in reports_dir.glob("*.json")) == set(ids),
            "Report set must match the manifest exactly")

    cells = {}
    source_heads = set()
    model_hashes = {}
    session_summaries = []
    for spec in specs:
        session_id = spec["sessionId"]
        report = json.loads((reports_dir / f"{session_id}.json").read_text())
        for key in ("sessionId", "modelTier", "seats", "mode"):
            require(report.get(key) == spec.get(key), f"{session_id}: {key} mismatch")
        require(report.get("manifestSha256") == manifest_hash,
                f"{session_id}: manifest hash mismatch")
        require(report.get("sessionSeed") == spec["seed"],
                f"{session_id}: seed mismatch")
        require(report.get("plannedHandCount") == spec["handCount"],
                f"{session_id}: planned hands mismatch")
        require(report.get("opponentStructure") == {
            "seatZero": spec.get("heroPolicy", "heroStay"), "otherCpuSeats": "teacher"},
            f"{session_id}: opponent structure mismatch")
        require(report.get("sourceHead"), f"{session_id}: source commit missing")
        require(frozen_head is None or report["sourceHead"] == frozen_head,
                f"{session_id}: source commit differs from frozen manifest")
        source_heads.add(report["sourceHead"])
        hands = report.get("hands")
        require(isinstance(hands, list) and hands,
                f"{session_id}: no completed hand records")
        hand_ids = {hand.get("handId") for hand in hands}
        require(None not in hand_ids and len(hand_ids) == len(hands),
                f"{session_id}: hand IDs missing or duplicated")
        observed = len(hands)
        require(report.get("observedHandCount") == observed,
                f"{session_id}: observed hands mismatch")
        if observed < spec["handCount"]:
            require(spec["mode"] == "tournament" and report.get("stopReason") in
                    ("tournament-finished", "hero-busted"),
                    f"{session_id}: unexplained early stop")
        require(all(hand.get("chipSum") == 0 for hand in hands),
                f"{session_id}: chip conservation failed")
        for hand in hands:
            target = next((seat for seat in hand.get("seats", []) if seat.get("seat") == 1), None)
            require(target is not None and target.get("delta") == hand.get("targetDelta"),
                    f"{session_id}: target seat delta mismatch")
            for event in hand.get("actionEvents", []):
                if event.get("type") != "BET_ACTION" or event.get("action") == "collect":
                    continue
                before, after, amount = (event.get(key) for key in
                                         ("stackBefore", "stackAfter", "amount"))
                require(all(isinstance(value, (int, float)) and math.isfinite(value)
                            for value in (before, after, amount))
                        and amount == max(0, before - after),
                        f"{session_id}: wager amount disagrees with stack movement")
        total = sum(hand["targetDelta"] for hand in hands)
        require(report.get("targetTotalChipDelta") == total,
                f"{session_id}: target total mismatch")
        require(math.isclose(report.get("targetChipPerPlannedHand"), total / spec["handCount"]),
                f"{session_id}: fixed-horizon chip/hand mismatch")
        tier = spec["modelTier"]
        target_statuses = report.get("targetStatuses", [])
        require(target_statuses, f"{session_id}: no target decisions")
        require(len(target_statuses) == report.get("targetDecisions")
                and all(row.get("handId") in hand_ids for row in target_statuses),
                f"{session_id}: target decision cannot be linked to a completed hand")
        decisions = [row for row in report.get("decisionTrace", [])
                     if row.get("phase") in ("BET", "DRAW")]
        require(len(decisions) == report.get("decisions")
                and all(row.get("handId") in hand_ids for row in decisions),
                f"{session_id}: controller decision cannot be linked to a completed hand")
        status_counts = Counter(row.get("status") for row in target_statuses)
        if tier:
            asset = report.get("modelAsset") or {}
            require(asset.get("id") == MODEL_IDS[tier] and asset.get("sha256")
                    and asset.get("inputShape") == [96] and asset.get("outputShape") == [6],
                    f"{session_id}: model provenance mismatch")
            if tier in model_hashes:
                require(model_hashes[tier] == asset["sha256"],
                        f"{session_id}: model hash changed")
            model_hashes[tier] = asset["sha256"]
            require(not frozen_model_hashes
                    or frozen_model_hashes.get(tier) == asset["sha256"],
                    f"{session_id}: model differs from frozen manifest")
            require(all(row.get("status") in
                        ("used", "fallback", "failed", "not-connected")
                        and (row.get("model") == MODEL_IDS[tier] if row.get("status") == "used"
                             else bool(row.get("fallbackReason")))
                        for row in target_statuses),
                    f"{session_id}: model decision provenance incomplete")
        else:
            require(report.get("modelAsset") is None
                    and all(row.get("status") == "not-connected" for row in target_statuses),
                    f"{session_id}: teacher provenance mismatch")
        key = (spec["seats"], spec["mode"], spec.get("heroPolicy", "heroStay"), tier)
        cells.setdefault(key, []).append(total / spec["handCount"])
        session_summaries.append({"sessionId": session_id, "modelTier": tier,
                                  "seats": spec["seats"], "mode": spec["mode"],
                                  "opponent": key[2], "plannedHands": spec["handCount"],
                                  "observedHands": observed, "stopReason": report["stopReason"],
                                  "targetDecisionStatuses": dict(status_counts),
                                  "modelUsedFraction": (status_counts.get("used", 0) /
                                                        len(target_statuses)) if tier else None,
                                  "fallbackReasons": dict(Counter(
                                      row.get("fallbackReason") for row in target_statuses
                                      if row.get("status") != "used")) if tier else {},
                                  "targetChipPerPlannedHand": total / spec["handCount"]})
    require(len(source_heads) == 1, "Reports span different source commits")
    require(set(frozen_model_hashes).issubset(MODEL_IDS),
            "Frozen manifest lists unknown model tier")

    cell_summaries = []
    for (seats, mode, opponent, tier), values in sorted(
            cells.items(), key=lambda item: (item[0][0], item[0][1], item[0][2], str(item[0][3]))):
        cell_summaries.append({"seats": seats, "mode": mode, "opponent": opponent,
                               "modelTier": tier, **describe(values)})
    comparisons = []
    for (seats, mode, opponent, tier), values in cells.items():
        if tier is None:
            continue
        teacher = cells.get((seats, mode, opponent, None))
        if not teacher:
            comparisons.append({"seats": seats, "mode": mode, "opponent": opponent,
                                "modelTier": tier, "status": "missing-teacher"})
            continue
        difference = mean(values) - mean(teacher)
        if len(values) < 2 or len(teacher) < 2:
            interval = None
        else:
            halfwidth = 1.96 * math.sqrt(stdev(values) ** 2 / len(values)
                                         + stdev(teacher) ** 2 / len(teacher))
            interval = [difference - halfwidth, difference + halfwidth]
        comparisons.append({"seats": seats, "mode": mode, "opponent": opponent,
                            "modelTier": tier, "modelSessions": len(values),
                            "teacherSessions": len(teacher), "difference": difference,
                            "descriptive95": interval, "status": "pilot-only-no-strength-decision"})
    return {"status": "VALID_PILOT_NO_STRENGTH_DECISION",
            "analysisUnit": "independent-session",
            "primaryMetric": "target total chip delta / planned hand count",
            "uncertainty": "descriptive unpaired normal 95% intervals when each arm has >=2 sessions",
            "manifestSha256": manifest_hash, "sourceHead": source_heads.pop(),
            "modelHashes": model_hashes, "sessions": session_summaries,
            "cells": cell_summaries, "comparisons": comparisons,
            "limitations": ["Pilot-only scripted opponents and API mock",
                            "No causal pairing from equal initial seeds",
                            "No automatic model promotion or tier-strength certification"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--reports", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = analyze(args.manifest, args.reports)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"{result['status']}: {len(result['sessions'])} sessions")


if __name__ == "__main__":
    main()
