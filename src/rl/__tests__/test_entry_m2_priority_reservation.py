import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np

from rl.training.audit_badugi_entry_m2_priority_reservation import (
    HISTORY_SCHEMA, SCREEN_PLAN_SCHEMA, SOLVER_LAB_INDEX_SHA256, TARGETS_SHA256,
    audit_reservation, collision_counts,
)


class EntryM2PriorityReservationTests(unittest.TestCase):
    def test_counts_union_and_uint32_interval_end(self):
        reserved = np.asarray([0, 1, 2, 3, 4, 2**32 - 1], dtype="<u4")
        recorded = np.asarray([2, 4], dtype="<u4")
        self.assertEqual(collision_counts(reserved, recorded, [[1, 3], [2**32 - 1, 2**32]]), {
            "recordedSeedCollisions": 2,
            "historicalScreenCollisions": 3,
            "distinctCollisions": 4,
        })
        with self.assertRaisesRegex(ValueError, "overlap"):
            collision_counts(reserved, recorded, [[0, 3], [2, 4]])

    def test_unresolved_scope_fails_without_opening_reservation(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            history = json.dumps({
                "schema": HISTORY_SCHEMA, "status": "INDEPENDENT_SOURCE_SCOPE_VERIFIED",
                "solverLabIndexSha256": SOLVER_LAB_INDEX_SHA256,
                "sourceInventorySha256": "a" * 64,
                "unresolvedSourceScopes": ["old collector source missing"],
            }).encode()
            history_sha = hashlib.sha256(history).hexdigest()
            (folder / "history.json").write_bytes(history)
            plan = json.dumps({
                "schema": SCREEN_PLAN_SCHEMA, "status": "FROZEN_BEFORE_SCREEN",
                "stage": "PRIORITY_HERO_OPENING_CARDS_ONLY", "targetsSha256": TARGETS_SHA256,
                "seedHistorySha256": history_sha, "seedHistoryFile": "history.json",
            }).encode()
            (folder / "plan.json").write_bytes(plan)
            with self.assertRaisesRegex(ValueError, "source scope remains unresolved"):
                audit_reservation(folder / "plan.json", hashlib.sha256(plan).hexdigest(), history_sha)
