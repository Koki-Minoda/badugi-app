"""The direct range feature boundary excludes offline target hand/profile labels."""
import unittest

from rl.training.badugi_direct_range_features_draft import public_range_features


def evidence():
    return {"baseProbabilities": [0.2, 0.6, 0.15, 0.05],
            "profiledProbabilities": [0.15, 0.6, 0.2, 0.05],
            "estimatedProfileProbabilities": [0.4, 0.3, 0.2, 0.1],
            "group": 0, "street": 0, "activePlayers": 2,
            "priceToCallBb": 1, "heroMade": 3,
            "actorSeenCards": [[0, 0], [3, 1], [5, 2], [8, 3]],
            "publicActions": [{"type": "BET_ACTION", "seat": 1,
                "action": "CALL", "amountBb": 1, "drawRoundIndex": 0,
                "legalActions": [0, 2, 4], "toCallBb": 1,
                "potBb": 4, "activePlayers": 2}],
            "targetSeat": 1,
            "opponentPublicHistory": {'handsObserved': 2, 'fold': 1,
                'check': 0, 'call': 2, 'bet': 0, 'raise': 0,
                'raiseAmountBbSum': 0, 'drawCounts': [0, 0, 0, 0, 0],
                'facedBetOpportunities': 3, 'foldedFacingBet': 1,
                'calledFacingBet': 2, 'raisedFacingBet': 0,
                'freeBetOpportunities': 0, 'betWhenFree': 0}}


class DirectRangeFeatureTests(unittest.TestCase):
    def test_actor_public_features_are_deterministic(self):
        first = public_range_features(evidence())
        self.assertEqual(first, public_range_features(evidence()))
        self.assertGreater(len(first), 30)
        self.assertEqual(first[0], 0.2)

    def test_offline_target_fields_are_rejected(self):
        for key in ('truthBucket', 'profile', 'opponentCards'):
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'public-only'):
                public_range_features({**evidence(), key: 0})

    def test_unrecorded_legal_menu_and_private_event_are_rejected(self):
        data = evidence()
        data['publicActions'] = [{key: value for key, value in data['publicActions'][0].items()
                                  if key != 'legalActions'}]
        with self.assertRaisesRegex(ValueError, 'public legal context'):
            public_range_features(data)
        data = evidence()
        data['publicActions'][0]['privateCards'] = []
        with self.assertRaisesRegex(ValueError, 'public action fields only'):
            public_range_features(data)


if __name__ == '__main__':
    unittest.main()
