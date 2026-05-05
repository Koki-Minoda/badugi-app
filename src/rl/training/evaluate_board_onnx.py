"""Smoke-evaluate board-game ONNX models against betting fixtures."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    import numpy as np
    import onnxruntime as ort
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: onnxruntime/numpy. Install RL deps first: "
        "python3 -m pip install -r src/rl/requirements.txt"
    ) from exc


BOARD_ACTIONS = ["fold", "check", "call", "bet", "raise", "all_in"]


def make_vector(*, family: str, strength: float, equity: float, draw: float, to_call: float, position: float):
    return np.array(
        [
            to_call,
            0.12,
            0.28,
            strength,
            equity,
            draw,
            position,
            0.33,
            to_call / max(0.01, 0.28 + to_call),
            0.0,
            1.0 if family == "plo8" else 0.0,
            1.0 if family in {"plo", "plo8"} else 0.0,
            1.0 if family == "flh" else 0.0,
            0.4,
            0.8,
            1.0 if family == "nlh" else 0.0,
        ],
        dtype=np.float32,
    )


def run_model(model_path: Path, vector: np.ndarray, legal_actions: set[str]):
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    scores = session.run([output_name], {input_name: vector})[0].astype(float).tolist()
    best_index = -1
    best_score = -float("inf")
    for index, score in enumerate(scores):
        action = BOARD_ACTIONS[index]
        if action not in legal_actions:
            continue
        if score > best_score:
            best_index = index
            best_score = score
    return {"action": BOARD_ACTIONS[best_index], "scores": scores}


def family_from_variant(variant_id: str):
    mapping = {"B01": "nlh", "B02": "flh", "B05": "plo", "B06": "plo8"}
    if variant_id not in mapping:
        raise ValueError(f"Unsupported board variant id: {variant_id}")
    return mapping[variant_id]


def fixtures_for_family(family: str, advanced_gate: bool = False):
    hi_lo = family == "plo8"
    pot_limit = family in {"plo", "plo8"}
    fixed_limit = family == "flh"
    base_fixtures = [
        {
            "name": "strong-open-value-bets",
            "vector": make_vector(family=family, strength=0.9, equity=0.82, draw=0.12, to_call=0.0, position=0.65),
            "legal": {"check", "bet", "raise"},
            "expectedAny": {"bet", "raise"},
            "category": "valueBet",
            "ev": {"check": 0.35, "bet": 0.82, "raise": 0.74},
        },
        {
            "name": "strong-facing-bet-continues",
            "vector": make_vector(family=family, strength=0.82, equity=0.76, draw=0.18, to_call=0.12, position=0.45),
            "legal": {"fold", "call", "raise"},
            "expectedAny": {"call", "raise"},
            "category": "continue",
            "ev": {"fold": -0.12, "call": 0.58, "raise": 0.54},
        },
        {
            "name": "weak-facing-bet-folds",
            "vector": make_vector(family=family, strength=0.18, equity=0.16, draw=0.08, to_call=0.25, position=0.2),
            "legal": {"fold", "call", "raise"},
            "expectedAny": {"fold"},
            "category": "foldDiscipline",
            "ev": {"fold": 0.0, "call": -0.42, "raise": -0.74},
        },
    ]
    if not advanced_gate:
        return base_fixtures
    return base_fixtures + [
        {
            "name": "late-thin-value-does-not-check-back",
            "vector": make_vector(family=family, strength=0.66, equity=0.61, draw=0.05, to_call=0.0, position=0.9),
            "legal": {"check", "bet", "raise"},
            "expectedAny": {"bet"} if not fixed_limit else {"bet", "raise"},
            "category": "thinValue",
            "ev": {"check": 0.18, "bet": 0.42, "raise": 0.32},
        },
        {
            "name": "low-equity-bluff-discipline",
            "vector": make_vector(family=family, strength=0.22, equity=0.24, draw=0.1, to_call=0.0, position=0.35),
            "legal": {"check", "bet", "raise"},
            "expectedAny": {"check"},
            "category": "badBluff",
            "ev": {"check": 0.0, "bet": -0.28, "raise": -0.46},
        },
        {
            "name": "multiway-isolation-with-equity-edge",
            "vector": make_vector(
                family=family,
                strength=0.72,
                equity=0.68,
                draw=0.28 if pot_limit else 0.12,
                to_call=0.08,
                position=0.72,
            ),
            "legal": {"fold", "call", "raise"},
            "expectedAny": {"raise", "call"} if fixed_limit else {"raise"},
            "category": "multiwayIsolation",
            "ev": {"fold": -0.08, "call": 0.28, "raise": 0.48 if not fixed_limit else 0.34},
        },
        {
            "name": "side-pot-short-stack-avoids-low-equity-punt",
            "vector": make_vector(family=family, strength=0.34, equity=0.31, draw=0.16, to_call=0.2, position=0.5),
            "legal": {"fold", "call", "raise", "all_in"},
            "expectedAny": {"fold", "call"},
            "category": "sidePotEV",
            "ev": {"fold": 0.0, "call": -0.06, "raise": -0.38, "all_in": -0.62},
        },
        {
            "name": "plo8-scoop-or-no-low-awareness" if hi_lo else "high-only-no-scoop-control",
            "vector": make_vector(
                family=family,
                strength=0.64 if hi_lo else 0.58,
                equity=0.72 if hi_lo else 0.52,
                draw=0.62 if hi_lo else 0.22,
                to_call=0.1,
                position=0.7,
            ),
            "legal": {"fold", "call", "raise"},
            "expectedAny": {"raise", "call"} if hi_lo else {"call"},
            "category": "scoopNoLow" if hi_lo else "highOnlyControl",
            "ev": {"fold": -0.1, "call": 0.34, "raise": 0.52 if hi_lo else 0.22},
        },
    ]


def evaluate(model_path: Path, variant_id: str, advanced_gate: bool = False):
    family = family_from_variant(variant_id)
    results = []
    failures = []
    ev_deltas = []
    category_counts: dict[str, dict[str, int | float]] = {}
    for fixture in fixtures_for_family(family, advanced_gate=advanced_gate):
        decision = run_model(model_path, fixture["vector"], fixture["legal"])
        passed = decision["action"] in fixture["expectedAny"]
        ev_map = fixture.get("ev", {})
        selected_ev = float(ev_map.get(decision["action"], 0.0))
        best_ev = max(float(ev_map.get(action, -999.0)) for action in fixture["legal"])
        ev_delta = selected_ev - best_ev
        ev_deltas.append(ev_delta)
        category = fixture["category"]
        bucket = category_counts.setdefault(category, {"count": 0, "passed": 0, "evDelta": 0.0})
        bucket["count"] += 1
        bucket["passed"] += 1 if passed else 0
        bucket["evDelta"] += ev_delta
        item = {
            "name": fixture["name"],
            "family": family,
            "category": fixture["category"],
            "action": decision["action"],
            "selectedEV": selected_ev,
            "bestEV": best_ev,
            "evDelta": ev_delta,
            "passed": passed,
        }
        results.append(item)
        if not passed or ev_delta < -0.2:
            failures.append(item)
    summary = {
        "fixtureCount": len(results),
        "passCount": len([item for item in results if item["passed"]]),
        "avgEVDelta": sum(ev_deltas) / len(ev_deltas) if ev_deltas else 0.0,
        "worstEVDelta": min(ev_deltas) if ev_deltas else 0.0,
        "categories": {
            category: {
                "count": data["count"],
                "passCount": data["passed"],
                "avgEVDelta": data["evDelta"] / data["count"] if data["count"] else 0.0,
            }
            for category, data in category_counts.items()
        },
    }
    return {
        "variantId": variant_id,
        "model": str(model_path),
        "summary": summary,
        "results": results,
        "failures": failures,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate board ONNX bootstrap fixtures.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--variant-id", required=True)
    parser.add_argument("--report", default=None)
    parser.add_argument("--advanced-gate", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    result = evaluate(Path(args.model), args.variant_id, advanced_gate=args.advanced_gate)
    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        for item in result["results"]:
            status = "PASS" if item["passed"] else "FAIL"
            print(
                f"[{status}] {item['name']}: {item['action']} "
                f"(evDelta={item['evDelta']:.3f})"
            )
        print(
            f"[SUMMARY] pass={result['summary']['passCount']}/{result['summary']['fixtureCount']} "
            f"avgEVDelta={result['summary']['avgEVDelta']:.3f} "
            f"worstEVDelta={result['summary']['worstEVDelta']:.3f}"
        )
        if result["failures"] and not args.report_only:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
