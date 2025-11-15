"""Gymnasium environment for simplified 6-max Badugi heads-up training."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Iterable, List, Sequence, Tuple

import gymnasium as gym
import numpy as np
from gymnasium import spaces

Card = Tuple[int, int]  # (rank, suit)


def build_deck() -> List[Card]:
  return [(rank, suit) for rank in range(13) for suit in range(4)]


def evaluate_badugi(hand: Sequence[Card]) -> Tuple[int, List[int]]:
  """Return (made_card_count, sorted ranks for the best subset)."""
  best: List[int] = []
  used_ranks: set[int] = set()
  used_suits: set[int] = set()
  for rank, suit in sorted(hand, key=lambda x: x[0]):
    if rank in used_ranks or suit in used_suits:
      continue
    used_ranks.add(rank)
    used_suits.add(suit)
    best.append(rank)
  return len(best), best


@dataclass
class HandFeature:
  count: int
  ranks: List[int]
  rank_sum: int
  min_rank: int
  is_nuts: bool
  one_away: bool


class BadugiEnv(gym.Env):
  """Lightweight fixed-limit Badugi environment for RL agents."""

  metadata = {"render.modes": ["human"]}

  def __init__(self):
    super().__init__()
    self.max_rounds = 3  # number of draw streets
    self.starting_stack = 100

    # Observation: 4 cards * 2 features + table features
    self.observation_space = spaces.Box(
      low=-1.0, high=1.0, shape=(22,), dtype=np.float32
    )
    # 0: Fold, 1: Check/Call, 2: Raise, 3: Draw count indicator (0..3)
    self.action_space = spaces.Discrete(5)

    self.deck: List[Card] = []
    self.player_hand: List[Card] = []
    self.opponent_hand: List[Card] = []
    self.reset()

  # ---------------------------------------------------------------------------
  # Gym API
  # ---------------------------------------------------------------------------
  def reset(self, seed: int | None = None, options: dict | None = None):
    super().reset(seed=seed)
    self.deck = build_deck()
    random.shuffle(self.deck)

    self.player_hand = [self.deck.pop() for _ in range(4)]
    self.opponent_hand = [self.deck.pop() for _ in range(4)]

    self.player_stack = self.starting_stack
    self.opponent_stack = self.starting_stack
    self.player_all_in = False
    self.opponent_all_in = False
    self.pot = 0
    self.player_bet = 0
    self.opponent_bet = 0
    self.bet_round = 0
    self.max_bets = 4
    self.round = 0
    self.phase = "BET"
    self.done = False
    self.is_button = 1
    self.opponent_last_draw = 0
    self.last_opp_action = 0
    self.current_bet = self._bet_size()
    info: dict = {}
    return self._get_obs(), info

  def step(self, action: int):
    if self.done:
      return self._get_obs(), 0.0, True, False, {}

    reward = 0.0
    features = self._hand_features(self.player_hand)
    reward += self._reward_shaping(features, action)

    if self.phase == "BET":
      reward += self._handle_bet_action(action, features)
    elif self.phase == "DRAW":
      reward += self._handle_draw_action(action)

    if not self.done:
      self._opponent_turn()

    terminated = self.done
    truncated = False
    obs = self._get_obs()
    info = {}
    return obs, reward, terminated, truncated, info

  def render(self):
    print(
      f"Round {self.round} phase={self.phase} "
      f"pot={self.pot} stacks=({self.player_stack},{self.opponent_stack})"
    )
    print("Player:", self.player_hand)
    print("Opponent:", self.opponent_hand)

  # ---------------------------------------------------------------------------
  # Internal helpers
  # ---------------------------------------------------------------------------
  def _bet_size(self) -> int:
    return 1 if self.round < 2 else 2

  def _player_is_first_to_act(self) -> int:
    return 1 if (self.round % 2 == 0) else 0

  def _handle_bet_action(self, action: int, features: HandFeature) -> float:
    bet_size = self._bet_size()
    reward = 0.0
    self.player_all_in = False
    if action == 0:  # Fold
      self.done = True
      reward -= 1.0
    elif action == 1:  # Check / Call
      diff = self.current_bet - self.player_bet
      if diff > 0:
        payment = min(diff, self.player_stack)
        self.player_stack -= payment
        self.pot += payment
        self.player_bet += payment
        if self.player_stack == 0:
          self.player_all_in = True
      # check branch does nothing else
    elif action == 2:  # Raise
      if self.bet_round < self.max_bets:
        self.current_bet += bet_size
        diff = self.current_bet - self.player_bet
        payment = min(diff, self.player_stack)
        self.player_stack -= payment
        self.player_bet += payment
        self.pot += payment
        self.bet_round += 1
        if self.player_stack == 0:
          self.player_all_in = True
      else:
        reward -= 0.1
    else:
      reward -= 0.05  # unsupported BET action
    self._maybe_advance_from_bet()
    return reward

  def _handle_draw_action(self, action: int) -> float:
    reward = 0.0
    draw_count = max(0, min(3, action))
    if draw_count > 0:
      for _ in range(draw_count):
        if not self.deck:
          break
        discard_idx = random.randrange(len(self.player_hand))
        self.deck.append(self.player_hand[discard_idx])
        random.shuffle(self.deck)
        self.player_hand[discard_idx] = self.deck.pop()
      reward -= 0.05 * draw_count
    else:
      reward += 0.05  # pat bonus
    self.phase = "BET"
    self.round += 1
    self.player_bet = 0
    self.opponent_bet = 0
    self.current_bet = self._bet_size()
    self.bet_round = 0
    if self.round >= self.max_rounds:
      self._finish_showdown()
    return reward

  def _maybe_advance_from_bet(self):
    still_active = not self.done and self.player_stack > 0 and self.opponent_stack > 0
    if not still_active:
      self._finish_showdown()
      return
    # simplistic transition after each BET action
    self.phase = "DRAW"
    self.player_bet = 0
    self.opponent_bet = 0
    self.current_bet = self._bet_size()
    self.bet_round = 0

  def _opponent_turn(self):
    if self.done:
      return
    if self.phase == "BET":
      self._opponent_bet_action()
    elif self.phase == "DRAW":
      self._opponent_draw_action()

  def _opponent_bet_action(self):
    features = self._hand_features(self.opponent_hand)
    self.opponent_all_in = False
    bet_size = self._bet_size()
    r = random.random()
    if r < 0.1 and features.count < 3:
      self.opponent_fold()
      return
    diff = self.current_bet - self.opponent_bet
    if diff > 0:
      payment = min(diff, self.opponent_stack)
      self.opponent_stack -= payment
      self.opponent_bet += payment
      self.pot += payment
      self.last_opp_action = 1
    elif r > 0.85 and self.bet_round < self.max_bets:
      self.current_bet += bet_size
      payment = min(self.current_bet - self.opponent_bet, self.opponent_stack)
      self.opponent_stack -= payment
      self.opponent_bet += payment
      self.pot += payment
      self.bet_round += 1
      self.last_opp_action = 2
    else:
      self.last_opp_action = 1
    if self.opponent_stack == 0:
      self.opponent_all_in = True

  def opponent_fold(self):
    self.done = True
    self.player_stack += self.pot
    self.pot = 0

  def _opponent_draw_action(self):
    features = self._hand_features(self.opponent_hand)
    if features.count == 4:
      self.opponent_last_draw = 0
      return
    keep: List[Card] = []
    used_ranks: set[int] = set()
    used_suits: set[int] = set()
    for card in self.opponent_hand:
      rank, suit = card
      if rank not in used_ranks and suit not in used_suits:
        keep.append(card)
        used_ranks.add(rank)
        used_suits.add(suit)
    draw_amount = max(0, 4 - len(keep))
    for _ in range(draw_amount):
      if not self.deck:
        break
      keep.append(self.deck.pop())
    self.opponent_hand = keep[:4]
    self.opponent_last_draw = draw_amount
    self.phase = "BET"
    self.player_bet = 0
    self.opponent_bet = 0
    self.current_bet = self._bet_size()
    self.bet_round = 0

  def _finish_showdown(self):
    player_score = self._judge(self.player_hand)
    opp_score = self._judge(self.opponent_hand)
    if player_score > opp_score:
      self.player_stack += self.pot
      result = 1
    elif player_score < opp_score:
      self.opponent_stack += self.pot
      result = -1
    else:
      self.player_stack += self.pot // 2
      self.opponent_stack += self.pot - self.pot // 2
      result = 0
    self.pot = 0
    self.round = self.max_rounds
    self.done = True
    self.last_result = result

  def _judge(self, hand: Sequence[Card]) -> Tuple[int, List[int]]:
    return evaluate_badugi(hand)

  def _reward_shaping(self, features: HandFeature, action: int) -> float:
    reward = 0.0
    if self.phase == "BET":
      if action == 2 and features.one_away:
        reward += 0.2
      if action == 2 and features.is_nuts:
        reward += 0.3
      if action == 0:
        reward -= 0.3
    elif self.phase == "DRAW":
      if action == 0 and features.count == 4:
        reward += 0.1
    return reward

  def _get_obs(self) -> np.ndarray:
    obs: List[float] = []
    for rank, suit in self.player_hand:
      obs.extend([rank / 12.0, suit / 3.0])
    while len(obs) < 8:
      obs.append(0.0)
    obs.extend(
      [
        self.round / self.max_rounds,
        self.player_stack / 200.0,
        self.opponent_stack / 200.0,
        min(self.pot, 400) / 400.0,
        min(self.player_bet, 10) / 10.0,
        min(self.opponent_bet, 10) / 10.0,
        min(self.current_bet, 10) / 10.0,
        self.bet_round / max(1, self.max_bets),
        (self.max_rounds - self.round) / self.max_rounds,
        0.0 if self.phase == "BET" else 1.0,
        min(self.opponent_last_draw, 4) / 4.0,
        float(self.is_button),
        float(self._player_is_first_to_act()),
        self.last_opp_action / 4.0,
      ]
    )
    return np.array(obs, dtype=np.float32)

  def _hand_features(self, hand: Sequence[Card]) -> HandFeature:
    count, ranks = evaluate_badugi(hand)
    ranks_sorted = sorted(ranks)
    rank_sum = sum(ranks_sorted) if ranks_sorted else 99
    min_rank = ranks_sorted[0] if ranks_sorted else 99
    is_nuts = count == 4 and ranks_sorted == [0, 1, 2, 3]
    one_away = count == 3
    return HandFeature(
      count=count,
      ranks=ranks_sorted,
      rank_sum=rank_sum,
      min_rank=min_rank,
      is_nuts=is_nuts,
      one_away=one_away,
    )
