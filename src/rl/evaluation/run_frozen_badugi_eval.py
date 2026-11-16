"""Run a bounded D03 ONNX/Pro look, independently audit originals, then gate.

No training, registry write, release, or product-adoption operation occurs here.
Plans/manifests must be sealed before starting this command. A PROMOTE output is
only a candidate recommendation and still requires an independent final review.
"""

from __future__ import annotations

import argparse
import bisect
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

if __package__:
    from . import audit_badugi_trace_units as trace_audit
    from . import sequential_gate as gate
else:
    import audit_badugi_trace_units as trace_audit
    import sequential_gate as gate

ROOT = Path(__file__).resolve().parents[3]
COLLECTOR = ROOT / "src/rl/training/validate_badugi_controller_v2_draft.py"
GROUPS = tuple(f'{seats}/{occupied}-{mode}' for mode in ("cash", "mtt")
               for seats, occupied in ((2, 2), (3, 3), (6, 6), (6, 2), (6, 3)))
PROFILES = ("passive", "pressure", "draw_heavy", "random_legal")
MAX_SESSIONS_PER_CELL = 5000


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def expected_cells() -> dict[str, dict]:
    result = {}
    for group in GROUPS:
        table, occupied_mode = group.split("/", 1)
        occupied, mode = occupied_mode.split("-", 1)
        for profile in PROFILES:
            result[f"{group}|{profile}"] = {
                "format": mode, "tableSeats": int(table),
                "occupiedSeats": int(occupied),
                "startingStackChips": 2000 if mode == "mtt" else 500,
                "bigBetChips": 100 if mode == "mtt" else 40,
                "noRebuy": True, "constantBigBet": True,
            }
    return result


def validate_preflight(plan: dict, manifests: dict[str, dict],
                       model_shas: dict[str, str], plan_sha: str,
                       code_sha: str, look: int) -> dict[str, list[int]]:
    gate.validate_manifest(plan)
    if plan.get("evaluationPurpose") not in ("PHASE1_WIRING_DIAGNOSTIC_ONLY",
                                             "PROMOTION_CANDIDATE"):
        raise ValueError("evaluation purpose must be frozen before collection")
    if plan["handsPerSession"] != 20:
        raise ValueError("this D03 frozen runner requires 20-hand sessions")
    if look not in plan["lookSessionsPerCell"] or not 2 <= look <= MAX_SESSIONS_PER_CELL:
        raise ValueError("look is not predeclared or exceeds bounded collector capacity")
    expected = expected_cells()
    actual = {cell["name"]: cell for cell in plan["cells"]}
    if set(actual) != set(expected):
        raise ValueError("frozen D03 look requires all 40 seat/mode/profile cells")
    for name, contract in expected.items():
        if any(actual[name].get(key) != value for key, value in contract.items()):
            raise ValueError(f"cell differs from the real D03 fixed-limit controller: {name}")
    scheduled: dict[str, list[int]] = {}
    all_residues = set()
    for arm in ("candidate", "reference"):
        manifest = manifests[arm]
        model_sha = model_shas[arm]
        base = manifest.get("seedBase")
        if (manifest.get("status") != "FROZEN" or
                manifest.get("codeGitSha") != code_sha or
                manifest.get("planSha256") != plan_sha or
                manifest.get("contractSha256") != plan["controllerContractSha256"] or
                manifest.get("modelSha256") != model_sha or
                model_sha != plan[f"{arm}ModelSha256"] or
                manifest.get("sessionsPerProfileGroup") != look or
                manifest.get("handsPerSessionMax") != plan["handsPerSession"] or
                manifest.get("groupMatrix") != list(GROUPS) or
                manifest.get("opponentProfiles") != list(PROFILES) or
                manifest.get("requireDecisionLedger") is not True or
                type(base) is not int):
            raise ValueError(f"{arm} manifest or ONNX body differs from frozen plan")
        low, high = plan["seedWindows"][arm]
        seeds = [base + group * 1_000_000 + profile * 10_000 + index
                 for group in range(len(GROUPS))
                 for profile in range(len(PROFILES))
                 for index in range(look)]
        if (not seeds or min(seeds) < low or max(seeds) > high or
                any((seed % gate.SEED_PERIOD) in all_residues for seed in seeds)):
            raise ValueError("scheduled seeds are outside windows or collide modulo 2^32")
        all_residues.update(seed % gate.SEED_PERIOD for seed in seeds)
        scheduled[arm] = seeds
    return scheduled


def _collect_seed_bases(value, found: set[int]) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in ("seedbase", "seedbases", "seedsbase", "evalseedbase"):
                if type(item) is int:
                    found.add(item)
                elif isinstance(item, dict):
                    found.update(candidate for candidate in item.values()
                                 if type(candidate) is int)
            if isinstance(item, (dict, list)):
                _collect_seed_bases(item, found)
    elif isinstance(value, list):
        for item in value:
            _collect_seed_bases(item, found)


def audit_seed_history(root: Path, scheduled: dict[str, list[int]],
                       excluded_paths: set[Path]) -> dict:
    """Conservative recorded-D03 scan; unknown external data remain outside scope."""
    if not root.is_dir():
        raise ValueError("prior artifact root must exist")
    residues = {seed % gate.SEED_PERIOD for arm in scheduled.values() for seed in arm}
    if len(residues) != sum(len(arm) for arm in scheduled.values()):
        raise ValueError("new schedule aliases itself modulo 2^32")
    sorted_residues = sorted(residues)
    patterns = ("d03*/**/*.json", "mgx-phase1*/**/*.json")
    old_bases = set()
    json_count = 0
    for pattern in patterns:
        for path in root.glob(pattern):
            if path.resolve() in excluded_paths or path.stat().st_size > 1_000_000:
                continue
            try:
                value = json.loads(path.read_text())
            except (ValueError, UnicodeError):
                continue
            json_count += 1
            _collect_seed_bases(value, old_bases)
    base_collisions = []
    for base in sorted(old_bases):
        collision = False
        for group in range(len(GROUPS)):
            for profile in range(len(PROFILES)):
                low = (base + group * 1_000_000 + profile * 10_000) % gate.SEED_PERIOD
                high = low + 2499
                segments = ([(low, high)] if high < gate.SEED_PERIOD else
                            [(low, gate.SEED_PERIOD - 1),
                             (0, high - gate.SEED_PERIOD)])
                if any((index := bisect.bisect_left(sorted_residues, start)) <
                       len(sorted_residues) and sorted_residues[index] <= end
                       for start, end in segments):
                    collision = True
                    break
            if collision:
                break
        if collision:
            base_collisions.append(base)
    session_files = session_rows = 0
    actual_collisions = []
    for pattern in ("d03*/**/sessions.jsonl", "mgx-phase1*/**/sessions.jsonl"):
        for path in root.glob(pattern):
            session_files += 1
            with path.open() as source:
                for line in source:
                    row = json.loads(line)
                    seed = row.get("seed")
                    if type(seed) is int:
                        session_rows += 1
                        if seed % gate.SEED_PERIOD in residues:
                            actual_collisions.append({"path": str(path.relative_to(root)),
                                                      "seed": seed})
    return {
        "status": "PASS_NO_RECORDED_SEED_COLLISION" if not base_collisions and
                  not actual_collisions else "FAIL_RECORDED_SEED_COLLISION",
        "scheduledSeedsPerArm": {arm: len(seeds) for arm, seeds in scheduled.items()},
        "priorJsonFilesScanned": json_count,
        "priorBaseSchedulesScanned": len(old_bases),
        "priorSessionFilesScanned": session_files,
        "priorSessionRowsScanned": session_rows,
        "baseCollisions": base_collisions,
        "actualCollisions": actual_collisions,
        "scopeLimit": "Recorded local D03 and MGX Phase 1 artifacts only; external or missing originals are outside this scan.",
    }


def validate_collection(summary: dict, *, arm: str, manifest_sha: str,
                        model_sha: str, contract_sha: str, code_sha: str,
                        look: int, hands: int, session_path: Path,
                        hand_path: Path) -> None:
    expected_sessions = len(GROUPS) * len(PROFILES) * look
    if (summary.get("status") != "FROZEN_EVALUATION" or
            summary.get("evaluationManifestSha256") != manifest_sha or
            summary.get("modelSha256") != model_sha or
            summary.get("contractSha256") != contract_sha or
            summary.get("codeGitSha") != code_sha or
            summary.get("modelKind") != "onnx" or
            summary.get("decisionLedgerIncluded") is not True or
            summary.get("sessions") != expected_sessions or
            summary.get("zeroSumSessions") != expected_sessions or
            summary.get("hands") != expected_sessions * hands or
            summary.get("groups") != list(GROUPS) or
            summary.get("opponentProfiles") != list(PROFILES) or
            summary.get("sessionTraceSha256") != sha256(session_path) or
            summary.get("handTraceSha256") != sha256(hand_path)):
        raise ValueError(f"{arm} collection is incomplete or differs from its frozen inputs")


def _git_head() -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"],
                                   cwd=ROOT, text=True).strip()


def _git_clean() -> bool:
    output = subprocess.check_output(["git", "status", "--porcelain"],
                                     cwd=ROOT, text=True)
    return all(line == "?? node_modules" for line in output.splitlines())


def run(*, plan_path: Path, manifests: dict[str, Path], models: dict[str, Path],
        output_dir: Path, look: int, python_bin: Path,
        prior_artifacts_root: Path) -> dict:
    plan_path = plan_path.resolve()
    manifests = {arm: path.resolve() for arm, path in manifests.items()}
    models = {arm: path.resolve() for arm, path in models.items()}
    output_dir = output_dir.resolve()
    protected = (ROOT / "public", ROOT / "src/config/ai")
    if (output_dir.exists() or
            any(output_dir == path or path in output_dir.parents for path in protected) or
            models["candidate"] == ROOT / "public/models" or
            ROOT / "public/models" in models["candidate"].parents):
        raise ValueError("output must be new and unpublished candidate must remain isolated")
    if not _git_clean():
        raise ValueError("frozen evaluation requires a clean checkout")
    plan = json.loads(plan_path.read_text())
    manifest_data = {arm: json.loads(path.read_text()) for arm, path in manifests.items()}
    model_shas = {arm: sha256(path) for arm, path in models.items()}
    code_sha = _git_head()
    scheduled = validate_preflight(plan, manifest_data, model_shas,
                                   sha256(plan_path), code_sha, look)
    output_dir.mkdir(parents=True)
    audit_reports = {}
    audited_paths = {}
    try:
        seed_audit = audit_seed_history(prior_artifacts_root.resolve(), scheduled,
                                        {plan_path, *manifests.values()})
        with (output_dir / "seed-history-preflight.json").open("x") as stream:
            json.dump(seed_audit, stream, indent=2, sort_keys=True)
            stream.write("\n")
        if seed_audit["status"] != "PASS_NO_RECORDED_SEED_COLLISION":
            raise ValueError("new evaluation seeds collide with recorded D03 history")
        for arm in ("candidate", "reference"):
            arm_dir = output_dir / arm
            log_path = output_dir / f"{arm}-collector.log"
            command = [str(python_bin), str(COLLECTOR), "--onnx-model", str(models[arm]),
                       "--output", str(arm_dir), "--sessions-per-profile", str(look),
                       "--hands-per-session", str(plan["handsPerSession"]),
                       "--seed-base", str(manifest_data[arm]["seedBase"]),
                       "--evaluation-manifest", str(manifests[arm]), "--decision-ledger"]
            env = {**os.environ, "PYTHONPATH": str(ROOT / "src")}
            with log_path.open("x") as log:
                subprocess.run(command, cwd=ROOT, env=env, stdout=log,
                               stderr=subprocess.STDOUT, check=True,
                               timeout=plan["maxWallSecondsPerArm"])
            summary = json.loads((arm_dir / "summary.json").read_text())
            session_path = arm_dir / "sessions.jsonl"
            hand_path = arm_dir / "hand-trace.jsonl"
            validate_collection(summary, arm=arm,
                                manifest_sha=sha256(manifests[arm]),
                                model_sha=model_shas[arm],
                                contract_sha=plan["controllerContractSha256"],
                                code_sha=code_sha, look=look,
                                hands=plan["handsPerSession"],
                                session_path=session_path, hand_path=hand_path)
            audited_path = output_dir / f"{arm}-audited.jsonl"
            report_path = output_dir / f"{arm}-audit.json"
            audit_reports[arm] = trace_audit.audit_files(
                manifest_path=manifests[arm], session_path=session_path,
                hand_path=hand_path, output_path=audited_path,
                report_path=report_path, deadline_ms=plan["maxInferenceMs"])
            if (audit_reports[arm]["status"] != "FULL_TRACE_UNIT_AUDIT_INPUT_ONLY" or
                    audit_reports[arm]["sessionsRead"] != len(scheduled[arm]) or
                    audit_reports[arm]["handsRead"] !=
                    len(scheduled[arm]) * plan["handsPerSession"] or
                    audit_reports[arm]["decisionLedgerRequired"] is not True):
                raise ValueError(f"{arm} independent trace audit is incomplete")
            audited_paths[arm] = audited_path
        rows = {arm: [json.loads(line) for line in audited_paths[arm].open()]
                for arm in ("candidate", "reference")}
        result = gate.evaluate(plan, rows)
        result["evaluationPurpose"] = plan["evaluationPurpose"]
        result["candidatePromotionEligible"] = (
            plan["evaluationPurpose"] == "PROMOTION_CANDIDATE" and
            result["decision"] == "PROMOTE")
        result["inputSha256"] = {
            "plan": sha256(plan_path),
            "seedHistoryPreflight": sha256(output_dir / "seed-history-preflight.json"),
            **{f"{arm}Manifest": sha256(manifests[arm]) for arm in manifests},
            **{f"{arm}ModelBody": model_shas[arm] for arm in models},
            **{f"{arm}Audit": sha256(output_dir / f"{arm}-audit.json")
               for arm in audit_reports},
            **{f"{arm}AuditedSessions": sha256(audited_paths[arm])
               for arm in audited_paths},
        }
        result["codeGitSha"] = code_sha
        result["independentFinalEvaluationComplete"] = False
        with (output_dir / "gate-result.json").open("x") as stream:
            json.dump(result, stream, indent=2, sort_keys=True)
            stream.write("\n")
        return result
    except Exception as error:
        with (output_dir / "failure.json").open("x") as stream:
            json.dump({"status": "FAIL_CLOSED", "error": str(error),
                       "codeGitSha": code_sha}, stream, indent=2)
            stream.write("\n")
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--candidate-manifest", type=Path, required=True)
    parser.add_argument("--reference-manifest", type=Path, required=True)
    parser.add_argument("--candidate-model", type=Path, required=True)
    parser.add_argument("--reference-model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--look", type=int, required=True)
    parser.add_argument("--python-bin", type=Path, default=Path(sys.executable))
    parser.add_argument("--prior-artifacts-root", type=Path, required=True)
    args = parser.parse_args()
    result = run(plan_path=args.plan,
                 manifests={"candidate": args.candidate_manifest,
                            "reference": args.reference_manifest},
                 models={"candidate": args.candidate_model,
                         "reference": args.reference_model},
                 output_dir=args.output, look=args.look, python_bin=args.python_bin,
                 prior_artifacts_root=args.prior_artifacts_root)
    print(json.dumps({key: result[key] for key in
                      ("decision", "reason", "lookSessionsPerCell",
                       "productAdoptionApproved")}))


if __name__ == "__main__":
    main()
