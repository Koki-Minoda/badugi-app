from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Dict, List

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
    def __init__(self, capacity: int, seed: int | None = None):
        self.capacity = int(capacity)
        self.storage: List[Transition] = []
        self.next_idx = 0
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)

    def __len__(self) -> int:
        return len(self.storage)

    def add(self, obs, action: int, reward: float, next_obs, done: bool, next_action_mask=None):
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
        if self.next_idx >= len(self.storage):
            self.storage.append(transition)
        else:
            self.storage[self.next_idx] = transition
        self.next_idx = (self.next_idx + 1) % self.capacity

    def sample(self, batch_size: int) -> Dict[str, np.ndarray]:
        assert len(self.storage) >= batch_size, "Not enough samples in buffer"
        indices = random.sample(range(len(self.storage)), batch_size)

        obs = np.stack([self.storage[i].obs for i in indices], axis=0)
        actions = np.array(
            [self.storage[i].action for i in indices], dtype=np.int64
        )
        rewards = np.array(
            [self.storage[i].reward for i in indices], dtype=np.float32
        )
        next_obs = np.stack(
            [self.storage[i].next_obs for i in indices], axis=0
        )
        dones = np.array(
            [self.storage[i].done for i in indices], dtype=np.float32
        )
        if any(self.storage[i].next_action_mask is not None for i in indices):
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
                ],
                axis=0,
            )
        else:
            next_action_masks = None

        batch = {
            "obs": obs,
            "actions": actions,
            "rewards": rewards,
            "next_obs": next_obs,
            "dones": dones,
        }
        if next_action_masks is not None:
            batch["next_action_masks"] = next_action_masks
        return batch
