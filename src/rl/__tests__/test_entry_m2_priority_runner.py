from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from rl.training.collect_badugi_entry_m2_draft import AuditBridge
from rl.training.collect_badugi_entry_m2_priority import (
    AUDIT_SCHEMA, REQUIRED_QA, RESERVED_DEALS, ROWS_FILE, START_MARKER, collect_priority_run,
    mark_started, verify_ci_receipt, verify_reservation_receipt,
)


class EntryM2PriorityRunnerTests(unittest.TestCase):
    def test_ci_receipt_requires_required_jobs_for_exact_head(self):
        plan = {"codeGitSha": "a" * 40}
        jobs = {job: "success" for job in REQUIRED_QA} | {"deploy": "skipped"}
        receipt = {"repository": "Koki-Minoda/badugi-app", "workflowName": "Deploy mgx-prod-01",
                   "headSha": plan["codeGitSha"], "conclusion": "success", "event": "pull_request",
                   "baseRef": "main", "runId": 12, "jobConclusions": jobs}
        verify_ci_receipt(plan, receipt)
        for change in ({"headSha": "b" * 40},
                       {"jobConclusions": {**jobs, "learning-qa": "skipped"}},
                       {"workflowName": "unrelated"}):
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, "required CI"):
                verify_ci_receipt(plan, {**receipt, **change})

    def test_receipt_requires_entire_reservation_and_zero_collisions(self):
        plan = {"screenPlanSha256": "a" * 64, "seedHistorySha256": "b" * 64,
                "screenedDeckResiduesSha256": "c" * 64}
        receipt = {**plan, "schema": AUDIT_SCHEMA, "status": "PASS_NO_RESERVATION_COLLISION",
                   "fullReservedDeals": RESERVED_DEALS, "recordedSeedCollisions": 0,
                   "historicalScreenCollisions": 0, "distinctCollisions": 0}
        verify_reservation_receipt(plan, receipt)
        for change in ({"fullReservedDeals": 4_900}, {"historicalScreenCollisions": 1},
                       {"seedHistorySha256": "d" * 64}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                verify_reservation_receipt(plan, {**receipt, **change})

    def test_started_marker_and_raw_remnant_each_block_a_new_attempt(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            mark_started(folder, "a" * 64)
            self.assertTrue((folder / START_MARKER).is_file())
            with self.assertRaises(FileExistsError):
                mark_started(folder, "a" * 64)
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            (folder / ROWS_FILE).write_text("")
            with self.assertRaisesRegex(FileExistsError, "no automatic resume"):
                mark_started(folder, "a" * 64)

    def test_failed_preflight_never_starts_inference_or_bridge(self):
        module = "rl.training.collect_badugi_entry_m2_priority"
        with (patch(f"{module}.preflight", side_effect=ValueError("blocked")),
              patch(f"{module}.OnnxAgent") as agent, patch(f"{module}.AuditBridge") as bridge):
            with self.assertRaisesRegex(ValueError, "blocked"):
                collect_priority_run(Path("unused.json"), "a" * 64)
            agent.assert_not_called()
            bridge.assert_not_called()

    def test_bridge_enforces_deadline_after_partial_output(self):
        arguments = [sys.executable, "-u", "-c",
                     "import sys,time; sys.stdin.readline(); sys.stdout.write('{'); "
                     "sys.stdout.flush(); time.sleep(5)"]
        process = subprocess.Popen(arguments, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True)
        module = "rl.training.collect_badugi_entry_m2_draft"
        with patch(f"{module}.subprocess.Popen", return_value=process):
            bridge = AuditBridge(0.2)
        try:
            with self.assertRaisesRegex(TimeoutError, "response deadline"):
                bridge.send({"command": "fixture"})
        finally:
            bridge.close()
