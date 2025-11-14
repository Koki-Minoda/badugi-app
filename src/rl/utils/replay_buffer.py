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

    def add(self, obs, action: int, reward: float, next_obs, done: bool):
        transition = Transition(
            obs=np.array(obs, copy=True),
            action=int(action),
            reward=float(reward),
            next_obs=np.array(next_obs, copy=True),
            done=bool(done),
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

        return {
            "obs": obs,
            "actions": actions,
            "rewards": rewards,
            "next_obs": next_obs,
            "dones": dones,
        }
