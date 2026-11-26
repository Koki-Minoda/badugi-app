"""Deferred full scan of seed-bearing D03 JSONL outside the compact inventory.

Run only after review. The audit streams every listed byte and refuses PASS for
files with unresolved nonempty rows. It checks the 1.5M M2 screen reservations,
not model returns, and never starts a controller or consumes new deck seeds.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
from typing import Iterable

import numpy as np

SEED = re.compile(rb'"(?:seed|sessionSeed|deckSeed)"\s*:\s*(-?\d+)')
HAND_INDEX = re.compile(rb'"(?:handIndex|handInSession)"\s*:\s*(\d+)')
MODULUS = 2**32
HORIZON = 20


def source_class(relative_path: str) -> str | None:
    """Map only documented source formats to actual deck uses.

    Unknown formats remain unresolved.  In particular, an arbitrary seed token
    does not imply a 20-hand session, and a screened (but unselected) deal does
    not acquire 19 imaginary later hands.
    """
    parts = Path(relative_path).parts
    if len(parts) < 2:
        return None
    study, name = parts[0], parts[-1]
    screened_studies = {"d03-a5-fourcard-all-street-natural-20261124",
                        "d03-a5-fourcard-public-response-20261125",
                        "d03-a5-fourcard-reraise-guard-20261125"}
    if study in screened_studies and name == "screen-raw.jsonl.partial":
        return "screen_one_hand"
    if study in screened_studies and name == "selected.jsonl":
        return "selected_20_hand"
    if (study in {"d03-iron-conditional-snow-20261118",
                   "d03-iron-conditional-snow-street1-20261118"} and
            name == "paired-hands.jsonl.partial"):
        return "paired_one_hand"
    if study == "d03-iron-cross-leak-audit-20261117" and name == "targets.jsonl":
        return "target_one_hand"
    if study == "d03-iron-anchor-rate-20261117" and name == "hand-trace.jsonl":
        return "indexed_hand_trace"
    return None


def actual_deck_residues(relative_path: str, line: bytes) -> tuple[str | None, Iterable[int]]:
    """Return verified actual deck residues or no classification.

    This checks row shape in addition to the filename.  A changed producer
    schema is therefore unresolved rather than silently accepted.
    """
    kind = source_class(relative_path)
    if not kind:
        return None, []
    if kind == "screen_one_hand":
        # The raw row records a *contiguous screened range*, including every
        # rejected opening hand.  `selected` is only a sparse subset; checking
        # its seed tokens would miss most actual screened deck uses.
        try:
            row = json.loads(line)
            first = row["cell"]["firstSeed"]
            count = row["scanned"]
            selected = row["selected"]
        except (ValueError, KeyError, TypeError):
            return None, []
        if (type(first) is not int or type(count) is not int or count < 1 or
                first < 0 or first + count > MODULUS or not isinstance(selected, list) or
                any(not isinstance(item, dict) or type(item.get("seed")) is not int or
                    not first <= item["seed"] < first + count for item in selected)):
            return None, []
        return kind, range(first, first + count)
    values = [int(v) % MODULUS for v in SEED.findall(line)]
    if not values:
        return None, []
    if len(values) != 1:
        return None, []
    base = values[0]
    if kind in {"paired_one_hand", "target_one_hand"}:
        return kind, [base]
    if kind == "selected_20_hand":
        return kind, [(base + 1009 * i) % MODULUS for i in range(HORIZON)]
    hand_match = HAND_INDEX.search(line)
    if kind == "indexed_hand_trace" and hand_match:
        index = int(hand_match.group(1))
        if index < HORIZON:
            return kind, [(base + 1009 * index) % MODULUS]
    return None, []


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def audit(source_manifest: Path, screen_plan: Path, output: Path) -> dict:
    if output.exists():
        raise FileExistsError("M2 unmatched JSONL audit output already exists")
    source = json.loads(source_manifest.read_text())
    plan = json.loads(screen_plan.read_text())
    schedule_path = screen_plan.parent / plan["screenSeedScheduleFile"]
    if (plan.get("schema") != "mgx-d03-entry-m2-hero-screen/v1" or
            sha256(source_manifest) != plan["sourceManifestSha256"] or
            sha256(schedule_path) != plan["screenSeedScheduleSha256"]):
        raise ValueError("M2 unmatched audit input provenance changed")
    schedule = np.memmap(schedule_path, dtype="<u4", mode="r")
    if len(schedule) != 1_500_000 or len(np.unique(schedule)) != len(schedule):
        raise ValueError("M2 reserved screen seed schedule is incomplete")
    reserved = set(map(int, schedule))
    collisions = []
    unresolved = []
    scanned = []
    by_class = {}
    collision_residues = set()
    collision_by_class = {}
    total_bytes = total_rows = seed_tokens = actual_checked = collision_count = 0
    for entry in source["unmatchedJsonl"]:
        path = Path(source["artifactRoot"]) / entry["path"]
        if path.stat().st_size != entry["bytes"]:
            raise ValueError(f"M2 unmatched source changed: {entry['path']}")
        digest = hashlib.sha256()
        rows = tokens = unknown_rows = 0
        # Hash compressed bytes separately; ordinary JSONL hashes in one pass.
        compressed = path.name.endswith(".gz")
        if compressed:
            with path.open("rb") as source_bytes:
                for block in iter(lambda: source_bytes.read(1024 * 1024), b""):
                    digest.update(block)
        opener = gzip.open if compressed else Path.open
        unknown_format_rows = 0
        with opener(path, "rb") as stream:
            for line_number, line in enumerate(stream, 1):
                if not compressed:
                    digest.update(line)
                if not line.strip():
                    continue
                rows += 1
                values = SEED.findall(line)
                tokens += len(values)
                kind, actual = actual_deck_residues(entry["path"], line)
                if kind is None:
                    if values:
                        unknown_format_rows += 1
                    else:
                        unknown_rows += 1
                    continue
                by_class[kind] = by_class.get(kind, 0) + 1
                actual_checked += len(actual)
                for residue in actual:
                    if residue in reserved:
                        collision_count += 1
                        collision_residues.add(residue)
                        collision_by_class[kind] = collision_by_class.get(kind, 0) + 1
                        if len(collisions) < 100:
                            collisions.append({"path": entry["path"], "line": line_number,
                                               "sourceClass": kind,
                                               "actualDeckResidue": residue})
        if unknown_rows or unknown_format_rows:
            unresolved.append({"path": entry["path"], "rowsWithoutSeedToken": unknown_rows,
                               "unclassifiedSeedRows": unknown_format_rows})
        scanned.append({"path": entry["path"], "bytes": entry["bytes"],
                        "sha256": digest.hexdigest(), "rows": rows,
                        "seedTokens": tokens, "rowsWithoutSeedToken": unknown_rows,
                        "unclassifiedSeedRows": unknown_format_rows,
                        "sourceClass": source_class(entry["path"])})
        total_bytes += entry["bytes"]
        total_rows += rows
        seed_tokens += tokens
    result = {"schema": "mgx-d03-entry-m2-unmatched-direct-audit/v2",
              "status": "FAIL_COLLISION" if collision_count else "UNRESOLVED_SOURCE_ROWS" if unresolved
              else "PASS_ALL_UNMATCHED_JSONL_NO_COLLISION",
              "sourceManifestSha256": sha256(source_manifest),
              "screenSeedScheduleSha256": sha256(schedule_path),
              "unmatchedFilesScanned": len(scanned), "bytesScanned": total_bytes,
              "rowsScanned": total_rows, "seedTokens": seed_tokens,
              "actualDeckResiduesChecked": actual_checked,
              "collisionCount": collision_count,
              "distinctCollisionResidues": len(collision_residues),
              "collisionCountsBySource": collision_by_class,
              "collisionsFirst100": collisions, "unresolvedFiles": unresolved,
              "classifiedRowsBySource": by_class,
              "scanned": scanned,
              "limit": "No external originals or unknown seed encodings are certified"}
    with output.open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    return {key: result[key] for key in ("status", "unmatchedFilesScanned",
                                        "bytesScanned", "rowsScanned", "seedTokens")}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-manifest", required=True, type=Path)
    parser.add_argument("--screen-plan", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(audit(args.source_manifest.resolve(), args.screen_plan.resolve(),
                           args.output.resolve())))


if __name__ == "__main__":
    main()
