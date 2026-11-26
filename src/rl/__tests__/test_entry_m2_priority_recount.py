import unittest

from rl.training.recount_badugi_entry_m2_priority_screen import preview_own_cards, recount_prefixes


class EntryM2PriorityRecountTests(unittest.TestCase):
    def test_independent_shuffle_matches_js_preview_fixtures(self):
        fixtures = [
            (12345, 0, ["QC", "3H", "QH", "2C"]),
            (12345, 5, ["8H", "9C", "10C", "6H"]),
            (4294967295, 3, ["AH", "3D", "6H", "2D"]),
            (0, 1, ["10H", "KH", "3D", "4D"]),
        ]
        for seed, seat, expected in fixtures:
            with self.subTest(seed=seed, seat=seat):
                self.assertEqual(preview_own_cards(seed, seat), expected)

    def test_counts_only_reproduced_prefixes_and_rejects_extra_or_missing_rows(self):
        queue = {"group": [2, 2, "cash"], "expectedOpeningDealerSeat": 0, "maxPreviews": 2,
                 "requiredAccepts": 1, "stratum": "other"}
        design = {"queues": [
            {**queue, "queueIndex": 0, "reservedOffset": 0, "openingPosition": 0, "heroSeat": 0},
            {**queue, "queueIndex": 1, "reservedOffset": 2, "openingPosition": 1, "heroSeat": 1},
        ]}
        schedule = [12345, 1, 0, 2]
        first = {"queueIndex": 0, "screenOrdinal": 0, "reservedIndex": 0, "heroSeat": 0,
                 "seed": 12345, "cards": ["QC", "3H", "QH", "2C"], "stratum": "other"}
        second = {"queueIndex": 1, "screenOrdinal": 0, "reservedIndex": 2, "heroSeat": 1,
                  "seed": 0, "cards": ["10H", "KH", "3D", "4D"], "stratum": "other"}
        selected, previewed = recount_prefixes(design, schedule, [first, second])
        self.assertEqual(previewed, 2)
        self.assertEqual([row["reservedIndex"] for row in selected], [0, 2])
        with self.assertRaisesRegex(ValueError, "reserved prefix"):
            recount_prefixes(design, schedule, [first, {**second, "screenOrdinal": 1}])
        with self.assertRaisesRegex(ValueError, "reproduced deal"):
            recount_prefixes(design, schedule, [first, {**second, "cards": first["cards"]}])
        with self.assertRaisesRegex(ValueError, "ended before"):
            recount_prefixes(design, schedule, [first])
        with self.assertRaisesRegex(ValueError, "after the selected prefixes"):
            recount_prefixes(design, schedule, [first, second, None])
