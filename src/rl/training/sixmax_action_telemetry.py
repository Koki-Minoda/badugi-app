"""Shared action-frequency telemetry helpers for 6-max RL trainers."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class SixMaxActionTelemetry:
    bet_action_counts: list[int] = field(default_factory=lambda: [0, 0, 0, 0, 0, 0])
    facing_bet_decisions: int = 0
    fold_to_bet_actions: int = 0
    draw_actions: int = 0
    drawn_cards: int = 0

    def record_bet(self, action: int, *, facing_bet: bool) -> None:
        if 0 <= action < len(self.bet_action_counts):
            self.bet_action_counts[action] += 1
        if facing_bet:
            self.facing_bet_decisions += 1
            if action == 0:
                self.fold_to_bet_actions += 1

    def record_draw(self, draw_count: int) -> None:
        self.draw_actions += 1
        self.drawn_cards += max(0, int(draw_count))

    @property
    def bet_decisions(self) -> int:
        return sum(self.bet_action_counts)

    def rates(self, *, include_all_in: bool = True, include_fold_to_bet: bool = True, include_draw_average: bool = True) -> dict:
        decisions = max(1, self.bet_decisions)
        rates = {
            "foldRate": self.bet_action_counts[0] / decisions,
            "checkRate": self.bet_action_counts[1] / decisions,
            "callRate": self.bet_action_counts[2] / decisions,
            "betRate": self.bet_action_counts[3] / decisions,
            "pureRaiseRate": self.bet_action_counts[4] / decisions,
            "aggressionRate": (self.bet_action_counts[3] + self.bet_action_counts[4]) / decisions,
        }
        if include_all_in:
            rates["allInRate"] = self.bet_action_counts[5] / decisions
        if include_fold_to_bet:
            rates["foldToBetRate"] = (
                self.fold_to_bet_actions / max(1, self.facing_bet_decisions)
            )
        if include_draw_average:
            rates["drawAverage"] = self.drawn_cards / max(1, self.draw_actions)
        return rates

    def format_log(self, *, include_all_in: bool = False, include_fold_to_bet: bool = False, include_draw_average: bool = False) -> str:
        rates = self.rates(
            include_all_in=include_all_in,
            include_fold_to_bet=include_fold_to_bet,
            include_draw_average=include_draw_average,
        )
        parts = [
            f"fold%={rates['foldRate']*100:.1f}",
            f"chk%={rates['checkRate']*100:.1f}",
            f"call%={rates['callRate']*100:.1f}",
            f"bet%={rates['betRate']*100:.1f}",
            f"raise%={rates['pureRaiseRate']*100:.1f}",
        ]
        if include_all_in:
            parts.append(f"ai%={rates['allInRate']*100:.1f}")
        parts.append(f"agg%={rates['aggressionRate']*100:.1f}")
        if include_fold_to_bet:
            parts.append(f"ftb%={rates['foldToBetRate']*100:.1f}")
        if include_draw_average:
            parts.append(f"drawAvg={rates['drawAverage']:.2f}")
        return " ".join(parts)
