# -*- coding: utf-8 -*-
"""
Badugi 強化学習ログ可視化スクリプト
 - train_badugi.py の出力をもとに平均報酬と ε（探索率）を時系列表示
 - 実行後、runs/q_learning_long/plot_training.png にグラフを保存
"""

import os
import re
import matplotlib.pyplot as plt
import json

def parse_train_log(log_path="runs/q_learning_long/train.log"):
    """
    train_badugi.py のコンソール出力を保存した train.log を解析
    （PowerShell出力をリダイレクトしておくと最も精密）
    """
    episodes = []
    rewards = []
    epsilons = []

    if not os.path.exists(log_path):
        print("⚠️ train.log が見つかりません。代わりにQテーブルから統計を試みます。")
        return None

    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            match = re.search(r"ep=(\d+).+?ε=([0-9.]+).+?avg_ep_reward≈([-+]?\d+\.\d+)", line)
            if match:
                episodes.append(int(match.group(1)))
                epsilons.append(float(match.group(2)))
                rewards.append(float(match.group(3)))

    return {"episodes": episodes, "rewards": rewards, "epsilons": epsilons}


def fallback_from_qtables(log_dir="runs/q_learning_long"):
    """
    train.log がない場合、Qテーブルから平均値をサンプリング
    """
    episodes = []
    rewards = []

    for f in sorted(os.listdir(log_dir)):
        if not f.endswith(".json"):
            continue
        match = re.search(r"ep(\d+)\.json", f)
        if not match:
            continue
        ep = int(match.group(1))
        path = os.path.join(log_dir, f)
        with open(path, "r") as jf:
            data = json.load(jf)
        avg_q = sum(data.values()) / len(data)
        episodes.append(ep)
        rewards.append(avg_q)
    return {"episodes": episodes, "rewards": rewards, "epsilons": None}


def plot_training_progress(log_path="runs/q_learning_long/train.log", out_path="runs/q_learning_long/plot_training.png"):
    data = parse_train_log(log_path)
    if data is None or not data["episodes"]:
        data = fallback_from_qtables(os.path.dirname(log_path))
        if not data["episodes"]:
            print("❌ 学習データが見つかりません。train.log または JSON チェックポイントを確認してください。")
            return

    episodes = data["episodes"]
    rewards = data["rewards"]
    epsilons = data["epsilons"]

    fig, ax1 = plt.subplots(figsize=(10, 6))

    # 平均報酬（左軸）
    ax1.plot(episodes, rewards, color="tab:blue", label="Average Reward", linewidth=2)
    ax1.set_xlabel("Episodes")
    ax1.set_ylabel("Average Reward", color="tab:blue")
    ax1.tick_params(axis="y", labelcolor="tab:blue")

    # 探索率（右軸）
    if epsilons:
        ax2 = ax1.twinx()
        ax2.plot(episodes, epsilons, color="tab:orange", linestyle="--", label="Epsilon (Exploration Rate)", linewidth=1.5)
        ax2.set_ylabel("Epsilon (Exploration Rate)", color="tab:orange")
        ax2.tick_params(axis="y", labelcolor="tab:orange")

    # グリッド・凡例
    fig.suptitle("Badugi Q-learning Training Progress", fontsize=14)
    ax1.grid(True, linestyle=":")
    fig.tight_layout()
    plt.savefig(out_path)
    plt.close(fig)
    print(f"✅ 可視化完了: {out_path}")


if __name__ == "__main__":
    plot_training_progress()
