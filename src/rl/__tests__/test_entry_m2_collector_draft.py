"""Frozen actual-deck residue preflight for the M2 safety collector."""

import hashlib
from pathlib import Path
import struct
import tempfile
import unittest

from rl.training.collect_badugi_entry_m2_draft import check_recorded_seed_history


class EntryM2CollectorTest(unittest.TestCase):
    def check_index(self, prior, selected, screened=None):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            plan = {}
            for prefix, values in (("recordedDeckResidues", prior),
                                   ("screenedDeckResidues", screened if screened is not None
                                    else sorted(seed % 2**32 for seed in selected))):
                path = folder / (prefix + ".u32le")
                path.write_bytes(b"".join(struct.pack("<I", value) for value in values))
                plan[prefix + "File"] = path.name
                plan[prefix + "Count"] = len(values)
                plan[prefix + "Sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
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

    def test_rejected_screen_is_reserved_and_prior_collision_fails(self):
        self.check_index([1, 10], [2], screened=[2, 3])
        with self.assertRaisesRegex(ValueError, "screened deck seed collides"):
            self.check_index([1, 10], [2], screened=[2, 10])
        with self.assertRaisesRegex(ValueError, "absent from all-screened"):
            self.check_index([1, 10], [2], screened=[3])


if __name__ == "__main__":
    unittest.main()
