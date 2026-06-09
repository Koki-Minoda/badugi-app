import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import torch

from rl.agents.dqn_agent import DQNAgent
from rl.training.audit_badugi_sixmax_opening_ranges import (
    BET,
    CALL,
    CHECK,
    FOLD,
    RAISE,
    aggression_hand_class,
    audit_checkpoint,
    bet_round_key,
    classify_opening_hand,
    main as audit_main,
    build_findings,
    facing_action_type,
    summarize_decisions,
    summarize_aggression_decisions,
    build_warnings,
    spot_type,
)


def _record(
    position: str,
    action: int,
    *,
    labels=None,
    premium=False,
    trash=False,
    spot="unopened",
    draw_round=0,
    to_call=0,
    aggression_hand_class=None,
    q_fold=0.0,
    q_call=1.0,
    q_raise=2.0,
    pot=12,
):
    labels = labels or ["3-card"]
    made_cards = 4 if "made_badugi" in labels else 3 if any("3card" in label or label == "3-card" for label in labels) else 2
    bet_round = f"round{draw_round}"
    return {
        "sampleIndex": 0,
        "position": position,
        "spotType": spot,
        "betRound": bet_round,
        "facingAction": "facing_bet" if to_call > 0 else "unopened",
        "aggressionHandClass": aggression_hand_class,
        "drawRound": draw_round,
        "pot": pot,
        "toCall": to_call,
        "selectedAction": action,
        "selectedActionName": {
            FOLD: "FOLD",
            CHECK: "CHECK",
            CALL: "CALL",
            BET: "BET",
            RAISE: "RAISE",
        }.get(action, str(action)),
        "qValues": {"FOLD": q_fold, "CALL": q_call, "RAISE": q_raise, "BET": q_raise, "CHECK": q_call},
        "selectedQ": float(action),
        "hand": {
            "cards": ["Ac", "2d", "3h", "4s"],
            "hand_class": aggression_hand_class or labels[0],
            "class_labels": labels,
            "made_cards": made_cards,
            "high_card_label": "4",
            "smoothness": 1.0,
            "roughness": 0.25,
            "paired_rank_count": 0,
            "duplicate_suit_count": 0,
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

    def test_aggression_hand_class_made_badugi(self):
        record = _record("BTN", CHECK, labels=["made_badugi"])

        self.assertEqual(aggression_hand_class(record), "made_badugi")

    def test_aggression_hand_class_strong_3card(self):
        record = _record("BTN", CHECK, labels=["3-card"])

        self.assertEqual(aggression_hand_class(record), "strong_3card")

    def test_aggression_hand_class_weak_3card(self):
        record = _record("BTN", CHECK, labels=["3-card", "weak_3card"])

        self.assertEqual(aggression_hand_class(record), "weak_3card")

    def test_aggression_hand_class_trash(self):
        record = _record("BTN", CHECK, labels=["1-card", "trash"], trash=True)

        self.assertEqual(aggression_hand_class(record), "trash")

    def test_bet_round_key_clamps_boundaries(self):
        self.assertEqual(bet_round_key(-1), "round0")
        self.assertEqual(bet_round_key(0), "round0")
        self.assertEqual(bet_round_key(2), "round2")
        self.assertEqual(bet_round_key(9), "round3")

    def test_facing_action_type_returns_correct_string(self):
        self.assertEqual(facing_action_type(to_call=0), "unopened")
        self.assertEqual(facing_action_type(to_call=1), "facing_bet")

    def test_aggression_summary_groups_by_bet_round(self):
        summary = summarize_aggression_decisions(
            [
                _record("CO", FOLD, draw_round=2, to_call=4, aggression_hand_class="strong_3card"),
                _record("BTN", CALL, draw_round=2, to_call=4, aggression_hand_class="weak_3card"),
                _record("BB", RAISE, draw_round=2, to_call=4, aggression_hand_class="made_badugi"),
                _record("BB", CHECK, draw_round=3, to_call=0, aggression_hand_class="made_badugi"),
            ]
        )

        round2 = summary["byBetRound"]["round2"]
        facing = summary["byBetRoundFacingAction"]["round2.facing_bet"]
        made_round3 = summary["byBetRoundAndHandClass"]["round3.made_badugi"]

        self.assertEqual(round2["samples"], 3)
        self.assertEqual(round2["foldPct"], 33.3333)
        self.assertEqual(round2["callPct"], 33.3333)
        self.assertEqual(round2["raisePct"], 33.3333)
        self.assertEqual(round2["vpipPct"], 66.6667)
        self.assertEqual(facing["samples"], 3)
        self.assertEqual(made_round3["samples"], 1)
        self.assertEqual(made_round3["callPct"], 100.0)

    def test_aggression_q_summary_averages_by_round_and_hand_class(self):
        summary = summarize_aggression_decisions(
            [
                _record(
                    "BTN",
                    RAISE,
                    draw_round=1,
                    labels=["3-card", "weak_3card"],
                    aggression_hand_class="weak_3card",
                    q_fold=-1.0,
                    q_call=0.5,
                    q_raise=3.0,
                ),
                _record(
                    "CO",
                    CALL,
                    draw_round=1,
                    labels=["3-card", "weak_3card"],
                    aggression_hand_class="weak_3card",
                    q_fold=1.0,
                    q_call=1.5,
                    q_raise=5.0,
                ),
                _record(
                    "SB",
                    BET,
                    draw_round=2,
                    labels=["1-card", "trash"],
                    trash=True,
                    aggression_hand_class="trash",
                    q_fold=2.0,
                    q_call=4.0,
                    q_raise=8.0,
                ),
            ]
        )

        weak3_q = summary["byBetRoundAndHandClassQ"]["round1.weak_3card"]
        trash_q = summary["byBetRoundAndHandClassQ"]["round2.trash"]

        self.assertEqual(weak3_q["samples"], 2)
        self.assertEqual(weak3_q["avgQFold"], 0.0)
        self.assertEqual(weak3_q["avgQCall"], 1.0)
        self.assertEqual(weak3_q["avgQRaise"], 4.0)
        self.assertEqual(trash_q["avgQFold"], 2.0)
        self.assertEqual(trash_q["avgQCall"], 4.0)
        self.assertEqual(trash_q["avgQRaise"], 8.0)

    def test_by_bet_round_hand_class_position_summary(self):
        summary = summarize_aggression_decisions(
            [
                _record("BTN", RAISE, draw_round=1, labels=["3-card", "weak_3card"], aggression_hand_class="weak_3card"),
                _record("BTN", CALL, draw_round=1, labels=["3-card", "weak_3card"], aggression_hand_class="weak_3card"),
                _record("CO", FOLD, draw_round=1, labels=["3-card", "weak_3card"], aggression_hand_class="weak_3card"),
                _record("SB", BET, draw_round=2, labels=["1-card", "trash"], trash=True, aggression_hand_class="trash"),
            ]
        )

        btn_bucket = summary["byBetRoundHandClassPosition"]["round1.weak_3card.BTN"]
        co_bucket = summary["byBetRoundHandClassPosition"]["round1.weak_3card.CO"]
        sb_trash_bucket = summary["byBetRoundHandClassPosition"]["round2.trash.SB"]

        self.assertEqual(btn_bucket["samples"], 2)
        self.assertEqual(btn_bucket["callPct"], 50.0)
        self.assertEqual(btn_bucket["raisePct"], 50.0)
        self.assertEqual(co_bucket["samples"], 1)
        self.assertEqual(co_bucket["foldPct"], 100.0)
        self.assertEqual(sb_trash_bucket["raisePct"], 100.0)

    def test_aggression_warnings_cover_late_round_overfold_and_underraise(self):
        def warnings_for(aggression_records):
            summary = summarize_decisions([_record("BTN", FOLD)])
            summary.update(summarize_aggression_decisions(aggression_records))
            return build_warnings(summary)

        under_sampled_strong_round2 = warnings_for(
            [
                _record("CO", FOLD, draw_round=2, to_call=4, aggression_hand_class="strong_3card")
                for _ in range(4)
            ]
        )
        under_sampled_made_round2 = warnings_for(
            [
                _record("CO", FOLD, draw_round=2, to_call=4, aggression_hand_class="made_badugi", labels=["made_badugi"])
                for _ in range(4)
            ]
        )
        under_sampled_made_round3 = warnings_for(
            [
                _record("CO", FOLD, draw_round=3, to_call=4, aggression_hand_class="made_badugi", labels=["made_badugi"])
                for _ in range(4)
            ]
        )

        self.assertFalse(any("round2_facing_bet_fold_rate > 75" in warning for warning in under_sampled_strong_round2))
        self.assertFalse(any("strong_3card_round2_fold_rate > 60" in warning for warning in under_sampled_strong_round2))
        self.assertFalse(any("made_badugi_round2_raise_rate < 20" in warning for warning in under_sampled_made_round2))
        self.assertFalse(any("round3_facing_bet_fold_rate > 70" in warning for warning in under_sampled_made_round3))
        self.assertFalse(any("made_badugi_round3_raise_rate < 25" in warning for warning in under_sampled_made_round3))

        warnings = warnings_for(
            [
                *[
                    _record("CO", FOLD, draw_round=2, to_call=4, aggression_hand_class="strong_3card")
                    for _ in range(5)
                ],
                *[
                    _record("CO", FOLD, draw_round=2, to_call=4, aggression_hand_class="made_badugi", labels=["made_badugi"])
                    for _ in range(5)
                ],
                *[
                    _record("CO", FOLD, draw_round=3, to_call=4, aggression_hand_class="made_badugi", labels=["made_badugi"])
                    for _ in range(5)
                ],
            ]
        )

        self.assertTrue(any("round2_facing_bet_fold_rate > 75" in warning for warning in warnings))
        self.assertTrue(any("round3_facing_bet_fold_rate > 70" in warning for warning in warnings))
        self.assertTrue(any("made_badugi_round2_raise_rate < 20" in warning for warning in warnings))
        self.assertTrue(any("made_badugi_round3_raise_rate < 25" in warning for warning in warnings))
        self.assertTrue(any("strong_3card_round2_fold_rate > 60" in warning for warning in warnings))

    def test_round1_trash_raise_rate_warning_requires_20_samples(self):
        def warnings_for(sample_count):
            summary = summarize_decisions([_record("BTN", FOLD)])
            summary.update(
                summarize_aggression_decisions(
                    [
                        _record(
                            "BTN",
                            BET,
                            draw_round=1,
                            labels=["1-card", "trash"],
                            trash=True,
                            aggression_hand_class="trash",
                        )
                        for _ in range(sample_count)
                    ]
                )
            )
            return build_warnings(summary)

        self.assertFalse(any("round1_trash_raise_rate > 50" in warning for warning in warnings_for(19)))
        self.assertTrue(any("round1_trash_raise_rate > 50" in warning for warning in warnings_for(20)))

    def test_round2_trash_raise_rate_warning_requires_20_samples(self):
        def warnings_for(sample_count):
            summary = summarize_decisions([_record("BTN", FOLD)])
            summary.update(
                summarize_aggression_decisions(
                    [
                        _record(
                            "CO",
                            RAISE,
                            draw_round=2,
                            labels=["1-card", "trash"],
                            trash=True,
                            aggression_hand_class="trash",
                        )
                        for _ in range(sample_count)
                    ]
                )
            )
            return build_warnings(summary)

        self.assertFalse(any("round2_trash_raise_rate > 40" in warning for warning in warnings_for(19)))
        self.assertTrue(any("round2_trash_raise_rate > 40" in warning for warning in warnings_for(20)))

    def test_aggression_findings_include_requested_top20_buckets(self):
        opening_records = [_record("BTN", FOLD)]
        aggression_records = [
            _record("CO", FOLD, draw_round=2, to_call=4, aggression_hand_class="strong_3card"),
            _record("BB", CHECK, draw_round=3, to_call=0, labels=["made_badugi"], aggression_hand_class="made_badugi"),
            _record("BB", CALL, draw_round=3, to_call=4, labels=["made_badugi"], aggression_hand_class="made_badugi"),
            _record("BB", FOLD, draw_round=3, to_call=4, aggression_hand_class="strong_3card"),
        ]

        findings = build_findings(opening_records, aggression_records)

        self.assertEqual(len(findings["round2_strong_hand_folded"]), 1)
        self.assertEqual(len(findings["round3_made_badugi_checked"]), 1)
        self.assertEqual(len(findings["round3_made_badugi_called_not_raised"]), 1)
        self.assertEqual(len(findings["round3_strong_3card_folded"]), 1)

    def test_weak_hand_raised_findings_include_q_and_context(self):
        opening_records = [_record("BTN", FOLD)]
        aggression_records = [
            _record(
                "BTN",
                BET,
                draw_round=1,
                labels=["1-card", "trash"],
                trash=True,
                aggression_hand_class="trash",
                q_fold=-1.0,
                q_call=0.0,
                q_raise=9.0,
                pot=44,
                to_call=0,
            ),
            _record("CO", RAISE, draw_round=2, labels=["1-card", "trash"], trash=True, aggression_hand_class="trash"),
            _record("SB", BET, draw_round=1, labels=["3-card", "weak_3card"], aggression_hand_class="weak_3card"),
            _record("BB", RAISE, draw_round=2, labels=["3-card", "weak_3card"], aggression_hand_class="weak_3card"),
        ]

        findings = build_findings(opening_records, aggression_records)
        round1_trash = findings["round1_trash_raised_top20"][0]

        self.assertEqual(len(findings["round1_trash_raised_top20"]), 1)
        self.assertEqual(len(findings["round2_trash_raised_top20"]), 1)
        self.assertEqual(len(findings["round1_weak3_raised_top20"]), 1)
        self.assertEqual(len(findings["round2_weak3_raised_top20"]), 1)
        self.assertEqual(round1_trash["round"], "round1")
        self.assertEqual(round1_trash["position"], "BTN")
        self.assertEqual(round1_trash["hand"], ["Ac", "2d", "3h", "4s"])
        self.assertEqual(round1_trash["handClass"], "trash")
        self.assertEqual(round1_trash["action"], "BET")
        self.assertEqual(round1_trash["qFold"], -1.0)
        self.assertEqual(round1_trash["qCall"], 0.0)
        self.assertEqual(round1_trash["qRaise"], 9.0)
        self.assertEqual(round1_trash["pot"], 44)
        self.assertEqual(round1_trash["toCall"], 0)

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
            self.assertGreaterEqual(report["betRoundSamplesCollected"], 2)
            self.assertIn("byBetRound", report["summary"])
            self.assertIn("round2.facing_bet", report["summary"]["byBetRoundFacingAction"])
            self.assertIn("round3.made_badugi", report["summary"]["byBetRoundAndHandClass"])
            self.assertIn("round1.weak_3card.BTN", report["summary"]["byBetRoundHandClassPosition"])
            self.assertIn("round1.weak_3card", report["summary"]["byBetRoundAndHandClassQ"])
            self.assertEqual(report["model"]["obsDim"], 96)

    def test_cli_progress_and_checkpoint_keep_stdout_json_compatible(self):
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

            stdout = io.StringIO()
            stderr = io.StringIO()
            with redirect_stdout(stdout), redirect_stderr(stderr):
                report = audit_main(
                    [
                        "--checkpoint",
                        str(checkpoint),
                        "--samples",
                        "1",
                        "--device",
                        "cpu",
                        "--output-json",
                        str(output_json),
                        "--progress-interval",
                        "1",
                        "--checkpoint-output-interval",
                        "1",
                    ]
                )

            stdout_payload = json.loads(stdout.getvalue())
            output_payload = json.loads(output_json.read_text(encoding="utf8"))

            self.assertEqual(stdout_payload["schemaVersion"], "badugi-sixmax-opening-range-audit-v2")
            self.assertEqual(stdout_payload["samplesCollected"], report["samplesCollected"])
            self.assertEqual(output_payload["samplesCollected"], report["samplesCollected"])
            self.assertIn("[progress]", stderr.getvalue())
            self.assertIn("%", stderr.getvalue())
            self.assertIn("eta=", stderr.getvalue())
            self.assertIn("[checkpoint]", stderr.getvalue())

    def test_partial_checkpoint_summary_omits_raw_decision_fields(self):
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

            report = audit_checkpoint(
                checkpoint=checkpoint,
                samples=1,
                device="cpu",
                output_json=output_json,
                progress_interval=0,
                checkpoint_output_interval=1,
                partial_output_mode="summary",
            )
            payload = json.loads(output_json.read_text(encoding="utf8"))
            serialized = json.dumps(payload)

            self.assertEqual(report["samplesCollected"], 1)
            self.assertTrue(payload["partial"])
            self.assertEqual(payload["partialOutputMode"], "summary")
            self.assertNotIn("decisions", payload)
            self.assertNotIn("betRoundDecisions", payload)
            self.assertNotIn("findings", payload)
            self.assertIn("byBetRoundAndHandClass", payload["summary"])
            self.assertIn("byBetRoundAndHandClassQ", payload["summary"])
            self.assertIn("omitted", payload)
            self.assertNotIn("legalActions", serialized)
            self.assertNotIn("qValues", serialized)


if __name__ == "__main__":
    unittest.main()
