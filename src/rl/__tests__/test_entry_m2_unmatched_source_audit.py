"""Source-specific seed semantics for the deferred M2 reservation audit."""

from pathlib import Path
import json
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))
from audit_badugi_entry_m2_unmatched import actual_deck_residues, audit, sha256


class SourceAwareResidues(unittest.TestCase):
    def test_screened_seed_is_one_hand_even_if_nested_selected(self):
        kind, values = actual_deck_residues(
            "d03-a5-fourcard-all-street-natural-20261124/screen-raw.jsonl.partial",
            b'{"cell":{"firstSeed":1203099572},"scanned":1,'
            b'"selected":[{"seed":1203099572}]}')
        self.assertEqual(kind, "screen_one_hand")
        self.assertEqual(list(values), [1203099572])
        self.assertNotIn(1203101590, values)  # Imaginary hand 2.

    def test_screened_unselected_seed_is_still_an_actual_deal(self):
        kind, values = actual_deck_residues(
            "d03-a5-fourcard-all-street-natural-20261124/screen-raw.jsonl.partial",
            b'{"cell":{"firstSeed":1203000000},"scanned":349075,'
            b'"selected":[{"seed":1203099572}]}')
        self.assertEqual(kind, "screen_one_hand")
        self.assertIn(1203101590, values)

    def test_predraw_screen_uses_same_contiguous_deal_range(self):
        kind, values = actual_deck_residues(
            "d03-predraw-prior-raise-v1-20261123/screen-raw.jsonl.partial",
            b'{"cell":{"firstSeed":3600000000},"scanned":3,"selected":[]}')
        self.assertEqual(kind, "screen_one_hand")
        self.assertEqual(list(values), [3600000000, 3600000001, 3600000002])

    def test_selected_session_expands_all_twenty_actual_hands(self):
        kind, values = actual_deck_residues(
            "d03-a5-fourcard-all-street-natural-20261124/selected.jsonl",
            b'{"seed":1203099572}')
        self.assertEqual(kind, "selected_20_hand")
        self.assertEqual(len(values), 20)
        self.assertEqual(values[2], 1203101590)

    def test_paired_replay_uses_only_the_recorded_one_hand(self):
        kind, values = actual_deck_residues(
            "d03-iron-conditional-snow-20261118/paired-hands.jsonl.partial",
            b'{"seed":7500567092,"base":{},"pat":{}}')
        self.assertEqual(kind, "paired_one_hand")
        self.assertEqual(values, [7500567092 % 2**32])
        self.assertNotIn(3205600805, values)

    def test_target_replay_uses_only_the_recorded_one_hand(self):
        kind, values = actual_deck_residues(
            "d03-iron-cross-leak-audit-20261117/targets.jsonl",
            b'{"seed":1034641611,"kind":"draw"}')
        self.assertEqual(kind, "target_one_hand")
        self.assertEqual(values, [1034641611])

    def test_indexed_trace_uses_its_real_hand_not_all_twenty(self):
        kind, values = actual_deck_residues(
            "d03-iron-anchor-rate-20261117/segment-32/hand-trace.jsonl",
            b'{"seed":3588567023,"handInSession":8}')
        self.assertEqual(kind, "indexed_hand_trace")
        self.assertEqual(values, [3588575095])

    def test_recorded_hand_trace_uses_only_its_dealt_index(self):
        kind, values = actual_deck_residues(
            "d03-iron-constrained-update-20261117/development-screen/checkpoint31/hand-trace.jsonl",
            b'{"seed":4100,"handIndex":23,"group":"cash","profile":"balanced",'
            b'"heroSeat":0,'
            b'"chipDeltaBySeat":[0,0],"decisions":[],"publicActionTrace":['
            b'{"handIndex":23},{"handIndex":23}]}')
        self.assertEqual(kind, "recorded_hand_trace")
        self.assertEqual(values, [(4100 + 23 * 1009) % 2**32])
        self.assertNotIn(4100 + 24 * 1009, values)

    def test_legacy_and_incomplete_trace_record_only_actual_hand(self):
        kind, values = actual_deck_residues(
            "d03-v2-beginner-anchor-train-2000hand-20261104/hand-trace.jsonl.incomplete",
            b'{"seatCount":6,"seed":5000,"handInSession":8,"profile":"balanced",'
            b'"heroSeat":0,'
            b'"allSeatChipDelta":[0,0,0,0,0,0],"allSeatDecisions":[]}')
        self.assertEqual(kind, "recorded_hand_trace")
        self.assertEqual(values, [5000 + 8 * 1009])

    def test_hand_trace_missing_terminal_or_seed_index_pair_stays_unresolved(self):
        for row in (
            b'{"seed":10,"handIndex":1,"publicActionTrace":[]}',
            b'{"seed":10,"group":"cash","handIndex":1,'
            b'"chipDeltaBySeat":[0,0]}',
        ):
            kind, values = actual_deck_residues(
                "d03-example/hand-trace.jsonl", row)
            self.assertEqual((kind, values), (None, []))

    def test_unknown_or_changed_format_fails_closed(self):
        self.assertEqual(actual_deck_residues("d03-new/paired-hands.jsonl",
                                               b'{"seed":5}'), (None, []))
        self.assertEqual(actual_deck_residues(
            "d03-iron-anchor-rate-20261117/hand-trace.jsonl",
            b'{"seed":5,"handInSession":20}'), (None, []))
        self.assertEqual(actual_deck_residues(
            "d03-iron-anchor-rate-20261117/hand-trace.jsonl",
            b'{"seed":5,"deckSeed":6,"handInSession":1}'), (None, []))

    def test_full_audit_rejects_real_collision_without_imaginary_hands(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rows = {
                "d03-a5-fourcard-all-street-natural-20261124/screen-raw.jsonl.partial":
                    b'{"cell":{"firstSeed":1203099572},"scanned":1,'
                    b'"selected":[{"seed":1203099572}]}\n',
                "d03-iron-conditional-snow-20261118/paired-hands.jsonl.partial":
                    b'{"seed":7500567092,"base":{},"pat":{}}\n',
                "d03-iron-anchor-rate-20261117/segment-32/hand-trace.jsonl":
                    b'{"seed":3588567023,"handInSession":8}\n',
                "d03-unknown/derived.jsonl": b'{"seed":42}\n',
            }
            entries = []
            for name, content in rows.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
                entries.append({"path": name, "bytes": len(content)})
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"artifactRoot": str(root),
                                            "unmatchedJsonl": entries}))
            schedule = np.arange(1, 1_500_001, dtype="<u4")
            schedule[-3:] = [1203101590, 3205600805, 3588575095]
            schedule_path = root / "schedule.u32le"
            schedule.tofile(schedule_path)
            plan = root / "plan.json"
            plan.write_text(json.dumps({"schema": "mgx-d03-entry-m2-hero-screen/v1",
                                        "sourceManifestSha256": sha256(manifest),
                                        "screenSeedScheduleFile": schedule_path.name,
                                        "screenSeedScheduleSha256": sha256(schedule_path)}))
            result = audit(manifest, plan, root / "new-audit.json")
            report = json.loads((root / "new-audit.json").read_text())
            self.assertEqual(result["status"], "FAIL_COLLISION")
            self.assertEqual(report["collisionsFirst100"], [{
                "path": "d03-iron-anchor-rate-20261117/segment-32/hand-trace.jsonl",
                "line": 1, "sourceClass": "indexed_hand_trace",
                "actualDeckResidue": 3588575095}])
            self.assertEqual(report["unresolvedFiles"][0]["unclassifiedSeedRows"], 1)


if __name__ == "__main__":
    unittest.main()
