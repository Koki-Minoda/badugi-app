"""Gymnasium environment for simplified 6-max Badugi heads-up training."""

from __future__ import annotations

import random
from itertools import combinations
from functools import lru_cache
from dataclasses import dataclass
from typing import Iterable, List, Sequence, Tuple

import gymnasium as gym
import numpy as np
from gymnasium import spaces

Card = Tuple[int, int]  # (rank, suit)
BADUGI_OBSERVATION_SCHEMA_VERSION = "badugi-observation-v1"
BADUGI_OBSERVATION_VECTOR_SIZE = 96


def build_deck() -> List[Card]:
  return [(rank, suit) for rank in range(13) for suit in range(4)]


def evaluate_badugi(hand: Sequence[Card]) -> Tuple[int, List[int]]:
  """Return (made_card_count, sorted ranks for the best subset)."""
  best: Tuple[int, List[int]] = (0, [])
  for subset_size in range(1, min(4, len(hand)) + 1):
    for subset in combinations(hand, subset_size):
      ranks = [rank for rank, _suit in subset]
      suits = [suit for _rank, suit in subset]
      if len(set(ranks)) != len(ranks) or len(set(suits)) != len(suits):
        continue
      candidate = (len(subset), sorted(ranks))
      if compare_badugi_scores(candidate, best) > 0:
        best = candidate
  return best


def compare_badugi_scores(player_score: Tuple[int, List[int]], opp_score: Tuple[int, List[int]]) -> int:
  """Return 1 if player wins, -1 if opponent wins, 0 for tie.

  Badugi compares the number of valid cards first. With the same made-card
  count, lower ranks are stronger, so Python's default tuple comparison cannot
  be used directly.
  """
  player_count, player_ranks = player_score
  opp_count, opp_ranks = opp_score
  if player_count != opp_count:
    return 1 if player_count > opp_count else -1
  for player_rank, opp_rank in zip(player_ranks, opp_ranks):
    if player_rank != opp_rank:
      return 1 if player_rank < opp_rank else -1
  return 0


def _score_key(score: Tuple[int, Sequence[int]]) -> tuple[int, int, int, int, int]:
  count, ranks_raw = score
  ranks = tuple(ranks_raw)
  padded = ranks + (13,) * (4 - len(ranks))
  return (count, *(13 - rank for rank in padded))


@lru_cache(maxsize=1)
def _all_starting_score_keys() -> tuple[tuple[int, int, int, int, int], ...]:
  keys = [_score_key(evaluate_badugi(hand)) for hand in combinations(build_deck(), 4)]
  return tuple(sorted(keys))


def starting_score_percentile(score: Tuple[int, Sequence[int]]) -> float:
  keys = _all_starting_score_keys()
  key = _score_key(score)
  lo = 0
  hi = len(keys)
  while lo < hi:
    mid = (lo + hi) // 2
    if keys[mid] <= key:
      lo = mid + 1
    else:
      hi = mid
  return lo / max(1, len(keys))


@dataclass
class HandFeature:
  count: int
  ranks: List[int]
  rank_sum: int
  min_rank: int
  is_nuts: bool
  one_away: bool


@dataclass(frozen=True)
class BetEVDiagnostic:
  estimated_equity: float
  pot_odds: float
  call_ev: float
  raise_ev: float
  fold_ev: float
  draw_equity: float
  future_street_value: float
  cheap_draw_continue_value: float
  fold_equity: float
  to_call: float

  def to_dict(self) -> dict:
    return {
      "estimatedEquity": self.estimated_equity,
      "potOdds": self.pot_odds,
      "callEV": self.call_ev,
      "raiseEV": self.raise_ev,
      "foldEV": self.fold_ev,
      "drawEquity": self.draw_equity,
      "futureStreetValue": self.future_street_value,
      "cheapDrawContinueValue": self.cheap_draw_continue_value,
      "foldEquity": self.fold_equity,
      "toCall": self.to_call,
    }


@dataclass(frozen=True)
class OpponentProfile:
  name: str
  fold_strength_threshold: float
  fold_probability: float
  raise_strength_threshold: float
  raise_probability: float
  open_strength_threshold: float
  open_probability: float
  bluff_frequency: float = 0.0
  bluff_raise_probability: float = 0.0
  draw_bias: int = 0


OPPONENT_PROFILES = {
  "random": OpponentProfile(
    name="random",
    fold_strength_threshold=0.75,
    fold_probability=0.25,
    raise_strength_threshold=0.0,
    raise_probability=0.25,
    open_strength_threshold=0.0,
    open_probability=0.25,
  ),
  "balanced": OpponentProfile(
    name="balanced",
    fold_strength_threshold=0.35,
    fold_probability=0.35,
    raise_strength_threshold=0.78,
    raise_probability=0.35,
    open_strength_threshold=0.62,
    open_probability=0.28,
    bluff_frequency=0.06,
    bluff_raise_probability=0.18,
  ),
  "loose_passive": OpponentProfile(
    name="loose_passive",
    fold_strength_threshold=0.24,
    fold_probability=0.12,
    raise_strength_threshold=0.9,
    raise_probability=0.08,
    open_strength_threshold=0.78,
    open_probability=0.1,
    bluff_frequency=0.02,
    bluff_raise_probability=0.04,
    draw_bias=1,
  ),
  "loose_aggressive": OpponentProfile(
    name="loose_aggressive",
    fold_strength_threshold=0.22,
    fold_probability=0.08,
    raise_strength_threshold=0.58,
    raise_probability=0.55,
    open_strength_threshold=0.44,
    open_probability=0.55,
    bluff_frequency=0.18,
    bluff_raise_probability=0.38,
    draw_bias=1,
  ),
  "tight_passive": OpponentProfile(
    name="tight_passive",
    fold_strength_threshold=0.48,
    fold_probability=0.65,
    raise_strength_threshold=0.92,
    raise_probability=0.1,
    open_strength_threshold=0.82,
    open_probability=0.12,
    bluff_frequency=0.01,
    bluff_raise_probability=0.03,
  ),
  "tight_aggressive": OpponentProfile(
    name="tight_aggressive",
    fold_strength_threshold=0.45,
    fold_probability=0.55,
    raise_strength_threshold=0.72,
    raise_probability=0.58,
    open_strength_threshold=0.68,
    open_probability=0.48,
    bluff_frequency=0.08,
    bluff_raise_probability=0.22,
  ),
  "pat_heavy": OpponentProfile(
    name="pat_heavy",
    fold_strength_threshold=0.3,
    fold_probability=0.22,
    raise_strength_threshold=0.7,
    raise_probability=0.42,
    open_strength_threshold=0.58,
    open_probability=0.34,
    bluff_frequency=0.07,
    bluff_raise_probability=0.18,
    draw_bias=-1,
  ),
  "draw_heavy": OpponentProfile(
    name="draw_heavy",
    fold_strength_threshold=0.32,
    fold_probability=0.25,
    raise_strength_threshold=0.8,
    raise_probability=0.25,
    open_strength_threshold=0.62,
    open_probability=0.25,
    bluff_frequency=0.05,
    bluff_raise_probability=0.12,
    draw_bias=1,
  ),
}


def resolve_opponent_profile(profile: str | OpponentProfile | None) -> OpponentProfile:
  if isinstance(profile, OpponentProfile):
    return profile
  profile_id = str(profile or "balanced")
  if profile_id not in OPPONENT_PROFILES:
    raise ValueError(
      f"Unknown Badugi opponent profile '{profile_id}'. "
      f"Available: {', '.join(sorted(OPPONENT_PROFILES))}"
    )
  return OPPONENT_PROFILES[profile_id]


class BadugiEnv(gym.Env):
  """Lightweight fixed-limit Badugi environment for RL agents."""

  metadata = {"render.modes": ["human"]}

  def __init__(
    self,
    opponent_profile: str | OpponentProfile | None = "balanced",
    table_size: int = 2,
    hero_position: int | None = None,
  ):
    super().__init__()
    self.max_rounds = 3  # number of draw streets
    self.starting_stack = 100
    self.opponent_profile = resolve_opponent_profile(opponent_profile)
    self.table_size = max(2, min(6, int(table_size)))
    self.hero_position_override = hero_position

    # Observation schema v1: first 22 slots remain compatible with the legacy
    # training env, then the vector is padded to the frontend ONNX shape.
    self.observation_space = spaces.Box(
      low=-1.0, high=1.0, shape=(BADUGI_OBSERVATION_VECTOR_SIZE,), dtype=np.float32
    )
    # Output order mirrors BADUGI_RL_ACTIONS:
    # 0: Fold/Pat, 1: Check/Draw1, 2: Call/Draw2,
    # 3: Bet/Draw3, 4: Raise, 5: All-in (illegal in fixed-limit training).
    self.action_space = spaces.Discrete(6)

    self.deck: List[Card] = []
    self.player_hand: List[Card] = []
    self.opponent_hand: List[Card] = []
    self.reset()

  def set_opponent_profile(self, profile: str | OpponentProfile):
    self.opponent_profile = resolve_opponent_profile(profile)

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
    self.player_bet = 0
    self.opponent_bet = 0
    self.bet_round = 0
    self.max_bets = 4
    self.round = 0
    self.pot = self._multiway_dead_money()
    self.phase = "BET"
    self.done = False
    self.hero_position = self._sample_hero_position()
    self.is_button = 1 if self.hero_position >= self.table_size - 1 else 0
    self.opponent_last_draw = 0
    self.last_opp_action = 0
    self.opponent_action_count = 0
    self.opponent_aggressive_action_count = 0
    self.opponent_passive_action_count = 0
    self.opponent_fold_count = 0
    self.opponent_pat_count = 0
    self.opponent_draw_count = 0
    self.opponent_total_draw_cards = 0
    self.last_result = None
    self.last_ev_diagnostic = None
    self.terminal_reason = None
    self._start_betting_round()
    info: dict = {}
    return self._get_obs(), info

  def step(self, action: int):
    if self.done:
      return self._get_obs(), 0.0, True, False, {}

    shaping_reward = 0.0
    phase_before_action = self.phase
    features = self._hand_features(self.player_hand)
    shaping_reward += self._reward_shaping(features, action)
    if not self.is_legal_action(action):
      action = self.safe_fallback_action()
      shaping_reward -= 1.0

    if self.phase == "BET":
      shaping_reward += self._handle_bet_action(action, features)
    elif self.phase == "DRAW":
      shaping_reward += self._handle_draw_action(action)

    terminal_reward = 0.0
    if self.done:
      terminal_reward = self._terminal_reward()
    elif not (phase_before_action == "BET" and self.phase == "DRAW"):
      self._opponent_turn()
      terminal_reward = self._terminal_reward()

    terminated = self.done
    truncated = False
    obs = self._get_obs()
    info = {
      "ev": self.last_ev_diagnostic.to_dict()
      if self.last_ev_diagnostic is not None
      else None
    }
    if info["ev"] is not None:
      info["ev"]["phase"] = phase_before_action
    reward = self._cap_shaping_reward(shaping_reward) + terminal_reward
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

  def _sample_hero_position(self) -> int:
    if self.hero_position_override is not None:
      return max(0, min(self.table_size - 1, int(self.hero_position_override)))
    return random.randrange(self.table_size)

  def _position_fraction(self) -> float:
    return self.hero_position / max(1, self.table_size - 1)

  def _active_opponent_count(self) -> int:
    return max(1, self.table_size - 1)

  def _multiway_dead_money(self) -> int:
    if self.table_size <= 2:
      return 0
    return max(0, self.table_size - 2) * self._bet_size()

  def _multiway_pressure(self) -> float:
    if self.table_size <= 2:
      return 0.0
    early_position_pressure = max(0.0, 0.5 - self._position_fraction()) * 0.24
    opponent_count_pressure = (self._active_opponent_count() - 1) * 0.035
    return min(0.35, early_position_pressure + opponent_count_pressure)

  def _start_betting_round(self):
    self.player_bet = 0
    self.opponent_bet = 0
    self.current_bet = 0
    self.bet_round = 0
    if self._opponent_opens_before_hero():
      bet_size = self._bet_size()
      self.current_bet = bet_size
      payment = min(bet_size, self.opponent_stack)
      self.opponent_stack -= payment
      self.opponent_bet = payment
      self.pot += payment
      self.bet_round = 1
      self.last_opp_action = 2
      self._record_opponent_action("bet")

  def _opponent_opens_before_hero(self) -> bool:
    if self.table_size <= 2 or self._player_is_first_to_act():
      return False
    features = self._hand_features(self.opponent_hand)
    strength = self._hand_strength(features)
    profile = self.opponent_profile
    should_value_open = strength >= profile.open_strength_threshold and random.random() < profile.open_probability
    should_bluff_open = strength < profile.open_strength_threshold and random.random() < profile.bluff_frequency
    return should_value_open or should_bluff_open

  def _player_is_first_to_act(self) -> int:
    if self.table_size > 2:
      return 1 if self._position_fraction() <= 0.25 else 0
    return 1 if (self.round % 2 == 0) else 0

  def legal_action_mask(self) -> np.ndarray:
    mask = np.zeros(self.action_space.n, dtype=np.float32)
    if self.done:
      return mask
    if self.phase == "DRAW":
      mask[0:4] = 1.0
      return mask

    to_call = max(0, self.current_bet - self.player_bet)
    can_raise = self.bet_round < self.max_bets and self.player_stack > to_call
    if to_call > 0:
      mask[0] = 1.0  # fold
      mask[2] = 1.0  # call
      if can_raise:
        mask[4] = 1.0  # raise
    else:
      mask[1] = 1.0  # check
      if can_raise:
        mask[3] = 1.0  # bet
    return mask

  def is_legal_action(self, action: int) -> bool:
    if action < 0 or action >= self.action_space.n:
      return False
    return bool(self.legal_action_mask()[action] > 0)

  def safe_fallback_action(self) -> int:
    mask = self.legal_action_mask()
    for action in (2, 1, 0, 3, 4):
      if action < len(mask) and mask[action] > 0:
        return action
    return 0

  def _handle_bet_action(self, action: int, features: HandFeature) -> float:
    bet_size = self._bet_size()
    reward = 0.0
    self.player_all_in = False
    if action == 0:  # Fold
      self.done = True
      self.terminal_reason = "player_fold"
      self.last_result = -1
      self.opponent_stack += self.pot
      self.pot = 0
      strength = self._hand_strength(features)
      if strength < 0.28:
        reward -= 0.55
      elif strength < 0.45:
        reward -= 1.1
      else:
        reward -= 2.6
      return reward
    elif action in (1, 2):  # Check / Call
      diff = self.current_bet - self.player_bet
      if diff > 0:
        payment = min(diff, self.player_stack)
        self.player_stack -= payment
        self.pot += payment
        self.player_bet += payment
        if self.player_stack == 0:
          self.player_all_in = True
      if action == 1 and diff > 0:
        reward -= 0.2
      # check branch does nothing else
    elif action in (3, 4):  # Bet / Raise
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
      self.player_hand = self._draw_toward_badugi(self.player_hand, draw_count)
      reward -= 0.05 * draw_count
    else:
      reward += 0.05  # pat bonus
    self.round += 1
    self._opponent_draw_action()
    self.phase = "BET"
    self._start_betting_round()
    return reward

  def _maybe_advance_from_bet(self):
    still_active = not self.done and self.player_stack > 0 and self.opponent_stack > 0
    if not still_active:
      self._finish_showdown()
      return
    if self.round >= self.max_rounds:
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
    profile = self.opponent_profile
    self.opponent_all_in = False
    bet_size = self._bet_size()
    r = random.random()
    bluff_roll = random.random()
    strength = self._hand_strength(features)
    diff = self.current_bet - self.opponent_bet
    should_bluff = (
      strength < profile.open_strength_threshold
      and bluff_roll < profile.bluff_frequency
    )
    if (
      diff > 0
      and strength < profile.fold_strength_threshold
      and r < profile.fold_probability
    ):
      self.opponent_fold()
      return
    if diff > 0:
      payment = min(diff, self.opponent_stack)
      self.opponent_stack -= payment
      self.opponent_bet += payment
      self.pot += payment
      self.last_opp_action = 1
      self._record_opponent_action("call")
      if (
        (
          strength > profile.raise_strength_threshold
          and r < profile.raise_probability
        )
        or (
          should_bluff
          and r < profile.bluff_raise_probability
        )
      and self.bet_round < self.max_bets
      ):
        self.current_bet += bet_size
        payment = min(self.current_bet - self.opponent_bet, self.opponent_stack)
        self.opponent_stack -= payment
        self.opponent_bet += payment
        self.pot += payment
        self.bet_round += 1
        self.last_opp_action = 2
        self._record_opponent_action("raise")
    elif self.bet_round < self.max_bets and (
      strength > profile.raise_strength_threshold
      or (strength > profile.open_strength_threshold and r < profile.open_probability)
      or should_bluff
    ):
      self.current_bet += bet_size
      payment = min(self.current_bet - self.opponent_bet, self.opponent_stack)
      self.opponent_stack -= payment
      self.opponent_bet += payment
      self.pot += payment
      self.bet_round += 1
      self.last_opp_action = 2
      self._record_opponent_action("raise")
    else:
      self.last_opp_action = 1
      self._record_opponent_action("check")
    if self.opponent_stack == 0:
      self.opponent_all_in = True

  def opponent_fold(self):
    self.done = True
    self.terminal_reason = "opponent_fold"
    self.last_result = 1
    self._record_opponent_action("fold")
    self.player_stack += self.pot
    self.pot = 0

  def _opponent_draw_action(self):
    features = self._hand_features(self.opponent_hand)
    if features.count == 4:
      self.opponent_last_draw = 0
      self._record_opponent_draw(0)
      self.phase = "BET"
      self._start_betting_round()
      return
    keep = self._best_badugi_keep(self.opponent_hand)
    draw_amount = max(0, min(3, 4 - len(keep) + self.opponent_profile.draw_bias))
    self.opponent_hand = self._draw_toward_badugi(self.opponent_hand, draw_amount)
    self.opponent_last_draw = draw_amount
    self._record_opponent_draw(draw_amount)
    self.phase = "BET"
    self._start_betting_round()

  def _record_opponent_action(self, action: str):
    self.opponent_action_count += 1
    if action in ("bet", "raise"):
      self.opponent_aggressive_action_count += 1
    elif action in ("check", "call"):
      self.opponent_passive_action_count += 1
    elif action == "fold":
      self.opponent_fold_count += 1

  def _record_opponent_draw(self, draw_count: int):
    if draw_count <= 0:
      self.opponent_pat_count += 1
    else:
      self.opponent_draw_count += 1
      self.opponent_total_draw_cards += draw_count

  def _best_badugi_keep(self, hand: Sequence[Card]) -> List[Card]:
    best_subset: tuple[Card, ...] = ()
    best_score: Tuple[int, List[int]] = (0, [])
    for subset_size in range(1, min(4, len(hand)) + 1):
      for subset in combinations(hand, subset_size):
        ranks = [rank for rank, _suit in subset]
        suits = [suit for _rank, suit in subset]
        if len(set(ranks)) != len(ranks) or len(set(suits)) != len(suits):
          continue
        score = (len(subset), sorted(ranks))
        if compare_badugi_scores(score, best_score) > 0:
          best_score = score
          best_subset = subset
    return list(best_subset)

  def _draw_toward_badugi(self, hand: Sequence[Card], draw_count: int) -> List[Card]:
    keep = self._best_badugi_keep(hand)
    draw_amount = min(max(0, draw_count), max(0, 4 - len(keep)))
    if draw_amount <= 0:
      return list(hand)
    replacement_hand = keep[:]
    for _ in range(draw_amount):
      if not self.deck:
        break
      replacement_hand.append(self.deck.pop())
    while len(replacement_hand) < 4:
      remaining = [card for card in hand if card not in replacement_hand]
      if not remaining:
        break
      replacement_hand.append(remaining[0])
    return replacement_hand[:4]

  def _finish_showdown(self):
    player_score = self._judge(self.player_hand)
    opp_score = self._judge(self.opponent_hand)
    result = compare_badugi_scores(player_score, opp_score)
    if result > 0:
      self.player_stack += self.pot
    elif result < 0:
      self.opponent_stack += self.pot
    else:
      self.player_stack += self.pot // 2
      self.opponent_stack += self.pot - self.pot // 2
    self.pot = 0
    self.round = self.max_rounds
    self.done = True
    self.terminal_reason = "showdown"
    self.last_result = result

  def _terminal_reward(self) -> float:
    if not self.done:
      return 0.0
    stack_delta_reward = (self.player_stack - self.starting_stack) / 25.0
    if self.terminal_reason == "opponent_fold":
      return 0.45 + stack_delta_reward
    if self.terminal_reason == "showdown":
      if self.last_result == 1:
        return 3.1 + stack_delta_reward
      if self.last_result == -1:
        return -2.9 + stack_delta_reward
      return stack_delta_reward
    if self.terminal_reason == "player_fold":
      return -1.5 + stack_delta_reward
    return 0.0

  def _cap_shaping_reward(self, reward: float) -> float:
    return max(-1.0, min(1.0, reward))

  def _judge(self, hand: Sequence[Card]) -> Tuple[int, List[int]]:
    return evaluate_badugi(hand)

  def _reward_shaping(self, features: HandFeature, action: int) -> float:
    reward = 0.0
    if self.phase == "BET":
      strength = self._street_adjusted_strength(features)
      to_call = max(0, self.current_bet - self.player_bet)
      pot_odds = self._pot_odds(to_call)
      position_bonus = 0.08 if not self._player_is_first_to_act() else -0.04
      draw_equity = 0.06 * max(0, self.max_rounds - self.round) if features.one_away else 0.0
      opponent_draw_pressure = self._opponent_draw_pressure()
      opponent_aggression = self._opponent_aggression_rate()
      opponent_foldability = self._opponent_foldability_estimate()
      opponent_pat_pressure = self._opponent_pat_pressure()
      multiway_pressure = self._multiway_pressure()
      ev = self._bet_ev_diagnostic(features, to_call)
      self.last_ev_diagnostic = ev
      continue_value = min(
        1.0,
        strength + position_bonus + draw_equity + opponent_draw_pressure - multiway_pressure,
      )
      bluff_opportunity = (
        to_call == 0
        and not self._player_is_first_to_act()
        and opponent_foldability >= 0.32
        and self.bet_round < self.max_bets
      )
      semi_bluff_opportunity = (
        bluff_opportunity
        and features.one_away
        and self.round < self.max_rounds
      )
      sixmax_value_bet = self._sixmax_value_bet_spot(features, to_call)
      sixmax_late_semibluff = self._sixmax_late_semibluff_spot(features, to_call, ev)
      sixmax_isolation_raise = self._sixmax_isolation_raise_spot(features, to_call, ev)
      if action == 4 and features.one_away:
        reward += 0.15
      if action == 4 and features.is_nuts:
        reward += 0.35
      if action in (3, 4) and features.count == 4 and strength >= 0.72:
        reward += 0.25
      if sixmax_value_bet:
        if action == 3:
          reward += 0.34
        elif action == 4:
          reward += 0.22
        elif action in (1, 2):
          reward -= 0.18
      if sixmax_late_semibluff:
        if action == 3:
          reward += 0.28
        elif action == 4:
          reward += 0.18
        elif action == 1:
          reward -= 0.12
      if sixmax_isolation_raise:
        if action == 4:
          reward += 0.36
        elif action == 2:
          reward -= 0.10
      if to_call == 0 and action == 4 and (sixmax_value_bet or sixmax_late_semibluff):
        reward -= 0.12
      if action in (3, 4) and self.round >= self.max_rounds and self._is_weak_final_badugi(features):
        reward += 0.18 if self.opponent_last_draw >= 2 else -0.55
      if action in (3, 4) and self.round >= self.max_rounds and self.opponent_last_draw >= 2:
        reward += 0.18
      if action in (3, 4) and semi_bluff_opportunity and strength >= 0.30:
        reward += 0.16
      if action in (3, 4) and bluff_opportunity and strength < 0.30:
        reward += 0.08 if opponent_foldability >= 0.45 else -0.16
      if action in (3, 4) and opponent_foldability < 0.18 and strength < 0.50:
        reward -= 0.22
      if (
        action in (3, 4)
        and multiway_pressure > 0
        and strength < 0.58
        and not sixmax_late_semibluff
      ):
        reward -= min(0.22, multiway_pressure * 0.55)
      if action in (3, 4) and strength < 0.35:
        reward -= 0.45
      if action in (3, 4) and to_call == 0 and not self._player_is_first_to_act() and strength >= 0.45:
        reward += 0.12
      if action in (3, 4) and to_call == 0 and self._player_is_first_to_act() and strength < 0.45:
        reward -= 0.15
      if action == 2 and strength >= 0.45:
        reward += 0.08
      if action == 2 and strength < 0.25:
        reward -= 0.18
      if to_call > 0 and action == 0:
        tight_pat_raise_pressure = opponent_pat_pressure > 0.5 and opponent_aggression < 0.22
        if ev.call_ev > ev.fold_ev and features.one_away and self.round < self.max_rounds:
          reward -= min(0.75, 0.25 + ev.call_ev * 0.12)
        if ev.cheap_draw_continue_value > 0.35 and pot_odds <= 0.30 and self.round < self.max_rounds:
          reward -= min(0.65, 0.18 + ev.cheap_draw_continue_value * 0.10)
        if features.count >= 4 and strength >= 0.54:
          reward -= 0.5
        elif features.one_away and self.round < self.max_rounds and pot_odds <= 0.25:
          reward -= 0.3
        else:
          reward += 0.18 if continue_value < pot_odds + 0.03 or tight_pat_raise_pressure else -0.35
      if to_call > 0 and action == 2:
        call_edge = continue_value + (0.08 if opponent_aggression >= 0.38 and strength >= 0.42 else 0.0)
        if features.count >= 4 and strength >= 0.54:
          call_edge += 0.08
        if features.one_away and self.round < self.max_rounds and pot_odds <= 0.25:
          call_edge += 0.07
        reward += 0.22 if call_edge >= pot_odds else -0.14
        reward += 0.18 if ev.call_ev >= ev.fold_ev else -0.12
        if ev.cheap_draw_continue_value > 0.35 and pot_odds <= 0.30 and self.round < self.max_rounds:
          reward += min(0.28, 0.10 + ev.cheap_draw_continue_value * 0.04)
        if multiway_pressure > 0 and features.one_away and pot_odds <= 0.20:
          reward += min(0.12, ev.future_street_value * 0.03)
      if to_call > 0 and action == 2 and self.round >= self.max_rounds and features.count >= 4:
        reward += 0.12
      if to_call > 0 and action in (3, 4) and opponent_aggression >= 0.38 and strength >= 0.62:
        reward += 0.16
      if to_call > 0 and action in (3, 4):
        reward += 0.14 if ev.raise_ev >= ev.call_ev else -0.1
        if self.table_size >= 6 and not sixmax_isolation_raise and strength < 0.58:
          reward -= 0.16
      if action == 0 and to_call == 0:
        reward -= 0.2
    elif self.phase == "DRAW":
      if action == 0 and features.count == 4:
        reward += 0.1
      if action == 0 and features.count < 4:
        reward -= 0.2
      if action > 0 and features.count == 4:
        reward -= 0.25
    return reward

  def _hand_strength(self, features: HandFeature) -> float:
    count_score = features.count / 4.0
    if not features.ranks:
      return 0.0
    high_rank = max(features.ranks)
    low_bonus = max(0.0, (12 - high_rank) / 12.0) * 0.2
    nut_bonus = 0.15 if features.is_nuts else 0.0
    return min(1.0, count_score + low_bonus + nut_bonus)

  def _is_late_position(self) -> bool:
    return self._position_fraction() >= 0.6

  def _sixmax_value_bet_spot(self, features: HandFeature, to_call: int | float) -> bool:
    if self.table_size < 6 or to_call > 0 or self.bet_round >= self.max_bets:
      return False
    if features.count != 4 or not features.ranks:
      return False
    high_rank = max(features.ranks)
    if high_rank <= 8:
      return True
    return self.round >= self.max_rounds and high_rank <= 10 and self.opponent_last_draw >= 2

  def _sixmax_late_semibluff_spot(
    self,
    features: HandFeature,
    to_call: int | float,
    ev: BetEVDiagnostic,
  ) -> bool:
    if self.table_size < 6 or to_call > 0 or self.bet_round >= self.max_bets:
      return False
    if not self._is_late_position() or not features.one_away or self.round >= self.max_rounds:
      return False
    high_rank = max(features.ranks) if features.ranks else 12
    return high_rank <= 8 and ev.future_street_value >= 0.45 and ev.fold_equity >= 0.12

  def _sixmax_isolation_raise_spot(
    self,
    features: HandFeature,
    to_call: int | float,
    ev: BetEVDiagnostic,
  ) -> bool:
    if self.table_size < 6 or to_call <= 0 or self.bet_round >= self.max_bets:
      return False
    if not features.ranks:
      return False
    high_rank = max(features.ranks)
    strong_made = features.count == 4 and high_rank <= 8
    strong_one_away = features.one_away and high_rank <= 6 and ev.future_street_value >= 0.45
    return (strong_made or strong_one_away) and ev.raise_ev >= ev.call_ev - 0.25

  def _draw_equity_estimate(self, features: HandFeature) -> float:
    draws_remaining = max(0, self.max_rounds - self.round)
    if draws_remaining <= 0:
      return 0.0
    if not features.ranks:
      return 0.04
    high_rank = max(features.ranks)
    low_quality = max(0.0, (12 - high_rank) / 12.0)
    if features.count >= 4:
      return 0.0
    if features.count == 3:
      base = 0.16 + 0.08 * draws_remaining + 0.10 * low_quality
      if features.min_rank <= 1 and high_rank <= 8:
        base += 0.08
      return min(0.48, base)
    if features.count == 2:
      base = 0.08 + 0.045 * draws_remaining + 0.08 * low_quality
      if features.min_rank <= 1 and high_rank <= 7:
        base += 0.06
      return min(0.30, base)
    return 0.05

  def _estimated_equity(self, features: HandFeature) -> float:
    strength = self._street_adjusted_strength(features)
    draw_equity = self._draw_equity_estimate(features)
    range_equity = self._range_equity_percentile(features)
    position_bonus = 0.04 if not self._player_is_first_to_act() else -0.02
    multiway_adjustment = -self._multiway_pressure()
    opponent_adjustment = 0.0
    if self.round >= self.max_rounds:
      opponent_adjustment += self._opponent_draw_pressure()
      opponent_adjustment -= 0.10 * self._opponent_pat_pressure()
    if self._opponent_aggression_rate() >= 0.45 and features.count < 4:
      opponent_adjustment -= 0.04
    range_adjustment = (range_equity - 0.5) * 0.16
    equity = (
      strength
      + draw_equity
      + range_adjustment
      + position_bonus
      + opponent_adjustment
      + multiway_adjustment
    )
    return min(0.95, max(0.03, equity))

  def _bet_ev_diagnostic(self, features: HandFeature, to_call: int | float | None = None) -> BetEVDiagnostic:
    call_amount = max(0.0, float(self.current_bet - self.player_bet if to_call is None else to_call))
    equity = self._estimated_equity(features)
    pot_after_call = float(self.pot) + call_amount
    showdown_call_ev = equity * pot_after_call - call_amount if call_amount > 0 else equity * float(self.pot)
    future_street_value = self._future_street_value(features, call_amount)
    call_ev = showdown_call_ev + future_street_value
    fold_ev = 0.0
    isolation_pressure = self._sixmax_isolation_pressure(features, call_amount)
    fold_equity = (
      self._opponent_foldability_estimate() * (1.0 + isolation_pressure)
    ) / max(1.0, self._active_opponent_count() ** 0.45)
    fold_equity = min(0.65, max(0.0, fold_equity))
    raise_cost = call_amount + float(self._bet_size())
    raise_pot = float(self.pot) + raise_cost
    raise_continue_ev = equity * raise_pot - raise_cost + future_street_value * 0.65
    raise_ev = fold_equity * float(self.pot) + (1.0 - fold_equity) * raise_continue_ev
    return BetEVDiagnostic(
      estimated_equity=equity,
      pot_odds=self._pot_odds(call_amount),
      call_ev=call_ev,
      raise_ev=raise_ev,
      fold_ev=fold_ev,
      draw_equity=self._draw_equity_estimate(features),
      future_street_value=future_street_value,
      cheap_draw_continue_value=max(0.0, call_ev - fold_ev),
      fold_equity=fold_equity,
      to_call=call_amount,
    )

  def _future_street_value(self, features: HandFeature, to_call: int | float | None = None) -> float:
    draws_remaining = max(0, self.max_rounds - self.round)
    call_amount = max(0.0, float(self.current_bet - self.player_bet if to_call is None else to_call))
    if draws_remaining <= 0 or features.count >= 4:
      return 0.0
    draw_equity = self._draw_equity_estimate(features)
    if draw_equity <= 0:
      return 0.0
    pot_after_call = float(self.pot) + call_amount
    future_bet_size = float(2 if self.round + 1 >= 2 else 1)
    implied_bets = future_bet_size * (1.0 + 0.35 * max(0, draws_remaining - 1))
    position_bonus = 0.18 if not self._player_is_first_to_act() else 0.0
    multiway_discount = 0.18 * max(0, self._active_opponent_count() - 1)
    opponent_draw_bonus = 0.12 if self.opponent_last_draw >= 2 else 0.0
    pat_pressure_discount = 0.18 * self._opponent_pat_pressure()
    aggression_discount = 0.10 * self._opponent_aggression_rate() if features.count <= 2 else 0.0
    price_discount = self._pot_odds(call_amount) * max(0.25, 1.0 - 0.14 * draws_remaining)
    shape_multiplier = 1.25 if features.one_away else 0.75
    raw_value = (
      draw_equity
      * shape_multiplier
      * (pot_after_call + implied_bets)
      * (1.0 + position_bonus + opponent_draw_bonus)
    )
    future_cost = call_amount * price_discount + aggression_discount + pat_pressure_discount + multiway_discount
    return max(0.0, min(3.0, raw_value - future_cost))

  def _range_equity_percentile(self, features: HandFeature) -> float:
    return starting_score_percentile((features.count, tuple(features.ranks)))

  def _sixmax_isolation_pressure(self, features: HandFeature, to_call: int | float) -> float:
    if self.table_size < 6 or to_call <= 0 or self.bet_round >= self.max_bets:
      return 0.0
    if not features.ranks:
      return 0.0
    high_rank = max(features.ranks)
    late_bonus = 0.12 if self._is_late_position() else 0.0
    strong_made_bonus = 0.18 if features.count == 4 and high_rank <= 8 else 0.0
    strong_draw_bonus = 0.10 if features.one_away and high_rank <= 6 else 0.0
    pot_bonus = 0.05 if self.pot >= 12 else 0.0
    return min(0.35, late_bonus + strong_made_bonus + strong_draw_bonus + pot_bonus)

  def _street_adjusted_strength(self, features: HandFeature) -> float:
    draws_remaining = max(0, self.max_rounds - self.round)
    if not features.ranks:
      return 0.0
    high_rank = max(features.ranks)
    low_quality = max(0.0, (12 - high_rank) / 12.0)
    if features.count == 4:
      early_credit = 0.18 * (draws_remaining / max(1, self.max_rounds))
      nut_bonus = 0.12 if features.is_nuts else 0.0
      return min(1.0, 0.54 + low_quality * 0.34 + early_credit + nut_bonus)
    if features.count == 3:
      draw_equity = 0.08 * draws_remaining
      return min(0.72, 0.30 + low_quality * 0.22 + draw_equity)
    if features.count == 2:
      return min(0.34, 0.12 + low_quality * 0.1 + 0.04 * draws_remaining)
    return 0.05

  def _is_weak_final_badugi(self, features: HandFeature) -> bool:
    if features.count != 4 or not features.ranks:
      return False
    return self.round >= self.max_rounds and max(features.ranks) >= 10

  def _opponent_draw_pressure(self) -> float:
    if self.round < self.max_rounds:
      return 0.0
    if self.opponent_last_draw >= 2:
      return 0.16
    if self.opponent_last_draw == 1:
      return 0.06
    return -0.08

  def _opponent_aggression_rate(self) -> float:
    if self.opponent_action_count <= 0:
      return self.opponent_profile.raise_probability
    return min(1.0, self.opponent_aggressive_action_count / self.opponent_action_count)

  def _opponent_passivity_rate(self) -> float:
    if self.opponent_action_count <= 0:
      return 1.0 - self.opponent_profile.raise_probability
    return min(1.0, self.opponent_passive_action_count / self.opponent_action_count)

  def _opponent_foldability_estimate(self) -> float:
    observed = (
      self.opponent_fold_count / self.opponent_action_count
      if self.opponent_action_count > 0
      else self.opponent_profile.fold_probability
    )
    return min(1.0, max(0.0, (observed + self.opponent_profile.fold_probability) / 2.0))

  def _opponent_pat_pressure(self) -> float:
    draw_decisions = self.opponent_pat_count + self.opponent_draw_count
    if draw_decisions <= 0:
      return 0.0
    return min(1.0, self.opponent_pat_count / draw_decisions)

  def _opponent_average_draw_count(self) -> float:
    if self.opponent_draw_count <= 0:
      return 0.0
    return min(4.0, self.opponent_total_draw_cards / self.opponent_draw_count)

  def _pot_odds(self, to_call: int | float | None = None) -> float:
    call_amount = max(0.0, float(self.current_bet - self.player_bet if to_call is None else to_call))
    if call_amount <= 0:
      return 0.0
    return min(1.0, call_amount / max(call_amount, self.pot + call_amount))

  def _duplicate_counts(self, hand: Sequence[Card]) -> tuple[int, int]:
    ranks = [rank for rank, _suit in hand]
    suits = [suit for _rank, suit in hand]
    return (
      max(0, len(ranks) - len(set(ranks))),
      max(0, len(suits) - len(set(suits))),
    )

  def _starting_hand_strength(self, features: HandFeature, hand: Sequence[Card] | None = None) -> float:
    duplicate_rank_count, duplicate_suit_count = self._duplicate_counts(hand or self.player_hand)
    made_component = features.count / 4.0
    high_rank = max(features.ranks) if features.ranks else 12
    low_component = max(0.0, (12 - high_rank) / 12.0) * 0.25
    one_away_component = 0.12 if features.one_away else 0.0
    duplicate_penalty = 0.06 * (duplicate_rank_count + duplicate_suit_count)
    return min(1.0, max(0.0, made_component + low_component + one_away_component - duplicate_penalty))

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
        self._position_fraction(),
      ]
    )
    features = self._hand_features(self.player_hand)
    duplicate_rank_count, duplicate_suit_count = self._duplicate_counts(self.player_hand)
    to_call = max(0, self.current_bet - self.player_bet)
    obs.extend(
      [
        features.count / 4.0,
        min(features.rank_sum, 40) / 40.0,
        (max(features.ranks) if features.ranks else 13) / 13.0,
        min(duplicate_rank_count, 3) / 3.0,
        min(duplicate_suit_count, 3) / 3.0,
        self._starting_hand_strength(features),
        self._pot_odds(to_call),
        0.0 if self._player_is_first_to_act() else 1.0,
        min(to_call, 10) / 10.0,
        1.0 if features.one_away else 0.0,
      ]
    )
    mask = self.legal_action_mask()
    for value in mask:
      obs.append(float(value))
    obs.extend(
      [
        self._street_adjusted_strength(features),
        self._opponent_draw_pressure(),
        1.0 if self.round >= self.max_rounds else 0.0,
        1.0 if self._is_weak_final_badugi(features) else 0.0,
        self._opponent_aggression_rate(),
        self._opponent_passivity_rate(),
        self._opponent_pat_pressure(),
        self._opponent_average_draw_count() / 4.0,
        self._opponent_foldability_estimate(),
        self.opponent_profile.bluff_frequency,
      ]
    )
    ev = self._bet_ev_diagnostic(features, to_call)
    obs.extend(
      [
        ev.estimated_equity,
        ev.pot_odds,
        max(-1.0, min(1.0, ev.call_ev / 10.0)),
        max(-1.0, min(1.0, ev.raise_ev / 10.0)),
        ev.draw_equity,
        ev.fold_equity,
        max(0.0, min(1.0, ev.future_street_value / 3.0)),
        max(0.0, min(1.0, ev.cheap_draw_continue_value / 3.0)),
        self._active_opponent_count() / 5.0,
        self._multiway_pressure(),
        self._range_equity_percentile(features),
        self._sixmax_isolation_pressure(features, to_call),
        1.0 if self._sixmax_late_semibluff_spot(features, to_call, ev) else 0.0,
      ]
    )
    while len(obs) < BADUGI_OBSERVATION_VECTOR_SIZE:
      obs.append(0.0)
    return np.array(obs[:BADUGI_OBSERVATION_VECTOR_SIZE], dtype=np.float32)

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
