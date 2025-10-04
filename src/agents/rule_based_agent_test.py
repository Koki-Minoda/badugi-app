import numpy as np
from src.env.badugi_env import BadugiEnv
from src.utils.hand_utils import decode_hand_from_obs, pretty_hand, hand_rank, evaluate_hand_strength

def rule_based_action(obs, phase):
    """
    シンプルなルールベースエージェント。
    手札の強さに応じて Fold / Call / Raise / Draw 枚数を決定。
    """
    hand = decode_hand_from_obs(obs)
    count, ranks = hand_rank(hand)
    score = evaluate_hand_strength(hand)

    # 状況を簡潔に評価
    strength_label = (
        "strong" if count == 4
        else "medium" if count == 3
        else "weak"
    )
    print(f"Player: {pretty_hand(hand)} [{count}バド, {strength_label}] → ", end="")

    # --- BET フェーズ ---
    if phase == "BET":
        if count == 4:
            print("action=2 (Raise)")
            return 2
        elif count == 3:
            act = 1 if max(ranks) > 8 else 2
            print(f"action={act} ({'Call' if act==1 else 'Raise'})")
            return act
        elif count == 2:
            act = 1 if max(ranks) <= 7 else 0
            print(f"action={act} ({'Call' if act==1 else 'Fold'})")
            return act
        else:
            print("action=0 (Fold)")
            return 0

    # --- DRAW フェーズ ---
    elif phase == "DRAW":
        n_draw = 4 - count
        print(f"action={n_draw} (Draw {n_draw})")
        return min(max(n_draw, 0), 3)

    return 1  # fallback: Call


def run_episode(player_count=2):
    env = BadugiEnv(player_count=player_count)
    obs, info = env.reset()
    total_reward = 0
    done = False

    print(f"\n=== {player_count}-MAX Rule-based Agent ===")

    while not done:
        phase = "DRAW" if obs[17] == 1 else "BET"
        action = rule_based_action(obs, phase)
        obs, reward, done, _, _ = env.step(action)
        total_reward += reward

        print(f"[CHECK] opp_last_draw={obs[-1]}, phase_flag={obs[17]} (0=BET,1=DRAW)\n")

    print(f"Episode total reward: {total_reward:.3f}\n")


if __name__ == "__main__":
    print("=== Heads-Up (2 players) / Rule-based agent ===")
    for i in range(3):
        run_episode(player_count=2)

    print("\n=== 6-Max (6 players) / Rule-based agent ===")
    for i in range(3):
        run_episode(player_count=6)
