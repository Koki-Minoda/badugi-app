#!/usr/bin/env python3
"""Independent, read-only 96-slot audit of captured controller decisions.

This intentionally does not import the JavaScript observation encoder. Inputs
are the pre-decision controller snapshots and action events in a rollout.
"""
import argparse
import hashlib
import itertools
import json
from pathlib import Path

RANKS = "A23456789TJQK"
SUITS = "CDHS"


def clip_ratio(value, denominator):
    return max(0.0, min(1.0, value / denominator))


def card(card_name):
    name = card_name.upper().strip().replace("10", "T")
    if len(name) != 2 or name[0] not in RANKS or name[1] not in SUITS:
        raise ValueError(f"invalid controller card: {card_name!r}")
    return RANKS.index(name[0]), SUITS.index(name[1])


def strongest_badugi(cards):
    qualifying = []
    for length in range(1, 5):
        for group in itertools.combinations(cards, length):
            ranks = [rank for rank, _ in group]
            suits = [suit for _, suit in group]
            if len(set(ranks)) == length and len(set(suits)) == length:
                qualifying.append(tuple(sorted(ranks)))
    # A lower high card wins; then compare the next highest card.
    return min(qualifying, key=lambda ranks: (-len(ranks), tuple(reversed(ranks))))


def independently_recompute(raw, tournament):
    players = raw["players"]
    seat = raw["seatIndex"]
    hero = players[seat]
    phase = raw["phase"]
    round_number = raw["drawRoundIndex"]
    bb = raw["blindStructure"][raw["blindLevelIndex"]]["bb"]
    if len(players) not in (2, 3, 6) or bb <= 0:
        raise ValueError("invalid table or blind")
    if any("hand" in player for index, player in enumerate(players) if index != seat):
        raise ValueError("opponent private hand leaked into audit input")
    cards = sorted(map(card, hero["hand"]))
    if len(cards) != 4 or len(set(cards)) != 4:
        raise ValueError("actor does not have four distinct cards")

    bet_history = [[False] * 4 for _ in players]
    draw_history = [[0] * 3 for _ in players]
    draw_seen = [[False] * 3 for _ in players]
    bet_action_count = 0
    for event in raw["publicEvents"]:
        if any(key in event for key in ("replacedCards", "hand", "oldCard", "newCard")):
            raise ValueError("private card leaked into public event")
        event_round = event["drawRoundIndex"]
        if event_round != event["betRoundIndex"] or event_round > round_number:
            raise ValueError("event round mismatch")
        actor = event["seat"]
        if event["type"] == "BET_ACTION":
            if phase == "BET" and event_round == round_number:
                bet_action_count += 1
            if event["action"].lower() in ("bet", "raise"):
                bet_history[actor][event_round] = True
        elif event["type"] == "DRAW_ACTION":
            if event_round >= 3 or draw_seen[actor][event_round]:
                raise ValueError("invalid duplicate or future draw")
            draw_seen[actor][event_round] = True
            draw_history[actor][event_round] = event["drawCount"]
        else:
            raise ValueError("unexpected event type")
    discards = []
    for event in raw["actorDrawEvents"]:
        if event["seat"] != seat or not draw_seen[seat][event["drawRoundIndex"]]:
            raise ValueError("private draw event belongs to wrong actor or public event missing")
        if len(event["replacedCards"]) != event["drawCount"]:
            raise ValueError("private draw count mismatch")
        discards.extend(card(entry["oldCard"]) for entry in event["replacedCards"])

    occupied = [not any(p[key] for key in ("seatOut", "sittingOut", "isBusted", "busted")) for p in players]
    live = [occupied[i] and not (p["folded"] or p["hasFolded"]) for i, p in enumerate(players)]
    known = []
    last_count = []
    for index in range(len(players)):
        completed = [r for r in range(3) if draw_seen[index][r] and
                     (r < round_number or phase == "DRAW" and r == round_number)]
        known.append(bool(completed))
        last_count.append(draw_history[index][completed[-1]] if completed else 0)
        reported = players[index]["lastDrawCount"]
        if completed and reported is not None and reported != last_count[-1]:
            raise ValueError("controller last draw disagrees with public events")

    round_bet = max(p["betThisRound"] for p in players) if phase == "BET" else 0
    to_call = max(0, round_bet - hero["betThisRound"])
    unit = bb * (2 if round_number >= 2 else 1)
    available = set(raw["controllerLegalActions"])
    if phase == "DRAW":
        legal = [int("DRAW" in available)] * 5 + [0]
    else:
        legal = [int(to_call > 0 and "FOLD" in available),
                 int(to_call == 0 and "CHECK" in available),
                 int(to_call > 0 and hero["stack"] > 0 and "CALL" in available),
                 int(round_bet == 0 and hero["stack"] >= unit and "RAISE" in available),
                 int(round_bet > 0 and hero["stack"] >= to_call + unit and "RAISE" in available), 0]

    best = strongest_badugi(cards)
    ranks = [rank for rank, _ in cards]
    suits = [suit for _, suit in cards]
    opponent_stacks = [p["stack"] for index, p in enumerate(players) if index != seat and live[index]]
    effective = min(hero["stack"], max(opponent_stacks, default=0))
    answer = []
    for rank, suit in cards:
        answer += [rank / 12, suit / 3]
    answer += [int(phase == "DRAW"), round_number / 3, len(players) / 6,
               sum(live) / 6,
               ((seat - raw["dealerIndex"] - 1 + len(players)) % len(players)) / (len(players) - 1),
               int(seat == raw["dealerIndex"]), clip_ratio(hero["stack"] / bb, 200),
               clip_ratio(sum(p["totalInvested"] for p in players) / bb, 400),
               clip_ratio(hero["betThisRound"] / bb, 20), clip_ratio(round_bet / bb, 20),
               clip_ratio(to_call / bb, 20), unit / bb / 2,
               raw["raiseCount"] / 4, int(tournament), int(phase == "BET" and bet_action_count == 0),
               clip_ratio(effective / bb, 200)]
    answer += [len(best) / 4, best[-1] / 12, clip_ratio(sum(best), 40),
               clip_ratio(4 - len(set(ranks)), 3), clip_ratio(4 - len(set(suits)), 3),
               int(len(best) == 4), draw_history[seat][round_number - 1] / 4 if round_number else 0,
               (3 - round_number) / 3]
    answer += legal
    answer += [int(bet_history[seat][r]) if r < round_number or phase == "DRAW" and r == round_number else 0
               for r in range(3)]
    answer += [draw_history[seat][r] / 4 for r in range(3)]
    for offset in range(1, 6):
        if offset >= len(players):
            answer += [0] * 10
            continue
        index = (seat + offset) % len(players)
        opponent = players[index]
        answer += [int(occupied[index]), int(live[index]), int(opponent["allIn"]),
                   clip_ratio(opponent["stack"] / bb, 200),
                   clip_ratio(opponent["betThisRound"] / bb, 20), int(known[index]),
                   last_count[index] / 4 if known[index] else 0,
                   int(phase == "BET" and bet_history[index][round_number]),
                   int(any(bet_history[index][:round_number])),
                   clip_ratio(sum(draw_history[index]), 12)]
    answer += [clip_ratio(sum(rank == 0 for rank, _ in discards), 4),
               clip_ratio(sum(1 <= rank <= 4 for rank, _ in discards), 16)]
    if len(answer) != 96:
        raise ValueError(f"auditor produced {len(answer)} values")
    return answer


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("rollouts", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    content = args.rollouts.read_bytes()
    sessions = json.loads(content)["sessions"]
    mismatches = []
    counts = {"hands": 0, "decisions": 0, "bet": 0, "draw": 0, "slotsCompared": 0}
    for session_index, session in enumerate(sessions):
        for hand_index, hand in enumerate(session["hands"]):
            counts["hands"] += 1
            if sum(hand["chipDeltaBySeat"]) != 0:
                raise ValueError("hand chip sum mismatch")
            for decision_index, decision in enumerate(hand["decisions"]):
                counts["decisions"] += 1
                counts["bet" if decision["phase"] == "BET" else "draw"] += 1
                expected = independently_recompute(decision["auditInput"], session["isTournament"])
                observed = decision["observation"]
                if len(observed) != 96:
                    raise ValueError("recorded observation is not 96 slots")
                for slot, (left, right) in enumerate(zip(expected, observed)):
                    counts["slotsCompared"] += 1
                    if abs(left - right) > 0.000002:
                        mismatches.append({"session": session_index, "hand": hand_index,
                                           "decision": decision_index, "slot": slot,
                                           "independent": left, "recorded": right})
    report = {"status": "PASS" if not mismatches else "FAIL",
              "rolloutSha256": hashlib.sha256(content).hexdigest(),
              "independence": "Python recomputation from captured real-controller snapshots and seat-visible events; no JS encoder import",
              "sessions": len(sessions), **counts,
              "mismatchCount": len(mismatches), "mismatches": mismatches[:40],
              "strengthEvaluation": False, "learnedPolicy": False}
    formatted = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.write_text(formatted)
    print(formatted)
    raise SystemExit(0 if not mismatches else 1)


if __name__ == "__main__":
    main()
