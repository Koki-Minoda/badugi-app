"""Self-play dual-agent draw lowball environment.

Both seats (hero and opp) use DQNAgent policies. The opponent responds
automatically inside step(), so the training loop only provides hero's action.
Observations are built from the acting seat's perspective so both agents see
a consistent, symmetric view of the game state.

Existing DrawLowballEnv is unchanged — this module adds self-play capability
without modifying the single-agent training path.
"""

from __future__ import annotations

import random
from typing import TYPE_CHECKING

import numpy as np
from gymnasium import spaces

from rl.env.draw_lowball_env import (
    DRAW_OBSERVATION_VECTOR_SIZE,
    DrawFamily,
    LowballFeatures,
    build_deck,
    compare_lowball,
    discard_indexes_for_family,
    evaluate_lowball,
    _draw_adjusted_strength,
)

if TYPE_CHECKING:
    from rl.agents.dqn_agent import DQNAgent


class DualAgentDrawLowballEnv:
    """Fixed-limit heads-up draw lowball environment for self-play training.

    Both hero and opp are DQNAgent instances set via set_agents(). The
    observation vector is built from the perspective of the acting seat so
    both agents receive symmetric, information-correct observations.

    Usage::

        env = DualAgentDrawLowballEnv(family="low-27")
        env.set_agents(hero_agent, opp_agent)
        obs, _ = env.reset()
        while True:
            action = hero_agent.act(obs, epsilon, env.legal_action_mask())
            obs, reward, done, _, info = env.step(action)
            if done:
                break
    """

    metadata = {"render.modes": ["human"]}

    def __init__(
        self,
        family: DrawFamily = "low-27",
        max_draws: int = 3,
        seed: int | None = None,
        opp_epsilon: float = 0.0,
    ) -> None:
        """
        Args:
            opp_epsilon: Exploration rate applied to the frozen opponent agent.
                0.0 (default) = fully greedy → pure GTO self-play.
                0.05–0.15 = adds stochastic diversity to opponent actions,
                making the hero more robust to loose/aggressive play patterns
                without explicitly encoding personality types. Does not move
                toward Nash equilibrium as cleanly as the default.
        """
        if family not in {"low-27", "low-a5"}:
            raise ValueError(f"Unsupported draw family: {family!r}")
        self.family = family
        self.max_draws = max(1, min(3, int(max_draws)))
        self.random = random.Random(seed)
        self.opp_epsilon = float(opp_epsilon)

        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(DRAW_OBSERVATION_VECTOR_SIZE,),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(11)
        self.starting_stack = 100
        self.small_bet = 2

        self.hero_agent: DQNAgent | None = None
        self.opp_agent: DQNAgent | None = None

        # Initialise game state attributes so they always exist.
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
        """Hero's legal action mask (matches DrawLowballEnv interface)."""
        return self._mask_for(self.hero_bet, self.hero_stack)

    def step(self, hero_action: int):
        """Advance the game with hero's action; opp responds automatically."""
        if self.legal_action_mask()[hero_action] <= 0:
            return self._obs_for(is_hero=True), -2.0, True, False, {"illegal": True}

        reward = 0.0

        if self.phase == "BET":
            reward += self._apply_hero_bet(hero_action)
            if hero_action == 0:  # hero folded
                return self._obs_for(is_hero=True), reward, True, False, {"folded": True}

            opp_terminal, opp_reward = self._opp_bet_response()
            reward += opp_reward
            if opp_terminal:
                return self._obs_for(is_hero=True), reward, True, False, {"opponentFolded": True}

            if self.draw_round >= self.max_draws:
                reward += self._showdown_reward()
                self.phase = "SHOWDOWN"
                return self._obs_for(is_hero=True), reward, True, False, {"showdown": True}

            self.phase = "DRAW"

        elif self.phase == "DRAW":
            draw_count = hero_action - 5
            self._draw_hero(draw_count)
            self._draw_opp_via_agent()

            self.draw_round += 1
            round_idx = min(2, max(0, self.draw_round - 1))
            self.hero_bet_history[round_idx] = self.hero_opened_current_round
            self.opp_bet_history[round_idx] = self.opp_opened_current_round
            self.hero_opened_current_round = False
            self.opp_opened_current_round = False

            self.phase = "BET"
            self.raise_count = 0
            self.current_bet = 0
            self.hero_bet = 0
            self.opp_bet = 0
            reward += self._draw_quality_reward(draw_count)

        return self._obs_for(is_hero=True), reward, False, False, {}

    # ------------------------------------------------------------------
    # Internal state initialisation
    # ------------------------------------------------------------------

    def _init_state(self) -> None:
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
        self.hero_is_button = self.random.random() < 0.5

        self.hero_last_draw_count = 0
        self.opp_last_draw_count = 0
        self.hero_draw_history: list[int] = [0, 0, 0]
        self.opp_draw_history: list[int] = [0, 0, 0]
        self.hero_total_draws = 0
        self.opp_total_draws = 0
        self.hero_opened_current_round = False
        self.opp_opened_current_round = False
        self.hero_bet_history: list[bool] = [False, False, False]
        self.opp_bet_history: list[bool] = [False, False, False]
        # v2 additions
        self.hero_raised_predraw: bool = False
        self.opp_raised_predraw: bool = False
        self.hero_discarded_cards: list = []
        self.opp_discarded_cards: list = []

    # ------------------------------------------------------------------
    # Observation building
    # ------------------------------------------------------------------

    def _obs_for(self, is_hero: bool) -> np.ndarray:
        """Build observation from the perspective of hero (is_hero=True) or opp.

        Centralised so that adding a new feature only requires one edit here —
        both seats automatically receive the correctly-swapped view.
        """
        if is_hero:
            my_hand         = self.hero_hand
            my_bet          = self.hero_bet
            my_stack        = self.hero_stack
            my_is_button    = self.hero_is_button
            my_draw_hist    = self.hero_draw_history
            my_last_draw    = self.hero_last_draw_count
            my_raised_pre   = self.hero_raised_predraw
            my_bet_hist     = self.hero_bet_history
            my_discarded    = self.hero_discarded_cards
            opp_last_draw   = self.opp_last_draw_count
            opp_draw_hist   = self.opp_draw_history
            opp_total       = self.opp_total_draws
            opp_opened      = self.opp_opened_current_round
            opp_bet_hist    = self.opp_bet_history
            opp_stack       = self.opp_stack
        else:
            my_hand         = self.opp_hand
            my_bet          = self.opp_bet
            my_stack        = self.opp_stack
            my_is_button    = not self.hero_is_button
            my_draw_hist    = self.opp_draw_history
            my_last_draw    = self.opp_last_draw_count
            my_raised_pre   = self.opp_raised_predraw
            my_bet_hist     = self.opp_bet_history
            my_discarded    = self.opp_discarded_cards
            opp_last_draw   = self.hero_last_draw_count
            opp_draw_hist   = self.hero_draw_history
            opp_total       = self.hero_total_draws
            opp_opened      = self.hero_opened_current_round
            opp_bet_hist    = self.hero_bet_history
            opp_stack       = self.hero_stack
        return self._observation_for(
            my_hand=my_hand,
            my_bet=my_bet,
            my_stack=my_stack,
            my_is_button=my_is_button,
            my_draw_hist=my_draw_hist,
            my_last_draw=my_last_draw,
            my_raised_pre=my_raised_pre,
            my_bet_hist=my_bet_hist,
            my_discarded=my_discarded,
            opp_last_draw=opp_last_draw,
            opp_draw_hist=opp_draw_hist,
            opp_total_draws=opp_total,
            opp_opened=opp_opened,
            opp_bet_hist=opp_bet_hist,
            opp_stack=opp_stack,
            mask=self._mask_for(my_bet, my_stack),
        )

    def _observation_for(
        self,
        *,
        my_hand,
        my_bet: int,
        my_stack: int,
        my_is_button: bool,
        my_draw_hist: list[int],
        my_last_draw: int,
        my_raised_pre: bool,
        my_bet_hist: list[bool],
        my_discarded: list,
        opp_last_draw: int,
        opp_draw_hist: list[int],
        opp_total_draws: int,
        opp_opened: bool,
        opp_bet_hist: list[bool],
        opp_stack: int,
        mask: np.ndarray,
    ) -> np.ndarray:
        vector = np.zeros(DRAW_OBSERVATION_VECTOR_SIZE, dtype=np.float32)
        features = evaluate_lowball(my_hand, self.family)
        to_call = max(0, self.current_bet - my_bet)
        pot_odds = to_call / max(1, self.pot + to_call) if to_call > 0 else 0.0

        # ---- v1 既存フィーチャー ----
        vector[0] = self.draw_round / max(1, self.max_draws)
        vector[1] = 1.0 if self.phase == "BET" else 0.0
        vector[2] = 1.0 if self.phase == "DRAW" else 0.0
        vector[3] = pot_odds
        vector[4] = min(self.pot, 100) / 100.0
        vector[5] = 1.0 if my_is_button else 0.0
        vector[6] = 1.0 if (self.phase == "BET" and self.draw_round >= self.max_draws) else 0.0
        vector[7] = opp_last_draw / 5.0
        vector[8] = 0.05   # neutral profile
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
        vector[24] = opp_total_draws / 15.0
        vector[25] = self.current_bet / 20.0
        vector[26] = self.raise_count / 4.0
        vector[27] = 1.0 if (opp_last_draw == 0 and self.draw_round > 0) else 0.0
        vector[28] = 1.0 if opp_opened else 0.0
        vector[29] = 1.0 if opp_bet_hist[0] else 0.0
        vector[30] = 1.0 if opp_bet_hist[1] else 0.0
        vector[41] = 1.0 if self.family == "low-27" else 0.0
        vector[42] = 1.0 if self.family == "low-a5" else 0.0

        # ---- v2 共通計算 ----
        _discards = discard_indexes_for_family(my_hand, self.family)
        _kept = [c for i, c in enumerate(my_hand) if i not in _discards]
        _discount = max(0.40, 1.0 - len(_discards) * 0.12)
        if _kept:
            _kf = evaluate_lowball(_kept, self.family)
            _draw_target_str = _kf.strength * _discount
            _draw_target_rank = _kf.highest_rank / 14.0
        else:
            _draw_target_str = 0.0
            _draw_target_rank = 1.0

        _is_a5 = self.family == "low-a5"
        _premium_ranks = {14, 2, 3, 4, 5} if _is_a5 else {2, 3, 4, 5}
        _blocker_rank = 14 if _is_a5 else 2

        # slot 31: v2修正版
        vector[31] = _draw_target_str
        vector[32] = len(_discards) / 5.0

        # グループA
        vector[33] = 2.0 / 6.0
        vector[34] = 1.0 if my_is_button else 0.0
        vector[35] = 0.0
        # グループC
        vector[36] = _draw_target_str
        vector[37] = _draw_target_rank
        vector[38] = sum(1 for r, _ in my_hand if r in _premium_ranks) / 5.0
        vector[39] = sum(1 for r, _ in my_hand if r == _blocker_rank) / 4.0
        # グループA続き
        _opp_pos = 0.0 if my_is_button else 1.0
        vector[43] = _opp_pos if opp_bet_hist[0] else 0.0
        vector[44] = 0.0
        vector[45] = 1.0 if opp_opened else 0.0
        # グループB
        _big_bet = self.small_bet * 2
        _rem = max(1, self.max_draws - self.draw_round + (1 if self.phase == "BET" else 0))
        vector[46] = my_stack / max(1, _big_bet * 4 * _rem)
        vector[47] = 1.0 if self.draw_round >= 2 else 0.0
        # グループD
        vector[59] = 1.0 if my_raised_pre else 0.0
        vector[60] = 1.0 if my_bet_hist[0] else 0.0
        vector[61] = 1.0 if my_bet_hist[1] else 0.0
        vector[62] = 1.0 if (not my_bet_hist[0] and not opp_bet_hist[0] and self.draw_round >= 1) else 0.0
        vector[63] = 1.0 if (not my_bet_hist[1] and not opp_bet_hist[1] and self.draw_round >= 2) else 0.0
        # グループE
        vector[64] = 0.0 if my_is_button else 1.0
        vector[65] = my_draw_hist[0] / 5.0
        vector[66] = my_draw_hist[1] / 5.0
        vector[67] = (opp_draw_hist[0] - opp_draw_hist[1]) / 5.0
        vector[68] = (opp_draw_hist[1] - opp_draw_hist[2]) / 5.0
        vector[69] = (opp_last_draw - my_last_draw) / 5.0
        # グループF
        vector[70] = sum(1 for r, _ in my_discarded if r == _blocker_rank) / 4.0
        _dead_denom = 20.0 if _is_a5 else 16.0
        vector[71] = min(1.0, sum(1 for r, _ in my_discarded if r in _premium_ranks) / _dead_denom)
        vector[72] = 1.0 - opp_last_draw / 5.0
        vector[73] = sum(1 for h in opp_draw_hist[:self.draw_round] if h == 0) / max(1, self.max_draws)
        # グループG
        vector[74] = opp_stack / max(1, self.starting_stack)
        vector[75] = my_stack / max(1, self.starting_stack)
        vector[76] = min(2.0, opp_stack / max(1, my_stack)) / 2.0
        # グループH
        vector[77] = my_stack / max(1, my_stack + opp_stack)
        vector[78] = 0.0
        vector[79] = 0.0
        # SD/TD 区別
        vector[80] = self.max_draws / 3.0

        vector[48 : 48 + len(mask)] = mask
        return vector

    # ------------------------------------------------------------------
    # Legal action masks
    # ------------------------------------------------------------------

    def _mask_for(self, my_bet: int, my_stack: int) -> np.ndarray:
        mask = np.zeros(11, dtype=np.float32)
        if self.phase == "BET":
            to_call = max(0, self.current_bet - my_bet)
            if to_call > 0:
                mask[0] = 1.0  # fold
                mask[2] = 1.0  # call
                if self.raise_count < 4 and my_stack > to_call + self.small_bet:
                    mask[4] = 1.0  # raise
            else:
                mask[1] = 1.0  # check
                if my_stack >= self.small_bet:
                    mask[3] = 1.0  # bet
        else:
            mask[5:11] = 1.0  # draw_0 .. draw_5
        return mask

    # ------------------------------------------------------------------
    # Hero bet application
    # ------------------------------------------------------------------

    def _apply_hero_bet(self, action: int) -> float:
        feat = evaluate_lowball(self.hero_hand, self.family)
        eff = _draw_adjusted_strength(self.hero_hand, self.family, feat)
        to_call = max(0, self.current_bet - self.hero_bet)
        pot_odds = to_call / max(1, self.pot + to_call) if to_call > 0 else 0.0

        if action == 0:  # fold
            if eff < pot_odds:
                return +0.15
            return -max(0.30, min(0.90, 0.20 + (eff - pot_odds) * 1.5))
        if action == 2:  # call
            paid = min(to_call, self.hero_stack)
            self.hero_stack -= paid
            self.hero_bet += paid
            self.pot += paid
            return 0.05 + 0.10 * max(0.0, eff - pot_odds)
        opp_draw_bonus = 0.05 if self.opp_last_draw_count >= 3 else 0.0
        if action == 3:  # bet
            self.current_bet = self.small_bet
            paid = min(self.small_bet, self.hero_stack)
            self.hero_stack -= paid
            self.hero_bet += paid
            self.pot += paid
            self.hero_opened_current_round = True
            return (0.15 if eff >= 0.58 else -0.12) + opp_draw_bonus
        if action == 4:  # raise
            to_call = max(0, self.current_bet - self.hero_bet)
            self.current_bet += self.small_bet
            self.raise_count += 1
            paid = min(to_call + self.small_bet, self.hero_stack)
            self.hero_stack -= paid
            self.hero_bet += paid
            self.pot += paid
            self.hero_opened_current_round = True
            if self.draw_round == 0:
                self.hero_raised_predraw = True
            return (0.20 if eff >= 0.70 else -0.25) + opp_draw_bonus
        return 0.0  # check

    # ------------------------------------------------------------------
    # Opponent bet response (via opp_agent)
    # ------------------------------------------------------------------

    def _opp_bet_response(self) -> tuple[bool, float]:
        opp_obs = self._obs_for(is_hero=False)
        opp_mask = self._mask_for(self.opp_bet, self.opp_stack)
        if self.opp_agent is not None:
            opp_action = self.opp_agent.act(opp_obs, epsilon=self.opp_epsilon, action_mask=opp_mask)
            if opp_mask[opp_action] <= 0:
                opp_action = int(np.argmax(opp_mask)) if opp_mask.sum() > 0 else 1
        else:
            # Fallback when no agent set: always check/call.
            to_call = max(0, self.current_bet - self.opp_bet)
            opp_action = 2 if to_call > 0 else 1

        to_call = max(0, self.current_bet - self.opp_bet)

        if opp_action == 0:  # fold
            return True, 0.35
        if opp_action == 1:  # check
            return False, 0.0
        if opp_action == 2:  # call
            paid = min(to_call, self.opp_stack)
            self.opp_stack -= paid
            self.opp_bet += paid
            self.pot += paid
            return False, 0.0
        if opp_action == 3:  # bet
            self.current_bet = self.small_bet
            paid = min(self.small_bet, self.opp_stack)
            self.opp_stack -= paid
            self.opp_bet += paid
            self.pot += paid
            self.opp_opened_current_round = True
            return False, -0.04
        if opp_action == 4:  # raise
            self.current_bet += self.small_bet
            self.raise_count += 1
            paid = min(to_call + self.small_bet, self.opp_stack)
            self.opp_stack -= paid
            self.opp_bet += paid
            self.pot += paid
            self.opp_opened_current_round = True
            return False, -0.05
        return False, 0.0

    # ------------------------------------------------------------------
    # Draw actions
    # ------------------------------------------------------------------

    def _draw_hero(self, draw_count: int) -> None:
        discards = discard_indexes_for_family(self.hero_hand, self.family, target_count=draw_count)
        discarded_cards = [self.hero_hand[i] for i in discards]
        keep = [c for i, c in enumerate(self.hero_hand) if i not in discards]
        while len(keep) < 5 and self.deck:
            keep.append(self.deck.pop())
        self.hero_hand = keep
        self.hero_last_draw_count = draw_count
        self.hero_draw_history[min(2, self.draw_round)] = draw_count
        self.hero_total_draws += draw_count
        self.hero_discarded_cards.extend(discarded_cards)

    def _draw_opp_via_agent(self) -> None:
        opp_obs = self._obs_for(is_hero=False)
        opp_mask = self._mask_for(self.opp_bet, self.opp_stack)
        if self.opp_agent is not None:
            opp_action = self.opp_agent.act(opp_obs, epsilon=self.opp_epsilon, action_mask=opp_mask)
            if opp_mask[opp_action] <= 0:
                opp_action = 5
        else:
            opp_action = 5 + len(discard_indexes_for_family(self.opp_hand, self.family))
        draw_count = max(0, min(5, opp_action - 5))
        discards = discard_indexes_for_family(self.opp_hand, self.family, target_count=draw_count)
        discarded_cards = [self.opp_hand[i] for i in discards]
        keep = [c for i, c in enumerate(self.opp_hand) if i not in discards]
        while len(keep) < 5 and self.deck:
            keep.append(self.deck.pop())
        self.opp_hand = keep
        self.opp_last_draw_count = draw_count
        self.opp_draw_history[min(2, self.draw_round)] = draw_count
        self.opp_total_draws += draw_count
        self.opp_discarded_cards.extend(discarded_cards)

    # ------------------------------------------------------------------
    # Reward helpers
    # ------------------------------------------------------------------

    def _draw_quality_reward(self, draw_count: int) -> float:
        ideal = len(discard_indexes_for_family(self.hero_hand, self.family))
        return 0.12 - abs(draw_count - ideal) * 0.08

    def _showdown_reward(self) -> float:
        result = compare_lowball(self.hero_hand, self.opp_hand, self.family)
        if result > 0:
            return 1.0 + min(2.0, self.pot / 40.0)
        if result < 0:
            return -1.0
        return 0.05
