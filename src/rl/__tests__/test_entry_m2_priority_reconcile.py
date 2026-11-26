from pathlib import Path
import json
import tempfile
import unittest
from unittest.mock import patch

from rl.training import reconcile_badugi_entry_m2_priority_run as reconciliation


class EntryM2PriorityReconciliationTests(unittest.TestCase):
    def test_binds_opening_evidence_and_deal_order(self):
        cards = ["AH", "6D", "10C", "KH"]
        schedule = {"seed": 12, "group": [6, 6, "cash"], "profile": "tight_value",
                    "stratum": "A6T_boundary", "queueIndex": 0, "heroSeat": 3,
                    "expectedOpeningActorCards": cards, "expectedOpeningDealerSeat": 0,
                    "expectedOpeningPosition": 0}
        row = {"globalIndex": 0, "seed": 12, "group": [6, 6, "cash"], "profile": "tight_value",
               "stratum": "A6T_boundary", "queueIndex": 0, "heroSeat": 3,
               "openingActorCards": cards, "openingDealerSeat": 0, "openingPosition": 0}
        reconciliation.bind_completed_attempt(row, schedule, 0)
        for changed in ({"queueIndex": 1}, {"openingPosition": 2}, {"openingDealerSeat": 1},
                        {"openingActorCards": list(reversed(cards))}, {"seed": 13}):
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                reconciliation.bind_completed_attempt({**row, **changed}, schedule, 0)

    def test_result_requires_own_digest_and_complete_rows(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)

            def put(name, value):
                data = json.dumps(value).encode()
                (folder / name).write_bytes(data)
                return reconciliation._digest(data)

            targets_sha = put("targets.json", {})
            design_sha = put("design.json", {})
            selected_sha = put("selected.json", [])
            screen_inputs = {"screenPlanSha256": "1" * 64, "screenTraceSha256": "2" * 64,
                             "screenedDeckResiduesSha256": "3" * 64, "screenResultSha256": "4" * 64}
            recount_sha = put("recount.json", {
                "schema": reconciliation.RECOUNT_SCHEMA, "status": "PASS",
                "selectedSha256": selected_sha, "designSha256": design_sha,
                "acceptedAttempts": 4_900, **screen_inputs,
            })
            plan_sha = put("plan.json", {
                "schema": reconciliation.PLAN_SCHEMA, "status": "FROZEN_BEFORE_COLLECTION",
                "stage": "PRIORITY_ENTRY_OPPORTUNITY_SAFETY_ONLY", "plannedAttempts": 4_900,
                "targetsFile": "targets.json", "targetsSha256": targets_sha,
                "designFile": "design.json", "designSha256": design_sha,
                "selectedFile": "selected.json", "selectedSha256": selected_sha,
                "screenRecountFile": "recount.json", "screenRecountSha256": recount_sha,
                "codeGitSha": "d" * 40, "modelSha256": "e" * 64, "inferenceDeadlineMs": 2000,
                "rowsFile": "raw.jsonl", "resultFile": "result.json", **screen_inputs,
            })
            raw = b'{"partial":true}'
            (folder / "raw.jsonl").write_bytes(raw)
            result_sha = put("result.json", {
                "schema": reconciliation.RESULT_SCHEMA,
                "status": "COMPLETE_PRIORITY_OPPORTUNITY_SAFETY_ONLY",
                "planSha256": plan_sha, "selectedSha256": selected_sha,
                "codeGitSha": "d" * 40, "modelSha256": "e" * 64,
                "heroOnnxCalls": 123, "fallbackCalls": 0, "maxInferenceMs": 31,
                "completedAttempts": 4_900, "rowsSha256": reconciliation._digest(raw),
            })
            with (patch.object(reconciliation, "TARGETS_SHA256", targets_sha),
                  patch.object(reconciliation, "load_priority_targets", return_value=[]),
                  patch.object(reconciliation, "build_design", return_value={}),
                  patch.object(reconciliation, "verify_selected_schedule")):
                with self.assertRaisesRegex(ValueError, "artifact SHA mismatch"):
                    reconciliation.reconcile_priority_run(folder / "plan.json", plan_sha, "0" * 64)
                with self.assertRaisesRegex(ValueError, "incomplete record"):
                    reconciliation.reconcile_priority_run(folder / "plan.json", plan_sha, result_sha)
                (folder / "raw.jsonl").write_bytes(b'{"altered":true}\n')
                with self.assertRaisesRegex(ValueError, "artifact SHA mismatch: raw.jsonl"):
                    reconciliation.reconcile_priority_run(folder / "plan.json", plan_sha, result_sha)
