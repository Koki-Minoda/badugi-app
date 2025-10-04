import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random

class BadugiEnv(gym.Env):
    def __init__(self, num_players=2):
        super().__init__()

        # プレイヤー人数 (HU=2, 6max=6など)
        self.num_players = num_players

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
        self.max_bets = 4        # FLなので 4bet cap

        # 進行管理
        self.round = 0           # 0=プリドロー後BET
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

        if self.phase == "BET":
            bet_size = self._bet_size()

            # --- Player action ---
            if action == 0:  # Fold
                self.done = True
                reward = -1

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
                    reward = 1

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

                        # Playerは強制コール（簡略）
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
                # Player draw
                if action > 0:
                    n_draw = min(action, 4)
                    for _ in range(n_draw):
                        idx = random.randrange(len(self.player_hand))
                        self.player_hand[idx] = self.deck.pop()
                # Opponent draw
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
                reward = self._judge()
            else:
                self.phase = "BET"

        return self._get_obs(), reward, self.done, False, {}

    def _get_obs(self):
        obs = []
        for r, s in self.player_hand:
            obs.extend([r, s])
        obs += [0] * (8 - len(obs))

        obs.append(self.round)
        obs.append(self.player_stack)
        obs.append(self.opponent_stack)
        obs.append(self.pot)
        obs.append(self.player_bet)
        obs.append(self.opponent_bet)
        obs.append(self.current_bet)
        obs.append(self.bet_round)
        obs.append(self.max_rounds - self.round)
        obs.append(0 if self.phase == "BET" else 1)
        obs.append(self.opponent_last_draw)
        obs.append(self.is_button)
        obs.append(self._player_is_first_to_act())
        obs.append(self.last_opp_action)

        return np.array(obs, dtype=np.float32)

    # -------------------------
    # 相手の戦略
    # -------------------------
    def _evaluate_hand_strength(self, hand):
        """Badugi の強さを数値スコア化"""
        count, ranks = self._hand_rank(hand)
        if not ranks:
            return 0
        score = count * 200 - sum(ranks)
        return score

    def _opponent_bet_strategy(self):
        """相手のベット戦略（人数に応じて切り替え）"""
        count, ranks = self._hand_rank(self.opponent_hand)
        score = self._evaluate_hand_strength(self.opponent_hand)

        if self.num_players == 2:
            # --- HU 戦略 ---
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
                if max(ranks) <= 7:
                    probs = {"raise": 0.2, "call": 0.6, "fold": 0.2}
                else:
                    probs = {"raise": 0.05, "call": 0.4, "fold": 0.55}
            elif count == 1:
                rank = ranks[0] if ranks else 13
                probs = {"raise": 0.0, "call": 0.05, "fold": 0.95}
                if rank <= 3:  # A〜4
                    probs = {"raise": 0.15, "call": 0.15, "fold": 0.7}
            else:
                probs = {"raise": 0.0, "call": 0.0, "fold": 1.0}

        else:
            # --- マルチプレイ戦略 ---
            if count == 4:
                if max(ranks) <= 7:  # A〜7 のバドゥーギ
                    probs = {"raise": 0.6, "call": 0.35, "fold": 0.05}
                else:  # 8以上は守備的
                    probs = {"raise": 0.1, "call": 0.7, "fold": 0.2}
            elif count == 3:
                if max(ranks) <= 7:
                    probs = {"raise": 0.3, "call": 0.5, "fold": 0.2}
                elif max(ranks) <= 10:
                    probs = {"raise": 0.1, "call": 0.5, "fold": 0.4}
                else:
                    probs = {"raise": 0.0, "call": 0.3, "fold": 0.7}
            elif count == 2:
                if max(ranks) <= 6:
                    probs = {"raise": 0.1, "call": 0.4, "fold": 0.5}
                else:
                    probs = {"raise": 0.0, "call": 0.2, "fold": 0.8}
            else:
                probs = {"raise": 0.0, "call": 0.0, "fold": 1.0}

        # スコア補正
        if score > 500:
            probs["raise"] += 0.2
            probs["fold"] *= 0.5
        elif score < 150:
            probs["fold"] += 0.2
            probs["raise"] *= 0.5

        # 正規化
        total = sum(probs.values())
        for k in probs:
            probs[k] /= total

        return random.choices(list(probs.keys()), weights=probs.values())[0]

    def _opponent_draw(self):
        """相手のドロー戦略"""
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
        """Badugi 役判定"""
        best = []
        used_suits = set()
        used_ranks = set()
        for r, s in sorted(hand, key=lambda x: x[0]):
            if r not in used_ranks and s not in used_suits:
                best.append(r)
                used_ranks.add(r)
                used_suits.add(s)
        return (len(best), best)
