"""Self-play training for 2-7 and A-5 draw lowball DQN agents.

Strategy
--------
* Hero trains against a periodically-frozen copy of itself (opponent).
* Every ``opponent_update_interval`` episodes the opponent weights are
  overwritten with the current hero weights, keeping it a challenging but
  stable target.
* A short teacher-warmup phase using the existing DrawLowballEnv preloads
  both the hero replay buffer and an expert buffer so the network starts
  with reasonable play before self-play begins.
* The output checkpoint is compatible with export_draw_dqn_onnx.py.

Usage::

    python src/rl/training/train_selfplay_draw_dqn.py --family low-27
    python src/rl/training/train_selfplay_draw_dqn.py --family low-a5 \\
        --pretrained rl/models/draw/low-a5_draw_dqn_latest.pt
"""

from __future__ import annotations

import argparse
import copy
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
from rl.env.draw_lowball_env import DrawLowballEnv, draw_teacher_action
from rl.env.draw_lowball_env_selfplay import DualAgentDrawLowballEnv
from rl.training.train_draw_dqn import _call_margin_examples
from rl.utils.replay_buffer import ReplayBuffer


@dataclass
class SelfPlayConfig:
    family: str = "low-27"
    total_episodes: int = 20_000
    max_steps_per_episode: int = 80
    buffer_capacity: int = 120_000
    warmup_steps: int = 2_000
    batch_size: int = 64
    epsilon_start: float = 0.70
    epsilon_end: float = 0.06
    epsilon_decay_episodes: int = 16_000
    # Teacher warm-up: fill replay with expert transitions before self-play.
    teacher_warmup_episodes: int = 1_000
    teacher_profiles: tuple[str, ...] = (
        "beginner", "standard", "tight", "loose", "aggressive"
    )
    imitation_pretrain_steps: int = 300
    imitation_loss_weight: float = 0.50
    expert_replay_ratio: float = 0.25
    # Fold/call margin updates (same as single-agent training).
    # fold_margin prevents the agent learning to fold strong draws.
    # call_margin is the symmetric counterpart: prevents fold over-generalisation
    # to ace-holding / strong-draw hands.  Both must be present or fold_margin
    # alone will push Q(fold) too high on good hands as well as bad ones.
    fold_margin: float = 0.10
    call_margin: float = 0.10
    fold_margin_weight: float = 0.30
    call_margin_weight: float = 0.30
    fold_margin_interval: int = 5
    # Self-play specific: how often (in episodes) to copy hero → opp.
    opponent_update_interval: int = 500
    # Training cadence.
    train_every_steps: int = 3
    hidden_dim: int = 192
    learning_rate: float = 1e-4
    save_interval: int = 5_000
    log_interval: int = 500
    output_dir: str = "rl/models/draw"
    max_draws: int = 3
    # Optional: path to a pretrained checkpoint to warm-start from.
    pretrained: str = ""


def _linear_decay(episode: int, start: float, end: float, decay_episodes: int) -> float:
    frac = min(1.0, episode / max(1, decay_episodes))
    return start + frac * (end - start)


def _teacher_warmup(
    cfg: SelfPlayConfig,
    hero: DQNAgent,
    replay: ReplayBuffer,
    expert: ReplayBuffer,
    fold_buffer: ReplayBuffer,
    call_buffer: ReplayBuffer,
) -> None:
    """Fill replay/expert buffers using the rule-based teacher policy."""
    env = DrawLowballEnv(
        family=cfg.family,
        opponent_profile=cfg.teacher_profiles[0],
        max_draws=cfg.max_draws,
    )
    for episode in range(1, cfg.teacher_warmup_episodes + 1):
        env.set_opponent_profile(
            cfg.teacher_profiles[(episode - 1) % len(cfg.teacher_profiles)]
        )
        obs, _ = env.reset()
        for _ in range(cfg.max_steps_per_episode):
            action = draw_teacher_action(env)
            next_obs, reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            mask = env.legal_action_mask()
            replay.add(obs, action, reward, next_obs, done, next_action_mask=mask)
            expert.add(obs, action, reward, next_obs, done, next_action_mask=mask)
            if action == 0:
                fold_buffer.add(obs, action, reward, next_obs, done, next_action_mask=mask)
            obs = next_obs
            if done:
                break

    # Populate call_buffer: hands that should CALL not fold (ace-holding draws,
    # strong low draws).  Mirrors single-agent training to prevent fold_margin
    # from over-generalising to good hands.
    call_examples = _call_margin_examples(env)
    for _ in range(30):
        for obs, action in call_examples:
            call_buffer.add(obs, action, 0.3, obs, False)

    if cfg.imitation_pretrain_steps > 0 and len(expert) >= cfg.batch_size:
        for _ in range(cfg.imitation_pretrain_steps):
            hero.imitation_update(
                expert.sample(cfg.batch_size),
                loss_weight=cfg.imitation_loss_weight,
            )


def train_selfplay_draw_dqn(
    cfg: SelfPlayConfig | None = None,
    device: str | torch.device = "cpu",
) -> dict:
    cfg = cfg or SelfPlayConfig()
    output_dir = Path(cfg.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Build hero agent (trainable).
    hero = DQNAgent(
        obs_dim=96,
        n_actions=11,
        device=device,
        hidden_dim=cfg.hidden_dim,
        hyperparams=DQNHyperParams(
            gamma=0.985,
            lr=cfg.learning_rate,
            batch_size=cfg.batch_size,
            tau=5e-3,
        ),
    )

    # Optionally warm-start from an existing checkpoint.
    if cfg.pretrained:
        pretrained_path = Path(cfg.pretrained)
        if not pretrained_path.is_absolute():
            pretrained_path = PROJECT_ROOT / pretrained_path
        if pretrained_path.exists():
            loaded = DQNAgent.load(str(pretrained_path), device=device)
            hero.q_network.load_state_dict(loaded.q_network.state_dict())
            hero.target_network.load_state_dict(loaded.target_network.state_dict())
            print(f"[SelfPlay] Warm-started from {pretrained_path}")
        else:
            print(f"[SelfPlay] Pretrained checkpoint not found: {pretrained_path} — starting fresh")

    # Opponent is a frozen copy of hero; updated periodically.
    opp = DQNAgent(
        obs_dim=96,
        n_actions=11,
        device=device,
        hidden_dim=cfg.hidden_dim,
        hyperparams=DQNHyperParams(gamma=0.985, lr=cfg.learning_rate, batch_size=cfg.batch_size),
    )
    opp.q_network.load_state_dict(hero.q_network.state_dict())
    opp.target_network.load_state_dict(hero.target_network.state_dict())

    # Replay buffers (same layout as single-agent training).
    replay = ReplayBuffer(capacity=cfg.buffer_capacity)
    expert = ReplayBuffer(capacity=cfg.buffer_capacity)
    fold_buffer = ReplayBuffer(capacity=10_000, alpha=0.0)
    # call_buffer is the symmetric counterpart of fold_buffer: prevents
    # fold_margin from over-generalising to good hands.
    call_buffer = ReplayBuffer(capacity=5_000, alpha=0.0)

    # Phase 1: teacher warm-up.
    print(
        f"[SelfPlay] Teacher warm-up: family={cfg.family} "
        f"episodes={cfg.teacher_warmup_episodes}"
    )
    _teacher_warmup(cfg, hero, replay, expert, fold_buffer, call_buffer)
    print(
        f"[SelfPlay] Teacher done: replay={len(replay)} expert={len(expert)} "
        f"fold_buffer={len(fold_buffer)} call_buffer={len(call_buffer)}"
    )

    # Self-play environment.
    sp_env = DualAgentDrawLowballEnv(family=cfg.family, max_draws=cfg.max_draws)
    sp_env.set_agents(hero, opp)

    global_step = 0
    rewards: list[float] = []
    # Per-episode BET action counts (for mode collapse detection).
    ep_folds: list[int] = []
    ep_raises: list[int] = []
    ep_bet_steps: list[int] = []
    loss = 0.0
    mean_q = 0.0
    imitation_loss = 0.0
    imitation_accuracy = 0.0
    fold_margin_loss = 0.0
    opponent_updates = 0

    # Phase 2: self-play training loop.
    for episode in range(1, cfg.total_episodes + 1):
        obs, _ = sp_env.reset()
        total_reward = 0.0
        ep_fold_count = ep_raise_count = ep_bet_step_count = 0
        epsilon = _linear_decay(
            episode, cfg.epsilon_start, cfg.epsilon_end, cfg.epsilon_decay_episodes
        )

        for _ in range(cfg.max_steps_per_episode):
            global_step += 1
            mask = sp_env.legal_action_mask()
            action = hero.act(obs, epsilon, action_mask=mask)

            # Track BET-phase actions for mode collapse detection.
            if sp_env.phase == "BET":
                ep_bet_step_count += 1
                if action == 0:
                    ep_fold_count += 1
                elif action in (3, 4):  # bet or raise
                    ep_raise_count += 1

            next_obs, reward, terminated, truncated, _ = sp_env.step(action)
            done = terminated or truncated
            replay.add(
                obs, action, reward, next_obs, done,
                next_action_mask=sp_env.legal_action_mask(),
            )
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

                expert_bs = int(round(cfg.batch_size * cfg.expert_replay_ratio))
                if expert_bs > 0 and len(expert) >= expert_bs:
                    imitation_loss, imitation_accuracy = hero.imitation_update(
                        expert.sample(expert_bs),
                        loss_weight=cfg.imitation_loss_weight,
                    )

                margin_batch = max(8, cfg.batch_size // 8)
                if global_step % cfg.fold_margin_interval == 0:
                    if len(fold_buffer) >= margin_batch:
                        fold_margin_loss, _ = hero.action_margin_update(
                            fold_buffer.sample(margin_batch),
                            avoid_action=2,
                            margin=cfg.fold_margin,
                            loss_weight=cfg.fold_margin_weight,
                        )
                    # Symmetric call_margin: Q(call) > Q(fold) on strong-draw hands.
                    # Prevents fold_margin from over-generalising to good holdings.
                    if len(call_buffer) >= margin_batch:
                        hero.action_margin_update(
                            call_buffer.sample(margin_batch),
                            avoid_action=0,
                            margin=cfg.call_margin,
                            loss_weight=cfg.call_margin_weight,
                        )

            if done:
                break

        rewards.append(total_reward)
        ep_folds.append(ep_fold_count)
        ep_raises.append(ep_raise_count)
        ep_bet_steps.append(ep_bet_step_count)

        # Periodically freeze a snapshot of hero as the new opponent.
        if episode % cfg.opponent_update_interval == 0:
            opp.q_network.load_state_dict(hero.q_network.state_dict())
            opp.target_network.load_state_dict(hero.target_network.state_dict())
            opponent_updates += 1

        if cfg.log_interval > 0 and episode % cfg.log_interval == 0:
            recent = rewards[-cfg.log_interval:]
            window_bet = max(1, sum(ep_bet_steps[-cfg.log_interval:]))
            fold_rate = sum(ep_folds[-cfg.log_interval:]) / window_bet
            raise_rate = sum(ep_raises[-cfg.log_interval:]) / window_bet
            collapse_warn = ""
            if fold_rate > 0.60:
                collapse_warn = " ⚠ HIGH-FOLD (possible mode collapse)"
            elif raise_rate < 0.02 and fold_rate < 0.05:
                collapse_warn = " ⚠ LOW-AGGRESSION (possible check-lock)"
            print(
                f"[SelfPlay {cfg.family} {episode:6d}] "
                f"avg_reward={sum(recent)/len(recent):8.3f} "
                f"epsilon={epsilon:5.3f} buffer={len(replay):7d} "
                f"loss={loss:8.5f} mean_q={mean_q:8.3f} "
                f"bc_acc={imitation_accuracy:5.3f} "
                f"fold%={fold_rate*100:4.1f} raise%={raise_rate*100:4.1f} "
                f"opp_updates={opponent_updates}{collapse_warn}"
            )

        if cfg.save_interval > 0 and episode % cfg.save_interval == 0:
            ts = time.strftime("%Y%m%d-%H%M%S")
            ckpt = output_dir / f"{cfg.family}_selfplay_dqn_{episode:06d}_{ts}.pt"
            hero.save(str(ckpt))
            print(f"[SelfPlay] Saved checkpoint → {ckpt}")

    latest = output_dir / f"{cfg.family}_selfplay_dqn_latest.pt"
    hero.save(str(latest))

    summary = {
        "family": cfg.family,
        "episodes": int(cfg.total_episodes),
        "global_steps": int(global_step),
        "avg_reward_last_100": float(sum(rewards[-100:]) / max(1, len(rewards[-100:]))),
        "opponent_update_interval": int(cfg.opponent_update_interval),
        "opponent_updates": int(opponent_updates),
        "teacher_warmup_episodes": int(cfg.teacher_warmup_episodes),
        "checkpoint": str(latest),
        "obs_dim": 96,
        "n_actions": 11,
        "max_draws": int(cfg.max_draws),
    }
    summary_path = output_dir / f"{cfg.family}_selfplay_dqn_latest_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8")
    print(f"[SelfPlay] Latest checkpoint → {latest}")
    print(f"[SelfPlay] Summary → {summary_path}")
    return summary


def parse_args():
    parser = argparse.ArgumentParser(description="Self-play DQN training for 2-7 / A-5 draw.")
    parser.add_argument("--family", choices=["low-27", "low-a5"], default=SelfPlayConfig.family)
    parser.add_argument("--episodes", type=int, default=SelfPlayConfig.total_episodes)
    parser.add_argument("--max-steps", type=int, default=SelfPlayConfig.max_steps_per_episode)
    parser.add_argument("--buffer-capacity", type=int, default=SelfPlayConfig.buffer_capacity)
    parser.add_argument("--warmup-steps", type=int, default=SelfPlayConfig.warmup_steps)
    parser.add_argument("--batch-size", type=int, default=SelfPlayConfig.batch_size)
    parser.add_argument("--epsilon-start", type=float, default=SelfPlayConfig.epsilon_start)
    parser.add_argument("--epsilon-end", type=float, default=SelfPlayConfig.epsilon_end)
    parser.add_argument("--epsilon-decay-episodes", type=int, default=SelfPlayConfig.epsilon_decay_episodes)
    parser.add_argument("--teacher-warmup-episodes", type=int, default=SelfPlayConfig.teacher_warmup_episodes)
    parser.add_argument("--imitation-pretrain-steps", type=int, default=SelfPlayConfig.imitation_pretrain_steps)
    parser.add_argument("--hidden-dim", type=int, default=SelfPlayConfig.hidden_dim)
    parser.add_argument("--learning-rate", type=float, default=SelfPlayConfig.learning_rate)
    parser.add_argument("--call-margin-weight", type=float, default=SelfPlayConfig.call_margin_weight)
    parser.add_argument("--opponent-update-interval", type=int, default=SelfPlayConfig.opponent_update_interval)
    parser.add_argument("--output-dir", default=SelfPlayConfig.output_dir)
    parser.add_argument("--save-interval", type=int, default=SelfPlayConfig.save_interval)
    parser.add_argument("--log-interval", type=int, default=SelfPlayConfig.log_interval)
    parser.add_argument("--max-draws", type=int, default=SelfPlayConfig.max_draws)
    parser.add_argument("--pretrained", default=SelfPlayConfig.pretrained,
                        help="Path to a .pt checkpoint for warm-start (optional)")
    parser.add_argument("--device", default=None)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    cfg = SelfPlayConfig(
        family=args.family,
        total_episodes=args.episodes,
        max_steps_per_episode=args.max_steps,
        buffer_capacity=args.buffer_capacity,
        warmup_steps=args.warmup_steps,
        batch_size=args.batch_size,
        epsilon_start=args.epsilon_start,
        epsilon_end=args.epsilon_end,
        epsilon_decay_episodes=args.epsilon_decay_episodes,
        teacher_warmup_episodes=args.teacher_warmup_episodes,
        imitation_pretrain_steps=args.imitation_pretrain_steps,
        hidden_dim=args.hidden_dim,
        learning_rate=args.learning_rate,
        call_margin_weight=args.call_margin_weight,
        opponent_update_interval=args.opponent_update_interval,
        output_dir=args.output_dir,
        save_interval=args.save_interval,
        log_interval=args.log_interval,
        max_draws=args.max_draws,
        pretrained=args.pretrained,
    )
    print(f"[SelfPlay] device={device} family={cfg.family} episodes={cfg.total_episodes}")
    train_selfplay_draw_dqn(cfg=cfg, device=device)
