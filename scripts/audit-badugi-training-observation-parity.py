"""Compare the isolated JS training encoder with six-max Python observations."""
import argparse
from collections import deque
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from rl.env.badugi_env_sixmax_selfplay import SixMaxBadugiEnv


def fixture(env, seat):
    phase = env.phase
    names = (["FOLD", "CHECK", "CALL", "BET", "RAISE", "ALL_IN"] if phase == "BET"
             else ["draw_0", "draw_1", "draw_2", "draw_3", "unused_4", "unused_5"])
    return {
        "state": {
            "phase": phase,
            "drawRoundIndex": env.draw_round,
            "dealerIndex": env.dealer_seat,
            "betQueue": list(env.bet_queue),
            "currentBet": env.current_bet,
            "raiseCount": env.raise_count,
            "pot": env.pot,
            "players": [{
                "hand": player["hand"],
                "stack": player["stack"],
                "betThisRound": player["bet"],
                "folded": player["folded"],
                "lastDrawCount": player["last_draw"],
                "drawHistory": player["draw_history"],
                "betHistory": player["bet_history"],
                "openedCurrentRound": player["opened_current_round"],
                "discardedCards": player["discarded"],
            } for player in env.players],
        },
        "seatIndex": seat,
        "legalActions": [name for name, allowed in zip(names, env._mask_for(seat)) if allowed],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", help="Optional ONNX model for same-state legal-action comparison")
    args = parser.parse_args()
    cases = []
    for seed in (186, 187, 188):
        for phase in ("BET", "DRAW"):
            for scenario in ("reset", "pressure", "last_draw"):
                env = SixMaxBadugiEnv()
                env.reset(seed=seed)
                env.phase = phase
                if scenario != "reset":
                    env.draw_round = 1 if scenario == "pressure" else 3
                    env.pot = 75 if scenario == "pressure" else 150
                    env.current_bet = 4 if scenario == "pressure" else 8
                    env.raise_count = 2 if scenario == "pressure" else 3
                    env.dealer_seat = (env.dealer_seat + 2) % 6
                    env.bet_queue = deque([2, 3, 4])
                    for index, player in enumerate(env.players):
                        player["stack"] = 60 + 9 * index
                        player["bet"] = 2 * (index % 3)
                        player["last_draw"] = index % 4
                        player["draw_history"] = [index % 4, (index + 1) % 4, (index + 2) % 4]
                        player["bet_history"] = [index % 2 == 0, index % 3 == 0, index % 4 == 0]
                        player["opened_current_round"] = index % 2 == 0
                        player["discarded"] = [(0, 0), (3, 1)] if index % 2 == 0 else [(8, 2)]
                for seat, player in enumerate(env.players):
                    if player["folded"]:
                        continue
                    cases.append({
                        "seed": seed,
                        "phase": phase,
                        "scenario": scenario,
                        "seat": seat,
                        "payload": fixture(env, seat),
                        "python": env._obs_for(seat).tolist(),
                    })
    script = """
import { buildBadugiTrainingObservationV1 } from './src/rl/badugiTrainingObservationV1.js';
import { buildBadugiObservationVector } from './src/rl/badugiObservationSchema.js';
let input = ''; for await (const chunk of process.stdin) input += chunk;
process.stdout.write(JSON.stringify(JSON.parse(input).map(row => ({
  training: buildBadugiTrainingObservationV1(row.payload),
  live: buildBadugiObservationVector(row.payload),
}))));
"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script], input=json.dumps(cases),
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    rows = []
    encoded = json.loads(result.stdout)
    for case, vectors in zip(cases, encoded):
        actual = vectors["training"]
        expected = case["python"]
        differences = [{"slot": slot, "javascript": js, "python": py}
                       for slot, (js, py) in enumerate(zip(actual, expected)) if abs(js - py) > 1e-6]
        rows.append({
            "seed": case["seed"], "phase": case["phase"], "scenario": case["scenario"], "seat": case["seat"],
            "javascriptLength": len(actual), "pythonLength": len(expected),
            "differences": differences,
        })
    passed = all(row["javascriptLength"] == row["pythonLength"] == 96 and
                 not row["differences"] for row in rows)
    report = {
        "status": "PASS" if passed else "MISMATCH",
        "scope": "Offline Python six-max state to isolated JS training encoder; not the live inference path or model-strength QA.",
        "caseCount": len(rows), "rows": rows,
    }
    if args.model:
        import numpy as np
        import onnxruntime as ort

        model = Path(args.model)
        if not model.is_absolute():
            model = ROOT / model
        session = ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])
        input_name = session.get_inputs()[0].name
        decisions = []
        for case, vectors in zip(cases, encoded):
            action_names = (["FOLD", "CHECK", "CALL", "BET", "RAISE", "ALL_IN"]
                            if case["phase"] == "BET" else
                            ["draw_0", "draw_1", "draw_2", "draw_3", "unused_4", "unused_5"])
            legal = [index for index, name in enumerate(action_names)
                     if name in case["payload"]["legalActions"]]
            choices = {}
            for path in ("live", "training"):
                features = np.asarray(vectors[path], dtype=np.float32)
                values = session.run(None, {input_name: features})[0].reshape(-1)
                choices[path] = int(max(legal, key=lambda index: values[index]))
            decisions.append({
                "seed": case["seed"], "phase": case["phase"],
                "scenario": case["scenario"], "seat": case["seat"], **choices,
            })
        report["decisionComparison"] = {
            "model": str(model.relative_to(ROOT)) if model.is_relative_to(ROOT) else str(model),
            "scope": "Same-state legal argmax only; not played-hand or strength evaluation",
            "caseCount": len(decisions),
            "differentCount": sum(row["live"] != row["training"] for row in decisions),
            "byPhase": {phase: {
                "caseCount": sum(row["phase"] == phase for row in decisions),
                "differentCount": sum(row["phase"] == phase and row["live"] != row["training"]
                                      for row in decisions),
            } for phase in ("BET", "DRAW")},
            "rows": decisions,
        }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "caseCount": len(rows),
                      "mismatches": sum(bool(row["differences"]) for row in rows),
                      "decisionComparison": {key: value for key, value in
                                             report.get("decisionComparison", {}).items()
                                             if key in ("caseCount", "differentCount", "byPhase")}}))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
