import random
from dataclasses import dataclass
from typing import Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F


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
        self.checkpoint_training_state: dict = {}
        self.checkpoint_has_optimizer = False
        self.checkpoint_rng_state: dict = {}

    @torch.no_grad()
    def act(self, obs: np.ndarray, epsilon: float, action_mask: np.ndarray | None = None) -> int:
        """Epsilon-greedy action selection."""
        legal_actions = None
        if action_mask is not None:
            legal_actions = np.flatnonzero(np.asarray(action_mask) > 0)
            if len(legal_actions) == 0:
                legal_actions = None
        if random.random() < epsilon:
            if legal_actions is not None:
                return int(random.choice(legal_actions))
            return random.randrange(self.n_actions)

        obs_t = torch.as_tensor(
            obs, dtype=torch.float32, device=self.device
        ).unsqueeze(0)
        q_values = self.q_network(obs_t)
        if action_mask is not None:
            mask_t = torch.as_tensor(
                action_mask, dtype=torch.bool, device=self.device
            ).unsqueeze(0)
            q_values = q_values.masked_fill(~mask_t, -1e9)
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

    def update(
        self,
        batch,
        weights: np.ndarray | None = None,
    ) -> Tuple[float, float, np.ndarray]:
        """Perform one gradient step given a batch from replay buffer.

        Args:
            batch: dict with keys 'obs', 'actions', 'rewards', 'next_obs', 'dones'
            weights: optional importance-sampling weights from PER (shape: [batch])

        Returns:
            (loss_value, mean_q_value, td_errors) — td_errors are used to
            update PER priorities after the step.
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
            # Double DQN: action from online net, value from target net
            next_q_online = self.q_network(next_obs)
            if "next_action_masks" in batch:
                next_masks = torch.as_tensor(
                    batch["next_action_masks"], dtype=torch.bool, device=self.device
                )
                next_q_online = next_q_online.masked_fill(~next_masks, -1e9)
            next_actions = torch.argmax(next_q_online, dim=1, keepdim=True)
            next_q_target_all = self.target_network(next_obs)
            if "next_action_masks" in batch:
                next_q_target_all = next_q_target_all.masked_fill(~next_masks, -1e9)
            next_q_target = next_q_target_all.gather(1, next_actions)
            target_q = rewards + self.hyper.gamma * (1.0 - dones) * next_q_target

        # Per-sample TD errors (for PER priority updates)
        td_errors_t = (q_values - target_q).detach()

        # Weighted loss for PER; plain MSE when weights are None
        elementwise_loss = F.mse_loss(q_values, target_q, reduction="none")
        if weights is not None:
            w_t = torch.as_tensor(weights, dtype=torch.float32, device=self.device).unsqueeze(-1)
            loss = (elementwise_loss * w_t).mean()
        else:
            loss = elementwise_loss.mean()

        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.q_network.parameters(), max_norm=5.0)
        self.optimizer.step()

        self._soft_update_target()
        self.train_steps += 1

        with torch.no_grad():
            mean_q = q_values.mean().item()

        td_errors = td_errors_t.cpu().numpy().squeeze(-1)
        return float(loss.item()), float(mean_q), td_errors

    def imitation_update(self, batch, loss_weight: float = 1.0) -> Tuple[float, float]:
        """Supervised behavior-cloning step over expert state/action pairs."""
        obs = torch.as_tensor(batch["obs"], dtype=torch.float32, device=self.device)
        actions = torch.as_tensor(batch["actions"], dtype=torch.int64, device=self.device)

        logits = self.q_network(obs)
        loss = F.cross_entropy(logits, actions) * float(loss_weight)

        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.q_network.parameters(), max_norm=5.0)
        self.optimizer.step()
        self._soft_update_target()
        self.train_steps += 1

        with torch.no_grad():
            predictions = torch.argmax(logits, dim=1)
            accuracy = (predictions == actions).float().mean().item()

        return float(loss.item()), float(accuracy)

    def action_margin_update(
        self,
        batch,
        avoid_action: int = 0,
        margin: float = 0.25,
        loss_weight: float = 1.0,
    ) -> Tuple[float, float]:
        """Push expert actions above a specific bad action by a Q-value margin."""
        obs = torch.as_tensor(batch["obs"], dtype=torch.float32, device=self.device)
        preferred_actions = torch.as_tensor(
            batch["actions"], dtype=torch.int64, device=self.device
        ).unsqueeze(-1)
        avoid_actions = torch.full_like(preferred_actions, int(avoid_action))

        q_values = self.q_network(obs)
        preferred_q = q_values.gather(1, preferred_actions)
        avoid_q = q_values.gather(1, avoid_actions)
        margin_t = torch.as_tensor(float(margin), dtype=torch.float32, device=self.device)
        loss = F.relu(margin_t - (preferred_q - avoid_q)).mean() * float(loss_weight)

        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.q_network.parameters(), max_norm=5.0)
        self.optimizer.step()
        self._soft_update_target()
        self.train_steps += 1

        with torch.no_grad():
            satisfied = ((preferred_q - avoid_q) >= margin_t).float().mean().item()

        return float(loss.item()), float(satisfied)

    @staticmethod
    def _rng_state_payload() -> dict:
        numpy_state = np.random.get_state()
        payload = {
            "python": random.getstate(),
            "numpy": {
                "bit_generator": numpy_state[0],
                "state": torch.as_tensor(numpy_state[1], dtype=torch.int64),
                "position": int(numpy_state[2]),
                "has_gauss": int(numpy_state[3]),
                "cached_gaussian": float(numpy_state[4]),
            },
            "torch": torch.get_rng_state(),
        }
        if torch.cuda.is_available():
            payload["torch_cuda"] = torch.cuda.get_rng_state_all()
        return payload

    @staticmethod
    def _restore_rng_state(payload: dict | None) -> None:
        if not payload:
            return
        if payload.get("python") is not None:
            random.setstate(payload["python"])
        numpy_state = payload.get("numpy")
        if isinstance(numpy_state, dict):
            state_values = numpy_state["state"]
            if torch.is_tensor(state_values):
                state_values = state_values.cpu().numpy()
            np.random.set_state(
                (
                    numpy_state["bit_generator"],
                    np.asarray(state_values, dtype=np.uint32),
                    int(numpy_state["position"]),
                    int(numpy_state["has_gauss"]),
                    float(numpy_state["cached_gaussian"]),
                )
            )
        elif numpy_state is not None:
            # Version 2 prerelease checkpoints stored numpy's native tuple.
            np.random.set_state(numpy_state)
        if payload.get("torch") is not None:
            torch.set_rng_state(payload["torch"].cpu())
        if torch.cuda.is_available() and payload.get("torch_cuda") is not None:
            torch.cuda.set_rng_state_all(payload["torch_cuda"])

    def save(self, path: str, *, training_state: dict | None = None):
        first_layer = self.q_network.net[0]
        hidden_dim = int(first_layer.out_features) if hasattr(first_layer, "out_features") else 256
        payload = {
            "q_network": self.q_network.state_dict(),
            "target_network": self.target_network.state_dict(),
            "hyper": self.hyper.__dict__,
            "obs_dim": self.obs_dim,
            "n_actions": self.n_actions,
            "hidden_dim": hidden_dim,
            "optimizer": self.optimizer.state_dict(),
            "train_steps": int(self.train_steps),
            "rng_state": self._rng_state_payload(),
            "training_state": dict(training_state or {}),
            "checkpoint_format_version": 2,
        }
        torch.save(payload, path)

    @classmethod
    def load(
        cls,
        path: str,
        device: torch.device | str = "cpu",
        *,
        restore_training_state: bool = False,
    ) -> "DQNAgent":
        try:
            payload = torch.load(path, map_location=device, weights_only=True)
        except Exception:
            # Project-generated checkpoints include small Python metadata
            # alongside tensor weights. Only use this fallback for trusted local
            # training outputs.
            payload = torch.load(path, map_location=device, weights_only=False)
        hyper = DQNHyperParams(**payload.get("hyper", {}))
        agent = cls(
            obs_dim=payload["obs_dim"],
            n_actions=payload["n_actions"],
            device=device,
            hidden_dim=int(payload.get("hidden_dim", 256)),
            hyperparams=hyper,
        )
        agent.q_network.load_state_dict(payload["q_network"])
        agent.target_network.load_state_dict(payload["target_network"])
        agent.checkpoint_training_state = dict(payload.get("training_state", {}))
        agent.checkpoint_rng_state = dict(payload.get("rng_state", {}))
        optimizer_state = payload.get("optimizer")
        if restore_training_state and optimizer_state:
            agent.optimizer.load_state_dict(optimizer_state)
            agent.checkpoint_has_optimizer = True
        if restore_training_state:
            agent.train_steps = int(payload.get("train_steps", 0))
            cls._restore_rng_state(agent.checkpoint_rng_state)
        return agent
