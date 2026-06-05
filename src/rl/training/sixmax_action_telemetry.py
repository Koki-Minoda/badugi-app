"""Shared poker telemetry primitives for 6-max RL trainers."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Any


POSITION_LOG_ORDER = ("BTN", "CO", "MP", "UTG", "BB", "SB")
BETTING_ROUNDS = ("preDraw", "afterDraw1", "afterDraw2", "afterDraw3")
HAND_STRENGTH_CLASSES = ("madeStrong", "madeMedium", "drawStrong", "trash", "unknown")
STEAL_POSITIONS = ("BTN", "CO", "SB")
BLIND_POSITIONS = ("BB", "SB")
EPSILON = 1e-9


def betting_round_name(draw_round: int) -> str:
    if draw_round <= 0:
        return "preDraw"
    if draw_round == 1:
        return "afterDraw1"
    if draw_round == 2:
        return "afterDraw2"
    return "afterDraw3"


def conservative_three_bet_opportunity(
    *,
    draw_round: int,
    facing_bet: bool,
    raise_legal: bool,
    raise_count: int,
) -> bool:
    """Conservative 3bet hook used by trainers/watchers.

    This intentionally counts pre-draw spots where at least one raise already
    exists and hero has a legal raise while facing a bet. Later 4bet/cap spots
    may be included; exact street action history is not available here.
    """
    return draw_round == 0 and facing_bet and raise_legal and raise_count >= 1


def pre_draw_no_voluntary_action_before_hero(
    *,
    players: list[dict[str, Any]],
    dealer_seat: int,
    hero_seat: int,
    sb_amount: int = 1,
    bb_amount: int = 2,
) -> bool:
    """Return whether no non-hero player has voluntarily entered pre-draw.

    This is a conservative telemetry helper. It treats blind baseline chips as
    forced, and any extra bet or opened flag as voluntary action. It does not
    require env transition changes or exact per-seat action history.
    """
    sb_seat = (dealer_seat + 1) % len(players)
    bb_seat = (dealer_seat + 2) % len(players)
    forced_bets = {sb_seat: sb_amount, bb_seat: bb_amount}
    for seat, player in enumerate(players):
        if seat == hero_seat or player.get("folded", False):
            continue
        forced = forced_bets.get(seat, 0)
        if player.get("opened_current_round", False):
            return False
        if int(player.get("bet", 0)) > forced:
            return False
    return True


def conservative_steal_opportunity(
    *,
    position: str | None,
    betting_round: str,
    no_voluntary_action_before_hero: bool,
    bet_legal: bool,
    raise_legal: bool,
) -> bool:
    """Conservative steal opportunity used when exact action history is absent."""
    return (
        betting_round == "preDraw"
        and position in STEAL_POSITIONS
        and no_voluntary_action_before_hero
        and (bet_legal or raise_legal)
    )


def blind_pre_draw_pressure_opportunity(
    *,
    position: str | None,
    betting_round: str,
    facing_bet: bool,
    fold_legal: bool,
) -> bool:
    """Fallback blind-defense opportunity when exact steal aggressor is unknown."""
    return (
        betting_round == "preDraw"
        and position in BLIND_POSITIONS
        and facing_bet
        and fold_legal
    )


def unknown_q_stats() -> dict[str, float | None]:
    return {"qMean": None, "qMin": None, "qMax": None, "qStd": None}


def _zero_counts(size: int) -> list[int]:
    return [0 for _ in range(size)]


def _safe_rate(numerator: int | float, denominator: int | float) -> float:
    return float(numerator) / max(1.0, float(denominator))


def _action_rates(counts: list[int], *, include_all_in: bool = True) -> dict[str, float]:
    decisions = max(1, sum(counts))
    bet = counts[3] if len(counts) > 3 else 0
    raise_count = counts[4] if len(counts) > 4 else 0
    call = counts[2] if len(counts) > 2 else 0
    rates = {
        "foldRate": counts[0] / decisions if len(counts) > 0 else 0.0,
        "checkRate": counts[1] / decisions if len(counts) > 1 else 0.0,
        "callRate": call / decisions,
        "betRate": bet / decisions,
        "pureRaiseRate": raise_count / decisions,
        "aggressionRate": (bet + raise_count) / decisions,
        "aggressionFactor": (bet + raise_count) / max(EPSILON, call),
    }
    if include_all_in:
        rates["allInRate"] = counts[5] / decisions if len(counts) > 5 else 0.0
    return rates


@dataclass
class PositionTelemetry:
    action_count: int = 6
    history_maxlen: int = 100_000
    rewards: deque[float] = field(default_factory=deque)
    bet_action_counts: list[int] = field(default_factory=list)
    facing_bet_decisions: int = 0
    fold_to_bet_actions: int = 0
    hands: int = 0
    vpip_hands: int = 0
    pfr_hands: int = 0
    steal_opportunities: int = 0
    steal_attempts: int = 0
    blind_pressure_opportunities: int = 0
    blind_pressure_folds: int = 0

    def __post_init__(self) -> None:
        if self.rewards.maxlen is None:
            self.rewards = deque(self.rewards, maxlen=self.history_maxlen)
        if not self.bet_action_counts:
            self.bet_action_counts = _zero_counts(self.action_count)

    def record_bet(
        self,
        action: int,
        *,
        facing_bet: bool,
        steal_opportunity: bool = False,
        blind_pressure_opportunity: bool = False,
    ) -> None:
        if 0 <= action < len(self.bet_action_counts):
            self.bet_action_counts[action] += 1
        if facing_bet:
            self.facing_bet_decisions += 1
            if action == 0:
                self.fold_to_bet_actions += 1
        if steal_opportunity:
            self.steal_opportunities += 1
            if action in (3, 4):
                self.steal_attempts += 1
        if blind_pressure_opportunity:
            self.blind_pressure_opportunities += 1
            if action == 0:
                self.blind_pressure_folds += 1

    def record_episode(self, reward: float, *, vpip: bool, pfr: bool) -> None:
        self.rewards.append(float(reward))
        self.hands += 1
        if vpip:
            self.vpip_hands += 1
        if pfr:
            self.pfr_hands += 1

    def summary(self) -> dict[str, float | int | None]:
        rates = _action_rates(self.bet_action_counts, include_all_in=True)
        rates["foldToBetRate"] = _safe_rate(self.fold_to_bet_actions, self.facing_bet_decisions)
        rates["vpip"] = _safe_rate(self.vpip_hands, self.hands)
        rates["pfr"] = _safe_rate(self.pfr_hands, self.hands)
        rates["stealOpportunityCount"] = self.steal_opportunities
        rates["stealAttemptCount"] = self.steal_attempts
        rates["stealRate"] = (
            None
            if self.steal_opportunities <= 0
            else self.steal_attempts / self.steal_opportunities
        )
        rates["foldToPreDrawPressureRate"] = (
            None
            if self.blind_pressure_opportunities <= 0
            else self.blind_pressure_folds / self.blind_pressure_opportunities
        )
        rates["hands"] = self.hands
        rates["rewardAvg"] = sum(self.rewards) / max(1, len(self.rewards))
        return rates


@dataclass
class SixMaxActionTelemetry:
    action_count: int = 6
    max_draw_count: int = 4
    history_maxlen: int = 100_000
    position_names: tuple[str, ...] = POSITION_LOG_ORDER
    bet_action_counts: list[int] = field(default_factory=list)
    facing_bet_decisions: int = 0
    fold_to_bet_actions: int = 0
    draw_actions: int = 0
    drawn_cards: int = 0
    draw_count_distribution: dict[int, int] = field(default_factory=dict)
    terminal_counts: dict[str, int] = field(default_factory=dict)
    showdown_wins: int = 0
    hands: int = 0
    episode_lengths: deque[int] = field(default_factory=deque)
    max_step_hits: int = 0
    vpip_hands: int = 0
    pfr_hands: int = 0
    three_bet_opportunities: int = 0
    three_bet_actions: int = 0
    steal_opportunities: int = 0
    steal_attempts: int = 0
    blind_pressure_opportunities: dict[str, int] = field(default_factory=dict)
    blind_pressure_folds: dict[str, int] = field(default_factory=dict)
    street_action_counts: dict[str, list[int]] = field(default_factory=dict)
    hand_strength_action_counts: dict[str, list[int]] = field(default_factory=dict)
    positions: dict[str, PositionTelemetry] = field(default_factory=dict)
    q_means: deque[float] = field(default_factory=deque)

    def __post_init__(self) -> None:
        if self.episode_lengths.maxlen is None:
            self.episode_lengths = deque(self.episode_lengths, maxlen=self.history_maxlen)
        if self.q_means.maxlen is None:
            self.q_means = deque(self.q_means, maxlen=self.history_maxlen)
        if not self.bet_action_counts:
            self.bet_action_counts = _zero_counts(self.action_count)
        for draw_count in range(self.max_draw_count + 1):
            self.draw_count_distribution.setdefault(draw_count, 0)
        for reason in ("showdown", "fold_win", "fold_loss", "truncated"):
            self.terminal_counts.setdefault(reason, 0)
        for street in BETTING_ROUNDS:
            self.street_action_counts.setdefault(street, _zero_counts(self.action_count))
        for strength_class in HAND_STRENGTH_CLASSES:
            self.hand_strength_action_counts.setdefault(strength_class, _zero_counts(self.action_count))
        for position in self.position_names:
            self.positions.setdefault(
                position,
                PositionTelemetry(action_count=self.action_count, history_maxlen=self.history_maxlen),
            )
        for position in BLIND_POSITIONS:
            self.blind_pressure_opportunities.setdefault(position, 0)
            self.blind_pressure_folds.setdefault(position, 0)
        self._episode_position: str | None = None
        self._episode_vpip = False
        self._episode_pfr = False

    def start_episode(self, *, position: str | None = None) -> None:
        self._episode_position = position
        self._episode_vpip = False
        self._episode_pfr = False

    def record_bet(
        self,
        action: int,
        *,
        facing_bet: bool,
        position: str | None = None,
        betting_round: str = "preDraw",
        is_pre_draw: bool = False,
        three_bet_opportunity: bool = False,
        steal_opportunity: bool = False,
        blind_pressure_opportunity: bool = False,
        hand_strength_class: str = "unknown",
    ) -> None:
        if 0 <= action < len(self.bet_action_counts):
            self.bet_action_counts[action] += 1

        if facing_bet:
            self.facing_bet_decisions += 1
            if action == 0:
                self.fold_to_bet_actions += 1

        street = betting_round if betting_round in self.street_action_counts else "afterDraw3"
        if 0 <= action < len(self.street_action_counts[street]):
            self.street_action_counts[street][action] += 1

        strength_class = hand_strength_class if hand_strength_class in self.hand_strength_action_counts else "unknown"
        if 0 <= action < len(self.hand_strength_action_counts[strength_class]):
            self.hand_strength_action_counts[strength_class][action] += 1

        if position in self.positions:
            self.positions[position].record_bet(
                action,
                facing_bet=facing_bet,
                steal_opportunity=steal_opportunity,
                blind_pressure_opportunity=blind_pressure_opportunity,
            )

        if is_pre_draw:
            if action in (2, 3, 4):
                self._episode_vpip = True
            if action in (3, 4):
                self._episode_pfr = True
            if three_bet_opportunity:
                self.three_bet_opportunities += 1
                if action == 4:
                    self.three_bet_actions += 1
            if steal_opportunity:
                self.steal_opportunities += 1
                if action in (3, 4):
                    self.steal_attempts += 1
            if blind_pressure_opportunity and position in BLIND_POSITIONS:
                self.blind_pressure_opportunities[position] += 1
                if action == 0:
                    self.blind_pressure_folds[position] += 1

    def record_draw(self, draw_count: int) -> None:
        """Record already-normalized draw count.

        Badugi callers usually pass action 0..3 directly. Draw Lowball callers
        should pass action - DRAW_0 so this helper stays action-space neutral.
        """
        normalized = max(0, min(self.max_draw_count, int(draw_count)))
        self.draw_actions += 1
        self.drawn_cards += normalized
        self.draw_count_distribution[normalized] = self.draw_count_distribution.get(normalized, 0) + 1

    def record_episode(
        self,
        *,
        reward: float,
        length: int,
        terminal_reason: str | None,
        truncated: bool = False,
        max_step_hit: bool = False,
        position: str | None = None,
    ) -> None:
        self.hands += 1
        self.episode_lengths.append(max(0, int(length)))
        if max_step_hit:
            self.max_step_hits += 1

        reason = terminal_reason or ("truncated" if truncated or max_step_hit else "unknown")
        if truncated or max_step_hit:
            reason = "truncated"
        elif reason == "fold_win":
            reason = "fold_win" if reward > 0 else "fold_loss"
        elif reason not in self.terminal_counts:
            self.terminal_counts.setdefault(reason, 0)
        self.terminal_counts[reason] = self.terminal_counts.get(reason, 0) + 1

        if reason == "showdown" and reward > 0:
            self.showdown_wins += 1
        if self._episode_vpip:
            self.vpip_hands += 1
        if self._episode_pfr:
            self.pfr_hands += 1

        episode_position = position or self._episode_position
        if episode_position in self.positions:
            self.positions[episode_position].record_episode(
                reward,
                vpip=self._episode_vpip,
                pfr=self._episode_pfr,
            )

    def record_q(self, *, mean_q: float | None = None) -> None:
        if mean_q is not None:
            self.q_means.append(float(mean_q))

    @property
    def bet_decisions(self) -> int:
        return sum(self.bet_action_counts)

    def rates(
        self,
        *,
        include_all_in: bool = True,
        include_fold_to_bet: bool = True,
        include_draw_average: bool = True,
    ) -> dict[str, Any]:
        rates: dict[str, Any] = _action_rates(self.bet_action_counts, include_all_in=include_all_in)
        if include_fold_to_bet:
            rates["foldToBetRate"] = _safe_rate(self.fold_to_bet_actions, self.facing_bet_decisions)
        if include_draw_average:
            rates["drawAverage"] = _safe_rate(self.drawn_cards, self.draw_actions)

        rates["vpip"] = _safe_rate(self.vpip_hands, self.hands)
        rates["pfr"] = _safe_rate(self.pfr_hands, self.hands)
        rates["threeBetRate"] = (
            None
            if self.three_bet_opportunities <= 0
            else self.three_bet_actions / self.three_bet_opportunities
        )
        rates["stealOpportunityCount"] = self.steal_opportunities
        rates["stealAttemptCount"] = self.steal_attempts
        rates["stealRate"] = (
            None
            if self.steal_opportunities <= 0
            else self.steal_attempts / self.steal_opportunities
        )
        rates["foldBbToStealRate"] = None
        rates["foldSbToStealRate"] = None
        rates["bbFoldToPreDrawPressureRate"] = (
            None
            if self.blind_pressure_opportunities.get("BB", 0) <= 0
            else self.blind_pressure_folds.get("BB", 0) / self.blind_pressure_opportunities["BB"]
        )
        rates["sbFoldToPreDrawPressureRate"] = (
            None
            if self.blind_pressure_opportunities.get("SB", 0) <= 0
            else self.blind_pressure_folds.get("SB", 0) / self.blind_pressure_opportunities["SB"]
        )
        rates["patRate"] = _safe_rate(self.draw_count_distribution.get(0, 0), self.draw_actions)

        hands = max(1, self.hands)
        rates["showdownRate"] = _safe_rate(self.terminal_counts.get("showdown", 0), hands)
        rates["foldWinRate"] = _safe_rate(self.terminal_counts.get("fold_win", 0), hands)
        rates["foldLossRate"] = _safe_rate(self.terminal_counts.get("fold_loss", 0), hands)
        rates["truncationRate"] = _safe_rate(self.terminal_counts.get("truncated", 0), hands)
        rates["showdownWinRate"] = _safe_rate(self.showdown_wins, self.terminal_counts.get("showdown", 0))
        rates["avgEpisodeLength"] = sum(self.episode_lengths) / max(1, len(self.episode_lengths))
        rates["maxStepHitRate"] = _safe_rate(self.max_step_hits, hands)
        return rates

    def q_stats(self) -> dict[str, float | None]:
        if not self.q_means:
            return unknown_q_stats()
        # DQNAgent.update currently returns mean Q only. Keep min/max/std null
        # until trainers can pass the full Q sample without changing learning.
        return {
            "qMean": sum(self.q_means) / len(self.q_means),
            "qMin": None,
            "qMax": None,
            "qStd": None,
        }

    def street_summaries(self) -> dict[str, dict[str, float]]:
        return {
            street: _action_rates(counts, include_all_in=True)
            for street, counts in self.street_action_counts.items()
        }

    def hand_strength_summaries(self) -> dict[str, dict[str, float]]:
        return {
            strength_class: _action_rates(counts, include_all_in=True)
            for strength_class, counts in self.hand_strength_action_counts.items()
        }

    def position_summaries(self) -> dict[str, dict[str, float | int | None]]:
        return {position: telemetry.summary() for position, telemetry in self.positions.items()}

    def summary(self) -> dict[str, Any]:
        payload = self.rates(include_all_in=True, include_fold_to_bet=True, include_draw_average=True)
        payload.update(self.q_stats())
        payload.update(
            {
                "drawCountDistribution": {
                    str(draw_count): self.draw_count_distribution.get(draw_count, 0)
                    for draw_count in range(self.max_draw_count + 1)
                },
                "terminalCounts": dict(self.terminal_counts),
                "blindPreDrawPressureCounts": {
                    position: {
                        "opportunities": self.blind_pressure_opportunities.get(position, 0),
                        "folds": self.blind_pressure_folds.get(position, 0),
                    }
                    for position in BLIND_POSITIONS
                },
                "bettingRoundActionStats": self.street_summaries(),
                "positionStats": self.position_summaries(),
                "handStrengthClassStats": self.hand_strength_summaries(),
            }
        )
        return payload

    def format_log(
        self,
        *,
        include_all_in: bool = False,
        include_fold_to_bet: bool = False,
        include_draw_average: bool = False,
        include_foundation: bool = False,
    ) -> str:
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
        if include_foundation:
            position_stats = self.position_summaries()

            def _pct_or_zero(value: float | None) -> float:
                return 0.0 if value is None else value * 100.0

            parts.extend(
                [
                    f"vpip%={rates['vpip']*100:.1f}",
                    f"pfr%={rates['pfr']*100:.1f}",
                    f"af={rates['aggressionFactor']:.2f}",
                    f"steal%={_pct_or_zero(rates['stealRate']):.1f}",
                    f"BTNsteal%={_pct_or_zero(position_stats.get('BTN', {}).get('stealRate')):.1f}",
                    f"COsteal%={_pct_or_zero(position_stats.get('CO', {}).get('stealRate')):.1f}",
                    f"SBsteal%={_pct_or_zero(position_stats.get('SB', {}).get('stealRate')):.1f}",
                    f"bbFtp%={_pct_or_zero(rates['bbFoldToPreDrawPressureRate']):.1f}",
                    f"sbFtp%={_pct_or_zero(rates['sbFoldToPreDrawPressureRate']):.1f}",
                    f"sd%={rates['showdownRate']*100:.1f}",
                    f"wsd%={rates['showdownWinRate']*100:.1f}",
                    (
                        "term=["
                        f"sd:{self.terminal_counts.get('showdown', 0)} "
                        f"fw:{self.terminal_counts.get('fold_win', 0)} "
                        f"fl:{self.terminal_counts.get('fold_loss', 0)} "
                        f"tr:{self.terminal_counts.get('truncated', 0)}"
                        "]"
                    ),
                    f"epLen={rates['avgEpisodeLength']:.1f}",
                    "drawDist=["
                    + " ".join(
                        f"{draw_count}:{self.draw_count_distribution.get(draw_count, 0)}"
                        for draw_count in range(self.max_draw_count + 1)
                    )
                    + "]",
                ]
            )
        return " ".join(parts)
