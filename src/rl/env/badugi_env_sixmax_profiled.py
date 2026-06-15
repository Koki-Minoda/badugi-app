"""Profile-driven 6-max Badugi opponents shared by eval and training."""

from __future__ import annotations

import numpy as np

from rl.env.badugi_env import OpponentProfile, resolve_opponent_profile
from rl.env.badugi_draw_policy import ideal_draw_count
from rl.env.badugi_env_selfplay import _evaluate_badugi_features
from rl.env.badugi_env_sixmax_selfplay import (
    BET,
    CALL,
    CHECK,
    FOLD,
    RAISE,
    SixMaxBadugiEnv,
)


def deterministic_profile_action(
    env: SixMaxBadugiEnv,
    seat: int,
    profile: OpponentProfile,
    *,
    phase: str,
) -> int:
    mask = env._mask_for(seat)
    player = env.players[seat]
    if phase == "DRAW":
        return max(0, min(3, ideal_draw_count(player["hand"]) + int(profile.draw_bias)))

    features = _evaluate_badugi_features(player["hand"])
    strength = float(features["strength"])
    to_call = max(0, env.current_bet - player["bet"])
    can_raise = mask[RAISE] > 0
    can_bet = mask[BET] > 0
    can_call = mask[CALL] > 0
    can_check = mask[CHECK] > 0

    if to_call > 0:
        if strength < profile.fold_strength_threshold and profile.fold_probability >= 0.5:
            return FOLD
        if can_raise and (
            strength >= profile.raise_strength_threshold
            or (strength < profile.open_strength_threshold and profile.bluff_raise_probability >= 0.30)
        ):
            return RAISE
        if can_call:
            return CALL
        return FOLD

    if can_bet and (
        strength >= profile.open_strength_threshold
        or (strength < profile.open_strength_threshold and profile.bluff_frequency >= 0.12)
    ):
        return BET
    return CHECK if can_check else FOLD


class ProfiledSixMaxBadugiEnv(SixMaxBadugiEnv):
    """6-max environment using deterministic named opponent profiles."""

    def __init__(
        self,
        *,
        opponent_profile: str,
        seed: int | None = None,
        opp_epsilon: float = 0.0,
    ) -> None:
        self.eval_opponent_profile = resolve_opponent_profile(opponent_profile)
        super().__init__(seed=seed, opp_epsilon=opp_epsilon)

    def _get_opp_actions_batched(self, seats: list[int], phase: str) -> list[int]:
        actions: list[int] = []
        for seat in seats:
            if self.opp_epsilon > 0:
                mask = (
                    self._mask_for(seat)
                    if phase == "BET"
                    else np.array([1, 1, 1, 1, 0, 0], dtype=np.float32)
                )
                if np.random.random() < self.opp_epsilon:
                    legal = np.where(mask > 0)[0]
                    actions.append(int(np.random.choice(legal)))
                    continue
            actions.append(
                deterministic_profile_action(
                    self,
                    seat,
                    self.eval_opponent_profile,
                    phase=phase,
                )
            )
        return actions
