# utils.py

def log_episode_result(ep: int, reward: float):
    """
    エピソード結果をきれいにログ出力
    """
    print(f"Episode {ep} total reward: {reward:.3f}")


def log_step_info(round_num: int, phase: str, hand, action: int, obs):
    """
    各ステップの情報を整形して出力
    - round_num: 現在のラウンド
    - phase: BET or DRAW
    - hand: [(rank, suit), ...]
    - action: 実行した行動 (0=Fold,1=Call,2=Raise,3+=Draw枚数)
    - obs: 観測ベクトル
    """
    action_map = {0: "Fold", 1: "Call/Check", 2: "Raise", 3: "Draw1", 4: "Draw2"}
    act_str = action_map.get(action, f"Action{action}")

    print(f"Round {round_num}, Phase {phase}")
    print(f" [AGENT] hand={hand}, action={act_str}")
    print(f" [CHECK] opp_last_draw={obs[-1]}, phase_flag={obs[17]}")
