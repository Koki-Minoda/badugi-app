# rl/badugi_env_train.py
"""
Badugi 強化学習用の簡易環境（学習専用）
→ React 側で収集したログをもとに強化学習を進めるための基盤
"""

import random
import numpy as np


class BadugiEnv:
    """
    Badugi の簡易環境クラス
    将来的には React 側のゲームロジックと同等のハンド評価・ベット進行に置き換える
    """

    ACTIONS = ["FOLD", "CALL", "RAISE", "DRAW"]

    def __init__(self):
        self.reset()

    def reset(self):
        """新しいハンドを配る"""
        # 状態の初期化（簡易モデル）
        self.hand = self._random_hand()
        self.pot = 20
        self.bet_size = 10
        self.draw_count = 3
        self.done = False
        self.reward = 0
        return self._get_state()

    def _random_hand(self):
        """ランダムな4枚のカード"""
        ranks = list("A23456789TJQK")
        suits = ["♠", "♥", "♦", "♣"]
        deck = [r + s for r in ranks for s in suits]
        return random.sample(deck, 4)

    def _get_state(self):
        """状態を数値ベクトル化して返す
        現状は pot / bet / drawCount の3要素のみだが、
        将来的には手札評価値や相手情報も追加予定。
        """
        return np.array([
            self.pot / 100.0,
            self.bet_size / 100.0,
            self.draw_count / 3.0,
        ], dtype=np.float32)

    def step(self, action_idx):
        """アクションを実行して次状態・報酬・終了フラグを返す"""
        action = self.ACTIONS[action_idx]

        # --- 仮の報酬モデル（後で本物の勝敗ロジックに差し替え）---
        if action == "FOLD":
            reward = -1
            self.done = True
        elif action == "CALL":
            reward = random.choice([0, 1])
            self.done = random.random() < 0.3
        elif action == "RAISE":
            reward = random.choice([1, -1])
            self.done = random.random() < 0.4
        elif action == "DRAW":
            reward = 0
            self.draw_count -= 1
            if self.draw_count <= 0:
                self.done = True
        else:
            reward = 0

        self.reward = reward
        next_state = self._get_state()
        return next_state, reward, self.done
