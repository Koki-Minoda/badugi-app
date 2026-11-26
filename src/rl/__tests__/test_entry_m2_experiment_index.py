"""Producer-specific M2 exclusions never expand one-hand branches to 20 hands."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))
from build_badugi_entry_m2_experiment_index import deck_counts, source_kind


class ExperimentDeckCounts(unittest.TestCase):
    def test_one_hand_branch_is_one_deck_despite_two_outcomes(self):
        row = {"globalIndex": 7, "seed": 100, "target": None,
               "naturalNetBigBets": 2, "branchNetBigBets": 3}
        self.assertEqual(deck_counts(row, "one_hand_branch", 1), (100, 1, 0))
        self.assertEqual(deck_counts(row, "one_hand", 1), (100, 1, 0))

    def test_natural_arms_share_decks_and_use_recorded_counts(self):
        row = {"globalIndex": 7, "seed": 100,
               "arms": {"baseline": {"completedHeroHands": 12,
                                    "heroBustedBeforeHorizon": 1},
                        "candidate": {"completedHeroHands": 20}}}
        self.assertEqual(deck_counts(row, "natural_session", 20), (100, 20, 0))
        row["arms"]["candidate"]["completedHeroHands"] = 10
        self.assertEqual(deck_counts(row, "natural_session", 20), (100, 12, 1))

    def test_partial_row_does_not_imply_unrecorded_sessions(self):
        row = {"globalIndex": 2678, "seed": 42,
               "arms": {"baseline": {"completedHeroHands": 9},
                        "candidate": {"completedHeroHands": 15}}}
        self.assertEqual(deck_counts(row, "natural_session", 20), (42, 15, 1))

    def test_fail_closed_on_changed_shapes(self):
        for row in ({"globalIndex": 0, "seed": 1, "arms": {"a": {"completedHeroHands": 0},
                                                               "b": {"completedHeroHands": 5}}},
                    {"globalIndex": 0, "seed": 1, "arms": {"a": {"completedHeroHands": 21},
                                                               "b": {"completedHeroHands": 5}}},
                    {"globalIndex": 0, "seed": 1, "arms": {"a": {"completedHeroHands": 5}}}):
            with self.subTest(row=row), self.assertRaises(ValueError):
                deck_counts(row, "natural_session", 20)

    def test_only_reviewed_producer_paths_classify(self):
        self.assertEqual(source_kind("d03-predraw-range-table-20261123/rows.jsonl.partial"),
                         "one_hand")
        self.assertEqual(source_kind("d03-predraw-range-policy-v2-20261123/natural-rows.jsonl.partial"),
                         "natural_session")
        self.assertIsNone(source_kind("d03-new-unknown/rows.jsonl.partial"))
        self.assertIsNone(source_kind("d03-predraw-range-table-20261123/sources/rows.jsonl.partial"))


if __name__ == "__main__":
    unittest.main()
