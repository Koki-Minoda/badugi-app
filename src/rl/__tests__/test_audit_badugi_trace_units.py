"""Trace-to-big-bet conversion and fail-closed integrity checks."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "evaluation" / "audit_badugi_trace_units.py"
SPEC = importlib.util.spec_from_file_location("audit_badugi_trace_units", MODULE)
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


def originals():
    session = {
        "group": "2/2-cash", "seatCount": 2, "profile": "passive",
        "seed": 17, "heroSeat": 0, "hands": 1,
        "chipDelta": 20, "chipPerHand": 20.0, "chipBbPerHand": 1.0,
        "noHeroDecisionHands": 0, "zeroSum": True,
        "heroActions": {"BET:1": 1},
    }
    hand = {
        "seed": 17, "handIndex": 0, "group": "2/2-cash",
        "profile": "passive", "heroSeat": 0,
        "activeBigBlind": 20,
        "startingStacks": [500, 500], "endingStacks": [520, 480],
        "chipDeltaBySeat": [20, -20],
        "decisions": [{"seat": 0, "phase": "BET", "actionIndex": 1,
                       "legalMask": [0, 1, 0, 0, 0, 0],
                       "status": "used", "elapsedMs": 15}],
        "publicActionTrace": [{"seat": 0, "type": "BET_ACTION",
                               "action": "check", "amount": 0,
                               "stackBefore": 500, "stackAfter": 500}],
    }
    manifest = {"modelSha256": "a" * 64, "contractSha256": "b" * 64}
    return manifest, session, hand


def run_files(manifest, session, hand, *, diagnostic=None, extra_hand=False):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        manifest_path = root / "manifest.json"
        session_path = root / "sessions.jsonl"
        hand_path = root / "hands.jsonl"
        report_path = root / "report.json"
        output_path = None if diagnostic is not None else root / "converted.jsonl"
        manifest_path.write_text(json.dumps(manifest))
        session_path.write_text(json.dumps(session) + "\n")
        hand_path.write_text((json.dumps(hand) + "\n") * (2 if extra_hand else 1))
        result = audit.audit_files(
            manifest_path=manifest_path, session_path=session_path,
            hand_path=hand_path, output_path=output_path, report_path=report_path,
            deadline_ms=8000, diagnostic_sessions=diagnostic)
        converted = json.loads(output_path.read_text()) if output_path else None
        return result, converted


class BadugiTraceUnitAuditTest(unittest.TestCase):
    def test_converts_fixed_limit_big_bet_and_records_hashes(self):
        manifest, session, hand = originals()
        result, row = run_files(manifest, session, hand)
        self.assertEqual(result["status"], "FULL_TRACE_UNIT_AUDIT_INPUT_ONLY")
        self.assertEqual(result["handsRead"], 1)
        self.assertEqual(result["observedScoreMin"], 50)
        self.assertEqual(row["netBigBets"], 0.5)
        self.assertEqual(row["inferenceRequests"], 1)
        self.assertEqual(row["modelSha256"], manifest["modelSha256"])
        self.assertEqual(len(result["outputSha256"]), 64)

    def test_diagnostic_prefix_is_not_a_gate_input(self):
        manifest, session, hand = originals()
        result, row = run_files(manifest, session, hand, diagnostic=1)
        self.assertIsNone(row)
        self.assertEqual(result["status"], "DIAGNOSTIC_PREFIX_ONLY_NOT_GATE_INPUT")
        self.assertIn("sessionConsumedPrefixSha256", result)
        self.assertNotIn("sessionInputSha256", result)

    def test_rejects_unmatched_extra_hand(self):
        manifest, session, hand = originals()
        with self.assertRaisesRegex(ValueError, "extra hand"):
            run_files(manifest, session, hand, extra_hand=True)

    def test_rejects_inter_hand_chip_reset(self):
        manifest, session, hand = originals()
        session["hands"] = 2
        later = copy.deepcopy(hand)
        later["handIndex"] = 1
        # Each hand balances internally, but chips are silently reset between hands.
        stream = io.BytesIO((json.dumps(hand) + "\n" + json.dumps(later) + "\n").encode())
        with self.assertRaisesRegex(ValueError, "inter-hand chip continuity"):
            audit.audit_session(session, stream, hashlib.sha256(),
                                model_sha=manifest["modelSha256"],
                                contract_sha=manifest["contractSha256"],
                                deadline_ms=8000, index=1)

    def test_rejects_malformed_trace_and_summary(self):
        cases = [
            ("wrong seed", lambda s, h: h.update(seed=18)),
            ("lost chips", lambda s, h: h.update(chipDeltaBySeat=[20, -10])),
            ("ending stack", lambda s, h: h.update(endingStacks=[510, 480])),
            ("negative stack", lambda s, h: h.update(startingStacks=[-1, 1001])),
            ("illegal action", lambda s, h: h["decisions"][0].update(actionIndex=2)),
            ("bet amount", lambda s, h: h["publicActionTrace"][0].update(amount=10)),
            ("fallback", lambda s, h: h["decisions"][0].update(status="fallback")),
            ("deadline", lambda s, h: h["decisions"][0].update(elapsedMs=8001)),
            ("wrong summary", lambda s, h: s.update(chipBbPerHand=2.0)),
        ]
        for label, mutate in cases:
            with self.subTest(label=label), self.assertRaises(ValueError):
                manifest, session, hand = originals()
                mutate(session, hand)
                run_files(manifest, session, hand)


if __name__ == "__main__":
    unittest.main()
