"""Utility script to run a few random-policy episodes against the Badugi env."""

from __future__ import annotations

import numpy as np

from rl.env.badugi_env import BadugiEnv
from src.utils.hand_utils import decode_hand_from_obs, hand_rank, pretty_hand


def run_episode(player_count: int = 2) -> None:
    env = BadugiEnv()
    obs, _ = env.reset()
    total_reward = 0.0
    done = False

    print(f"\n=== {player_count}-MAX Random Agent ===")

    while not done:
        phase = "DRAW" if obs[17] == 1 else "BET"
        action = env.action_space.sample()

        obs, reward, terminated, truncated, _ = env.step(action)
        done = terminated or truncated
        total_reward += reward

        hand = decode_hand_from_obs(obs)
        count, ranks = hand_rank(hand)
        print(f"Round {env.round}, Phase {phase}")
        print(f"Player: {pretty_hand(hand)} ({count}-card badugi) action={action}")
        print(
            f"obs[-1]={obs[-1]:.2f} (opp_last_draw), obs[17]={obs[17]:.0f} (0=BET,1=DRAW)\n"
        )

    print(f"Episode total reward: {total_reward:.3f}\n")


if __name__ == "__main__":
    for label, seats in (("Heads-Up", 2), ("6-Max", 6)):
        print(f"=== {label} ({seats} players) ===")
        for _ in range(3):
            run_episode(player_count=seats)

