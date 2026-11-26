"""Build a source-tagged exclusion index from recorded D03 hand traces.

This reads each original once, checks its frozen SHA/row count, and indexes only
hands actually present in the trace.  It never runs a game or authorizes an M2
screen.  The source-tagged pair index keeps duplicate arms distinguishable;
the unique residue index is for seed exclusion only.
"""

from __future__ import annotations

import argparse
from array import array
import hashlib
import heapq
import json
from pathlib import Path
import sys

import numpy as np

from audit_badugi_entry_m2_unmatched import actual_deck_residues, sha256

MAX_SOURCE_ID = 2**16
DEFAULT_RUN_ROWS = 1_000_000


def _flush_run(output_dir: Path, values: array, number: int) -> dict:
    path = output_dir / f"run-{number:04d}.u64le"
    distinct = np.unique(np.frombuffer(values, dtype="<u8"))
    distinct.tofile(path)
    return {"path": str(path.relative_to(output_dir.parent)),
            "pairs": int(len(distinct)), "bytes": path.stat().st_size,
            "sha256": sha256(path)}


def _merge_runs(output_dir: Path, run_records: list[dict]) -> tuple[int, int]:
    runs = [np.memmap(output_dir / Path(r["path"]).name, dtype="<u8", mode="r")
            for r in run_records]
    heap = [(int(run[0]), run_id, 0) for run_id, run in enumerate(runs) if len(run)]
    heapq.heapify(heap)
    pair_path = output_dir.parent / "residue-source-pairs.u64le"
    residue_path = output_dir.parent / "actual-deck-residues.u32le"
    pair_buffer = array("Q")
    residue_buffer = array("I")
    previous_pair = previous_residue = None
    pairs = residues = 0
    with pair_path.open("xb") as pair_output, residue_path.open("xb") as residue_output:
        while heap:
            key, run_id, position = heapq.heappop(heap)
            if key != previous_pair:
                pair_buffer.append(key)
                pairs += 1
                previous_pair = key
                residue = key >> 16
                if residue != previous_residue:
                    residue_buffer.append(residue)
                    residues += 1
                    previous_residue = residue
                if len(pair_buffer) >= 65_536:
                    pair_buffer.tofile(pair_output)
                    pair_buffer = array("Q")
                if len(residue_buffer) >= 65_536:
                    residue_buffer.tofile(residue_output)
                    residue_buffer = array("I")
            next_position = position + 1
            if next_position < len(runs[run_id]):
                heapq.heappush(heap, (int(runs[run_id][next_position]),
                                      run_id, next_position))
        pair_buffer.tofile(pair_output)
        residue_buffer.tofile(residue_output)
    return pairs, residues


def build(inventory_path: Path, artifact_root: Path, output_dir: Path,
          run_rows: int = DEFAULT_RUN_ROWS,
          reservation_path: Path | None = None) -> dict:
    if sys.byteorder != "little":
        raise RuntimeError("the u32le/u64le indexes require a little-endian host")
    if not 1 <= run_rows <= DEFAULT_RUN_ROWS:
        raise ValueError("run_rows must be in 1..1,000,000")
    inventory = json.loads(inventory_path.read_text())
    if inventory.get("schema") != "mgx-d03-m2-unresolved-lineage-inventory/v1":
        raise ValueError("unknown lineage inventory schema")
    sources = sorted((e for e in inventory["entries"] if e["family"] == "hand_trace"),
                     key=lambda e: e["path"])
    if not sources or len(sources) >= MAX_SOURCE_ID:
        raise ValueError("invalid source count")
    output_dir.mkdir(parents=True, exist_ok=False)
    runs_dir = output_dir / "runs"
    runs_dir.mkdir()
    runs: list[dict] = []
    source_tags: list[dict] = []
    buffer = array("Q")
    total_rows = 0
    for source_id, source in enumerate(sources):
        path = artifact_root / source["path"]
        if path.stat().st_size != source["bytes"]:
            raise ValueError(f"source size changed: {source['path']}")
        digest = hashlib.sha256()
        rows = 0
        with path.open("rb") as stream:
            for line in stream:
                digest.update(line)
                if not line.strip():
                    raise ValueError(f"blank trace row: {source['path']}:{rows + 1}")
                rows += 1
                kind, deck = actual_deck_residues(source["path"], line)
                if kind != "recorded_hand_trace" or len(deck) != 1:
                    raise ValueError(f"unclassified trace row: {source['path']}:{rows}")
                buffer.append((int(deck[0]) << 16) | source_id)
                if len(buffer) >= run_rows:
                    runs.append(_flush_run(runs_dir, buffer, len(runs)))
                    buffer = array("Q")
        if rows != source["rows"] or digest.hexdigest() != source["sha256"]:
            raise ValueError(f"source row count or SHA changed: {source['path']}")
        total_rows += rows
        source_tags.append({"sourceId": source_id, "path": source["path"],
                            "sha256": source["sha256"], "bytes": source["bytes"],
                            "recordedHandRows": rows,
                            "completion": "INCOMPLETE_TRACE" if source["path"].endswith(".incomplete")
                            else "TRACE_FILE_STATUS_ONLY"})
        if (source_id + 1) % 25 == 0 or source_id + 1 == len(sources):
            print(f"verified_sources={source_id + 1}/{len(sources)} "
                  f"recorded_hands={total_rows}", flush=True)
    if buffer:
        runs.append(_flush_run(runs_dir, buffer, len(runs)))
    pairs, residues = _merge_runs(runs_dir, runs)
    result = {"schema": "mgx-d03-entry-m2-handtrace-deck-index/v1",
              "status": "INDEX_BUILT_NOT_M2_CLEARANCE",
              "inventorySha256": sha256(inventory_path),
              "sourceFiles": len(sources), "sourceBytes": sum(e["bytes"] for e in sources),
              "recordedHandRows": total_rows, "sourceResiduePairs": pairs,
              "uniqueDeckResidues": residues, "runRowsLimit": run_rows,
              "incompleteTraceFiles": sum(t["completion"] == "INCOMPLETE_TRACE"
                                          for t in source_tags),
              "runs": runs, "sourceTags": source_tags,
              "pairIndex": {"file": "residue-source-pairs.u64le",
                            "bytes": (output_dir / "residue-source-pairs.u64le").stat().st_size,
                            "sha256": sha256(output_dir / "residue-source-pairs.u64le")},
              "residueIndex": {"file": "actual-deck-residues.u32le",
                               "bytes": (output_dir / "actual-deck-residues.u32le").stat().st_size,
                               "sha256": sha256(output_dir / "actual-deck-residues.u32le")},
              "limit": "Deck exclusion only; source use for training/evaluation requires separate provenance clearance"}
    if reservation_path is not None:
        if reservation_path.stat().st_size != 1_500_000 * 4:
            raise ValueError("reservation schedule size changed")
        index = np.memmap(output_dir / "actual-deck-residues.u32le", dtype="<u4", mode="r")
        reservation = np.memmap(reservation_path, dtype="<u4", mode="r")
        positions = np.searchsorted(index, reservation)
        valid = positions < len(index)
        matches = np.zeros(len(reservation), dtype=bool)
        matches[valid] = index[positions[valid]] == reservation[valid]
        result["oldReservation"] = {"sha256": sha256(reservation_path),
                                    "collidingReservedSeeds": int(matches.sum())}
    manifest_path = output_dir / "manifest.json"
    with manifest_path.open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    return {key: result[key] for key in ("status", "sourceFiles", "sourceBytes",
                                        "recordedHandRows", "sourceResiduePairs",
                                        "uniqueDeckResidues")}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", required=True, type=Path)
    parser.add_argument("--artifact-root", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--run-rows", type=int, default=DEFAULT_RUN_ROWS)
    parser.add_argument("--old-reservation", type=Path)
    args = parser.parse_args()
    print(json.dumps(build(args.inventory.resolve(), args.artifact_root.resolve(),
                           args.output_dir.resolve(), args.run_rows,
                           args.old_reservation.resolve() if args.old_reservation else None)))


if __name__ == "__main__":
    main()
