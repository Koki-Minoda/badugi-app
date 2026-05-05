"""Train DQN checkpoints for 2-7 and A-5 draw lowball policies."""

from __future__ import annotations

import argparse
import json
import os
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
from rl.env.draw_lowball_env import DrawLowballEnv, draw_teacher_action
from rl.utils.replay_buffer import ReplayBuffer


@dataclass
class DrawTrainConfig:
    family: str = "low-27"
    total_episodes: int = 10_000
    max_steps_per_episode: int = 80
    buffer_capacity: int = 120_000
    warmup_steps: int = 2_000
    batch_size: int = 64
    epsilon_start: float = 0.8
    epsilon_end: float = 0.06
    epsilon_decay_episodes: int = 8_000
    teacher_warmup_episodes: int = 1_000
    imitation_pretrain_steps: int = 300
    expert_replay_ratio: float = 0.35
    imitation_loss_weight: float = 0.65
    output_dir: str = "rl/models/draw"
    hidden_dim: int = 192
    learning_rate: float = 1e-4
    train_every_steps: int = 3
    save_interval: int = 5_000
    log_interval: int = 500
    opponent_profiles: tuple[str, ...] = ("beginner", "standard", "tight", "loose", "aggressive")
    max_draws: int = 3
    fixture_replay_copies: int = 80


def _card(rank: int, suit: int):
    return (rank, suit)


def add_draw_fixture_examples(env: DrawLowballEnv, replay: ReplayBuffer, expert: ReplayBuffer, copies: int):
    if copies <= 0:
        return
    fixtures = []
    if env.family == "low-27":
        fixtures = [
            ([_card(7, 0), _card(5, 1), _card(4, 2), _card(3, 3), _card(2, 0)], 5),
            ([_card(13, 0), _card(13, 1), _card(8, 2), _card(5, 3), _card(2, 0)], 6),
            ([_card(7, 0), _card(6, 1), _card(5, 2), _card(4, 3), _card(3, 0)], 6),
            ([_card(9, 0), _card(8, 0), _card(6, 0), _card(4, 0), _card(2, 0)], 6),
        ]
    else:
        fixtures = [
            ([_card(14, 0), _card(2, 0), _card(3, 0), _card(4, 0), _card(5, 0)], 5),
            ([_card(14, 0), _card(14, 1), _card(6, 2), _card(4, 3), _card(2, 0)], 6),
            ([_card(12, 0), _card(9, 1), _card(7, 2), _card(4, 3), _card(2, 0)], 6),
        ]
    for _ in range(copies):
        for hand, action in fixtures:
            env.reset()
            env.phase = "DRAW"
            env.hero_hand = list(hand)
            obs = env._observation()
            next_obs = obs.copy()
            replay.add(obs, action, 0.2, next_obs, False, next_action_mask=env.legal_action_mask())
            expert.add(obs, action, 0.2, next_obs, False, next_action_mask=env.legal_action_mask())
        for obs, action in _synthetic_gate_vectors(env.family):
            mask = np.zeros(11, dtype=np.float32)
            mask[5:] = 1.0
            replay.add(obs, action, 0.25, obs, False, next_action_mask=mask)
            expert.add(obs, action, 0.25, obs, False, next_action_mask=mask)


def _synthetic_gate_vectors(family: str):
    def vector(
        *,
        made_cards: int,
        highest_rank: int,
        rank_sum: int,
        duplicate_ranks: int = 0,
        duplicate_suits: int = 0,
        straight: bool = False,
        flush: bool = False,
    ):
        obs = np.zeros(96, dtype=np.float32)
        obs[2] = 1.0
        obs[15] = made_cards / 5.0
        obs[16] = highest_rank / 14.0
        obs[17] = rank_sum / 70.0
        obs[18] = duplicate_ranks / 4.0
        obs[19] = duplicate_suits / 4.0
        obs[20] = 1.0 if straight else 0.0
        obs[21] = 1.0 if flush else 0.0
        obs[22] = 1.0
        obs[41] = 1.0 if family == "low-27" else 0.0
        obs[42] = 1.0 if family == "low-a5" else 0.0
        obs[53:59] = 1.0
        return obs

    if family == "low-27":
        return [
            (vector(made_cards=5, highest_rank=7, rank_sum=21), 5),
            (vector(made_cards=3, highest_rank=13, rank_sum=38, duplicate_ranks=1), 6),
            (vector(made_cards=4, highest_rank=7, rank_sum=25, straight=True), 6),
        ]
    return [
        (vector(made_cards=5, highest_rank=5, rank_sum=15, straight=True), 5),
        (vector(made_cards=5, highest_rank=5, rank_sum=15, straight=True, flush=True), 5),
        (vector(made_cards=3, highest_rank=12, rank_sum=34, duplicate_ranks=1), 6),
    ]


def linear_epsilon_decay(episode: int, start_eps: float, end_eps: float, decay_episodes: int) -> float:
    if episode >= decay_episodes:
        return end_eps
    frac = episode / float(decay_episodes)
    return start_eps + frac * (end_eps - start_eps)


def train_draw_dqn(cfg: DrawTrainConfig | None = None, device: str | torch.device = "cpu"):
    cfg = cfg or DrawTrainConfig()
    output_dir = Path(cfg.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    env = DrawLowballEnv(family=cfg.family, opponent_profile=cfg.opponent_profiles[0], max_draws=cfg.max_draws)
    obs, _ = env.reset()
    obs_dim = int(np.prod(env.observation_space.shape))
    n_actions = env.action_space.n
    agent = DQNAgent(
        obs_dim=obs_dim,
        n_actions=n_actions,
        device=device,
        hidden_dim=cfg.hidden_dim,
        hyperparams=DQNHyperParams(gamma=0.985, lr=cfg.learning_rate, batch_size=cfg.batch_size, tau=5e-3),
    )
    replay = ReplayBuffer(capacity=cfg.buffer_capacity)
    expert = ReplayBuffer(capacity=cfg.buffer_capacity)
    global_step = 0
    rewards: list[float] = []
    imitation_loss = 0.0
    imitation_accuracy = 0.0

    for episode in range(1, cfg.teacher_warmup_episodes + 1):
        env.set_opponent_profile(cfg.opponent_profiles[(episode - 1) % len(cfg.opponent_profiles)])
        obs, _ = env.reset()
        for _ in range(cfg.max_steps_per_episode):
            action = draw_teacher_action(env)
            next_obs, reward, terminated, truncated, _info = env.step(action)
            done = terminated or truncated
            item = (obs, action, reward, next_obs, done, env.legal_action_mask())
            replay.add(*item[:-1], next_action_mask=item[-1])
            expert.add(*item[:-1], next_action_mask=item[-1])
            obs = next_obs
            if done:
                break
    add_draw_fixture_examples(env, replay, expert, cfg.fixture_replay_copies)
    if cfg.imitation_pretrain_steps > 0:
        if len(expert) < cfg.batch_size:
            raise ValueError("Not enough teacher samples for imitation pretrain")
        for _ in range(cfg.imitation_pretrain_steps):
            imitation_loss, imitation_accuracy = agent.imitation_update(
                expert.sample(cfg.batch_size),
                loss_weight=cfg.imitation_loss_weight,
            )
    print(
        "[Draw teacher] "
        f"family={cfg.family} teacher_episodes={cfg.teacher_warmup_episodes} "
        f"expert={len(expert)} bc_loss={imitation_loss:.5f} bc_acc={imitation_accuracy:.3f}"
    )

    loss = 0.0
    mean_q = 0.0
    for episode in range(1, cfg.total_episodes + 1):
        env.set_opponent_profile(cfg.opponent_profiles[(episode - 1) % len(cfg.opponent_profiles)])
        obs, _ = env.reset()
        total_reward = 0.0
        epsilon = linear_epsilon_decay(episode, cfg.epsilon_start, cfg.epsilon_end, cfg.epsilon_decay_episodes)
        for _ in range(cfg.max_steps_per_episode):
            global_step += 1
            action = agent.act(obs, epsilon, action_mask=env.legal_action_mask())
            next_obs, reward, terminated, truncated, _info = env.step(action)
            done = terminated or truncated
            replay.add(obs, action, reward, next_obs, done, next_action_mask=env.legal_action_mask())
            obs = next_obs
            total_reward += float(reward)
            if (
                global_step >= cfg.warmup_steps
                and len(replay) >= cfg.batch_size
                and global_step % max(1, cfg.train_every_steps) == 0
            ):
                loss, mean_q = agent.update(replay.sample(cfg.batch_size))
                expert_batch_size = int(round(cfg.batch_size * cfg.expert_replay_ratio))
                if expert_batch_size > 0 and len(expert) >= expert_batch_size:
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
                f"[Draw {cfg.family} {episode:6d}] "
                f"avg_reward={sum(recent) / len(recent):8.3f} epsilon={epsilon:5.3f} "
                f"buffer={len(replay):7d} loss={loss:8.5f} mean_q={mean_q:8.3f} "
                f"bc_acc={imitation_accuracy:5.3f}"
            )
        if cfg.save_interval > 0 and episode % cfg.save_interval == 0:
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            checkpoint = output_dir / f"{cfg.family}_draw_dqn_{episode:06d}_{timestamp}.pt"
            agent.save(str(checkpoint))
            print(f"Saved model to {checkpoint}")

    latest = output_dir / f"{cfg.family}_draw_dqn_latest.pt"
    agent.save(str(latest))
    summary = {
        "family": cfg.family,
        "episodes": int(cfg.total_episodes),
        "global_steps": int(global_step),
        "avg_reward_last_100": float(sum(rewards[-100:]) / max(1, len(rewards[-100:]))),
        "opponent_profiles": list(cfg.opponent_profiles),
        "teacher_warmup_episodes": int(cfg.teacher_warmup_episodes),
        "imitation_pretrain_steps": int(cfg.imitation_pretrain_steps),
        "checkpoint": str(latest),
        "obs_dim": int(obs_dim),
        "n_actions": int(n_actions),
        "max_draws": int(cfg.max_draws),
    }
    summary_path = output_dir / f"{cfg.family}_draw_dqn_latest_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8")
    print(f"Saved latest model to {latest}")
    print(f"Saved summary to {summary_path}")
    return summary


def parse_args():
    parser = argparse.ArgumentParser(description="Train a 2-7/A-5 draw DQN checkpoint.")
    parser.add_argument("--family", choices=["low-27", "low-a5"], default=DrawTrainConfig.family)
    parser.add_argument("--episodes", type=int, default=DrawTrainConfig.total_episodes)
    parser.add_argument("--max-steps", type=int, default=DrawTrainConfig.max_steps_per_episode)
    parser.add_argument("--buffer-capacity", type=int, default=DrawTrainConfig.buffer_capacity)
    parser.add_argument("--warmup-steps", type=int, default=DrawTrainConfig.warmup_steps)
    parser.add_argument("--batch-size", type=int, default=DrawTrainConfig.batch_size)
    parser.add_argument("--teacher-warmup-episodes", type=int, default=DrawTrainConfig.teacher_warmup_episodes)
    parser.add_argument("--imitation-pretrain-steps", type=int, default=DrawTrainConfig.imitation_pretrain_steps)
    parser.add_argument("--expert-replay-ratio", type=float, default=DrawTrainConfig.expert_replay_ratio)
    parser.add_argument("--output-dir", default=DrawTrainConfig.output_dir)
    parser.add_argument("--save-interval", type=int, default=DrawTrainConfig.save_interval)
    parser.add_argument("--log-interval", type=int, default=DrawTrainConfig.log_interval)
    parser.add_argument("--max-draws", type=int, default=DrawTrainConfig.max_draws)
    parser.add_argument("--fixture-replay-copies", type=int, default=DrawTrainConfig.fixture_replay_copies)
    parser.add_argument("--opponent-profiles", default=",".join(DrawTrainConfig.opponent_profiles))
    parser.add_argument("--device", default=None)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    cfg = DrawTrainConfig(
        family=args.family,
        total_episodes=args.episodes,
        max_steps_per_episode=args.max_steps,
        buffer_capacity=args.buffer_capacity,
        warmup_steps=args.warmup_steps,
        batch_size=args.batch_size,
        teacher_warmup_episodes=args.teacher_warmup_episodes,
        imitation_pretrain_steps=args.imitation_pretrain_steps,
        expert_replay_ratio=args.expert_replay_ratio,
        output_dir=args.output_dir,
        save_interval=args.save_interval,
        log_interval=args.log_interval,
        max_draws=args.max_draws,
        fixture_replay_copies=args.fixture_replay_copies,
        opponent_profiles=tuple(item.strip() for item in args.opponent_profiles.split(",") if item.strip()),
    )
    print(f"Using device: {device}")
    train_draw_dqn(cfg=cfg, device=device)
