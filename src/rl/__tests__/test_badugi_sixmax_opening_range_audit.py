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
    spot_type,
)


def _record(position: str, action: int, *, labels=None, premium=False, trash=False, spot="unopened"):
    labels = labels or ["3-card"]
    return {
        "position": position,
        "spotType": spot,
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

    def test_weak_two_card_hand_adds_weak_two_card_label(self):
        hand = classify_opening_hand([(0, 0), (8, 1), (12, 0), (12, 1)])

        self.assertEqual(hand.made_cards, 2)
        self.assertIn("2-card", hand.class_labels)
        self.assertIn("weak_2card", hand.class_labels)
        self.assertIn("trash", hand.class_labels)
        self.assertTrue(hand.is_trash)

    def test_spot_type_classification_matches_blind_and_open_thresholds(self):
        self.assertEqual(spot_type(position="UTG", current_bet=2, to_call=2), "unopened")
        self.assertEqual(spot_type(position="CO", current_bet=4, to_call=4), "facing_open")
        self.assertEqual(spot_type(position="CO", current_bet=2, to_call=3), "facing_open")
        self.assertEqual(spot_type(position="SB", current_bet=2, to_call=1), "sb_completion")
        self.assertEqual(spot_type(position="BB", current_bet=2, to_call=0), "bb_option")

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

    def test_unopened_record_does_not_count_as_facing_open(self):
        summary = summarize_decisions(
            [
                _record("UTG", CALL, spot="unopened"),
                _record("CO", CALL, spot="facing_open"),
            ]
        )

        self.assertEqual(summary["bySpot"]["unopened"]["samples"], 1)
        self.assertEqual(summary["bySpot"]["facing_open"]["samples"], 1)

    def test_by_spot_summary_calculates_vpip_pfr_and_fold(self):
        summary = summarize_decisions(
            [
                _record("CO", FOLD, spot="facing_open"),
                _record("BTN", CALL, spot="facing_open"),
                _record("BB", BET, spot="facing_open"),
            ]
        )

        facing_open = summary["bySpot"]["facing_open"]

        self.assertEqual(facing_open["samples"], 3)
        self.assertEqual(facing_open["vpipPct"], 66.6667)
        self.assertEqual(facing_open["pfrPct"], 33.3333)
        self.assertEqual(facing_open["foldPct"], 33.3333)
        self.assertEqual(facing_open["callCheckPct"], 33.3333)
        self.assertEqual(facing_open["raiseBetPct"], 33.3333)

    def test_position_and_hand_class_spot_summaries_are_available(self):
        summary = summarize_decisions(
            [
                _record(
                    "CO",
                    CALL,
                    labels=["2-card", "weak_2card", "trash"],
                    trash=True,
                    spot="facing_open",
                ),
                _record("UTG", FOLD, labels=["3-card", "weak_3card"], spot="unopened"),
            ]
        )

        self.assertEqual(summary["byPositionAndSpot"]["CO.facing_open"]["vpipPct"], 100.0)
        self.assertEqual(summary["byPositionAndSpot"]["UTG.unopened"]["foldPct"], 100.0)
        self.assertEqual(summary["byHandClassAndSpot"]["weak_2card.facing_open"]["vpipPct"], 100.0)
        self.assertEqual(summary["byHandClassAndSpot"]["weak_3card.unopened"]["foldPct"], 100.0)
        self.assertEqual(summary["byPositionSpotAndHandClass"]["CO.facing_open.weak_2card"]["vpipPct"], 100.0)
        self.assertEqual(summary["byPositionSpotAndHandClass"]["UTG.unopened.weak_3card"]["foldPct"], 100.0)

    def test_position_and_spot_summary_has_expected_keys(self):
        summary = summarize_decisions([])

        expected = [
            "UTG.unopened",
            "MP.unopened",
            "CO.unopened",
            "CO.facing_open",
            "BTN.unopened",
            "BTN.facing_open",
            "SB.sb_completion",
            "SB.facing_open",
            "BB.bb_option",
            "BB.facing_open",
        ]

        for key in expected:
            self.assertIn(key, summary["byPositionAndSpot"])

    def test_position_spot_and_hand_class_calculates_trash_facing_open_play_rate(self):
        summary = summarize_decisions(
            [
                _record("CO", CALL, labels=["2-card", "weak_2card", "trash"], trash=True, spot="facing_open"),
                _record("CO", FOLD, labels=["1-card", "trash"], trash=True, spot="facing_open"),
            ]
        )

        trash_bucket = summary["byPositionSpotAndHandClass"]["CO.facing_open.trash"]

        self.assertEqual(trash_bucket["samples"], 2)
        self.assertEqual(trash_bucket["vpipPct"], 50.0)
        self.assertEqual(trash_bucket["foldPct"], 50.0)

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

    def test_warning_for_co_facing_open_trash_play_rate(self):
        summary = summarize_decisions(
            [
                _record(
                    "CO",
                    CALL,
                    labels=["2-card", "weak_2card", "trash"],
                    trash=True,
                    spot="facing_open",
                ),
                _record(
                    "BTN",
                    FOLD,
                    labels=["2-card", "weak_2card", "trash"],
                    trash=True,
                    spot="facing_open",
                ),
            ]
        )

        warnings = build_warnings(summary)

        self.assertTrue(any("CO_facing_open_trash_play_rate > 10" in warning for warning in warnings))

    def test_warning_for_bb_facing_open_trash_play_rate_threshold(self):
        summary = summarize_decisions(
            [
                _record("BB", CALL, labels=["1-card", "trash"], trash=True, spot="facing_open"),
                _record("BB", FOLD, labels=["1-card", "trash"], trash=True, spot="facing_open"),
                _record("BB", FOLD, labels=["1-card", "trash"], trash=True, spot="facing_open"),
            ]
        )

        warnings = build_warnings(summary)

        self.assertTrue(any("BB_facing_open_trash_play_rate > 25" in warning for warning in warnings))

    def test_warning_for_facing_open_weak_2card_play_rate(self):
        summary = summarize_decisions(
            [
                _record(
                    "CO",
                    CALL,
                    labels=["2-card", "weak_2card", "trash"],
                    trash=True,
                    spot="facing_open",
                ),
                _record(
                    "BTN",
                    FOLD,
                    labels=["2-card", "weak_2card", "trash"],
                    trash=True,
                    spot="facing_open",
                ),
            ]
        )

        warnings = build_warnings(summary)

        self.assertTrue(any("facing_open_weak_2card_play_rate > 20" in warning for warning in warnings))

    def test_sb_completion_does_not_fire_facing_open_warnings(self):
        summary = summarize_decisions(
            [
                _record(
                    "SB",
                    CALL,
                    labels=["2-card", "weak_2card", "trash"],
                    trash=True,
                    spot="sb_completion",
                )
            ]
        )

        warnings = build_warnings(summary)

        self.assertFalse(any("facing_open" in warning for warning in warnings))

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
