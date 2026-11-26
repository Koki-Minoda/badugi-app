"""Reconcile a completed M2 safety collection with the frozen entry gaps.

This counts legal opportunities, never rewards or action EV.  A 200-opportunity
planning quota must not be interpreted as a range or promotion threshold.
"""

from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path

from rl.training.badugi_starting_ranges import _score_key, all_starting_score_keys
from rl.training.collect_badugi_entry_m2_draft import sha256, validate_plan
from rl.training.entry_m2_sampling_contract import (
    PROFILES, audit_selected_deal, best_badugi, parse_cards,
)


def hand_class(cards: list[str], cutoff: tuple[int, ...]) -> str:
    made, ranks = best_badugi(parse_cards(cards))
    if made == 3 and ranks == (0, 5, 9):
        return "three_card_A6T"
    if made == 2 and ranks[0] == 0 and 1 <= ranks[1] <= 5:
        return "two_card_A2_to_A6"
    if made == 4 and ranks[-1] >= 9:
        return "four_card_T_to_K"
    return "other_top30_made_score" if _score_key((made, ranks)) >= cutoff else "other_below_top30_made_score"


def price_band(big_bets: float) -> str:
    if big_bets <= 0:
        raise ValueError("M2 three-action opportunity must face a positive price")
    if big_bets <= 0.5:
        return "le_half_BB"
    if big_bets <= 1:
        return "le_one_BB"
    return "above_one_BB"


def cell_key(cell: dict) -> tuple:
    return (cell["mode"], cell["physicalSeats"], cell["activeSeats"],
            cell["openingPosition"], cell["priceBand"],
            cell["priorRaiseCountCapped"], cell["handClass"])


def opening_position_from_public_button(dealer: int, hero: int,
                                        active: int, physical: int) -> int:
    if (not all(type(value) is int for value in (dealer, hero, active, physical)) or
            not 2 <= active <= physical or not 0 <= dealer < active or
            not 0 <= hero < active):
        raise ValueError("M2 public button or occupied hero seat invalid")
    clockwise = [(dealer + offset) % physical for offset in range(1, physical + 1)
                 if (dealer + offset) % physical < active]
    first = dealer if active == 2 else clockwise[2]
    order = [(first + offset) % physical for offset in range(physical)
             if (first + offset) % physical < active]
    return order.index(hero)


def prior_raises_from_public_actions(events: list[dict], active: int) -> int:
    if not isinstance(events, list):
        raise ValueError("M2 public action history missing")
    count = 0
    for event in events:
        if not isinstance(event, dict) or not isinstance(event.get("type"), str):
            raise ValueError("M2 public action event malformed")
        if event["type"] != "BET_ACTION":
            continue
        if (type(event.get("drawRoundIndex")) is not int or
                event["drawRoundIndex"] != 0 or
                type(event.get("seat")) is not int or
                not 0 <= event["seat"] < active or
                event.get("action") not in ("FOLD", "CHECK", "CALL", "BET", "RAISE")):
            raise ValueError("M2 predraw public BET action malformed")
        count += event["action"] == "RAISE"
    return count


def row_key(row: dict, cutoff: tuple[int, ...]) -> tuple | None:
    target = row.get("target")
    if target is None:
        return None
    physical, active, mode = row["group"]
    if (type(target.get("dealerSeat")) is not int or
            type(target.get("openingPosition")) is not int or
            type(target.get("priorRaiseCount")) is not int or
            target["priorRaiseCount"] < 0):
        raise ValueError("M2 target lacks public button or classification fields")
    position = opening_position_from_public_button(target["dealerSeat"],
                                                   row["heroSeat"], active, physical)
    prior = prior_raises_from_public_actions(target.get("publicActions"), active)
    if target["openingPosition"] != position or target["priorRaiseCount"] != prior:
        raise ValueError("M2 opening position or prior raises disagree with public history")
    return (mode, physical, active, position,
            price_band(target["toCallBigBets"]),
            min(2, prior),
            hand_class(target["actorCurrentCards"], cutoff))


def reconcile(allocation: dict, rows: list[dict], cutoff: tuple[int, ...]) -> dict:
    if allocation.get("status") != "PROSPECTIVE_OPPORTUNITY_QUOTAS_NOT_EV_GATE":
        raise ValueError("M2 allocation is not an opportunity-only plan")
    cells = allocation["cells"]
    if not cells or len({cell_key(cell) for cell in cells}) != len(cells):
        raise ValueError("M2 baseline cells are missing or duplicated")
    count = Counter()
    count_by_profile = Counter()
    no_opportunity = Counter()
    for row in rows:
        key = row_key(row, cutoff)
        if row.get("profile") not in PROFILES:
            raise ValueError("M2 known artificial profile missing")
        if key is None:
            no_opportunity[(row["group"][2], row["group"][0],
                            row["group"][1], row["stratum"], row["profile"])] += 1
        else:
            count[key] += 1
            count_by_profile[(key, row["profile"])] += 1
    result_rows = []
    for cell in cells:
        key = cell_key(cell)
        added = count.pop(key, 0)
        existing = cell["opportunities"]
        quota = cell["planningQuota"]
        result_rows.append({**{name: cell[name] for name in (
            "mode", "physicalSeats", "activeSeats", "openingPosition", "priceBand",
            "priorRaiseCountCapped", "handClass", "priorityTier")},
            "priorOpportunityCount": existing, "newM2OpportunityCount": added,
            "newM2OpportunitiesByKnownArtificialProfile": {
                profile: count_by_profile[(key, profile)] for profile in PROFILES},
            "descriptiveCombinedCount": existing + added,
            "planningDeficitTo200": max(0, quota - existing - added),
            "opportunityState": "PLANNING_QUOTA_MET" if existing + added >= quota
                                else "POSITIVE_BUT_SHORT" if existing + added
                                else "ZERO_FEASIBILITY_UNRESOLVED",
            "actionRecommendation": "INSUFFICIENT_EV"})
    # Newly observed public environments were absent from the original 53.
    # Preserve them separately; never silently discard or call them impossible.
    new_cells = [{"key": list(key), "newM2OpportunityCount": value,
                  "newM2OpportunitiesByKnownArtificialProfile": {
                      profile: count_by_profile[(key, profile)] for profile in PROFILES},
                  "actionRecommendation": "INSUFFICIENT_EV"}
                 for key, value in sorted(count.items())]
    states = Counter(row["opportunityState"] for row in result_rows)
    return {"status": "M2_OPPORTUNITY_COVERAGE_ONLY_NOT_EV",
            "counts": {"baselineCells": len(cells), "collectedRows": len(rows),
                       "newLegalFcrOpportunities": sum(row["newM2OpportunityCount"] for row in result_rows)
                       + sum(count.values()),
                       "noOpportunitySelectedDeals": sum(no_opportunity.values()),
                       "planningQuotaMet": states["PLANNING_QUOTA_MET"],
                       "positiveButShort": states["POSITIVE_BUT_SHORT"],
                       "zeroFeasibilityUnresolved": states["ZERO_FEASIBILITY_UNRESOLVED"],
                       "newlyObservedCells": len(new_cells),
                       "recommendedRangeRows": 0},
            "cells": result_rows, "newlyObservedCells": new_cells,
            "noOpportunityByModeSeatAndOpeningStratum": [
                {"mode": k[0], "physicalSeats": k[1], "activeSeats": k[2],
                 "openingStratum": k[3], "knownArtificialProfile": k[4],
                 "selectedDeals": n}
                for k, n in sorted(no_opportunity.items())],
            "limits": ["200 legal opportunities per cell is a collection-planning proxy, not an EV gate.",
                       "A selected opening stratum does not guarantee a legal F/C/R opportunity.",
                       "Rows are one-hand safety observations under known artificial opponents; no policy return is scored.",
                       "Opponent profile is an audit stratum only and is never an actor inference input.",
                       "M3 local action EV and M4 natural 20-hand policy EV require new independent seeds."]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--allocation", required=True, type=Path)
    parser.add_argument("--allocation-sha256", required=True)
    parser.add_argument("--plan", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError("M2 gap result exists; never overwrite an original")
    if sha256(args.allocation) != args.allocation_sha256:
        raise ValueError("M2 baseline allocation SHA changed")
    allocation = json.loads(args.allocation.read_text())
    if (allocation.get("counts", {}).get("cells") != 265 or
            len(allocation.get("cells", [])) != 265):
        raise ValueError("M2 published allocation must contain 265 cells")
    plan = json.loads(args.plan.read_text())
    folder = args.plan.parent
    selected = json.loads((folder / plan["selectedSeedsFile"]).read_text())
    validate_plan(plan, selected, folder)
    result = json.loads((folder / plan["resultFile"]).read_text())
    rows_file = folder / plan["outputFile"]
    if (result.get("status") != "COMPLETE_OPPORTUNITY_SAFETY_ONLY" or
            result.get("sessions") != len(selected) or
            result.get("planSha256") != sha256(args.plan) or
            result.get("rowsSha256") != sha256(rows_file)):
        raise ValueError("M2 collector incomplete or raw source SHA changed")
    rows = []
    with rows_file.open() as stream:
        for index, line in enumerate(stream):
            row = json.loads(line)
            if (index >= len(selected) or row.get("globalIndex") != index or
                    row.get("seed") != selected[index]["seed"] or
                    row.get("group") != selected[index]["group"] or
                    row.get("profile") != selected[index]["profile"] or
                    row.get("stratum") != selected[index]["stratum"]):
                raise ValueError("M2 raw row diverged from frozen schedule")
            audit_selected_deal(row, row["stratum"])
            rows.append(row)
    if len(rows) != len(selected):
        raise ValueError("M2 raw row count differs from complete collection")
    cutoff = all_starting_score_keys()[int((270725 - 1) * 0.70)]
    output = reconcile(allocation, rows, cutoff)
    output["provenance"] = {"allocationSha256": args.allocation_sha256,
                            "collectorPlanSha256": sha256(args.plan),
                            "collectorRowsSha256": sha256(rows_file)}
    with args.output.open("x") as stream:
        json.dump(output, stream, indent=2)
        stream.write("\n")
    print(json.dumps(output["counts"]))


if __name__ == "__main__":
    main()
