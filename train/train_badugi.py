# -*- coding: utf-8 -*-
import argparse
import json
import os
import time
from collections import defaultdict

import numpy as np
import gymnasium as gym

# ← あなたのEnvのモジュールパスに合わせて調整
from src.env.badugi_env import BadugiEnv

# DQNは任意（無ければスキップ）
try:
    from stable_baselines3 import DQN
    from stable_baselines3.common.vec_env import DummyVecEnv
    SB3_AVAILABLE = True
except Exception:
    SB3_AVAILABLE = False


# ---------------------------
# 便利関数
# ---------------------------
def state_key(obs: np.ndarray, decimals: int = 2):
    """連続状態をタブラーQ用に離散化してハッシュキー化（小数2桁で丸め）"""
    return tuple(np.round(obs, decimals=decimals))


def save_q_table(q_dict, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # dictのkeyがtupleなので文字列化して保存
    with open(path, "w") as f:
        json.dump({str(k): v for k, v in q_dict.items()}, f)


def evaluate_q(env, Q, episodes=1000):
    """タブラーQを固定方策で評価（ε=0）"""
    total_reward = 0.0
    for _ in range(episodes):
        obs, _ = env.reset()
        terminated = False
        truncated = False
        ep_r = 0.0
        while not (terminated or truncated):
            key = state_key(obs)
            # 最良行動
            a_values = [Q[(key, a)] for a in range(env.action_space.n)]
            action = int(np.argmax(a_values))
            obs, r, terminated, truncated, _ = env.step(action)
            ep_r += r
        total_reward += ep_r
    return total_reward / episodes


# ---------------------------
# タブラーQ-Learning
# ---------------------------
def train_q_learning(
    episodes=100_000,
    alpha=0.1,          # 学習率
    gamma=0.9,          # 割引率
    eps_start=0.7,      # ε-greedy 初期
    eps_min=0.04,
    eps_decay=0.9999,   # 毎ステップ減衰（大きいほどゆっくり）
    save_every=10_000,
    outdir="runs/q_learning2",
    decimals=2,
    resume_from=None,   # ← ★追加（再学習元Qテーブル）
):
    os.makedirs(outdir, exist_ok=True)
    env = BadugiEnv()
    Q = defaultdict(float)

    # --- ★再学習ロード部分 ---
    if resume_from and os.path.exists(resume_from):
        print(f"🔁 Resuming Q-learning from: {resume_from}")
        import ast
        with open(resume_from, "r", encoding="utf-8") as f:
            raw = json.load(f)
        for k, v in raw.items():
            try:
                Q[ast.literal_eval(k)] = v
            except Exception:
                continue
        print(f"✅ Loaded {len(Q)} Q-values from previous session.")
    # ----------------------------


    epsilon = eps_start
    t0 = time.time()
    steps = 0

    for ep in range(1, episodes + 1):
        obs, _ = env.reset()
        terminated = False
        truncated = False
        ep_r = 0.0

        while not (terminated or truncated):
            steps += 1
            key = state_key(obs, decimals=decimals)

            # ε-greedy
            if np.random.rand() < epsilon:
                action = env.action_space.sample()
            else:
                a_values = [Q[(key, a)] for a in range(env.action_space.n)]
                action = int(np.argmax(a_values))

            next_obs, reward, terminated, truncated, _info = env.step(action)
            next_key = state_key(next_obs, decimals=decimals)

            # Q更新
            best_next = max(Q[(next_key, a)] for a in range(env.action_space.n))
            Q[(key, action)] += alpha * (reward + gamma * best_next - Q[(key, action)])

            obs = next_obs
            ep_r += reward

            # ε減衰（ステップ単位）
            if epsilon > eps_min:
                epsilon = max(eps_min, epsilon * eps_decay)

        # チェックポイント保存
        if ep % save_every == 0:
            ckpt_path = os.path.join(outdir, f"q_table_ep{ep:07d}.json")
            save_q_table(Q, ckpt_path)
            elapsed = (time.time() - t0) / 60
            print(f"[OK] ep={ep:,}  eps={epsilon:.4f}  avg_ep_reward≈{ep_r:.3f}  elapsed={elapsed:.1f} min")


    # 最終保存
    final_path = os.path.join(outdir, f"q_table_final_ep{episodes}.json")
    save_q_table(Q, final_path)

    # 簡易評価
    avg_r = evaluate_q(BadugiEnv(), Q, episodes=1000)
    print(f"🎯 Q-learning evaluation avg reward over 1000 eps: {avg_r:.3f}")
    print(f"💾 saved: {final_path}")
 
    # 学習完了後に不要ファイル削除
    from src.utils.cleanup import cleanup_intermediate_qtables
    cleanup_intermediate_qtables("runs/q_learning_refine5", keep_pattern="final", remove_logs=False)
    
    return final_path

# ---------------------------
# DQN（任意: SB3）
# ---------------------------
def train_dqn(
    timesteps=200_000,
    outdir="runs/dqn",
    policy="MlpPolicy",
    learning_rate=2.5e-4,
    buffer_size=50_000,
    batch_size=64,
    gamma=0.99,
    exploration_fraction=0.4,
    exploration_final_eps=0.02,
    target_update_interval=10_000,
):
    if not SB3_AVAILABLE:
        raise RuntimeError("stable-baselines3 が見つかりません。`pip install stable-baselines3` を実行してください。")

    os.makedirs(outdir, exist_ok=True)

    def make_env():
        return BadugiEnv()

    env = DummyVecEnv([make_env])

    model = DQN(
        policy,
        env,
        learning_rate=learning_rate,
        buffer_size=buffer_size,
        batch_size=batch_size,
        gamma=gamma,
        exploration_fraction=exploration_fraction,
        exploration_final_eps=exploration_final_eps,
        target_update_interval=target_update_interval,
        verbose=1,
        tensorboard_log=os.path.join(outdir, "tb"),
    )

    model.learn(total_timesteps=timesteps, log_interval=10)
    save_path = os.path.join(outdir, f"dqn_badugi_{timesteps}.zip")
    model.save(save_path)
    print(f"💾 saved DQN model: {save_path}")

    # 簡易評価
    eval_env = BadugiEnv()
    episodes = 100
    total = 0.0
    for _ in range(episodes):
        obs, _ = eval_env.reset()
        terminated = truncated = False
        ep_r = 0.0
        while not (terminated or truncated):
            action, _ = model.predict(obs, deterministic=True)
            obs, r, terminated, truncated, _ = eval_env.step(int(action))
            ep_r += r
        total += ep_r
    print(f"🎯 DQN evaluation avg reward over {episodes} eps: {total / episodes:.3f}")
    return save_path


# ---------------------------
# CLI
# ---------------------------
def main():
    parser = argparse.ArgumentParser(description="Badugi Trainer (Q-learning / DQN)")
    sub = parser.add_subparsers(dest="algo", required=True)

    # Q-learning
    q = sub.add_parser("q", help="Tabular Q-learning")
    q.add_argument("--episodes", type=int, default=100000)
    q.add_argument("--alpha", type=float, default=0.1)
    q.add_argument("--gamma", type=float, default=0.9)
    q.add_argument("--eps_start", type=float, default=0.2)
    q.add_argument("--eps_min", type=float, default=0.03)
    q.add_argument("--eps_decay", type=float, default=0.9997)
    q.add_argument("--save_every", type=int, default=10000)
    q.add_argument("--outdir", type=str, default="runs/q_learning")
    q.add_argument("--decimals", type=int, default=2)
    q.add_argument("--resume_from", type=str, default=None)

    # DQN
    d = sub.add_parser("dqn", help="DQN (stable-baselines3)")
    d.add_argument("--timesteps", type=int, default=200000)
    d.add_argument("--outdir", type=str, default="runs/dqn")
    d.add_argument("--policy", type=str, default="MlpPolicy")

    args = parser.parse_args()

    if args.algo == "q":
        train_q_learning(
            episodes=args.episodes,
            alpha=args.alpha,
            gamma=args.gamma,
            eps_start=args.eps_start,
            eps_min=args.eps_min,
            eps_decay=args.eps_decay,
            save_every=args.save_every,
            outdir=args.outdir,
            decimals=args.decimals,
        )
    elif args.algo == "dqn":
        train_dqn(
            timesteps=args.timesteps,
            outdir=args.outdir,
            policy=args.policy,
        )
    else:
        raise ValueError("Unknown algo")


if __name__ == "__main__":
    main()

