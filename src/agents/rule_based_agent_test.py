"""Simple rule-based sanity check for the Badugi environment."""

from __future__ import annotations

import numpy as np

from rl.env.badugi_env import BadugiEnv
from src.utils.hand_utils import (
    decode_hand_from_obs,
    evaluate_hand_strength,
    hand_rank,
    pretty_hand,
)


def rule_based_action(obs: np.ndarray, phase: str) -> int:
    hand = decode_hand_from_obs(obs)
    count, ranks = hand_rank(hand)
    strength = evaluate_hand_strength(hand)

    label = (
        "strong"
        if count == 4
        else "medium"
        if count == 3
        else "weak"
    )
    print(f"Player: {pretty_hand(hand)} [{count}-card, {label}] -> ", end="")

    if phase == "BET":
        if count == 4:
            print("Raise (2)")
            return 2
        if count == 3:
            action = 1 if max(ranks) > 8 else 2
            print("Call" if action == 1 else "Raise (2)")
            return action
        if count == 2:
            action = 1 if max(ranks) <= 7 else 0
            print("Call" if action == 1 else "Fold")
            return action
        print("Fold")
        return 0

    if phase == "DRAW":
        if count >= 3 and min(ranks) <= 4:
            print("Pat (0)")
            return 0
        draw_count = max(0, 4 - count)
        print(f"Draw {draw_count}")
        return draw_count

    return 1


def run_episode():
    env = BadugiEnv()
    obs, _ = env.reset()
    done = False
    total_reward = 0.0

    while not done:
        phase = "DRAW" if obs[17] == 1 else "BET"
        action = rule_based_action(obs, phase)
        obs, reward, terminated, truncated, _ = env.step(action)
        done = terminated or truncated
        total_reward += reward
        print(
            f" --> reward={reward:.3f}, pot={env.pot}, stacks=({env.player_stack},{env.opponent_stack})\n"
        )

    print(f"Episode reward: {total_reward:.3f}")


if __name__ == "__main__":
    run_episode()

