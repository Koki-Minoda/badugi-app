"""Frozen actual-deck residue preflight for the M2 safety collector."""

import hashlib
from pathlib import Path
import struct
import tempfile
import unittest

from rl.training.collect_badugi_entry_m2_draft import check_recorded_seed_history


class EntryM2CollectorTest(unittest.TestCase):
    def check_index(self, prior, selected):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            path = folder / "recorded-decks.u32le"
            path.write_bytes(b"".join(struct.pack("<I", value) for value in prior))
            plan = {"recordedDeckResiduesFile": path.name,
                    "recordedDeckResiduesCount": len(prior),
                    "recordedDeckResiduesSha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            check_recorded_seed_history(plan, [{"seed": seed} for seed in selected], folder)

    def test_unseen_residue_passes(self):
        self.check_index([1, 10, 4294967295], [2, 4294967296 + 11])

    def test_modulo_collision_fails(self):
        with self.assertRaisesRegex(ValueError, "collides"):
            self.check_index([1, 10, 4294967295], [4294967296 + 10])

    def test_unsorted_or_duplicate_index_fails(self):
        for prior in ([2, 1], [2, 2]):
            with self.subTest(prior=prior), self.assertRaisesRegex(ValueError, "sorted"):
                self.check_index(prior, [3])


if __name__ == "__main__":
    unittest.main()
