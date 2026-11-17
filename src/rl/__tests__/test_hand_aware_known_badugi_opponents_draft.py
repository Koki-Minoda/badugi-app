"""Behavioral contracts for isolated, hand-aware development opponents."""
import random
import unittest

from rl.training.hand_aware_known_badugi_opponents_draft import (
    HAND_AWARE_KNOWN_PROFILES, hand_aware_known_opponent_action,
)


def decision(*, phase="BET", made=2, high=8, players=2, position=0.5,
             pot_bb=4, to_call_bb=1, round_index=0):
    observation = [0.0] * 96
    observation[11] = players / 6
    observation[12] = position
    observation[15] = pot_bb / 400
    observation[18] = to_call_bb / 20
    observation[24] = made / 4
    observation[25] = high / 12
    mask = [1, 0, 1, 0, 1, 0] if phase == "BET" else [1, 1, 1, 1, 1, 0]
    return {"phase": phase, "drawRoundIndex": round_index,
            "observation": observation, "legalMask": mask}


class HandAwareKnownOpponentTests(unittest.TestCase):
    def test_profiles_are_disjoint_from_frozen_unknown_holdout(self):
        from rl.training.unknown_badugi_opponents import UNKNOWN_PROFILES
        self.assertFalse(set(HAND_AWARE_KNOWN_PROFILES) & set(UNKNOWN_PROFILES))

    def test_draw_count_responds_to_own_hand_quality(self):
        for profile in ("tight_value", "balanced_range", "loose_station"):
            for made, expected in ((4, 0), (3, 1), (2, 2), (1, 3)):
                row = decision(phase="DRAW", made=made, high=8, round_index=2)
                action = hand_aware_known_opponent_action(row, profile, random.Random(4))
                self.assertEqual(action, expected, (profile, made))

    def test_weak_hand_folds_more_in_multiway_and_at_higher_price(self):
        def fold_count(row):
            return sum(hand_aware_known_opponent_action(row, "balanced_range", random.Random(seed)) == 0
                       for seed in range(2000))
        heads_up = fold_count(decision(players=2, pot_bb=4, to_call_bb=1))
        six_way = fold_count(decision(players=6, pot_bb=4, to_call_bb=1))
        expensive = fold_count(decision(players=6, pot_bb=4, to_call_bb=4))
        self.assertGreater(six_way, heads_up + 300)
        self.assertGreater(expensive, six_way + 100)

    def test_strong_nine_low_raises_more_than_weak_two_card(self):
        def raise_count(row):
            return sum(hand_aware_known_opponent_action(row, "balanced_range", random.Random(seed)) == 4
                       for seed in range(2000))
        self.assertGreater(raise_count(decision(made=4, high=8)), 700)
        self.assertLess(raise_count(decision(made=2, high=8)), 100)

    def test_actor_observation_only_and_legal_fallback(self):
        class NoHiddenHero(dict):
            def __getitem__(self, key):
                if key == "heroPrivateCards":
                    raise AssertionError("read non-actor cards")
                return super().__getitem__(key)
        row = NoHiddenHero(decision(made=4, high=8))
        row["legalMask"] = [0, 0, 1, 0, 0, 0]
        row["heroPrivateCards"] = "must not be read"
        for profile in HAND_AWARE_KNOWN_PROFILES:
            self.assertEqual(hand_aware_known_opponent_action(row, profile, random.Random(3)), 2)

    def test_invalid_actor_contract_fails_closed(self):
        row = decision()
        row["legalMask"] = [0] * 6
        with self.assertRaisesRegex(ValueError, "nonempty legal mask"):
            hand_aware_known_opponent_action(row, "tight_value", random.Random(1))
        row = decision()
        row["observation"] = row["observation"][:-1]
        with self.assertRaisesRegex(ValueError, "96-slot"):
            hand_aware_known_opponent_action(row, "tight_value", random.Random(1))


if __name__ == "__main__":
    unittest.main()
