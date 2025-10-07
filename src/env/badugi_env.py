# src/env/badugi_env.py
import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random

class BadugiEnv(gym.Env):
    def __init__(self):
        super().__init__()

        # 観測空間: 手札(8) + 状態(11) + 追加(3) = 22
        self.observation_space = spaces.Box(
            low=0.0, high=10000.0, shape=(22,), dtype=np.float32
        )

        # 行動空間（0=Fold, 1=Call/Check, 2=Raise, 3〜4=Draw枚数）
        self.action_space = spaces.Discrete(5)

        self.max_rounds = 3  # ドロー回数（プリドロー後に3回）
        self.reset()

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)

        # デッキ生成
        self.deck = [(r, s) for r in range(13) for s in range(4)]
        random.shuffle(self.deck)

        # 初期手札
        self.player_hand = [self.deck.pop() for _ in range(4)]
        self.opponent_hand = [self.deck.pop() for _ in range(4)]

        # スタック/ポット
        self.player_stack = 100
        self.opponent_stack = 100
        self.pot = 0
        self.player_bet = 0
        self.opponent_bet = 0

        # ベットラウンド管理
        self.bet_round = 0       # ストリート内レイズ回数
        self.max_bets = 4        # FLなので4bet cap

        # 進行管理
        self.round = 0
        self.phase = "BET"
        self.done = False

        # ポジション管理
        self.is_button = 1
        self.opponent_last_draw = 0
        self.last_opp_action = 0

        # FL 初期ベットサイズ
        self.current_bet = self._bet_size()

        return self._get_obs(), {}

    def _bet_size(self):
        """ラウンドごとのベットサイズ（Fixed Limit）"""
        return 1 if self.round < 2 else 2

    def _player_is_first_to_act(self):
        # round偶数: SB(BTN)が先行, round奇数: BBが先行
        return 1 if (self.round % 2 == 0) else 0

    def step(self, action):
        reward = 0

        p_count, p_ranks, p_sum, p_min, is_nuts, one_away = self._hand_features(self.player_hand)

        # --- Reward shaping start ---
        base_reward = 0.0

        if self.phase == "BET":
            if action == 0:  # Fold
                base_reward = -0.3
            elif action == 1:  # Call / Check
                base_reward = -0.05
            elif action == 2:  # Raise
                base_reward = +0.15  # 単独レイズには報酬なし（結果次第）
                if one_away:
                    base_reward += 0.25   # 3枚バドは攻めを後押し
                    if p_count == 4 and (max(p_ranks) <= 8):
                       base_reward += 0.30   # 強い4枚での値上げを推奨
                    # 相手が直前ドロー多め（情報的優位）でのレイズは少しボーナス
                    if self.opponent_last_draw >= 2:
                       base_reward += 0.20

        elif self.phase == "DRAW":
            if action > 0:
                base_reward = -0.05 * action  # 弱い手で多く引くのはリスク
                # 3枚バドで1枚ドローは +0.05（前進の意図）
                if one_away and action == 1:
                    base_reward += 0.05
            else:
                base_reward = +0.05  # ドローなし＝強ハンド維持とみなす
                if p_count == 4:
                    base_reward += 0.10  # Pat Badugi はさらに加点

        reward += base_reward

        # --- Reward shaping end ---

        if self.phase == "BET":
            bet_size = self._bet_size()

            # --- Player action ---
            if action == 0:  # Fold
                self.done = True
                reward += -1

            elif action == 1:  # Call / Check
                diff = self.current_bet - self.player_bet
                if diff > 0:
                    self.player_stack -= diff
                    self.pot += diff
                    self.player_bet = self.current_bet

            elif action == 2:  # Raise
                if self.bet_round < self.max_bets:
                    self.current_bet += bet_size
                    diff = self.current_bet - self.player_bet
                    self.player_stack -= diff
                    self.pot += diff
                    self.player_bet = self.current_bet
                    self.bet_round += 1
                else:
                    diff = self.current_bet - self.player_bet
                    self.player_stack -= diff
                    self.pot += diff
                    self.player_bet = self.current_bet

            # --- Opponent action ---
            if not self.done:
                opp_action = self._opponent_bet_strategy()
                if opp_action == "fold":
                    self.last_opp_action = 1
                    self.done = True
                    reward += 1
                    reward += 0.6 if action == 2 else 0.3

                elif opp_action == "call":
                    self.last_opp_action = 2
                    diff = self.current_bet - self.opponent_bet
                    if diff > 0:
                        self.opponent_stack -= diff
                        self.pot += diff
                        self.opponent_bet = self.current_bet
                    self.phase = "DRAW"

                elif opp_action == "raise":
                    self.last_opp_action = 3
                    if self.bet_round < self.max_bets:
                        self.current_bet += bet_size
                        diff = self.current_bet - self.opponent_bet
                        self.opponent_stack -= diff
                        self.pot += diff
                        self.opponent_bet = self.current_bet
                        self.bet_round += 1

                        # プレイヤーは強制コール（簡略）
                        diff = self.current_bet - self.player_bet
                        if diff > 0:
                            self.player_stack -= diff
                            self.pot += diff
                            self.player_bet = self.current_bet
                        self.phase = "DRAW"
                    else:
                        diff = self.current_bet - self.opponent_bet
                        self.opponent_stack -= diff
                        self.pot += diff
                        self.opponent_bet = self.current_bet
                        self.phase = "DRAW"

        elif self.phase == "DRAW":
            if self.round > 0:
                if action > 0:
                    n_draw = min(action, 4)
                    for _ in range(n_draw):
                        idx = random.randrange(len(self.player_hand))
                        self.player_hand[idx] = self.deck.pop()

                self.opponent_last_draw = self._opponent_draw()
            else:
                self.opponent_last_draw = 0

            # ラウンド更新
            self.round += 1
            self.bet_round = 0
            self.player_bet = 0
            self.opponent_bet = 0
            self.current_bet = self._bet_size()
            self.last_opp_action = 0

            if self.round >= self.max_rounds:
                self.done = True
                reward += self._judge()
            else:
                self.phase = "BET"

            if self.round >= self.max_rounds:
                self.done = True
                final_result = self._judge()   # +1 / -1 / 0

                # ★ 勝敗ベースの大報酬：勝ちを強く推奨
                if final_result > 0:
                    reward += 3.0     # ← ここを大きく
                # 追加の質的ボーナス
                if p_count == 4:
                    reward += 0.6             # 4枚バドはさらに加点
                    if is_nuts:
                        reward += 1.0          # ナッツは特大ボーナス
                    # ランク合計が低いほどボーナス（0〜0.6程度）
                    reward += max(0.0, min(0.6, (20 - p_sum) * 0.05))
                elif p_count == 3:
                    reward += 0.2             # 3枚で勝ったのも少し褒める
            elif final_result < 0:
                reward -= 1.0     # 敗北の罰は控えめ（過度に臆病化しない）
            else:
                reward += 0.0     # 引き分け

        else:
            self.phase = "BET"

        return self._get_obs(), reward, self.done, False, {}

    # -------------------------
    # 相手の戦略
    # -------------------------
    def _evaluate_hand_strength(self, hand):
        count, ranks = self._hand_rank(hand)
        if not ranks:
            return 0
        score = count * 200 - sum(ranks)
        return score

    def _opponent_bet_strategy(self):
        count, ranks = self._hand_rank(self.opponent_hand)
        score = self._evaluate_hand_strength(self.opponent_hand)

        if count == 4:
            if max(ranks) <= 10:
                probs = {"raise": 0.7, "call": 0.25, "fold": 0.05}
            else:
                probs = {"raise": 0.2, "call": 0.6, "fold": 0.2}

        elif count == 3:
            if max(ranks) <= 7:
                probs = {"raise": 0.4, "call": 0.5, "fold": 0.1}
            elif max(ranks) <= 10:
                probs = {"raise": 0.25, "call": 0.6, "fold": 0.15}
            else:
                probs = {"raise": 0.1, "call": 0.6, "fold": 0.3}

        elif count == 2:
            high = max(ranks)
            if high <= 7:
                probs = {"raise": 0.2, "call": 0.6, "fold": 0.2}
            else:
                probs = {"raise": 0.05, "call": 0.4, "fold": 0.55}

        elif count == 1:
            rank = ranks[0] if ranks else 13
            probs = {"raise": 0.0, "call": 0.05, "fold": 0.95}
            if rank <= 3:
                probs = {"raise": 0.15, "call": 0.15, "fold": 0.7}
            rank_counts = {}
            for r, _ in self.opponent_hand:
                rank_counts[r] = rank_counts.get(r, 0) + 1
            if any(c >= 3 and r <= 6 for r, c in rank_counts.items()):
                probs = {"raise": 0.2, "call": 0.2, "fold": 0.6}
        else:
            probs = {"raise": 0.0, "call": 0.0, "fold": 1.0}

        if score > 500:
            probs["raise"] += 0.2
            probs["fold"] *= 0.5
        elif score < 150:
            probs["fold"] += 0.2
            probs["raise"] *= 0.5

        position_factor = 0.9 if (self.round % 2 == 0) else 1.0
        probs["call"] *= position_factor

        total = sum(probs.values())
        for k in probs:
            probs[k] /= total

        return random.choices(list(probs.keys()), weights=probs.values())[0]

    def _opponent_draw(self):
        count, _ = self._hand_rank(self.opponent_hand)
        if count == 4:
            return 0

        keep = []
        used_ranks = set()
        used_suits = set()
        for r, s in sorted(self.opponent_hand, key=lambda x: x[0]):
            if r not in used_ranks and s not in used_suits:
                keep.append((r, s))
                used_ranks.add(r)
                used_suits.add(s)

        new_hand = keep[:]
        n_draw = 4 - len(new_hand)
        for _ in range(n_draw):
            new_hand.append(self.deck.pop())
        self.opponent_hand = new_hand
        return n_draw

    # -------------------------
    # 勝敗判定
    # -------------------------
    def _judge(self):
        p_count, p_ranks = self._hand_rank(self.player_hand)
        o_count, o_ranks = self._hand_rank(self.opponent_hand)

        print(f"[DEBUG] Player: {self.player_hand} => {p_count}枚, {p_ranks}")
        print(f"[DEBUG] Opponent: {self.opponent_hand} => {o_count}枚, {o_ranks}, LastDraw={self.opponent_last_draw}")

        if p_count > o_count:
            return 1
        elif p_count < o_count:
            return -1
        else:
            for pr, orr in zip(sorted(p_ranks), sorted(o_ranks)):
                if pr < orr:
                    return 1
                elif pr > orr:
                    return -1
            return 0

    def render(self):
        print(f"Round {self.round}, Phase {self.phase}")
        print(f"Pot: {self.pot}, Player stack: {self.player_stack}, Opponent stack: {self.opponent_stack}")
        print("Player:", self.player_hand)
        print("Opponent:", self.opponent_hand, f"(Last draw: {self.opponent_last_draw})")

    def _hand_rank(self, hand):
        best = []
        used_suits = set()
        used_ranks = set()
        for r, s in sorted(hand, key=lambda x: x[0]):
            if r not in used_ranks and s not in used_suits:
                best.append(r)
                used_ranks.add(r)
                used_suits.add(s)
        return (len(best), best)
    def _normalize(self, value, max_value=100):
        return value / max_value

    def _get_obs(self):
        obs = []
        for r, s in self.player_hand:
            obs.extend([r/12, s/3])  # ランクとスートを正規化
        obs += [0.0] * (8 - len(obs))

        obs.extend([
            self.round / self.max_rounds,
            self._normalize(self.player_stack),
            self._normalize(self.opponent_stack),
            self._normalize(self.pot, 400),
            self._normalize(self.player_bet, 10),
            self._normalize(self.opponent_bet, 10),
            self._normalize(self.current_bet, 10),
            self.bet_round / self.max_bets,
            (self.max_rounds - self.round) / self.max_rounds,
            0.0 if self.phase == "BET" else 1.0,
            self._normalize(self.opponent_last_draw, 4),
            self.is_button,
            self._player_is_first_to_act(),
            self.last_opp_action / 4
        ])
        return np.array(obs, dtype=np.float32)
        
    def _hand_features(self, hand):
         """
         Badugi用の簡易特徴:
         - count: バド枚数(1〜4)
         - ranks_sorted: 使えるランク昇順
         - rank_sum: 使えるランクの合計（小さいほど強い）
         - min_rank: 最小ランク
         - is_nuts: A234レインボー（[0,1,2,3]）
         - one_away: 3枚バド（1枚で4枚完成の見込み）
         """
         count, ranks = self._hand_rank(hand)
         ranks_sorted = sorted(ranks)
         rank_sum = sum(ranks_sorted) if ranks_sorted else 99
         min_rank = ranks_sorted[0] if ranks_sorted else 99
         is_nuts = (count == 4 and ranks_sorted == [0, 1, 2, 3])
         one_away = (count == 3)
         return count, ranks_sorted, rank_sum, min_rank, is_nuts, one_away
