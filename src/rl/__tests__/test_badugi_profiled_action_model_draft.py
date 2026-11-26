"""Offline labels, online public history, and no-action-override contracts."""
import unittest

from rl.training.badugi_profiled_action_model_draft import (
    STYLES, fit_profiled_action_model, profiled_action_probability,
    public_profile_probabilities,
)
from rl.training.badugi_public_range_belief_draft import estimate_public_range


def event(action):
    return {"type": "BET_ACTION", "seat": 1, "action": action,
            "amountBb": 0 if action in ("FOLD", "CHECK") else 1,
            "drawRoundIndex": 0, "legalActions": [0, 2, 4],
            "toCallBb": 1, "potBb": 4, "activePlayers": 3}


def history(fold, call, raise_count):
    return {'handsObserved': 20, 'fold': fold, 'check': 0, 'call': call,
            'bet': 0, 'raise': raise_count,
            'raiseAmountBbSum': raise_count,
            'drawCounts': [0, 0, 0, 0, 0],
            'facedBetOpportunities': fold + call + raise_count,
            'foldedFacingBet': fold, 'calledFacingBet': call,
            'raisedFacingBet': raise_count,
            'freeBetOpportunities': 0, 'betWhenFree': 0}


def training_rows():
    rows = []
    for style_index, style in enumerate(STYLES):
        for sample in range(100):
            action = 'FOLD' if style_index == 0 else 'RAISE' if style_index == 3 else 'CALL'
            rows.append({'sessionId': style_index * 1000 + sample,
                         'stateId': 0, 'truthBucket': sample % 4,
                         'publicEvent': event(action), 'profile': style})
    return rows


class ProfiledActionModelTests(unittest.TestCase):
    def test_history_changes_profile_mixture_using_public_counts(self):
        model = fit_profiled_action_model(training_rows())
        self.assertEqual(model['status'], 'DEVELOPMENT_FIT_ONLY')
        self.assertFalse(model['actionOverrideAllowed'])
        folded = public_profile_probabilities(model, history(20, 0, 0))
        raised = public_profile_probabilities(model, history(0, 0, 20))
        self.assertGreater(folded[0], raised[0])
        self.assertGreater(raised[3], folded[3])
        self.assertAlmostEqual(sum(folded), 1)
        self.assertAlmostEqual(sum(raised), 1)
        self.assertNotEqual(profiled_action_probability(model, event('RAISE'), 2,
                                                         history(20, 0, 0)),
                            profiled_action_probability(model, event('RAISE'), 2,
                                                         history(0, 0, 20)))

    def test_rejects_offline_label_at_inference_and_duplicate_fit_state(self):
        rows = training_rows()
        with self.assertRaisesRegex(ValueError, 'exact offline fields'):
            fit_profiled_action_model([{**rows[0], 'opponentCards': []}])
        with self.assertRaisesRegex(ValueError, 'reuse a state'):
            fit_profiled_action_model(rows + [rows[0]])
        model = fit_profiled_action_model(rows)
        with self.assertRaisesRegex(ValueError, 'exact public-history'):
            public_profile_probabilities(model, {**history(2, 2, 0),
                                                  'privateCards': []})

    def test_posterior_stays_uncalibrated_and_model_choice_is_exclusive(self):
        model = fit_profiled_action_model(training_rows())
        args = {'actor_seen_cards': [(0, 0), (3, 1), (3, 2), (8, 3)],
                'public_events': [event('RAISE')], 'target_seat': 1,
                'seed': 71, 'particles': 256}
        posterior = estimate_public_range(**args, profiled_action_model=model,
                                          opponent_public_history=history(0, 0, 20))
        self.assertFalse(posterior.calibrated)
        self.assertAlmostEqual(sum(posterior.probabilities), 1)
        with self.assertRaisesRegex(ValueError, 'choose one candidate'):
            estimate_public_range(**args, action_model={},
                                  profiled_action_model=model)


if __name__ == '__main__':
    unittest.main()
