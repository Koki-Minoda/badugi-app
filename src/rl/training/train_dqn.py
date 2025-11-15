import os
import time
from dataclasses import dataclass

import numpy as np
import torch

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


def train_dqn(device: str | torch.device = "cpu"):
    cfg = TrainConfig()
    os.makedirs(cfg.output_dir, exist_ok=True)

    env = BadugiEnv()
    obs, _ = env.reset()

    obs_dim = int(np.prod(env.observation_space.shape))
    n_actions = env.action_space.n

    hyper = DQNHyperParams(
        gamma=0.99,
        lr=1e-4,
        batch_size=cfg.batch_size,
        tau=5e-3,
    )
    agent = DQNAgent(
        obs_dim=obs_dim,
        n_actions=n_actions,
        device=device,
        hidden_dim=256,
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
            ):
                batch = replay_buffer.sample(hyper.batch_size)
                loss, mean_q = agent.update(batch)

            if done:
                break

        episode_rewards.append(episode_reward)

        if episode % cfg.log_interval == 0:
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

        if episode % cfg.save_interval == 0:
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            model_path = os.path.join(
                cfg.output_dir, f"badugi_dqn_{episode:06d}_{timestamp}.pt"
            )
            agent.save(model_path)
            print(f"Saved model to {model_path}")

    env.close()


if __name__ == "__main__":
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")
    train_dqn(device=device)
