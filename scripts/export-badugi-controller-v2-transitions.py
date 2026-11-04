#!/usr/bin/env python3
"""Export controller v2 decisions as audited, per-seat hand transitions.

This prepares the Python learner's input contract. It does not train a model.
"""
import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path


def export(rollout_path, destination):
    raw_bytes = rollout_path.read_bytes()
    source_hash = hashlib.sha256(raw_bytes).hexdigest()
    sessions = json.loads(raw_bytes)["sessions"]
    counts = defaultdict(int)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise FileExistsError(f"refusing to replace {destination}")
    with destination.open("x") as handle:
        for session_index, session in enumerate(sessions):
            for hand in session["hands"]:
                by_seat = defaultdict(list)
                for decision in hand["decisions"]:
                    by_seat[decision["seat"]].append(decision)
                if sum(hand["chipDeltaBySeat"]) != 0:
                    raise ValueError("controller hand did not conserve chips")
                for seat, decisions in sorted(by_seat.items()):
                    first = decisions[0]
                    if "auditInput" not in first:
                        raise ValueError("training export needs the audited pre-decision snapshot")
                    initial_bb = first["auditInput"]["blindStructure"][
                        first["auditInput"]["blindLevelIndex"]]["bb"]
                    if not initial_bb or initial_bb <= 0:
                        raise ValueError("invalid active hand blind")
                    for index, decision in enumerate(decisions):
                        observation = decision["observation"]
                        mask = decision["legalMask"]
                        action = decision["actionIndex"]
                        if len(observation) != 96 or len(mask) != 6 or mask[action] != 1:
                            raise ValueError("decision has incompatible observation/action contract")
                        final = index == len(decisions) - 1
                        following = decisions[index + 1] if not final else None
                        row = {
                            "schemaVersion": "badugi-controller-transition-v2-draft",
                            "sourceRolloutSha256": source_hash,
                            "sessionIndex": session_index, "handIndex": hand["handIndex"],
                            "seatCount": session["seatCount"], "isTournament": session["isTournament"],
                            "seed": session["seed"], "seat": seat, "stepInHand": index,
                            "phase": decision["phase"], "observation": observation,
                            "legalMask": mask, "actionIndex": action,
                            "rewardChipBb": hand["chipDeltaBySeat"][seat] / initial_bb if final else 0,
                            "rewardTiming": "terminal-hand-only", "done": final,
                            "nextObservation": following["observation"] if following else None,
                            "nextLegalMask": following["legalMask"] if following else None,
                            "policySource": decision["policySource"],
                        }
                        handle.write(json.dumps(row, separators=(",", ":")) + "\n")
                        counts["transitions"] += 1
                        counts["terminalRewards"] += int(final)
                        counts["bet"] += int(decision["phase"] == "BET")
                        counts["draw"] += int(decision["phase"] == "DRAW")
                counts["hands"] += 1
    result = {
        "status": "INPUT_CONTRACT_ONLY", "learnedPolicy": False,
        "strengthEvaluation": False,
        "sourceRolloutSha256": source_hash,
        "transitionsSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "sessions": len(sessions), **counts,
        "reward": "per-seat terminal hand chip delta divided by active hand BB; intermediate reward zero",
    }
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("rollouts", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(export(args.rollouts, args.out), indent=2))


if __name__ == "__main__":
    main()
