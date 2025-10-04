# hand_utils.py
import numpy as np

def decode_hand_from_obs(obs):
    """
    観測ベクトルからプレイヤーの手札を復元する
    obs: np.array
    戻り値: [(rank, suit), ...] のリスト
    """
    hand = []
    for i in range(0, 8, 2):  # 0-7まで2刻みでrank,suit
        r, s = int(obs[i]), int(obs[i+1])
        if r != 0 or s != 0:
            hand.append((r, s))
    return hand

def pretty_hand(hand):
    """手札を見やすい文字列に整形"""
    suits = ["♠", "♥", "♦", "♣"]
    return " ".join([f"{r}{suits[s]}" for r, s in hand])

def hand_rank(hand):
    """
    Badugi の役判定（重複スート/ランクを排して残る有効カード数とランクリスト）
    """
    best = []
    used_suits = set()
    used_ranks = set()
    for r, s in sorted(hand, key=lambda x: x[0]):
        if r not in used_ranks and s not in used_suits:
            best.append(r)
            used_ranks.add(r)
            used_suits.add(s)
    return (len(best), best)

def evaluate_hand_strength(hand):
    """Badugi の強さを数値スコア化"""
    count, ranks = hand_rank(hand)
    if not ranks:
        return 0
    score = count * 200 - sum(ranks)
    return score
