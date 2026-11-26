"""Freeze a finite M2 hero-only screen seed schedule; never play a hand."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np

from rl.training.entry_m2_sampling_contract import GROUPS, PROFILES, STRATA

ROOT = Path(__file__).resolve().parents[3]
SCREEN = ROOT / "scripts/badugi-entry-m2-screen-draft.mjs"
MODULUS = 2**32
PER_CELL_CAP = 30_000
START = 1_600_000_001
STRIDE = 20_003  # odd: full-period permutation modulo 2^32
MAX_ATTEMPTS = 1_600_000


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def prepare(index_manifest: Path, output: Path, unmatched_audit: Path | None = None) -> dict:
    if output.exists():
        raise FileExistsError("M2 screen schedule already exists")
    if subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip():
        raise ValueError("M2 screen schedule requires a clean reviewable checkout")
    source = json.loads(index_manifest.read_text())
    prior_path = index_manifest.parent / source["recordedDeckResiduesFile"]
    if (source.get("schema") != "mgx-d03-entry-m2-prior-local/v1" or
            prior_path.stat().st_size != source["recordedDeckResiduesCount"] * 4 or
            sha256(prior_path) != source["recordedDeckResiduesSha256"]):
        raise ValueError("M2 recorded local prior index differs from manifest")
    prior = np.memmap(prior_path, dtype="<u4", mode="r")
    if np.any(prior[1:] <= prior[:-1]):
        raise ValueError("M2 prior index is not sorted and unique")
    wanted = len(GROUPS) * len(PROFILES) * PER_CELL_CAP
    chosen = []
    inspected = 0
    while sum(len(chunk) for chunk in chosen) < wanted and inspected < MAX_ATTEMPTS:
        count = min(100_000, MAX_ATTEMPTS - inspected)
        offsets = np.arange(inspected, inspected + count, dtype=np.uint64)
        candidates = ((START + STRIDE * offsets) % MODULUS).astype("<u4")
        positions = np.searchsorted(prior, candidates)
        clashes = ((positions < len(prior)) &
                   (prior[np.minimum(positions, len(prior) - 1)] == candidates))
        chosen.append(candidates[~clashes])
        inspected += count
    schedule = np.concatenate(chosen)[:wanted]
    if len(schedule) != wanted or len(np.unique(schedule)) != wanted:
        raise ValueError("M2 30k-per-cell cap lacks unique noncolliding seeds")
    output.mkdir(parents=True)
    schedule_path = output / "screen-seed-schedule.u32le"
    schedule.astype("<u4").tofile(schedule_path)
    sorted_path = output / "screened-deck-residues.u32le"
    np.sort(schedule).astype("<u4").tofile(sorted_path)
    audit_fields = {"unmatchedDirectAuditStatus": "NOT_SCANNED_STOP"}
    if unmatched_audit is not None:
        independent = json.loads(unmatched_audit.read_text())
        if (independent.get("status") != "PASS_ALL_UNMATCHED_JSONL_NO_COLLISION" or
                independent.get("sourceManifestSha256") != sha256(index_manifest) or
                independent.get("screenSeedScheduleSha256") != sha256(schedule_path) or
                independent.get("unmatchedFilesScanned") != len(source["unmatchedJsonl"])):
            raise ValueError("M2 unmatched JSONL audit is incomplete or mismatched")
        audit_fields = {"unmatchedDirectAuditStatus": independent["status"],
                        "unmatchedDirectAuditFile": str(unmatched_audit),
                        "unmatchedDirectAuditSha256": sha256(unmatched_audit)}
    plan = {
        "schema": "mgx-d03-entry-m2-hero-screen/v1",
        "status": "FROZEN_BEFORE_SCREEN" if unmatched_audit else
                  "PREPARED_PRIOR_AUDIT_INCOMPLETE",
        "stage": "HERO_OWN_OPENING_CARDS_ONLY_NO_REWARD",
        "codeGitSha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT,
                                              text=True).strip(),
        "screenCodeSha256": sha256(SCREEN),
        "sourceManifestFile": str(index_manifest),
        "sourceManifestSha256": sha256(index_manifest),
        **audit_fields,
        "recordedDeckResiduesFile": str(prior_path),
        "recordedDeckResiduesCount": len(prior),
        "recordedDeckResiduesSha256": sha256(prior_path),
        "groups": [list(group) for group in GROUPS], "profiles": list(PROFILES),
        "strata": list(STRATA), "acceptedPerCellStratum": 25,
        "screenCapPerCell": PER_CELL_CAP, "screenCount": wanted,
        "candidateStart": START, "candidateStride": STRIDE,
        "candidateAttemptsInspected": inspected,
        "screenSeedScheduleFile": schedule_path.name,
        "screenSeedScheduleSha256": sha256(schedule_path),
        "screenedDeckResiduesFile": sorted_path.name,
        "screenedDeckResiduesCount": wanted,
        "screenedDeckResiduesSha256": sha256(sorted_path),
        "screenTraceFile": "hero-own-screen-trace.jsonl",
        "selectedSeedsFile": "selected-seeds.json",
        "stopping": "Screen all 30,000 pre-reserved one-hand seeds per environment cell; "
                    "take first 25 by stratum, or INSUFFICIENT without changing cap",
        "futureSeedBoundary": "All 1,500,000 reserved/screened actual deck residues, including "
                              "rejected hand classes, are development-used for later holdouts",
        "scopeLimit": source["scope"],
    }
    with (output / "frozen-screen-plan.json").open("x") as stream:
        json.dump(plan, stream, indent=2)
        stream.write("\n")
    return {"screenCount": wanted, "candidateAttemptsInspected": inspected,
            "screenPlanSha256": sha256(output / "frozen-screen-plan.json"),
            "scheduleSha256": plan["screenSeedScheduleSha256"],
            "reservedResiduesSha256": plan["screenedDeckResiduesSha256"]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index-manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--unmatched-audit", type=Path)
    args = parser.parse_args()
    print(json.dumps(prepare(args.index_manifest.resolve(), args.output.resolve(),
                             args.unmatched_audit.resolve() if args.unmatched_audit else None)))


if __name__ == "__main__":
    main()
