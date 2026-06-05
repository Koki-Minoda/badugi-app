"""6-max Badugi チェックポイント監視・評価スクリプト。

10kエピソードごとに:
- 処理速度（eps/秒）
- 全6ポジション別の avg_reward
- fold率 / raise率（モード崩壊検知）
- ベースライン比較（標準モデルとの対戦）
を出力する。
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.env.badugi_env_sixmax_selfplay import SixMaxBadugiEnv
from rl.training.export_badugi_dqn_onnx import export_checkpoint

try:
    import onnxruntime as ort
    import torch
    from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
except ImportError as exc:
    raise SystemExit(f"依存ライブラリが不足しています: {exc}") from exc


def _checkpoint_episode(path: Path) -> int:
    for part in path.stem.split("_"):
        if part.isdigit():
            return int(part)
    return 0


def _eval_sixmax(checkpoint: Path, n_episodes: int = 600, hidden_dim: int = 256) -> dict:
    """6-max環境でチェックポイントを評価。全ポジションを均等に経験させる。"""
    device = "cpu"
    agent = DQNAgent.load(str(checkpoint), device=device)

    env = SixMaxBadugiEnv(seed=20260602)
    env.set_agents(agent, agent)  # 対自己（両方同じ重み）

    all_rewards: list[float] = []
    pos_rewards: dict[int, list[float]] = {i: [] for i in range(6)}
    fold_count = 0
    raise_count = 0
    bet_steps = 0

    eps_per_pos = max(1, n_episodes // 6)
    for pos in range(6):
        env._hero_seat_counter = pos  # 指定ポジションから開始
        for _ in range(eps_per_pos):
            obs, _ = env.reset()
            ep_r = 0.0
            hero_seat = env.hero_seat
            for _ in range(100):
                mask = env.legal_action_mask()
                if env.phase == "BET":
                    bet_steps += 1
                    q = agent.q_network(
                        __import__("torch").tensor(obs.reshape(1, -1), dtype=__import__("torch").float32)
                    ).detach().numpy()[0]
                    q_masked = q.copy()
                    q_masked[mask <= 0] = -1e9
                    action = int(np.argmax(q_masked))
                    if action == 0:
                        fold_count += 1
                    elif action in (3, 4):
                        raise_count += 1
                else:
                    # DRAW phase: greedily draw toward best badugi
                    q = agent.q_network(
                        __import__("torch").tensor(obs.reshape(1, -1), dtype=__import__("torch").float32)
                    ).detach().numpy()[0]
                    q_masked = q.copy()
                    q_masked[mask <= 0] = -1e9
                    action = int(np.argmax(q_masked))
                obs, r, terminated, truncated, _ = env.step(action)
                ep_r += r
                if terminated or truncated:
                    break
            all_rewards.append(ep_r)
            pos_rewards[hero_seat % 6].append(ep_r)

    n = len(all_rewards)
    fold_rate = fold_count / max(1, bet_steps)
    raise_rate = raise_count / max(1, bet_steps)
    return {
        "n_episodes": n,
        "avg_reward": float(np.mean(all_rewards)) if n else 0.0,
        "std_reward": float(np.std(all_rewards)) if n else 0.0,
        "fold_rate": fold_rate,
        "raise_rate": raise_rate,
        "pos_rewards": {
            i: float(np.mean(pos_rewards[i])) if pos_rewards[i] else None
            for i in range(6)
        },
    }


def _parse_log(log_path: Path, episode: int) -> dict | None:
    """学習ログから指定エピソード付近の統計を抽出。"""
    if not log_path or not log_path.exists():
        return None
    try:
        text = log_path.read_text()
        # 直近のログ行を検索
        pattern = rf"\[6max\s+{episode:8d}\](.+)"
        match = re.search(pattern, text)
        if not match:
            # 範囲検索
            pattern = rf"\[6max\s+(\d+)\](.+)"
            matches = re.findall(pattern, text)
            if not matches:
                return None
            # 最も近いものを選ぶ
            closest = min(matches, key=lambda m: abs(int(m[0]) - episode))
            line = closest[1]
        else:
            line = match.group(1)

        def _extract(key):
            m = re.search(rf"{key}=\s*([0-9.\-]+)", line)
            return float(m.group(1)) if m else None

        return {
            "train_avg_reward": _extract("avg"),
            "epsilon": _extract("ε"),
            "buffer": _extract("buf"),
            "loss": _extract("loss"),
            "mean_q": _extract("q"),
            "fold_pct": _extract("fold%"),
            "check_pct": _extract("chk%"),
            "call_pct": _extract("call%"),
            "bet_pct": _extract("bet%"),
            "raise_pct": _extract("raise%"),
            "aggression_pct": _extract("agg%"),
            "speed_eps_per_sec": _extract("spd"),
        }
    except Exception:
        return None


def _run_clean_eval_cli(checkpoint: Path, args, episode: int) -> dict:
    """Run the official clean eval CLI for one checkpoint and read its report."""
    clean_report_dir = Path(args.clean_eval_report_dir)
    clean_report_dir.mkdir(parents=True, exist_ok=True)
    report_path = clean_report_dir / f"badugi-sixmax-clean-eval-{episode:06d}.json"
    cmd = [
        sys.executable,
        str(PROJECT_ROOT / "src/rl/training/evaluate_badugi_sixmax_clean.py"),
        "--checkpoint",
        str(checkpoint),
        "--episodes",
        str(args.clean_eval_episodes),
        "--max-steps",
        str(args.clean_eval_max_steps),
        "--seeds",
        args.clean_eval_seeds,
        "--opponent-profiles",
        args.clean_eval_profiles,
        "--report",
        str(report_path),
        "--onnx-dir",
        str(clean_report_dir / "onnx"),
        "--min-onnx-usage-rate",
        str(args.clean_eval_min_onnx_usage_rate),
        "--max-fallback-rate",
        str(args.clean_eval_max_fallback_rate),
        "--report-only",
    ]
    completed = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    report = None
    if report_path.exists():
        report = json.loads(report_path.read_text(encoding="utf8"))
    fail_reasons = []
    if completed.returncode != 0:
        fail_reasons.append(f"CLEAN_EVAL_CLI_ERROR:{completed.returncode}")
    if report is None:
        fail_reasons.append("CLEAN_EVAL_REPORT_MISSING")
    elif not report.get("passed", False):
        fail_reasons.append("CLEAN_EVAL_FAILED")
        fail_reasons.extend(report.get("gate", {}).get("failReasons", []))
        for result in report.get("results", []):
            for mode_name, mode_result in result.get("cleanEval", {}).items():
                if not mode_result.get("passed", False):
                    fail_reasons.extend(
                        f"{mode_name}:{reason}"
                        for reason in mode_result.get("gate", {}).get("failReasons", [])
                    )
    return {
        "passed": completed.returncode == 0 and report is not None and report.get("passed", False),
        "report": str(report_path),
        "returncode": completed.returncode,
        "failReasons": fail_reasons,
        "stdout": completed.stdout[-2000:],
        "stderr": completed.stderr[-2000:],
        "summary": report,
    }


def watch(args):
    checkpoint_dir = Path(args.checkpoint_dir)
    eval_dir = Path(args.eval_dir)
    eval_dir.mkdir(parents=True, exist_ok=True)
    log_path = Path(args.train_log) if args.train_log else None

    seen: set[Path] = set()
    prev_ckpt: Path | None = None
    prev_ckpt_time: float | None = None
    report: list[dict] = []

    pos_labels = ["SB", "BB", "UTG", "MP", "CO", "BTN"]

    print(f"[watch] {checkpoint_dir} を監視中 (間隔: {args.poll_interval}s)")
    print(f"[watch] 評価エピソード数: {args.eval_episodes} (6ポジション均等)")
    print("-" * 80)

    while True:
        candidates = sorted(
            checkpoint_dir.glob("badugi_sixmax_dqn_[0-9]*.pt"),
            key=_checkpoint_episode,
        )
        new_ones = [c for c in candidates if c not in seen]

        for ckpt in new_ones:
            seen.add(ckpt)
            now = time.time()
            ep = _checkpoint_episode(ckpt)

            # 速度計測
            if prev_ckpt is not None and prev_ckpt_time is not None:
                ep_diff = ep - _checkpoint_episode(prev_ckpt)
                elapsed = now - prev_ckpt_time
                speed = ep_diff / elapsed if elapsed > 0 else None
            else:
                ep_diff = None
                elapsed = None
                speed = None
            prev_ckpt = ckpt
            prev_ckpt_time = now

            print(f"\n{'='*80}")
            print(f"[CP] ep={ep:>8,}  {ckpt.name}")

            if speed is not None:
                flag = " ⚠ 激重" if speed < 3.0 else (" △ やや重" if speed < 8.0 else "")
                print(f"[速度] {ep_diff:,} ep / {elapsed:.0f}s = {speed:.1f} eps/秒{flag}")
            else:
                print("[速度] (最初のチェックポイント)")

            # 学習ログから統計
            log_stats = _parse_log(log_path, ep)
            if log_stats:
                def _fmt(value, spec: str) -> str:
                    return "?" if value is None else format(value, spec)

                print(
                    f"[学習] avg={_fmt(log_stats.get('train_avg_reward'), '.3f')}  "
                    f"ε={_fmt(log_stats.get('epsilon'), '.3f')}  "
                    f"buf={_fmt(log_stats.get('buffer'), '.0f')}  "
                    f"loss={_fmt(log_stats.get('loss'), '.5f')}  "
                    f"fold%={_fmt(log_stats.get('fold_pct'), '.1f')}  "
                    f"chk%={_fmt(log_stats.get('check_pct'), '.1f')}  "
                    f"call%={_fmt(log_stats.get('call_pct'), '.1f')}  "
                    f"bet%={_fmt(log_stats.get('bet_pct'), '.1f')}  "
                    f"raise%={_fmt(log_stats.get('raise_pct'), '.1f')}  "
                    f"agg%={_fmt(log_stats.get('aggression_pct'), '.1f')}  "
                    f"spd={_fmt(log_stats.get('speed_eps_per_sec'), '.1f')} ep/s"
                )

            # 6-max評価
            print(f"[eval] 6-max評価中 ({args.eval_episodes} ep)...")
            try:
                t0 = time.time()
                result = _eval_sixmax(ckpt, n_episodes=args.eval_episodes)
                eval_time = time.time() - t0

                avg_r = result["avg_reward"]
                std_r = result["std_reward"]
                fold_r = result["fold_rate"]
                raise_r = result["raise_rate"]
                pos_r = result["pos_rewards"]

                # ポジション別表示
                pos_str = "  ".join(
                    f"{pos_labels[i]}={pos_r[i]:.2f}" if pos_r[i] is not None else f"{pos_labels[i]}=N/A"
                    for i in range(6)
                )
                print(f"[結果] avg={avg_r:.3f}±{std_r:.3f}  fold={fold_r:.1%}  raise={raise_r:.1%}  ({eval_time:.0f}s)")
                print(f"[ポジ] {pos_str}")

                # 問題検知
                issues = []
                if avg_r < -1.5:
                    issues.append("avg_reward が低すぎる（学習崩壊の可能性）")
                if fold_r > 0.65:
                    issues.append(f"フォールド率過多 ({fold_r:.1%}) — HIGH-FOLD崩壊")
                if raise_r < 0.03:
                    issues.append(f"レイズ率過少 ({raise_r:.1%}) — LOW-AGGRESSION崩壊")
                worst_pos = min((i for i in range(6) if pos_r[i] is not None), key=lambda i: pos_r[i] or 0)
                if pos_r[worst_pos] is not None and pos_r[worst_pos] < -2.0:
                    issues.append(f"ポジション {pos_labels[worst_pos]} の報酬が極端に低い ({pos_r[worst_pos]:.2f})")

                # ティア推定
                if avg_r >= 1.5:
                    tier_est = "Iron候補"
                elif avg_r >= 0.8:
                    tier_est = "Pro候補"
                elif avg_r >= 0.2:
                    tier_est = "Standard+"
                else:
                    tier_est = "学習中"

                print(f"[ティア推定] {tier_est}  {'⚠ ' + ' / '.join(issues) if issues else '✓ 問題なし'}")

                row = {
                    "episode": ep,
                    "checkpoint": str(ckpt),
                    "speed_eps_per_sec": round(speed, 2) if speed else None,
                    "train_avg_reward": log_stats.get("train_avg_reward") if log_stats else None,
                    "eval_avg_reward": avg_r,
                    "eval_std_reward": std_r,
                    "fold_rate": fold_r,
                    "raise_rate": raise_r,
                    "position_rewards": {pos_labels[i]: pos_r[i] for i in range(6)},
                    "tier_estimate": tier_est,
                    "issues": issues,
                }

                if args.clean_eval:
                    print(f"[clean-eval] clean評価CLI実行中 ({args.clean_eval_episodes} ep/profile/seed)...")
                    clean_result = _run_clean_eval_cli(ckpt, args, ep)
                    row["clean_eval"] = {
                        "passed": clean_result["passed"],
                        "report": clean_result["report"],
                        "returncode": clean_result["returncode"],
                        "failReasons": clean_result["failReasons"],
                    }
                    if clean_result["passed"]:
                        print(f"[clean-eval] PASS report={clean_result['report']}")
                    else:
                        print(f"[clean-eval] FAIL report={clean_result['report']} reasons={clean_result['failReasons']}")
                        issues.extend(clean_result["failReasons"])

                report.append(row)
                (eval_dir / "sixmax_eval_report.json").write_text(
                    json.dumps(report, indent=2, ensure_ascii=False)
                )

            except Exception as exc:
                print(f"[eval] エラー: {exc}")

        # 終了検出
        summary_path = checkpoint_dir / "badugi_sixmax_dqn_latest_summary.json"
        if summary_path.exists() and args.target_episodes > 0:
            try:
                s = json.loads(summary_path.read_text())
                if s.get("episodes", 0) >= args.target_episodes:
                    print(f"\n[watch] target_episodes={args.target_episodes:,} 到達。終了します。")
                    break
            except Exception:
                pass

        time.sleep(args.poll_interval)


def main():
    parser = argparse.ArgumentParser(description="6-max チェックポイント監視・評価")
    parser.add_argument("--checkpoint-dir", required=True)
    parser.add_argument("--eval-dir", default="rl/evaluations/sixmax_watch")
    parser.add_argument("--train-log", default=None)
    parser.add_argument("--eval-episodes", type=int, default=600)
    parser.add_argument("--poll-interval", type=float, default=30.0)
    parser.add_argument("--target-episodes", type=int, default=1_000_000)
    parser.add_argument("--hidden-dim", type=int, default=256)
    parser.add_argument("--clean-eval", action="store_true", help="Run clean eval CLI for each checkpoint")
    parser.add_argument("--clean-eval-report-dir", default="reports/ai-eval")
    parser.add_argument("--clean-eval-episodes", type=int, default=120)
    parser.add_argument("--clean-eval-max-steps", type=int, default=120)
    parser.add_argument("--clean-eval-seeds", default="20260602,20260603")
    parser.add_argument(
        "--clean-eval-profiles",
        default="balanced,loose_passive,loose_aggressive,tight_passive,tight_aggressive,pat_heavy,draw_heavy",
    )
    parser.add_argument("--clean-eval-min-onnx-usage-rate", type=float, default=0.99)
    parser.add_argument("--clean-eval-max-fallback-rate", type=float, default=0.01)
    args = parser.parse_args()
    watch(args)


if __name__ == "__main__":
    main()
