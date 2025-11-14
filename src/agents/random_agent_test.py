import numpy as np
from src.env.badugi_env import BadugiEnv
from src.utils.hand_utils import decode_hand_from_obs, pretty_hand, hand_rank

def run_episode(player_count=2):
    """
    繝ｩ繝ｳ繝繝陦悟虚縺ｧ繧ｨ繝斐た繝ｼ繝峨ｒ1蝗槭・繝ｬ繧､縲・
    """
    env = BadugiEnv(player_count=player_count)
    obs, info = env.reset()
    total_reward = 0
    done = False

    print(f"\n=== {player_count}-MAX Random Agent ===")

    while not done:
        phase = "DRAW" if obs[17] == 1 else "BET"
        action = env.action_space.sample()  # 繝ｩ繝ｳ繝繝陦悟虚

        obs, reward, done, _, _ = env.step(action)
        total_reward += reward

        hand = decode_hand_from_obs(obs)
        count, ranks = hand_rank(hand)
        print(f"Round {env.round}, Phase {phase}")
        print(f"Player: {pretty_hand(hand)} ({count}繝舌ラ) 竊・Action={action}")
        print(f"[CHECK] obs[-1]={obs[-1]} (opp_last_draw), obs[17]={obs[17]} (0=BET,1=DRAW)\n")

    print(f"Episode total reward: {total_reward:.3f}\n")


if __name__ == "__main__":
    print("=== Heads-Up (2 players) ===")
    for i in range(3):
        run_episode(player_count=2)

    print("\n=== 6-Max (6 players) ===")
    for i in range(3):
        run_episode(player_count=6)

