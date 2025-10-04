import json
import os
from datetime import datetime

HISTORY_DIR = "local_history"

def ensure_dir(path):
    """ディレクトリが存在しなければ作成"""
    if not os.path.exists(path):
        os.makedirs(path)

def save_tournament_history(tournament_data, filename=None):
    """トーナメント履歴をローカルJSONに保存"""
    ensure_dir(HISTORY_DIR)
    if filename is None:
        filename = f"tournament_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = os.path.join(HISTORY_DIR, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(tournament_data, f, indent=2, ensure_ascii=False)
    print(f"[保存完了] {filepath}")
    return filepath

def load_recent_histories(limit=20):
    """最新の履歴ファイルを取得"""
    ensure_dir(HISTORY_DIR)
    files = sorted(
        [os.path.join(HISTORY_DIR, f) for f in os.listdir(HISTORY_DIR) if f.endswith(".json")],
        key=os.path.getmtime,
        reverse=True
    )
    return files[:limit]

def summarize_vpip_stats(histories):
    """VPIPなどの統計を算出"""
    total_hands = 0
    vpip_hands = 0
    for h in histories:
        with open(h, "r", encoding="utf-8") as f:
            data = json.load(f)
            for hand in data.get("hands", []):
                total_hands += 1
                if hand.get("voluntarily_put_money", False):
                    vpip_hands += 1

    vpip_rate = (vpip_hands / total_hands * 100) if total_hands > 0 else 0
    return {"total_hands": total_hands, "vpip_rate": vpip_rate}
