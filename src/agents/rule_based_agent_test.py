import gymnasium as gym
import numpy as np

from src.env.badugi_env import BadugiEnv
from src.utils.hand_utils import decode_hand_from_obs

from utils import log_episode_result, log_step_info


def rule_based_policy(obs):
    """
    シンプルなルールベースの方策
    obs: 環境からの観測ベクトル
    return: 行動 (0=Fold,1=Call,2=Raise,3+=Draw)
    """
    # 手札をデコード
    hand = decode_hand_from_obs(obs)
    count = len(hand)
    ranks = [r for r, _ in hand]

    # --- 簡易ルール ---
    if count == 4:  # バドゥーギ完成
        return 2  # Raise
    elif count == 3:
        if max(ranks) <= 7:
            return 2  # 強い → Raise
        else:
            return 1  # 中弱 → Call
    elif count == 2:
        if max(ranks) <= 6:
            return 2  # A〜6の2枚 → Raise
        else:
            return 1  # 弱い → Call
    elif count == 1:
        if min(ranks) <= 3:
            return 2  # A〜4の1バドは時々Raise
        else:
            return 0  # フォールド
    else:
        return 0  # 想定外はフォールド


def run_rule_based_test(num_episodes=3, num_players=2):
    env = BadugiEnv()
    env.num_players = num_players

    for ep in range(1, num_episodes + 1):
        obs, _ = env.reset()
        done = False
        total_reward = 0

        while not done:
            action = rule_based_policy(obs)

            # デコードして見やすく表示
            hand = decode_hand_from_obs(obs)
            log_step_info(env.round, env.phase, pretty_hand(hand), action, obs)

            obs, reward, done, _, _ = env.step(action)
            total_reward += reward

        log_episode_result(ep, total_reward)


if __name__ == "__main__":
    print("=== Heads-Up (2 players) / Rule-based agent ===")
    run_rule_based_test(num_episodes=3, num_players=2)

    print("\n=== 6-Max (6 players) / Rule-based agent ===")
    run_rule_based_test(num_episodes=3, num_players=6)
