#!/usr/bin/env python3
"""Exercise the JSONL controller bridge without training or model inference."""
import argparse
import hashlib
import json
import random
import subprocess
from collections import Counter
from pathlib import Path


def choose_action(decision, profile, rng):
    allowed = [index for index, flag in enumerate(decision["legalMask"]) if flag]
    if not allowed or len(decision["observation"]) != 96:
        raise ValueError("bridge sent an invalid decision contract")
    if profile == "random_legal":
        return rng.choice(allowed)
    if decision["phase"] == "DRAW":
        preference = {"passive": [0, 1, 2, 3, 4],
                      "pressure": [1, 2, 0, 3, 4],
                      "draw_heavy": [4, 3, 2, 1, 0]}[profile]
    else:
        preference = {"passive": [1, 2, 0, 3, 4],
                      "pressure": [4, 3, 2, 1, 0],
                      "draw_heavy": [2, 1, 3, 4, 0]}[profile]
    return next(action for action in preference if action in allowed)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hands", type=int, default=5)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.hands <= 100 or args.out.exists():
        raise ValueError("hands must be 1–100 and output must not exist")
    bridge = Path(__file__).with_name("badugi-controller-v2-bridge.mjs")
    report = {"status": "BRIDGE_PREFLIGHT_ONLY", "learnedPolicy": False,
              "modelUsed": False, "strengthEvaluation": False,
              "handsPerGroup": args.hands, "groups": [],
              "bridgeSourceSha256": hashlib.sha256(bridge.read_bytes()).hexdigest()}
    process = subprocess.Popen(["node", str(bridge)], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, bufsize=1)

    def exchange(request):
        process.stdin.write(json.dumps(request) + "\n")
        process.stdin.flush()
        line = process.stdout.readline()
        if not line:
            raise RuntimeError("bridge exited before replying")
        response = json.loads(line)
        if response["type"] == "error":
            raise RuntimeError(response["message"])
        return response

    try:
        for seat_count, occupied_count in ((2, 2), (3, 3), (6, 6), (6, 2), (6, 3)):
            for tournament in (False, True):
                for profile_index, profile in enumerate(("passive", "pressure", "draw_heavy", "random_legal")):
                    seed = (211040000 + seat_count * 10000 + occupied_count * 100000 +
                            int(tournament) * 1000 + profile_index * 100)
                    rng = random.Random(seed + 17)
                    response = exchange({"command": "reset", "seatCount": seat_count,
                                         "occupiedSeatCount": occupied_count,
                                         "isTournament": tournament, "seed": seed})
                    counters = Counter()
                    for hand in range(args.hands):
                        if hand:
                            response = exchange({"command": "next_hand"})
                        while response["type"] == "decision":
                            if (response["seatCount"] != seat_count or
                                    response["occupiedSeatCount"] != occupied_count or
                                    response["isTournament"] != tournament):
                                raise ValueError("bridge changed table contract")
                            action = choose_action(response, profile, rng)
                            counters["decision"] += 1
                            counters[response["phase"].lower()] += 1
                            if response["phase"] == "DRAW":
                                counters[f"draw_{action}"] += 1
                            try:
                                response = exchange({"command": "step", "actionIndex": action})
                            except RuntimeError as error:
                                raise RuntimeError(f"{seat_count=} {occupied_count=} {tournament=} {profile=} {hand=} "
                                                   f"{response['decisionIndex']=} {response['seat']=} "
                                                   f"{response['phase']=} {action=}: {error}") from error
                            if counters["decision"] > args.hands * 200:
                                raise ValueError("bridge exceeded 200 decisions per hand")
                        if response["type"] != "hand_end" or response["handIndex"] != hand:
                            raise ValueError("bridge did not terminate the expected hand")
                        if sum(response["chipDeltaBySeat"]) != 0 or len(response["endingStacks"]) != seat_count:
                            raise ValueError("bridge hand chips do not balance")
                        counters["hand"] += 1
                    report["groups"].append({"seatCount": seat_count,
                                             "occupiedSeatCount": occupied_count,
                                             "isTournament": tournament,
                                             "profile": profile, "seed": seed, **dict(counters)})
    finally:
        process.stdin.close()
        process.wait(timeout=10)
    if process.returncode:
        raise RuntimeError(process.stderr.read())
    report["totalHands"] = sum(group["hand"] for group in report["groups"])
    report["totalDecisions"] = sum(group["decision"] for group in report["groups"])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "groups"}, indent=2))


if __name__ == "__main__":
    main()
