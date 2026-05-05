"""Train bootstrap DQNs for board-game betting variants."""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.env.board_betting_env import (
    BOARD_TIERS,
    BOARD_VARIANTS,
    BoardBettingEnv,
    BoardLongHorizonEnv,
    board_teacher_action,
)
from rl.utils.replay_buffer import ReplayBuffer


@dataclass
class BoardTrainConfig:
    family: str = "nlh"
    tier: str = "beginner"
    total_episodes: int = 3_000
    max_steps_per_episode: int = 12
    long_horizon: bool = False
    buffer_capacity: int = 80_000
    warmup_steps: int = 500
    batch_size: int = 64
    epsilon_start: float = 0.7
    epsilon_end: float = 0.05
    epsilon_decay_episodes: int = 2_500
    teacher_warmup_episodes: int = 800
    imitation_pretrain_steps: int = 250
    expert_replay_ratio: float = 0.45
    imitation_loss_weight: float = 0.7
    output_dir: str = "rl/models/board"
    hidden_dim: int = 128
    learning_rate: float = 1e-4
    train_every_steps: int = 2
    save_interval: int = 0
    log_interval: int = 500
    fixture_replay_copies: int = 120
    resume_checkpoint: str | None = None


def linear_epsilon_decay(episode: int, start_eps: float, end_eps: float, decay_episodes: int) -> float:
    if episode >= decay_episodes:
        return end_eps
    return start_eps + (episode / float(decay_episodes)) * (end_eps - start_eps)


def add_board_fixture_examples(env: BoardBettingEnv, replay: ReplayBuffer, expert: ReplayBuffer, copies: int):
    for _ in range(max(0, copies)):
        for fixture in [
            # Base gate: value open / strong continue / weak fold.
            {"strength": 0.85, "equity": 0.82, "draw": 0.15, "to_call": 0.0, "position": 0.7, "expected": 3},
            {"strength": 0.78, "equity": 0.74, "draw": 0.1, "to_call": 0.12, "position": 0.5, "expected": 4},
            {"strength": 0.45, "equity": 0.42, "draw": 0.72, "to_call": 0.08, "position": 0.85, "expected": 2},
            {"strength": 0.2, "equity": 0.18, "draw": 0.1, "to_call": 0.2, "position": 0.2, "expected": 0},
            {"strength": 0.38, "equity": 0.34, "draw": 0.35, "to_call": 0.0, "position": 0.4, "expected": 1},
            # Advanced gate: thin value, bluff discipline, isolation, side-pot control.
            {"strength": 0.66, "equity": 0.61, "draw": 0.05, "to_call": 0.0, "position": 0.9, "expected": 3},
            {"strength": 0.22, "equity": 0.24, "draw": 0.1, "to_call": 0.0, "position": 0.35, "expected": 1},
            {"strength": 0.72, "equity": 0.68, "draw": 0.28 if env.family in {"plo", "plo8"} else 0.12, "to_call": 0.08, "position": 0.72, "expected": 4 if env.family != "flh" else 2, "active_opponents": 3},
            {"strength": 0.34, "equity": 0.31, "draw": 0.16, "to_call": 0.2, "position": 0.5, "expected": 2},
            {"strength": 0.64 if env.family == "plo8" else 0.58, "equity": 0.72 if env.family == "plo8" else 0.52, "draw": 0.62 if env.family == "plo8" else 0.22, "to_call": 0.1, "position": 0.7, "expected": 4 if env.family == "plo8" else 2},
        ]:
            env.reset()
            env.scenario.strength = fixture["strength"]
            env.scenario.equity = fixture["equity"]
            env.scenario.draw_potential = fixture["draw"]
            env.scenario.to_call = fixture["to_call"]
            env.scenario.position = fixture["position"]
            env.scenario.active_opponents = fixture.get("active_opponents", env.scenario.active_opponents)
            env.scenario.raise_count = 0
            obs = env._observation()
            action = fixture["expected"]
            if env.legal_action_mask()[action] <= 0:
                action = board_teacher_action(env.scenario)
            replay.add(obs, action, 0.35, obs, False, next_action_mask=env.legal_action_mask())
            expert.add(obs, action, 0.35, obs, False, next_action_mask=env.legal_action_mask())


def train_board_dqn(cfg: BoardTrainConfig | None = None, device: str | torch.device = "cpu"):
    cfg = cfg or BoardTrainConfig()
    output_dir = Path(cfg.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    env_class = BoardLongHorizonEnv if cfg.long_horizon else BoardBettingEnv
    env = env_class(family=cfg.family, tier=cfg.tier, max_steps_per_episode=cfg.max_steps_per_episode) if cfg.long_horizon else env_class(family=cfg.family, tier=cfg.tier)
    obs, _ = env.reset()
    obs_dim = int(np.prod(env.observation_space.shape))
    n_actions = env.action_space.n
    if cfg.resume_checkpoint:
        agent = DQNAgent.load(cfg.resume_checkpoint, device=device)
        if agent.obs_dim != obs_dim or agent.n_actions != n_actions:
            raise ValueError(
                f"Resume checkpoint shape mismatch: checkpoint=({agent.obs_dim},{agent.n_actions}) "
                f"env=({obs_dim},{n_actions})"
            )
    else:
        agent = DQNAgent(
            obs_dim=obs_dim,
            n_actions=n_actions,
            device=device,
            hidden_dim=cfg.hidden_dim,
            hyperparams=DQNHyperParams(gamma=0.95 if not cfg.long_horizon else 0.985, lr=cfg.learning_rate, batch_size=cfg.batch_size, tau=8e-3),
        )
    replay = ReplayBuffer(capacity=cfg.buffer_capacity)
    expert = ReplayBuffer(capacity=cfg.buffer_capacity)

    for _ in range(cfg.teacher_warmup_episodes):
        obs, _ = env.reset()
        for _step in range(max(1, cfg.max_steps_per_episode if cfg.long_horizon else 1)):
            action = board_teacher_action(env.scenario)
            next_obs, reward, terminated, truncated, _info = env.step(action)
            done = terminated or truncated
            replay.add(obs, action, reward, next_obs, done, next_action_mask=env.legal_action_mask())
            expert.add(obs, action, reward, next_obs, done, next_action_mask=env.legal_action_mask())
            obs = next_obs
            if done:
                break
    add_board_fixture_examples(env, replay, expert, cfg.fixture_replay_copies)

    imitation_loss = 0.0
    imitation_accuracy = 0.0
    for _ in range(max(0, cfg.imitation_pretrain_steps)):
        imitation_loss, imitation_accuracy = agent.imitation_update(
            expert.sample(cfg.batch_size),
            loss_weight=cfg.imitation_loss_weight,
        )
    print(
        f"[Board teacher] family={cfg.family} tier={cfg.tier} "
        f"expert={len(expert)} bc_loss={imitation_loss:.5f} bc_acc={imitation_accuracy:.3f}"
    )

    rewards = []
    loss = 0.0
    mean_q = 0.0
    for episode in range(1, cfg.total_episodes + 1):
        obs, _ = env.reset()
        total_reward = 0.0
        epsilon = linear_epsilon_decay(episode, cfg.epsilon_start, cfg.epsilon_end, cfg.epsilon_decay_episodes)
        for _step in range(max(1, cfg.max_steps_per_episode if cfg.long_horizon else 1)):
            action = agent.act(obs, epsilon, action_mask=env.legal_action_mask())
            next_obs, reward, terminated, truncated, _info = env.step(action)
            done = terminated or truncated
            replay.add(obs, action, reward, next_obs, done, next_action_mask=env.legal_action_mask())
            obs = next_obs
            total_reward += float(reward)
            if episode >= cfg.warmup_steps and len(replay) >= cfg.batch_size and episode % cfg.train_every_steps == 0:
                loss, mean_q = agent.update(replay.sample(cfg.batch_size))
                expert_batch_size = int(round(cfg.batch_size * cfg.expert_replay_ratio))
                if expert_batch_size > 0:
                    imitation_loss, imitation_accuracy = agent.imitation_update(
                        expert.sample(expert_batch_size),
                        loss_weight=cfg.imitation_loss_weight,
                    )
            if done:
                break
        rewards.append(total_reward)
        if cfg.log_interval > 0 and episode % cfg.log_interval == 0:
            recent = rewards[-cfg.log_interval :]
            print(
                f"[Board {cfg.family}/{cfg.tier} {episode:5d}] "
                f"avg_reward={sum(recent) / len(recent):7.3f} epsilon={epsilon:5.3f} "
                f"loss={loss:8.5f} mean_q={mean_q:7.3f} bc_acc={imitation_accuracy:5.3f}"
            )
        if cfg.save_interval > 0 and episode % cfg.save_interval == 0:
            checkpoint = output_dir / f"{cfg.family}_{cfg.tier}_board_dqn_{episode:06d}_{time.strftime('%Y%m%d-%H%M%S')}.pt"
            agent.save(str(checkpoint))
            print(f"Saved model to {checkpoint}")

    latest = output_dir / f"{cfg.family}_{cfg.tier}_board_dqn_latest.pt"
    agent.save(str(latest))
    summary = {
        "family": cfg.family,
        "tier": cfg.tier,
        "episodes": int(cfg.total_episodes),
        "long_horizon": bool(cfg.long_horizon),
        "max_steps_per_episode": int(cfg.max_steps_per_episode),
        "avg_reward_last_100": float(sum(rewards[-100:]) / max(1, len(rewards[-100:]))),
        "checkpoint": str(latest),
        "obs_dim": int(obs_dim),
        "n_actions": int(n_actions),
    }
    summary_path = output_dir / f"{cfg.family}_{cfg.tier}_board_dqn_latest_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8")
    print(f"Saved latest model to {latest}")
    print(f"Saved summary to {summary_path}")
    return summary


def parse_args():
    parser = argparse.ArgumentParser(description="Train board-game betting DQN checkpoint.")
    parser.add_argument("--family", choices=BOARD_VARIANTS, default=BoardTrainConfig.family)
    parser.add_argument("--tier", choices=BOARD_TIERS, default=BoardTrainConfig.tier)
    parser.add_argument("--episodes", type=int, default=BoardTrainConfig.total_episodes)
    parser.add_argument("--max-steps", type=int, default=BoardTrainConfig.max_steps_per_episode)
    parser.add_argument("--long-horizon", action="store_true")
    parser.add_argument("--warmup-steps", type=int, default=BoardTrainConfig.warmup_steps)
    parser.add_argument("--batch-size", type=int, default=BoardTrainConfig.batch_size)
    parser.add_argument("--teacher-warmup-episodes", type=int, default=BoardTrainConfig.teacher_warmup_episodes)
    parser.add_argument("--imitation-pretrain-steps", type=int, default=BoardTrainConfig.imitation_pretrain_steps)
    parser.add_argument("--expert-replay-ratio", type=float, default=BoardTrainConfig.expert_replay_ratio)
    parser.add_argument("--fixture-replay-copies", type=int, default=BoardTrainConfig.fixture_replay_copies)
    parser.add_argument("--output-dir", default=BoardTrainConfig.output_dir)
    parser.add_argument("--save-interval", type=int, default=BoardTrainConfig.save_interval)
    parser.add_argument("--log-interval", type=int, default=BoardTrainConfig.log_interval)
    parser.add_argument("--resume-checkpoint", default=None)
    parser.add_argument("--device", default=None)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    cfg = BoardTrainConfig(
        family=args.family,
        tier=args.tier,
        total_episodes=args.episodes,
        max_steps_per_episode=args.max_steps,
        long_horizon=args.long_horizon,
        warmup_steps=args.warmup_steps,
        batch_size=args.batch_size,
        teacher_warmup_episodes=args.teacher_warmup_episodes,
        imitation_pretrain_steps=args.imitation_pretrain_steps,
        expert_replay_ratio=args.expert_replay_ratio,
        fixture_replay_copies=args.fixture_replay_copies,
        output_dir=args.output_dir,
        save_interval=args.save_interval,
        log_interval=args.log_interval,
        resume_checkpoint=args.resume_checkpoint,
    )
    print(f"Using device: {device}")
    train_board_dqn(cfg=cfg, device=device)
