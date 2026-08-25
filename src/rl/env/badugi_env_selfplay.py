"""Self-play dual-agent Badugi environment.

Both seats (hero and opp) use DQNAgent policies. The opponent responds
automatically inside step(), so the training loop only provides hero's action.
Observations are built from the acting seat's perspective so both agents see
a consistent, symmetric view of the game state.

Existing BadugiEnv is unchanged — this module adds self-play capability
without modifying the single-agent training path.
"""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

import numpy as np
from gymnasium import spaces

from rl.env.badugi_env import (
    BADUGI_OBSERVATION_VECTOR_SIZE,
    build_deck,
    compare_badugi_scores,
    evaluate_badugi,
)

if TYPE_CHECKING:
    from rl.agents.dqn_agent import DQNAgent

# Badugi action indices (same as BadugiEnv / BADUGI_RL_ACTIONS)
_FOLD = 0
_CHECK = 1
_CALL = 2
_BET = 3
_RAISE = 4
_ALL_IN = 5

MAX_BETS = 4       # fixed-limit cap per round
SMALL_BET = 2
BIG_BET = 4
STARTING_STACK = 100
MAX_DRAWS = 3


def _evaluate_badugi_features(hand: list) -> dict:
    """Return the hand-feature dict used by the observation builder."""
    count, ranks = evaluate_badugi(hand)
    ranks_sorted = sorted(ranks) if ranks else []
    rank_sum = sum(ranks_sorted) if ranks_sorted else 99
    highest_rank = max(ranks_sorted) if ranks_sorted else 13
    is_nuts = count == 4 and ranks_sorted == [0, 1, 2, 3]
    one_away = count == 3
    # hand_strength: higher = better badugi (more made cards, lower ranks)
    if count == 4:
        strength = 0.55 + max(0.0, (13 - highest_rank) / 13) * 0.35 + (0.10 if is_nuts else 0.0)
    elif count == 3:
        strength = 0.30 + max(0.0, (13 - highest_rank) / 13) * 0.20
    elif count == 2:
        strength = 0.12 + max(0.0, (13 - highest_rank) / 13) * 0.08
    else:
        strength = 0.05
    return {
        "count": count,
        "ranks": ranks_sorted,
        "rank_sum": rank_sum,
        "highest_rank": highest_rank,
        "strength": min(1.0, max(0.0, strength)),
        "is_nuts": is_nuts,
        "one_away": one_away,
    }


def _best_badugi_keep(hand: list) -> list:
    """Return the subset of cards to keep for the best Badugi."""
    best_count, best_ranks = 0, []
    best_keep: list = []
    n = len(hand)
    for mask in range(1 << n):
        subset = [hand[i] for i in range(n) if mask & (1 << i)]
        if not subset:
            continue
        c, r = evaluate_badugi(subset)
        if c > best_count or (c == best_count and sum(sorted(r)) < sum(sorted(best_ranks))):
            best_count, best_ranks, best_keep = c, r, subset
    return best_keep


def _draw_toward_badugi(hand: list, draw_count: int, deck: list) -> tuple[list, list]:
    """Replace draw_count worst cards. Returns (new_hand, discarded)."""
    draw_count = max(0, min(3, draw_count))
    if draw_count == 0:
        return hand, []
    keep = _best_badugi_keep(hand)
    # Cards not in keep are candidates for discard (worst first)
    discard_cands = [c for c in hand if c not in keep]
    discarded = discard_cands[:draw_count]
    kept = [c for c in hand if c not in discarded]
    new_cards = [deck.pop() for _ in range(min(draw_count, len(deck)))]
    return kept + new_cards, discarded


def _legal_bet_mask(my_bet: int, current_bet: int, raise_count: int, my_stack: int) -> np.ndarray:
    mask = np.zeros(6, dtype=np.float32)
    to_call = max(0, current_bet - my_bet)
    if to_call > 0:
        mask[_FOLD] = 1.0
        mask[_CALL] = 1.0
        if raise_count < MAX_BETS and my_stack > to_call:
            mask[_RAISE] = 1.0
    else:
        mask[_CHECK] = 1.0
        if my_stack >= SMALL_BET:
            mask[_BET] = 1.0
    return mask


def _legal_draw_mask() -> np.ndarray:
    # Actions 0-3 in DRAW phase = draw 0,1,2,3 cards
    mask = np.zeros(6, dtype=np.float32)
    mask[0:4] = 1.0
    return mask


class DualAgentBadugiEnv:
    """Fixed-limit heads-up Badugi environment for self-play training.

    Both hero and opp are DQNAgent instances set via set_agents(). The
    observation vector is built from the perspective of the acting seat so
    both agents receive symmetric, information-correct observations.

    Action space (phase BET):
        0=fold  1=check  2=call  3=bet  4=raise  5=all_in(unused)

    Action space (phase DRAW):
        0=draw-0  1=draw-1  2=draw-2  3=draw-3  (4/5 unused)

    Usage::

        env = DualAgentBadugiEnv()
        env.set_agents(hero_agent, opp_agent)
        obs, _ = env.reset()
        while True:
            action = hero_agent.act(obs, epsilon, env.legal_action_mask())
            obs, reward, done, _, info = env.step(action)
            if done:
                break
    """

    metadata = {"render.modes": ["human"]}

    def __init__(self, seed: int | None = None, opp_epsilon: float = 0.0) -> None:
        """
        Args:
            opp_epsilon: Exploration rate for the frozen opponent.
                0.0 = fully greedy (pure self-play).
                0.05-0.10 = adds stochastic diversity.
        """
        self.random = random.Random(seed)
        self.opp_epsilon = float(opp_epsilon)

        self.observation_space = spaces.Box(
            low=-1.0, high=2.0,
            shape=(BADUGI_OBSERVATION_VECTOR_SIZE,),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(6)

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
            self.random.seed(seed)
        self._init_state()
        return self._obs_for(is_hero=True), {}

    def legal_action_mask(self) -> np.ndarray:
        if self.phase == "BET":
            return _legal_bet_mask(self.hero_bet, self.current_bet, self.raise_count, self.hero_stack)
        return _legal_draw_mask()

    def step(self, hero_action: int):
        mask = self.legal_action_mask()
        if mask[hero_action] <= 0:
            return self._obs_for(is_hero=True), -2.0, True, False, {"illegal": True}

        reward = 0.0

        if self.phase == "BET":
            reward += self._apply_hero_bet(hero_action)
            if hero_action == _FOLD:
                return self._obs_for(is_hero=True), reward, True, False, {"terminal_reason": "player_fold"}

            opp_terminal, opp_r = self._opp_bet_response()
            reward += opp_r
            if opp_terminal:
                return self._obs_for(is_hero=True), reward, True, False, {"terminal_reason": "opponent_fold"}

            if self.draw_round >= MAX_DRAWS:
                reward += self._showdown_reward()
                return self._obs_for(is_hero=True), reward, True, False, {"terminal_reason": "showdown"}

            self.phase = "DRAW"

        elif self.phase == "DRAW":
            draw_count = max(0, min(3, hero_action))
            reward += self._apply_hero_draw(draw_count)
            self._apply_opp_draw()

            # Save bet-round history before resetting
            round_idx = min(2, self.draw_round)
            self.hero_bet_history[round_idx] = self.hero_opened_current_round
            self.opp_bet_history[round_idx] = self.opp_opened_current_round
            self.hero_opened_current_round = False
            self.opp_opened_current_round = False

            self.draw_round += 1
            self.phase = "BET"
            self.raise_count = 0
            self.current_bet = BIG_BET  # big-bet rounds post-draw
            self.hero_bet = 0
            self.opp_bet = 0

        return self._obs_for(is_hero=True), reward, False, False, {}

    # ------------------------------------------------------------------
    # State initialisation
    # ------------------------------------------------------------------

    def _init_state(self) -> None:
        deck = build_deck()
        self.random.shuffle(deck)
        self.deck = deck
        self.hero_hand = [self.deck.pop() for _ in range(4)]
        self.opp_hand = [self.deck.pop() for _ in range(4)]

        self.phase = "BET"
        self.draw_round = 0
        self.raise_count = 0
        self.pot = 3
        self.hero_stack = STARTING_STACK - 1
        self.opp_stack = STARTING_STACK - 2
        self.current_bet = SMALL_BET
        self.hero_bet = 1   # SB
        self.opp_bet = 2    # BB
        self.hero_is_button = self.random.random() < 0.5

        # v2 history tracking (mirrors BadugiEnv)
        self.hero_last_draw: int = 0
        self.opp_last_draw: int = 0
        self.hero_draw_history: list[int] = [0, 0, 0]
        self.opp_draw_history: list[int] = [0, 0, 0]
        self.hero_opened_current_round: bool = False
        self.opp_opened_current_round: bool = False
        self.hero_bet_history: list[bool] = [False, False, False]
        self.opp_bet_history: list[bool] = [False, False, False]
        self.hero_discarded: list = []
        self.opp_discarded: list = []

    # ------------------------------------------------------------------
    # Observation building
    # ------------------------------------------------------------------

    def _obs_for(self, is_hero: bool) -> np.ndarray:
        if is_hero:
            my_hand, my_bet, my_stack = self.hero_hand, self.hero_bet, self.hero_stack
            my_is_button = self.hero_is_button
            my_draw_hist, my_last_draw = self.hero_draw_history, self.hero_last_draw
            my_bet_hist, my_opened = self.hero_bet_history, self.hero_opened_current_round
            my_discarded = self.hero_discarded
            opp_draw_hist, opp_last_draw = self.opp_draw_history, self.opp_last_draw
            opp_opened = self.opp_opened_current_round
            opp_bet_hist = self.opp_bet_history
            opp_stack = self.opp_stack
        else:
            my_hand, my_bet, my_stack = self.opp_hand, self.opp_bet, self.opp_stack
            my_is_button = not self.hero_is_button
            my_draw_hist, my_last_draw = self.opp_draw_history, self.opp_last_draw
            my_bet_hist, my_opened = self.opp_bet_history, self.opp_opened_current_round
            my_discarded = self.opp_discarded
            opp_draw_hist, opp_last_draw = self.hero_draw_history, self.hero_last_draw
            opp_opened = self.hero_opened_current_round
            opp_bet_hist = self.hero_bet_history
            opp_stack = self.hero_stack

        return self._build_obs(
            my_hand=my_hand, my_bet=my_bet, my_stack=my_stack,
            my_is_button=my_is_button,
            my_draw_hist=my_draw_hist, my_last_draw=my_last_draw,
            my_bet_hist=my_bet_hist, my_opened=my_opened,
            my_discarded=my_discarded,
            opp_draw_hist=opp_draw_hist, opp_last_draw=opp_last_draw,
            opp_opened=opp_opened, opp_bet_hist=opp_bet_hist,
            opp_stack=opp_stack,
        )

    def _build_obs(
        self, *,
        my_hand, my_bet, my_stack, my_is_button,
        my_draw_hist, my_last_draw, my_bet_hist, my_opened, my_discarded,
        opp_draw_hist, opp_last_draw, opp_opened, opp_bet_hist, opp_stack,
    ) -> np.ndarray:
        obs = np.zeros(BADUGI_OBSERVATION_VECTOR_SIZE, dtype=np.float32)
        f = _evaluate_badugi_features(my_hand)
        to_call = max(0, self.current_bet - my_bet)
        draws_remaining = MAX_DRAWS - self.draw_round
        pot_odds = to_call / max(1, self.pot + to_call) if to_call > 0 else 0.0
        is_final_street = self.phase == "BET" and self.draw_round >= MAX_DRAWS

        obs[0] = self.draw_round / MAX_DRAWS
        obs[1] = 1.0 if self.phase == "BET" else 0.0
        obs[2] = 1.0 if self.phase == "DRAW" else 0.0
        obs[3] = pot_odds
        obs[4] = min(self.pot, 100) / 100.0
        obs[5] = 1.0 if my_is_button else 0.0
        obs[6] = 1.0 if is_final_street else 0.0
        obs[7] = opp_last_draw / 5.0

        # Slots 8-11: opponent profile — neutral for self-play
        obs[8] = 0.05   # bluff_frequency
        obs[9] = 0.54   # open_strength
        obs[10] = 0.50  # call_strength
        obs[11] = 0.76  # raise_strength

        obs[12] = draws_remaining / MAX_DRAWS
        obs[13] = opp_draw_hist[0] / 5.0
        obs[14] = opp_draw_hist[1] / 5.0
        obs[15] = f["count"] / 5.0
        obs[16] = f["highest_rank"] / 13.0
        obs[17] = min(1.0, f["rank_sum"] / 52.0)
        obs[18] = max(0.0, (4 - f["count"]) / 4.0)   # approx duplicate ranks
        obs[19] = max(0.0, (4 - f["count"]) / 4.0)   # approx duplicate suits
        obs[20] = 0.0   # is_straight (not penalised in badugi)
        obs[21] = 0.0   # is_flush (not penalised in badugi)
        obs[22] = f["strength"]
        obs[23] = opp_draw_hist[2] / 5.0
        obs[24] = sum(opp_draw_hist) / 15.0
        obs[25] = self.current_bet / 20.0
        obs[26] = self.raise_count / MAX_BETS
        obs[27] = 1.0 if (opp_last_draw == 0 and self.draw_round > 0) else 0.0
        obs[28] = 1.0 if opp_opened else 0.0
        obs[29] = 1.0 if opp_bet_hist[0] else 0.0
        obs[30] = 1.0 if opp_bet_hist[1] else 0.0
        obs[31] = f["strength"]   # draw_adjusted_strength (approx)
        obs[32] = max(0.0, (4 - f["count"])) / 4.0  # planned_draw_count / 4

        # Slots 33-47: EV / 6-max features — simplified for heads-up
        obs[33] = f["strength"]   # estimatedEquity
        obs[34] = pot_odds
        # callEV / raiseEV rough estimates
        ev_equity = f["strength"]
        obs[35] = max(-1.0, min(1.0, (ev_equity * (self.pot + to_call) - to_call) / 10.0))
        obs[36] = max(-1.0, min(1.0, (ev_equity * (self.pot + SMALL_BET) - SMALL_BET) / 10.0))
        obs[37] = max(0.0, min(1.0, (4 - f["count"]) * 0.15))  # drawEquity
        obs[38] = 0.30   # foldEquity neutral
        obs[39] = f["strength"] * 0.5  # futureStreetValue
        obs[40] = max(0.0, obs[35])    # cheapDrawContinueValue
        obs[41] = 0.0  # family low-27 flag (not applicable)
        obs[42] = 0.0  # family low-a5 flag (not applicable)
        obs[43] = 0.0  # multiway pressure (heads-up = 0)
        obs[44] = f["strength"]  # rangeEquity
        obs[45] = 0.0  # isolationPressure
        obs[46] = 0.0  # lateSemibluffSpot
        obs[47] = 0.0  # (unused)

        # Action mask (slots 48-53)
        if self.phase == "BET":
            mask = _legal_bet_mask(my_bet, self.current_bet, self.raise_count, my_stack)
        else:
            mask = _legal_draw_mask()
        obs[48:54] = mask

        obs[54] = 0.0  # activeOpponentCount (1 in heads-up, normalised to 0)
        obs[55] = 0.0  # multiwayPressure
        obs[56] = f["strength"]  # rangeEquity repeat
        obs[57] = 0.0  # isolationPressure
        obs[58] = 0.0  # 6max open spot
        obs[59] = 0.0  # 6max late semibluff
        obs[60] = 1.0 if is_final_street else 0.0

        # ---- v2: slots 61-74 ----
        obs[61] = 1.0 if my_bet_hist[0] else 0.0
        obs[62] = 1.0 if my_bet_hist[1] else 0.0
        obs[63] = 1.0 if my_bet_hist[2] else 0.0
        obs[64] = 1.0 if my_opened else 0.0
        obs[65] = my_draw_hist[0] / 3.0
        obs[66] = my_draw_hist[1] / 3.0
        obs[67] = my_last_draw / 3.0
        obs[68] = max(-1.0, min(1.0, (opp_draw_hist[0] - opp_draw_hist[1]) / 3.0))
        obs[69] = max(-1.0, min(1.0, (opp_draw_hist[1] - opp_draw_hist[2]) / 3.0))
        obs[70] = max(-1.0, min(1.0, (opp_last_draw - my_last_draw) / 3.0))
        # Dead cards (rank 0 = Ace in Python / rank 1 = Ace in card tuple)
        dead_aces = sum(1 for r, _ in my_discarded if r == 0)
        dead_premium = sum(1 for r, _ in my_discarded if r <= 3)
        obs[71] = min(1.0, dead_aces / 4.0)
        obs[72] = min(1.0, dead_premium / 16.0)
        obs[73] = 0.0 if my_is_button else 1.0  # OOP = draws first
        obs[74] = min(1.0, (opp_stack / max(1, my_stack)) / 2.0)

        return obs

    # ------------------------------------------------------------------
    # Hero bet application
    # ------------------------------------------------------------------

    def _apply_hero_bet(self, action: int) -> float:
        f = _evaluate_badugi_features(self.hero_hand)
        strength = f["strength"]
        to_call = max(0, self.current_bet - self.hero_bet)
        pot_odds = to_call / max(1, self.pot + to_call) if to_call > 0 else 0.0

        if action == _FOLD:
            return 0.15 if strength < pot_odds else -max(0.30, min(0.90, 0.20 + (strength - pot_odds) * 1.5))
        if action == _CHECK:
            return 0.0
        if action == _CALL:
            paid = min(to_call, self.hero_stack)
            self.hero_stack -= paid
            self.hero_bet += paid
            self.pot += paid
            return 0.05 + 0.10 * max(0.0, strength - pot_odds)
        bet_size = SMALL_BET if self.draw_round == 0 else BIG_BET
        if action == _BET:
            paid = min(bet_size, self.hero_stack)
            self.current_bet = paid
            self.hero_stack -= paid
            self.hero_bet += paid
            self.pot += paid
            self.hero_opened_current_round = True
            return 0.15 if strength >= 0.58 else -0.12
        if action == _RAISE:
            self.current_bet += bet_size
            self.raise_count += 1
            paid = min(to_call + bet_size, self.hero_stack)
            self.hero_stack -= paid
            self.hero_bet += paid
            self.pot += paid
            self.hero_opened_current_round = True
            return 0.20 if strength >= 0.70 else -0.25
        return 0.0  # all_in unused

    # ------------------------------------------------------------------
    # Opponent bet response (via opp_agent)
    # ------------------------------------------------------------------

    def _opp_bet_response(self) -> tuple[bool, float]:
        opp_obs = self._obs_for(is_hero=False)
        opp_mask = _legal_bet_mask(self.opp_bet, self.current_bet, self.raise_count, self.opp_stack)
        if self.opp_agent is not None:
            opp_action = self.opp_agent.act(opp_obs, epsilon=self.opp_epsilon, action_mask=opp_mask)
            if opp_mask[opp_action] <= 0:
                opp_action = int(np.argmax(opp_mask)) if opp_mask.sum() > 0 else _CHECK
        else:
            to_call = max(0, self.current_bet - self.opp_bet)
            opp_action = _CALL if to_call > 0 else _CHECK

        to_call = max(0, self.current_bet - self.opp_bet)
        bet_size = SMALL_BET if self.draw_round == 0 else BIG_BET

        if opp_action == _FOLD:
            return True, 0.35
        if opp_action == _CHECK:
            return False, 0.0
        if opp_action == _CALL:
            paid = min(to_call, self.opp_stack)
            self.opp_stack -= paid
            self.opp_bet += paid
            self.pot += paid
            return False, 0.0
        if opp_action == _BET:
            paid = min(bet_size, self.opp_stack)
            self.current_bet = paid
            self.opp_stack -= paid
            self.opp_bet += paid
            self.pot += paid
            self.opp_opened_current_round = True
            return False, -0.04
        if opp_action == _RAISE:
            self.current_bet += bet_size
            self.raise_count += 1
            paid = min(to_call + bet_size, self.opp_stack)
            self.opp_stack -= paid
            self.opp_bet += paid
            self.pot += paid
            self.opp_opened_current_round = True
            return False, -0.05
        return False, 0.0

    # ------------------------------------------------------------------
    # Draw actions
    # ------------------------------------------------------------------

    def _apply_hero_draw(self, draw_count: int) -> float:
        new_hand, discarded = _draw_toward_badugi(self.hero_hand, draw_count, self.deck)
        self.hero_hand = new_hand
        self.hero_discarded.extend(discarded)
        self.hero_last_draw = draw_count
        self.hero_draw_history[min(2, self.draw_round)] = draw_count
        # Draw-quality shaping: reward optimal draw count
        ideal = 4 - _evaluate_badugi_features(self.hero_hand)["count"]
        return 0.08 - abs(draw_count - ideal) * 0.06

    def _apply_opp_draw(self) -> None:
        opp_obs = self._obs_for(is_hero=False)
        opp_mask = _legal_draw_mask()
        if self.opp_agent is not None:
            opp_action = self.opp_agent.act(opp_obs, epsilon=self.opp_epsilon, action_mask=opp_mask)
            if opp_mask[opp_action] <= 0:
                opp_action = 0
            draw_count = max(0, min(3, opp_action))
        else:
            # Fallback: draw toward best badugi
            keep = _best_badugi_keep(self.opp_hand)
            draw_count = len(self.opp_hand) - len(keep)
        new_hand, discarded = _draw_toward_badugi(self.opp_hand, draw_count, self.deck)
        self.opp_hand = new_hand
        self.opp_discarded.extend(discarded)
        self.opp_last_draw = draw_count
        self.opp_draw_history[min(2, self.draw_round)] = draw_count

    # ------------------------------------------------------------------
    # Showdown reward
    # ------------------------------------------------------------------

    def _showdown_reward(self) -> float:
        hero_score = evaluate_badugi(self.hero_hand)
        opp_score = evaluate_badugi(self.opp_hand)
        result = compare_badugi_scores(hero_score, opp_score)
        if result > 0:
            return 1.0 + min(2.0, self.pot / 40.0)
        if result < 0:
            return -1.0
        return 0.05
