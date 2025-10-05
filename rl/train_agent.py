# rl/train_agent.py
"""
Badugi 強化学習（Q学習による自己対戦）
"""
import numpy as np
import random
from badugi_env_train import BadugiEnv  # ← 修正済みインポート

# ハイパーパラメータ
EPISODES = 20000
ALPHA = 0.1        # 学習率
GAMMA = 0.9        # 割引率
EPSILON = 0.2      # ε-greedy
STATE_BINS = 10    # 状態離散化の粒度

# Qテーブル初期化
Q = {}

def discretize(state):
    """状態を離散化してQテーブルのキーにする"""
    return tuple((state * STATE_BINS).astype(int))

def get_action(state):
    """ε-greedy方策でアクションを選択"""
    if random.random() < EPSILON:
        return random.randint(0, len(BadugiEnv.ACTIONS) - 1)
    key = discretize(state)
    return np.argmax(Q.get(key, np.zeros(len(BadugiEnv.ACTIONS))))

def train():
    env = BadugiEnv()
    for ep in range(EPISODES):
        state = env.reset()
        total_reward = 0

        for t in range(50):
            action = get_action(state)
            next_state, reward, done = env.step(action)

            s_key = discretize(state)
            n_key = discretize(next_state)
            if s_key not in Q:
                Q[s_key] = np.zeros(len(BadugiEnv.ACTIONS))
            if n_key not in Q:
                Q[n_key] = np.zeros(len(BadugiEnv.ACTIONS))

            # Q学習の更新式
            Q[s_key][action] = Q[s_key][action] + ALPHA * (
                reward + GAMMA * np.max(Q[n_key]) - Q[s_key][action]
            )

            state = next_state
            total_reward += reward
            if done:
                break

        if (ep + 1) % 1000 == 0:
            print(f"Episode {ep+1}/{EPISODES} | total_reward={total_reward}")

    print("✅ 学習完了！ Qテーブルのサイズ:", len(Q))

if __name__ == "__main__":
    train()
