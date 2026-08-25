"""Self-play training for Badugi DQN agents.

Strategy
--------
* Hero trains against a periodically-frozen copy of itself (opponent).
* Every ``opponent_update_interval`` episodes the opponent weights are
  overwritten with the current hero weights, keeping it a challenging but
  stable target.
* A short teacher-warmup phase using BadugiEnv preloads the replay buffer
  so the network starts with reasonable play before self-play begins.
* Optional warm-start from an existing checkpoint (e.g. badugi_pro_v3).
* Output checkpoint is compatible with export_badugi_dqn_onnx.py.

Usage::

    python src/rl/training/train_selfplay_badugi_dqn.py
    python src/rl/training/train_selfplay_badugi_dqn.py \\
        --pretrained rl/models/badugi_v2obs_perf_50k_20260602/badugi_dqn_latest.pt \\
        --episodes 100000
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import torch

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.env.badugi_env import BadugiEnv
from rl.env.badugi_env_selfplay import DualAgentBadugiEnv
from rl.utils.replay_buffer import ReplayBuffer


@dataclass
class SelfPlayConfig:
    total_episodes: int = 100_000
    max_steps_per_episode: int = 60
    buffer_capacity: int = 200_000
    warmup_steps: int = 5_000
    batch_size: int = 64
    epsilon_start: float = 0.60
    epsilon_end: float = 0.05
    epsilon_decay_episodes: int = 80_000
    # Teacher warm-up: fill replay before self-play starts.
    teacher_warmup_episodes: int = 2_000
    teacher_profiles: tuple[str, ...] = field(default_factory=lambda: (
        "balanced", "loose_aggressive", "tight_passive",
        "tight_aggressive", "draw_heavy",
    ))
    imitation_pretrain_steps: int = 500
    imitation_loss_weight: float = 0.40
    expert_replay_ratio: float = 0.20
    # Fold margin: prevents Q(fold) dominating on strong hands.
    fold_margin: float = 0.10
    fold_margin_weight: float = 0.25
    fold_margin_interval: int = 5
    # opp_epsilon: 0.0 = pure GTO self-play, 0.05-0.10 = diversity.
    opp_epsilon: float = 0.05
    # How often to copy hero → opp (in episodes).
    opponent_update_interval: int = 500
    train_every_steps: int = 3
    hidden_dim: int = 192
    learning_rate: float = 1e-4
    save_interval: int = 10_000
    log_interval: int = 500
    output_dir: str = "rl/models/badugi_selfplay"
    # Optional pretrained checkpoint for warm-start.
    pretrained: str = ""
    # Optional deterministic seed. None preserves existing stochastic defaults.
    seed: int | None = None


def _validate_config(cfg: SelfPlayConfig) -> None:
    if cfg.total_episodes < 0:
        raise ValueError("total_episodes must be non-negative")
    if cfg.max_steps_per_episode <= 0:
        raise ValueError("max_steps_per_episode must be positive")
    if cfg.buffer_capacity < cfg.batch_size:
        raise ValueError("buffer_capacity must be >= batch_size")
    if cfg.batch_size <= 0:
        raise ValueError("batch_size must be positive")
    if cfg.train_every_steps <= 0:
        raise ValueError("train_every_steps must be positive")
    if cfg.opponent_update_interval <= 0:
        raise ValueError("opponent_update_interval must be positive")
    if cfg.save_interval < 0 or cfg.log_interval < 0:
        raise ValueError("save_interval and log_interval must be non-negative")


def _seed_everything(seed: int | None) -> None:
    if seed is None:
        return
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def _ensure_finite(name: str, value: float, *, episode: int, step: int) -> None:
    if not math.isfinite(float(value)):
        raise RuntimeError(f"Non-finite {name} at episode={episode} step={step}: {value}")


def _ensure_array_finite(name: str, values: np.ndarray, *, episode: int, step: int) -> None:
    if not np.all(np.isfinite(values)):
        raise RuntimeError(f"Non-finite {name} at episode={episode} step={step}")


def _assert_replay_bounds(name: str, replay: ReplayBuffer) -> None:
    if len(replay) > replay.capacity:
        raise AssertionError(f"{name} replay exceeded capacity: {len(replay)} > {replay.capacity}")


def _process_rss_mb() -> float | None:
    status_path = Path("/proc/self/status")
    try:
        for line in status_path.read_text(encoding="utf8").splitlines():
            if line.startswith("VmRSS:"):
                return float(line.split()[1]) / 1024.0
    except OSError:
        pass
    try:
        import resource

        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return float(rss) / 1024.0 if sys.platform != "darwin" else float(rss) / (1024.0 * 1024.0)
    except Exception:
        return None


def _replay_storage_estimate_mb(*buffers: ReplayBuffer) -> float:
    # Raw ndarray payload estimate only. Python object/list overhead is visible
    # in process RSS and intentionally not double-counted here.
    bytes_per_transition = (96 * 4 * 2) + (6 * 4) + 16
    return sum(len(buffer) for buffer in buffers) * bytes_per_transition / (1024.0 * 1024.0)


def _atomic_write_text(path: Path, content: str) -> float:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    start = time.perf_counter()
    try:
        tmp.write_text(content, encoding="utf8")
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()
    return time.perf_counter() - start


def _atomic_save_agent(agent: DQNAgent, path: Path) -> float:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    start = time.perf_counter()
    try:
        agent.save(str(tmp))
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()
    return time.perf_counter() - start


def _linear_decay(episode: int, start: float, end: float, decay_episodes: int) -> float:
    frac = min(1.0, episode / max(1, decay_episodes))
    return start + frac * (end - start)


def _teacher_warmup(
    cfg: SelfPlayConfig,
    hero: DQNAgent,
    replay: ReplayBuffer,
    expert: ReplayBuffer,
    fold_buffer: ReplayBuffer,
) -> None:
    """Fill replay/expert buffers using BadugiEnv with heuristic opponents."""
    print(f"[SelfPlay] Teacher warm-up: {cfg.teacher_warmup_episodes} episodes ×"
          f" {len(cfg.teacher_profiles)} profiles")
    env = BadugiEnv(opponent_profile=cfg.teacher_profiles[0])
    for episode in range(1, cfg.teacher_warmup_episodes + 1):
        env.set_opponent_profile(cfg.teacher_profiles[(episode - 1) % len(cfg.teacher_profiles)])
        reset_seed = None if cfg.seed is None else cfg.seed + episode
        obs, _ = env.reset(seed=reset_seed)
        for _ in range(cfg.max_steps_per_episode):
            mask = env.legal_action_mask()
            # Simple teacher: play greedily with slight exploration
            if np.random.random() < 0.20:
                legal = np.where(mask > 0)[0]
                action = int(np.random.choice(legal)) if len(legal) > 0 else 0
            else:
                # Heuristic: call/check in BET, draw toward badugi in DRAW
                if env.phase == "BET":
                    to_call = max(0, env.current_bet - env.player_bet)
                    action = 2 if to_call > 0 else 1  # call or check
                else:
                    from rl.env.badugi_env_selfplay import _best_badugi_keep
                    keep = _best_badugi_keep(env.player_hand)
                    action = min(3, len(env.player_hand) - len(keep))
            next_obs, reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            _ensure_finite("teacher_reward", float(reward), episode=episode, step=0)
            replay.add(obs, action, reward, next_obs, done, next_action_mask=mask)
            expert.add(obs, action, reward, next_obs, done, next_action_mask=mask)
            if action == 0 and reward < 0:  # fold that lost EV
                fold_buffer.add(obs, action, reward, next_obs, done, next_action_mask=mask)
            _assert_replay_bounds("main", replay)
            _assert_replay_bounds("expert", expert)
            _assert_replay_bounds("fold", fold_buffer)
            obs = next_obs
            if done:
                break

    if cfg.imitation_pretrain_steps > 0 and len(expert) >= cfg.batch_size:
        for _ in range(cfg.imitation_pretrain_steps):
            imitation_loss, imitation_accuracy = hero.imitation_update(
                expert.sample(cfg.batch_size),
                loss_weight=cfg.imitation_loss_weight,
            )
            _ensure_finite("teacher_imitation_loss", imitation_loss, episode=0, step=hero.train_steps)
            _ensure_finite("teacher_imitation_accuracy", imitation_accuracy, episode=0, step=hero.train_steps)
    print(f"[SelfPlay] Teacher done: replay={len(replay)} expert={len(expert)} fold={len(fold_buffer)}")


def train_selfplay_badugi_dqn(
    cfg: SelfPlayConfig | None = None,
    device: str | torch.device = "cpu",
) -> dict:
    cfg = cfg or SelfPlayConfig()
    _validate_config(cfg)
    _seed_everything(cfg.seed)
    output_dir = Path(cfg.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Build hero agent.
    hero = DQNAgent(
        obs_dim=96,
        n_actions=6,
        device=device,
        hidden_dim=cfg.hidden_dim,
        hyperparams=DQNHyperParams(
            gamma=0.985,
            lr=cfg.learning_rate,
            batch_size=cfg.batch_size,
            tau=5e-3,
        ),
    )

    # Optional warm-start.
    if cfg.pretrained:
        pretrained_path = Path(cfg.pretrained)
        if not pretrained_path.is_absolute():
            pretrained_path = PROJECT_ROOT / pretrained_path
        if pretrained_path.exists():
            try:
                loaded = DQNAgent.load(str(pretrained_path), device=device)
                hero.q_network.load_state_dict(loaded.q_network.state_dict())
                hero.target_network.load_state_dict(loaded.target_network.state_dict())
                print(f"[SelfPlay] Warm-started from {pretrained_path}")
            except Exception as exc:
                print(f"[SelfPlay] Warm-start failed for {pretrained_path}: {exc} — starting fresh")
        else:
            print(f"[SelfPlay] Pretrained not found: {pretrained_path} — starting fresh")

    # Opponent: frozen copy of hero, updated periodically.
    opp = DQNAgent(
        obs_dim=96,
        n_actions=6,
        device=device,
        hidden_dim=cfg.hidden_dim,
        hyperparams=DQNHyperParams(gamma=0.985, lr=cfg.learning_rate, batch_size=cfg.batch_size),
    )
    opp.q_network.load_state_dict(hero.q_network.state_dict())
    opp.target_network.load_state_dict(hero.target_network.state_dict())

    # Replay buffers.
    replay = ReplayBuffer(capacity=cfg.buffer_capacity, seed=cfg.seed)
    expert_seed = None if cfg.seed is None else cfg.seed + 1
    fold_seed = None if cfg.seed is None else cfg.seed + 2
    expert = ReplayBuffer(capacity=min(50_000, cfg.buffer_capacity // 4), seed=expert_seed)
    fold_buffer = ReplayBuffer(capacity=10_000, seed=fold_seed, alpha=0.0)

    # Phase 1: teacher warm-up.
    _teacher_warmup(cfg, hero, replay, expert, fold_buffer)

    # Self-play environment.
    sp_env = DualAgentBadugiEnv(seed=cfg.seed, opp_epsilon=cfg.opp_epsilon)
    sp_env.set_agents(hero, opp)

    global_step = 0
    reward_window_size = max(100, cfg.log_interval if cfg.log_interval > 0 else 100)
    recent_rewards: deque[float] = deque(maxlen=reward_window_size)
    window_folds = window_raises = window_bet_steps = 0
    loss = mean_q = imitation_loss = imitation_accuracy = fold_margin_loss = 0.0
    opponent_updates = 0
    training_start = time.perf_counter()
    last_log_time = training_start
    last_log_step = 0

    print(f"[SelfPlay] Starting self-play: {cfg.total_episodes} episodes")

    for episode in range(1, cfg.total_episodes + 1):
        reset_seed = None if cfg.seed is None else cfg.seed + cfg.teacher_warmup_episodes + episode
        obs, _ = sp_env.reset(seed=reset_seed)
        total_reward = 0.0
        ep_folds = ep_raises = ep_bet_steps = 0
        epsilon = _linear_decay(episode, cfg.epsilon_start, cfg.epsilon_end, cfg.epsilon_decay_episodes)

        for _ in range(cfg.max_steps_per_episode):
            global_step += 1
            mask = sp_env.legal_action_mask()
            action = hero.act(obs, epsilon, action_mask=mask)

            if sp_env.phase == "BET":
                ep_bet_steps += 1
                if action == 0:
                    ep_folds += 1
                elif action in (3, 4):
                    ep_raises += 1

            next_obs, reward, terminated, truncated, _ = sp_env.step(action)
            done = terminated or truncated
            _ensure_finite("reward", float(reward), episode=episode, step=global_step)
            replay.add(obs, action, reward, next_obs, done, next_action_mask=sp_env.legal_action_mask())
            _assert_replay_bounds("main", replay)
            obs = next_obs
            total_reward += float(reward)
            _ensure_finite("episode_reward", total_reward, episode=episode, step=global_step)

            if (
                global_step >= cfg.warmup_steps
                and len(replay) >= cfg.batch_size
                and global_step % max(1, cfg.train_every_steps) == 0
            ):
                batch, indices, is_weights = replay.sample(cfg.batch_size, return_meta=True)
                loss, mean_q, td_errors = hero.update(batch, weights=is_weights)
                _ensure_finite("loss", loss, episode=episode, step=global_step)
                _ensure_finite("mean_q", mean_q, episode=episode, step=global_step)
                _ensure_array_finite("td_errors", td_errors, episode=episode, step=global_step)
                replay.update_priorities(indices, td_errors)

                expert_bs = int(round(cfg.batch_size * cfg.expert_replay_ratio))
                if expert_bs > 0 and len(expert) >= expert_bs:
                    imitation_loss, imitation_accuracy = hero.imitation_update(
                        expert.sample(expert_bs),
                        loss_weight=cfg.imitation_loss_weight,
                    )
                    _ensure_finite("imitation_loss", imitation_loss, episode=episode, step=global_step)
                    _ensure_finite("imitation_accuracy", imitation_accuracy, episode=episode, step=global_step)

                margin_batch = max(8, cfg.batch_size // 8)
                if global_step % cfg.fold_margin_interval == 0 and len(fold_buffer) >= margin_batch:
                    fold_margin_loss, _ = hero.action_margin_update(
                        fold_buffer.sample(margin_batch),
                        avoid_action=2,
                        margin=cfg.fold_margin,
                        loss_weight=cfg.fold_margin_weight,
                    )
                    _ensure_finite("fold_margin_loss", fold_margin_loss, episode=episode, step=global_step)

            if done:
                break

        recent_rewards.append(total_reward)
        window_folds += ep_folds
        window_raises += ep_raises
        window_bet_steps += ep_bet_steps

        # Periodically freeze hero → opp.
        if episode % cfg.opponent_update_interval == 0:
            opp.q_network.load_state_dict(hero.q_network.state_dict())
            opp.target_network.load_state_dict(hero.target_network.state_dict())
            opponent_updates += 1

        if cfg.log_interval > 0 and episode % cfg.log_interval == 0:
            recent = list(recent_rewards)[-cfg.log_interval:]
            w = max(1, window_bet_steps)
            fold_rate = window_folds / w
            raise_rate = window_raises / w
            now = time.perf_counter()
            elapsed = now - training_start
            interval_elapsed = max(1e-9, now - last_log_time)
            episodes_per_sec = episode / max(1e-9, elapsed)
            steps_per_sec = (global_step - last_log_step) / interval_elapsed
            replay_fill_pct = len(replay) / max(1, replay.capacity) * 100.0
            rss_mb = _process_rss_mb()
            replay_est_mb = _replay_storage_estimate_mb(replay, expert, fold_buffer)
            warn = ""
            if fold_rate > 0.55:
                warn += " ⚠ HIGH-FOLD"
            if raise_rate < 0.05:
                warn += " ⚠ LOW-AGGRESSION"
            telemetry = (
                f"[SelfPlay {episode:7d}] "
                f"avg_reward={sum(recent)/len(recent):8.3f} "
                f"ε={epsilon:.3f} buf={len(replay):7d} "
                f"fill={replay_fill_pct:5.1f}% "
                f"loss={loss:.5f} mean_q={mean_q:.3f} "
                f"fold%={fold_rate*100:.1f} raise%={raise_rate*100:.1f} "
                f"opp_upd={opponent_updates} "
                f"eps/s={episodes_per_sec:.2f} steps/s={steps_per_sec:.1f} "
                f"replay_est={replay_est_mb:.1f}MB"
            )
            if rss_mb is not None:
                telemetry += f" rss={rss_mb:.1f}MB"
            print(f"{telemetry}{warn}")
            window_folds = window_raises = window_bet_steps = 0
            last_log_time = now
            last_log_step = global_step

        if cfg.save_interval > 0 and episode % cfg.save_interval == 0:
            ts = time.strftime("%Y%m%d-%H%M%S")
            ckpt = output_dir / f"badugi_selfplay_dqn_{episode:06d}_{ts}.pt"
            checkpoint_duration = _atomic_save_agent(hero, ckpt)
            latest_duration = _atomic_save_agent(hero, output_dir / "badugi_selfplay_dqn_latest.pt")
            print(
                f"[SelfPlay] Saved → {ckpt} "
                f"checkpoint_s={checkpoint_duration:.2f} latest_s={latest_duration:.2f}"
            )

    latest = output_dir / "badugi_selfplay_dqn_latest.pt"
    final_checkpoint_duration = _atomic_save_agent(hero, latest)
    last_100_rewards = list(recent_rewards)[-100:]

    summary = {
        "episodes": int(cfg.total_episodes),
        "global_steps": int(global_step),
        "avg_reward_last_100": float(sum(last_100_rewards) / max(1, len(last_100_rewards))),
        "opponent_update_interval": int(cfg.opponent_update_interval),
        "opponent_updates": int(opponent_updates),
        "teacher_warmup_episodes": int(cfg.teacher_warmup_episodes),
        "opp_epsilon": float(cfg.opp_epsilon),
        "pretrained": cfg.pretrained,
        "checkpoint": str(latest),
        "checkpoint_save_seconds": float(final_checkpoint_duration),
        "replay_size": int(len(replay)),
        "replay_capacity": int(replay.capacity),
        "replay_fill_pct": float(len(replay) / max(1, replay.capacity) * 100.0),
        "replay_storage_estimate_mb": float(_replay_storage_estimate_mb(replay, expert, fold_buffer)),
        "process_rss_mb": _process_rss_mb(),
        "seed": cfg.seed,
        "obs_dim": 96,
        "n_actions": 6,
    }
    _atomic_write_text(output_dir / "badugi_selfplay_dqn_latest_summary.json", json.dumps(summary, indent=2) + "\n")
    print(f"[SelfPlay] Done → {latest}")
    return summary


def parse_args():
    parser = argparse.ArgumentParser(description="Self-play DQN training for Badugi.")
    parser.add_argument("--episodes", type=int, default=SelfPlayConfig.total_episodes)
    parser.add_argument("--pretrained", default=SelfPlayConfig.pretrained)
    parser.add_argument("--output-dir", default=SelfPlayConfig.output_dir)
    parser.add_argument("--save-interval", type=int, default=SelfPlayConfig.save_interval)
    parser.add_argument("--log-interval", type=int, default=SelfPlayConfig.log_interval)
    parser.add_argument("--opponent-update-interval", type=int, default=SelfPlayConfig.opponent_update_interval)
    parser.add_argument("--opp-epsilon", type=float, default=SelfPlayConfig.opp_epsilon)
    parser.add_argument("--teacher-warmup-episodes", type=int, default=SelfPlayConfig.teacher_warmup_episodes)
    parser.add_argument("--hidden-dim", type=int, default=SelfPlayConfig.hidden_dim)
    parser.add_argument("--buffer-capacity", type=int, default=SelfPlayConfig.buffer_capacity)
    parser.add_argument("--batch-size", type=int, default=SelfPlayConfig.batch_size)
    parser.add_argument("--learning-rate", type=float, default=SelfPlayConfig.learning_rate)
    parser.add_argument("--seed", type=int, default=SelfPlayConfig.seed)
    parser.add_argument("--device", default=None)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    cfg = SelfPlayConfig(
        total_episodes=args.episodes,
        pretrained=args.pretrained,
        output_dir=args.output_dir,
        save_interval=args.save_interval,
        log_interval=args.log_interval,
        opponent_update_interval=args.opponent_update_interval,
        opp_epsilon=args.opp_epsilon,
        teacher_warmup_episodes=args.teacher_warmup_episodes,
        hidden_dim=args.hidden_dim,
        buffer_capacity=args.buffer_capacity,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        seed=args.seed,
    )
    print(f"[SelfPlay] device={device} episodes={cfg.total_episodes} pretrained={cfg.pretrained!r}")
    train_selfplay_badugi_dqn(cfg=cfg, device=device)
