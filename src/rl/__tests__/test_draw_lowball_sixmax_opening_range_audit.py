"""Tests for audit_draw_lowball_sixmax_opening_ranges.

Covers:
- Unit helpers: card_label, action_bucket, spot_type, bet_round_key, facing_action_type
- summarize_opening_decisions: position/spot/hand-class breakdowns, rates
- summarize_bet_decisions: by-round, facing-action, hand-class buckets
- summarize_draw_decisions: accuracy, pat rate, made-hand non-pat rate
- build_warnings: threshold checks for opening, aggression, draw quality
- build_findings: top-N anomaly lists
- audit_checkpoint smoke test: runs a tiny random model for 4 episodes without crashing
"""

from __future__ import annotations

import unittest

import numpy as np
import torch

from rl.env.draw_lowball_env_sixmax_selfplay import (
    BET,
    CALL,
    CHECK,
    DRAW_0,
    FOLD,
    RAISE,
)
from rl.training.audit_draw_lowball_sixmax_opening_ranges import (
    ACTION_NAMES,
    VARIANT_CONFIGS,
    action_bucket,
    bet_round_key,
    build_findings,
    build_warnings,
    card_label,
    facing_action_type,
    is_pfr_action,
    is_vpip_action,
    make_bet_decision_record,
    make_draw_decision_record,
    spot_type,
    summarize_bet_decisions,
    summarize_draw_decisions,
    summarize_opening_decisions,
    audit_checkpoint,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _bet_record(
    position: str = "BTN",
    action: int = CHECK,
    *,
    hand_class: str = "strong_draw",
    is_made: bool = False,
    is_premium: bool = False,
    is_trash: bool = False,
    spot: str = "unopened",
    draw_round: int = 0,
    to_call: int = 0,
    q_fold: float = 0.0,
    q_call: float = 1.0,
    q_raise: float = 2.0,
) -> dict:
    action_name = ACTION_NAMES.get(action, str(action))
    bucket = action_bucket(action)
    return {
        "sampleIndex": 0,
        "betDecisionIndex": 0,
        "position": position,
        "spotType": spot,
        "betRound": f"round{draw_round}",
        "facingAction": "facing_bet" if to_call > 0 else "unopened",
        "handClass": hand_class,
        "heroSeat": 0,
        "dealerSeat": 0,
        "drawRound": draw_round,
        "phase": "BET",
        "pot": 12,
        "currentBet": to_call,
        "heroBet": 0,
        "toCall": to_call,
        "legalActions": [],
        "selectedAction": action,
        "selectedActionName": action_name,
        "selectedActionBucket": bucket,
        "qValues": {"FOLD": q_fold, "CHECK": q_call, "CALL": q_call, "BET": q_raise, "RAISE": q_raise},
        "selectedQ": float(action),
        "bestLegalQ": float(action),
        "legalQMargin": 0.0,
        "hand": {
            "cards": ["7c", "5d", "4h", "3s", "2c"],
            "hand_class": hand_class,
            "draw_strength": 0.9,
            "highest_rank": 7,
            "duplicate_ranks": 0,
            "is_made": is_made,
            "is_premium": is_premium,
            "is_playable": not is_trash,
            "is_trash": is_trash,
            "recommended_draw_count": 0,
        },
        "vpip": is_vpip_action(action),
        "pfr": is_pfr_action(action),
    }


def _draw_record(
    position: str = "BTN",
    draw_count: int = 1,
    ideal_count: int = 1,
    *,
    hand_class: str = "strong_draw",
    is_made: bool = False,
    draw_round: int = 1,
) -> dict:
    action = DRAW_0 + draw_count
    return {
        "sampleIndex": 0,
        "position": position,
        "betRound": f"round{draw_round}",
        "drawRound": draw_round,
        "handClass": hand_class,
        "hand": {
            "cards": ["7c", "5d", "4h", "3s", "2c"],
            "hand_class": hand_class,
            "draw_strength": 0.9,
            "highest_rank": 7,
            "duplicate_ranks": 0,
            "is_made": is_made,
            "is_premium": is_made,
            "is_playable": True,
            "is_trash": False,
            "recommended_draw_count": ideal_count,
        },
        "selectedAction": action,
        "drawCount": draw_count,
        "idealDrawCount": ideal_count,
        "drawAccurate": draw_count == ideal_count,
        "qValues": {f"DRAW_{i}": float(i) for i in range(6)},
        "selectedQ": float(draw_count),
    }


# ---------------------------------------------------------------------------
# Unit helpers
# ---------------------------------------------------------------------------

class CardLabelTest(unittest.TestCase):

    def test_rank_2_clubs(self):
        self.assertEqual(card_label((2, 0)), "2c")

    def test_rank_14_ace_spades(self):
        self.assertEqual(card_label((14, 3)), "As")

    def test_king_hearts(self):
        self.assertEqual(card_label((13, 2)), "Kh")

    def test_ten_diamonds(self):
        self.assertEqual(card_label((10, 1)), "Td")


class ActionBucketTest(unittest.TestCase):

    def test_fold(self):
        self.assertEqual(action_bucket(FOLD), "fold")

    def test_check_and_call(self):
        self.assertEqual(action_bucket(CHECK), "call_check")
        self.assertEqual(action_bucket(CALL), "call_check")

    def test_bet_and_raise(self):
        self.assertEqual(action_bucket(BET), "raise_bet")
        self.assertEqual(action_bucket(RAISE), "raise_bet")

    def test_draw_actions_are_other(self):
        self.assertEqual(action_bucket(DRAW_0), "other")
        self.assertEqual(action_bucket(DRAW_0 + 3), "other")


class SpotTypeTest(unittest.TestCase):

    def test_unopened(self):
        self.assertEqual(spot_type(position="BTN", current_bet=2, to_call=0), "unopened")

    def test_facing_open_above_bb(self):
        self.assertEqual(spot_type(position="CO", current_bet=6, to_call=4), "facing_open")

    def test_sb_completion(self):
        self.assertEqual(spot_type(position="SB", current_bet=2, to_call=1), "sb_completion")

    def test_bb_option(self):
        self.assertEqual(spot_type(position="BB", current_bet=2, to_call=0), "bb_option")


class BetRoundKeyTest(unittest.TestCase):

    def test_round0(self):
        self.assertEqual(bet_round_key(0), "round0")

    def test_round3(self):
        self.assertEqual(bet_round_key(3), "round3")

    def test_negative_clamped(self):
        self.assertEqual(bet_round_key(-1), "round0")


class FacingActionTypeTest(unittest.TestCase):

    def test_facing_bet(self):
        self.assertEqual(facing_action_type(to_call=4), "facing_bet")

    def test_unopened(self):
        self.assertEqual(facing_action_type(to_call=0), "unopened")


# ---------------------------------------------------------------------------
# summarize_opening_decisions
# ---------------------------------------------------------------------------

class SummarizeOpeningDecisionsTest(unittest.TestCase):

    def _make_records(self):
        return [
            _bet_record("BTN", BET,    hand_class="made_low_premium", is_made=True, is_premium=True),
            _bet_record("BTN", CHECK,  hand_class="strong_draw"),
            _bet_record("UTG", FOLD,   hand_class="trash", is_trash=True),
            _bet_record("UTG", CALL,   hand_class="trash", is_trash=True, to_call=2),
            _bet_record("CO",  BET,    hand_class="moderate_draw"),
            _bet_record("SB",  FOLD,   hand_class="made_low_premium", is_made=True, is_premium=True),
        ]

    def test_overall_vpip_reflects_aggressive_actions(self):
        recs = self._make_records()
        summary = summarize_opening_decisions(recs)
        overall = summary["overall"]
        self.assertGreater(overall["vpipPct"], 0.0)
        self.assertLessEqual(overall["vpipPct"], 100.0)

    def test_by_position_has_all_positions(self):
        recs = self._make_records()
        summary = summarize_opening_decisions(recs)
        from rl.training.audit_draw_lowball_sixmax_opening_ranges import POSITION_ORDER
        for pos in POSITION_ORDER:
            self.assertIn(pos, summary["byPosition"])

    def test_trash_play_rate_nonzero_when_trash_played(self):
        recs = self._make_records()
        summary = summarize_opening_decisions(recs)
        self.assertGreater(summary["rates"]["trashPlayRate"], 0.0)

    def test_premium_fold_rate_nonzero(self):
        recs = self._make_records()
        summary = summarize_opening_decisions(recs)
        self.assertGreater(summary["rates"]["premiumFoldRate"], 0.0)

    def test_empty_records_produce_zero_rates(self):
        summary = summarize_opening_decisions([])
        self.assertEqual(summary["overall"]["samples"], 0)
        self.assertEqual(summary["rates"]["trashPlayRate"], 0.0)

    def test_by_hand_class_covers_all_classes(self):
        from rl.training.audit_draw_lowball_sixmax_opening_ranges import HAND_CLASS_ORDER
        recs = self._make_records()
        summary = summarize_opening_decisions(recs)
        for hc in HAND_CLASS_ORDER:
            self.assertIn(hc, summary["byHandClass"])


# ---------------------------------------------------------------------------
# summarize_bet_decisions
# ---------------------------------------------------------------------------

class SummarizeBetDecisionsTest(unittest.TestCase):

    def test_by_bet_round_has_all_rounds_td(self):
        recs = [
            _bet_record("BTN", BET, draw_round=0),
            _bet_record("BTN", CHECK, draw_round=1),
            _bet_record("CO", CALL, draw_round=2, to_call=2),
            _bet_record("UTG", FOLD, draw_round=3),
        ]
        summary = summarize_bet_decisions(recs, max_draws=3)
        for rk in ("round0", "round1", "round2", "round3"):
            self.assertIn(rk, summary["byBetRound"])

    def test_by_bet_round_has_correct_rounds_sd(self):
        recs = [
            _bet_record("BTN", BET, draw_round=0),
            _bet_record("BTN", CHECK, draw_round=1),
        ]
        summary = summarize_bet_decisions(recs, max_draws=1)
        self.assertIn("round0", summary["byBetRound"])
        self.assertIn("round1", summary["byBetRound"])
        self.assertNotIn("round2", summary["byBetRound"])

    def test_facing_action_buckets_present(self):
        recs = [
            _bet_record("BTN", CALL, draw_round=0, to_call=4),
            _bet_record("BTN", CHECK, draw_round=0),
        ]
        summary = summarize_bet_decisions(recs, max_draws=3)
        self.assertIn("round0.facing_bet", summary["byBetRoundFacingAction"])
        self.assertIn("round0.unopened", summary["byBetRoundFacingAction"])

    def test_by_bet_round_and_hand_class_cross(self):
        from rl.training.audit_draw_lowball_sixmax_opening_ranges import HAND_CLASS_ORDER
        recs = [_bet_record("BTN", BET, draw_round=0, hand_class="made_low_premium")]
        summary = summarize_bet_decisions(recs, max_draws=3)
        for hc in HAND_CLASS_ORDER:
            self.assertIn(f"round0.{hc}", summary["byBetRoundAndHandClass"])


# ---------------------------------------------------------------------------
# summarize_draw_decisions
# ---------------------------------------------------------------------------

class SummarizeDrawDecisionsTest(unittest.TestCase):

    def test_accuracy_rate_100_when_all_accurate(self):
        recs = [_draw_record(draw_count=1, ideal_count=1) for _ in range(5)]
        summary = summarize_draw_decisions(recs, max_draws=3)
        self.assertAlmostEqual(summary["overall"]["accuracyRate"], 100.0)

    def test_accuracy_rate_0_when_all_wrong(self):
        recs = [_draw_record(draw_count=0, ideal_count=2) for _ in range(5)]
        summary = summarize_draw_decisions(recs, max_draws=3)
        self.assertAlmostEqual(summary["overall"]["accuracyRate"], 0.0)

    def test_pat_rate_100_when_all_pat(self):
        recs = [_draw_record(draw_count=0, ideal_count=0, is_made=True, hand_class="made_low_premium") for _ in range(4)]
        summary = summarize_draw_decisions(recs, max_draws=3)
        self.assertAlmostEqual(summary["overall"]["patRate"], 100.0)

    def test_made_hand_non_pat_rate(self):
        # 2 made hands drawing, 3 made hands patting
        recs = (
            [_draw_record(draw_count=1, ideal_count=0, is_made=True, hand_class="made_low_premium")] * 2
            + [_draw_record(draw_count=0, ideal_count=0, is_made=True, hand_class="made_low_premium")] * 3
        )
        summary = summarize_draw_decisions(recs, max_draws=3)
        self.assertAlmostEqual(summary["rates"]["madeHandNonPatRate"], 40.0)

    def test_by_draw_round_keys_for_td(self):
        recs = [_draw_record(draw_round=0), _draw_record(draw_round=1), _draw_record(draw_round=2)]
        summary = summarize_draw_decisions(recs, max_draws=3)
        for rk in ("round0", "round1", "round2"):
            self.assertIn(rk, summary["byDrawRound"])
        self.assertNotIn("round3", summary["byDrawRound"])

    def test_empty_records(self):
        summary = summarize_draw_decisions([], max_draws=3)
        self.assertEqual(summary["overall"]["samples"], 0)


# ---------------------------------------------------------------------------
# build_warnings
# ---------------------------------------------------------------------------

class BuildWarningsTest(unittest.TestCase):

    def _make_clean_summary(self, max_draws: int = 3) -> dict:
        """Summary that should produce zero warnings."""
        rounds = [f"round{i}" for i in range(max_draws + 1)]
        from rl.training.audit_draw_lowball_sixmax_opening_ranges import HAND_CLASS_ORDER, POSITION_ORDER, FACING_ACTION_ORDER
        return {
            "opening": {
                "overall": {"vpipPct": 40.0, "samples": 100},
                "byPosition": {p: {"vpipPct": 35.0, "samples": 10} for p in POSITION_ORDER},
                "byPositionAndSpot": {},
                "byPositionSpotAndHandClass": {},
                "rates": {"trashPlayRate": 5.0, "premiumFoldRate": 2.0},
            },
            "bet": {
                "byBetRound": {rk: {"vpipPct": 35.0, "samples": 50} for rk in rounds},
                "byBetRoundFacingAction": {
                    f"{rk}.{fa}": {"foldPct": 30.0, "raiseBetPct": 40.0, "samples": 20}
                    for rk in rounds for fa in FACING_ACTION_ORDER
                },
                "byBetRoundAndHandClass": {
                    f"{rk}.{hc}": {"raiseBetPct": 40.0, "foldPct": 20.0, "samples": 10}
                    for rk in rounds for hc in HAND_CLASS_ORDER
                },
                "byBetRoundHandClassPosition": {},
            },
            "draw": {
                "overall": {"accuracyRate": 85.0, "patRate": 60.0, "samples": 50},
                "rates": {"madeHandNonPatRate": 2.0},
                "byDrawRound": {},
                "byHandClass": {},
                "byDrawRoundAndHandClass": {},
            },
        }

    def test_no_warnings_for_clean_summary(self):
        summary = self._make_clean_summary()
        warnings = build_warnings(summary, variant_id="D01", max_draws=3)
        self.assertEqual(warnings, [], f"Expected no warnings, got: {warnings}")

    def test_high_overall_vpip_triggers_warning(self):
        summary = self._make_clean_summary()
        summary["opening"]["overall"]["vpipPct"] = 60.0
        warnings = build_warnings(summary, variant_id="D01", max_draws=3)
        self.assertTrue(any("overall_opening_vpip" in w for w in warnings), warnings)

    def test_high_utg_vpip_triggers_warning(self):
        summary = self._make_clean_summary()
        summary["opening"]["byPosition"]["UTG"]["vpipPct"] = 45.0
        warnings = build_warnings(summary, variant_id="D01", max_draws=3)
        self.assertTrue(any("UTG_opening_vpip" in w for w in warnings), warnings)

    def test_high_trash_play_triggers_warning(self):
        summary = self._make_clean_summary()
        summary["opening"]["rates"]["trashPlayRate"] = 20.0
        warnings = build_warnings(summary, variant_id="D01", max_draws=3)
        self.assertTrue(any("trash_play_rate" in w for w in warnings), warnings)

    def test_high_premium_fold_triggers_warning(self):
        summary = self._make_clean_summary()
        summary["opening"]["rates"]["premiumFoldRate"] = 10.0
        warnings = build_warnings(summary, variant_id="D01", max_draws=3)
        self.assertTrue(any("premium_fold_rate" in w for w in warnings), warnings)

    def test_made_hand_low_raise_on_final_triggers_warning(self):
        summary = self._make_clean_summary(max_draws=3)
        summary["bet"]["byBetRoundAndHandClass"]["round3.made_low_premium"] = {
            "raiseBetPct": 5.0, "samples": 20
        }
        warnings = build_warnings(summary, variant_id="D01", max_draws=3)
        self.assertTrue(
            any("made_low_premium" in w and "round3" in w for w in warnings), warnings
        )

    def test_low_draw_accuracy_triggers_warning(self):
        summary = self._make_clean_summary()
        summary["draw"]["overall"]["accuracyRate"] = 50.0
        summary["draw"]["overall"]["samples"] = 100
        warnings = build_warnings(summary, variant_id="D01", max_draws=3)
        self.assertTrue(any("draw_accuracy_rate" in w for w in warnings), warnings)

    def test_made_hand_non_pat_triggers_warning(self):
        summary = self._make_clean_summary()
        summary["draw"]["rates"]["madeHandNonPatRate"] = 10.0
        warnings = build_warnings(summary, variant_id="D01", max_draws=3)
        self.assertTrue(any("made_hand_non_pat_rate" in w for w in warnings), warnings)

    def test_sd_high_vpip_triggers_warning(self):
        summary = self._make_clean_summary(max_draws=1)
        summary["bet"]["byBetRound"]["round0"]["vpipPct"] = 65.0
        summary["bet"]["byBetRound"]["round0"]["samples"] = 50
        warnings = build_warnings(summary, variant_id="S01", max_draws=1)
        self.assertTrue(any("SD_round0_vpip" in w for w in warnings), warnings)


# ---------------------------------------------------------------------------
# build_findings
# ---------------------------------------------------------------------------

class BuildFindingsTest(unittest.TestCase):

    def test_findings_has_all_keys(self):
        findings = build_findings([], [], [], max_draws=3)
        self.assertIn("trashPlayedTop20", findings)
        self.assertIn("premiumFoldedTop20", findings)
        self.assertIn("drawInaccurateTop20", findings)
        self.assertIn("madeHandNonPatTop20", findings)

    def test_trash_played_captured(self):
        recs = [
            _bet_record("BTN", BET, hand_class="trash", is_trash=True),
            _bet_record("CO", CHECK, hand_class="strong_draw"),
        ]
        findings = build_findings(recs, recs, [], max_draws=3)
        self.assertEqual(len(findings["trashPlayedTop20"]), 1)

    def test_premium_folded_captured(self):
        recs = [
            _bet_record("UTG", FOLD, hand_class="made_low_premium", is_premium=True),
            _bet_record("BTN", BET,  hand_class="made_low_premium", is_premium=True),
        ]
        findings = build_findings(recs, recs, [], max_draws=3)
        self.assertEqual(len(findings["premiumFoldedTop20"]), 1)

    def test_draw_inaccurate_captured(self):
        draw_recs = [
            _draw_record(draw_count=0, ideal_count=2),
            _draw_record(draw_count=1, ideal_count=1),
        ]
        findings = build_findings([], [], draw_recs, max_draws=3)
        self.assertEqual(len(findings["drawInaccurateTop20"]), 1)

    def test_made_hand_non_pat_captured(self):
        draw_recs = [
            _draw_record(draw_count=2, ideal_count=0, is_made=True, hand_class="made_low_premium"),
            _draw_record(draw_count=0, ideal_count=0, is_made=True, hand_class="made_low_premium"),
        ]
        findings = build_findings([], [], draw_recs, max_draws=3)
        self.assertEqual(len(findings["madeHandNonPatTop20"]), 1)


# ---------------------------------------------------------------------------
# audit_checkpoint smoke test
# ---------------------------------------------------------------------------

class AuditCheckpointSmokeTest(unittest.TestCase):

    def _make_checkpoint(self, tmp_path, obs_dim: int = 96, n_actions: int = 11) -> str:
        from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
        agent = DQNAgent(
            obs_dim=obs_dim,
            n_actions=n_actions,
            hidden_dim=8,
            device="cpu",
            hyperparams=DQNHyperParams(),
        )
        path = str(tmp_path / "test.pt")
        agent.save(path)
        return path

    def test_d01_smoke(self, tmp_path=None):
        import tempfile, os
        from pathlib import Path
        with tempfile.TemporaryDirectory() as td:
            ckpt = self._make_checkpoint(Path(td))
            report = audit_checkpoint(
                checkpoint=Path(ckpt),
                variant_id="D01",
                episodes=4,
                device="cpu",
                seed=42,
            )
        self.assertEqual(report["variantId"], "D01")
        self.assertEqual(report["family"], "low-27")
        self.assertEqual(report["maxDraws"], 3)
        self.assertIn("summary", report)
        self.assertIn("warnings", report)
        self.assertIn("findings", report)
        self.assertIn("openingDecisions", report)
        self.assertIn("betRoundDecisions", report)
        self.assertIn("drawDecisions", report)
        self.assertIsInstance(report["warnings"], list)

    def test_s02_smoke(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as td:
            ckpt = self._make_checkpoint(Path(td))
            report = audit_checkpoint(
                checkpoint=Path(ckpt),
                variant_id="S02",
                episodes=4,
                device="cpu",
                seed=42,
            )
        self.assertEqual(report["variantId"], "S02")
        self.assertEqual(report["family"], "low-a5")
        self.assertEqual(report["maxDraws"], 1)
        self.assertIn("round0", report["summary"]["bet"]["byBetRound"])
        self.assertIn("round1", report["summary"]["bet"]["byBetRound"])
        self.assertNotIn("round2", report["summary"]["bet"]["byBetRound"])

    def test_invalid_variant_raises(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as td:
            ckpt = self._make_checkpoint(Path(td))
            with self.assertRaises((ValueError, SystemExit)):
                audit_checkpoint(
                    checkpoint=Path(ckpt),
                    variant_id="INVALID",
                    episodes=1,
                    device="cpu",
                )

    def test_missing_episodes_and_samples_raises(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as td:
            ckpt = self._make_checkpoint(Path(td))
            with self.assertRaises(ValueError):
                audit_checkpoint(
                    checkpoint=Path(ckpt),
                    variant_id="D01",
                    device="cpu",
                )


if __name__ == "__main__":
    unittest.main()
