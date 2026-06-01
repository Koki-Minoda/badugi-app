from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np


@dataclass
class Transition:
    obs: np.ndarray
    action: int
    reward: float
    next_obs: np.ndarray
    done: bool
    next_action_mask: np.ndarray | None = None


class ReplayBuffer:
    """Uniform or Prioritized Experience Replay buffer.

    When ``alpha > 0`` (default 0.6), sampling is proportional to |TD error|^alpha
    and importance-sampling weights are returned to correct for the bias.
    Set ``alpha=0`` for plain uniform sampling (backward-compatible behaviour).
    """

    def __init__(
        self,
        capacity: int,
        seed: int | None = None,
        alpha: float = 0.6,
        beta_start: float = 0.4,
        beta_frames: int = 50_000,
    ):
        self.capacity = int(capacity)
        self.storage: List[Transition] = []
        self.next_idx = 0
        self.alpha = float(alpha)
        self.beta_start = float(beta_start)
        self.beta_frames = int(beta_frames)
        self._frame = 0
        # Priority array — slot i corresponds to storage[i].
        self._priorities = np.zeros(self.capacity, dtype=np.float32)
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)

    def __len__(self) -> int:
        return len(self.storage)

    def add(
        self,
        obs,
        action: int,
        reward: float,
        next_obs,
        done: bool,
        next_action_mask=None,
    ):
        transition = Transition(
            obs=np.array(obs, copy=True),
            action=int(action),
            reward=float(reward),
            next_obs=np.array(next_obs, copy=True),
            done=bool(done),
            next_action_mask=(
                np.array(next_action_mask, dtype=np.float32, copy=True)
                if next_action_mask is not None
                else None
            ),
        )
        # New transitions start at the current max priority so they are
        # guaranteed to be sampled at least once before their priority is updated.
        max_p = float(self._priorities[: len(self.storage)].max()) if self.storage else 1.0
        self._priorities[self.next_idx] = max_p if max_p > 0 else 1.0

        if self.next_idx >= len(self.storage):
            self.storage.append(transition)
        else:
            self.storage[self.next_idx] = transition
        self.next_idx = (self.next_idx + 1) % self.capacity

    def sample(
        self,
        batch_size: int,
        return_meta: bool = False,
    ) -> Dict[str, np.ndarray] | Tuple[Dict[str, np.ndarray], np.ndarray, np.ndarray]:
        """Sample a batch.

        Args:
            batch_size: number of transitions to sample.
            return_meta: if True, also return ``(indices, is_weights)`` for PER
                         priority updates and loss correction.

        Returns:
            batch dict, or ``(batch, indices, is_weights)`` when return_meta=True.
        """
        assert len(self.storage) >= batch_size, "Not enough samples in buffer"
        n = len(self.storage)
        self._frame += 1

        if self.alpha > 0:
            probs = self._priorities[:n] ** self.alpha
            probs_sum = probs.sum()
            if probs_sum <= 0:
                probs = np.ones(n, dtype=np.float32) / n
            else:
                probs = probs / probs_sum
            indices = np.random.choice(n, batch_size, replace=False, p=probs)
            # Importance-sampling weights, annealed from beta_start → 1.0
            beta = min(1.0, self.beta_start + self._frame * (1.0 - self.beta_start) / max(1, self.beta_frames))
            is_weights = (n * probs[indices]) ** (-beta)
            is_weights = (is_weights / is_weights.max()).astype(np.float32)
        else:
            indices = np.array(random.sample(range(n), batch_size), dtype=np.int64)
            is_weights = np.ones(batch_size, dtype=np.float32)

        batch = self._collect(indices)
        if return_meta:
            return batch, indices, is_weights
        return batch

    def update_priorities(self, indices: np.ndarray, td_errors: np.ndarray):
        """Update priorities after a learning step (PER only)."""
        for idx, err in zip(indices, td_errors):
            self._priorities[int(idx)] = float(abs(err)) + 1e-6

    def _collect(self, indices: np.ndarray) -> Dict[str, np.ndarray]:
        obs = np.stack([self.storage[i].obs for i in indices])
        actions = np.array([self.storage[i].action for i in indices], dtype=np.int64)
        rewards = np.array([self.storage[i].reward for i in indices], dtype=np.float32)
        next_obs = np.stack([self.storage[i].next_obs for i in indices])
        dones = np.array([self.storage[i].done for i in indices], dtype=np.float32)

        has_mask = any(self.storage[i].next_action_mask is not None for i in indices)
        if has_mask:
            mask_shape = next(
                self.storage[i].next_action_mask.shape
                for i in indices
                if self.storage[i].next_action_mask is not None
            )
            next_action_masks = np.stack(
                [
                    self.storage[i].next_action_mask
                    if self.storage[i].next_action_mask is not None
                    else np.ones(mask_shape, dtype=np.float32)
                    for i in indices
                ]
            )
        else:
            next_action_masks = None

        batch: Dict[str, np.ndarray] = {
            "obs": obs,
            "actions": actions,
            "rewards": rewards,
            "next_obs": next_obs,
            "dones": dones,
        }
        if next_action_masks is not None:
            batch["next_action_masks"] = next_action_masks
        return batch
