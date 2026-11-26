"""Residual M2 source index keeps recorded deals separate from reservations."""

from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))
from build_badugi_entry_m2_last_source_index import (_root_seed, _write_u32,
                                                      session_decks, source_class)


class LastSourceIndex(unittest.TestCase):
    def test_only_reviewed_one_hand_source_counts_as_reset(self):
        self.assertEqual(source_class(
            "d03-iron-multistreet-value-audit-20261117/betting-decisions.jsonl",
            "SEED_BEARING_EXPERIMENT"), "RECORDED_ONE_HAND_RESET_SEED")
        self.assertEqual(source_class(
            "d03-predraw-bb-prior-raise-20261125/safety-rows.jsonl.partial",
            "SEED_BEARING_EXPERIMENT"), "RECORDED_ONE_HAND_RESET_SEED")
        self.assertEqual(source_class("unknown/paired-hands.jsonl",
                                      "SEED_BEARING_EXPERIMENT"),
                         "UNRESOLVED_ROOT_SEED_EXCLUSION_ONLY")
        self.assertEqual(source_class("unknown/seeds.jsonl", "SEED_SCHEDULE"),
                         "SCHEDULE_RESERVATION_NOT_DEALT_PROOF")

    def test_session_arms_share_decks_and_boundary_is_not_completed(self):
        row = {"seed": 100, "arms": {"baseline": {"completedHeroHands": 3},
                                    "candidate": {"completedHeroHands": 2}}}
        self.assertEqual(session_decks(row, 20), ([100, 1109, 2118], 3127))
        row["arms"]["candidate"]["completedHeroHands"] = 20
        self.assertEqual(len(session_decks(row, 20)[0]), 20)
        self.assertIsNone(session_decks(row, 20)[1])

    def test_large_seed_is_controller_u32_residue(self):
        self.assertEqual(_root_seed({"seed": 2**32 + 17}), 17)
        for value in (None, -1, 1.5, True):
            with self.subTest(value=value), self.assertRaises(ValueError):
                _root_seed({"seed": value})

    def test_u32_index_is_sorted_deduplicated(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "index.u32"
            metadata = _write_u32(path, {10, 1, 4})
            self.assertEqual(metadata["count"], 3)
            self.assertEqual(path.read_bytes(),
                             b"\x01\x00\x00\x00\x04\x00\x00\x00\x0a\x00\x00\x00")


if __name__ == "__main__":
    unittest.main()
