"""Audit residual experiment sources and keep deal, schedule and unknown seeds distinct.

Only the explicitly reviewed one-hand collectors are certified as reset seeds.
Other root seeds are excluded conservatively, but not called dealt decks. This
tool reads artifact sources; it never modifies them or starts a simulation.
"""

from __future__ import annotations

import argparse
from array import array
import hashlib
import json
from pathlib import Path
import re
import sys

MODULUS = 2**32
RESET_SOURCES = {
    "d03-iron-multistreet-value-audit-20261117/betting-decisions.jsonl": "collect_betting_decisions.py",
    "d03-iron-multistreet-value-audit-20261117/smoke-decisions.jsonl": "collect_betting_decisions.py",
    "d03-iron-predraw-trajectory-audit-20261122/trajectory-hands.jsonl.partial": "collect.py",
    "d03-iron-cross-leak-audit-20261117/draw-decisions.jsonl": "collect_draw_decisions.py",
    "d03-iron-hand-range-audit-20261117/first-bet-calls.jsonl": "collect_opening_calls.py",
    "d03-iron-hand-range-audit-20261117/smoke.jsonl": "collect_opening_calls.py",
    "d03-iron-range-calibration-20261117/fit-rows.jsonl": "collect.py",
    "d03-iron-range-calibration-20261117/validate-rows.jsonl": "collect.py",
    "d03-predraw-bb-prior-raise-20261125/safety-rows.jsonl.partial": "run.py",
}
RESET_PLAN = {"d03-iron-cross-leak-audit-20261117": "frozen-draw-plan.json"}
SESSION_STUDIES = frozenset("""
d03-a5-fourcard-all-street-natural-20261124
d03-a5-fourcard-all-street-pilot-20261124
d03-a5-fourcard-ordinary-frequency-20261124
d03-a5-fourcard-public-response-20261125
d03-a5-fourcard-reraise-guard-20261125
d03-numeric-threshold-pilot-20261122
d03-predraw-call-raise-natural-20261123
d03-predraw-exact-tk-natural-20261124
d03-predraw-raise-adversarial-20261123
d03-predraw-range-policy-20261123
d03-predraw-range-policy-v2-20261123
d03-predraw-range-policy-v4-20261123
d03-predraw-threecard-bands-natural-20261124
d03-second-fold-fresh-opponent-20261123
d03-third-oop-pat-vs-draw-natural-20261123
d03-third-oop-value-natural-20261123
""".split())
SESSION_PRODUCER = {"d03-numeric-threshold-pilot-20261122": "run_natural.py",
                    "d03-second-fold-fresh-opponent-20261123": "run_unknown.py"}


def source_class(relative: str, family: str) -> str:
    if family == "SEED_SCHEDULE":
        return "SCHEDULE_RESERVATION_NOT_DEALT_PROOF"
    if family != "SEED_BEARING_EXPERIMENT":
        raise ValueError("source outside reviewed inventory scope")
    if relative in RESET_SOURCES:
        return "RECORDED_ONE_HAND_RESET_SEED"
    study, _, name = relative.partition("/")
    if study in SESSION_STUDIES and name in {"safety-rows.jsonl.partial",
                                               "pilot-rows.jsonl.partial"}:
        return "RECORDED_SESSION_DECKS"
    return "UNRESOLVED_ROOT_SEED_EXCLUSION_ONLY"


def _root_seed(row: dict) -> int:
    seed = row.get("seed")
    if type(seed) is not int or seed < 0:
        raise ValueError("missing or invalid root seed")
    return seed % MODULUS


def session_decks(row: dict, horizon: int) -> tuple[list[int], int | None]:
    seed = _root_seed(row)
    arms = row.get("arms")
    if not isinstance(arms, dict) or len(arms) < 2:
        raise ValueError("session arms missing")
    counts = [arm.get("completedHeroHands") for arm in arms.values()
              if isinstance(arm, dict)]
    if (len(counts) != len(arms) or any(type(n) is not int or
            not 1 <= n <= horizon for n in counts)):
        raise ValueError("invalid completed hero hand count")
    completed = max(counts)
    confirmed = [(seed + 1009 * i) % MODULUS for i in range(completed)]
    possible = ((seed + 1009 * completed) % MODULUS if completed < horizon else None)
    return confirmed, possible


def _write_u32(path: Path, values: set[int]) -> dict:
    ordered = array("I", sorted(values))
    with path.open("xb") as stream:
        ordered.tofile(stream)
    return {"path": path.name, "count": len(ordered),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def build(inventory_path: Path, previous_manifest_path: Path, root: Path,
          output: Path) -> dict:
    if sys.byteorder != "little":
        raise ValueError("u32 index requires little endian")
    inventory = json.loads(inventory_path.read_text())
    if inventory.get("schema") != "mgx-d03-m2-remaining-source-inventory/v1":
        raise ValueError("unknown inventory schema")
    previous = json.loads(previous_manifest_path.read_text())
    indexed = {x["path"] for x in previous["sourceTags"]}
    sources = sorted((x for x in inventory["sources"] if
                      (x["family"] == "SEED_BEARING_EXPERIMENT" and x["path"] not in indexed)
                      or x["family"] == "SEED_SCHEDULE"), key=lambda x: x["path"])
    if (sum(x["family"] == "SEED_BEARING_EXPERIMENT" for x in sources) != 75 or
            sum(x["family"] == "SEED_SCHEDULE" for x in sources) != 12):
        raise ValueError("inventory/source scope changed")
    if len({x["path"] for x in sources}) != len(sources):
        raise ValueError("duplicate source path")
    if output.exists():
        raise FileExistsError(output)
    actual: set[int] = set()
    schedule: set[int] = set()
    unresolved: set[int] = set()
    boundary: set[int] = set()
    tags = []
    for source in sources:
        relative = source["path"]
        path = root / relative
        if path.stat().st_size != source["bytes"]:
            raise ValueError(f"source byte count changed: {relative}")
        kind = source_class(relative, source["family"])
        if kind == "SCHEDULE_RESERVATION_NOT_DEALT_PROOF":
            target = schedule
        elif kind in {"RECORDED_ONE_HAND_RESET_SEED", "RECORDED_SESSION_DECKS"}:
            target = actual
            study = relative.split("/", 1)[0]
            producer_name = (RESET_SOURCES[relative] if relative in RESET_SOURCES else
                             SESSION_PRODUCER.get(study, "run.py"))
            producer = root / study / producer_name
            code = producer.read_text()
            if not re.search(r"['\"]command['\"]\s*:\s*['\"]reset['\"]", code):
                raise ValueError(f"reset producer changed: {relative}")
            if kind == "RECORDED_ONE_HAND_RESET_SEED" and "next_hand" in code:
                raise ValueError(f"one-hand producer now advances hands: {relative}")
            if kind == "RECORDED_SESSION_DECKS" and "next_hand" not in code:
                raise ValueError(f"session producer lacks next_hand: {relative}")
            plan_name = ("safety-plan.json" if relative ==
                         "d03-predraw-bb-prior-raise-20261125/safety-rows.jsonl.partial" else
                         "pilot-plan.json" if kind == "RECORDED_SESSION_DECKS" and
                         study == "d03-a5-fourcard-all-street-pilot-20261124" else
                         "safety-plan.json" if kind == "RECORDED_SESSION_DECKS" else
                         RESET_PLAN.get(study, "frozen-plan.json"))
            plan = root / study / plan_name
            plan_data = json.loads(plan.read_text())
            expected_code = (plan_data.get("collectorSha256") or
                             plan_data.get("runCodeSha256") or
                             plan_data.get("sha256", {}).get("collector"))
            if not expected_code or hashlib.sha256(producer.read_bytes()).hexdigest() != expected_code:
                raise ValueError(f"producer does not match frozen plan: {relative}")
            if kind == "RECORDED_SESSION_DECKS":
                horizon = plan_data.get("handsPerSessionMax")
                if horizon not in {1, 20}:
                    raise ValueError(f"unexpected session horizon: {relative}")
        else:
            target = unresolved
        digest = hashlib.sha256()
        count = 0
        seen: set[int] = set()
        missing_root = 0
        confirmed_uses = boundary_uses = 0
        with path.open("rb") as stream:
            for raw in stream:
                if not raw.endswith(b"\n"):
                    raise ValueError(f"partial/unframed row: {relative}:{count + 1}")
                digest.update(raw)
                row = json.loads(raw)
                if not isinstance(row, dict):
                    raise ValueError(f"non-object row: {relative}:{count + 1}")
                if kind == "UNRESOLVED_ROOT_SEED_EXCLUSION_ONLY" and "seed" not in row:
                    missing_root += 1
                else:
                    try:
                        seed = _root_seed(row)
                        if kind == "RECORDED_SESSION_DECKS":
                            decks, possible = session_decks(row, horizon)
                            seen.update(decks)
                            confirmed_uses += len(decks)
                            if possible is not None:
                                boundary.add(possible)
                                boundary_uses += 1
                        else:
                            seen.add(seed)
                    except ValueError as exc:
                        raise ValueError(f"{relative}:{count + 1}: {exc}") from exc
                count += 1
        if count != source["rows"] or digest.hexdigest() != source["sha256FromFullAudit"]:
            raise ValueError(f"row count or full SHA mismatch: {relative}")
        if kind == "RECORDED_ONE_HAND_RESET_SEED":
            # Decision-level rows may repeat the same reset seed many times.
            confirmed_uses = len(seen)
        target.update(seen)
        tag = {"path": relative, "classification": kind, "rows": count,
               "uniqueRootSeeds": len(seen), "rowsWithoutRootSeed": missing_root,
               "confirmedRecordedDeckUses": confirmed_uses,
               "uncertainBoundaryExclusions": boundary_uses,
               "bytes": source["bytes"],
               "sourceSha256": digest.hexdigest()}
        if kind in {"RECORDED_ONE_HAND_RESET_SEED", "RECORDED_SESSION_DECKS"}:
            tag["producerPath"] = str(producer.relative_to(root))
            tag["producerSha256"] = hashlib.sha256(producer.read_bytes()).hexdigest()
            tag["producerPlanPath"] = str(plan.relative_to(root))
            tag["producerPlanSha256"] = hashlib.sha256(plan.read_bytes()).hexdigest()
        tags.append(tag)
    output.mkdir(parents=True)
    files = {"confirmedRecorded": _write_u32(output / "confirmed-recorded.u32", actual),
             "uncertainBoundary": _write_u32(output / "uncertain-boundary.u32", boundary),
             "schedule": _write_u32(output / "schedule-reservation.u32", schedule),
             "unresolvedRoot": _write_u32(output / "unresolved-root.u32", unresolved),
             "conservativeExclusions": _write_u32(output / "conservative-exclusions.u32",
                                              actual | boundary | schedule | unresolved)}
    manifest = {"schema": "mgx-d03-m2-last-source-index/v1",
                "scope": "75 remaining experiment sources and 12 schedules; no game collection",
                "inventorySha256": hashlib.sha256(inventory_path.read_bytes()).hexdigest(),
                "previousManifestSha256": hashlib.sha256(previous_manifest_path.read_bytes()).hexdigest(),
                "sourceTags": tags, "files": files,
                "limit": "Only reviewed one-hand reset row seeds count as actual. Missing reset rows, "
                         "session-derived deck seeds and incomplete external sources remain unresolved."}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--previous-manifest", type=Path, required=True)
    parser.add_argument("--artifact-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = build(args.inventory, args.previous_manifest, args.artifact_root, args.output)
    print(json.dumps({"files": result["files"], "sources": len(result["sourceTags"])}))


if __name__ == "__main__":
    main()
