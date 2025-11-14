# src/utils/hand_utils.py
import numpy as np

# =============================
# 螳壽焚繝ｻ蜈ｱ騾夊ｨｭ螳・
# =============================
SUIT_SYMBOLS = ["笙", "笙･", "笙ｦ", "笙｣"]
RANK_NAMES = {
    1: "A", 2: "2", 3: "3", 4: "4", 5: "5",
    6: "6", 7: "7", 8: "8", 9: "9", 10: "T",
    11: "J", 12: "Q", 13: "K"
}

# =============================
# 隕ｳ貂ｬ繝・さ繝ｼ繝蛾未騾｣
# =============================
def decode_hand_from_obs(obs):
    """
    隕ｳ貂ｬ繝吶け繝医Ν縺九ｉ繝励Ξ繧､繝､繝ｼ縺ｮ謇区惆繧貞ｾｩ蜈・☆繧九・
    obs: np.ndarray 縺ｾ縺溘・ list
        0..7 = [rank1, suit1, rank2, suit2, rank3, suit3, rank4, suit4]
    謌ｻ繧雁､: [(rank, suit), ...]
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
# 蜿ｯ隕門喧邉ｻ
# =============================
def pretty_card(card):
    """(rank, suit) 竊・'A笙' 縺ｮ繧医≧縺ｫ謨ｴ蠖｢"""
    if not card:
        return "--"
    r, s = card
    rank_name = RANK_NAMES.get(r, str(r))
    suit = SUIT_SYMBOLS[s] if 0 <= s < len(SUIT_SYMBOLS) else "?"
    return f"{rank_name}{suit}"


def pretty_hand(hand):
    """謇区惆繝ｪ繧ｹ繝医ｒ 'A笙 7笙･ 9笙ｦ K笙｣' 縺ｮ繧医≧縺ｪ譁・ｭ怜・縺ｫ謨ｴ蠖｢"""
    return " ".join([pretty_card(c) for c in hand]) if hand else "(empty)"


# =============================
# 蠖ｹ蛻､螳壹Ο繧ｸ繝・け
# =============================
def hand_rank(hand):
    """
    Badugi 縺ｮ蠖ｹ蛻､螳夲ｼ磯㍾隍・せ繝ｼ繝・繝ｩ繝ｳ繧ｯ繧呈賜縺励※谿九ｋ譛牙柑繧ｫ繝ｼ繝画焚縺ｨ繝ｩ繝ｳ繧ｯ繝ｪ繧ｹ繝茨ｼ峨・
    蟆上＆縺・Λ繝ｳ繧ｯ縺悟ｼｷ縺・・
    霑斐ｊ蛟､: (譛牙柑繧ｫ繝ｼ繝画椢謨ｰ, [r1, r2, ...])
    """
    best = []
    used_suits = set()
    used_ranks = set()
    for r, s in sorted(hand, key=lambda x: x[0]):  # 繝ｩ繝ｳ繧ｯ譏・・
        if r not in used_ranks and s not in used_suits:
            best.append(r)
            used_ranks.add(r)
            used_suits.add(s)
    return (len(best), best)


def evaluate_hand_strength(hand):
    """
    Badugi 縺ｮ蠑ｷ縺輔ｒ謨ｰ蛟､蛹厄ｼ亥､ｧ縺阪＞縺ｻ縺ｩ蠑ｷ縺・ｼ峨・
    譛牙柑繧ｫ繝ｼ繝画椢謨ｰ繧貞━蜈医＠縲∝酔譫壽焚縺ｪ繧峨Λ繝ｳ繧ｯ蜷郁ｨ医′蟆上＆縺・⊇縺ｩ鬮倩ｩ穂ｾ｡縲・
    """
    count, ranks = hand_rank(hand)
    if not ranks:
        return 0
    return count * 200 - sum(ranks)


def compare_hands(hand_a, hand_b):
    """
    2縺､縺ｮ繝上Φ繝峨ｒ豈碑ｼ・＠縺ｦ邨先棡繧定ｿ斐☆縲・
      > 0 竊・hand_a 蜍昴■
      < 0 竊・hand_b 蜍昴■
      = 0 竊・蠑輔″蛻・￠
    """
    count_a, ranks_a = hand_rank(hand_a)
    count_b, ranks_b = hand_rank(hand_b)

    # 譫壽焚蜆ｪ蜈・
    if count_a != count_b:
        return count_a - count_b

    # 繝ｩ繝ｳ繧ｯ豈碑ｼ・ｼ域・鬆・〒1縺､縺壹▽・・
    for ra, rb in zip(sorted(ranks_a), sorted(ranks_b)):
        if ra != rb:
            return rb - ra  # 蟆上＆縺・婿縺悟ｼｷ縺・・縺ｧ騾・ｻ｢
    return 0


# =============================
# 邨ｱ險医・繝ｬ繝ｳ繧ｸ蛻・梵陬懷勧
# =============================
def classify_strength(hand):
    """
    繝上Φ繝峨ｒ繧ｫ繝・ざ繝ｪ蛹悶＠縺ｦ蠑ｷ蠑ｱ繝ｩ繝吶Ν繧定ｿ斐☆縲・
    'strong' / 'medium' / 'weak' 縺ｮ3谿ｵ髫・
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
    讖滓｢ｰ蟄ｦ鄙偵・邨ｱ險育畑縺ｫ迚ｹ蠕ｴ驥上・繧ｯ繝医Ν繧定ｿ斐☆縲・
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

