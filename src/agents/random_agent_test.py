# random_agent_test.py

import numpy as np
import random
from env.badugi_env import BadugiEnv


def run_episode(env, max_steps=100):
    obs, _ = env.reset()
    done = False
    total_reward = 0.0
    steps = 0

    while not done and steps < max_steps:
        # ランダムアクション選択
        action = env.action_space.sample()

        obs, reward, done, _, _ = env.step(action)
        total_reward += reward
        steps += 1

        # デバッグ表示
        env.render()
        print(f" [CHECK] obs[-1] = {obs[-1]} (should match Last draw above)")

    return total_reward

if __name__ == "__main__":
    # --- HU (2人用) 環境 ---
    env_hu = BadugiEnv(num_players=2)
    print("=== Heads-Up (2 players) ===")
    for i in range(3):
        reward = run_episode(env_hu)
        print(f"Episode {i+1} total reward: {reward:.3f}")

    # --- マルチ (6人用) 環境 ---
    env_multi = BadugiEnv(num_players=6)
    print("\n=== 6-Max (6 players) ===")
    for i in range(3):
        reward = run_episode(env_multi)
        print(f"Episode {i+1} total reward: {reward:.3f}")
