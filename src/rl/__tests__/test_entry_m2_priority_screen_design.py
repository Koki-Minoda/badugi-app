import unittest

from rl.training.entry_m2_sampling_contract import PROFILES
from rl.training.plan_badugi_entry_m2_priority_screen import (
    _shortage_probability, verify_selected_schedule,
)


class EntryM2PriorityScreenTests(unittest.TestCase):
    def setUp(self):
        self.design = {"queues": [{
            "queueIndex": 0, "group": [6, 6, "cash"], "openingPosition": 0,
            "expectedOpeningDealerSeat": 0, "heroSeat": 3,
            "stratum": "A6T_boundary", "reservedOffset": 10, "maxPreviews": 80,
            "requiredAccepts": len(PROFILES),
        }]}
        self.selected = [
            {"queueIndex": 0, "screenOrdinal": index * 2, "seed": index,
             "reservedIndex": 10 + index * 2, "group": [6, 6, "cash"],
             "profile": profile, "stratum": "A6T_boundary", "heroSeat": 3,
             "expectedOpeningDealerSeat": 0, "expectedOpeningPosition": 0,
             "expectedOpeningActorCards": ["AH", "6D", "10C", "KH"]}
            for index, profile in enumerate(PROFILES)
        ]

    def test_rejects_short_duplicate_and_reallocated_schedules(self):
        verify_selected_schedule(self.design, self.selected)
        with self.assertRaisesRegex(ValueError, "incomplete"):
            verify_selected_schedule(self.design, self.selected[:-1])
        for change in ({"seed": 0}, {"screenOrdinal": 0}, {"reservedIndex": 30},
                       {"profile": PROFILES[0]}, {"heroSeat": 4},
                       {"expectedOpeningActorCards": ["AH", "2D", "3C", "4S"]}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                verify_selected_schedule(
                    self.design, [self.selected[0], {**self.selected[1], **change}, *self.selected[2:]],
                )

    def test_cap_shortage_calculation(self):
        self.assertEqual(_shortage_probability(99, 0.1), 1.0)
        p_rare = 636 / 270_725
        self.assertTrue(0 < _shortage_probability(60_000, p_rare) < 0.001)
