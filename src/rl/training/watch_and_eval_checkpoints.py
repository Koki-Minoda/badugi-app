"""チェックポイントを監視して都度評価するスクリプト。

速度・報酬トレンド・ベースライン比較を出力する。
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.env.badugi_env import BadugiEnv
from rl.env.badugi_env_sixmax_selfplay import SixMaxBadugiEnv
from rl.training.export_badugi_dqn_onnx import export_checkpoint

try:
    import onnxruntime as ort
except ImportError:
    ort = None

try:
    import torch
    from rl.agents.dqn_agent import DQNAgent
except Exception:
    DQNAgent = None


# ---- ONNX 推論 ----

FOLD_TERMINAL_REASONS = {"hero_fold", "fold_win"}
SHOWDOWN_TERMINAL_REASON = "showdown"


def _normalize_mode(mode: str) -> str:
    if mode not in {"sixmax", "hu"}:
        raise ValueError(f"unsupported mode={mode!r}; expected 'sixmax' or 'hu'")
    return mode


def checkpoint_glob_pattern(mode: str = "sixmax") -> str:
    mode = _normalize_mode(mode)
    return "badugi_sixmax_dqn_[0-9]*.pt" if mode == "sixmax" else "badugi_dqn_[0-9]*.pt"


def summary_path_for(checkpoint_dir: Path, mode: str = "sixmax") -> Path:
    mode = _normalize_mode(mode)
    filename = (
        "badugi_sixmax_dqn_latest_summary.json"
        if mode == "sixmax"
        else "badugi_dqn_latest_summary.json"
    )
    return checkpoint_dir / filename


def eval_note_for(mode: str = "sixmax") -> str:
    mode = _normalize_mode(mode)
    if mode == "sixmax":
        return (
            "SixMax checkpoint smoke-evaluated in SixMaxBadugiEnv via ONNX hero policy "
            "against built-in fallback opponents; useful for watcher health checks, "
            "less representative than full clean sixmax self-play eval."
        )
    return "HU checkpoint evaluated in HU BadugiEnv; use --mode hu explicitly for this path."


def _classify_terminal_reason(reason: str | None) -> str | None:
    if reason in FOLD_TERMINAL_REASONS:
        return "fold"
    if reason == SHOWDOWN_TERMINAL_REASON:
        return "showdown"
    return None


def _make_onnx_session(onnx_path: Path):
    if ort is None:
        raise RuntimeError("onnxruntime が必要です")
    return ort.InferenceSession(str(onnx_path))


def _masked_onnx_action(session, input_name: str, output_name: str, obs: np.ndarray, mask: np.ndarray) -> int:
    q = session.run([output_name], {input_name: obs.astype(np.float32)})[0]
    q = np.asarray(q, dtype=np.float32).reshape(-1)[: len(mask)].copy()
    q[np.asarray(mask) <= 0] = -1e9
    return int(np.argmax(q))


def run_onnx_eval(
    onnx_path: Path,
    *,
    n_episodes: int = 300,
    seeds: list[int] | None = None,
    profiles: list[str] | None = None,
    table_size: int = 2,
) -> dict:
    """ONNX モデルを HU BadugiEnv で評価して統計を返す。"""
    if seeds is None:
        seeds = [20260502, 20260503, 20260504]
    if profiles is None:
        profiles = ["balanced", "loose_aggressive", "tight_passive"]

    session = _make_onnx_session(onnx_path)
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    import random

    all_rewards: list[float] = []
    fold_count = 0
    showdown_wins = 0
    showdown_total = 0

    for seed in seeds:
        np.random.seed(seed)
        random.seed(seed)
        for profile in profiles:
            env = BadugiEnv(opponent_profile=profile, table_size=table_size)
            eps_per_combo = n_episodes // (len(seeds) * len(profiles))
            for _ in range(max(1, eps_per_combo)):
                obs, _ = env.reset()
                done = False
                ep_reward = 0.0
                while not done:
                    mask = env.legal_action_mask()
                    q = session.run([output_name], {input_name: obs.astype(np.float32)})[0]
                    q = np.array(q, copy=True)
                    q[mask <= 0] = -1e9
                    action = int(np.argmax(q))
                    obs, reward, terminated, truncated, _ = env.step(action)
                    ep_reward += reward
                    done = terminated or truncated
                all_rewards.append(ep_reward)
                reason = env.terminal_reason
                if _classify_terminal_reason(reason) == "fold":
                    fold_count += 1
                if _classify_terminal_reason(reason) == "showdown":
                    showdown_total += 1
                    if ep_reward > 0:
                        showdown_wins += 1

    n = len(all_rewards)
    swd = showdown_wins / showdown_total if showdown_total else None
    return {
        "n_episodes": n,
        "avg_reward": float(np.mean(all_rewards)) if n else 0.0,
        "std_reward": float(np.std(all_rewards)) if n else 0.0,
        "fold_rate": fold_count / n if n else 0.0,
        "showdown_win_rate": swd,
        "showdown_total": showdown_total,
        "terminal_counts": {
            "fold": int(fold_count),
            "showdown": int(showdown_total),
        },
        "eval_mode": "hu",
        "eval_note": eval_note_for("hu"),
    }


def run_sixmax_onnx_eval(
    onnx_path: Path,
    *,
    n_episodes: int = 300,
    seeds: list[int] | None = None,
) -> dict:
    """ONNX hero policy を SixMaxBadugiEnv で smoke 評価する。

    Opponents use the env fallback policy, so this is a watcher health check, not
    a replacement for clean sixmax self-play evaluation.
    """
    if seeds is None:
        seeds = [20260502, 20260503, 20260504]

    session = _make_onnx_session(onnx_path)
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    all_rewards: list[float] = []
    fold_count = 0
    fold_win_count = 0
    hero_fold_count = 0
    showdown_wins = 0
    showdown_total = 0

    eps_per_seed = max(1, n_episodes // max(1, len(seeds)))
    for seed in seeds:
        env = SixMaxBadugiEnv(seed=seed, opp_epsilon=0.0)
        for _ in range(eps_per_seed):
            obs, _ = env.reset()
            done = False
            ep_reward = 0.0
            terminal_reason = None
            for _step in range(160):
                mask = env.legal_action_mask()
                action = _masked_onnx_action(session, input_name, output_name, obs, mask)
                obs, reward, terminated, truncated, info = env.step(action)
                ep_reward += reward
                done = bool(terminated or truncated)
                if done:
                    terminal_reason = (
                        info.get("terminal_reason") if isinstance(info, dict) else None
                    ) or getattr(env, "terminal_reason", None)
                    break
            if not done:
                terminal_reason = "truncated"

            all_rewards.append(ep_reward)
            if _classify_terminal_reason(terminal_reason) == "fold":
                fold_count += 1
                if terminal_reason == "fold_win":
                    fold_win_count += 1
                elif terminal_reason == "hero_fold":
                    hero_fold_count += 1
            if _classify_terminal_reason(terminal_reason) == "showdown":
                showdown_total += 1
                if ep_reward > 0:
                    showdown_wins += 1

    n = len(all_rewards)
    swd = showdown_wins / showdown_total if showdown_total else None
    return {
        "n_episodes": n,
        "avg_reward": float(np.mean(all_rewards)) if n else 0.0,
        "std_reward": float(np.std(all_rewards)) if n else 0.0,
        "fold_rate": fold_count / n if n else 0.0,
        "showdown_win_rate": swd,
        "showdown_total": showdown_total,
        "terminal_counts": {
            "fold": int(fold_count),
            "hero_fold": int(hero_fold_count),
            "fold_win": int(fold_win_count),
            "showdown": int(showdown_total),
        },
        "eval_mode": "sixmax",
        "eval_note": eval_note_for("sixmax"),
    }


# ---- ログパーサ ----

def parse_train_log(log_path: Path, mode: str = "sixmax") -> list[dict]:
    """学習ログを解析して各エピソードの統計を返す。"""
    _normalize_mode(mode)
    results = []
    try:
        for line in log_path.read_text().splitlines():
            if not (line.startswith("[Episode") or line.startswith("[6max ")):
                continue
            parts = line.split()
            def get(key: str) -> float | None:
                for i, p in enumerate(parts):
                    if p == f"{key}=":
                        try:
                            return float(parts[i + 1])
                        except Exception:
                            return None
                    if p.startswith(f"{key}="):
                        try:
                            return float(p.split("=", 1)[1])
                        except Exception:
                            return None
                return None
            def get_any(*keys: str) -> float | None:
                for key in keys:
                    value = get(key)
                    if value is not None:
                        return value
                return None
            ep_token = parts[1].strip("[]")
            if ep_token.isdigit():
                ep = int(ep_token)
            elif len(parts) > 2 and parts[2].strip("[]").isdigit():
                ep = int(parts[2].strip("[]"))
            else:
                continue
            results.append({
                "episode": ep,
                "avg_reward": get_any("avg_reward", "avg"),
                "loss": get("loss"),
                "mean_q": get_any("mean_q", "q"),
                "buffer": get_any("buffer", "buf"),
                "epsilon": get_any("epsilon", "ε"),
            })
    except Exception:
        pass
    return results


def checkpoint_episode(path: Path) -> int:
    """ファイル名から数値を取り出す (badugi_dqn_005000_... → 5000)。"""
    for part in path.stem.split("_"):
        if part.isdigit():
            return int(part)
    return 0


def checkpoint_candidates(checkpoint_dir: Path, mode: str = "sixmax") -> list[Path]:
    return sorted(
        checkpoint_dir.glob(checkpoint_glob_pattern(mode)),
        key=lambda p: checkpoint_episode(p),
    )


def summary_reaches_target(checkpoint_dir: Path, mode: str, target_episodes: int) -> bool:
    if target_episodes <= 0:
        return False
    summary_path = summary_path_for(checkpoint_dir, mode)
    if not summary_path.exists():
        return False
    try:
        summary = json.loads(summary_path.read_text())
    except Exception:
        return False
    return int(summary.get("episodes", 0)) >= int(target_episodes)


# ---- メインウォッチャー ----

def watch(args):
    mode = _normalize_mode(args.mode)
    checkpoint_dir = Path(args.checkpoint_dir)
    eval_dir = Path(args.eval_dir)
    eval_dir.mkdir(parents=True, exist_ok=True)
    log_path = Path(args.train_log) if args.train_log else None

    seen: set[Path] = set()
    prev_checkpoint: Path | None = None
    prev_checkpoint_time: float | None = None
    report: list[dict] = []

    print(f"[watch] mode={mode} {checkpoint_dir} を監視中 (間隔: {args.poll_interval}s)")
    print(f"[watch] 評価エピソード数: {args.eval_episodes}")
    print(f"[watch] checkpoint_glob={checkpoint_glob_pattern(mode)}")
    print(f"[watch] summary_path={summary_path_for(checkpoint_dir, mode)}")
    print(f"[watch] eval_note={eval_note_for(mode)}")
    print("-" * 70)

    while True:
        candidates = checkpoint_candidates(checkpoint_dir, mode)
        new_ones = [c for c in candidates if c not in seen]

        for ckpt in new_ones:
            seen.add(ckpt)
            now = time.time()
            ep = checkpoint_episode(ckpt)

            # ---- 速度計測 ----
            if prev_checkpoint is not None and prev_checkpoint_time is not None:
                prev_ep = checkpoint_episode(prev_checkpoint)
                elapsed = now - prev_checkpoint_time
                ep_diff = ep - prev_ep
                speed = ep_diff / elapsed if elapsed > 0 else 0.0
            else:
                elapsed = None
                ep_diff = None
                speed = None
            prev_checkpoint = ckpt
            prev_checkpoint_time = now

            print(f"\n{'='*70}")
            print(f"[CP] ep={ep:>6}  ファイル: {ckpt.name}")
            if speed is not None:
                flag = ""
                if speed < 5.0:
                    flag = " ⚠ 激重"
                elif speed < 12.0:
                    flag = " △ やや重"
                print(f"[速度] {ep_diff} ep / {elapsed:.0f}s = {speed:.1f} eps/秒{flag}")
            else:
                print("[速度] (最初のチェックポイント)")

            # ---- 学習ログから直近の統計 ----
            train_avg_reward = None
            if log_path and log_path.exists():
                entries = parse_train_log(log_path, mode=mode)
                near = [e for e in entries if abs(e["episode"] - ep) <= 500]
                if near:
                    train_rewards = [e["avg_reward"] for e in near if e["avg_reward"] is not None]
                    avg_loss = [e["loss"] for e in near if e["loss"] is not None]
                    avg_q = [e["mean_q"] for e in near if e["mean_q"] is not None]
                    buf = near[-1]["buffer"]
                    eps_val = near[-1]["epsilon"]
                    train_avg_reward = float(np.mean(train_rewards)) if train_rewards else None
                    train_loss = float(np.mean(avg_loss)) if avg_loss else None
                    train_mean_q = float(np.mean(avg_q)) if avg_q else None
                    train_avg_reward_str = (
                        f"{train_avg_reward:.3f}" if train_avg_reward is not None else "N/A"
                    )
                    train_loss_str = f"{train_loss:.4f}" if train_loss is not None else "N/A"
                    train_mean_q_str = f"{train_mean_q:.3f}" if train_mean_q is not None else "N/A"
                    buf_str = f"{buf:.0f}" if buf is not None else "N/A"
                    eps_str = f"{eps_val:.3f}" if eps_val is not None else "N/A"
                    print(f"[学習] avg_reward≈{train_avg_reward_str}  loss≈{train_loss_str}  "
                          f"mean_q≈{train_mean_q_str}  buffer={buf_str}  ε={eps_str}")

            # ---- ONNX エクスポート & 評価 ----
            onnx_path = eval_dir / f"{ckpt.stem}.onnx"
            print(f"[eval] ONNX エクスポート中...")
            try:
                export_checkpoint(
                    checkpoint=ckpt,
                    output=onnx_path,
                    registry=PROJECT_ROOT / "src/config/ai/modelRegistry.json",
                    model_id="checkpoint-eval",
                    update_registry=False,
                    device="cpu",
                )
                print(f"[eval] 評価実行中 ({args.eval_episodes} ep × {args.seeds} seeds)...")
                t0 = time.time()
                seeds = [int(s) for s in args.seeds.split(",")]
                if mode == "sixmax":
                    result = run_sixmax_onnx_eval(
                        onnx_path,
                        n_episodes=args.eval_episodes,
                        seeds=seeds,
                    )
                else:
                    result = run_onnx_eval(
                        onnx_path,
                        n_episodes=args.eval_episodes,
                        seeds=seeds,
                        profiles=args.profiles.split(","),
                    )
                eval_elapsed = time.time() - t0
                avg_r = result["avg_reward"]
                std_r = result["std_reward"]
                fold_r = result["fold_rate"]
                swd = result["showdown_win_rate"]
                showdown_total = result["showdown_total"]

                # 傾向チェック
                issues = []
                if avg_r < -2.0:
                    issues.append("avg_reward が低すぎ（過剰フォールドの可能性）")
                if fold_r > 0.7:
                    issues.append(f"フォールド率が高い ({fold_r:.1%})")
                if swd is not None and swd < 0.30:
                    issues.append(f"ショーダウン勝率が低い ({swd:.1%})")
                if swd is None and showdown_total == 0:
                    issues.append("ショーダウンが0回（フォールドし過ぎの可能性）")

                swd_str = f"{swd:.1%}" if swd is not None else "N/A"
                print(f"[結果] avg_reward={avg_r:.3f}±{std_r:.3f}  fold={fold_r:.1%}  "
                      f"showdown_win={swd_str}  ({eval_elapsed:.0f}s)")
                print(f"[eval-note] {result.get('eval_note', eval_note_for(mode))}")
                if issues:
                    for iss in issues:
                        print(f"  ⚠ {iss}")
                else:
                    print("  ✓ 問題なし")

                row = {
                    "episode": ep,
                    "checkpoint": str(ckpt),
                    "speed_eps_per_sec": round(speed, 2) if speed is not None else None,
                    "train_avg_reward": train_avg_reward,
                    "eval_avg_reward": avg_r,
                    "eval_std_reward": std_r,
                    "fold_rate": fold_r,
                    "showdown_win_rate": swd,
                    "terminal_counts": result.get("terminal_counts", {}),
                    "eval_mode": result.get("eval_mode", mode),
                    "eval_note": result.get("eval_note", eval_note_for(mode)),
                    "issues": issues,
                }
                report.append(row)
                report_path = eval_dir / "eval_report.json"
                report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))

            except Exception as exc:
                print(f"[eval] エラー: {exc}")

        # 終了検出: mode ごとの latest_summary.json を見る。SixMax mode では
        # HU summary と混同しない。
        if summary_reaches_target(checkpoint_dir, mode, args.target_episodes):
            print(f"\n[watch] target_episodes={args.target_episodes} 到達。終了します。")
            break

        time.sleep(args.poll_interval)


def main():
    parser = argparse.ArgumentParser(description="チェックポイント監視・評価ループ")
    parser.add_argument("--mode", choices=("sixmax", "hu"), default="sixmax",
                        help="監視対象。default=sixmax")
    parser.add_argument("--checkpoint-dir", required=True)
    parser.add_argument("--eval-dir", default="rl/evaluations/perf_50k_watch")
    parser.add_argument("--train-log", default=None, help="学習ログファイルのパス")
    parser.add_argument("--eval-episodes", type=int, default=300)
    parser.add_argument("--seeds", default="20260502,20260503,20260504")
    parser.add_argument("--profiles", default="balanced,loose_aggressive,tight_passive")
    parser.add_argument("--poll-interval", type=float, default=15.0)
    parser.add_argument("--target-episodes", type=int, default=50000,
                        help="この値に達したら監視を終了する (0=無制限)")
    args = parser.parse_args()
    watch(args)


if __name__ == "__main__":
    main()
