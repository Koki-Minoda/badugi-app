"""Descriptive independent-session diagnostic for D03 Pro cash regressions.

This is a hypothesis screen, not a product gate or a paired causal estimate.
"""

from __future__ import annotations

import argparse
import json
import random
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean


def read_sessions(path: Path) -> dict[tuple[str, str], list[dict]]:
    cells: dict[tuple[str, str], list[dict]] = defaultdict(list)
    with path.open(encoding="utf-8") as source:
        for line in source:
            item = json.loads(line)
            if not item["isTournament"]:
                assert item["hands"] > 0 and item["zeroSum"]
                cells[(item["group"], item["profile"])].append(item)
    return dict(cells)


def action_summary(sessions: list[dict]) -> dict:
    counts: Counter[str] = Counter()
    for session in sessions:
        counts.update(session["heroActions"])
    bet_total = sum(value for key, value in counts.items() if key.startswith("BET:"))
    return {
        "betDecisions": bet_total,
        "fold": counts["BET:0"],
        "call": counts["BET:2"],
        "raise": counts["BET:4"],
        "foldRate": counts["BET:0"] / bet_total if bet_total else None,
        "callRate": counts["BET:2"] / bet_total if bet_total else None,
        "raiseRate": counts["BET:4"] / bet_total if bet_total else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--standard", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--replicates", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=78423)
    args = parser.parse_args()
    if args.output.exists() or args.replicates < 1000:
        parser.error("Output must not exist and replicates must be at least 1000")
    candidate = read_sessions(args.candidate)
    standard = read_sessions(args.standard)
    if candidate.keys() != standard.keys():
        raise ValueError("Cash group/profile cells differ between arms")
    lengths = {(len(candidate[key]), len(standard[key])) for key in candidate}
    if len(lengths) != 1:
        raise ValueError(f"Unequal independent-session counts across cells: {lengths}")

    rng = random.Random(args.seed)
    by_profile = {}
    for profile in sorted({key[1] for key in candidate}):
        keys = sorted(key for key in candidate if key[1] == profile)
        candidate_rows = [row for key in keys for row in candidate[key]]
        standard_rows = [row for key in keys for row in standard[key]]
        point = mean(
            mean(row["chipBbPerHand"] for row in candidate[key])
            - mean(row["chipBbPerHand"] for row in standard[key])
            for key in keys
        )
        samples = []
        for _ in range(args.replicates):
            samples.append(mean(
                mean(row["chipBbPerHand"] for row in rng.choices(candidate[key], k=len(candidate[key])))
                - mean(row["chipBbPerHand"] for row in rng.choices(standard[key], k=len(standard[key])))
                for key in keys
            ))
        samples.sort()
        by_profile[profile] = {
            "cashCells": len(keys),
            "independentSessionsPerArm": len(candidate_rows),
            "differenceBbPerHand": point,
            "bootstrap95": [samples[int(0.025 * args.replicates)], samples[int(0.975 * args.replicates)]],
            "candidateActions": action_summary(candidate_rows),
            "standardActions": action_summary(standard_rows),
        }
    result = {
        "status": "EXPLORATORY_CASH_DIAGNOSTIC_NOT_ADOPTION_EVIDENCE",
        "method": "Equal-weight cash group cells; independent-session nonpaired stratified bootstrap; action rates are descriptive and trajectories diverge",
        "replicates": args.replicates,
        "seed": args.seed,
        "byOpponentProfile": by_profile,
        "limitations": "Profile names control script opponents and are not model inputs. Small cell samples, correlated decisions inside sessions, and post-hoc profile selection preclude a causal or product-strength claim.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
