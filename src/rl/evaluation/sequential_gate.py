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

SCHEMA = "mgx-sequential-gate/v1"
METRICS = ("overall", "cash", "mtt")
SHA_LENGTH = 64


def _sha(value: object) -> bool:
    return isinstance(value, str) and len(value) == SHA_LENGTH and all(
        char in "0123456789abcdef" for char in value
    )


def _window(value: object) -> tuple[int, int]:
    if (not isinstance(value, list) or len(value) != 2 or
            any(type(item) is not int for item in value) or value[0] > value[1]):
        raise ValueError("seed window must be [integer start, integer end]")
    return value[0], value[1]


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
            any(not isinstance(x, (int, float)) or not math.isfinite(x) for x in bounds) or
            bounds[0] >= bounds[1]):
        raise ValueError("finite predeclared score bounds required")
    alpha = plan.get("familywiseAlpha")
    delta = plan.get("minimumImprovement")
    if (not isinstance(alpha, (int, float)) or not 0 < alpha <= 0.1 or
            not isinstance(delta, (int, float)) or not math.isfinite(delta)):
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
    windows = plan.get("seedWindows")
    if not isinstance(windows, dict) or set(windows) != {"candidate", "reference"}:
        raise ValueError("candidate/reference seed windows required")
    candidate = _window(windows["candidate"])
    reference = _window(windows["reference"])
    excluded = [_window(item) for item in plan.get("excludedSeedWindows", [])]
    if candidate[0] <= reference[1] and reference[0] <= candidate[1]:
        raise ValueError("arm seed windows overlap")
    for first in (candidate, reference):
        for second in excluded:
            if first[0] <= second[1] and second[0] <= first[1]:
                raise ValueError("evaluation seed window overlaps excluded data")
    deadline = plan.get("maxInferenceMs")
    if not isinstance(deadline, (int, float)) or not 0 < deadline <= 60_000:
        raise ValueError("positive maximum inference time required")


def _validate_rows(plan: dict, rows: dict[str, list[dict]]) -> tuple[int, dict]:
    if set(rows) != {"candidate", "reference"}:
        raise ValueError("exactly candidate and reference arms required")
    cells = {cell["name"] for cell in plan["cells"]}
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
            score = 100.0 * net / hands
            low, high = plan["scoreBounds"]
            if score < low or score > high:
                raise ValueError("session score outside predeclared bounds; no clipping")
            for field in ("illegalActions", "fallbacks", "inferenceRequests", "inferenceUsed"):
                if type(row.get(field)) is not int or row[field] < 0:
                    raise ValueError(f"invalid {field}")
            latency = row.get("maxInferenceMs")
            if not isinstance(latency, (int, float)) or not math.isfinite(latency) or latency < 0:
                raise ValueError("invalid latency")
            if (row.get("chipBalanced") is not True or row["illegalActions"] or
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
        "schema": "mgx-sequential-gate-result/v1",
        "decision": decision, "reason": reason,
        "productAdoptionApproved": False,
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
