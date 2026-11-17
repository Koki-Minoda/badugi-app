"""Contract and synthetic-null checks for the finite-look candidate gate."""

from __future__ import annotations

import copy
import importlib.util
import math
import random
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "evaluation" / "sequential_gate.py"
SPEC = importlib.util.spec_from_file_location("sequential_gate", MODULE)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


def plan():
    return {
        "schema": gate.SCHEMA,
        "scoreUnit": "big_bet_per_100_hands",
        "candidateModelSha256": "a" * 64,
        "referenceModelSha256": "b" * 64,
        "controllerContractSha256": "c" * 64,
        "scoreBounds": [-62.5, 62.5],
        "familywiseAlpha": 0.01,
        "minimumImprovement": 0.1,
        "lookSessionsPerCell": [20, 50, 100],
        "handsPerSession": 20,
        "maxHandsPerArm": 4000,
        "maxWallSecondsPerArm": 3600,
        "seedWindows": {"candidate": [10_000, 19_999],
                        "reference": [20_000, 29_999]},
        "excludedSeedWindows": [[1, 9_999]],
        "maxInferenceMs": 8000,
        "cells": [{"name": "cash|balanced", "format": "cash", "weight": 0.5,
                   "tableSeats": 2, "occupiedSeats": 2, "startingStackChips": 500,
                   "bigBetChips": 40, "noRebuy": True, "constantBigBet": True},
                  {"name": "mtt|unknown", "format": "mtt", "weight": 0.5,
                   "tableSeats": 2, "occupiedSeats": 2, "startingStackChips": 500,
                   "bigBetChips": 40, "noRebuy": True, "constantBigBet": True}],
    }


def rows(config, n, candidate_score, reference_score):
    result = {"candidate": [], "reference": []}
    for arm, score in (("candidate", candidate_score), ("reference", reference_score)):
        for cell_number, cell in enumerate(config["cells"]):
            for index in range(1, n + 1):
                value = score() if callable(score) else score
                result[arm].append({
                    "sessionId": f"{arm}-{cell_number}-{index}",
                    "sessionIndex": index,
                    "seed": (10_000 if arm == "candidate" else 20_000) +
                            cell_number * 1000 + index,
                    "heroSeat": 0,
                    "cell": cell["name"],
                    "hands": 20,
                    "netBigBets": value / 5,
                    "modelSha256": config[f"{arm}ModelSha256"],
                    "controllerContractSha256": config["controllerContractSha256"],
                    "source": "real-controller", "chipBalanced": True,
                    "frozenManifestAttested": True,
                    "decisionLedgerAudited": True,
                    "illegalActions": 0, "fallbacks": 0,
                    "inferenceRequests": 4, "inferenceUsed": 4,
                    "maxInferenceMs": 15,
                    "initialStacks": [500, 500],
                    "finalStacks": [500 + 8 * value, 500 - 8 * value],
                    "initialChipPool": 1000,
                    "activeBigBlindMin": 20,
                    "activeBigBlindMax": 20,
                })
    return result


class SequentialGateTest(unittest.TestCase):
    def test_strong_candidate_is_only_a_promotion_recommendation(self):
        result = gate.evaluate(plan(), rows(plan(), 100, 62.5, -62.5))
        self.assertEqual(result["decision"], "PROMOTE")
        self.assertFalse(result["productAdoptionApproved"])
        self.assertEqual(result["lookSessionsPerCell"], 100)
        self.assertTrue(all(metric["lower"] > 0.1 for metric in result["metrics"].values()))

    def test_weak_candidate_rejected_and_ambiguous_is_continued(self):
        self.assertEqual(gate.evaluate(plan(), rows(plan(), 100, -62.5, 62.5))["decision"],
                         "REJECT")
        interim = gate.evaluate(plan(), rows(plan(), 20, 0, 0))
        self.assertEqual(interim["decision"], "CONTINUE")
        self.assertEqual(interim["nextLookSessionsPerCell"], 50)
        final = gate.evaluate(plan(), rows(plan(), 100, 0, 0))
        self.assertEqual(final["decision"], "REJECT")
        self.assertEqual(final["reason"], "MAX_BUDGET_NO_PROMOTION")

    def test_interval_contract_and_shrinking_radius(self):
        early = gate.evaluate(plan(), rows(plan(), 20, 0, 0))
        later = gate.evaluate(plan(), rows(plan(), 100, 0, 0))
        for name in gate.METRICS:
            self.assertGreater(early["metrics"][name]["radius"],
                               later["metrics"][name]["radius"])
            self.assertTrue(math.isclose(later["metrics"][name]["difference"], 0))

    def test_frozen_cell_conservation_bounds_tighten_without_changing_mean(self):
        config = plan()
        config["scoreBounds"] = [-100, 500]
        config["cells"][1].update(tableSeats=6, occupiedSeats=6,
                                   startingStackChips=2000, bigBetChips=100)
        config["scoreBoundMethod"] = "cell_conservation"
        data = rows(config, 100, 0, 0)
        local = gate.evaluate(config, data)
        global_config = copy.deepcopy(config)
        del global_config["scoreBoundMethod"]
        broad = gate.evaluate(global_config, data)
        for metric in gate.METRICS:
            self.assertEqual(local["metrics"][metric]["difference"],
                             broad["metrics"][metric]["difference"])
            self.assertLessEqual(local["metrics"][metric]["radius"],
                                 broad["metrics"][metric]["radius"])
        self.assertLess(local["metrics"]["cash"]["radius"],
                        broad["metrics"]["cash"]["radius"])
        self.assertAlmostEqual(local["metrics"]["mtt"]["radius"],
                               broad["metrics"]["mtt"]["radius"])
        self.assertEqual(local["metrics"]["cash"]["confidenceBoundMethod"],
                         "per_cell_hoeffding_union_arms_tails_looks_metrics")

    def test_exact_chip_boundary_survives_float_net_roundoff(self):
        config = plan()
        config["scoreBounds"] = [-100, 500]
        config["cells"][1].update(tableSeats=6, occupiedSeats=6,
                                   startingStackChips=2000, bigBetChips=100)
        data = rows(config, 20, 0, 0)
        boundary = next(row for row in data["reference"]
                        if row["cell"] == "mtt|unknown")
        boundary.update(heroSeat=2, finalStacks=[0, 0, 12000, 0, 0, 0],
                        netBigBets=100.00000000000001)
        self.assertGreater(100.0 * boundary["netBigBets"] / 20, 500)
        self.assertEqual(gate.evaluate(config, data)["lookSessionsPerCell"], 20)
        boundary["netBigBets"] = 100.1
        with self.assertRaisesRegex(ValueError, "conserved-chip"):
            gate.evaluate(config, data)

    def test_unknown_bound_method_is_rejected(self):
        config = plan()
        config["scoreBoundMethod"] = "estimated_from_observed_scores"
        with self.assertRaisesRegex(ValueError, "unknown score-bound method"):
            gate.validate_manifest(config)

    def test_nonzero_hero_seat_uses_its_own_terminal_stack(self):
        config = plan()
        data = rows(config, 20, 1, 0)
        row = data["candidate"][0]
        row["heroSeat"] = 1
        row["finalStacks"] = list(reversed(row["finalStacks"]))
        self.assertEqual(gate.evaluate(config, data)["decision"], "CONTINUE")

    def test_rejects_provenance_unit_and_safety_mismatches(self):
        config = plan()
        data = rows(config, 20, 0, 0)
        mutations = [
            ("seed overlap", lambda d: d["reference"][0].update(seed=d["candidate"][0]["seed"])),
            ("wrong model", lambda d: d["candidate"][0].update(modelSha256="d" * 64)),
            ("fallback", lambda d: d["candidate"][0].update(fallbacks=1)),
            ("lost chips", lambda d: d["candidate"][0].update(chipBalanced=False)),
            ("unfrozen manifest", lambda d: d["candidate"][0].update(frozenManifestAttested=False)),
            ("unverified decision ledger", lambda d: d["candidate"][0].update(decisionLedgerAudited=False)),
            ("no ONNX use", lambda d: d["candidate"][0].update(inferenceUsed=3)),
            ("out of bounds", lambda d: d["candidate"][0].update(netBigBets=100)),
            ("variable session length", lambda d: d["candidate"][0].update(hands=19)),
            ("falsified terminal stack", lambda d: d["candidate"][0].update(finalStacks=[500, 501])),
            ("falsified fixed blind", lambda d: d["candidate"][0].update(activeBigBlindMax=50)),
            ("partial look", lambda d: d["candidate"].pop()),
            ("duplicate session", lambda d: d["candidate"][1].update(sessionId=d["candidate"][0]["sessionId"])),
        ]
        for label, mutate in mutations:
            with self.subTest(label=label), self.assertRaises(ValueError):
                altered = copy.deepcopy(data)
                mutate(altered)
                gate.evaluate(config, altered)

    def test_rejects_overlapping_excluded_seed_window(self):
        config = plan()
        config["excludedSeedWindows"].append([10_010, 10_020])
        with self.assertRaisesRegex(ValueError, "overlaps excluded"):
            gate.validate_manifest(config)
        config = plan()
        config["excludedSeedWindows"].append([10_010 + 2 ** 32, 10_020 + 2 ** 32])
        with self.assertRaisesRegex(ValueError, "modulo 2\\^32"):
            gate.validate_manifest(config)
        config = plan()
        config["seedWindows"]["reference"] = [10_000 + 2 ** 32, 19_999 + 2 ** 32]
        with self.assertRaisesRegex(ValueError, "arm seed windows overlap"):
            gate.validate_manifest(config)

    def test_rejects_unfrozen_weights_or_budget(self):
        config = plan()
        config["cells"][0]["weight"] = 0.6
        with self.assertRaisesRegex(ValueError, "sum to one"):
            gate.validate_manifest(config)
        config = plan()
        config["maxHandsPerArm"] = 3999
        with self.assertRaisesRegex(ValueError, "budget"):
            gate.validate_manifest(config)
        config = plan()
        config["maxWallSecondsPerArm"] = float('inf')
        with self.assertRaisesRegex(ValueError, "wall time"):
            gate.validate_manifest(config)
        config = plan()
        config["scoreBounds"] = [-1, 1]
        with self.assertRaisesRegex(ValueError, "mathematically possible"):
            gate.validate_manifest(config)
        config = plan()
        config["cells"][0]["noRebuy"] = False
        with self.assertRaisesRegex(ValueError, "score-bound proof"):
            gate.validate_manifest(config)

    def test_cli_records_input_hashes_and_refuses_overwrite(self):
        config = plan()
        data = rows(config, 20, 0, 0)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / "plan.json"
            candidate = root / "candidate.jsonl"
            reference = root / "reference.jsonl"
            output = root / "result.json"
            manifest.write_text(json.dumps(config))
            for arm, path in (("candidate", candidate), ("reference", reference)):
                path.write_text("".join(json.dumps(row) + "\n" for row in data[arm]))
            command = [sys.executable, str(MODULE), "--plan", str(manifest),
                       "--candidate", str(candidate), "--reference", str(reference),
                       "--output", str(output)]
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 0)
            result = json.loads(output.read_text())
            self.assertEqual(result["decision"], "CONTINUE")
            self.assertEqual(len(result["inputSha256"]["plan"]), 64)
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)

    def test_synthetic_null_repeated_looks_do_not_promote(self):
        """Diagnostic simulation, not a replacement for the analytic bound."""
        rng = random.Random(19860502)
        false_promotions = 0
        repetitions = 300
        for _ in range(repetitions):
            config = plan()
            full = rows(config, 100,
                        lambda: rng.choice((-62.5, 62.5)),
                        lambda: rng.choice((-62.5, 62.5)))
            for look in config["lookSessionsPerCell"]:
                truncated = {
                    arm: [row for row in full[arm] if row["sessionIndex"] <= look]
                    for arm in ("candidate", "reference")
                }
                result = gate.evaluate(config, truncated)
                if result["decision"] == "PROMOTE":
                    false_promotions += 1
                    break
                if result["decision"] == "REJECT":
                    break
        self.assertLessEqual(false_promotions, 3)


if __name__ == "__main__":
    unittest.main()
