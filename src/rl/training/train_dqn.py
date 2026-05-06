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
from rl.training.badugi_starting_ranges import teacher_action


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
    opponent_profiles: tuple[str, ...] = ("balanced",)
    teacher_warmup_episodes: int = 0
    imitation_pretrain_steps: int = 0
    expert_replay_ratio: float = 0.0
    imitation_loss_weight: float = 1.0
    profitable_continue_replay_ratio: float = 0.0
    profitable_continue_margin: float = 0.25
    profitable_continue_loss_weight: float = 0.5
    first_in_value_bet_replay_ratio: float = 0.0
    first_in_value_bet_loss_weight: float = 0.75
    table_size: int = 2
    resume_checkpoint: str | None = None
    dataset_validation_summary: str | None = None
    require_clean_dataset: bool = False


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


def profitable_continue_action(env) -> int | None:
    """Return a preferred call action when current facing-bet state has clear call EV."""
    if getattr(env, "phase", None) != "BET":
        return None
    to_call = max(0, getattr(env, "current_bet", 0) - getattr(env, "player_bet", 0))
    if to_call <= 0:
        return None
    mask = env.legal_action_mask()
    if len(mask) <= 2 or mask[2] <= 0:
        return None
    if not hasattr(env, "_hand_features") or not hasattr(env, "_bet_ev_diagnostic"):
        return None
    features = env._hand_features(env.player_hand)
    ev = env._bet_ev_diagnostic(features, to_call)
    is_final_bet = getattr(env, "round", 0) >= getattr(env, "max_rounds", 3)
    if is_final_bet and hasattr(env, "_weak_final_showdown_call_spot"):
        if env._weak_final_showdown_call_spot(features, ev):
            return None
    clear_call_edge = ev.call_ev > ev.fold_ev + 0.08
    cheap_developing_draw = (
        not is_final_bet
        and features.count >= 2
        and ev.cheap_draw_continue_value >= 0.30
        and ev.pot_odds <= 0.30
    )
    strength = env._street_adjusted_strength(features) if hasattr(env, "_street_adjusted_strength") else 0.0
    made_showdown_value = features.count >= 4 and strength >= 0.54
    if clear_call_edge or cheap_developing_draw or made_showdown_value:
        return 2
    return None


def first_in_value_bet_action(env) -> int | None:
    """Return a preferred first-in bet action for clear made-hand value spots."""
    if getattr(env, "phase", None) != "BET":
        return None
    to_call = max(0, getattr(env, "current_bet", 0) - getattr(env, "player_bet", 0))
    if to_call > 0:
        return None
    mask = env.legal_action_mask()
    if len(mask) <= 3 or mask[3] <= 0:
        return None
    if not hasattr(env, "_hand_features") or not hasattr(env, "_sixmax_value_bet_spot"):
        return None
    features = env._hand_features(env.player_hand)
    if features.count < 4:
        return None
    strength = env._street_adjusted_strength(features) if hasattr(env, "_street_adjusted_strength") else 0.0
    high_rank = max(features.ranks) if features.ranks else 12
    opponent_pat_pressure = env._opponent_pat_pressure() if hasattr(env, "_opponent_pat_pressure") else 0.0
    clear_value = strength >= 0.66 and high_rank <= 8
    protected_thin_value = strength >= 0.66 and high_rank <= 10 and opponent_pat_pressure <= 0.45
    thin_exploit_value = env._sixmax_value_bet_spot(features, 0)
    if clear_value or protected_thin_value or thin_exploit_value:
        return 3
    return None


def train_dqn(cfg: TrainConfig | None = None, device: str | torch.device = "cpu"):
    cfg = cfg or TrainConfig()
    assert_dataset_is_safe_for_training(cfg)
    os.makedirs(cfg.output_dir, exist_ok=True)

    env = BadugiEnv(opponent_profile=cfg.opponent_profiles[0], table_size=cfg.table_size)
    obs, _ = env.reset()

    obs_dim = int(np.prod(env.observation_space.shape))
    n_actions = env.action_space.n

    hyper = DQNHyperParams(
        gamma=0.99,
        lr=cfg.learning_rate,
        batch_size=cfg.batch_size,
        tau=5e-3,
    )
    if cfg.resume_checkpoint:
        agent = DQNAgent.load(cfg.resume_checkpoint, device=device)
        if agent.obs_dim != obs_dim or agent.n_actions != n_actions:
            raise ValueError(
                "--resume-checkpoint shape does not match environment: "
                f"checkpoint=({agent.obs_dim},{agent.n_actions}) "
                f"env=({obs_dim},{n_actions})"
            )
        print(f"[Resume] checkpoint={cfg.resume_checkpoint}")
    else:
        agent = DQNAgent(
            obs_dim=obs_dim,
            n_actions=n_actions,
            device=device,
            hidden_dim=cfg.hidden_dim,
            hyperparams=hyper,
        )
    replay_buffer = ReplayBuffer(capacity=cfg.buffer_capacity)
    expert_buffer = ReplayBuffer(capacity=cfg.buffer_capacity)
    profitable_continue_buffer = ReplayBuffer(capacity=cfg.buffer_capacity)
    first_in_value_bet_buffer = ReplayBuffer(capacity=cfg.buffer_capacity)

    global_step = 0
    episode_rewards = []

    if cfg.teacher_warmup_episodes > 0:
        teacher_rewards = []
        for episode in range(1, cfg.teacher_warmup_episodes + 1):
            env.set_opponent_profile(cfg.opponent_profiles[(episode - 1) % len(cfg.opponent_profiles)])
            obs, _ = env.reset()
            total_reward = 0.0
            for _step in range(cfg.max_steps_per_episode):
                to_call_before = max(0, env.current_bet - env.player_bet)
                first_in_value_before = first_in_value_bet_action(env)
                action = teacher_action(env)
                next_obs, reward, terminated, truncated, _info = env.step(action)
                done = terminated or truncated
                replay_buffer.add(
                    obs,
                    action,
                    reward,
                    next_obs,
                    done,
                    next_action_mask=env.legal_action_mask(),
                )
                expert_buffer.add(
                    obs,
                    action,
                    reward,
                    next_obs,
                    done,
                    next_action_mask=env.legal_action_mask(),
                )
                if to_call_before > 0 and action == 2:
                    profitable_continue_buffer.add(
                        obs,
                        action,
                        reward,
                        next_obs,
                        done,
                        next_action_mask=env.legal_action_mask(),
                    )
                if first_in_value_before == 3 and action == 3:
                    first_in_value_bet_buffer.add(
                        obs,
                        action,
                        reward,
                        next_obs,
                        done,
                        next_action_mask=env.legal_action_mask(),
                    )
                obs = next_obs
                total_reward += float(reward)
                if done:
                    break
            teacher_rewards.append(total_reward)
        print(
            "[Teacher warmup] "
            f"episodes={cfg.teacher_warmup_episodes} "
            f"buffer={len(replay_buffer)} "
            f"continue_buffer={len(profitable_continue_buffer)} "
            f"first_in_value_buffer={len(first_in_value_bet_buffer)} "
            f"avg_reward={sum(teacher_rewards) / max(1, len(teacher_rewards)):8.3f}"
        )

    imitation_loss, imitation_accuracy = 0.0, 0.0
    continue_margin_loss, continue_margin_satisfied = 0.0, 0.0
    first_in_value_loss, first_in_value_accuracy = 0.0, 0.0
    if cfg.imitation_pretrain_steps > 0:
        if len(expert_buffer) < cfg.batch_size:
            raise ValueError(
                "--imitation-pretrain-steps requires enough teacher samples; "
                "increase --teacher-warmup-episodes or reduce --batch-size"
            )
        for _step in range(cfg.imitation_pretrain_steps):
            imitation_batch = expert_buffer.sample(cfg.batch_size)
            imitation_loss, imitation_accuracy = agent.imitation_update(
                imitation_batch,
                loss_weight=cfg.imitation_loss_weight,
            )
        print(
            "[Imitation pretrain] "
            f"steps={cfg.imitation_pretrain_steps} "
            f"expert_buffer={len(expert_buffer)} "
            f"loss={imitation_loss:8.5f} "
            f"accuracy={imitation_accuracy:5.3f}"
        )

    for episode in range(1, cfg.total_episodes + 1):
        env.set_opponent_profile(cfg.opponent_profiles[(episode - 1) % len(cfg.opponent_profiles)])
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

            action_mask = env.legal_action_mask()
            counterfactual_value_bet = first_in_value_bet_action(env)
            if counterfactual_value_bet is not None:
                first_in_value_bet_buffer.add(
                    obs,
                    counterfactual_value_bet,
                    0.0,
                    obs,
                    False,
                    next_action_mask=action_mask,
                )
            counterfactual_continue = profitable_continue_action(env)
            if counterfactual_continue is not None:
                profitable_continue_buffer.add(
                    obs,
                    counterfactual_continue,
                    0.0,
                    obs,
                    False,
                    next_action_mask=action_mask,
                )
            action = agent.act(obs, epsilon, action_mask=action_mask)
            next_obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            next_action_mask = env.legal_action_mask()

            replay_buffer.add(obs, action, reward, next_obs, done, next_action_mask=next_action_mask)
            obs = next_obs
            episode_reward += float(reward)

            if (
                global_step >= cfg.warmup_steps
                and len(replay_buffer) >= hyper.batch_size
                and global_step % max(1, cfg.train_every_steps) == 0
            ):
                batch = replay_buffer.sample(hyper.batch_size)
                loss, mean_q = agent.update(batch)
                expert_batch_size = int(round(hyper.batch_size * max(0.0, cfg.expert_replay_ratio)))
                if expert_batch_size > 0 and len(expert_buffer) >= expert_batch_size:
                    expert_batch = expert_buffer.sample(expert_batch_size)
                    imitation_loss, imitation_accuracy = agent.imitation_update(
                        expert_batch,
                        loss_weight=cfg.imitation_loss_weight,
                    )
                continue_batch_size = int(
                    round(hyper.batch_size * max(0.0, cfg.profitable_continue_replay_ratio))
                )
                if continue_batch_size > 0 and len(profitable_continue_buffer) >= continue_batch_size:
                    continue_batch = profitable_continue_buffer.sample(continue_batch_size)
                    continue_margin_loss, continue_margin_satisfied = agent.action_margin_update(
                        continue_batch,
                        avoid_action=0,
                        margin=cfg.profitable_continue_margin,
                        loss_weight=cfg.profitable_continue_loss_weight,
                    )
                first_in_value_batch_size = int(
                    round(hyper.batch_size * max(0.0, cfg.first_in_value_bet_replay_ratio))
                )
                if first_in_value_batch_size > 0 and len(first_in_value_bet_buffer) >= first_in_value_batch_size:
                    value_batch = first_in_value_bet_buffer.sample(first_in_value_batch_size)
                    first_in_value_loss, first_in_value_accuracy = agent.imitation_update(
                        value_batch,
                        loss_weight=cfg.first_in_value_bet_loss_weight,
                    )

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
                f"mean_q={mean_q:8.3f} "
                f"bc_loss={imitation_loss:8.5f} "
                f"bc_acc={imitation_accuracy:5.3f} "
                f"cont_margin={continue_margin_loss:8.5f} "
                f"cont_ok={continue_margin_satisfied:5.3f} "
                f"first_value_loss={first_in_value_loss:8.5f} "
                f"first_value_acc={first_in_value_accuracy:5.3f} "
                f"first_value_buf={len(first_in_value_bet_buffer):6d}"
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
        "opponent_profiles": list(cfg.opponent_profiles),
        "teacher_warmup_episodes": cfg.teacher_warmup_episodes,
        "imitation_pretrain_steps": cfg.imitation_pretrain_steps,
        "expert_replay_ratio": cfg.expert_replay_ratio,
        "imitation_loss_weight": cfg.imitation_loss_weight,
        "profitable_continue_replay_ratio": cfg.profitable_continue_replay_ratio,
        "profitable_continue_margin": cfg.profitable_continue_margin,
        "profitable_continue_loss_weight": cfg.profitable_continue_loss_weight,
        "first_in_value_bet_replay_ratio": cfg.first_in_value_bet_replay_ratio,
        "first_in_value_bet_loss_weight": cfg.first_in_value_bet_loss_weight,
        "first_in_value_bet_buffer": len(first_in_value_bet_buffer),
        "table_size": cfg.table_size,
        "resume_checkpoint": cfg.resume_checkpoint,
        "dataset_validation_summary": cfg.dataset_validation_summary,
        "require_clean_dataset": cfg.require_clean_dataset,
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
    parser.add_argument(
        "--opponent-profiles",
        default=",".join(TrainConfig.opponent_profiles),
        help="Comma-separated BadugiEnv opponent profiles for round-robin training.",
    )
    parser.add_argument("--teacher-warmup-episodes", type=int, default=TrainConfig.teacher_warmup_episodes)
    parser.add_argument("--imitation-pretrain-steps", type=int, default=TrainConfig.imitation_pretrain_steps)
    parser.add_argument("--expert-replay-ratio", type=float, default=TrainConfig.expert_replay_ratio)
    parser.add_argument("--imitation-loss-weight", type=float, default=TrainConfig.imitation_loss_weight)
    parser.add_argument(
        "--profitable-continue-replay-ratio",
        type=float,
        default=TrainConfig.profitable_continue_replay_ratio,
    )
    parser.add_argument(
        "--profitable-continue-margin",
        type=float,
        default=TrainConfig.profitable_continue_margin,
    )
    parser.add_argument(
        "--profitable-continue-loss-weight",
        type=float,
        default=TrainConfig.profitable_continue_loss_weight,
    )
    parser.add_argument(
        "--first-in-value-bet-replay-ratio",
        type=float,
        default=TrainConfig.first_in_value_bet_replay_ratio,
    )
    parser.add_argument(
        "--first-in-value-bet-loss-weight",
        type=float,
        default=TrainConfig.first_in_value_bet_loss_weight,
    )
    parser.add_argument("--table-size", type=int, default=TrainConfig.table_size)
    parser.add_argument("--resume-checkpoint", default=None)
    parser.add_argument(
        "--dataset-validation-summary",
        default=None,
        help="Path to an export_dataset.py validation summary or dataset JSON containing validation_summary.",
    )
    parser.add_argument(
        "--require-clean-dataset",
        action="store_true",
        help="Refuse training unless --dataset-validation-summary reports zero invalid transitions.",
    )
    parser.add_argument("--device", default=None)
    return parser.parse_args()


def parse_profile_csv(value: str) -> tuple[str, ...]:
    profiles = tuple(item.strip() for item in value.split(",") if item.strip())
    if not profiles:
        raise ValueError("At least one opponent profile is required")
    return profiles


def load_dataset_validation_summary(path_value: str | None):
    if not path_value:
        return None
    path = Path(path_value)
    if not path.exists():
        raise FileNotFoundError(f"Dataset validation summary not found: {path}")
    payload = json.loads(path.read_text(encoding="utf8"))
    if isinstance(payload, dict) and "validation_summary" in payload:
        return payload["validation_summary"]
    return payload


def assert_dataset_is_safe_for_training(cfg: TrainConfig):
    if not cfg.require_clean_dataset and not cfg.dataset_validation_summary:
        return
    if cfg.require_clean_dataset and not cfg.dataset_validation_summary:
        raise ValueError(
            "--require-clean-dataset requires --dataset-validation-summary so training cannot start without a safety gate"
        )
    summary = load_dataset_validation_summary(cfg.dataset_validation_summary)
    if not isinstance(summary, dict):
        raise ValueError("Dataset validation summary must be a JSON object")
    invalid = int(summary.get("invalid", 0) or 0)
    training_allowed = bool(summary.get("trainingAllowed", invalid == 0))
    if cfg.require_clean_dataset and (invalid > 0 or not training_allowed):
        raise ValueError(
            "Dataset validation failed; refusing training with --require-clean-dataset: "
            f"invalid={invalid} trainingAllowed={training_allowed}"
        )


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
        opponent_profiles=parse_profile_csv(args.opponent_profiles),
        teacher_warmup_episodes=args.teacher_warmup_episodes,
        imitation_pretrain_steps=args.imitation_pretrain_steps,
        expert_replay_ratio=args.expert_replay_ratio,
        imitation_loss_weight=args.imitation_loss_weight,
        profitable_continue_replay_ratio=args.profitable_continue_replay_ratio,
        profitable_continue_margin=args.profitable_continue_margin,
        profitable_continue_loss_weight=args.profitable_continue_loss_weight,
        first_in_value_bet_replay_ratio=args.first_in_value_bet_replay_ratio,
        first_in_value_bet_loss_weight=args.first_in_value_bet_loss_weight,
        table_size=args.table_size,
        resume_checkpoint=args.resume_checkpoint,
        dataset_validation_summary=args.dataset_validation_summary,
        require_clean_dataset=args.require_clean_dataset,
    )
    print(f"Using device: {device}")
    train_dqn(cfg=cfg, device=device)
