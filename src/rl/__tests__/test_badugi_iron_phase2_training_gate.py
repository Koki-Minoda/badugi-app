"""Fail closed when an isolated Iron training segment loses its provenance."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from rl.agents.dqn_agent import DQNAgent
from rl.training import train_badugi_controller_v2_draft as trainer


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class IronPhase2TrainingGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.pro = self.root / "pro.pt"
        DQNAgent(96, 6).save(str(self.pro), training_state={
            "schemaVersion": trainer.SCHEMA, "tier": "pro"})
        self.reference = self.root / "pro.onnx"
        self.reference.write_bytes(b"frozen-test-reference")
        self.plan = self.root / "iron-plan.json"
        self.plan.write_text(json.dumps({
            "status": "FROZEN_FOR_ISOLATED_IRON_PHASE2_TRAINING",
            "schemaVersion": trainer.SCHEMA,
            "initialProCheckpointSha256": sha(self.pro),
            "publishedProOnnxSha256": sha(self.reference),
            "bootstrapHands": 1000, "imitationSteps": 1000,
            "referenceAnchorEvery": 1, "explorationEpsilon": 0.1,
            "segmentMaxHands": 5000, "maximumSegments": 20,
            "trainingSeedBase": 1700116001, "segmentSeedStride": 20000000,
            "stageSeedStride": 1000000000,
            "trainingSessionHands": 20,
            "trainingGroups": [f'{seats}/{occupied}-{mode}' for mode in ('cash', 'mtt')
                               for seats, occupied in ((2, 2), (3, 3), (6, 6), (6, 2), (6, 3))],
            "opponentProfiles": list(trainer.PROFILES),
        }))
        self.manifest = self.root / "go.json"
        self.base = {
            "status": "GO", "tier": "iron", "trainingHost": "mac",
            "codeGitSha": "test-code-sha", "maxHands": 5000,
            "schemaVersion": trainer.SCHEMA,
            "bridgeSha256": sha(trainer.BRIDGE),
            "contractSha256": trainer.contract_hash(),
            "planSha256": sha(trainer.PLAN),
            "tierPlanSha256": sha(self.plan),
            "initialModelSha256": sha(self.pro),
            "referenceModelSha256": sha(self.reference),
            "anchorPolicyId": "published-v2-pro",
            "bootstrapHands": 1000, "imitationSteps": 1000,
            "referenceAnchorEvery": 1, "explorationEpsilon": 0.1,
            "runIndex": 1, "priorCumulativeHands": 0,
            "seedBase": 1700116001,
            "independentSlotAuditPassed": True,
            "uiEventAuditPassed": True,
            "controllerActionAuditPassed": True,
            "seedAndOpponentPlanFrozen": True,
            "macResourcePassed": True,
        }
        self.plan_patch = patch.object(trainer, "IRON_PLAN", self.plan)
        self.identity_patch = patch.object(trainer, "checkout_identity",
                                           return_value=("test-code-sha", ""))
        self.plan_patch.start()
        self.identity_patch.start()
        self.addCleanup(self.plan_patch.stop)
        self.addCleanup(self.identity_patch.stop)

    def check(self, body, initial=None):
        self.manifest.write_text(json.dumps(body))
        return trainer.require_go_manifest(self.manifest, "iron", 5000,
                                           initial or self.pro, self.reference)

    def test_first_segment_accepts_only_frozen_pro_and_distinct_seed(self):
        self.assertEqual(self.check(self.base)["runIndex"], 1)
        bad = dict(self.base, seedBase=self.base["seedBase"] + 1)
        with self.assertRaisesRegex(ValueError, "bounded segment"):
            self.check(bad)
        bad = dict(self.base, initialModelSha256="incorrect")
        with self.assertRaises(ValueError):
            self.check(bad)

    def test_continuation_checks_cumulative_hands_and_parent_code(self):
        prior_path = self.root / "iron-1.pt"
        DQNAgent(96, 6).save(str(prior_path), training_state={
            "schemaVersion": trainer.SCHEMA, "tier": "iron",
            "runIndex": 1, "cumulativeHands": 5000,
            "codeGitSha": "test-code-sha"})
        valid = dict(self.base, runIndex=2, priorCumulativeHands=5000,
                     initialModelSha256=sha(prior_path), seedBase=1720116001)
        self.assertEqual(self.check(valid, prior_path)["runIndex"], 2)
        with self.assertRaisesRegex(ValueError, "continuation chain"):
            self.check(dict(valid, priorCumulativeHands=4999), prior_path)
        with self.assertRaisesRegex(ValueError, "GO manifest"):
            self.check(dict(valid, codeGitSha="other-code"), prior_path)

    def test_seed_schedule_rejects_stage_and_segment_collisions(self):
        plan = json.loads(self.plan.read_text())
        self.assertEqual(len(trainer.validate_iron_seed_schedule(plan)), 400)
        plan["segmentSeedStride"] = plan["stageSeedStride"]
        with self.assertRaisesRegex(ValueError, "collide"):
            trainer.validate_iron_seed_schedule(plan)
        plan["segmentSeedStride"] = 20_000_000
        plan["trainingSeedBase"] = 4_290_000_000
        with self.assertRaisesRegex(ValueError, "modulo"):
            trainer.validate_iron_seed_schedule(plan)

    def test_iron_go_rejects_unbalanced_stage_allocation(self):
        plan = json.loads(self.plan.read_text())
        plan['bootstrapHands'] = 250
        self.plan.write_text(json.dumps(plan))
        candidate = dict(self.base, bootstrapHands=250,
                         tierPlanSha256=sha(self.plan))
        with self.assertRaisesRegex(ValueError, 'equally across all 40 cells'):
            self.check(candidate)
        plan['bootstrapHands'] = 200
        self.plan.write_text(json.dumps(plan))
        candidate['bootstrapHands'] = 200
        candidate['tierPlanSha256'] = sha(self.plan)
        self.assertEqual(self.check(candidate)['runIndex'], 1)

    def test_exact_cross_commit_handoff_only_at_frozen_segment(self):
        old_code = "a" * 40
        prior_path = self.root / "iron-20.pt"
        DQNAgent(96, 6).save(str(prior_path), training_state={
            "schemaVersion": trainer.SCHEMA, "tier": "iron",
            "runIndex": 20, "cumulativeHands": 100000,
            "codeGitSha": old_code})
        plan = json.loads(self.plan.read_text())
        plan.update(maximumSegments=40, minimumRunIndex=21, handoffRunIndex=21,
                    trainingSeedBase=300116001,
                    handoffSourceCodeSha=old_code,
                    handoffCheckpointSha256=sha(prior_path))
        continuation_windows = trainer.validate_iron_seed_schedule(plan)
        self.assertEqual(len(continuation_windows), 400)
        self.assertLess(continuation_windows[-1][1], 1700116001)
        self.plan.write_text(json.dumps(plan))
        valid = dict(self.base, runIndex=21, priorCumulativeHands=100000,
                     initialModelSha256=sha(prior_path),
                     seedBase=300116001, tierPlanSha256=sha(self.plan))
        self.assertEqual(self.check(valid, prior_path)["runIndex"], 21)
        with self.assertRaisesRegex(ValueError, "bounded segment"):
            self.check(dict(valid, runIndex=20, seedBase=280116001), prior_path)
        wrong = dict(plan, handoffCheckpointSha256="b" * 64)
        self.plan.write_text(json.dumps(wrong))
        with self.assertRaisesRegex(ValueError, "continuation chain"):
            self.check(dict(valid, tierPlanSha256=sha(self.plan)), prior_path)
        self.plan.write_text(json.dumps(plan))
        after_path = self.root / "iron-21.pt"
        DQNAgent(96, 6).save(str(after_path), training_state={
            "schemaVersion": trainer.SCHEMA, "tier": "iron",
            "runIndex": 21, "cumulativeHands": 105000,
            "codeGitSha": "test-code-sha"})
        after = dict(valid, runIndex=22, priorCumulativeHands=105000,
                     initialModelSha256=sha(after_path), seedBase=320116001)
        self.assertEqual(self.check(after, after_path)["runIndex"], 22)
        DQNAgent(96, 6).save(str(after_path), training_state={
            "schemaVersion": trainer.SCHEMA, "tier": "iron",
            "runIndex": 21, "cumulativeHands": 105000,
            "codeGitSha": old_code})
        with self.assertRaisesRegex(ValueError, "continuation chain"):
            self.check(dict(after, initialModelSha256=sha(after_path)), after_path)


if __name__ == "__main__":
    unittest.main()
