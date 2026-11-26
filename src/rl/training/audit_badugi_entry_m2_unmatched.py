"""Deferred full scan of seed-bearing D03 JSONL outside the compact inventory.

Run only after review. The audit streams every listed byte and refuses PASS for
files with unresolved nonempty rows. It checks the 1.5M M2 screen reservations,
not model returns, and never starts a controller or consumes new deck seeds.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

import numpy as np

SEED = re.compile(rb'"(?:seed|sessionSeed|deckSeed)"\s*:\s*(-?\d+)')
HAND_INDEX = re.compile(rb'"(?:handIndex|handInSession)"\s*:\s*(\d+)')
MODULUS = 2**32


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
    total_bytes = total_rows = seed_tokens = 0
    for entry in source["unmatchedJsonl"]:
        path = Path(source["artifactRoot"]) / entry["path"]
        if path.stat().st_size != entry["bytes"]:
            raise ValueError(f"M2 unmatched source changed: {entry['path']}")
        digest = hashlib.sha256()
        rows = tokens = unknown_rows = 0
        with path.open("rb") as stream:
            for line_number, line in enumerate(stream, 1):
                digest.update(line)
                if not line.strip():
                    continue
                rows += 1
                values = SEED.findall(line)
                if not values:
                    unknown_rows += 1
                    continue
                tokens += len(values)
                hand_match = HAND_INDEX.search(line)
                hand_index = int(hand_match.group(1)) if hand_match else None
                for token in values:
                    base = int(token) % MODULUS
                    actual = [base]
                    if hand_index is not None:
                        actual.append((base + 1009 * hand_index) % MODULUS)
                    else:
                        actual.extend((base + 1009 * index) % MODULUS
                                      for index in range(1, 20))
                    for residue in actual:
                        if residue in reserved and len(collisions) < 100:
                            collisions.append({"path": entry["path"], "line": line_number,
                                               "actualDeckResidue": residue})
        if unknown_rows:
            unresolved.append({"path": entry["path"], "rowsWithoutSeedToken": unknown_rows})
        scanned.append({"path": entry["path"], "bytes": entry["bytes"],
                        "sha256": digest.hexdigest(), "rows": rows,
                        "seedTokens": tokens, "rowsWithoutSeedToken": unknown_rows})
        total_bytes += entry["bytes"]
        total_rows += rows
        seed_tokens += tokens
    result = {"schema": "mgx-d03-entry-m2-unmatched-direct-audit/v1",
              "status": "FAIL_COLLISION" if collisions else "UNRESOLVED_SEED_ROWS" if unresolved
              else "PASS_ALL_UNMATCHED_JSONL_NO_COLLISION",
              "sourceManifestSha256": sha256(source_manifest),
              "screenSeedScheduleSha256": sha256(schedule_path),
              "unmatchedFilesScanned": len(scanned), "bytesScanned": total_bytes,
              "rowsScanned": total_rows, "seedTokens": seed_tokens,
              "collisionsFirst100": collisions, "unresolvedFiles": unresolved,
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
