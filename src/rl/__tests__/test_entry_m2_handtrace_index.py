"""The M2 hand-trace exclusion index records only dealt hands and source IDs."""

import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))
from build_badugi_entry_m2_handtrace_index import build


class HandTraceIndex(unittest.TestCase):
    def _fixture(self, root: Path, changed: bool = False) -> Path:
        records = {
            "d03-a/new/hand-trace.jsonl": [
                {"seed": 100, "handIndex": 0, "group": "cash", "profile": "tight",
                 "heroSeat": 0, "chipDeltaBySeat": [0, 0], "decisions": []},
                {"seed": 100, "handIndex": 1, "group": "cash", "profile": "tight",
                 "heroSeat": 0, "chipDeltaBySeat": [0, 0], "decisions": []},
            ],
            "d03-b/hand-trace.jsonl.incomplete": [
                {"seatCount": 2, "seed": 100, "handInSession": 0, "profile": "loose",
                 "heroSeat": 0, "allSeatChipDelta": [0, 0], "allSeatDecisions": []},
                {"seatCount": 2, "seed": 200, "handInSession": 0, "profile": "loose",
                 "heroSeat": 0, "allSeatChipDelta": [0, 0], "allSeatDecisions": []},
            ],
        }
        entries = []
        for relative, rows in records.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            content = "".join(json.dumps(row, separators=(",", ":")) + "\n"
                              for row in rows).encode()
            path.write_bytes(content)
            entries.append({"path": relative, "family": "hand_trace",
                            "bytes": len(content), "rows": len(rows),
                            "sha256": hashlib.sha256(content).hexdigest()})
        if changed:
            (root / "d03-a/new/hand-trace.jsonl").write_bytes(b"changed\n")
        inventory = root / "inventory.json"
        inventory.write_text(json.dumps({
            "schema": "mgx-d03-m2-unresolved-lineage-inventory/v1",
            "entries": entries}))
        return inventory

    def test_unique_residues_keep_exact_source_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            inventory = self._fixture(root)
            result = build(inventory, root, root / "index", run_rows=2)
            manifest = json.loads((root / "index/manifest.json").read_text())
            residues = np.fromfile(root / "index/actual-deck-residues.u32le", dtype="<u4")
            pairs = np.fromfile(root / "index/residue-source-pairs.u64le", dtype="<u8")
            self.assertEqual(result["recordedHandRows"], 4)
            self.assertEqual(result["uniqueDeckResidues"], 3)
            self.assertEqual(residues.tolist(), [100, 200, 1109])
            self.assertEqual(pairs.tolist(),
                             [(100 << 16), (100 << 16) | 1,
                              (200 << 16) | 1, (1109 << 16)])
            self.assertEqual(manifest["incompleteTraceFiles"], 1)
            self.assertEqual(manifest["status"], "INDEX_BUILT_NOT_M2_CLEARANCE")

    def test_changed_source_refuses_index_completion(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            inventory = self._fixture(root, changed=True)
            with self.assertRaisesRegex(ValueError, "source size changed"):
                build(inventory, root, root / "index", run_rows=2)
            self.assertFalse((root / "index/manifest.json").exists())


if __name__ == "__main__":
    unittest.main()
