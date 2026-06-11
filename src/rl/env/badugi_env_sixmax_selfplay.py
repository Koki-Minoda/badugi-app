"""6-max Badugi self-play environment.

Hero plays against 5 frozen copies of itself, experiencing all 6 positions
(SB/BB/UTG/MP/CO/BTN) across episodes. Observation is 96-dim and matches
BadugiEnv._get_obs() slot-for-slot, with multi-player slots (56-60) properly
populated — these were all 0 during heads-up training.

Key design goals
----------------
* Symmetric observation: _obs_for(seat) builds from seat's perspective.
* Batch opponent inference: all 5 opponents' obs are stacked and passed to
  the DQN in one forward pass for speed.
* Position cycling: hero_seat rotates across episodes to ensure even coverage
  of all 6 positions.
* 6-max specific features: active_opponent_count, multiway_pressure,
  isolation_pressure, position_fraction, late_semibluff_spot.
"""

from __future__ import annotations

import random
from collections import deque
from typing import TYPE_CHECKING

import numpy as np
from gymnasium import spaces

from rl.env.badugi_env import (
    BADUGI_OBSERVATION_VECTOR_SIZE,
    build_deck,
    compare_badugi_scores,
    evaluate_badugi,
)
from rl.env.badugi_env_selfplay import (
    _best_badugi_keep,
    _draw_toward_badugi,
    _evaluate_badugi_features,
)

if TYPE_CHECKING:
    from rl.agents.dqn_agent import DQNAgent

NUM_PLAYERS = 6
MAX_DRAWS = 3
MAX_BETS = 4
SMALL_BET = 2
BIG_BET = 4
STARTING_STACK = 100
SB_AMOUNT = 1
BB_AMOUNT = 2

# Action indices
FOLD, CHECK, CALL, BET, RAISE, ALL_IN = 0, 1, 2, 3, 4, 5

WEAK_HAND_UNOPENED_EARLY_CALL_PENALTY = -0.05
WEAK_HAND_UNOPENED_EARLY_AGGRESSIVE_PENALTY = -0.10
WEAK_HAND_FACING_OPEN_CALL_PENALTY = -0.10
WEAK_HAND_FACING_OPEN_AGGRESSIVE_PENALTY = -0.20
BLIND_FACING_OPEN_WEAK_AGGRESSIVE_EXTRA_PENALTY = -0.15
SB_FACING_OPEN_WEAK_3CARD_CALL_EXTRA_PENALTY = -0.08
POSTDRAW_R1_WEAK_3CARD_CALL_PENALTY = -0.10
POSTDRAW_R2_WEAK_3CARD_CALL_PENALTY = -0.15
POSTDRAW_TRASH_CALL_PENALTY = -0.20
POSTDRAW_R1_WEAK_3CARD_AGGRESSIVE_PENALTY = -0.10
POSTDRAW_R1_TRASH_AGGRESSIVE_PENALTY = -0.20
POSTDRAW_R2_WEAK_3CARD_AGGRESSIVE_PENALTY = -0.15
POSTDRAW_R2_TRASH_AGGRESSIVE_PENALTY = -0.20


# ---------------------------------------------------------------------------
# Player state helper
# ---------------------------------------------------------------------------

def _new_player(stack: int) -> dict:
    return {
        "stack": stack,
        "bet": 0,           # bet amount this round
        "hand": [],
        "folded": False,
        "all_in": False,
        "draw_history": [0, 0, 0],
        "last_draw": 0,
        "bet_history": [False, False, False],
        "opened_current_round": False,
        "discarded": [],
    }


def _postdraw_weak_trash_bucket(features: dict) -> str | None:
    high = features["highest_rank"] if features["highest_rank"] is not None else 13
    if features["count"] <= 1 or (features["count"] == 2 and high >= 9) or (
        features["count"] == 3 and high >= 10
    ):
        return "trash"
    if features["count"] == 3 and 7 <= high <= 9:
        return "weak_3card"
    return None


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

class SixMaxBadugiEnv:
    """Fixed-limit 6-max Badugi for self-play DQN training.

    Hero trains against 5 frozen copies of its own policy, seeing all
    positions across episodes.

    Usage::

        env = SixMaxBadugiEnv()
        env.set_agents(hero_agent, opp_agent)
        obs, _ = env.reset()
        while True:
            action = hero_agent.act(obs, eps, env.legal_action_mask())
            obs, reward, done, _, info = env.step(action)
            if done:
                break
    """

    metadata = {"render.modes": ["human"]}

    def __init__(self, seed: int | None = None, opp_epsilon: float = 0.05) -> None:
        self.rng = random.Random(seed)
        self.opp_epsilon = opp_epsilon
        self._hero_seat_counter = 0

        self.observation_space = spaces.Box(
            low=-1.0, high=2.0,
            shape=(BADUGI_OBSERVATION_VECTOR_SIZE,),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(6)

        self.hero_seat = 0
        self._game_ended = False
        self.hero_agent: DQNAgent | None = None
        self.opp_agent: DQNAgent | None = None
        self._init_state()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_agents(self, hero_agent: DQNAgent, opp_agent: DQNAgent) -> None:
        self.hero_agent = hero_agent
        self.opp_agent = opp_agent

    def reset(self, *, seed: int | None = None, options=None):
        if seed is not None:
            self.rng.seed(seed)
        # Cycle hero through all 6 positions
        self.hero_seat = self._hero_seat_counter % NUM_PLAYERS
        self._hero_seat_counter += 1
        # Retry until hero has a chance to act (rare: all opponents fold before hero)
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
        if mask[hero_action] <= 0:
            return self._obs_for(self.hero_seat), -2.0, True, False, {"illegal": True}

        cumulative_reward = 0.0

        if self.phase == "BET":
            # Safety: if queue is empty (shouldn't normally happen), advance phase
            if not self.bet_queue:
                done, r, info = self._advance_from_bet(0.0)
                cumulative_reward += r
                if done:
                    return self._obs_for(self.hero_seat), cumulative_reward, True, False, info
                return self._obs_for(self.hero_seat), cumulative_reward, False, False, {}

            done, r, info = self._apply_action(self.hero_seat, hero_action)
            cumulative_reward += r
            if done:
                return self._obs_for(self.hero_seat), cumulative_reward, True, False, info

            # Auto-play remaining actors in this BET round, then advance phase
            done, r, info = self._complete_bet_round_and_advance()
            cumulative_reward += r
            if done:
                return self._obs_for(self.hero_seat), cumulative_reward, True, False, info

        elif self.phase == "DRAW":
            draw_count = max(0, min(3, hero_action))
            self._apply_draw(self.hero_seat, draw_count)
            self._apply_all_opponent_draws()
            self._end_draw_round()

        return self._obs_for(self.hero_seat), cumulative_reward, False, False, {}

    # ------------------------------------------------------------------
    # Game state initialisation
    # ------------------------------------------------------------------

    def _init_state(self) -> None:
        deck = build_deck()
        self.rng.shuffle(deck)
        self.deck = deck

        # Dealer seat (BTN): hero_seat is always at a specific position relative to BTN
        # BTN = (hero_seat - position_offset) % NUM_PLAYERS
        # We'll just assign dealer_seat directly and hero_seat is pre-set
        self.dealer_seat = (self.hero_seat - self.rng.randint(0, NUM_PLAYERS - 1)) % NUM_PLAYERS

        self.players = [_new_player(STARTING_STACK) for _ in range(NUM_PLAYERS)]
        # Post blinds
        sb_seat = (self.dealer_seat + 1) % NUM_PLAYERS
        bb_seat = (self.dealer_seat + 2) % NUM_PLAYERS
        self.players[sb_seat]["stack"] -= SB_AMOUNT
        self.players[sb_seat]["bet"] = SB_AMOUNT
        self.players[bb_seat]["stack"] -= BB_AMOUNT
        self.players[bb_seat]["bet"] = BB_AMOUNT
        self.pot = SB_AMOUNT + BB_AMOUNT
        self.current_bet = BB_AMOUNT

        # Deal 4 cards to each player
        for p in self.players:
            p["hand"] = [deck.pop() for _ in range(4)]

        self.phase = "BET"
        self.draw_round = 0
        self.bet_round_idx = 0  # 0=pre-draw, 1=after-d1, 2=after-d2, 3=after-d3
        self.raise_count = 0
        self.terminal_reason: str | None = None

        # First to act pre-draw: UTG = BTN+3
        utg = (self.dealer_seat + 3) % NUM_PLAYERS
        self._setup_bet_queue(utg)

        # Auto-play opponents before hero's first turn
        self._autoplay_until_hero()

    def _setup_bet_queue(self, first_to_act: int) -> None:
        """Build action deque for a new BET round."""
        active = self._active_seats()
        self.bet_queue = deque()
        for i in range(NUM_PLAYERS):
            s = (first_to_act + i) % NUM_PLAYERS
            if s in active:
                self.bet_queue.append(s)
        self.last_aggressor: int | None = None

    # ------------------------------------------------------------------
    # Core game loop helpers
    # ------------------------------------------------------------------

    def _autoplay_until_hero(self) -> None:
        """Process opponent actions until it is hero's turn (or phase ends)."""
        if self.phase != "BET":
            return
        while self.bet_queue and self.bet_queue[0] != self.hero_seat:
            seat = self.bet_queue[0]
            if self.players[seat]["folded"]:
                self.bet_queue.popleft()
                continue
            action = self._get_opp_action_bet(seat)
            done, _, _ = self._apply_action(seat, action)
            if done:
                self._game_ended = True
                return
        # If queue is empty and hero isn't here, round ended before hero acted
        if not self.bet_queue and self.phase == "BET":
            done, _, _ = self._advance_from_bet(0.0)
            if done:
                self._game_ended = True

    def _complete_bet_round_and_advance(self) -> tuple[bool, float, dict]:
        """After hero acts in BET, process remaining actors and advance phase."""
        reward = 0.0
        # Process remaining in queue
        while self.bet_queue:
            seat = self.bet_queue[0]
            if self.players[seat]["folded"]:
                self.bet_queue.popleft()
                continue
            if seat == self.hero_seat:
                # Hero acts again (re-raise situation) — return, let step() handle it
                return False, reward, {}
            action = self._get_opp_action_bet(seat)
            done, r, info = self._apply_action(seat, action)
            reward += r
            if done:
                return True, reward, info

        # BET round over — advance to DRAW or SHOWDOWN
        return self._advance_from_bet(reward)

    def _advance_from_bet(self, reward: float) -> tuple[bool, float, dict]:
        """BET round ended. Move to DRAW or showdown."""
        active = self._active_seats_list()
        if len(active) <= 1:
            winner = active[0] if active else self.hero_seat
            r = self._settle(winner)
            return True, reward + r, {"terminal_reason": "fold_win"}

        if self.draw_round >= MAX_DRAWS:
            # Final bet round done → showdown
            r = self._showdown()
            return True, reward + r, {"terminal_reason": "showdown"}

        # Move to DRAW phase
        self.phase = "DRAW"
        # v2: save bet history
        for s in range(NUM_PLAYERS):
            p = self.players[s]
            idx = min(2, self.draw_round)
            p["bet_history"][idx] = p["opened_current_round"]
            p["opened_current_round"] = False
            p["bet"] = 0
        self.current_bet = 0

        # Auto-play opponents' draws that come BEFORE hero in draw order
        # Draw order: starts from BTN+1 going clockwise
        draw_start = (self.dealer_seat + 1) % NUM_PLAYERS
        self.draw_order = deque()
        for i in range(NUM_PLAYERS):
            s = (draw_start + i) % NUM_PLAYERS
            if s in set(self._active_seats_list()):
                self.draw_order.append(s)

        # Pre-play opponents before hero in draw order
        while self.draw_order and self.draw_order[0] != self.hero_seat:
            s = self.draw_order.popleft()
            draw_cnt = self._get_opp_draw_count(s)
            self._apply_draw(s, draw_cnt)

        # Hero is now at front of draw_order (or draw_order is empty if hero went first)
        if not self.draw_order or self.draw_order[0] == self.hero_seat:
            return False, reward, {}  # hero needs to draw

        # Hero is not in draw order (folded?) — auto-complete draw phase
        self._apply_all_opponent_draws()
        self._end_draw_round()
        return False, reward, {}

    def _apply_all_opponent_draws(self) -> None:
        """Apply draws for remaining players after hero has drawn."""
        remaining = list(self.draw_order)
        if remaining and remaining[0] == self.hero_seat:
            remaining = remaining[1:]  # skip hero
        for s in remaining:
            if s == self.hero_seat:
                continue
            draw_cnt = self._get_opp_draw_count(s)
            self._apply_draw(s, draw_cnt)

    def _end_draw_round(self) -> None:
        """Transition from DRAW back to BET."""
        self.draw_round += 1
        self.phase = "BET"
        self.raise_count = 0
        self.current_bet = BIG_BET if self.draw_round >= 2 else SMALL_BET
        for p in self.players:
            p["bet"] = 0
        self.bet_round_idx = self.draw_round
        # Post-draw betting: start from BTN+1 (SB position)
        first_post_draw = (self.dealer_seat + 1) % NUM_PLAYERS
        self._setup_bet_queue(first_post_draw)
        self._autoplay_until_hero()

    # ------------------------------------------------------------------
    # Action application
    # ------------------------------------------------------------------

    def _fold_shaping(self, seat: int) -> float:
        """Immediate fold shaping for hero, mirroring DualAgentBadugiEnv._apply_hero_bet.

        Good fold (equity < pot odds): +0.30, folding was correct.
        Bad fold  (equity > pot odds): -0.30 to -0.90, discourages folding equity.

        Only applied when *hero* folds so opponent auto-play logic is unchanged.
        Returns done=True from _apply_action so the terminal -1.0 from the
        opponent winning the pot is NOT added on top of this shaping reward.
        This matches the HU environment's fold-return semantics.
        """
        p = self.players[seat]
        to_call = max(0, self.current_bet - p["bet"])
        f = _evaluate_badugi_features(p["hand"])
        sb_facing_open_weak_3card_fold = (
            self.phase == "BET"
            and self.draw_round == 0
            and self._is_small_blind_position(seat)
            and self._is_facing_open(to_call)
            and f["count"] == 3
            and f["highest_rank"] >= 7
        )
        if sb_facing_open_weak_3card_fold:
            return 0.10 if f["highest_rank"] >= 9 else 0.0

        if self.phase == "BET" and self.draw_round in (1, 2, 3) and to_call > 0:
            if _postdraw_weak_trash_bucket(f) in {"weak_3card", "trash"}:
                return 0.30

        strength = float(f["strength"])
        pot_odds = to_call / max(1, self.pot + to_call) if to_call > 0 else 0.0
        if strength < pot_odds:
            return 0.30
        equity_missed = strength - pot_odds
        return -max(0.30, min(0.90, 0.20 + equity_missed * 1.5))

    def _weak_hand_play_penalty(self, seat: int, action: int) -> float:
        """Discourage loose weak hand participation in targeted risky spots."""
        if (
            seat != self.hero_seat
            or self.phase != "BET"
            or action not in (CALL, BET, RAISE, ALL_IN)
        ):
            return 0.0

        f = _evaluate_badugi_features(self.players[seat]["hand"])
        player = self.players[seat]
        to_call = max(0, self.current_bet - player["bet"])

        if self.draw_round in (1, 2):
            if to_call <= 0 or action not in (CALL, RAISE):
                return 0.0
            bucket = _postdraw_weak_trash_bucket(f)
            if action == CALL:
                if bucket == "trash":
                    return POSTDRAW_TRASH_CALL_PENALTY
                if bucket == "weak_3card":
                    return (
                        POSTDRAW_R1_WEAK_3CARD_CALL_PENALTY
                        if self.draw_round == 1
                        else POSTDRAW_R2_WEAK_3CARD_CALL_PENALTY
                    )
                return 0.0
            if self.draw_round == 1:
                if bucket == "trash":
                    return POSTDRAW_R1_TRASH_AGGRESSIVE_PENALTY
                if bucket == "weak_3card":
                    return POSTDRAW_R1_WEAK_3CARD_AGGRESSIVE_PENALTY
            if self.draw_round == 2:
                if bucket == "trash":
                    return POSTDRAW_R2_TRASH_AGGRESSIVE_PENALTY
                if bucket == "weak_3card":
                    return POSTDRAW_R2_WEAK_3CARD_AGGRESSIVE_PENALTY
            return 0.0

        if self.draw_round != 0:
            return 0.0

        high = f["highest_rank"] if f["highest_rank"] is not None else 13
        is_weak_3card = f["count"] == 3 and high >= 7
        is_weak_2card = f["count"] == 2 and high >= 8
        is_trash = f["count"] <= 1 or is_weak_2card or (f["count"] == 3 and high >= 10)
        is_weak_hand = is_weak_3card or is_weak_2card

        facing_open = self._is_facing_open(to_call)
        if facing_open:
            if action == CALL:
                if not is_weak_hand:
                    return 0.0
                penalty = WEAK_HAND_FACING_OPEN_CALL_PENALTY
                if self._is_small_blind_position(seat) and is_weak_3card:
                    penalty += SB_FACING_OPEN_WEAK_3CARD_CALL_EXTRA_PENALTY
                return penalty
            if self._is_blind_position(seat) and (is_weak_hand or is_trash):
                return (
                    WEAK_HAND_FACING_OPEN_AGGRESSIVE_PENALTY
                    + BLIND_FACING_OPEN_WEAK_AGGRESSIVE_EXTRA_PENALTY
                )
            if not is_weak_hand:
                return 0.0
            penalty = WEAK_HAND_FACING_OPEN_AGGRESSIVE_PENALTY
            return penalty

        if not is_weak_hand:
            return 0.0
        if not self._is_early_position(seat):
            return 0.0
        if action == CALL:
            return WEAK_HAND_UNOPENED_EARLY_CALL_PENALTY
        return WEAK_HAND_UNOPENED_EARLY_AGGRESSIVE_PENALTY

    def _apply_action(self, seat: int, action: int) -> tuple[bool, float, dict]:
        """Apply a BET-phase action for seat. Returns (done, shaping_reward, info)."""
        p = self.players[seat]
        to_call = max(0, self.current_bet - p["bet"])
        bet_size = BIG_BET if self.draw_round >= 2 else SMALL_BET
        reward = 0.0

        if action == FOLD:
            p["folded"] = True
            if seat == self.hero_seat:
                # Hero fold: immediate terminal with fold shaping.
                # done=True prevents the auto-played -1.0 terminal from being
                # added on top of the shaping signal (matches HU env semantics).
                self.terminal_reason = "hero_fold"
                return True, self._fold_shaping(seat), {"terminal_reason": "hero_fold"}
            # Non-hero fold: existing logic unchanged.
            active = self._active_seats_list()
            if len(active) == 1:
                r = self._settle(active[0])
                return True, reward + r, {"terminal_reason": "fold_win"}
            self.bet_queue.popleft()
            return False, reward, {}

        elif action == CHECK:
            p["bet"] = p["bet"]  # no change
            self.bet_queue.popleft()
            return False, 0.0, {}

        elif action == CALL:
            reward += self._weak_hand_play_penalty(seat, action)
            paid = min(to_call, p["stack"])
            p["stack"] -= paid
            p["bet"] += paid
            self.pot += paid
            if p["stack"] == 0:
                p["all_in"] = True
            self.bet_queue.popleft()
            return False, reward, {}

        elif action == BET:
            reward += self._weak_hand_play_penalty(seat, action)
            paid = min(bet_size, p["stack"])
            p["stack"] -= paid
            p["bet"] += paid
            self.pot += paid
            self.current_bet = p["bet"]
            p["opened_current_round"] = True
            self._on_raise(seat)
            return False, reward, {}

        elif action == RAISE:
            reward += self._weak_hand_play_penalty(seat, action)
            paid = min(to_call + bet_size, p["stack"])
            p["stack"] -= paid
            p["bet"] += paid
            self.pot += paid
            self.current_bet = p["bet"]
            self.raise_count += 1
            p["opened_current_round"] = True
            self._on_raise(seat)
            return False, reward, {}

        # ALL_IN: treat as all-in call/raise
        reward += self._weak_hand_play_penalty(seat, action)
        paid = p["stack"]
        p["stack"] = 0
        p["bet"] += paid
        self.pot += paid
        p["all_in"] = True
        self.bet_queue.popleft()
        return False, reward, {}

    def _on_raise(self, aggressor: int) -> None:
        """After a bet/raise, re-queue all active players who haven't matched."""
        self.last_aggressor = aggressor
        active = self._active_seats()
        new_queue: deque = deque()
        # Everyone active except aggressor needs to respond, in order after aggressor
        for i in range(1, NUM_PLAYERS):
            s = (aggressor + i) % NUM_PLAYERS
            if s in active and not self.players[s]["folded"]:
                new_queue.append(s)
        self.bet_queue = new_queue

    def _apply_draw(self, seat: int, draw_count: int) -> None:
        p = self.players[seat]
        new_hand, discarded = _draw_toward_badugi(p["hand"], draw_count, self.deck)
        p["hand"] = new_hand
        p["discarded"].extend(discarded)
        p["last_draw"] = draw_count
        p["draw_history"][min(2, self.draw_round)] = draw_count

    def _settle(self, winner: int) -> float:
        """One player won without showdown."""
        self.terminal_reason = "fold_win"
        if winner == self.hero_seat:
            return 1.0 + min(2.0, self.pot / 40.0)
        return -1.0

    def _showdown(self) -> float:
        """Evaluate all hands; return hero's reward (normalized to [-1, +3] scale)."""
        self.terminal_reason = "showdown"
        active = self._active_seats_list()
        scores = {s: evaluate_badugi(self.players[s]["hand"]) for s in active}
        # Find winner(s): highest made_count, then lowest ranks
        best_count = max(s[0] for s in scores.values())
        best_seats = [s for s in active if scores[s][0] == best_count]
        if len(best_seats) > 1:
            min_sum = min(sum(scores[s][1]) for s in best_seats)
            winners = [s for s in best_seats if sum(scores[s][1]) == min_sum]
        else:
            winners = best_seats
        if self.hero_seat in winners:
            # Normalize: same scale as _settle — caps at +3.0
            return 1.0 + min(2.0, self.pot / 40.0)
        return -1.0

    # ------------------------------------------------------------------
    # Opponent action selection (batched)
    # ------------------------------------------------------------------

    def _get_opp_actions_batched(self, seats: list[int], phase: str) -> list[int]:
        """Batch forward pass for multiple opponent seats."""
        if not seats:
            return []
        if self.opp_agent is None:
            return [self._fallback_bet(s) if phase == "BET" else self._fallback_draw(s)
                    for s in seats]
        import torch
        obs_batch = np.stack([self._obs_for(s) for s in seats], axis=0)
        with torch.no_grad():
            q_batch = self.opp_agent.q_network(
                torch.tensor(obs_batch, dtype=torch.float32)
            ).numpy()
        actions = []
        for i, seat in enumerate(seats):
            q = q_batch[i].copy()
            mask = (self._mask_for(seat) if phase == "BET"
                    else np.array([1,1,1,1,0,0], dtype=np.float32))
            q[mask <= 0] = -1e9
            if self.opp_epsilon > 0 and np.random.random() < self.opp_epsilon:
                legal = np.where(mask > 0)[0]
                actions.append(int(np.random.choice(legal)))
            else:
                actions.append(int(np.argmax(q)))
        return actions

    def _get_opp_action_bet(self, seat: int) -> int:
        return self._get_opp_actions_batched([seat], "BET")[0]

    def _get_opp_draw_count(self, seat: int) -> int:
        action = self._get_opp_actions_batched([seat], "DRAW")[0]
        return max(0, min(3, action))

    def _fallback_bet(self, seat: int) -> int:
        to_call = max(0, self.current_bet - self.players[seat]["bet"])
        return CALL if to_call > 0 else CHECK

    def _fallback_draw(self, seat: int) -> int:
        hand = self.players[seat]["hand"]
        keep = _best_badugi_keep(hand)
        return min(3, len(hand) - len(keep))

    # ------------------------------------------------------------------
    # Legal action masks
    # ------------------------------------------------------------------

    def _mask_for(self, seat: int) -> np.ndarray:
        """Legal action mask for seat in current phase."""
        mask = np.zeros(6, dtype=np.float32)
        if self.phase == "DRAW":
            mask[0:4] = 1.0  # draw 0-3
            return mask
        p = self.players[seat]
        to_call = max(0, self.current_bet - p["bet"])
        bet_size = BIG_BET if self.draw_round >= 2 else SMALL_BET
        if to_call > 0:
            mask[FOLD] = 1.0
            if p["stack"] >= to_call:
                mask[CALL] = 1.0
            if self.raise_count < MAX_BETS and p["stack"] >= to_call + bet_size:
                mask[RAISE] = 1.0
        else:
            mask[CHECK] = 1.0
            if p["stack"] >= bet_size:
                mask[BET] = 1.0
        return mask

    # ------------------------------------------------------------------
    # Observation building
    # ------------------------------------------------------------------

    def _obs_for(self, seat: int) -> np.ndarray:
        """Build 96-dim observation from seat's perspective (matches BadugiEnv._get_obs())."""
        obs = np.zeros(BADUGI_OBSERVATION_VECTOR_SIZE, dtype=np.float32)
        p = self.players[seat]
        hand = p["hand"]
        active = self._active_seats_list()
        active_opps = [s for s in active if s != seat]
        n_opps = len(active_opps)

        # Slots 0-7: raw cards
        for i, (rank, suit) in enumerate(hand[:4]):
            obs[i * 2] = rank / 12.0
            obs[i * 2 + 1] = suit / 3.0

        f = _evaluate_badugi_features(hand)
        current_bet = self.current_bet if self.phase == "BET" else 0
        to_call = max(0, current_bet - p["bet"])
        draws_remaining = MAX_DRAWS - self.draw_round
        pot_odds_val = to_call / max(1, self.pot + to_call) if to_call > 0 else 0.0
        is_button = seat == self.dealer_seat
        pos_fraction = self._position_fraction(seat)
        is_final = self.phase == "BET" and self.draw_round >= MAX_DRAWS

        # Aggregate opponent stats
        opp_last_draws = [self.players[s]["last_draw"] for s in active_opps]
        opp_draw_hist_0 = np.mean([self.players[s]["draw_history"][0] for s in active_opps]) if active_opps else 0.0
        opp_draw_hist_1 = np.mean([self.players[s]["draw_history"][1] for s in active_opps]) if active_opps else 0.0
        opp_draw_hist_2 = np.mean([self.players[s]["draw_history"][2] for s in active_opps]) if active_opps else 0.0
        opp_last_draw_avg = np.mean(opp_last_draws) if opp_last_draws else 0.0
        opp_stacks = [self.players[s]["stack"] for s in active_opps]
        opp_stack_avg = np.mean(opp_stacks) if opp_stacks else STARTING_STACK

        # Opp betting behaviour (aggregate)
        opp_opened = any(self.players[s]["opened_current_round"] for s in active_opps)
        n_opp_pat = sum(1 for s in active_opps if self.players[s]["last_draw"] == 0 and self.draw_round > 0)
        opp_pat_rate = n_opp_pat / max(1, n_opps)
        opp_aggr_rate = sum(1 for s in active_opps if self.players[s]["opened_current_round"]) / max(1, n_opps)
        opp_foldability = 0.30  # neutral for self-play

        # Slots 8-21
        obs[8]  = self.draw_round / MAX_DRAWS
        obs[9]  = p["stack"] / 200.0
        obs[10] = opp_stack_avg / 200.0
        obs[11] = min(self.pot, 400) / 400.0
        obs[12] = min(p["bet"], 10) / 10.0
        opp_bet_avg = np.mean([self.players[s]["bet"] for s in active_opps]) if active_opps else 0.0
        obs[13] = min(opp_bet_avg, 10) / 10.0
        obs[14] = min(current_bet, 10) / 10.0
        obs[15] = self.raise_count / MAX_BETS
        obs[16] = draws_remaining / MAX_DRAWS
        obs[17] = 0.0 if self.phase == "BET" else 1.0
        obs[18] = opp_last_draw_avg / 4.0
        obs[19] = 1.0 if is_button else 0.0
        obs[20] = 1.0 if self._is_first_to_act(seat) else 0.0
        obs[21] = pos_fraction

        # Slots 22-31: hand features
        dup_r, dup_s = self._duplicate_counts(hand)
        hand_str = f["strength"]
        obs[22] = f["count"] / 4.0
        obs[23] = min(f["rank_sum"], 40) / 40.0
        obs[24] = (max(f["ranks"]) if f["ranks"] else 13) / 13.0
        obs[25] = min(dup_r, 3) / 3.0
        obs[26] = min(dup_s, 3) / 3.0
        obs[27] = hand_str  # starting_hand_strength
        obs[28] = pot_odds_val
        obs[29] = 0.0 if self._is_first_to_act(seat) else 1.0
        obs[30] = min(to_call, 10) / 10.0
        obs[31] = 1.0 if f["one_away"] else 0.0

        # Slots 32-37: action mask
        mask = self._mask_for(seat)
        obs[32:38] = mask

        # Slots 38-47: hand + opponent stats
        street_str = self._street_adjusted_strength(f, draws_remaining)
        opp_draw_pressure = 0.08 if (is_final and opp_last_draw_avg >= 2) else (0.03 if opp_last_draw_avg >= 1 else -0.05)
        obs[38] = street_str
        obs[39] = opp_draw_pressure
        obs[40] = 1.0 if is_final else 0.0
        obs[41] = 1.0 if (is_final and f["count"] == 4 and f["highest_rank"] >= 11) else 0.0
        obs[42] = opp_aggr_rate
        obs[43] = 1.0 - opp_aggr_rate  # passivity
        obs[44] = opp_pat_rate
        obs[45] = opp_last_draw_avg / 4.0
        obs[46] = opp_foldability
        obs[47] = 0.05  # bluff_frequency neutral

        # Slots 48-60: EV + 6-max features
        equity = street_str
        call_ev = (equity * (self.pot + to_call) - to_call) / 10.0 if to_call > 0 else equity * self.pot / 10.0
        raise_ev = (equity * (self.pot + SMALL_BET) - SMALL_BET) / 10.0
        draw_equity = max(0.0, (4 - f["count"]) * 0.12)
        obs[48] = equity
        obs[49] = pot_odds_val
        obs[50] = max(-1.0, min(1.0, call_ev))
        obs[51] = max(-1.0, min(1.0, raise_ev))
        obs[52] = draw_equity
        obs[53] = opp_foldability
        obs[54] = max(0.0, min(1.0, equity * draws_remaining * 0.25))  # future_street_value
        obs[55] = max(0.0, min(1.0, max(0.0, call_ev)))  # cheap_draw_continue_value
        # ---- 6-max specific (56-60) ----
        obs[56] = n_opps / 5.0   # active_opponent_count / 5
        obs[57] = self._multiway_pressure(n_opps, pos_fraction)  # multiway_pressure
        obs[58] = self._range_equity(f)   # range_equity_percentile
        obs[59] = self._isolation_pressure(seat, f, to_call, n_opps)  # isolation_pressure
        obs[60] = 1.0 if self._late_semibluff_spot(seat, f, to_call, draws_remaining, n_opps) else 0.0

        # ---- v2: slots 61-74 ----
        obs[61] = 1.0 if p["bet_history"][0] else 0.0
        obs[62] = 1.0 if p["bet_history"][1] else 0.0
        obs[63] = 1.0 if p["bet_history"][2] else 0.0
        obs[64] = 1.0 if p["opened_current_round"] else 0.0
        obs[65] = p["draw_history"][0] / 3.0
        obs[66] = p["draw_history"][1] / 3.0
        obs[67] = p["last_draw"] / 3.0
        obs[68] = max(-1.0, min(1.0, (opp_draw_hist_0 - opp_draw_hist_1) / 3.0))
        obs[69] = max(-1.0, min(1.0, (opp_draw_hist_1 - opp_draw_hist_2) / 3.0))
        obs[70] = max(-1.0, min(1.0, (opp_last_draw_avg - p["last_draw"]) / 3.0))
        dead_aces = sum(1 for r, _ in p["discarded"] if r == 0)
        dead_prem = sum(1 for r, _ in p["discarded"] if r <= 3)
        obs[71] = min(1.0, dead_aces / 4.0)
        obs[72] = min(1.0, dead_prem / 16.0)
        obs[73] = 0.0 if is_button else 1.0
        total_opp_stack = sum(opp_stacks)
        obs[74] = min(1.0, (opp_stack_avg / max(1, p["stack"])) / 2.0)

        return obs

    # ------------------------------------------------------------------
    # 6-max feature helpers
    # ------------------------------------------------------------------

    def _position_fraction(self, seat: int) -> float:
        """0=SB/most OOP … 1=BTN/most IP."""
        seats_in_order = [(self.dealer_seat + 1 + i) % NUM_PLAYERS for i in range(NUM_PLAYERS)]
        try:
            pos = seats_in_order.index(seat)
        except ValueError:
            pos = 0
        return pos / (NUM_PLAYERS - 1)

    def _is_early_position(self, seat: int) -> bool:
        """True for UTG/MP by the same button-relative mapping used in telemetry."""
        offset = (seat - self.dealer_seat) % NUM_PLAYERS
        return offset in (3, 4)

    def _is_blind_position(self, seat: int) -> bool:
        """True for SB/BB by the same button-relative mapping used in telemetry."""
        offset = (seat - self.dealer_seat) % NUM_PLAYERS
        return offset in (1, 2)

    def _is_small_blind_position(self, seat: int) -> bool:
        """True for SB by the same button-relative mapping used in telemetry."""
        offset = (seat - self.dealer_seat) % NUM_PLAYERS
        return offset == 1

    def _is_facing_open(self, to_call: int) -> bool:
        return self.current_bet > BB_AMOUNT or to_call > BB_AMOUNT

    def _is_first_to_act(self, seat: int) -> bool:
        if not self.bet_queue:
            return False
        return self.bet_queue[0] == seat

    def _multiway_pressure(self, n_opps: int, pos_fraction: float) -> float:
        if n_opps <= 1:
            return 0.0
        return min(0.35, max(0.0, 0.5 - pos_fraction) * 0.24 + max(0, n_opps - 1) * 0.035)

    def _range_equity(self, f: dict) -> float:
        count = f["count"]
        high = f["highest_rank"] if f["highest_rank"] else 13
        rsum = f["rank_sum"] if f["rank_sum"] else 99
        if count >= 4:
            return min(1.0, 0.62 + (13 - high) / 12 * 0.30 + max(0, 22 - rsum) * 0.006)
        if count == 3:
            return min(1.0, 0.36 + (13 - high) / 12 * 0.28)
        if count == 2:
            return min(1.0, 0.14 + (13 - high) / 12 * 0.15)
        return 0.04

    def _isolation_pressure(self, seat: int, f: dict, to_call: int, n_opps: int) -> float:
        if to_call <= 0 or n_opps < 2:
            return 0.0
        pos = self._position_fraction(seat)
        return min(0.35,
            (0.12 if pos >= 0.6 else 0.0) +
            (0.18 if f["count"] == 4 and f["highest_rank"] <= 9 else 0.0) +
            (0.10 if f["count"] == 3 and f["highest_rank"] <= 7 else 0.0) +
            (0.05 if self.pot >= 12 else 0.0))

    def _late_semibluff_spot(self, seat: int, f: dict, to_call: int, draws_remaining: int, n_opps: int) -> bool:
        high = f["highest_rank"] if f["highest_rank"] else 13
        pos = self._position_fraction(seat)
        # This observation feature does not force BET directly, but it is a
        # semi-bluff signal to the Q network. In early self-play and high-VPIP
        # games a broad late-position signal can amplify over-aggression, so keep
        # it restricted to clean CO/BTN draw spots. Position encoding itself is
        # unchanged; only this derived feature is gated more conservatively.
        return (
            self.phase == "BET"
            and 1 <= n_opps <= 2
            and to_call == 0
            and self.current_bet == 0
            and pos >= 0.8
            and f["count"] == 3
            and high <= 7
            and draws_remaining >= 2
            and self.pot <= 14
        )

    def _street_adjusted_strength(self, f: dict, draws_remaining: int) -> float:
        high = f["highest_rank"] if f["highest_rank"] else 13
        low_q = max(0.0, (13 - high) / 12)
        if f["count"] == 4:
            return min(1.0, 0.54 + low_q * 0.34 + 0.18 * (draws_remaining / 3))
        if f["count"] == 3:
            return min(0.72, 0.30 + low_q * 0.22 + 0.08 * draws_remaining)
        if f["count"] == 2:
            return min(0.34, 0.12 + low_q * 0.10 + 0.04 * draws_remaining)
        return 0.05

    def _duplicate_counts(self, hand: list) -> tuple[int, int]:
        if not hand:
            return 0, 0
        ranks = [r for r, _ in hand]
        suits = [s for _, s in hand]
        dup_r = len(ranks) - len(set(ranks))
        dup_s = len(suits) - len(set(suits))
        return dup_r, dup_s

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def _active_seats(self) -> set[int]:
        return {s for s, p in enumerate(self.players) if not p["folded"]}

    def _active_seats_list(self) -> list[int]:
        return [s for s, p in enumerate(self.players) if not p["folded"]]
