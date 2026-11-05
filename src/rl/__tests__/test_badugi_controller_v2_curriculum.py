"""Coverage contract for the isolated high-sample Pro curriculum."""
import unittest
from collections import Counter

from rl.training.badugi_controller_v2_curriculum import session_spec


class CurriculumTests(unittest.TestCase):
    def test_each_block_covers_every_table_profile_mode(self):
        for block in range(3):
            specs = [session_spec(index, 600_000_000)
                     for index in range(block * 40, (block + 1) * 40)]
            cells = Counter((s.seat_count, s.occupied_count, s.tournament,
                             s.opponent_profile) for s in specs)
            self.assertEqual(len(cells), 40)
            self.assertTrue(all(count == 1 for count in cells.values()))
            self.assertEqual(len({s.seed for s in specs}), 40)

    def test_two_million_hand_plan_has_balanced_target_offsets(self):
        # 100,000 planned 20-hand sessions; actual hands may be lower on bust.
        counts = Counter()
        offsets = Counter()
        for index in range(100_000):
            spec = session_spec(index, 600_000_000)
            cell = (spec.seat_count, spec.occupied_count,
                    spec.tournament, spec.opponent_profile)
            counts[cell] += 1
            offsets[cell, spec.target_seat_offset] += 1
        self.assertEqual(len(counts), 40)
        self.assertEqual(set(counts.values()), {2500})
        for cell in counts:
            occupied = cell[1]
            values = [offsets[cell, offset] for offset in range(occupied)]
            self.assertLessEqual(max(values) - min(values), 1)

    def test_invalid_indices_are_rejected(self):
        with self.assertRaises(ValueError):
            session_spec(-1, 1)
        with self.assertRaises(ValueError):
            session_spec(0, -1)


if __name__ == "__main__":
    unittest.main()
