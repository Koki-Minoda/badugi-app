#!/usr/bin/env python3
"""Single fixed-look analysis of the frozen multi-street controller original."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from rl.training.badugi_street_fold_analysis_draft import analyze_street_fold_sessions


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", type=Path, required=True)
    args = parser.parse_args()
    plan_path = args.plan.resolve()
    here = plan_path.parent
    plan = json.loads(plan_path.read_text())
    result_path = here / "collection-result.json"
    rows_path = here / "paired-sessions.jsonl.partial"
    result = json.loads(result_path.read_text())
    if (plan.get("status") != "FROZEN_BEFORE_COLLECTION" or
            sha(__file__) != plan.get("analyzerSha256") or
            sha(ROOT / "src/rl/training/badugi_street_fold_analysis_draft.py") !=
                plan.get("analysisModuleSha256") or
            result.get("status") != "COMPLETE" or
            result.get("planSha256") != sha(plan_path) or
            result.get("rowsSha256") != sha(rows_path)):
        raise ValueError("frozen collection or analysis source mismatch")
    with rows_path.open() as source:
        report = analyze_street_fold_sessions(
            (json.loads(line) for line in source),
            sessions_per_cell=plan["sessionsPerCell"],
            horizon=plan["handsPerSessionMax"],
            minimum_overrides_per_mode=plan["minimumOverridesPerMode"])
    if report["pairedSessions"] != result["pairedSessions"]:
        raise ValueError("paired session count mismatch")
    report["sourcePlanSha256"] = result["planSha256"]
    report["sourceRowsSha256"] = result["rowsSha256"]
    output = here / "analysis-result.json"
    with output.open("x") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"status": report["status"],
                      "streetWinner": report["streetWinner"],
                      "pairedSessions": report["pairedSessions"],
                      "analysisSha256": sha(output)}))


if __name__ == "__main__":
    main()
