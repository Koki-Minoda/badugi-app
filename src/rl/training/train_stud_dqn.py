"""Train bootstrap DQNs for Stud-family betting variants."""

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
from rl.env.stud_betting_env import (
    STUD_TIERS,
    STUD_VARIANTS,
    StudBettingEnv,
    stud_teacher_action,
)
from rl.utils.replay_buffer import ReplayBuffer


@dataclass
class StudTrainConfig:
    family: str = "stud"
    tier: str = "beginner"
    total_episodes: int = 2_000
    buffer_capacity: int = 60_000
    warmup_steps: int = 300
    batch_size: int = 64
    epsilon_start: float = 0.65
    epsilon_end: float = 0.05
    epsilon_decay_episodes: int = 1_800
    teacher_warmup_episodes: int = 600
    imitation_pretrain_steps: int = 160
    expert_replay_ratio: float = 0.5
    imitation_loss_weight: float = 0.75
    output_dir: str = "rl/models/stud"
    hidden_dim: int = 128
    learning_rate: float = 1e-4
    train_every_steps: int = 2
    save_interval: int = 0
    log_interval: int = 500
    fixture_replay_copies: int = 100
    resume_checkpoint: str | None = None


def linear_epsilon_decay(episode: int, start_eps: float, end_eps: float, decay_episodes: int) -> float:
    if episode >= decay_episodes:
        return end_eps
    return start_eps + (episode / float(decay_episodes)) * (end_eps - start_eps)


def add_stud_fixture_examples(env: StudBettingEnv, replay: ReplayBuffer, expert: ReplayBuffer, copies: int):
    for _ in range(max(0, copies)):
        for fixture in [
            # Strong made hands value bet and raise.
            {"made": 0.9, "draw": 0.18, "low": 0.15, "high": 0.9, "to_call": 0.0, "street": 0.75, "expected": 3},
            {"made": 0.82, "draw": 0.16, "low": 0.2, "high": 0.82, "to_call": 0.12, "street": 0.75, "expected": 4},
            # Weak hands facing pressure fold.
            {"made": 0.18, "draw": 0.08, "low": 0.2, "high": 0.18, "to_call": 0.22, "street": 0.5, "expected": 0},
            # Pot-odds continue with medium equity.
            {"made": 0.46, "draw": 0.55, "low": 0.45, "high": 0.46, "to_call": 0.06, "street": 0.25, "expected": 2},
            # Razz low strength should continue/value bet.
            {"made": 0.76, "draw": 0.42, "low": 0.86, "high": 0.2, "to_call": 0.0, "street": 0.5, "expected": 3},
            {"made": 0.72, "draw": 0.36, "low": 0.82, "high": 0.2, "to_call": 0.12, "street": 0.75, "expected": 4},
            # Stud8 scoop-capable hands play aggressively; one-way weak hands control.
            {"made": 0.78, "draw": 0.48, "low": 0.75, "high": 0.62, "to_call": 0.0, "street": 0.5, "expected": 3},
            {"made": 0.42, "draw": 0.2, "low": 0.28, "high": 0.42, "to_call": 0.18, "street": 0.75, "expected": 0},
        ]:
            env.reset()
            env.scenario.made_strength = fixture["made"]
            env.scenario.draw_equity = fixture["draw"]
            env.scenario.low_potential = fixture["low"]
            env.scenario.high_potential = fixture["high"]
            env.scenario.to_call = fixture["to_call"]
            env.scenario.street_progress = fixture["street"]
            env.scenario.raise_count = 0
            obs = env._observation()
            action = fixture["expected"]
            if env.legal_action_mask()[action] <= 0:
                action = stud_teacher_action(env.scenario)
            replay.add(obs, action, 0.4, obs, False, next_action_mask=env.legal_action_mask())
            expert.add(obs, action, 0.4, obs, False, next_action_mask=env.legal_action_mask())


def train_stud_dqn(cfg: StudTrainConfig | None = None, device: str | torch.device = "cpu"):
    cfg = cfg or StudTrainConfig()
    output_dir = Path(cfg.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    env = StudBettingEnv(family=cfg.family, tier=cfg.tier)
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
            hyperparams=DQNHyperParams(gamma=0.92, lr=cfg.learning_rate, batch_size=cfg.batch_size, tau=8e-3),
        )
    replay = ReplayBuffer(capacity=cfg.buffer_capacity)
    expert = ReplayBuffer(capacity=cfg.buffer_capacity)

    for _ in range(cfg.teacher_warmup_episodes):
        obs, _ = env.reset()
        action = stud_teacher_action(env.scenario)
        next_obs, reward, terminated, truncated, _info = env.step(action)
        done = terminated or truncated
        replay.add(obs, action, reward, next_obs, done, next_action_mask=env.legal_action_mask())
        expert.add(obs, action, reward, next_obs, done, next_action_mask=env.legal_action_mask())
    add_stud_fixture_examples(env, replay, expert, cfg.fixture_replay_copies)

    imitation_loss = 0.0
    imitation_accuracy = 0.0
    for _ in range(max(0, cfg.imitation_pretrain_steps)):
        imitation_loss, imitation_accuracy = agent.imitation_update(
            expert.sample(cfg.batch_size),
            loss_weight=cfg.imitation_loss_weight,
        )
    print(
        f"[Stud teacher] family={cfg.family} tier={cfg.tier} "
        f"expert={len(expert)} bc_loss={imitation_loss:.5f} bc_acc={imitation_accuracy:.3f}"
    )

    rewards = []
    loss = 0.0
    mean_q = 0.0
    for episode in range(1, cfg.total_episodes + 1):
        obs, _ = env.reset()
        epsilon = linear_epsilon_decay(episode, cfg.epsilon_start, cfg.epsilon_end, cfg.epsilon_decay_episodes)
        action = agent.act(obs, epsilon, action_mask=env.legal_action_mask())
        next_obs, reward, terminated, truncated, _info = env.step(action)
        done = terminated or truncated
        replay.add(obs, action, reward, next_obs, done, next_action_mask=env.legal_action_mask())
        rewards.append(float(reward))
        if episode >= cfg.warmup_steps and len(replay) >= cfg.batch_size and episode % cfg.train_every_steps == 0:
            loss, mean_q = agent.update(replay.sample(cfg.batch_size))
            expert_batch_size = int(round(cfg.batch_size * cfg.expert_replay_ratio))
            if expert_batch_size > 0:
                imitation_loss, imitation_accuracy = agent.imitation_update(
                    expert.sample(expert_batch_size),
                    loss_weight=cfg.imitation_loss_weight,
                )
        if cfg.log_interval > 0 and episode % cfg.log_interval == 0:
            recent = rewards[-cfg.log_interval :]
            print(
                f"[Stud {cfg.family}/{cfg.tier} {episode:5d}] "
                f"avg_reward={sum(recent) / len(recent):7.3f} epsilon={epsilon:5.3f} "
                f"loss={loss:8.5f} mean_q={mean_q:7.3f} bc_acc={imitation_accuracy:5.3f}"
            )
        if cfg.save_interval > 0 and episode % cfg.save_interval == 0:
            checkpoint = output_dir / f"{cfg.family}_{cfg.tier}_stud_dqn_{episode:06d}_{time.strftime('%Y%m%d-%H%M%S')}.pt"
            agent.save(str(checkpoint))
            print(f"Saved model to {checkpoint}")

    latest = output_dir / f"{cfg.family}_{cfg.tier}_stud_dqn_latest.pt"
    agent.save(str(latest))
    summary = {
        "family": cfg.family,
        "tier": cfg.tier,
        "episodes": int(cfg.total_episodes),
        "avg_reward_last_100": float(sum(rewards[-100:]) / max(1, len(rewards[-100:]))),
        "checkpoint": str(latest),
        "obs_dim": int(obs_dim),
        "n_actions": int(n_actions),
        "trainingStatus": "bootstrap",
    }
    summary_path = output_dir / f"{cfg.family}_{cfg.tier}_stud_dqn_latest_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8")
    print(f"Saved latest model to {latest}")
    print(f"Saved summary to {summary_path}")
    return summary


def parse_args():
    parser = argparse.ArgumentParser(description="Train Stud-family betting DQN checkpoint.")
    parser.add_argument("--family", choices=STUD_VARIANTS, default=StudTrainConfig.family)
    parser.add_argument("--tier", choices=STUD_TIERS, default=StudTrainConfig.tier)
    parser.add_argument("--episodes", type=int, default=StudTrainConfig.total_episodes)
    parser.add_argument("--warmup-steps", type=int, default=StudTrainConfig.warmup_steps)
    parser.add_argument("--batch-size", type=int, default=StudTrainConfig.batch_size)
    parser.add_argument("--teacher-warmup-episodes", type=int, default=StudTrainConfig.teacher_warmup_episodes)
    parser.add_argument("--imitation-pretrain-steps", type=int, default=StudTrainConfig.imitation_pretrain_steps)
    parser.add_argument("--expert-replay-ratio", type=float, default=StudTrainConfig.expert_replay_ratio)
    parser.add_argument("--fixture-replay-copies", type=int, default=StudTrainConfig.fixture_replay_copies)
    parser.add_argument("--output-dir", default=StudTrainConfig.output_dir)
    parser.add_argument("--save-interval", type=int, default=StudTrainConfig.save_interval)
    parser.add_argument("--log-interval", type=int, default=StudTrainConfig.log_interval)
    parser.add_argument("--resume-checkpoint", default=None)
    parser.add_argument("--device", default=None)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    cfg = StudTrainConfig(
        family=args.family,
        tier=args.tier,
        total_episodes=args.episodes,
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
    train_stud_dqn(cfg=cfg, device=device)
