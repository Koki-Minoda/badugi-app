"""Index recorded experiment decks without treating a seed as a generic 20-hand run.

The input inventory is an immutable, source-audited manifest.  One-hand branch
rows share their natural deck.  Natural rows record terminal hero-hand counts
per arm; an early-stop boundary is excluded conservatively but is not called a
confirmed completed hand.  No source is used for model selection by this tool.
"""

from __future__ import annotations

import argparse
from array import array
import hashlib
import json
from pathlib import Path
import sys

import numpy as np

from audit_badugi_entry_m2_unmatched import sha256
from build_badugi_entry_m2_handtrace_index import _flush_run, _merge_runs

MODULUS = 2**32
RUN_ROWS = 1_000_000
ONE_HAND_STUDIES = frozenset("""
d03-entry-opportunity-pilot-20261126 d03-full-street-collector-20261123
d03-mtt-sixmax-entry-branch-20261126 d03-mtt-sixmax-three-card-six-nine-entry-20261126
d03-predraw-bb-prior-raise-20261125 d03-predraw-bet-raise-branch-20261123
d03-predraw-position-branch-20261123 d03-predraw-range-table-20261123
d03-third-oop-bet-check-branch-20261123 d03-third-oop-rank-draw-coverage-20261123
""".split())
BRANCH_STUDIES = frozenset("""
d03-predraw-eight-low-prior-raise-20261123 d03-predraw-nine-low-prior-raise-20261123
d03-predraw-prior-raise-v1-20261123 d03-predraw-rare-four-low-v2-20261123
d03-predraw-seven-low-prior-raise-20261123 d03-predraw-six-low-prior-raise-20261123
""".split())
NATURAL_STUDIES = frozenset("""
d03-a5-fourcard-all-street-natural-20261124 d03-a5-fourcard-ordinary-frequency-20261124
d03-a5-fourcard-public-response-20261125 d03-a5-fourcard-reraise-guard-20261125
d03-numeric-threshold-pilot-20261122 d03-predraw-a5-reraise-natural-20261123
d03-predraw-call-raise-natural-20261123 d03-predraw-exact-tk-natural-20261124
d03-predraw-nine-low-ordinary-20261123 d03-predraw-nine-low-reraise-natural-20261123
d03-predraw-raise-adversarial-20261123 d03-predraw-range-policy-v2-20261123
d03-predraw-range-policy-v4-20261123 d03-predraw-threecard-bands-natural-20261124
d03-second-fold-fresh-opponent-20261123 d03-third-oop-pat-vs-draw-natural-20261123
d03-third-oop-value-natural-20261123
""".split())


def source_kind(relative: str) -> str | None:
    parts = Path(relative).parts
    if len(parts) != 2:
        return None
    study, name = parts
    if study in ONE_HAND_STUDIES and name == "rows.jsonl.partial":
        return "one_hand"
    if study in BRANCH_STUDIES and name == "branch-rows.jsonl.partial":
        return "one_hand_branch"
    if study in NATURAL_STUDIES and name == "natural-rows.jsonl.partial":
        return "natural_session"
    return None


def _nonnegative_int(value: object) -> bool:
    return type(value) is int and value >= 0


def deck_counts(row: dict, kind: str, horizon: int) -> tuple[int, int, int]:
    """Return base seed, confirmed completed count, conservative boundary count.

    Natural producers reset once and next_hand before each later hand.  The
    confirmed count is the maximum completedHeroHands across arms, since arms
    replay the same seeded deck sequence.  A truncated arm may have requested
    the next hand before discovering bust/collapse/no-decision termination; one
    additional boundary deck is reserved, not asserted to have been dealt.
    """
    seed = row.get("seed")
    if not _nonnegative_int(seed) or seed >= MODULUS or not _nonnegative_int(row.get("globalIndex")):
        raise ValueError("invalid recorded root seed or row index")
    if kind in {"one_hand", "one_hand_branch"}:
        if horizon != 1 or not ("target" in row or isinstance(row.get("heroDecisions"), list)):
            raise ValueError("one-hand producer row shape or plan changed")
        return seed, 1, 0
    arms = row.get("arms")
    if kind != "natural_session" or not isinstance(arms, dict) or len(arms) < 2 or horizon != 20:
        raise ValueError("natural-session producer row shape or plan changed")
    counts = []
    early = False
    for arm in arms.values():
        if not isinstance(arm, dict) or not _nonnegative_int(arm.get("completedHeroHands")):
            raise ValueError("missing recorded completedHeroHands")
        count = arm["completedHeroHands"]
        if not 1 <= count <= horizon:
            raise ValueError("completedHeroHands outside plan horizon")
        counts.append(count)
        for name in ("heroBustedBeforeHorizon", "tableCollapsedBeforeHorizon"):
            flag = arm.get(name, 0)
            if flag not in (0, 1) or type(flag) is not int:
                raise ValueError("invalid early-stop flag")
            early |= bool(flag)
    completed = max(counts)
    possible = int(completed < horizon and early)
    # Even without an explicit flag, next_hand may return an empty hand_end.
    # The extra residue is an exclusion-only upper bound, not completed play.
    possible = max(possible, int(completed < horizon))
    return seed, completed, possible


def _horizon(root: Path, relative: str, kind: str) -> tuple[int, str]:
    study = relative.split("/", 1)[0]
    plan_name = "natural-plan.json" if kind == "natural_session" else (
        "branch-plan.json" if kind == "one_hand_branch" else "frozen-plan.json")
    plan_path = root / study / plan_name
    if not plan_path.is_file():
        raise ValueError(f"missing producer plan: {study}/{plan_name}")
    plan = json.loads(plan_path.read_text())
    if kind == "natural_session":
        horizon = plan.get("handsPerSessionMax")
    else:
        horizon = 1
        # These frozen one-hand collectors reset for each seed and do not call
        # next_hand.  Reject a contradictory explicit plan horizon.
        for key in ("handsPerSession", "handsPerSessionMax"):
            if key in plan and plan[key] != 1:
                raise ValueError(f"one-hand plan changed: {study}/{plan_name}")
    if horizon != (20 if kind == "natural_session" else 1):
        raise ValueError(f"unexpected producer horizon: {study}/{plan_name}")
    return horizon, sha256(plan_path)


def build(inventory_path: Path, producer_checks_path: Path, artifact_root: Path, output_dir: Path,
          run_rows: int = RUN_ROWS) -> dict:
    if sys.byteorder != "little" or not 1 <= run_rows <= RUN_ROWS:
        raise ValueError("requires little endian and run_rows in 1..1,000,000")
    inventory = json.loads(inventory_path.read_text())
    if inventory.get("schema") != "mgx-d03-m2-remaining-source-inventory/v1":
        raise ValueError("unknown inventory schema")
    producer_checks = json.loads(producer_checks_path.read_text())
    if producer_checks.get("schema") != "mgx-d03-m2-producer-checks/v1":
        raise ValueError("unknown producer-checks schema")
    checks_by_path = {e["path"]: e for e in producer_checks["sources"]}
    if len(checks_by_path) != len(producer_checks["sources"]):
        raise ValueError("duplicate producer-check path")
    sources = sorted((e for e in inventory["sources"] if source_kind(e["path"])),
                     key=lambda e: e["path"])
    if len(sources) != 33 or len({e["path"] for e in sources}) != 33:
        raise ValueError("expected exactly 33 reviewed producer files")
    output_dir.mkdir(parents=True, exist_ok=False)
    runs_dir = output_dir / "runs"
    runs_dir.mkdir()
    runs = []
    tags = []
    buffer = array("Q")
    total_rows = total_confirmed = total_boundary = 0
    for source_id, source in enumerate(sources):
        relative = source["path"]
        kind = source_kind(relative)
        path = artifact_root / relative
        horizon, plan_sha = _horizon(artifact_root, relative, kind)
        check = checks_by_path.get(relative)
        if not check or check["planSha256"] != plan_sha or check["rows"] != source["rows"]:
            raise ValueError(f"producer-check mismatch: {relative}")
        producer_path = artifact_root / check["producerPath"]
        if (sha256(producer_path) != check["producerSha256"] or
                check["planPath"] != f"{relative.split('/', 1)[0]}/" +
                ("natural-plan.json" if kind == "natural_session" else
                 "branch-plan.json" if kind == "one_hand_branch" else "frozen-plan.json")):
            raise ValueError(f"producer or plan changed: {relative}")
        evidence = check["evidence"]
        if kind == "natural_session":
            if (not evidence.get("producerCallsNextHand") or
                    check["status"] not in {"SESSION_ARMS_SAMPLED", "SESSION_ARMS_PARTIAL"}):
                raise ValueError(f"natural producer semantics changed: {relative}")
        elif (not evidence.get("producerCallsReset") or evidence.get("producerCallsNextHand") or
              check["status"] not in {"ONE_HAND_PRODUCER_SAMPLED",
                                      "ONE_HAND_BRANCH_PRODUCER_SAMPLED"}):
            raise ValueError(f"one-hand producer semantics changed: {relative}")
        if path.stat().st_size != source["bytes"]:
            raise ValueError(f"source size changed: {relative}")
        digest = hashlib.sha256()
        rows = confirmed = boundary = 0
        with path.open("rb") as stream:
            for line in stream:
                digest.update(line)
                if not line.strip():
                    raise ValueError(f"blank producer row: {relative}:{rows + 1}")
                rows += 1
                try:
                    seed, n_confirmed, n_boundary = deck_counts(json.loads(line), kind, horizon)
                except (json.JSONDecodeError, TypeError, ValueError) as error:
                    raise ValueError(f"unclassified producer row: {relative}:{rows}: {error}") from error
                confirmed += n_confirmed
                boundary += n_boundary
                for hand_index in range(n_confirmed + n_boundary):
                    residue = (seed + 1009 * hand_index) % MODULUS
                    buffer.append((residue << 16) | source_id)
                    if len(buffer) >= run_rows:
                        runs.append(_flush_run(runs_dir, buffer, len(runs)))
                        buffer = array("Q")
        if rows != source["rows"] or digest.hexdigest() != source["sha256FromFullAudit"]:
            raise ValueError(f"source row count or SHA changed: {relative}")
        total_rows += rows
        total_confirmed += confirmed
        total_boundary += boundary
        tags.append({"sourceId": source_id, "path": relative, "sourceClass": kind,
                     "sourceSha256": digest.hexdigest(), "sourceBytes": source["bytes"],
                     "producerPlanSha256": plan_sha,
                     "producerCodeSha256": check["producerSha256"],
                     "recordedRows": rows,
                     "confirmedRecordedDeckUses": confirmed,
                     "uncertainEarlyStopBoundaryResidues": boundary,
                     "completion": "PARTIAL_FILE" if check["status"] == "SESSION_ARMS_PARTIAL"
                     else "RECORDED_ROWS_ONLY"})
        print(f"verified_sources={source_id + 1}/33 rows={total_rows} "
              f"confirmed={total_confirmed} boundary={total_boundary}", flush=True)
    if buffer:
        runs.append(_flush_run(runs_dir, buffer, len(runs)))
    pairs, residues = _merge_runs(runs_dir, runs)
    result = {"schema": "mgx-d03-entry-m2-experiment-deck-index/v1",
              "status": "INDEX_BUILT_NOT_M2_CLEARANCE",
              "inventorySha256": sha256(inventory_path),
              "producerChecksSha256": sha256(producer_checks_path),
              "sourceFiles": len(tags), "sourceBytes": sum(t["sourceBytes"] for t in tags),
              "recordedRows": total_rows,
              "confirmedRecordedDeckUses": total_confirmed,
              "uncertainEarlyStopBoundaryResidues": total_boundary,
              "sourceResiduePairs": pairs, "uniqueExcludedDeckResidues": residues,
              "sourceTags": tags, "runs": runs,
              "pairIndex": {"file": "residue-source-pairs.u64le",
                            "sha256": sha256(output_dir / "residue-source-pairs.u64le")},
              "residueIndex": {"file": "actual-deck-residues.u32le",
                               "sha256": sha256(output_dir / "actual-deck-residues.u32le")},
              "limit": "Exclusion upper bound only. One-hand reset is a recorded deck use; natural completedHeroHands is terminal play. Early-stop boundary may be dealt but is not confirmed completed play. No training/evaluation reuse clearance."}
    with (output_dir / "manifest.json").open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    return {k: result[k] for k in ("status", "sourceFiles", "sourceBytes", "recordedRows",
                                   "confirmedRecordedDeckUses", "uncertainEarlyStopBoundaryResidues",
                                   "sourceResiduePairs", "uniqueExcludedDeckResidues")}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", required=True, type=Path)
    parser.add_argument("--producer-checks", required=True, type=Path)
    parser.add_argument("--artifact-root", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--run-rows", type=int, default=RUN_ROWS)
    args = parser.parse_args()
    print(json.dumps(build(args.inventory.resolve(), args.producer_checks.resolve(), args.artifact_root.resolve(),
                           args.output_dir.resolve(), args.run_rows)))


if __name__ == "__main__":
    main()
