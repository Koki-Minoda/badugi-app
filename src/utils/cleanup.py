# src/utils/cleanup.py
# -------------------------------------------------------------
# Badugi Q-learning 学習後の自動クリーンアップモジュール
# -------------------------------------------------------------

import os
import re
import shutil

def cleanup_intermediate_qtables(outdir: str, keep_pattern: str = "final", remove_logs: bool = False):
    """
    学習フォルダ内の中間Qテーブルやログを削除し、容量を軽量化する。
    
    Parameters
    ----------
    outdir : str
        クリーンアップ対象ディレクトリ (例: "runs/q_learning_refine5")
    keep_pattern : str
        保持するファイル名に含まれるキーワード（通常は "final"）
    remove_logs : bool
        Trueならtrain_log.txtなどのログも削除
    """

    if not os.path.exists(outdir):
        print(f"⚠️ クリーンアップ対象が存在しません: {outdir}")
        return

    removed = 0
    for fname in os.listdir(outdir):
        fpath = os.path.join(outdir, fname)

        # Qテーブルの中間ファイル削除
        if re.match(r"^q_table_ep\d+\.json$", fname) and keep_pattern not in fname:
            try:
                os.remove(fpath)
                removed += 1
            except Exception as e:
                print(f"削除失敗: {fname} ({e})")

        # ログ削除オプション
        if remove_logs and fname.endswith(".log") or fname == "train_log.txt":
            try:
                os.remove(fpath)
                print(f"🧾 ログ削除: {fname}")
            except Exception as e:
                print(f"ログ削除失敗: {fname} ({e})")

    print(f"🧹 クリーンアップ完了: {removed}件削除 ({outdir})")
