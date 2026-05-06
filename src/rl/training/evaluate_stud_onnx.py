"""Smoke-evaluate Stud-family ONNX models against betting fixtures."""

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


STUD_ACTIONS = ["fold", "check", "call", "bet", "raise", "all_in"]


def family_from_variant(variant_id: str):
    mapping = {"ST1": "stud", "ST2": "stud8", "ST3": "razz"}
    if variant_id not in mapping:
        raise ValueError(f"Unsupported Stud-family variant id: {variant_id}")
    return mapping[variant_id]


def pot_odds(to_call: float, pot: float):
    return to_call / max(0.01, pot + to_call) if to_call > 0 else 0.0


def make_vector(
    *,
    family: str,
    made: float,
    draw: float,
    visible: float,
    position: float,
    street: float,
    to_call: float,
    low: float,
    high: float,
):
    return np.array(
        [
            to_call,
            0.08 if street >= 0.5 else 0.04,
            0.34,
            made,
            draw,
            visible,
            position,
            street,
            pot_odds(to_call, 0.34),
            0.0,
            1.0 if family == "razz" else 0.0,
            1.0 if family == "stud8" else 0.0,
            1.0 if family == "stud" else 0.0,
            0.4,
            0.8,
            max(low, high),
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
        action = STUD_ACTIONS[index]
        if action not in legal_actions:
            continue
        if score > best_score:
            best_index = index
            best_score = score
    return {"action": STUD_ACTIONS[best_index], "scores": scores}


def fixtures_for_family(family: str):
    return [
        {
            "name": "strong-made-hand-value-bets",
            "vector": make_vector(family=family, made=0.9, draw=0.18, visible=0.42, position=0.7, street=0.75, to_call=0.0, low=0.22, high=0.9),
            "legal": {"check", "bet", "raise"},
            "expectedAny": {"bet", "raise"},
            "ev": {"check": 0.28, "bet": 0.78, "raise": 0.68},
        },
        {
            "name": "strong-facing-bet-continues",
            "vector": make_vector(family=family, made=0.82, draw=0.16, visible=0.35, position=0.5, street=0.75, to_call=0.12, low=0.22, high=0.82),
            "legal": {"fold", "call", "raise"},
            "expectedAny": {"call", "raise"},
            "ev": {"fold": -0.14, "call": 0.55, "raise": 0.5},
        },
        {
            "name": "weak-facing-bet-folds",
            "vector": make_vector(family=family, made=0.18, draw=0.08, visible=0.72, position=0.2, street=0.5, to_call=0.24, low=0.2, high=0.18),
            "legal": {"fold", "call", "raise"},
            "expectedAny": {"fold"},
            "ev": {"fold": 0.0, "call": -0.48, "raise": -0.72},
        },
        {
            "name": "medium-equity-pot-odds-continues",
            "vector": make_vector(family=family, made=0.46, draw=0.55, visible=0.35, position=0.55, street=0.25, to_call=0.06, low=0.45, high=0.46),
            "legal": {"fold", "call", "raise"},
            "expectedAny": {"call"},
            "ev": {"fold": -0.06, "call": 0.18, "raise": -0.04},
        },
        {
            "name": "razz-low-strength-or-stud8-scoop-pressure",
            "vector": make_vector(
                family=family,
                made=0.76 if family != "stud" else 0.64,
                draw=0.46,
                visible=0.38,
                position=0.72,
                street=0.5,
                to_call=0.0,
                low=0.86 if family in {"razz", "stud8"} else 0.25,
                high=0.62 if family != "razz" else 0.2,
            ),
            "legal": {"check", "bet", "raise"},
            "expectedAny": {"bet", "raise"} if family in {"razz", "stud8"} else {"check", "bet"},
            "ev": {"check": 0.22, "bet": 0.54 if family in {"razz", "stud8"} else 0.3, "raise": 0.42 if family in {"razz", "stud8"} else 0.1},
        },
    ]


def evaluate(model_path: Path, variant_id: str):
    family = family_from_variant(variant_id)
    results = []
    failures = []
    ev_deltas = []
    for fixture in fixtures_for_family(family):
        decision = run_model(model_path, fixture["vector"], fixture["legal"])
        passed = decision["action"] in fixture["expectedAny"]
        ev_map = fixture["ev"]
        selected_ev = float(ev_map.get(decision["action"], 0.0))
        best_ev = max(float(ev_map.get(action, -999.0)) for action in fixture["legal"])
        ev_delta = selected_ev - best_ev
        ev_deltas.append(ev_delta)
        item = {
            "name": fixture["name"],
            "family": family,
            "action": decision["action"],
            "selectedEV": selected_ev,
            "bestEV": best_ev,
            "evDelta": ev_delta,
            "passed": passed,
        }
        results.append(item)
        if not passed or ev_delta < -0.2:
            failures.append(item)
    return {
        "variantId": variant_id,
        "model": str(model_path),
        "summary": {
            "fixtureCount": len(results),
            "passCount": len([item for item in results if item["passed"]]),
            "avgEVDelta": sum(ev_deltas) / len(ev_deltas) if ev_deltas else 0.0,
            "worstEVDelta": min(ev_deltas) if ev_deltas else 0.0,
        },
        "results": results,
        "failures": failures,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate Stud-family ONNX bootstrap fixtures.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--variant-id", required=True)
    parser.add_argument("--report", default=None)
    parser.add_argument("--report-only", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    result = evaluate(Path(args.model), args.variant_id)
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
