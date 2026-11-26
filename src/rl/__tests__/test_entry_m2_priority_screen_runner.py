import hashlib
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

from rl.training.entry_m2_sampling_contract import PROFILES
from rl.training.recount_badugi_entry_m2_priority_screen import recount_prefixes
from rl.training.screen_badugi_entry_m2_priority import (
    RESULT_FILE, SELECTED_FILE, TRACE_FILE, run_screen,
)


class EntryM2PriorityScreenRunnerTests(unittest.TestCase):
    def test_failed_preflight_does_not_preview_or_create_files(self):
        module = "rl.training.screen_badugi_entry_m2_priority"
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            with (patch(f"{module}.preflight_screen", side_effect=ValueError("blocked")),
                  patch(f"{module}.subprocess.run") as worker):
                with self.assertRaisesRegex(ValueError, "blocked"):
                    run_screen(folder / "plan.json", "a" * 64, "b" * 64)
                worker.assert_not_called()
            self.assertEqual(list(folder.iterdir()), [])

    def test_worker_fixture_agrees_with_recount_and_does_not_publish_short_selection(self):
        for target in ("other", "A6T_boundary"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as temporary:
                folder = Path(temporary)
                seeds = [12345, 0]
                schedule = struct.pack("<2I", *seeds)
                (folder / "schedule.u32le").write_bytes(schedule)
                design = {"maxReservedDeals": 2, "plannedCompletedAttempts": 1,
                          "profilesInAcceptanceOrder": list(PROFILES), "queues": [{
                    "queueIndex": 0, "reservedOffset": 0, "maxPreviews": 2,
                    "requiredAccepts": 1, "group": [2, 2, "cash"], "heroSeat": 0,
                    "openingPosition": 0, "expectedOpeningDealerSeat": 0, "stratum": target,
                }]}
                plan = {
                    "scheduleFile": "schedule.u32le", "screenTimeoutSeconds": 10,
                    "scheduleSha256": hashlib.sha256(schedule).hexdigest(),
                    "traceFile": TRACE_FILE, "selectedFile": SELECTED_FILE, "resultFile": RESULT_FILE,
                }
                with patch("rl.training.screen_badugi_entry_m2_priority.preflight_screen",
                           return_value=(plan, design)):
                    result = run_screen(folder / "plan.json", "a" * 64, "b" * 64)
                raw = (folder / TRACE_FILE).read_bytes()
                self.assertEqual(result["screenTraceSha256"], hashlib.sha256(raw).hexdigest())
                if target == "other":
                    recounted, visited = recount_prefixes(design, seeds, map(json.loads, raw.splitlines()))
                    self.assertEqual(visited, 1)
                    self.assertEqual(result["unusedReservedDeals"], 1)
                    self.assertTrue(result["independentRecountPending"])
                    self.assertEqual(json.loads((folder / SELECTED_FILE).read_text()), recounted)
                else:
                    self.assertEqual(result["status"], "INSUFFICIENT_SCREEN_ALLOCATION")
                    self.assertEqual(result["previewedDeals"], 2)
                    self.assertFalse((folder / SELECTED_FILE).exists())
