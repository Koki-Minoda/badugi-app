"""Compare isolated JS lowball draw training input with the Python six-max environment."""
import argparse
from collections import deque
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from rl.env.draw_lowball_env import DRAW_ACTIONS
from rl.env.draw_lowball_env_sixmax_selfplay import SixMaxDrawLowballEnv

VARIANTS = (("D01", "low-27", 3), ("D02", "low-a5", 3),
            ("S01", "low-27", 1), ("S02", "low-a5", 1))


def fixture(env, seat):
    player = env.players[seat]
    return {
        "state": {
            "family": env.family, "maxDraws": env.max_draws,
            "phase": env.phase, "drawRoundIndex": env.draw_round,
            "dealerIndex": env.dealer_seat,
            "betQueue": list(env.bet_queue),
            "drawOrder": list(env.draw_order) if hasattr(env, "draw_order") else None,
            "currentBet": env.current_bet, "raiseCount": env.raise_count, "pot": env.pot,
            "players": [{
                "hand": p["hand"], "stack": p["stack"], "betThisRound": p["bet"],
                "folded": p["folded"], "lastDrawCount": p["last_draw"],
                "drawHistory": p["draw_history"], "totalDraws": p["total_draws"],
                "betHistory": p["bet_history"],
                "openedCurrentRound": p["opened_current_round"],
                "raisedPredraw": p["raised_predraw"], "discardedCards": p["discarded"],
            } for p in env.players],
        },
        "seatIndex": seat,
        "legalActions": [name for name, allowed in zip(DRAW_ACTIONS, env._mask_for(seat)) if allowed],
    }


def cases_for_audit():
    cases = []
    for variant, family, max_draws in VARIANTS:
        for seed in (184, 185, 186):
            for phase in ("BET", "DRAW"):
                for scenario in ("reset", "pressure", "late"):
                    env = SixMaxDrawLowballEnv(family=family, max_draws=max_draws, seed=seed)
                    env.reset(seed=seed)
                    env.phase = phase
                    if scenario != "reset":
                        env.draw_round = 1 if scenario == "pressure" else max_draws
                        env.pot = 70 if scenario == "pressure" else 135
                        env.current_bet = 4 if scenario == "pressure" else 8
                        env.raise_count = 2 if scenario == "pressure" else 3
                        env.dealer_seat = (env.dealer_seat + 2) % 6
                        env.bet_queue = deque([2, 3, 4])
                        env.draw_order = deque([4, 3, 2])
                        for index, p in enumerate(env.players):
                            p["stack"] = 55 + 11 * index
                            p["bet"] = 2 * (index % 3)
                            p["last_draw"] = index % 5
                            p["draw_history"] = [index % 5, (index + 1) % 5, (index + 2) % 5]
                            p["total_draws"] = sum(p["draw_history"])
                            p["bet_history"] = [index % 2 == 0, index % 3 == 0, index % 4 == 0]
                            p["opened_current_round"] = index % 2 == 0
                            p["raised_predraw"] = index % 3 == 0
                            p["discarded"] = [(2, 0), (14, 1)] if index % 2 == 0 else [(9, 2)]
                    for seat, player in enumerate(env.players):
                        if player["folded"]:
                            continue
                        cases.append({
                            "variantId": variant, "seed": seed, "phase": phase,
                            "scenario": scenario, "seat": seat,
                            "payload": fixture(env, seat),
                            "python": env._obs_for(seat).tolist(),
                        })
    return cases


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    cases = cases_for_audit()
    script = """
import { buildDrawTrainingObservationV1 } from './src/rl/drawTrainingObservationV1.js';
let input = ''; for await (const chunk of process.stdin) input += chunk;
process.stdout.write(JSON.stringify(JSON.parse(input).map(row => buildDrawTrainingObservationV1(row.payload))));
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script], input=json.dumps(cases),
                            cwd=ROOT, capture_output=True, text=True, check=True)
    rows = []
    for case, actual in zip(cases, json.loads(result.stdout)):
        expected = case["python"]
        differences = [{"slot": index, "javascript": js, "python": py}
                       for index, (js, py) in enumerate(zip(actual, expected)) if abs(js - py) > 1e-6]
        rows.append({key: case[key] for key in ("variantId", "seed", "phase", "scenario", "seat")} |
                    {"javascriptLength": len(actual), "pythonLength": len(expected),
                     "differences": differences})
    passed = all(row["javascriptLength"] == row["pythonLength"] == 96 and
                 not row["differences"] for row in rows)
    report = {"status": "PASS" if passed else "MISMATCH", "caseCount": len(rows),
              "scope": "Offline training observation only; not live inference or strength evaluation",
              "rows": rows}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "caseCount": len(rows),
                      "mismatches": sum(bool(row["differences"]) for row in rows)}))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
