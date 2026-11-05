"""Deterministic D03 Pro training-session schedule; no model or evaluation data.

Each consecutive 40-session block covers every cash/MTT table and scripted
opponent profile once. A session is capped at 20 hands and is restarted on
target elimination; callers must record actual hands before a stop gate.
"""
from __future__ import annotations

from dataclasses import dataclass

PROFILES = ("passive", "pressure", "draw_heavy", "random_legal")
TABLES = ((2, 2), (3, 3), (6, 6), (6, 2), (6, 3))


@dataclass(frozen=True)
class SessionSpec:
    index: int
    seed: int
    seat_count: int
    occupied_count: int
    tournament: bool
    opponent_profile: str
    target_seat_offset: int


def session_spec(index: int, seed_base: int) -> SessionSpec:
    if index < 0 or seed_base < 0:
        raise ValueError("session index and seed base must be nonnegative")
    table_index = index % 10
    seat_count, occupied_count = TABLES[table_index % 5]
    return SessionSpec(
        index=index,
        seed=seed_base + index,
        seat_count=seat_count,
        occupied_count=occupied_count,
        tournament=table_index >= 5,
        opponent_profile=PROFILES[(index // 10) % len(PROFILES)],
        target_seat_offset=(index // 40) % occupied_count,
    )
