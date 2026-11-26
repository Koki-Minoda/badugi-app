"""Build and check the priority M2 preregistration design without dealing cards."""

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path

from rl.training.collect_badugi_entry_m2_draft import opening_order
from rl.training.entry_m2_sampling_contract import (
    DECK_MODULUS, GROUPS, PROFILES, TOTAL_INITIAL_HANDS, best_badugi, parse_cards, stratum,
)
from rl.training.summarize_badugi_entry_m2_gaps import (
    cell_key, opening_position_from_public_button,
)


TARGETS_SHA256 = "f0af25a5eabf23a314fd97ea2882f50712ea9927a3e632afffe71208b4fc7bfd"
ACCEPTED_PER_PROFILE = 20
ACCEPTED_PER_QUEUE = ACCEPTED_PER_PROFILE * len(PROFILES)
FIRST_HAND_DEALER = 0
HAND_DESIGN = {
    # Hand class: (collector stratum, exact catalog frequency, preview cap).
    "three_card_A6T": ("A6T_boundary", 636, 60_000),
    "two_card_A2_to_A6": ("A2_A6_two_card", 15_280, 2_500),
    "four_card_T_to_K": ("T_K_four_card", 14_136, 2_800),
}


def load_priority_targets(path: Path) -> list[dict]:
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != TARGETS_SHA256:
        raise ValueError("M2 priority target original SHA changed")
    targets = json.loads(content)["targets"]
    if len(targets) != 62 or len({cell_key(target) for target in targets}) != 62:
        raise ValueError("M2 priority target original does not contain 62 unique conditions")
    return targets


def _shortage_probability(cap: int, probability: float) -> float:
    """Pointwise binomial probability of fewer than the planned accepts."""
    if cap < ACCEPTED_PER_QUEUE:
        return 1.0
    mass = math.exp(cap * math.log1p(-probability))
    total = mass
    for hits in range(1, ACCEPTED_PER_QUEUE):
        mass *= (cap - hits + 1) * probability / (hits * (1 - probability))
        total += mass
    return total


def build_design(targets: list[dict]) -> dict:
    blocks = {(target["mode"], target["physicalSeats"], target["activeSeats"],
               target["openingPosition"], target["handClass"])
              for target in targets}
    queues = []
    offset = 0
    union_bound = 0.0
    for mode, physical, occupied, position, hand in sorted(blocks):
        group = (physical, occupied, mode)
        if (group not in GROUPS or type(position) is not int or not 0 <= position < occupied or
                hand not in HAND_DESIGN):
            raise ValueError("M2 priority target has an invalid predeal block")
        opening_stratum, catalog_count, cap = HAND_DESIGN[hand]
        shortage = _shortage_probability(cap, catalog_count / TOTAL_INITIAL_HANDS)
        queues.append({
            "queueIndex": len(queues), "group": list(group), "openingPosition": position,
            "expectedOpeningDealerSeat": FIRST_HAND_DEALER,
            "heroSeat": opening_order(FIRST_HAND_DEALER, occupied, physical)[position],
            "handClass": hand, "stratum": opening_stratum,
            "reservedOffset": offset, "maxPreviews": cap, "requiredAccepts": ACCEPTED_PER_QUEUE,
        })
        offset += cap
        union_bound += shortage
    if len(queues) != 49 or offset != 1_391_100:
        raise ValueError("M2 priority design differs from planned queue count or budget")
    return {
        "schema": "mgx-d03-entry-m2-priority-screen-design/v2",
        "status": "DESIGN_ONLY_NO_SEEDS",
        "targetsSha256": TARGETS_SHA256,
        "maxReservedDeals": offset,
        "plannedCompletedAttempts": len(queues) * ACCEPTED_PER_QUEUE,
        "acceptedPerProfilePerQueue": ACCEPTED_PER_PROFILE,
        "profilesInAcceptanceOrder": list(PROFILES),
        "binomialPlanningUnionBound": union_bound,
        "queues": queues,
        "rule": "First 100 own-card matches per queue; after each match assign the next "
                "profile in a fixed cycle. Mark shortage at the cap. "
                "Reserve and exclude full queue suffixes even after an early stop.",
        "limits": "Independent uniform initial deals approximation only; "
                  "this design contains no seeds or authorization to screen or collect.",
    }


def verify_selected_schedule(design: dict, selected: list[dict]) -> None:
    """Check a proposed full schedule after the independent preview recount."""
    queues = design["queues"]
    counts = Counter()
    seeds = set()
    previous = (-1, -1)
    for row in selected:
        index, ordinal, seed = row.get("queueIndex"), row.get("screenOrdinal"), row.get("seed")
        if (type(index) is not int or not 0 <= index < len(queues) or
                type(ordinal) is not int or not 0 <= ordinal < queues[index]["maxPreviews"] or
                (index, ordinal) <= previous or
                type(seed) is not int or not 0 <= seed < DECK_MODULUS or seed in seeds):
            raise ValueError("M2 priority selected queue, ordinal or seed is invalid")
        previous = (index, ordinal)
        seeds.add(seed)
        queue = queues[index]
        if (type(row.get("reservedIndex")) is not int or
                row["reservedIndex"] != queue["reservedOffset"] + ordinal or
                row.get("group") != queue["group"] or
                row.get("profile") != PROFILES[counts[index] % len(PROFILES)] or
                row.get("stratum") != queue["stratum"] or
                type(row.get("expectedOpeningPosition")) is not int or
                row["expectedOpeningPosition"] != queue["openingPosition"] or
                row.get("expectedOpeningDealerSeat") != queue["expectedOpeningDealerSeat"] or
                row.get("heroSeat") != queue["heroSeat"]):
            raise ValueError("M2 priority selected row differs from its predeal allocation")
        physical, occupied, _ = queue["group"]
        position = opening_position_from_public_button(
            row.get("expectedOpeningDealerSeat"), row.get("heroSeat"), occupied, physical,
        )
        cards = row.get("expectedOpeningActorCards")
        if (position != queue["openingPosition"] or
                stratum(*best_badugi(parse_cards(cards))) != queue["stratum"]):
            raise ValueError("M2 priority selected opening position or hand class differs")
        counts[index] += 1
    if any(counts[queue["queueIndex"]] != queue["requiredAccepts"] for queue in queues):
        raise ValueError("M2 priority selected schedule has an incomplete or overfilled queue")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--targets", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    design = build_design(load_priority_targets(args.targets))
    with args.output.open("x") as out:
        json.dump(design, out, indent=2)
        out.write("\n")


if __name__ == "__main__":
    main()
