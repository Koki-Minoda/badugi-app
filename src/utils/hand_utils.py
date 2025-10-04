# src/utils/hand_utils.py
import numpy as np

# =============================
# 定数・共通設定
# =============================
SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"]
RANK_NAMES = {
    1: "A", 2: "2", 3: "3", 4: "4", 5: "5",
    6: "6", 7: "7", 8: "8", 9: "9", 10: "T",
    11: "J", 12: "Q", 13: "K"
}

# =============================
# 観測デコード関連
# =============================
def decode_hand_from_obs(obs):
    """
    観測ベクトルからプレイヤーの手札を復元する。
    obs: np.ndarray または list
        0..7 = [rank1, suit1, rank2, suit2, rank3, suit3, rank4, suit4]
    戻り値: [(rank, suit), ...]
    """
    obs = np.asarray(obs).tolist()
    hand = []
    for i in range(0, 8, 2):
        r = int(obs[i])
        s = int(obs[i + 1])
        if (r, s) != (0, 0):
            hand.append((r, s))
    return hand


# =============================
# 可視化系
# =============================
def pretty_card(card):
    """(rank, suit) → 'A♠' のように整形"""
    if not card:
        return "--"
    r, s = card
    rank_name = RANK_NAMES.get(r, str(r))
    suit = SUIT_SYMBOLS[s] if 0 <= s < len(SUIT_SYMBOLS) else "?"
    return f"{rank_name}{suit}"


def pretty_hand(hand):
    """手札リストを 'A♠ 7♥ 9♦ K♣' のような文字列に整形"""
    return " ".join([pretty_card(c) for c in hand]) if hand else "(empty)"


# =============================
# 役判定ロジック
# =============================
def hand_rank(hand):
    """
    Badugi の役判定（重複スート/ランクを排して残る有効カード数とランクリスト）。
    小さいランクが強い。
    返り値: (有効カード枚数, [r1, r2, ...])
    """
    best = []
    used_suits = set()
    used_ranks = set()
    for r, s in sorted(hand, key=lambda x: x[0]):  # ランク昇順
        if r not in used_ranks and s not in used_suits:
            best.append(r)
            used_ranks.add(r)
            used_suits.add(s)
    return (len(best), best)


def evaluate_hand_strength(hand):
    """
    Badugi の強さを数値化（大きいほど強い）。
    有効カード枚数を優先し、同枚数ならランク合計が小さいほど高評価。
    """
    count, ranks = hand_rank(hand)
    if not ranks:
        return 0
    return count * 200 - sum(ranks)


def compare_hands(hand_a, hand_b):
    """
    2つのハンドを比較して結果を返す。
      > 0 → hand_a 勝ち
      < 0 → hand_b 勝ち
      = 0 → 引き分け
    """
    count_a, ranks_a = hand_rank(hand_a)
    count_b, ranks_b = hand_rank(hand_b)

    # 枚数優先
    if count_a != count_b:
        return count_a - count_b

    # ランク比較（昇順で1つずつ）
    for ra, rb in zip(sorted(ranks_a), sorted(ranks_b)):
        if ra != rb:
            return rb - ra  # 小さい方が強いので逆転
    return 0


# =============================
# 統計・レンジ分析補助
# =============================
def classify_strength(hand):
    """
    ハンドをカテゴリ化して強弱ラベルを返す。
    'strong' / 'medium' / 'weak' の3段階
    """
    count, ranks = hand_rank(hand)
    if count >= 4 and max(ranks) <= 8:
        return "strong"
    elif count >= 3 and max(ranks) <= 10:
        return "medium"
    else:
        return "weak"


def calc_hand_features(hand):
    """
    機械学習・統計用に特徴量ベクトルを返す。
    """
    count, ranks = hand_rank(hand)
    avg_rank = np.mean(ranks) if ranks else 13
    high = max(ranks) if ranks else 13
    low = min(ranks) if ranks else 13
    return {
        "valid_cards": count,
        "avg_rank": avg_rank,
        "high": high,
        "low": low,
        "strength": evaluate_hand_strength(hand)
    }
