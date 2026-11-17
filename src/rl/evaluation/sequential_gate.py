"""Read-only, finite-look candidate evaluation on independent controller sessions.

The score is *net big bets per 100 hands*. Callers must derive ``netBigBets``
from independently audited hand traces; this module never infers blind units.
The Hoeffding guarantee is conditional on independent, bounded sessions and a
manifest frozen before collecting evaluation data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

SCHEMA = "mgx-sequential-gate/v2"
METRICS = ("overall", "cash", "mtt")
SHA_LENGTH = 64
SEED_PERIOD = 2 ** 32  # The D03 controller's seededRandom coerces seeds with >>> 0.


def _sha(value: object) -> bool:
    return isinstance(value, str) and len(value) == SHA_LENGTH and all(
        char in "0123456789abcdef" for char in value
    )


def _window(value: object) -> tuple[int, int]:
    if (not isinstance(value, list) or len(value) != 2 or
            any(type(item) is not int for item in value) or value[0] > value[1]):
        raise ValueError("seed window must be [integer start, integer end]")
    return value[0], value[1]


def _seed_residues(window: tuple[int, int]) -> list[tuple[int, int]]:
    low, high = window
    if high - low + 1 >= SEED_PERIOD:
        return [(0, SEED_PERIOD - 1)]
    start = low % SEED_PERIOD
    end = high % SEED_PERIOD
    return [(start, end)] if start <= end else [
        (start, SEED_PERIOD - 1), (0, end)]


def _seed_windows_collide(first: tuple[int, int], second: tuple[int, int]) -> bool:
    return any(low_a <= high_b and low_b <= high_a
               for low_a, high_a in _seed_residues(first)
               for low_b, high_b in _seed_residues(second))


def _finite_positive(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value > 0


def _conservation_bounds(cell: dict, hands: int) -> tuple[float, float]:
    """True score bounds if the frozen no-rebuy constant-bet contract holds."""
    seats = cell.get("tableSeats")
    occupied = cell.get("occupiedSeats")
    stack = cell.get("startingStackChips")
    big_bet = cell.get("bigBetChips")
    if (type(seats) is not int or seats not in (2, 3, 6) or
            type(occupied) is not int or not 2 <= occupied <= seats or
            not _finite_positive(stack) or not _finite_positive(big_bet) or
            cell.get("noRebuy") is not True or
            cell.get("constantBigBet") is not True):
        raise ValueError("cell lacks a valid conserved-chip score-bound proof")
    multiplier = 100.0 / (hands * big_bet)
    return -stack * multiplier, (occupied - 1) * stack * multiplier


def validate_manifest(plan: dict) -> None:
    if plan.get("schema") != SCHEMA or plan.get("scoreUnit") != "big_bet_per_100_hands":
        raise ValueError("unknown gate schema or score unit")
    for key in ("candidateModelSha256", "referenceModelSha256", "controllerContractSha256"):
        if not _sha(plan.get(key)):
            raise ValueError(f"missing or invalid {key}")
    if plan["candidateModelSha256"] == plan["referenceModelSha256"]:
        raise ValueError("candidate and reference models must differ")
    bounds = plan.get("scoreBounds")
    if (not isinstance(bounds, list) or len(bounds) != 2 or
            any(type(x) not in (int, float) or not math.isfinite(x) for x in bounds) or
            bounds[0] >= bounds[1]):
        raise ValueError("finite predeclared score bounds required")
    alpha = plan.get("familywiseAlpha")
    delta = plan.get("minimumImprovement")
    if (type(alpha) not in (int, float) or not 0 < alpha <= 0.1 or
            type(delta) not in (int, float) or not math.isfinite(delta) or
            delta <= 0):
        raise ValueError("invalid alpha or minimum improvement")
    looks = plan.get("lookSessionsPerCell")
    if (not isinstance(looks, list) or not looks or
            any(type(n) is not int or n < 2 for n in looks) or
            looks != sorted(set(looks))):
        raise ValueError("looks must be increasing session counts")
    cells = plan.get("cells")
    if (not isinstance(cells, list) or not cells or
            len({cell.get("name") for cell in cells}) != len(cells)):
        raise ValueError("nonempty unique cells required")
    for cell in cells:
        if (not isinstance(cell.get("name"), str) or
                cell.get("format") not in ("cash", "mtt") or
                not isinstance(cell.get("weight"), (int, float)) or
                not math.isfinite(cell["weight"]) or cell["weight"] <= 0):
            raise ValueError("invalid cell name, format, or weight")
    if {cell["format"] for cell in cells} != {"cash", "mtt"}:
        raise ValueError("both cash and mtt cells are required")
    if not math.isclose(sum(cell["weight"] for cell in cells), 1.0, abs_tol=1e-9):
        raise ValueError("cell weights must sum to one")
    max_hands = plan.get("handsPerSession")
    budget = plan.get("maxHandsPerArm")
    if (type(max_hands) is not int or max_hands < 1 or type(budget) is not int or
            budget < looks[-1] * len(cells) * max_hands):
        raise ValueError("hand budget does not cover the last planned look")
    wall_limit = plan.get("maxWallSecondsPerArm")
    if (type(wall_limit) not in (int, float) or not math.isfinite(wall_limit) or
            not 60 <= wall_limit <= 7 * 24 * 3600):
        raise ValueError("finite per-arm wall time limit required")
    proved = [_conservation_bounds(cell, max_hands) for cell in cells]
    required_low = min(pair[0] for pair in proved)
    required_high = max(pair[1] for pair in proved)
    if (bounds[0] > required_low or bounds[1] < required_high):
        raise ValueError("scoreBounds exclude mathematically possible chip outcomes")
    windows = plan.get("seedWindows")
    if not isinstance(windows, dict) or set(windows) != {"candidate", "reference"}:
        raise ValueError("candidate/reference seed windows required")
    candidate = _window(windows["candidate"])
    reference = _window(windows["reference"])
    excluded = [_window(item) for item in plan.get("excludedSeedWindows", [])]
    if _seed_windows_collide(candidate, reference):
        raise ValueError("arm seed windows overlap directly or modulo 2^32")
    for first in (candidate, reference):
        for second in excluded:
            if _seed_windows_collide(first, second):
                raise ValueError("evaluation seed window overlaps excluded data directly or modulo 2^32")
    deadline = plan.get("maxInferenceMs")
    if not isinstance(deadline, (int, float)) or not 0 < deadline <= 60_000:
        raise ValueError("positive maximum inference time required")


def _validate_rows(plan: dict, rows: dict[str, list[dict]]) -> tuple[int, dict]:
    if set(rows) != {"candidate", "reference"}:
        raise ValueError("exactly candidate and reference arms required")
    cells = {cell["name"]: cell for cell in plan["cells"]}
    seen_seed = set()
    seen_id = set()
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for arm in ("candidate", "reference"):
        model_sha = plan[f"{arm}ModelSha256"]
        seed_low, seed_high = plan["seedWindows"][arm]
        for row in rows[arm]:
            if (row.get("cell") not in cells or
                    row.get("source") != "real-controller" or
                    row.get("modelSha256") != model_sha or
                    row.get("controllerContractSha256") != plan["controllerContractSha256"]):
                raise ValueError("row provenance or cell mismatch")
            seed = row.get("seed")
            session_id = row.get("sessionId")
            index = row.get("sessionIndex")
            if (type(seed) is not int or not seed_low <= seed <= seed_high or
                    seed in seen_seed or not isinstance(session_id, str) or
                    not session_id or session_id in seen_id or
                    type(index) is not int or index < 1):
                raise ValueError("seed, session ID, or index is invalid or repeated")
            seen_seed.add(seed)
            seen_id.add(session_id)
            hands = row.get("hands")
            net = row.get("netBigBets")
            if (type(hands) is not int or hands != plan["handsPerSession"] or
                    not isinstance(net, (int, float)) or not math.isfinite(net)):
                raise ValueError("invalid session hand count or net big bets")
            cell = cells[row["cell"]]
            seats = cell["tableSeats"]
            occupied = cell["occupiedSeats"]
            stack = cell["startingStackChips"]
            big_bet = cell["bigBetChips"]
            hero = row.get("heroSeat")
            initial = row.get("initialStacks")
            final = row.get("finalStacks")
            expected = [stack if seat < occupied else 0 for seat in range(seats)]
            if (type(hero) is not int or not 0 <= hero < occupied or
                    initial != expected or not isinstance(final, list) or
                    len(final) != seats or
                    any(type(value) not in (int, float) or
                        not math.isfinite(value) or value < 0 for value in final) or
                    not math.isclose(sum(final), occupied * stack, abs_tol=1e-8) or
                    row.get("initialChipPool") != occupied * stack or
                    not math.isclose(net, (final[hero] - stack) / big_bet,
                                     abs_tol=1e-8) or
                    row.get("activeBigBlindMin") != big_bet / 2 or
                    row.get("activeBigBlindMax") != big_bet / 2):
                raise ValueError("row violates frozen conserved-chip score-bound proof")
            # A sum of per-hand floating values can sit one ULP beyond an
            # attainable boundary. Score from the independently audited final
            # chip ledger, after verifying agreement with the reported net.
            score = 100.0 * (final[hero] - stack) / (big_bet * hands)
            low, high = plan["scoreBounds"]
            if score < low or score > high:
                raise ValueError("session score outside predeclared bounds; no clipping")
            for field in ("illegalActions", "fallbacks", "inferenceRequests", "inferenceUsed"):
                if type(row.get(field)) is not int or row[field] < 0:
                    raise ValueError(f"invalid {field}")
            latency = row.get("maxInferenceMs")
            if not isinstance(latency, (int, float)) or not math.isfinite(latency) or latency < 0:
                raise ValueError("invalid latency")
            if (row.get("chipBalanced") is not True or
                    row.get("frozenManifestAttested") is not True or
                    row.get("decisionLedgerAudited") is not True or
                    row["illegalActions"] or
                    row["fallbacks"] or row["inferenceRequests"] == 0 or
                    row["inferenceUsed"] != row["inferenceRequests"] or
                    latency > plan["maxInferenceMs"]):
                raise ValueError("normal-flow safety or model-use gate failed")
            grouped[(arm, row["cell"])].append({**row, "score": score})
    counts = {len(grouped[(arm, cell)]) for arm in rows for cell in cells}
    if len(counts) != 1 or counts.pop() not in plan["lookSessionsPerCell"]:
        raise ValueError("all arm/cell groups must have one complete predeclared look")
    n = len(grouped[("candidate", next(iter(cells)))])
    total_hands = {}
    for arm in rows:
        total_hands[arm] = sum(row["hands"] for row in rows[arm])
        if total_hands[arm] > plan["maxHandsPerArm"]:
            raise ValueError("hand budget exceeded")
        for cell in cells:
            indices = sorted(row["sessionIndex"] for row in grouped[(arm, cell)])
            if indices != list(range(1, n + 1)):
                raise ValueError("session indices must be contiguous from one")
    return n, {"grouped": grouped, "totalHandsByArm": total_hands}


def _estimate(plan: dict, grouped: dict, n: int, metric: str) -> dict:
    selected = [cell for cell in plan["cells"] if
                metric == "overall" or cell["format"] == metric]
    weight_total = sum(cell["weight"] for cell in selected)
    weights = [(cell["name"], cell["weight"] / weight_total) for cell in selected]
    candidate = sum(weight * sum(row["score"] for row in grouped[("candidate", name)]) / n
                    for name, weight in weights)
    reference = sum(weight * sum(row["score"] for row in grouped[("reference", name)]) / n
                    for name, weight in weights)
    descriptive_variance = {}
    for arm in ("candidate", "reference"):
        total = 0.0
        for name, weight in weights:
            values = [row["score"] for row in grouped[(arm, name)]]
            center = sum(values) / n
            sample_variance = sum((value - center) ** 2 for value in values) / (n - 1)
            total += weight * weight * sample_variance / n
        descriptive_variance[arm] = total
    width = plan["scoreBounds"][1] - plan["scoreBounds"][0]
    alpha_per_metric_look = plan["familywiseAlpha"] / (
        len(plan["lookSessionsPerCell"]) * len(METRICS))
    variance_factor = sum(weight * weight / n for _, weight in weights)
    arm_radius = width * math.sqrt(0.5 * math.log(4 / alpha_per_metric_look) *
                                   variance_factor)
    return {
        "candidate": candidate, "reference": reference,
        "difference": candidate - reference,
        "lower": candidate - reference - 2 * arm_radius,
        "upper": candidate - reference + 2 * arm_radius,
        "radius": 2 * arm_radius,
        "descriptiveVarianceOfWeightedMean": descriptive_variance,
        "unit": plan["scoreUnit"],
    }


def evaluate(plan: dict, rows: dict[str, list[dict]]) -> dict:
    """Return a recommendation, never product adoption or model publication."""
    validate_manifest(plan)
    n, details = _validate_rows(plan, rows)
    metrics = {metric: _estimate(plan, details["grouped"], n, metric)
               for metric in METRICS}
    delta = plan["minimumImprovement"]
    if all(item["lower"] > delta for item in metrics.values()):
        decision, reason = "PROMOTE", "ALL_LOWER_BOUNDS_EXCEED_DELTA"
    elif any(item["upper"] <= delta for item in metrics.values()):
        decision, reason = "REJECT", "UPPER_BOUND_AT_OR_BELOW_DELTA"
    elif n == plan["lookSessionsPerCell"][-1]:
        decision, reason = "REJECT", "MAX_BUDGET_NO_PROMOTION"
    else:
        decision, reason = "CONTINUE", "NEXT_FROZEN_LOOK"
    cell_means = {
        cell["name"]: {
            arm: sum(row["score"] for row in details["grouped"][(arm, cell["name"])]) / n
            for arm in ("candidate", "reference")
        } for cell in plan["cells"]
    }
    return {
        "schema": "mgx-sequential-gate-result/v2",
        "decision": decision, "reason": reason,
        "productAdoptionApproved": False,
        "scoreBoundProofMethod": "conserved_finite_chip_pool_no_rebuy_constant_big_bet",
        "derivedScoreBounds": [
            min(_conservation_bounds(cell, plan["handsPerSession"])[0]
                for cell in plan["cells"]),
            max(_conservation_bounds(cell, plan["handsPerSession"])[1]
                for cell in plan["cells"]),
        ],
        "lookSessionsPerCell": n,
        "nextLookSessionsPerCell": next((look for look in plan["lookSessionsPerCell"] if look > n), None),
        "totalHandsByArm": details["totalHandsByArm"],
        "familywiseAlpha": plan["familywiseAlpha"],
        "minimumImprovement": delta,
        "metrics": metrics,
        "cellMeansDescriptive": cell_means,
        "limitations": "Guarantee requires frozen plan, independent bounded sessions, correct big-bet normalization and complete provenance; cell means are descriptive only.",
    }


def _read_jsonl(path: Path) -> list[dict]:
    with path.open() as stream:
        return [json.loads(line) for line in stream if line.strip()]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    root = Path(__file__).resolve().parents[3]
    protected = (root / "public", root / "src" / "config" / "ai")
    if (output.exists() or output.suffix != ".json" or
            any(output == path or path in output.parents for path in protected)):
        parser.error("output must be a new .json file outside public model/registry paths")
    inputs = {name: path.read_bytes() for name, path in (
        ("plan", args.plan), ("candidate", args.candidate), ("reference", args.reference))}
    plan = json.loads(inputs["plan"])
    result = evaluate(plan, {
        "candidate": _read_jsonl(args.candidate),
        "reference": _read_jsonl(args.reference),
    })
    result["inputSha256"] = {name: hashlib.sha256(data).hexdigest()
                             for name, data in inputs.items()}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x") as stream:
        json.dump(result, stream, indent=2, sort_keys=True)
        stream.write("\n")
    print(output)


if __name__ == "__main__":
    main()
