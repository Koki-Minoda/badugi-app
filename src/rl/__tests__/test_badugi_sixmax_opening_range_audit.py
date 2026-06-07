import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import torch

from rl.agents.dqn_agent import DQNAgent
from rl.training.audit_badugi_sixmax_opening_ranges import (
    BET,
    CALL,
    CHECK,
    FOLD,
    classify_opening_hand,
    main as audit_main,
    summarize_decisions,
    build_warnings,
)


def _record(position: str, action: int, *, labels=None, premium=False, trash=False):
    labels = labels or ["3-card"]
    return {
        "position": position,
        "selectedAction": action,
        "selectedActionName": str(action),
        "qValues": {"FOLD": 0.0, "CALL": 1.0, "RAISE": 2.0},
        "hand": {
            "class_labels": labels,
            "is_premium": premium,
            "is_playable": not trash,
            "is_trash": trash,
        },
    }


class BadugiSixMaxOpeningRangeAuditTest(unittest.TestCase):
    def test_hand_classifier_identifies_made_badugi_three_card_and_trash(self):
        made = classify_opening_hand([(0, 0), (1, 1), (2, 2), (3, 3)])
        three_card = classify_opening_hand([(0, 0), (1, 1), (2, 2), (9, 2)])
        trash = classify_opening_hand([(12, 0), (12, 1), (12, 2), (12, 3)])

        self.assertEqual(made.hand_class, "made_badugi")
        self.assertIn("made_badugi", made.class_labels)
        self.assertIn("3-card", three_card.class_labels)
        self.assertEqual(three_card.made_cards, 3)
        self.assertTrue(trash.is_trash)
        self.assertIn("trash", trash.class_labels)

    def test_eight_high_three_card_is_weak_three_card(self):
        hand = classify_opening_hand([(0, 0), (2, 1), (7, 2), (11, 2)])

        self.assertEqual(hand.made_cards, 3)
        self.assertEqual(hand.high_card, 7)
        self.assertIn("weak_3card", hand.class_labels)
        self.assertEqual(hand.hand_class, "weak_3card")

    def test_two_card_hand_classification(self):
        hand = classify_opening_hand([(0, 0), (1, 1), (11, 0), (12, 1)])

        self.assertEqual(hand.made_cards, 2)
        self.assertIn("2-card", hand.class_labels)
        self.assertEqual(hand.hand_class, "2-card")

    def test_summary_calculates_position_vpip(self):
        summary = summarize_decisions(
            [
                _record("UTG", FOLD),
                _record("UTG", CALL),
                _record("BTN", BET),
            ]
        )

        self.assertEqual(summary["byPosition"]["UTG"]["samples"], 2)
        self.assertEqual(summary["byPosition"]["UTG"]["vpipPct"], 50.0)
        self.assertEqual(summary["byPosition"]["BTN"]["vpipPct"], 100.0)

    def test_check_is_not_vpip_and_has_separate_check_pct(self):
        summary = summarize_decisions(
            [
                _record("BB", CHECK),
                _record("BB", CALL),
            ]
        )

        self.assertEqual(summary["byPosition"]["BB"]["vpipPct"], 50.0)
        self.assertEqual(summary["byPosition"]["BB"]["checkPct"], 50.0)
        self.assertEqual(summary["byPosition"]["BB"]["callCheckPct"], 100.0)

    def test_warning_for_overall_vpip_above_40(self):
        summary = summarize_decisions(
            [
                _record("UTG", CALL),
                _record("CO", FOLD),
                _record("BTN", CALL),
            ]
        )

        warnings = build_warnings(summary)

        self.assertTrue(any("overall_vpip > 40" in warning for warning in warnings))

    def test_warning_for_btn_vpip_below_utg_vpip(self):
        summary = summarize_decisions(
            [
                _record("UTG", CALL),
                _record("BTN", FOLD),
            ]
        )

        warnings = build_warnings(summary)

        self.assertTrue(any("BTN_vpip < UTG_vpip" in warning for warning in warnings))

    def test_cli_smoke_runs_small_sample(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            checkpoint = root / "tiny_badugi_sixmax.pt"
            output_json = root / "audit.json"
            agent = DQNAgent(obs_dim=96, n_actions=6, hidden_dim=16, device="cpu")
            with torch.no_grad():
                for param in agent.q_network.parameters():
                    param.zero_()
                agent.q_network.net[-1].bias.copy_(torch.tensor([0.0, 8.0, 10.0, 9.0, 7.0, 6.0]))
                agent.target_network.load_state_dict(agent.q_network.state_dict())
            agent.save(str(checkpoint))

            with open(root / "stdout.txt", "w", encoding="utf8") as stdout_file:
                with redirect_stdout(stdout_file):
                    report = audit_main(
                        [
                            "--checkpoint",
                            str(checkpoint),
                            "--samples",
                            "2",
                            "--device",
                            "cpu",
                            "--output-json",
                            str(output_json),
                        ]
                    )

            self.assertTrue(output_json.exists())
            self.assertEqual(report["samplesCollected"], 2)
            self.assertEqual(report["model"]["obsDim"], 96)


if __name__ == "__main__":
    unittest.main()
