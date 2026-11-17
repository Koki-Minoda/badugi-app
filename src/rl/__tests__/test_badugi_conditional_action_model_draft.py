"""Conditional action likelihood must use labels offline and public data online."""
import unittest

from rl.training.badugi_conditional_action_model_draft import (
    conditional_action_probability, fit_conditional_action_model,
)
from rl.training.badugi_public_range_belief_draft import estimate_public_range


def event(action):
    return {"type": "BET_ACTION", "seat": 1, "action": action,
            "amountBb": 2 if action == "RAISE" else 1,
            "drawRoundIndex": 0, "legalActions": [0, 2, 4],
            "toCallBb": 1, "potBb": 4, "activePlayers": 3}


class ConditionalActionModelTests(unittest.TestCase):
    def test_hand_bucket_changes_a_public_action_likelihood(self):
        rows = [{"sessionId": i, "stateId": 0, "truthBucket": i % 2 * 3,
                 "publicEvent": event("FOLD" if i % 2 == 0 else "RAISE")}
                for i in range(120)]
        model = fit_conditional_action_model(rows, min_sessions=100)
        self.assertEqual(model["status"], "DEVELOPMENT_FIT_ONLY")
        self.assertFalse(model["actionOverrideAllowed"])
        self.assertGreater(conditional_action_probability(model, event("RAISE"), 3),
                           conditional_action_probability(model, event("RAISE"), 0))
        for bucket in (0, 3):
            self.assertAlmostEqual(sum(conditional_action_probability(model, event(action), bucket)
                                       for action in ("FOLD", "CALL", "RAISE")), 1)

    def test_fails_closed_on_private_fields_duplicates_and_too_few_sessions(self):
        row = {"sessionId": 1, "stateId": 0, "truthBucket": 0,
               "publicEvent": event("CALL")}
        with self.assertRaisesRegex(ValueError, "exact offline fields"):
            fit_conditional_action_model([{**row, "opponentCards": []}], min_sessions=1)
        with self.assertRaisesRegex(ValueError, "reuse a state"):
            fit_conditional_action_model([row, row], min_sessions=1)
        self.assertEqual(fit_conditional_action_model([row], min_sessions=2)["status"],
                         "INSUFFICIENT_SESSIONS")
        model = fit_conditional_action_model([row], min_sessions=1)
        with self.assertRaisesRegex(ValueError, "public legal context"):
            conditional_action_probability(model, {**event("CALL"), "legalActions": [0, 4]}, 0)
        with self.assertRaisesRegex(ValueError, "public action fields only"):
            conditional_action_probability(model, {**event("CALL"), "opponentCards": []}, 0)

    def test_fitted_likelihood_can_update_candidate_range_but_not_action_gate(self):
        rows = [{"sessionId": i, "stateId": 0, "truthBucket": i % 2 * 3,
                 "publicEvent": event("RAISE" if i % 2 == 0 else "FOLD")}
                for i in range(120)]
        model = fit_conditional_action_model(rows, min_sessions=100)
        args = {"actor_seen_cards": [(0, 0), (3, 1), (3, 2), (8, 3)],
                "public_events": [event("RAISE")], "target_seat": 1,
                "seed": 71, "particles": 512}
        base = estimate_public_range(**args)
        modeled = estimate_public_range(**args, action_model=model)
        self.assertLess(modeled.probabilities[3], base.probabilities[3])
        self.assertFalse(modeled.calibrated)
        self.assertFalse(model["actionOverrideAllowed"])


if __name__ == "__main__":
    unittest.main()
