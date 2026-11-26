"""Independently recount the hero-only screen and seal a 5k safety plan.

This does not run the controller. Full source freshness and missing external
originals remain explicit review gates before any collection is authorized.
"""

from __future__ import annotations

from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np

from rl.training.entry_m2_sampling_contract import (
    GROUPS, PROFILES, STRATA, best_badugi, parse_cards, stratum,
)

ROOT = Path(__file__).resolve().parents[3]
COLLECTOR = ROOT / "src/rl/training/collect_badugi_entry_m2_draft.py"
BRIDGE = ROOT / "scripts/badugi-entry-m2-bridge-draft.mjs"
OPPONENT = ROOT / "src/rl/training/hand_aware_known_badugi_opponents_draft.py"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def recount(screen_folder: Path) -> dict:
    screen_plan_path = screen_folder / "frozen-screen-plan.json"
    plan = json.loads(screen_plan_path.read_text())
    result_path = screen_folder / "screen-result.json"
    result = json.loads(result_path.read_text())
    if (plan.get("status") != "FROZEN_BEFORE_SCREEN" or
            result.get("status") != "SCREENED_FOR_SAFETY_COLLECTION" or
            result.get("screenCount") != 1_500_000 or
            result.get("selectedCount") != 5000 or result.get("short") or
            plan.get("groups") != [list(group) for group in GROUPS] or
            plan.get("profiles") != list(PROFILES) or plan.get("strata") != list(STRATA) or
            plan.get("acceptedPerCellStratum") != 25):
        raise ValueError("M2 screen incomplete or allocation differs")
    trace_path = screen_folder / plan["screenTraceFile"]
    selected_path = screen_folder / plan["selectedSeedsFile"]
    schedule_path = screen_folder / plan["screenSeedScheduleFile"]
    if (sha256(trace_path) != result["traceSha256"] or
            sha256(selected_path) != result["selectedSeedsSha256"] or
            sha256(schedule_path) != plan["screenSeedScheduleSha256"]):
        raise ValueError("M2 screen trace, selection or schedule SHA mismatch")
    schedule = np.memmap(schedule_path, dtype="<u4", mode="r", shape=(1_500_000,))
    cells = [(group, profile) for group in GROUPS for profile in PROFILES]
    expected = []
    counts = Counter()
    with trace_path.open() as trace:
        for index, line in enumerate(trace):
            if index >= len(schedule):
                raise ValueError("M2 trace has excess rows")
            row = json.loads(line)
            cell_index, offset = divmod(index, 30_000)
            group, profile = cells[cell_index]
            hero = offset % group[1]
            cards = row.get("cards")
            hand_class = stratum(*best_badugi(parse_cards(cards)))
            if (row.get("globalIndex") != index or row.get("seed") != int(schedule[index]) or
                    row.get("cellIndex") != cell_index or row.get("heroSeat") != hero or
                    row.get("stratum") != hand_class):
                raise ValueError("M2 hero-only screen trace differs from frozen schedule")
            key = (group, profile, hand_class)
            if counts[key] < 25:
                expected.append({"seed": int(schedule[index]), "group": list(group),
                                 "profile": profile, "heroSeat": hero,
                                 "stratum": hand_class,
                                 "expectedOpeningActorCards": cards})
                counts[key] += 1
    if (index + 1 != len(schedule) or len(expected) != 5000 or
            len(counts) != 200 or set(counts.values()) != {25}):
        raise ValueError("M2 screen counts are incomplete")
    selected = json.loads(selected_path.read_text())
    if selected != expected:
        raise ValueError("M2 selected manifest differs from independently recounted first 25")
    return {"screened": len(schedule), "selected": len(expected),
            "screenTraceSha256": sha256(trace_path),
            "selectedSeedsSha256": sha256(selected_path),
            "screenPlanSha256": sha256(screen_plan_path),
            "screenResultSha256": sha256(result_path)}


def seal(screen_folder: Path, model_path: Path) -> dict:
    output = screen_folder / "frozen-plan.json"
    if output.exists():
        raise FileExistsError("M2 collection plan already exists")
    if subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip():
        raise ValueError("M2 final plan requires a clean reviewed checkout")
    audit = recount(screen_folder)
    screen = json.loads((screen_folder / "frozen-screen-plan.json").read_text())
    if sha256(Path(screen["sourceManifestFile"])) != screen["sourceManifestSha256"]:
        raise ValueError("M2 prior source inventory manifest changed")
    plan = {"schema": "mgx-d03-entry-m2-collector/v1",
            "status": "FROZEN_BEFORE_COLLECTION",
            "stage": "ENTRY_OPPORTUNITY_SAFETY_ONLY",
            "codeGitSha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT,
                                                  text=True).strip(),
            "collectorSha256": sha256(COLLECTOR), "bridgeSha256": sha256(BRIDGE),
            "opponentSha256": sha256(OPPONENT),
            "modelPath": str(model_path), "modelSha256": sha256(model_path),
            "groups": [list(group) for group in GROUPS], "profiles": list(PROFILES),
            "strata": list(STRATA), "acceptedPerCellStratum": 25,
            "plannedSessions": 5000, "handsPerSession": 1,
            "selectedSeedsFile": screen["selectedSeedsFile"],
            "seedListSha256": audit["selectedSeedsSha256"],
            "screenTraceSha256": audit["screenTraceSha256"],
            "screenPlanSha256": audit["screenPlanSha256"],
            "screenResultSha256": audit["screenResultSha256"],
            "recordedDeckResiduesFile": screen["recordedDeckResiduesFile"],
            "recordedDeckResiduesCount": screen["recordedDeckResiduesCount"],
            "recordedDeckResiduesSha256": screen["recordedDeckResiduesSha256"],
            "sourceManifestFile": screen["sourceManifestFile"],
            "sourceManifestSha256": screen["sourceManifestSha256"],
            "screenedDeckResiduesFile": screen["screenedDeckResiduesFile"],
            "screenedDeckResiduesCount": screen["screenedDeckResiduesCount"],
            "screenedDeckResiduesSha256": screen["screenedDeckResiduesSha256"],
            "controllerDeadlineSeconds": 15, "inferenceDeadlineMs": 2000,
            "progressEverySessions": 100,
            "outputFile": "m2-safety-rows.jsonl.partial", "resultFile": "m2-safety-result.json",
            "stopping": "Exactly 5000 selected one-hand safety sessions; no profit analysis",
            "limitations": "Recorded local prior index misses unmatched/remote originals; "
                           "human review and fresh-source audit remain required before collection"}
    with output.open("x") as stream:
        json.dump(plan, stream, indent=2)
        stream.write("\n")
    return {"planSha256": sha256(output), **audit}


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--screen-folder", required=True, type=Path)
    parser.add_argument("--model", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(seal(args.screen_folder.resolve(), args.model.resolve())))


if __name__ == "__main__":
    main()
