# -*- coding: utf-8 -*-
"""
Q-learning 学習進捗可視化ツール（Refine対応版）
対象: runs/q_learning_refine1, runs/q_learning_refine2 など
"""

import os
import json
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

# === 設定 ===
TARGET_DIRS = [
    "runs/q_learning_refine4"
]

# === 関数 ===
def analyze_q_table(path):
    """Qテーブルの統計情報を抽出"""
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    q_vals = np.array(list(raw.values()), dtype=np.float32)
    return {
        "file": os.path.basename(path),
        "n": len(q_vals),
        "mean": float(np.mean(q_vals)),
        "std": float(np.std(q_vals)),
        "pos_ratio": float(np.mean(q_vals > 0))
    }


def plot_convergence(data, title):
    """平均Q値・標準偏差・正Q率を描画"""
    if not data:
        print(f"[WARN] No data for {title}")
        return

    steps = [int(d["file"].split("ep")[1].split(".")[0]) for d in data]
    means = [d["mean"] for d in data]
    stds = [d["std"] for d in data]
    posr = [d["pos_ratio"] for d in data]

    fig, ax1 = plt.subplots(figsize=(10, 6))
    ax2 = ax1.twinx()

    ax1.plot(steps, means, label="Mean Q", lw=2)
    ax1.fill_between(steps, np.array(means) - np.array(stds), np.array(means) + np.array(stds),
                     alpha=0.2, label="±1σ", color="gray")
    ax2.plot(steps, posr, color="orange", lw=2, label="Positive Ratio")

    ax1.set_xlabel("Episodes")
    ax1.set_ylabel("Q-value (mean ± std)")
    ax2.set_ylabel("Positive Q Ratio")
    ax1.set_title(f"Q-learning Convergence: {title}")
    ax1.grid(True, alpha=0.3)

    lines, labels = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines + lines2, labels + labels2, loc="upper right")

    plt.tight_layout()
    plt.show()


# === 実行 ===
if __name__ == "__main__":
    for tdir in TARGET_DIRS:
        tpath = Path(tdir)
        if not tpath.exists():
            print(f"[SKIP] {tdir} not found")
            continue

        json_files = sorted(tpath.glob("q_table_ep*.json"))
        if not json_files:
            print(f"[SKIP] No checkpoint files in {tdir}")
            continue

        stats = [analyze_q_table(f) for f in json_files]
        print(f"✅ {tdir}: {len(stats)} snapshots loaded.")
        plot_convergence(stats, title=tdir)
