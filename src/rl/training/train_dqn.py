import argparse
import json
import os
import sys
import time
from pathlib import Path
from dataclasses import dataclass

import numpy as np
import torch

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.utils.replay_buffer import ReplayBuffer
from rl.env.badugi_env import BadugiEnv


@dataclass
class TrainConfig:
    total_episodes: int = 50_000
    max_steps_per_episode: int = 200
    buffer_capacity: int = 200_000
    warmup_steps: int = 10_000
    batch_size: int = 64
    epsilon_start: float = 1.0
    epsilon_end: float = 0.05
    epsilon_decay_episodes: int = 30_000
    target_update_interval: int = 1_000  # reserved for hard update if needed
    log_interval: int = 100
    save_interval: int = 1_000
    output_dir: str = "rl/models"
    hidden_dim: int = 256
    learning_rate: float = 1e-4
    train_every_steps: int = 4


def linear_epsilon_decay(
    episode: int,
    start_eps: float,
    end_eps: float,
    decay_episodes: int,
) -> float:
    if episode >= decay_episodes:
        return end_eps
    frac = episode / float(decay_episodes)
    return start_eps + frac * (end_eps - start_eps)


def train_dqn(cfg: TrainConfig | None = None, device: str | torch.device = "cpu"):
    cfg = cfg or TrainConfig()
    os.makedirs(cfg.output_dir, exist_ok=True)

    env = BadugiEnv()
    obs, _ = env.reset()

    obs_dim = int(np.prod(env.observation_space.shape))
    n_actions = env.action_space.n

    hyper = DQNHyperParams(
        gamma=0.99,
        lr=cfg.learning_rate,
        batch_size=cfg.batch_size,
        tau=5e-3,
    )
    agent = DQNAgent(
        obs_dim=obs_dim,
        n_actions=n_actions,
        device=device,
        hidden_dim=cfg.hidden_dim,
        hyperparams=hyper,
    )
    replay_buffer = ReplayBuffer(capacity=cfg.buffer_capacity)

    global_step = 0
    episode_rewards = []

    for episode in range(1, cfg.total_episodes + 1):
        obs, _ = env.reset()
        episode_reward = 0.0

        epsilon = linear_epsilon_decay(
            episode=episode,
            start_eps=cfg.epsilon_start,
            end_eps=cfg.epsilon_end,
            decay_episodes=cfg.epsilon_decay_episodes,
        )

        loss, mean_q = 0.0, 0.0

        for step in range(cfg.max_steps_per_episode):
            global_step += 1

            action = agent.act(obs, epsilon)
            next_obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated

            replay_buffer.add(obs, action, reward, next_obs, done)
            obs = next_obs
            episode_reward += float(reward)

            if (
                global_step >= cfg.warmup_steps
                and len(replay_buffer) >= hyper.batch_size
                and global_step % max(1, cfg.train_every_steps) == 0
            ):
                batch = replay_buffer.sample(hyper.batch_size)
                loss, mean_q = agent.update(batch)

            if done:
                break

        episode_rewards.append(episode_reward)

        if cfg.log_interval > 0 and episode % cfg.log_interval == 0:
            recent_rewards = episode_rewards[-cfg.log_interval :]
            avg_reward = sum(recent_rewards) / len(recent_rewards)
            print(
                f"[Episode {episode:6d}] "
                f"avg_reward={avg_reward:8.3f} "
                f"epsilon={epsilon:5.3f} "
                f"buffer={len(replay_buffer):7d} "
                f"loss={loss:8.5f} "
                f"mean_q={mean_q:8.3f}"
            )

        if cfg.save_interval > 0 and episode % cfg.save_interval == 0:
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            model_path = os.path.join(
                cfg.output_dir, f"badugi_dqn_{episode:06d}_{timestamp}.pt"
            )
            agent.save(model_path)
            print(f"Saved model to {model_path}")

    final_path = os.path.join(cfg.output_dir, "badugi_dqn_latest.pt")
    agent.save(final_path)
    summary = {
        "episodes": cfg.total_episodes,
        "global_steps": int(global_step),
        "obs_dim": int(obs_dim),
        "n_actions": int(n_actions),
        "avg_reward_last_100": (
            sum(episode_rewards[-100:]) / max(1, len(episode_rewards[-100:]))
            if episode_rewards
            else 0.0
        ),
        "checkpoint": final_path,
    }
    summary_path = os.path.join(cfg.output_dir, "badugi_dqn_latest_summary.json")
    Path(summary_path).write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8")
    print(f"Saved latest model to {final_path}")
    print(f"Saved summary to {summary_path}")
    env.close()
    return summary


def parse_args():
    parser = argparse.ArgumentParser(description="Train a Badugi DQN checkpoint.")
    parser.add_argument("--episodes", type=int, default=TrainConfig.total_episodes)
    parser.add_argument("--max-steps", type=int, default=TrainConfig.max_steps_per_episode)
    parser.add_argument("--buffer-capacity", type=int, default=TrainConfig.buffer_capacity)
    parser.add_argument("--warmup-steps", type=int, default=TrainConfig.warmup_steps)
    parser.add_argument("--batch-size", type=int, default=TrainConfig.batch_size)
    parser.add_argument("--epsilon-start", type=float, default=TrainConfig.epsilon_start)
    parser.add_argument("--epsilon-end", type=float, default=TrainConfig.epsilon_end)
    parser.add_argument("--epsilon-decay-episodes", type=int, default=TrainConfig.epsilon_decay_episodes)
    parser.add_argument("--log-interval", type=int, default=TrainConfig.log_interval)
    parser.add_argument("--save-interval", type=int, default=TrainConfig.save_interval)
    parser.add_argument("--output-dir", default=TrainConfig.output_dir)
    parser.add_argument("--hidden-dim", type=int, default=TrainConfig.hidden_dim)
    parser.add_argument("--learning-rate", type=float, default=TrainConfig.learning_rate)
    parser.add_argument("--train-every-steps", type=int, default=TrainConfig.train_every_steps)
    parser.add_argument("--device", default=None)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    cfg = TrainConfig(
        total_episodes=args.episodes,
        max_steps_per_episode=args.max_steps,
        buffer_capacity=args.buffer_capacity,
        warmup_steps=args.warmup_steps,
        batch_size=args.batch_size,
        epsilon_start=args.epsilon_start,
        epsilon_end=args.epsilon_end,
        epsilon_decay_episodes=args.epsilon_decay_episodes,
        log_interval=args.log_interval,
        save_interval=args.save_interval,
        output_dir=args.output_dir,
        hidden_dim=args.hidden_dim,
        learning_rate=args.learning_rate,
        train_every_steps=args.train_every_steps,
    )
    print(f"Using device: {device}")
    train_dqn(cfg=cfg, device=device)
