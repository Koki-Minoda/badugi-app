"""Inventory *recorded local* D03 seed evidence for an M2 safety screen.

This intentionally refuses to label an incomplete local inventory as a global
holdout exclusion. The output is a conservative 20-hand actual-deck residue
index and a source/omission manifest; both are read by a later frozen plan.
No game, model, reward, or training code is invoked.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

MODULUS = 2**32
MAX_COMPACT_BYTES = 1_000_000_000
HORIZON = 20
SEED_KEYS = {"seed", "seeds", "sessionseed", "sessionseeds", "deckseed",
             "deckseeds", "screenseeds", "plannedseeds"}
ROW_NAMES = {"sessions.jsonl", "sessions.jsonl.partial",
             "paired-sessions.jsonl", "paired-sessions.jsonl.partial",
             "hands.jsonl", "hands.jsonl.partial", "selected.jsonl"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def seed_values(value, allow_scalar: bool = False):
    if type(value) is int and allow_scalar:
        yield value % MODULUS
    elif isinstance(value, list):
        for item in value:
            yield from seed_values(item, allow_scalar)
    elif isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in SEED_KEYS:
                yield from seed_values(item, True)
            elif isinstance(item, (dict, list)):
                yield from seed_values(item, False)


def all_seed_list_integers(value):
    """Conservatively reserve every integer in a seed-named JSON schedule."""
    if type(value) is int:
        yield value % MODULUS
    elif isinstance(value, list):
        for item in value:
            yield from all_seed_list_integers(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from all_seed_list_integers(item)


def source_files(root: Path):
    for study in sorted(root.glob("d03*")):
        if not study.is_dir():
            continue
        for path in study.rglob("*"):
            if not path.is_file():
                continue
            name = path.name
            if (name in ROW_NAMES or name.endswith("-seeds.json") or
                    name == "seeds.json" or name.endswith("-seeds.jsonl") or
                    name == "selected-seeds.json"):
                yield path


def inventory(root: Path, output: Path) -> dict:
    if output.exists():
        raise FileExistsError("M2 prior seed inventory output already exists")
    base_seeds: set[int] = set()
    scanned = []
    omitted = []
    recognized = set(source_files(root))
    unmatched_jsonl = [{"path": str(path.relative_to(root)), "bytes": path.stat().st_size,
                        "reason": "unrecognized_JSONL_filename_not_seed_scanned"}
                       for study in sorted(root.glob("d03*")) if study.is_dir()
                       for path in study.rglob("*.jsonl*")
                       if path.is_file() and path not in recognized]
    for path in sorted(recognized):
        size = path.stat().st_size
        entry = {"path": str(path.relative_to(root)), "bytes": size}
        if size > MAX_COMPACT_BYTES:
            omitted.append({**entry, "reason": "over_100MB_unscanned"})
            continue
        count = 0
        if path.suffix == ".jsonl" or path.name.endswith(".jsonl.partial"):
            with path.open() as source:
                for line_number, line in enumerate(source, 1):
                    try:
                        row = json.loads(line)
                    except ValueError as error:
                        if path.name.endswith(".partial"):
                            omitted.append({**entry, "reason": "malformed_partial_line",
                                            "line": line_number})
                            break
                        raise ValueError(f"invalid JSONL {path}:{line_number}") from error
                    values = list(seed_values(row))
                    base_seeds.update(values)
                    count += len(values)
        else:
            values = list(all_seed_list_integers(json.loads(path.read_text())))
            base_seeds.update(values)
            count = len(values)
        scanned.append({**entry, "sha256": sha256(path), "seedValues": count})
    if not base_seeds:
        raise ValueError("M2 prior seed inventory found no recorded seeds")
    bases = np.fromiter(base_seeds, dtype=np.uint32)
    offsets = (np.arange(HORIZON, dtype=np.uint64) * 1009).astype(np.uint64)
    residues = np.unique((bases.astype(np.uint64)[:, None] + offsets).astype("<u4"))
    output.mkdir(parents=True)
    index = output / "recorded-deck-residues.u32le"
    residues.astype("<u4").tofile(index)
    manifest = {"schema": "mgx-d03-entry-m2-prior-local/v1",
                "scope": "Recorded local D03 compact rows and named seed lists only; "
                         "large rows, other filenames and external originals remain unverified",
                "artifactRoot": str(root), "maxCompactBytes": MAX_COMPACT_BYTES,
                "conservativeSessionExpansion": "(baseSeed+1009*handIndex) mod 2^32, index 0..19",
                "uniqueRecordedBaseSeeds": len(base_seeds),
                "recordedDeckResiduesFile": index.name,
                "recordedDeckResiduesCount": len(residues),
        "recordedDeckResiduesSha256": sha256(index),
        "scanned": scanned, "omitted": omitted,
        "unmatchedJsonl": unmatched_jsonl,
        "missing": ["unavailable external originals", "unrecognized seed filenames",
                    "unmatched D03 JSONL whose seed contents were not scanned",
                    "recognized JSONL over 1GB, if any"]}
    with (output / "prior-source-manifest.json").open("x") as stream:
        json.dump(manifest, stream, indent=2)
        stream.write("\n")
    return {"baseSeeds": len(base_seeds), "deckResidues": len(residues),
            "scannedFiles": len(scanned), "omittedFiles": len(omitted),
            "unmatchedJsonlFiles": len(unmatched_jsonl),
            "indexSha256": manifest["recordedDeckResiduesSha256"]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(inventory(args.artifacts.resolve(), args.output.resolve())))


if __name__ == "__main__":
    main()
