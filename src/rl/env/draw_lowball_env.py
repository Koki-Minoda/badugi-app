"""Simplified fixed-limit draw lowball environment for 2-7 and A-5 RL.

This environment is intentionally smaller than the production game engine. It
keeps the RL loop variant-aware for D01/S01 and D02/S02 while sharing the
frontend draw ONNX observation/action shape.
"""

from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass
from itertools import combinations
from typing import Literal, Sequence

import gymnasium as gym
import numpy as np
from gymnasium import spaces

Card = tuple[int, int]  # rank 2..14, suit 0..3
DrawFamily = Literal["low-27", "low-a5"]

DRAW_OBSERVATION_VECTOR_SIZE = 96
DRAW_ACTIONS = (
    "fold",
    "check",
    "call",
    "bet",
    "raise",
    "draw_0",
    "draw_1",
    "draw_2",
    "draw_3",
    "draw_4",
    "draw_5",
)


@dataclass(frozen=True)
class LowballFeatures:
    category: int
    ranks_desc: tuple[int, ...]
    made_cards: int
    highest_rank: int
    rank_sum: int
    duplicate_ranks: int
    duplicate_suits: int
    straight: bool
    flush: bool
    strength: float


@dataclass(frozen=True)
class DrawProfile:
    name: str
    open_strength: float
    call_strength: float
    raise_strength: float
    bluff_frequency: float
    draw_extra: int = 0


DRAW_OPPONENT_PROFILES = {
    "beginner": DrawProfile("beginner", 0.46, 0.42, 0.82, 0.02, 1),
    "standard": DrawProfile("standard", 0.54, 0.50, 0.76, 0.05, 0),
    "tight": DrawProfile("tight", 0.62, 0.58, 0.84, 0.02, 0),
    "loose": DrawProfile("loose", 0.40, 0.36, 0.70, 0.08, 1),
    "aggressive": DrawProfile("aggressive", 0.50, 0.46, 0.66, 0.16, 0),
}


def build_deck() -> list[Card]:
    return [(rank, suit) for rank in range(2, 15) for suit in range(4)]


def _is_straight(ranks: Sequence[int], *, family: DrawFamily) -> bool:
    unique = sorted(set(1 if family == "low-a5" and rank == 14 else rank for rank in ranks))
    if len(unique) != 5:
        return False
    return unique[-1] - unique[0] == 4 and len(unique) == 5


def _duplicate_category(counter: Counter[int]) -> int:
    groups = sorted(counter.values(), reverse=True)
    if groups == [4, 1]:
        return 7
    if groups == [3, 2]:
        return 6
    if groups == [3, 1, 1]:
        return 3
    if groups == [2, 2, 1]:
        return 2
    if groups == [2, 1, 1, 1]:
        return 1
    return 0


def evaluate_lowball(hand: Sequence[Card], family: DrawFamily) -> LowballFeatures:
    ranks_raw = [rank for rank, _suit in hand]
    low_ranks = [1 if family == "low-a5" and rank == 14 else rank for rank in ranks_raw]
    suits = [suit for _rank, suit in hand]
    counter = Counter(low_ranks)
    straight = _is_straight(ranks_raw, family=family)
    flush = len(set(suits)) == 1
    category = _duplicate_category(counter)
    if family == "low-27":
        if straight and flush:
            category = max(category, 8)
        elif flush:
            category = max(category, 5)
        elif straight:
            category = max(category, 4)
    ranks_desc = tuple(sorted(low_ranks, reverse=True))
    made_cards = len(counter)
    highest_rank = max(low_ranks)
    rank_sum = sum(low_ranks)
    duplicate_ranks = max(0, len(low_ranks) - len(counter))
    duplicate_suits = max(0, len(suits) - len(set(suits)))
    category_penalty = min(0.7, category * 0.09)
    rank_quality = max(0.0, 1.0 - ((highest_rank - 5) / 9.0) * 0.55 - (rank_sum / 70.0) * 0.25)
    strength = max(0.0, min(1.0, rank_quality - category_penalty + made_cards * 0.025))
    return LowballFeatures(
        category=category,
        ranks_desc=ranks_desc,
        made_cards=made_cards,
        highest_rank=highest_rank,
        rank_sum=rank_sum,
        duplicate_ranks=duplicate_ranks,
        duplicate_suits=duplicate_suits,
        straight=straight,
        flush=flush,
        strength=strength,
    )


def compare_lowball(left: Sequence[Card], right: Sequence[Card], family: DrawFamily) -> int:
    left_eval = evaluate_lowball(left, family)
    right_eval = evaluate_lowball(right, family)
    left_key = (left_eval.category, left_eval.ranks_desc)
    right_key = (right_eval.category, right_eval.ranks_desc)
    if left_key < right_key:
        return 1
    if left_key > right_key:
        return -1
    return 0


def discard_indexes_for_family(hand: Sequence[Card], family: DrawFamily, target_count: int | None = None) -> list[int]:
    features = evaluate_lowball(hand, family)
    if target_count == 0:
        return []
    best_keep: tuple[int, tuple[int, tuple[int, ...]], tuple[int, ...]] | None = None
    max_keep = min(5, len(hand))
    for keep_size in range(max_keep, 0, -1):
        for keep_indexes in combinations(range(len(hand)), keep_size):
            kept = [hand[index] for index in keep_indexes]
            kept_features = evaluate_lowball(kept, family)
            duplicate_free = kept_features.duplicate_ranks == 0
            flush_safe = family == "low-a5" or len({card[1] for card in kept}) > 1 or len(kept) < 5
            straight_safe = family == "low-a5" or not _is_straight([card[0] for card in kept], family=family) or len(kept) < 5
            score = (
                1 if duplicate_free and flush_safe and straight_safe else 0,
                (-kept_features.highest_rank, -kept_features.rank_sum),
                tuple(sorted(keep_indexes)),
            )
            if best_keep is None or score > best_keep:
                best_keep = score
        if best_keep and best_keep[0] > 0:
            break
    keep = set(best_keep[2] if best_keep else ())
    discards = [index for index in range(len(hand)) if index not in keep]
    if target_count is not None:
        if len(discards) > target_count:
            discards = discards[:target_count]
        elif len(discards) < target_count:
            extras = [index for index in range(len(hand)) if index not in discards]
            extras.sort(key=lambda index: (hand[index][0] if family == "low-27" else (1 if hand[index][0] == 14 else hand[index][0])), reverse=True)
            discards.extend(extras[: target_count - len(discards)])
    if features.category == 0 and features.highest_rank <= (7 if family == "low-27" else 5):
        return []
    return sorted(discards)


class DrawLowballEnv(gym.Env):
    """Fixed-limit heads-up/training-table lowball draw env."""

    metadata = {"render.modes": ["human"]}

    def __init__(
        self,
        family: DrawFamily = "low-27",
        opponent_profile: str = "standard",
        max_draws: int = 3,
        seed: int | None = None,
    ):
        super().__init__()
        if family not in {"low-27", "low-a5"}:
            raise ValueError(f"Unsupported draw family: {family}")
        self.family = family
        self.max_draws = max(1, min(3, int(max_draws)))
        self.random = random.Random(seed)
        self.profile = DRAW_OPPONENT_PROFILES.get(opponent_profile, DRAW_OPPONENT_PROFILES["standard"])
        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(DRAW_OBSERVATION_VECTOR_SIZE,),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(len(DRAW_ACTIONS))
        self.starting_stack = 100
        self.small_bet = 2
        self.reset()

    def set_opponent_profile(self, profile: str):
        self.profile = DRAW_OPPONENT_PROFILES.get(profile, DRAW_OPPONENT_PROFILES["standard"])

    def reset(self, *, seed: int | None = None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            self.random.seed(seed)
        self.deck = build_deck()
        self.random.shuffle(self.deck)
        self.hero_hand = [self.deck.pop() for _ in range(5)]
        self.opp_hand = [self.deck.pop() for _ in range(5)]
        self.phase = "BET"
        self.draw_round = 0
        self.raise_count = 0
        self.pot = 3
        self.hero_stack = self.starting_stack - 1
        self.opp_stack = self.starting_stack - 2
        self.current_bet = 2
        self.hero_bet = 1
        self.opp_bet = 2
        return self._observation(), {}

    def legal_action_mask(self):
        mask = np.zeros(len(DRAW_ACTIONS), dtype=np.float32)
        if self.phase == "BET":
            to_call = max(0, self.current_bet - self.hero_bet)
            if to_call > 0:
                mask[0] = 1
                mask[2] = 1
                if self.raise_count < 4 and self.hero_stack > to_call + self.small_bet:
                    mask[4] = 1
            else:
                mask[1] = 1
                if self.hero_stack >= self.small_bet:
                    mask[3] = 1
        elif self.phase == "DRAW":
            for action in range(5, 11):
                mask[action] = 1
        return mask

    def step(self, action: int):
        if self.legal_action_mask()[action] <= 0:
            return self._observation(), -2.0, True, False, {"illegal": True}
        reward = 0.0
        if self.phase == "BET":
            reward += self._apply_bet_action(action)
            if action == 0:
                return self._observation(), reward, True, False, {"folded": True}
            opp_terminal, opp_reward = self._opponent_bet_response()
            reward += opp_reward
            if opp_terminal:
                return self._observation(), reward, True, False, {"opponentFolded": True}
            if self.draw_round >= self.max_draws:
                terminal_reward = self._showdown_reward()
                self.phase = "SHOWDOWN"
                return self._observation(), reward + terminal_reward, True, False, {"showdown": True}
            self.phase = "DRAW"
        elif self.phase == "DRAW":
            draw_count = action - 5
            self._draw_for("hero", draw_count)
            self._draw_for("opponent", self._opponent_draw_count())
            self.draw_round += 1
            self.phase = "BET"
            self.raise_count = 0
            self.current_bet = 0
            self.hero_bet = 0
            self.opp_bet = 0
            reward += self._draw_quality_reward(draw_count)
        return self._observation(), reward, False, False, {}

    def _commit(self, who: str, amount: int):
        if amount <= 0:
            return 0
        if who == "hero":
            paid = min(amount, self.hero_stack)
            self.hero_stack -= paid
            self.hero_bet += paid
        else:
            paid = min(amount, self.opp_stack)
            self.opp_stack -= paid
            self.opp_bet += paid
        self.pot += paid
        return paid

    def _apply_bet_action(self, action: int) -> float:
        if action == 0:
            return -0.6
        if action == 2:
            to_call = max(0, self.current_bet - self.hero_bet)
            self._commit("hero", to_call)
            return 0.05
        if action == 3:
            self.current_bet = self.small_bet
            self._commit("hero", self.small_bet)
            return 0.08 if evaluate_lowball(self.hero_hand, self.family).strength >= 0.58 else -0.08
        if action == 4:
            to_call = max(0, self.current_bet - self.hero_bet)
            self.current_bet += self.small_bet
            self.raise_count += 1
            self._commit("hero", to_call + self.small_bet)
            return 0.10 if evaluate_lowball(self.hero_hand, self.family).strength >= 0.70 else -0.16
        return 0.0

    def _opponent_bet_response(self) -> tuple[bool, float]:
        features = evaluate_lowball(self.opp_hand, self.family)
        to_call = max(0, self.current_bet - self.opp_bet)
        if to_call > 0:
            if features.strength < self.profile.call_strength and self.random.random() > self.profile.bluff_frequency:
                return True, 0.35
            if features.strength >= self.profile.raise_strength and self.raise_count < 4:
                self.current_bet += self.small_bet
                self.raise_count += 1
                self._commit("opponent", to_call + self.small_bet)
                return False, -0.05
            self._commit("opponent", to_call)
            return False, 0.0
        if features.strength >= self.profile.open_strength or self.random.random() < self.profile.bluff_frequency:
            self.current_bet = self.small_bet
            self._commit("opponent", self.small_bet)
            return False, -0.04
        return False, 0.0

    def _draw_for(self, who: str, draw_count: int):
        hand = self.hero_hand if who == "hero" else self.opp_hand
        discards = discard_indexes_for_family(hand, self.family, target_count=draw_count)
        keep = [card for index, card in enumerate(hand) if index not in discards]
        while len(keep) < 5 and self.deck:
            keep.append(self.deck.pop())
        if who == "hero":
            self.hero_hand = keep
        else:
            self.opp_hand = keep

    def _opponent_draw_count(self) -> int:
        base = len(discard_indexes_for_family(self.opp_hand, self.family))
        return max(0, min(5, base + self.profile.draw_extra))

    def _draw_quality_reward(self, draw_count: int) -> float:
        ideal = len(discard_indexes_for_family(self.hero_hand, self.family))
        distance = abs(draw_count - ideal)
        return 0.12 - distance * 0.08

    def _showdown_reward(self) -> float:
        result = compare_lowball(self.hero_hand, self.opp_hand, self.family)
        if result > 0:
            return 1.0 + min(2.0, self.pot / 40.0)
        if result < 0:
            return -1.0
        return 0.05

    def _observation(self):
        vector = np.zeros(DRAW_OBSERVATION_VECTOR_SIZE, dtype=np.float32)
        features = evaluate_lowball(self.hero_hand, self.family)
        vector[0] = self.draw_round / max(1, self.max_draws)
        vector[1] = 1.0 if self.phase == "BET" else 0.0
        vector[2] = 1.0 if self.phase == "DRAW" else 0.0
        vector[15] = features.made_cards / 5.0
        vector[16] = features.highest_rank / 14.0
        vector[17] = features.rank_sum / 70.0
        vector[18] = features.duplicate_ranks / 4.0
        vector[19] = features.duplicate_suits / 4.0
        vector[20] = 1.0 if features.straight else 0.0
        vector[21] = 1.0 if features.flush else 0.0
        vector[22] = features.strength
        vector[25] = self.current_bet / 20.0
        vector[26] = self.raise_count / 4.0
        vector[40] = 0.0
        vector[41] = 1.0 if self.family == "low-27" else 0.0
        vector[42] = 1.0 if self.family == "low-a5" else 0.0
        mask = self.legal_action_mask()
        vector[48 : 48 + len(mask)] = mask
        return vector


def draw_teacher_action(env: DrawLowballEnv) -> int:
    features = evaluate_lowball(env.hero_hand, env.family)
    mask = env.legal_action_mask()
    if env.phase == "DRAW":
        draw_count = len(discard_indexes_for_family(env.hero_hand, env.family))
        return 5 + max(0, min(5, draw_count))
    to_call = max(0, env.current_bet - env.hero_bet)
    if to_call > 0:
        if features.strength >= 0.52 and mask[2] > 0:
            if features.strength >= 0.78 and mask[4] > 0:
                return 4
            return 2
        return 0
    if features.strength >= 0.58 and mask[3] > 0:
        return 3
    return 1
