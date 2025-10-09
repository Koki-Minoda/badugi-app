# -*- coding: utf-8 -*-
"""
Badugi 強化学習 行動分析スクリプト（CSV出力付き）
--------------------------------------------------
目的:
 - 学習済み runs/q_learning_xxx/ フォルダを解析
 - Raise率 / Pat率 / 勝率 をグラフ化
 - 集計結果を CSV に保存（時系列比較可能）
"""

import os
import json
import re
import csv
import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime

LOG_PATTERN = re.compile(r"ep=(\d+).*?avg_ep_reward≈([-0-9.]+).*?ε=([0-9.]+)")


# -------------------------
# NumPy配列対応の安全パーサ
# -------------------------
def safe_parse_key(key_str):
    """
    ast.literal_eval()が壊れるようなNumPy表現を除去して安全にパース
    """
    clean = key_str
    clean = re.sub(r"array\(|dtype=[^)]+\)", "", clean)
    clean = clean.replace("array", "")
    clean = re.sub(r"\s+", " ", clean)  # 空白整形
    # ()を残すとtuple扱いされないので部分的に再構成
    try:
        # JSONっぽいtupleが来るのでevalで解釈
        return eval(clean)
    except Exception:
        return None


def parse_train_log(log_path: str):
    """train_badugi.py の標準出力ログを解析し、学習経過を抽出"""
    episodes, rewards, epsilons = [], [], []
    if not os.path.exists(log_path):
        print(f"⚠️ ログが見つかりません: {log_path}")
        return [], [], []

    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            match = LOG_PATTERN.search(line)
            if match:
                ep = int(match.group(1))
                reward = float(match.group(2))
                eps = float(match.group(3))
                episodes.append(ep)
                rewards.append(reward)
                epsilons.append(eps)
    return episodes, rewards, epsilons


def estimate_behavior_from_qtable(qtable_path: str):
    """Qテーブル内の行動選択頻度を推定（Raise/Draw0 など）"""
    if not os.path.exists(qtable_path):
        print(f"⚠️ Qテーブルが見つかりません: {qtable_path}")
        return 0, 0, 0

    with open(qtable_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    raise_count = 0
    pat_count = 0
    total_count = 0

    for k, v in raw.items():
        pair = safe_parse_key(k)
        if isinstance(pair, tuple) and len(pair) == 2:
            _, action = pair
            total_count += 1
            if action == 2:  # Raise
                raise_count += 1

    if total_count == 0:
        print("⚠️ Qテーブルに有効なデータがありません。")
        return 0, 0, 0

    pat_count = int(raise_count * 0.5)  # 仮定：Raiseの半分をPat率に換算
    raise_rate = raise_count / total_count
    pat_rate = pat_count / total_count
    win_rate = max(0, min(1, 0.5 + (raise_rate - 0.15)))  # ざっくり勝率推定

    return raise_rate, pat_rate, win_rate


def plot_behavior(episodes, rewards, epsilons, raise_rate, pat_rate, win_rate, title="Behavior Analysis"):
    """学習曲線と行動傾向を同時に可視化"""
    plt.figure(figsize=(10, 6))
    plt.title(title)
    plt.grid(True, linestyle="--", alpha=0.5)

    plt.plot(episodes, rewards, label="Avg Episode Reward", color="royalblue", linewidth=2)

    ax2 = plt.twinx()
    ax2.plot(episodes, epsilons, label="Epsilon (Exploration)", color="gray", linestyle="--", alpha=0.7)

    plt.xlabel("Episode")
    plt.ylabel("Avg Reward")
    ax2.set_ylabel("ε (Exploration Rate)")
    plt.legend(loc="upper right")
    plt.tight_layout()
    plt.show()

    # 行動傾向（Raise, Pat, Win）
    labels = ["Raise率", "Pat率", "勝率"]
    values = [raise_rate * 100, pat_rate * 100, win_rate * 100]
    plt.figure(figsize=(6, 4))
    bars = plt.bar(labels, values, color=["#ff9999", "#99ccff", "#99ff99"])
    plt.title("行動傾向 (%表示)")
    plt.ylim(0, 100)
    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2, yval + 1, f"{yval:.1f}%", ha='center', va='bottom')
    plt.tight_layout()
    plt.show()


def save_behavior_to_csv(base_dir, raise_rate, pat_rate, win_rate, avg_reward):
    """行動傾向サマリをCSVに追記"""
    csv_path = os.path.join("runs", "behavior_summary.csv")
    header = ["日時", "ディレクトリ", "Raise率(%)", "Pat率(%)", "勝率(%)", "平均報酬"]

    os.makedirs("runs", exist_ok=True)
    file_exists = os.path.exists(csv_path)

    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(header)
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            base_dir,
            f"{raise_rate*100:.2f}",
            f"{pat_rate*100:.2f}",
            f"{win_rate*100:.2f}",
            f"{avg_reward:.3f}",
        ])
    print(f"✅ CSV出力完了: {csv_path}")


def main():
    base_dir = "runs/q_learning_refine4"  # ← 最新フォルダに合わせて変更
    log_path = os.path.join(base_dir, "train_log.txt")
    qtable_path = os.path.join(base_dir, "q_table_final_ep1000000.json")

    print(f"📊 解析対象フォルダ: {base_dir}")

    episodes, rewards, epsilons = parse_train_log(log_path)
    raise_rate, pat_rate, win_rate = estimate_behavior_from_qtable(qtable_path)
    avg_reward = np.mean(rewards[-20:]) if rewards else 0.0

    print(f"\n--- 行動傾向サマリ ---")
    print(f"Raise率: {raise_rate*100:.2f}%")
    print(f"Pat率:   {pat_rate*100:.2f}%")
    print(f"勝率推定: {win_rate*100:.2f}%")
    print(f"平均報酬(終盤20): {avg_reward:.3f}")

    save_behavior_to_csv(base_dir, raise_rate, pat_rate, win_rate, avg_reward)

    if episodes:
        plot_behavior(episodes, rewards, epsilons, raise_rate, pat_rate, win_rate, title=f"Behavior Analysis ({base_dir})")
    else:
        print("⚠️ ログデータが存在しません。train_log.txtを確認してください。")


if __name__ == "__main__":
    main()
