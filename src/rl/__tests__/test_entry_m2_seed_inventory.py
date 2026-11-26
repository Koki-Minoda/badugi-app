"""M2 prior seed parsing keeps unrelated numeric fields out of the index."""

import unittest

from rl.training.inventory_badugi_entry_m2_prior_seeds import seed_values


class EntryM2SeedInventoryTest(unittest.TestCase):
    def test_named_seed_fields_and_modulo(self):
        row = {"seed": 2**32 + 7, "pot": 100,
               "opponent": {"deckSeeds": [8, 9], "cards": [1, 2, 3, 4]}}
        self.assertEqual(list(seed_values(row)), [7, 8, 9])

    def test_named_seed_list_allows_bare_integers(self):
        self.assertEqual(list(seed_values([1, {"sessionSeed": 2}], True)), [1, 2])


if __name__ == "__main__":
    unittest.main()
