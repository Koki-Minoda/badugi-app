"""6-max draw lowball self-play environment.

Phase 1 environment-only implementation for D01/D02/S01/S02 6-max training.
The observation and action shape stay compatible with existing draw DQN
checkpoints: obs_dim=96 and actions 0..10.
"""

from __future__ import annotations

import random
from collections import deque
from typing import TYPE_CHECKING

import numpy as np
from gymnasium import spaces

from rl.env.draw_lowball_env import (
    DRAW_OBSERVATION_VECTOR_SIZE,
    DrawFamily,
    _draw_adjusted_strength,
    build_deck,
    compare_lowball,
    discard_indexes_for_family,
    evaluate_lowball,
)

if TYPE_CHECKING:
    from rl.agents.dqn_agent import DQNAgent

NUM_PLAYERS = 6
MAX_BETS = 4
SMALL_BET = 2
BIG_BET = 4
STARTING_STACK = 100
SB_AMOUNT = 1
BB_AMOUNT = 2

FOLD, CHECK, CALL, BET, RAISE = 0, 1, 2, 3, 4
DRAW_0, DRAW_1, DRAW_2, DRAW_3, DRAW_4, DRAW_5 = 5, 6, 7, 8, 9, 10


def _new_player(stack: int) -> dict:
    return {
        "stack": stack,
        "bet": 0,
        "hand": [],
        "folded": False,
        "all_in": False,
        "draw_history": [0, 0, 0],
        "last_draw": 0,
        "total_draws": 0,
        "bet_history": [False, False, False],
        "opened_current_round": False,
        "raised_predraw": False,
        "discarded": [],
    }


class SixMaxDrawLowballEnv:
    """Fixed-limit 6-max draw lowball environment for self-play.

    Supported variant parameters:
    - D01: family="low-27", max_draws=3
    - D02: family="low-a5", max_draws=3
    - S01: family="low-27", max_draws=1
    - S02: family="low-a5", max_draws=1
    """

    metadata = {"render.modes": ["human"]}

    def __init__(
        self,
        family: DrawFamily = "low-27",
        max_draws: int = 3,
        seed: int | None = None,
        opp_epsilon: float = 0.05,
    ) -> None:
        if family not in {"low-27", "low-a5"}:
            raise ValueError(f"Unsupported draw family: {family!r}")
        self.family = family
        self.max_draws = max(1, min(3, int(max_draws)))
        self.rng = random.Random(seed)
        self.opp_epsilon = float(opp_epsilon)
        self._hero_seat_counter = 0

        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(DRAW_OBSERVATION_VECTOR_SIZE,),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(11)

        self.hero_seat = 0
        self._game_ended = False
        self.hero_agent: DQNAgent | None = None
        self.opp_agent: DQNAgent | None = None
        self.reshuffle_count = 0
        self._init_state()

    def set_agents(self, hero_agent: DQNAgent, opp_agent: DQNAgent) -> None:
        self.hero_agent = hero_agent
        self.opp_agent = opp_agent

    def reset(self, *, seed: int | None = None, options=None):
        if seed is not None:
            self.rng.seed(seed)
        self.hero_seat = self._hero_seat_counter % NUM_PLAYERS
        self._hero_seat_counter += 1
        for _ in range(20):
            self._game_ended = False
            self._init_state()
            if not self._game_ended:
                break
        return self._obs_for(self.hero_seat), {}

    def legal_action_mask(self) -> np.ndarray:
        return self._mask_for(self.hero_seat)

    def step(self, hero_action: int) -> tuple:
        mask = self.legal_action_mask()
        if hero_action < 0 or hero_action >= len(mask) or mask[hero_action] <= 0:
            return self._obs_for(self.hero_seat), -2.0, True, False, {"illegal": True}

        cumulative_reward = 0.0

        if self.phase == "BET":
            if not self.bet_queue:
                done, reward, info = self._advance_from_bet(0.0)
                cumulative_reward += reward
                return self._obs_for(self.hero_seat), cumulative_reward, done, False, info

            done, reward, info = self._apply_action(self.hero_seat, hero_action)
            cumulative_reward += reward
            if done:
                return self._obs_for(self.hero_seat), cumulative_reward, True, False, info

            done, reward, info = self._complete_bet_round_and_advance()
            cumulative_reward += reward
            if done:
                return self._obs_for(self.hero_seat), cumulative_reward, True, False, info

        elif self.phase == "DRAW":
            draw_count = max(0, min(5, hero_action - DRAW_0))
            pre_draw_ideal = len(discard_indexes_for_family(self.players[self.hero_seat]["hand"], self.family))
            self._apply_draw(self.hero_seat, draw_count)
            self._apply_all_opponent_draws()
            done, reward, info = self._end_draw_round()
            cumulative_reward += self._draw_quality_reward(draw_count, pre_draw_ideal) + reward
            if done:
                return self._obs_for(self.hero_seat), cumulative_reward, True, False, info

        return self._obs_for(self.hero_seat), cumulative_reward, False, False, {}

    def _init_state(self) -> None:
        self.deck = build_deck()
        self.rng.shuffle(self.deck)
        self.discard_pile: list[tuple[int, int]] = []
        self.reshuffle_count = 0

        self.dealer_seat = (self.hero_seat - self.rng.randint(0, NUM_PLAYERS - 1)) % NUM_PLAYERS
        self.players = [_new_player(STARTING_STACK) for _ in range(NUM_PLAYERS)]

        sb_seat = (self.dealer_seat + 1) % NUM_PLAYERS
        bb_seat = (self.dealer_seat + 2) % NUM_PLAYERS
        self.players[sb_seat]["stack"] -= SB_AMOUNT
        self.players[sb_seat]["bet"] = SB_AMOUNT
        self.players[bb_seat]["stack"] -= BB_AMOUNT
        self.players[bb_seat]["bet"] = BB_AMOUNT
        self.pot = SB_AMOUNT + BB_AMOUNT
        self.current_bet = BB_AMOUNT

        for player in self.players:
            player["hand"] = [self.deck.pop() for _ in range(5)]

        self.phase = "BET"
        self.draw_round = 0
        self.bet_round_idx = 0
        self.raise_count = 0
        self.terminal_reason: str | None = None

        utg = (self.dealer_seat + 3) % NUM_PLAYERS
        self._setup_bet_queue(utg)
        done, _reward, _info = self._autoplay_until_hero()
        if done:
            self._game_ended = True

    def _setup_bet_queue(self, first_to_act: int) -> None:
        active = self._actionable_seats()
        self.bet_queue = deque()
        for i in range(NUM_PLAYERS):
            seat = (first_to_act + i) % NUM_PLAYERS
            if seat in active:
                self.bet_queue.append(seat)
        self.last_aggressor: int | None = None

    def _autoplay_until_hero(self) -> tuple[bool, float, dict]:
        if self.phase != "BET":
            return False, 0.0, {}
        reward = 0.0
        while self.bet_queue and self.bet_queue[0] != self.hero_seat:
            seat = self.bet_queue[0]
            if self.players[seat]["folded"] or self.players[seat]["all_in"]:
                self.bet_queue.popleft()
                continue
            action = self._get_opp_action_bet(seat)
            done, action_reward, info = self._apply_action(seat, action)
            reward += action_reward
            if done:
                self._game_ended = True
                return True, reward, info
        if not self.bet_queue and self.phase == "BET":
            done, advance_reward, info = self._advance_from_bet(reward)
            return done, advance_reward, info
        return False, reward, {}

    def _complete_bet_round_and_advance(self) -> tuple[bool, float, dict]:
        reward = 0.0
        while self.bet_queue:
            seat = self.bet_queue[0]
            if self.players[seat]["folded"] or self.players[seat]["all_in"]:
                self.bet_queue.popleft()
                continue
            if seat == self.hero_seat:
                return False, reward, {}
            action = self._get_opp_action_bet(seat)
            done, action_reward, info = self._apply_action(seat, action)
            reward += action_reward
            if done:
                return True, reward, info
        return self._advance_from_bet(reward)

    def _advance_from_bet(self, reward: float) -> tuple[bool, float, dict]:
        active = self._active_seats_list()
        if len(active) <= 1:
            winner = active[0] if active else self.hero_seat
            return True, reward + self._settle(winner), {"terminal_reason": "fold_win"}

        if self.draw_round >= self.max_draws:
            return True, reward + self._showdown(), {"terminal_reason": "showdown"}

        self.phase = "DRAW"
        for seat in range(NUM_PLAYERS):
            player = self.players[seat]
            idx = min(2, self.draw_round)
            player["bet_history"][idx] = player["opened_current_round"]
            player["opened_current_round"] = False
            player["bet"] = 0

        draw_start = (self.dealer_seat + 1) % NUM_PLAYERS
        active_set = set(self._active_seats_list())
        self.draw_order = deque()
        for i in range(NUM_PLAYERS):
            seat = (draw_start + i) % NUM_PLAYERS
            if seat in active_set:
                self.draw_order.append(seat)

        while self.draw_order and self.draw_order[0] != self.hero_seat:
            seat = self.draw_order.popleft()
            self._apply_draw(seat, self._get_opp_draw_count(seat))

        if not self.draw_order or self.draw_order[0] == self.hero_seat:
            return False, reward, {}

        self._apply_all_opponent_draws()
        done, end_reward, info = self._end_draw_round()
        return done, reward + end_reward, info

    def _apply_all_opponent_draws(self) -> None:
        remaining = list(self.draw_order)
        if remaining and remaining[0] == self.hero_seat:
            remaining = remaining[1:]
        for seat in remaining:
            if seat != self.hero_seat:
                self._apply_draw(seat, self._get_opp_draw_count(seat))

    def _end_draw_round(self) -> tuple[bool, float, dict]:
        self.draw_round += 1
        self.phase = "BET"
        self.raise_count = 0
        self.current_bet = self._bet_size()
        for player in self.players:
            player["bet"] = 0
        self.bet_round_idx = self.draw_round
        first_post_draw = (self.dealer_seat + 1) % NUM_PLAYERS
        self._setup_bet_queue(first_post_draw)
        return self._autoplay_until_hero()

    def _fold_shaping(self, seat: int) -> float:
        """Immediate hero-fold shaping for draw lowball sixmax self-play."""
        player = self.players[seat]
        to_call = max(0, self.current_bet - player["bet"])
        pot_odds = to_call / max(1, self.pot + to_call) if to_call > 0 else 0.0
        features = evaluate_lowball(player["hand"], self.family)
        effective_strength = _draw_adjusted_strength(player["hand"], self.family, features)
        if effective_strength < pot_odds:
            return 0.15
        equity_missed = effective_strength - pot_odds
        return -max(0.30, min(0.90, 0.20 + equity_missed * 1.5))

    def _apply_action(self, seat: int, action: int) -> tuple[bool, float, dict]:
        player = self.players[seat]
        to_call = max(0, self.current_bet - player["bet"])
        bet_size = self._bet_size()

        if action == FOLD:
            player["folded"] = True
            if seat == self.hero_seat:
                self.terminal_reason = "hero_fold"
                return True, self._fold_shaping(seat), {"terminal_reason": "hero_fold"}
            active = self._active_seats_list()
            if len(active) == 1:
                return True, self._settle(active[0]), {"terminal_reason": "fold_win"}
            if self.bet_queue:
                self.bet_queue.popleft()
            return False, 0.0, {}

        if action == CHECK:
            if self.bet_queue:
                self.bet_queue.popleft()
            return False, 0.0, {}

        if action == CALL:
            self._commit(seat, to_call)
            if self.bet_queue:
                self.bet_queue.popleft()
            return False, 0.0, {}

        if action == BET:
            self._commit(seat, bet_size)
            self.current_bet = player["bet"]
            player["opened_current_round"] = True
            self._on_raise(seat)
            return False, 0.0, {}

        if action == RAISE:
            self._commit(seat, to_call + bet_size)
            self.current_bet = player["bet"]
            self.raise_count += 1
            player["opened_current_round"] = True
            if self.draw_round == 0:
                player["raised_predraw"] = True
            self._on_raise(seat)
            return False, 0.0, {}

        return False, 0.0, {}

    def _on_raise(self, aggressor: int) -> None:
        self.last_aggressor = aggressor
        active = self._actionable_seats()
        new_queue: deque = deque()
        for i in range(1, NUM_PLAYERS):
            seat = (aggressor + i) % NUM_PLAYERS
            if seat in active:
                new_queue.append(seat)
        self.bet_queue = new_queue

    def _commit(self, seat: int, amount: int) -> int:
        if amount <= 0:
            return 0
        player = self.players[seat]
        paid = min(int(amount), player["stack"])
        player["stack"] -= paid
        player["bet"] += paid
        self.pot += paid
        if player["stack"] == 0:
            player["all_in"] = True
        return paid

    def _apply_draw(self, seat: int, draw_count: int) -> None:
        player = self.players[seat]
        draw_count = max(0, min(5, int(draw_count)))
        discards = discard_indexes_for_family(player["hand"], self.family, target_count=draw_count)
        discarded_cards = [player["hand"][index] for index in discards]
        keep = [card for index, card in enumerate(player["hand"]) if index not in discards]
        keep.extend(self._draw_cards(5 - len(keep)))

        player["hand"] = keep[:5]
        player["discarded"].extend(discarded_cards)
        player["last_draw"] = draw_count
        player["draw_history"][min(2, self.draw_round)] = draw_count
        player["total_draws"] += draw_count
        self.discard_pile.extend(discarded_cards)

    def _draw_cards(self, count: int) -> list[tuple[int, int]]:
        cards: list[tuple[int, int]] = []
        while len(cards) < count:
            if not self.deck:
                if self.discard_pile:
                    self.rng.shuffle(self.discard_pile)
                    self.deck.extend(self.discard_pile)
                    self.discard_pile = []
                    self.reshuffle_count += 1
                else:
                    self.deck = build_deck()
                    self.rng.shuffle(self.deck)
                    self.reshuffle_count += 1
            cards.append(self.deck.pop())
        return cards

    def _settle(self, winner: int) -> float:
        self.terminal_reason = "fold_win"
        if winner == self.hero_seat:
            return 1.0 + min(2.0, self.pot / 40.0)
        return -1.0

    def _showdown(self) -> float:
        self.terminal_reason = "showdown"
        active = self._active_seats_list()
        winners = [active[0]]
        for seat in active[1:]:
            result = compare_lowball(self.players[seat]["hand"], self.players[winners[0]]["hand"], self.family)
            if result > 0:
                winners = [seat]
            elif result == 0:
                winners.append(seat)
        if self.hero_seat in winners:
            if len(winners) > 1:
                return 0.05
            return 1.0 + min(2.0, self.pot / 40.0)
        return -1.0

    def _get_opp_actions_batched(self, seats: list[int], phase: str) -> list[int]:
        if not seats:
            return []
        if self.opp_agent is None:
            return [
                self._fallback_bet(seat) if phase == "BET" else DRAW_0 + self._fallback_draw_count(seat)
                for seat in seats
            ]

        import torch

        device = getattr(self.opp_agent, "device", "cpu")
        obs_batch = np.stack([self._obs_for(seat) for seat in seats], axis=0)
        with torch.no_grad():
            q_batch = self.opp_agent.q_network(
                torch.tensor(obs_batch, dtype=torch.float32, device=device)
            ).detach().cpu().numpy()

        actions: list[int] = []
        for idx, seat in enumerate(seats):
            q_values = q_batch[idx].copy()
            mask = self._mask_for(seat)
            q_values[mask <= 0] = -1e9
            if self.opp_epsilon > 0 and np.random.random() < self.opp_epsilon:
                legal = np.where(mask > 0)[0]
                actions.append(int(np.random.choice(legal)))
            else:
                actions.append(int(np.argmax(q_values)))
        return actions

    def _get_opp_action_bet(self, seat: int) -> int:
        return self._get_opp_actions_batched([seat], "BET")[0]

    def _get_opp_draw_count(self, seat: int) -> int:
        action = self._get_opp_actions_batched([seat], "DRAW")[0]
        return max(0, min(5, action - DRAW_0))

    def _fallback_bet(self, seat: int) -> int:
        player = self.players[seat]
        features = evaluate_lowball(player["hand"], self.family)
        effective_strength = _draw_adjusted_strength(player["hand"], self.family, features)
        mask = self._mask_for(seat)
        to_call = max(0, self.current_bet - player["bet"])

        if to_call > 0:
            if effective_strength >= 0.76 and mask[RAISE] > 0:
                return RAISE
            if effective_strength >= 0.42 or to_call <= max(1, self.pot // 12):
                return CALL if mask[CALL] > 0 else FOLD
            return FOLD
        if effective_strength >= 0.58 and mask[BET] > 0:
            return BET
        return CHECK

    def _fallback_draw_count(self, seat: int) -> int:
        return max(0, min(5, len(discard_indexes_for_family(self.players[seat]["hand"], self.family))))

    def _mask_for(self, seat: int) -> np.ndarray:
        mask = np.zeros(11, dtype=np.float32)
        if self.phase == "DRAW":
            mask[DRAW_0 : DRAW_5 + 1] = 1.0
            return mask

        player = self.players[seat]
        to_call = max(0, self.current_bet - player["bet"])
        bet_size = self._bet_size()
        if to_call > 0:
            mask[FOLD] = 1.0
            if player["stack"] >= to_call:
                mask[CALL] = 1.0
            if self.raise_count < MAX_BETS and player["stack"] >= to_call + bet_size:
                mask[RAISE] = 1.0
        else:
            mask[CHECK] = 1.0
            if player["stack"] >= bet_size:
                mask[BET] = 1.0
        return mask

    def _obs_for(self, seat: int) -> np.ndarray:
        player = self.players[seat]
        hand = player["hand"]
        active_opps = [opp for opp in self._active_seats_list() if opp != seat]
        features = evaluate_lowball(hand, self.family)
        to_call = max(0, self.current_bet - player["bet"])
        pot_odds = to_call / max(1, self.pot + to_call) if to_call > 0 else 0.0
        position_fraction = self._position_fraction(seat)
        mask = self._mask_for(seat)

        opp_last_draws = [self.players[opp]["last_draw"] for opp in active_opps]
        opp_draw_hist = [
            np.mean([self.players[opp]["draw_history"][idx] for opp in active_opps]) if active_opps else 0.0
            for idx in range(3)
        ]
        opp_total_draws = np.mean([self.players[opp]["total_draws"] for opp in active_opps]) if active_opps else 0.0
        opp_last_draw_avg = float(np.mean(opp_last_draws)) if opp_last_draws else 0.0
        opp_opened = any(self.players[opp]["opened_current_round"] for opp in active_opps)
        opp_bet_hist = [
            any(self.players[opp]["bet_history"][idx] for opp in active_opps)
            for idx in range(3)
        ]
        opp_stack_avg = np.mean([self.players[opp]["stack"] for opp in active_opps]) if active_opps else STARTING_STACK

        vector = np.zeros(DRAW_OBSERVATION_VECTOR_SIZE, dtype=np.float32)
        vector[0] = self.draw_round / max(1, self.max_draws)
        vector[1] = 1.0 if self.phase == "BET" else 0.0
        vector[2] = 1.0 if self.phase == "DRAW" else 0.0
        vector[3] = pot_odds
        vector[4] = min(self.pot, 100) / 100.0
        vector[5] = 1.0 if seat == self.dealer_seat else 0.0
        vector[6] = 1.0 if self.phase == "BET" and self.draw_round >= self.max_draws else 0.0
        vector[7] = opp_last_draw_avg / 5.0
        vector[8] = 0.05
        vector[9] = 0.54
        vector[10] = 0.50
        vector[11] = 0.76
        vector[12] = (self.max_draws - self.draw_round) / max(1, self.max_draws)
        vector[13] = opp_draw_hist[0] / 5.0
        vector[14] = opp_draw_hist[1] / 5.0
        vector[15] = features.made_cards / 5.0
        vector[16] = features.highest_rank / 14.0
        vector[17] = features.rank_sum / 70.0
        vector[18] = features.duplicate_ranks / 4.0
        vector[19] = features.duplicate_suits / 4.0
        vector[20] = 1.0 if features.straight else 0.0
        vector[21] = 1.0 if features.flush else 0.0
        vector[22] = features.strength
        vector[23] = opp_draw_hist[2] / 5.0
        vector[24] = min(1.0, opp_total_draws / 15.0)
        vector[25] = self.current_bet / 20.0
        vector[26] = self.raise_count / MAX_BETS
        vector[27] = 1.0 if opp_last_draw_avg == 0 and self.draw_round > 0 else 0.0
        vector[28] = 1.0 if opp_opened else 0.0
        vector[29] = 1.0 if opp_bet_hist[0] else 0.0
        vector[30] = 1.0 if opp_bet_hist[1] else 0.0
        vector[41] = 1.0 if self.family == "low-27" else 0.0
        vector[42] = 1.0 if self.family == "low-a5" else 0.0

        discards = discard_indexes_for_family(hand, self.family)
        kept = [card for index, card in enumerate(hand) if index not in discards]
        discount = max(0.40, 1.0 - len(discards) * 0.12)
        if kept:
            kept_features = evaluate_lowball(kept, self.family)
            draw_target_strength = kept_features.strength * discount
            draw_target_rank = kept_features.highest_rank / 14.0
        else:
            draw_target_strength = 0.0
            draw_target_rank = 1.0

        is_a5 = self.family == "low-a5"
        premium_ranks = {14, 2, 3, 4, 5} if is_a5 else {2, 3, 4, 5}
        blocker_rank = 14 if is_a5 else 2

        vector[31] = draw_target_strength
        vector[32] = len(discards) / 5.0
        vector[33] = len(active_opps) / 5.0
        vector[34] = position_fraction
        vector[35] = self._players_yet_to_act(seat) / 5.0
        vector[36] = draw_target_strength
        vector[37] = draw_target_rank
        vector[38] = sum(1 for rank, _suit in hand if rank in premium_ranks) / 5.0
        vector[39] = sum(1 for rank, _suit in hand if rank == blocker_rank) / 4.0
        vector[43] = self._original_raiser_position_fraction(active_opps)
        vector[44] = max(0.0, (len(active_opps) - 1) / 5.0)
        vector[45] = 1.0 if opp_opened else 0.0

        big_bet = BIG_BET
        remaining = max(1, self.max_draws - self.draw_round + (1 if self.phase == "BET" else 0))
        vector[46] = player["stack"] / max(1, big_bet * 4 * remaining)
        vector[47] = 1.0 if self.draw_round >= 2 else 0.0

        vector[48 : 48 + len(mask)] = mask
        vector[59] = 1.0 if player["raised_predraw"] else 0.0
        vector[60] = 1.0 if player["bet_history"][0] else 0.0
        vector[61] = 1.0 if player["bet_history"][1] else 0.0
        vector[62] = 1.0 if (not player["bet_history"][0] and not opp_bet_hist[0] and self.draw_round >= 1) else 0.0
        vector[63] = 1.0 if (not player["bet_history"][1] and not opp_bet_hist[1] and self.draw_round >= 2) else 0.0
        vector[64] = 1.0 if self._players_yet_to_act(seat) > 0 else 0.0
        vector[65] = player["draw_history"][0] / 5.0
        vector[66] = player["draw_history"][1] / 5.0
        vector[67] = (opp_draw_hist[0] - opp_draw_hist[1]) / 5.0
        vector[68] = (opp_draw_hist[1] - opp_draw_hist[2]) / 5.0
        vector[69] = (opp_last_draw_avg - player["last_draw"]) / 5.0
        vector[70] = sum(1 for rank, _suit in player["discarded"] if rank == blocker_rank) / 4.0
        dead_denom = 20.0 if is_a5 else 16.0
        vector[71] = min(1.0, sum(1 for rank, _suit in player["discarded"] if rank in premium_ranks) / dead_denom)
        vector[72] = 1.0 - opp_last_draw_avg / 5.0
        vector[73] = sum(1 for value in opp_draw_hist[: self.draw_round] if value == 0) / max(1, self.max_draws)
        vector[74] = opp_stack_avg / max(1, STARTING_STACK)
        vector[75] = player["stack"] / max(1, STARTING_STACK)
        vector[76] = min(2.0, opp_stack_avg / max(1, player["stack"])) / 2.0
        vector[77] = player["stack"] / max(1, player["stack"] + sum(self.players[opp]["stack"] for opp in active_opps))
        vector[78] = 0.0
        vector[79] = 0.0
        vector[80] = self.max_draws / 3.0
        return vector

    def _position_fraction(self, seat: int) -> float:
        seats_in_order = [(self.dealer_seat + 1 + i) % NUM_PLAYERS for i in range(NUM_PLAYERS)]
        try:
            position = seats_in_order.index(seat)
        except ValueError:
            position = 0
        return position / (NUM_PLAYERS - 1)

    def _players_yet_to_act(self, seat: int) -> int:
        queue = self.draw_order if self.phase == "DRAW" and hasattr(self, "draw_order") else self.bet_queue
        items = list(queue)
        if seat not in items:
            return 0
        index = items.index(seat)
        return sum(1 for other in items[index + 1 :] if not self.players[other]["folded"])

    def _original_raiser_position_fraction(self, active_opps: list[int]) -> float:
        opened = [seat for seat in active_opps if self.players[seat]["bet_history"][0]]
        if not opened:
            return 0.0
        return self._position_fraction(opened[0])

    def _bet_size(self) -> int:
        return BIG_BET if self.draw_round >= 2 else SMALL_BET

    def _draw_quality_reward(self, draw_count: int, pre_draw_ideal: int | None = None) -> float:
        ideal = pre_draw_ideal
        if ideal is None:
            ideal = len(discard_indexes_for_family(self.players[self.hero_seat]["hand"], self.family))
        return 0.12 - abs(draw_count - ideal) * 0.08

    def _active_seats(self) -> set[int]:
        return {seat for seat, player in enumerate(self.players) if not player["folded"]}

    def _active_seats_list(self) -> list[int]:
        return [seat for seat, player in enumerate(self.players) if not player["folded"]]

    def _actionable_seats(self) -> set[int]:
        return {
            seat
            for seat, player in enumerate(self.players)
            if not player["folded"] and not player["all_in"]
        }


def _run_random_legal_episodes(
    *,
    label: str,
    family: DrawFamily,
    max_draws: int,
    episodes: int = 200,
    max_steps: int = 160,
) -> dict:
    rng = random.Random(10_000 + max_draws + (1 if family == "low-a5" else 0))
    env = SixMaxDrawLowballEnv(family=family, max_draws=max_draws, seed=17, opp_epsilon=0.0)
    for episode in range(episodes):
        obs, _info = env.reset(seed=episode)
        steps = 0
        done = False
        while not done and steps < max_steps:
            assert obs.shape == (DRAW_OBSERVATION_VECTOR_SIZE,), f"{label}: bad obs shape {obs.shape}"
            mask = env.legal_action_mask()
            legal = np.flatnonzero(mask > 0)
            assert len(legal) > 0, f"{label}: empty legal mask at episode={episode} step={steps}"
            obs, _reward, terminated, truncated, _info = env.step(int(rng.choice(list(legal))))
            done = bool(terminated or truncated)
            steps += 1
        assert done, f"{label}: episode {episode} did not complete within {max_steps} steps"
    return {"label": label, "episodes": episodes, "status": "ok"}


def _stress_reshuffle_path(*, label: str, family: DrawFamily, max_draws: int) -> dict:
    env = SixMaxDrawLowballEnv(family=family, max_draws=max_draws, seed=99, opp_epsilon=0.0)
    env.reset(seed=99)
    env.discard_pile = list(env.deck)
    env.deck = []
    env.phase = "DRAW"
    env.draw_round = 0
    before = env.reshuffle_count
    for seat in env._active_seats_list():
        env._apply_draw(seat, 5)
        assert len(env.players[seat]["hand"]) == 5, f"{label}: hand size changed after reshuffle draw"
    assert env.reshuffle_count > before, f"{label}: reshuffle path was not exercised"
    return {"label": label, "reshuffles": env.reshuffle_count - before, "status": "ok"}


def _run_smoke() -> None:
    slices = [
        ("S02", "low-a5", 1, False),
        ("S01", "low-27", 1, False),
        ("D02", "low-a5", 3, True),
        ("D01", "low-27", 3, True),
    ]
    results = []
    for label, family, max_draws, stress_reshuffle in slices:
        results.append(_run_random_legal_episodes(label=label, family=family, max_draws=max_draws))
        if stress_reshuffle:
            results.append(_stress_reshuffle_path(label=label, family=family, max_draws=max_draws))
    for result in results:
        print(result)


if __name__ == "__main__":
    _run_smoke()
