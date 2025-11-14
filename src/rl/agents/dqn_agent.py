import random
from dataclasses import dataclass
from typing import Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim


class QNetwork(nn.Module):
    """Simple MLP for DQN."""

    def __init__(self, obs_dim: int, n_actions: int, hidden_dim: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(obs_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, n_actions),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


@dataclass
class DQNHyperParams:
    gamma: float = 0.99
    lr: float = 1e-3
    batch_size: int = 64
    tau: float = 1e-2  # soft update coefficient


class DQNAgent:
    def __init__(
        self,
        obs_dim: int,
        n_actions: int,
        device: torch.device | str = "cpu",
        hidden_dim: int = 256,
        hyperparams: DQNHyperParams | None = None,
    ):
        self.device = torch.device(device)
        self.obs_dim = obs_dim
        self.n_actions = n_actions

        self.hyper = hyperparams or DQNHyperParams()

        self.q_network = QNetwork(obs_dim, n_actions, hidden_dim).to(self.device)
        self.target_network = QNetwork(obs_dim, n_actions, hidden_dim).to(self.device)
        self.target_network.load_state_dict(self.q_network.state_dict())
        self.target_network.eval()

        self.optimizer = optim.Adam(self.q_network.parameters(), lr=self.hyper.lr)
        self.loss_fn = nn.MSELoss()

        self.train_steps = 0

    @torch.no_grad()
    def act(self, obs: np.ndarray, epsilon: float) -> int:
        """Epsilon-greedy action selection."""
        if random.random() < epsilon:
            return random.randrange(self.n_actions)

        obs_t = torch.as_tensor(
            obs, dtype=torch.float32, device=self.device
        ).unsqueeze(0)
        q_values = self.q_network(obs_t)
        action = int(torch.argmax(q_values, dim=1).item())
        return action

    def _soft_update_target(self):
        """Soft update of target network."""
        tau = self.hyper.tau
        for target_param, param in zip(
            self.target_network.parameters(), self.q_network.parameters()
        ):
            target_param.data.copy_(
                tau * param.data + (1.0 - tau) * target_param.data
            )

    def update(self, batch) -> Tuple[float, float]:
        """Perform one gradient step given a batch from replay buffer.

        batch: dict with keys 'obs', 'actions', 'rewards', 'next_obs', 'dones'
        Returns:
            loss_value, mean_q_value
        """
        obs = torch.as_tensor(batch["obs"], dtype=torch.float32, device=self.device)
        actions = torch.as_tensor(
            batch["actions"], dtype=torch.int64, device=self.device
        ).unsqueeze(-1)
        rewards = torch.as_tensor(
            batch["rewards"], dtype=torch.float32, device=self.device
        ).unsqueeze(-1)
        next_obs = torch.as_tensor(
            batch["next_obs"], dtype=torch.float32, device=self.device
        )
        dones = torch.as_tensor(
            batch["dones"], dtype=torch.float32, device=self.device
        ).unsqueeze(-1)

        # Current Q estimates
        q_values = self.q_network(obs).gather(1, actions)

        with torch.no_grad():
            # Double DQN style: action from online net, value from target net
            next_q_online = self.q_network(next_obs)
            next_actions = torch.argmax(next_q_online, dim=1, keepdim=True)
            next_q_target = self.target_network(next_obs).gather(1, next_actions)
            target_q = rewards + self.hyper.gamma * (1.0 - dones) * next_q_target

        loss = self.loss_fn(q_values, target_q)

        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.q_network.parameters(), max_norm=5.0)
        self.optimizer.step()

        self._soft_update_target()
        self.train_steps += 1

        with torch.no_grad():
            mean_q = q_values.mean().item()

        return float(loss.item()), float(mean_q)

    def save(self, path: str):
        payload = {
            "q_network": self.q_network.state_dict(),
            "target_network": self.target_network.state_dict(),
            "hyper": self.hyper.__dict__,
            "obs_dim": self.obs_dim,
            "n_actions": self.n_actions,
        }
        torch.save(payload, path)

    @classmethod
    def load(cls, path: str, device: torch.device | str = "cpu") -> "DQNAgent":
        payload = torch.load(path, map_location=device)
        hyper = DQNHyperParams(**payload.get("hyper", {}))
        agent = cls(
            obs_dim=payload["obs_dim"],
            n_actions=payload["n_actions"],
            device=device,
            hyperparams=hyper,
        )
        agent.q_network.load_state_dict(payload["q_network"])
        agent.target_network.load_state_dict(payload["target_network"])
        return agent
