"""F04 resource gate fixtures; no Windows host or trainer is required."""

import json
import subprocess
import sys
import unittest
from pathlib import Path

from rl.training.ten_game_f04_preflight import GIB, evaluate_probe_readiness


class TenGameF04PreflightTests(unittest.TestCase):
    def evaluate(self, **overrides):
        values = {
            "variant_id": "D03",
            "artifact_root": r"D:\MGX-RL\ten-game",
            "system_drive": "C:\\",
            "root_exists": True,
            "marker_exists": True,
            "free_bytes": 30 * GIB,
            "available_memory_bytes": 6 * GIB,
            "running_trainers": 0,
        }
        values.update(overrides)
        return evaluate_probe_readiness(**values)

    def test_dedicated_idle_host_only_passes_the_bounded_probe_gate(self):
        result = self.evaluate()
        self.assertTrue(result["probeReady"])
        self.assertFalse(result["longRunReady"])
        self.assertIn("restore into a separate output directory with optimizer/counters verified", result["remainingGates"])

    def test_observed_system_drive_and_low_memory_block_the_probe(self):
        result = self.evaluate(
            artifact_root=r"C:\MGX-RL",
            free_bytes=81_822_978_048,
            available_memory_bytes=1_094_924 * 1024,
        )
        self.assertFalse(result["probeReady"])
        self.assertIn("artifact root must be on a non-system drive", result["reasons"])
        self.assertIn("available physical memory is below 4 GiB", result["reasons"])

    def test_missing_marker_or_active_trainer_blocks_a_new_job(self):
        result = self.evaluate(marker_exists=False, running_trainers=1)
        self.assertFalse(result["probeReady"])
        self.assertIn("artifact marker .mgx-rl-artifacts is missing", result["reasons"])
        self.assertIn("another RL trainer is running", result["reasons"])

    def test_board_stud_and_draw_trainers_cannot_pass_on_host_resources_alone(self):
        for variant_id in ("B01", "B02", "B05", "B06", "ST1", "ST2", "ST3", "D01", "S01"):
            with self.subTest(variant_id=variant_id):
                result = self.evaluate(variant_id=variant_id)
                self.assertFalse(result["probeReady"])
                self.assertFalse(result["longRunReady"])
                self.assertIn("trainer checkpoint continuation is not ready for this variant", result["reasons"])

    def test_relative_or_drive_root_is_not_a_dedicated_directory(self):
        self.assertFalse(self.evaluate(artifact_root=r"D:MGX-RL")["probeReady"])
        self.assertFalse(self.evaluate(artifact_root="D:\\")["probeReady"])

    def test_cli_returns_a_blocking_exit_code_for_an_unsafe_host(self):
        script = Path(__file__).resolve().parents[1] / "training" / "ten_game_f04_preflight.py"
        completed = subprocess.run(
            [sys.executable, str(script), "--variant-id", "D03", "--artifact-root", r"C:\MGX-RL", "--system-drive", "C:\\",
             "--root-exists", "0", "--marker-exists", "0", "--free-bytes", str(30 * GIB),
             "--available-memory-bytes", str(GIB), "--running-trainers", "0"],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(completed.returncode, 2)
        self.assertFalse(json.loads(completed.stdout)["probeReady"])


if __name__ == "__main__":
    unittest.main()
