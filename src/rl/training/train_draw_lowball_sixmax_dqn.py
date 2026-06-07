"""6-max self-play DQN trainer for draw lowball variants.

Supported variant IDs:
- S01: 2-7 Single Draw
- D01: 2-7 Triple Draw
- S02: A-5 Single Draw
- D02: A-5 Triple Draw
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.agents.dqn_agent import DQNHyperParams, QNetwork
from rl.env.draw_lowball_env_sixmax_selfplay import (
    BET,
    CALL,
    CHECK,
    DRAW_0,
    FOLD,
    RAISE,
    SixMaxDrawLowballEnv,
)
from rl.utils.replay_buffer import ReplayBuffer


VARIANT_CONFIGS: dict[str, tuple[str, int]] = {
    "S01": ("low-27", 1),
    "D01": ("low-27", 3),
    "S02": ("low-a5", 1),
    "D02": ("low-a5", 3),
}


@dataclass
class DrawLowballSixMaxConfig:
    variant_id: str = "S01"
    total_episodes: int = 20_000
    max_steps_per_episode: int = 160
    buffer_capacity: int = 200_000
    warmup_steps: int = 2_000
    batch_size: int = 128
    epsilon_start: float = 0.70
    epsilon_end: float = 0.06
    epsilon_decay_episodes: int = 16_000
    opp_epsilon: float = 0.05
    opponent_update_interval: int = 500
    train_every_steps: int = 4
    hidden_dim: int = 192
    learning_rate: float = 1e-4
    checkpoint_every: int = 5_000
    eval_every: int = 0
    log_interval: int = 500
    output_dir: str = "rl/models/draw_lowball_sixmax"
    seed: int | None = None
    fold_margin: float = 0.20
    fold_margin_weight: float = 0.40
    call_margin: float = 0.20
    call_margin_weight: float = 0.40
    fold_margin_interval: int = 8


def variant_params(variant_id: str) -> tuple[str, int]:
    key = variant_id.upper()
    if key not in VARIANT_CONFIGS:
        allowed = ", ".join(VARIANT_CONFIGS)
        raise ValueError(f"Unsupported variant_id={variant_id!r}; expected one of: {allowed}")
    return VARIANT_CONFIGS[key]


def _linear_decay(episode: int, start: float, end: float, decay_episodes: int) -> float:
    frac = min(1.0, episode / max(1, decay_episodes))
    return start + frac * (end - start)


def _seed_everything(seed: int | None) -> None:
    if seed is None:
        return
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def _atomic_write_text(path: Path, content: str) -> float:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    start = time.perf_counter()
    try:
        tmp.write_text(content, encoding="utf8")
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()
    return time.perf_counter() - start


def _atomic_save_agent(agent: _LazyDQNAgent, path: Path) -> float:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    start = time.perf_counter()
    try:
        agent.save(str(tmp))
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()
    return time.perf_counter() - start


def _recent_mean(values: deque[float] | list[float], n: int) -> float:
    recent = list(values)[-n:]
    return float(sum(recent) / max(1, len(recent)))


def _rate(numerator: int, denominator: int) -> float:
    return float(numerator) / max(1, int(denominator))


def _terminal_win(terminal_reason: str | None, terminal_reward: float) -> bool:
    return terminal_reason in {"fold_win", "showdown"} and terminal_reward > 0


def _add_fold_margin_transition(
    *,
    fold_buffer: ReplayBuffer,
    call_buffer: ReplayBuffer,
    obs: np.ndarray,
    action: int,
    reward: float,
    next_obs: np.ndarray,
    done: bool,
    next_action_mask: np.ndarray,
) -> str | None:
    """Route hero-fold transitions to the margin buffer with the right direction."""
    if action != FOLD:
        return None
    if reward > 0:
        fold_buffer.add(obs, FOLD, reward, next_obs, done, next_action_mask=next_action_mask)
        return "fold"
    if reward < 0:
        call_buffer.add(obs, CALL, reward, next_obs, done, next_action_mask=next_action_mask)
        return "call"
    return None


class _LazyDQNAgent:
    """DQNAgent-compatible subset with optimizer creation deferred to first update.

    Short CLI smoke runs never train, so constructing Adam up front pays a large
    torch._dynamo import cost for no benefit. Checkpoint payloads stay compatible
    with DQNAgent.load.
    """

    def __init__(
        self,
        obs_dim: int,
        n_actions: int,
        *,
        device: str | torch.device,
        hidden_dim: int,
        hyperparams: DQNHyperParams,
    ) -> None:
        self.device = torch.device(device)
        self.obs_dim = int(obs_dim)
        self.n_actions = int(n_actions)
        self.hyper = hyperparams
        self.q_network = QNetwork(obs_dim, n_actions, hidden_dim).to(self.device)
        self.target_network = QNetwork(obs_dim, n_actions, hidden_dim).to(self.device)
        self.target_network.load_state_dict(self.q_network.state_dict())
        self.target_network.eval()
        self.optimizer: torch.optim.Optimizer | None = None
        self.train_steps = 0

    def _ensure_optimizer(self) -> torch.optim.Optimizer:
        if self.optimizer is None:
            self.optimizer = torch.optim.Adam(self.q_network.parameters(), lr=self.hyper.lr)
        return self.optimizer

    @torch.no_grad()
    def act(self, obs: np.ndarray, epsilon: float, action_mask: np.ndarray | None = None) -> int:
        legal_actions = None
        if action_mask is not None:
            legal_actions = np.flatnonzero(np.asarray(action_mask) > 0)
            if len(legal_actions) == 0:
                legal_actions = None
        if random.random() < epsilon:
            if legal_actions is not None:
                return int(random.choice(legal_actions))
            return random.randrange(self.n_actions)

        obs_t = torch.as_tensor(obs, dtype=torch.float32, device=self.device).unsqueeze(0)
        q_values = self.q_network(obs_t)
        if action_mask is not None:
            mask_t = torch.as_tensor(action_mask, dtype=torch.bool, device=self.device).unsqueeze(0)
            q_values = q_values.masked_fill(~mask_t, -1e9)
        return int(torch.argmax(q_values, dim=1).item())

    def _soft_update_target(self) -> None:
        tau = self.hyper.tau
        for target_param, param in zip(self.target_network.parameters(), self.q_network.parameters()):
            target_param.data.copy_(tau * param.data + (1.0 - tau) * target_param.data)

    def update(
        self,
        batch,
        weights: np.ndarray | None = None,
    ) -> tuple[float, float, np.ndarray]:
        optimizer = self._ensure_optimizer()

        obs = torch.as_tensor(batch["obs"], dtype=torch.float32, device=self.device)
        actions = torch.as_tensor(batch["actions"], dtype=torch.int64, device=self.device).unsqueeze(-1)
        rewards = torch.as_tensor(batch["rewards"], dtype=torch.float32, device=self.device).unsqueeze(-1)
        next_obs = torch.as_tensor(batch["next_obs"], dtype=torch.float32, device=self.device)
        dones = torch.as_tensor(batch["dones"], dtype=torch.float32, device=self.device).unsqueeze(-1)

        q_values = self.q_network(obs).gather(1, actions)

        with torch.no_grad():
            next_q_online = self.q_network(next_obs)
            if "next_action_masks" in batch:
                next_masks = torch.as_tensor(batch["next_action_masks"], dtype=torch.bool, device=self.device)
                next_q_online = next_q_online.masked_fill(~next_masks, -1e9)
            next_actions = torch.argmax(next_q_online, dim=1, keepdim=True)
            next_q_target_all = self.target_network(next_obs)
            if "next_action_masks" in batch:
                next_q_target_all = next_q_target_all.masked_fill(~next_masks, -1e9)
            next_q_target = next_q_target_all.gather(1, next_actions)
            target_q = rewards + self.hyper.gamma * (1.0 - dones) * next_q_target

        td_errors_t = (q_values - target_q).detach()
        elementwise_loss = F.mse_loss(q_values, target_q, reduction="none")
        if weights is not None:
            w_t = torch.as_tensor(weights, dtype=torch.float32, device=self.device).unsqueeze(-1)
            loss = (elementwise_loss * w_t).mean()
        else:
            loss = elementwise_loss.mean()

        optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.q_network.parameters(), max_norm=5.0)
        optimizer.step()
        self._soft_update_target()
        self.train_steps += 1

        td_errors = td_errors_t.cpu().numpy().squeeze(-1)
        return float(loss.item()), float(q_values.mean().item()), td_errors

    def action_margin_update(
        self,
        batch,
        avoid_action: int = 0,
        margin: float = 0.25,
        loss_weight: float = 1.0,
    ) -> tuple[float, float]:
        """Push expert actions above a specific bad action by a Q-value margin."""
        optimizer = self._ensure_optimizer()

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

        optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.q_network.parameters(), max_norm=5.0)
        optimizer.step()
        self._soft_update_target()
        self.train_steps += 1

        with torch.no_grad():
            satisfied = ((preferred_q - avoid_q) >= margin_t).float().mean().item()

        return float(loss.item()), float(satisfied)

    def save(self, path: str) -> None:
        first_layer = self.q_network.net[0]
        hidden_dim = int(first_layer.out_features) if hasattr(first_layer, "out_features") else 256
        torch.save(
            {
                "q_network": self.q_network.state_dict(),
                "target_network": self.target_network.state_dict(),
                "hyper": self.hyper.__dict__,
                "obs_dim": self.obs_dim,
                "n_actions": self.n_actions,
                "hidden_dim": hidden_dim,
            },
            path,
        )


def _build_agent(
    *,
    device: str | torch.device,
    hidden_dim: int,
    learning_rate: float,
    batch_size: int,
) -> _LazyDQNAgent:
    return _LazyDQNAgent(
        obs_dim=96,
        n_actions=11,
        device=device,
        hidden_dim=hidden_dim,
        hyperparams=DQNHyperParams(
            gamma=0.985,
            lr=learning_rate,
            batch_size=batch_size,
            tau=5e-3,
        ),
    )


def _checkpoint_name(output_dir: Path, variant_id: str, episode: int) -> Path:
    ts = time.strftime("%Y%m%d-%H%M%S")
    return output_dir / f"draw_lowball_sixmax_{variant_id}_dqn_{episode:07d}_{ts}.pt"


def _summary_path(output_dir: Path, variant_id: str) -> Path:
    return output_dir / f"draw_lowball_sixmax_{variant_id}_dqn_latest_summary.json"


def train_draw_lowball_sixmax_dqn(
    cfg: DrawLowballSixMaxConfig | None = None,
    device: str | torch.device = "cpu",
) -> dict:
    cfg = cfg or DrawLowballSixMaxConfig()
    cfg.variant_id = cfg.variant_id.upper()
    family, max_draws = variant_params(cfg.variant_id)
    _seed_everything(cfg.seed)

    output_dir = Path(cfg.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    hero = _build_agent(
        device=device,
        hidden_dim=cfg.hidden_dim,
        learning_rate=cfg.learning_rate,
        batch_size=cfg.batch_size,
    )
    opp = _build_agent(
        device=device,
        hidden_dim=cfg.hidden_dim,
        learning_rate=cfg.learning_rate,
        batch_size=cfg.batch_size,
    )
    opp.q_network.load_state_dict(hero.q_network.state_dict())
    opp.target_network.load_state_dict(hero.target_network.state_dict())

    replay = ReplayBuffer(capacity=cfg.buffer_capacity, seed=cfg.seed)
    fold_buffer = ReplayBuffer(capacity=10_000, alpha=0.0)
    call_buffer = ReplayBuffer(capacity=10_000, alpha=0.0)
    env = SixMaxDrawLowballEnv(
        family=family,
        max_draws=max_draws,
        seed=cfg.seed,
        opp_epsilon=cfg.opp_epsilon,
    )
    env.set_agents(hero, opp)

    rewards: deque[float] = deque(maxlen=100_000)
    global_step = 0
    loss = 0.0
    mean_q = 0.0
    fold_margin_loss = 0.0
    call_margin_loss = 0.0
    fold_margin_satisfied = 0.0
    call_margin_satisfied = 0.0
    fold_margin_updates = 0
    call_margin_updates = 0
    fold_margin_transitions = 0
    call_margin_transitions = 0
    opponent_updates = 0
    last_checkpoint: Path | None = None

    total_bet_decisions = 0
    total_folds = 0
    total_checks = 0
    total_calls = 0
    total_bets = 0
    total_raises = 0
    total_vpip_hands = 0
    total_wins = 0
    total_showdowns = 0
    total_showdown_wins = 0

    window_bet_decisions = 0
    window_folds = 0
    window_checks = 0
    window_calls = 0
    window_bets = 0
    window_raises = 0
    window_vpip_hands = 0
    window_wins = 0
    window_showdowns = 0
    window_showdown_wins = 0

    started = time.perf_counter()
    print(
        f"[DrawLowball6max] start variant={cfg.variant_id} family={family} "
        f"max_draws={max_draws} episodes={cfg.total_episodes} device={device}"
    )

    for episode in range(1, cfg.total_episodes + 1):
        reset_seed = None if cfg.seed is None else cfg.seed + episode
        obs, _ = env.reset(seed=reset_seed)
        total_reward = 0.0
        terminal_reward = 0.0
        terminal_reason: str | None = None
        episode_vpip = False
        epsilon = _linear_decay(
            episode,
            cfg.epsilon_start,
            cfg.epsilon_end,
            cfg.epsilon_decay_episodes,
        )

        for _step in range(cfg.max_steps_per_episode):
            global_step += 1
            mask = env.legal_action_mask()
            action = hero.act(obs, epsilon, action_mask=mask)

            if env.phase == "BET":
                total_bet_decisions += 1
                window_bet_decisions += 1
                if action == FOLD:
                    total_folds += 1
                    window_folds += 1
                elif action == CHECK:
                    total_checks += 1
                    window_checks += 1
                elif action == CALL:
                    total_calls += 1
                    window_calls += 1
                    if env.draw_round == 0:
                        episode_vpip = True
                elif action == BET:
                    total_bets += 1
                    window_bets += 1
                    if env.draw_round == 0:
                        episode_vpip = True
                elif action == RAISE:
                    total_raises += 1
                    window_raises += 1
                    if env.draw_round == 0:
                        episode_vpip = True

            next_obs, reward, terminated, truncated, info = env.step(action)
            done = bool(terminated or truncated)
            next_mask = env.legal_action_mask()
            replay.add(obs, action, reward, next_obs, done, next_action_mask=next_mask)
            if action == FOLD and done:
                if isinstance(info, dict) and info.get("terminal_reason") == "hero_fold":
                    routed_margin = _add_fold_margin_transition(
                        fold_buffer=fold_buffer,
                        call_buffer=call_buffer,
                        obs=obs,
                        action=action,
                        reward=reward,
                        next_obs=next_obs,
                        done=done,
                        next_action_mask=next_mask,
                    )
                    if routed_margin == "fold":
                        fold_margin_transitions += 1
                    elif routed_margin == "call":
                        call_margin_transitions += 1
            obs = next_obs
            total_reward += float(reward)

            if (
                global_step >= cfg.warmup_steps
                and len(replay) >= cfg.batch_size
                and global_step % max(1, cfg.train_every_steps) == 0
            ):
                batch, indices, is_weights = replay.sample(cfg.batch_size, return_meta=True)
                loss, mean_q, td_errors = hero.update(batch, weights=is_weights)
                replay.update_priorities(indices, td_errors)
                margin_batch = max(16, cfg.batch_size // 8)
                if global_step % cfg.fold_margin_interval == 0:
                    if len(fold_buffer) >= margin_batch:
                        fold_margin_loss, fold_margin_satisfied = hero.action_margin_update(
                            fold_buffer.sample(margin_batch),
                            avoid_action=CALL,
                            margin=cfg.fold_margin,
                            loss_weight=cfg.fold_margin_weight,
                        )
                        fold_margin_updates += 1
                    if len(call_buffer) >= margin_batch:
                        call_margin_loss, call_margin_satisfied = hero.action_margin_update(
                            call_buffer.sample(margin_batch),
                            avoid_action=FOLD,
                            margin=cfg.call_margin,
                            loss_weight=cfg.call_margin_weight,
                        )
                        call_margin_updates += 1

            if done:
                terminal_reward = float(reward)
                if isinstance(info, dict):
                    terminal_reason = info.get("terminal_reason")
                terminal_reason = terminal_reason or getattr(env, "terminal_reason", None)
                break
        else:
            terminal_reason = "truncated"

        rewards.append(total_reward)
        if episode_vpip:
            total_vpip_hands += 1
            window_vpip_hands += 1
        if _terminal_win(terminal_reason, terminal_reward):
            total_wins += 1
            window_wins += 1
        if terminal_reason == "showdown":
            total_showdowns += 1
            window_showdowns += 1
            if terminal_reward > 0:
                total_showdown_wins += 1
                window_showdown_wins += 1

        if episode % cfg.opponent_update_interval == 0:
            opp.q_network.load_state_dict(hero.q_network.state_dict())
            opp.target_network.load_state_dict(hero.target_network.state_dict())
            opponent_updates += 1

        if cfg.log_interval > 0 and episode % cfg.log_interval == 0:
            recent = list(rewards)[-cfg.log_interval:]
            elapsed = time.perf_counter() - started
            print(
                f"[DrawLowball6max {cfg.variant_id} {episode:7d}] "
                f"avgReward={sum(recent) / max(1, len(recent)):8.3f} "
                f"winRate={_rate(window_wins, cfg.log_interval):.3f} "
                f"showdownWinRate={_rate(window_showdown_wins, window_showdowns):.3f} "
                f"foldRate={_rate(window_folds, window_bet_decisions):.3f} "
                f"checkCallRate={_rate(window_checks + window_calls, window_bet_decisions):.3f} "
                f"betRaiseRate={_rate(window_bets + window_raises, window_bet_decisions):.3f} "
                f"vpip={_rate(window_vpip_hands, cfg.log_interval):.3f} "
                f"epsilon={epsilon:.3f} replay={len(replay)} loss={loss:.5f} q={mean_q:.3f} "
                f"foldBuf={len(fold_buffer)} callBuf={len(call_buffer)} "
                f"foldMarginLoss={fold_margin_loss:.5f} foldMarginSat={fold_margin_satisfied:.3f} "
                f"callMarginLoss={call_margin_loss:.5f} callMarginSat={call_margin_satisfied:.3f} "
                f"marginUpdates={fold_margin_updates}/{call_margin_updates} "
                f"oppUpdates={opponent_updates} eps/s={episode / max(1e-9, elapsed):.2f}"
            )
            window_bet_decisions = 0
            window_folds = 0
            window_checks = 0
            window_calls = 0
            window_bets = 0
            window_raises = 0
            window_vpip_hands = 0
            window_wins = 0
            window_showdowns = 0
            window_showdown_wins = 0

        if cfg.checkpoint_every > 0 and episode % cfg.checkpoint_every == 0:
            ckpt = _checkpoint_name(output_dir, cfg.variant_id, episode)
            _atomic_save_agent(hero, ckpt)
            last_checkpoint = ckpt
            print(f"[DrawLowball6max] checkpoint={ckpt}")

    if last_checkpoint is None:
        last_checkpoint = _checkpoint_name(output_dir, cfg.variant_id, cfg.total_episodes)
        _atomic_save_agent(hero, last_checkpoint)

    latest = output_dir / f"draw_lowball_sixmax_{cfg.variant_id}_dqn_latest.pt"
    _atomic_save_agent(hero, latest)

    summary = {
        "variantId": cfg.variant_id,
        "family": family,
        "maxDraws": int(max_draws),
        "episodes": int(cfg.total_episodes),
        "globalSteps": int(global_step),
        "avgReward": _recent_mean(rewards, 100),
        "winRate": _rate(total_wins, cfg.total_episodes),
        "showdownWinRate": _rate(total_showdown_wins, total_showdowns),
        "foldRate": _rate(total_folds, total_bet_decisions),
        "checkRate": _rate(total_checks, total_bet_decisions),
        "callRate": _rate(total_calls, total_bet_decisions),
        "checkCallRate": _rate(total_checks + total_calls, total_bet_decisions),
        "betRate": _rate(total_bets, total_bet_decisions),
        "raiseRate": _rate(total_raises, total_bet_decisions),
        "betRaiseRate": _rate(total_bets + total_raises, total_bet_decisions),
        "vpip": _rate(total_vpip_hands, cfg.total_episodes),
        "epsilon": float(_linear_decay(
            cfg.total_episodes,
            cfg.epsilon_start,
            cfg.epsilon_end,
            cfg.epsilon_decay_episodes,
        )),
        "replaySize": int(len(replay)),
        "replayCapacity": int(replay.capacity),
        "foldMarginBufferSize": int(len(fold_buffer)),
        "callMarginBufferSize": int(len(call_buffer)),
        "foldMarginTransitions": int(fold_margin_transitions),
        "callMarginTransitions": int(call_margin_transitions),
        "foldMarginUpdates": int(fold_margin_updates),
        "callMarginUpdates": int(call_margin_updates),
        "foldMarginLoss": float(fold_margin_loss),
        "callMarginLoss": float(call_margin_loss),
        "foldMarginSatisfied": float(fold_margin_satisfied),
        "callMarginSatisfied": float(call_margin_satisfied),
        "foldMargin": float(cfg.fold_margin),
        "callMargin": float(cfg.call_margin),
        "foldMarginWeight": float(cfg.fold_margin_weight),
        "callMarginWeight": float(cfg.call_margin_weight),
        "foldMarginInterval": int(cfg.fold_margin_interval),
        "opponentUpdates": int(opponent_updates),
        "checkpoint": str(last_checkpoint),
        "latestCheckpoint": str(latest),
        "evalEvery": int(cfg.eval_every),
        "seed": cfg.seed,
        "obsDim": 96,
        "nActions": 11,
        "actionIds": {
            "FOLD": int(FOLD),
            "CHECK": int(CHECK),
            "CALL": int(CALL),
            "BET": int(BET),
            "RAISE": int(RAISE),
            "DRAW_0": int(DRAW_0),
        },
    }
    report = _summary_path(output_dir, cfg.variant_id)
    _atomic_write_text(report, json.dumps(summary, indent=2) + "\n")
    print(f"[DrawLowball6max] latest={latest}")
    print(f"[DrawLowball6max] report={report}")
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="6-max self-play DQN for draw lowball.")
    parser.add_argument("--variant-id", choices=tuple(VARIANT_CONFIGS), default=DrawLowballSixMaxConfig.variant_id)
    parser.add_argument("--episodes", type=int, default=DrawLowballSixMaxConfig.total_episodes)
    parser.add_argument("--seed", type=int, default=DrawLowballSixMaxConfig.seed)
    parser.add_argument("--output-dir", default=DrawLowballSixMaxConfig.output_dir)
    parser.add_argument("--checkpoint-every", type=int, default=DrawLowballSixMaxConfig.checkpoint_every)
    parser.add_argument("--save-interval", type=int, dest="checkpoint_every", default=argparse.SUPPRESS)
    parser.add_argument("--eval-every", type=int, default=DrawLowballSixMaxConfig.eval_every)
    parser.add_argument("--device", default=None)
    parser.add_argument("--max-steps", type=int, default=DrawLowballSixMaxConfig.max_steps_per_episode)
    parser.add_argument("--buffer-capacity", type=int, default=DrawLowballSixMaxConfig.buffer_capacity)
    parser.add_argument("--warmup-steps", type=int, default=DrawLowballSixMaxConfig.warmup_steps)
    parser.add_argument("--batch-size", type=int, default=DrawLowballSixMaxConfig.batch_size)
    parser.add_argument("--epsilon-start", type=float, default=DrawLowballSixMaxConfig.epsilon_start)
    parser.add_argument("--epsilon-end", type=float, default=DrawLowballSixMaxConfig.epsilon_end)
    parser.add_argument("--epsilon-decay-episodes", type=int, default=DrawLowballSixMaxConfig.epsilon_decay_episodes)
    parser.add_argument("--opp-epsilon", type=float, default=DrawLowballSixMaxConfig.opp_epsilon)
    parser.add_argument("--opponent-update-interval", type=int, default=DrawLowballSixMaxConfig.opponent_update_interval)
    parser.add_argument("--train-every-steps", type=int, default=DrawLowballSixMaxConfig.train_every_steps)
    parser.add_argument("--hidden-dim", type=int, default=DrawLowballSixMaxConfig.hidden_dim)
    parser.add_argument("--learning-rate", type=float, default=DrawLowballSixMaxConfig.learning_rate)
    parser.add_argument("--log-interval", type=int, default=DrawLowballSixMaxConfig.log_interval)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    cfg = DrawLowballSixMaxConfig(
        variant_id=args.variant_id,
        total_episodes=args.episodes,
        max_steps_per_episode=args.max_steps,
        buffer_capacity=args.buffer_capacity,
        warmup_steps=args.warmup_steps,
        batch_size=args.batch_size,
        epsilon_start=args.epsilon_start,
        epsilon_end=args.epsilon_end,
        epsilon_decay_episodes=args.epsilon_decay_episodes,
        opp_epsilon=args.opp_epsilon,
        opponent_update_interval=args.opponent_update_interval,
        train_every_steps=args.train_every_steps,
        hidden_dim=args.hidden_dim,
        learning_rate=args.learning_rate,
        checkpoint_every=args.checkpoint_every,
        eval_every=args.eval_every,
        log_interval=args.log_interval,
        output_dir=args.output_dir,
        seed=args.seed,
    )
    train_draw_lowball_sixmax_dqn(cfg=cfg, device=device)
