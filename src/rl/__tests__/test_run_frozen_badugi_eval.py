"""Preflight and collection rejection tests for the bounded D03 look runner."""

from __future__ import annotations

import copy
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "evaluation" / "run_frozen_badugi_eval.py"
sys.path.insert(0, str(MODULE.parent))
SPEC = importlib.util.spec_from_file_location("run_frozen_badugi_eval", MODULE)
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


def inputs():
    code_sha = "d" * 40
    plan_sha = "e" * 64
    model_shas = {"candidate": "a" * 64, "reference": "b" * 64}
    plan = {
        "schema": runner.gate.SCHEMA,
        "evaluationPurpose": "PHASE1_WIRING_DIAGNOSTIC_ONLY",
        "scoreUnit": "big_bet_per_100_hands",
        "candidateModelSha256": model_shas["candidate"],
        "referenceModelSha256": model_shas["reference"],
        "controllerContractSha256": "c" * 64,
        "scoreBounds": [-100, 500],
        "familywiseAlpha": 0.01, "minimumImprovement": 2.5,
        "lookSessionsPerCell": [2, 4], "handsPerSession": 20,
        "maxHandsPerArm": 3200, "maxWallSecondsPerArm": 3600,
        "seedWindows": {"candidate": [1_500_000_001, 1_510_000_000],
                        "reference": [1_600_000_001, 1_610_000_000]},
        "excludedSeedWindows": [[8_025_760_001, 8_135_000_000]],
        "maxInferenceMs": 8000,
        "cells": [{"name": name, "weight": 1 / 40, **contract}
                  for name, contract in runner.expected_cells().items()],
    }
    manifests = {
        arm: {"status": "FROZEN", "codeGitSha": code_sha,
              "planSha256": plan_sha, "contractSha256": "c" * 64,
              "modelSha256": model_shas[arm],
              "seedBase": 1_500_000_001 if arm == "candidate" else 1_600_000_001,
              "sessionsPerProfileGroup": 4, "handsPerSessionMax": 20,
              "groupMatrix": list(runner.GROUPS),
              "opponentProfiles": list(runner.PROFILES),
              "requireDecisionLedger": True}
        for arm in model_shas
    }
    return plan, manifests, model_shas, plan_sha, code_sha


class FrozenBadugiRunnerTest(unittest.TestCase):
    def test_preflight_seals_real_controller_matrix_and_seed_schedule(self):
        values = inputs()
        scheduled = runner.validate_preflight(*values, look=2)
        self.assertEqual({arm: len(seeds) for arm, seeds in scheduled.items()},
                         {"candidate": 80, "reference": 80})
        self.assertEqual(len({seed % runner.gate.SEED_PERIOD
                              for seeds in scheduled.values() for seed in seeds}), 160)

    def test_phase2_safety_look_is_not_a_promotion_plan(self):
        plan, manifests, shas, plan_sha, code_sha = inputs()
        plan["evaluationPurpose"] = "PHASE2_SAFETY_DIAGNOSTIC_ONLY"
        self.assertEqual(len(runner.validate_preflight(
            plan, manifests, shas, plan_sha, code_sha, look=2)["candidate"]), 80)
        plan["evaluationPurpose"] = "UNSEALED"
        with self.assertRaisesRegex(ValueError, "evaluation purpose"):
            runner.validate_preflight(plan, manifests, shas, plan_sha, code_sha, look=2)

    def test_preflight_rejects_unsealed_or_changed_inputs(self):
        for label, mutate in (
            ("model", lambda p, m, s: s.update(candidate="f" * 64)),
            ("manifest", lambda p, m, s: m["candidate"].update(status="DRAFT")),
            ("ledger", lambda p, m, s: m["reference"].update(requireDecisionLedger=False)),
            ("cell", lambda p, m, s: p["cells"][0].update(bigBetChips=80)),
            ("profile", lambda p, m, s: p["cells"].pop()),
            ("seed", lambda p, m, s: m["candidate"].update(seedBase=1_510_000_000)),
        ):
            with self.subTest(label=label), self.assertRaises(ValueError):
                plan, manifests, shas, plan_sha, code_sha = copy.deepcopy(inputs())
                mutate(plan, manifests, shas)
                runner.validate_preflight(plan, manifests, shas,
                                          plan_sha, code_sha, look=2)

    def test_collection_rejects_missing_hands_or_tampered_originals(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            sessions = root / "sessions.jsonl"
            hands = root / "hands.jsonl"
            sessions.write_text("session\n")
            hands.write_text("hand\n")
            summary = {
                "status": "FROZEN_EVALUATION",
                "evaluationManifestSha256": "a" * 64,
                "modelSha256": "b" * 64,
                "contractSha256": "c" * 64,
                "codeGitSha": "d" * 40,
                "modelKind": "onnx", "decisionLedgerIncluded": True,
                "sessionStartIndex": 0, "sessionsPerProfileGroup": 2,
                "sessions": 80, "zeroSumSessions": 80, "hands": 1600,
                "groups": list(runner.GROUPS),
                "opponentProfiles": list(runner.PROFILES),
                "sessionTraceSha256": runner.sha256(sessions),
                "handTraceSha256": runner.sha256(hands),
            }
            kwargs = {"arm": "candidate", "manifest_sha": "a" * 64,
                      "model_sha": "b" * 64, "contract_sha": "c" * 64,
                      "code_sha": "d" * 40, "session_start": 0,
                      "session_count": 2, "hands": 20,
                      "session_path": sessions, "hand_path": hands}
            runner.validate_collection(summary, **kwargs)
            for change in ({"hands": 1599}, {"decisionLedgerIncluded": False},
                           {"handTraceSha256": "0" * 64}):
                with self.subTest(change=change), self.assertRaises(ValueError):
                    runner.validate_collection({**summary, **change}, **kwargs)

    def test_history_scan_catches_raw_and_modulo_seed_reuse(self):
        scheduled = runner.validate_preflight(*inputs(), look=2)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            old = root / "d03-old"
            old.mkdir()
            plan = old / "plan.json"
            sessions = old / "sessions.jsonl"
            plan.write_text(json.dumps({"seedBase": 23}))
            sessions.write_text(json.dumps({"seed": 34}) + "\n")
            self.assertEqual(runner.audit_seed_history(root, scheduled, set())["status"],
                             "PASS_NO_RECORDED_SEED_COLLISION")
            collision = scheduled["candidate"][0] + 2 ** 32
            sessions.write_text(json.dumps({"seed": collision}) + "\n")
            self.assertEqual(runner.audit_seed_history(root, scheduled, set())["status"],
                             "FAIL_RECORDED_SEED_COLLISION")
            sessions.write_text(json.dumps({"seed": 34}) + "\n")
            plan.write_text(json.dumps({"seedBase": scheduled["reference"][0] + 2 ** 32}))
            self.assertEqual(runner.audit_seed_history(root, scheduled, set())["status"],
                             "FAIL_RECORDED_SEED_COLLISION")

    def test_audited_rows_must_follow_frozen_seed_and_rotating_seat(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "audited.jsonl"
            base = 1_900_000_001
            rows = []
            for group_index, group in enumerate(runner.GROUPS):
                occupied = int(group.split("/", 1)[1].split("-", 1)[0])
                for profile_index, profile in enumerate(runner.PROFILES):
                    for index in (3, 4):
                        rows.append({
                            "cell": f"{group}|{profile}", "sessionIndex": index,
                            "seed": base + group_index * 1_000_000 +
                            profile_index * 10_000 + index - 1,
                            "heroSeat": (index - 1) % occupied,
                        })
            path.write_text("".join(json.dumps(row) + "\n" for row in rows))
            runner.validate_audited_seeds(path, seed_base=base,
                                          session_start=2, session_count=2)
            rows[0]["seed"] += 1
            path.write_text("".join(json.dumps(row) + "\n" for row in rows))
            with self.assertRaisesRegex(ValueError, "frozen schedule"):
                runner.validate_audited_seeds(path, seed_base=base,
                                              session_start=2, session_count=2)


if __name__ == "__main__":
    unittest.main()
