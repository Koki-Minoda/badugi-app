"""6-max self-play training for Badugi Iron-level DQN.

Strategy
--------
* Hero rotates through all 6 positions (SB/BB/UTG/MP/CO/BTN) across episodes.
* 5 opponents share a single frozen copy of hero's weights, updated every
  opponent_update_interval episodes.
* Teacher warm-up uses BadugiEnv (6-player) to pre-fill the replay buffer
  with multi-player situations before self-play begins.
* Warm-start from Pro v3 checkpoint strongly recommended.
* 1M episodes target for Iron-level generalisation across all positions.

Usage::

    python src/rl/training/train_sixmax_selfplay_badugi_dqn.py \\
        --pretrained rl/models/badugi_v2obs_perf_50k_20260602/badugi_dqn_latest.pt \\
        --episodes 1000000 \\
        --output-dir rl/models/badugi_sixmax_iron_20260602
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import torch

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.env.badugi_env import BadugiEnv
from rl.env.badugi_env_sixmax_selfplay import CALL, FOLD, RAISE, SixMaxBadugiEnv
from rl.env.badugi_env_selfplay import _best_badugi_keep
from rl.training.onnx_opponent_agent import OnnxOpponentAgent
from rl.training.sixmax_action_telemetry import (
    SixMaxActionTelemetry,
    betting_round_name,
    blind_pre_draw_pressure_opportunity,
    conservative_steal_opportunity,
    conservative_three_bet_opportunity,
    pre_draw_no_voluntary_action_before_hero,
)
from rl.utils.replay_buffer import ReplayBuffer


POSITION_NAMES_BY_BUTTON_OFFSET = ("BTN", "SB", "BB", "UTG", "MP", "CO")
POSITION_LOG_ORDER = ("BTN", "CO", "MP", "UTG", "SB", "BB")
TELEMETRY_HISTORY_MAXLEN = 100_000
DEFAULT_TEACHER_WARMUP_EPISODES = 5_000


@dataclass
class SixMaxSelfPlayConfig:
    total_episodes: int = 1_000_000
    max_steps_per_episode: int = 80        # 6-max has more actions per episode
    buffer_capacity: int = 300_000
    warmup_steps: int = 10_000
    batch_size: int = 128                  # larger batch for 6-max diversity
    epsilon_start: float = 0.55
    epsilon_end: float = 0.05
    epsilon_decay_episodes: int = 800_000  # slow decay over 80% of run
    resume_epsilon_decay_episodes: int = 200_000
    # Teacher warm-up with 6-player BadugiEnv
    teacher_warmup_episodes: int | None = None
    teacher_profiles: tuple[str, ...] = field(default_factory=lambda: (
        "balanced", "loose_aggressive", "tight_passive",
        "tight_aggressive", "draw_heavy", "pat_heavy",
    ))
    imitation_pretrain_steps: int = 1_000
    imitation_loss_weight: float = 0.35
    expert_replay_ratio: float = 0.15
    # Fold margin: trains Q(FOLD) > Q(CALL/RAISE) in good-fold states.
    fold_margin: float = 0.20
    fold_margin_weight: float = 0.40
    fold_margin_interval: int = 4
    # Call margin (symmetric): trains Q(CALL) > Q(FOLD) in bad-fold states.
    call_margin: float = 0.20
    call_margin_weight: float = 0.40
    # Self-play
    opp_epsilon: float = 0.05
    opponent_update_interval: int = 1_000  # less frequent than heads-up (more stable)
    train_every_steps: int = 4             # slightly less frequent due to 6x more steps/ep
    hidden_dim: int = 192                  # Pro v3と同じサイズ（warm-startとの互換性）
    learning_rate: float = 1e-4
    save_interval: int = 50_000
    log_interval: int = 1_000
    output_dir: str = "rl/models/badugi_sixmax_selfplay"
    pretrained: str = ""
    pretrained_opponent: str = ""
    resume_continuation: bool = False
    resume_epsilon: float = 0.25


def _linear_decay(episode: int, start: float, end: float, decay_episodes: int) -> float:
    frac = min(1.0, episode / max(1, decay_episodes))
    return start + frac * (end - start)


def _effective_epsilon_start(cfg: SixMaxSelfPlayConfig) -> float:
    if cfg.resume_continuation:
        return float(cfg.resume_epsilon if cfg.resume_epsilon is not None else cfg.epsilon_end)
    return float(cfg.epsilon_start)


def _episode_epsilon(cfg: SixMaxSelfPlayConfig, episode: int) -> float:
    if cfg.resume_continuation:
        return _linear_decay(
            max(0, episode - 1),
            _effective_epsilon_start(cfg),
            cfg.epsilon_end,
            cfg.resume_epsilon_decay_episodes,
        )
    return _linear_decay(episode, cfg.epsilon_start, cfg.epsilon_end, cfg.epsilon_decay_episodes)


def _effective_teacher_warmup_episodes(cfg: SixMaxSelfPlayConfig) -> int:
    if cfg.teacher_warmup_episodes is not None:
        return max(0, int(cfg.teacher_warmup_episodes))
    if cfg.resume_continuation:
        return 0
    return DEFAULT_TEACHER_WARMUP_EPISODES


def _teacher_warmup_skipped(cfg: SixMaxSelfPlayConfig) -> bool:
    return _effective_teacher_warmup_episodes(cfg) == 0


def _resolve_checkpoint_path(checkpoint: str) -> Path:
    checkpoint_path = Path(checkpoint)
    if not checkpoint_path.is_absolute():
        checkpoint_path = PROJECT_ROOT / checkpoint_path
    return checkpoint_path


def _build_hero_copy_opponent(
    hero: DQNAgent,
    cfg: SixMaxSelfPlayConfig,
    device: str | torch.device,
) -> DQNAgent:
    hero_hidden = hero.q_network.net[0].out_features
    opp = DQNAgent(
        obs_dim=96,
        n_actions=6,
        device=device,
        hidden_dim=hero_hidden,
        hyperparams=DQNHyperParams(gamma=0.990, lr=cfg.learning_rate, batch_size=cfg.batch_size),
    )
    opp.q_network.load_state_dict(hero.q_network.state_dict())
    opp.target_network.load_state_dict(hero.target_network.state_dict())
    return opp


def _agent_network_shapes_match(left: DQNAgent, right: DQNAgent) -> bool:
    for left_state, right_state in (
        (left.q_network.state_dict(), right.q_network.state_dict()),
        (left.target_network.state_dict(), right.target_network.state_dict()),
    ):
        if left_state.keys() != right_state.keys():
            return False
        for key, left_tensor in left_state.items():
            if left_tensor.shape != right_state[key].shape:
                return False
    return True


def _load_initial_opponent_agent(
    cfg: SixMaxSelfPlayConfig,
    hero: DQNAgent,
    device: str | torch.device,
) -> DQNAgent:
    if not cfg.pretrained_opponent:
        print("[6max-SelfPlay] Opponent checkpoint: hero copy")
        return _build_hero_copy_opponent(hero, cfg, device)

    opponent_path = _resolve_checkpoint_path(cfg.pretrained_opponent)
    if not opponent_path.exists():
        print(
            "[6max-SelfPlay] Opponent checkpoint not found, using hero copy: "
            f"{opponent_path}"
        )
        return _build_hero_copy_opponent(hero, cfg, device)

    if opponent_path.suffix.lower() == ".onnx":
        try:
            opponent = OnnxOpponentAgent(opponent_path, device=device)
        except Exception as exc:
            print(f"[6max-SelfPlay] ONNX opponent failed, using hero copy: {exc}")
            return _build_hero_copy_opponent(hero, cfg, device)
        print(f"[6max-SelfPlay] ONNX opponent: {opponent_path}")
        return opponent

    try:
        opponent = DQNAgent.load(str(opponent_path), device=device)
    except Exception as exc:
        print(
            "[6max-SelfPlay] Opponent checkpoint load failed, using hero copy: "
            f"{opponent_path} ({exc})"
        )
        return _build_hero_copy_opponent(hero, cfg, device)

    if not _agent_network_shapes_match(hero, opponent):
        print(
            "[6max-SelfPlay] Opponent checkpoint incompatible with hero network, "
            f"using hero copy: {opponent_path}"
        )
        return _build_hero_copy_opponent(hero, cfg, device)

    print(f"[6max-SelfPlay] Opponent checkpoint: {opponent_path}")
    return opponent


def hero_position_name(hero_seat: int, dealer_seat: int) -> str:
    """Return table position name for hero relative to the dealer/button."""
    offset = (hero_seat - dealer_seat) % len(POSITION_NAMES_BY_BUTTON_OFFSET)
    return POSITION_NAMES_BY_BUTTON_OFFSET[offset]


def _recent_mean(values, n: int) -> float:
    recent = list(values)[-n:]
    return float(sum(recent) / max(1, len(recent)))


def _format_position_rewards(pos_name_rewards: dict[str, deque[float]], window: int) -> str:
    return "posEV[" + " ".join(
        f"{name}={_recent_mean(pos_name_rewards[name], window):.2f}"
        for name in POSITION_LOG_ORDER
        if pos_name_rewards[name]
    ) + "]"


def _position_ev_snapshot(pos_name_rewards: dict[str, deque[float]], window: int) -> dict[str, float | None]:
    return {
        name: (_recent_mean(pos_name_rewards[name], window) if pos_name_rewards[name] else None)
        for name in POSITION_LOG_ORDER
    }


def _position_ev_warning(
    pos_name_rewards: dict[str, deque[float]],
    *,
    window: int,
    min_samples: int = 20,
) -> str:
    btn = pos_name_rewards.get("BTN", deque())
    co = pos_name_rewards.get("CO", deque())
    utg = pos_name_rewards.get("UTG", deque())
    warnings = []
    if len(btn) < min_samples or len(utg) < min_samples:
        pass
    else:
        btn_ev = _recent_mean(btn, window)
        utg_ev = _recent_mean(utg, window)
        if btn_ev < utg_ev:
            warnings.append(f"BTN_EV<UTG_EV({btn_ev:.2f}<{utg_ev:.2f})")
    if len(btn) >= min_samples and len(co) >= min_samples:
        btn_ev = _recent_mean(btn, window)
        co_ev = _recent_mean(co, window)
        if btn_ev < co_ev:
            warnings.append(f"BTN_EV<CO_EV({btn_ev:.2f}<{co_ev:.2f})")
    return "".join(f" ⚠ {warning}" for warning in warnings)


def _build_summary(
    *,
    cfg: SixMaxSelfPlayConfig,
    global_step: int,
    rewards: deque[float],
    pos_rewards: list[deque[float]],
    pos_name_rewards: dict[str, deque[float]],
    action_telemetry: SixMaxActionTelemetry,
    opponent_updates: int,
    latest: Path,
) -> dict:
    return {
        "episodes": int(cfg.total_episodes),
        "global_steps": int(global_step),
        "avg_reward_last_100": _recent_mean(rewards, 100),
        "position_avg_rewards": {
            f"pos_{i}": _recent_mean(pos_rewards[i], 500)
            for i in range(6)
        },
        "position_name_avg_rewards": {
            name: _recent_mean(pos_name_rewards[name], 1000)
            for name in POSITION_NAMES_BY_BUTTON_OFFSET
        },
        "position_ev": _position_ev_snapshot(pos_name_rewards, 1000),
        "position_ev_warning": _position_ev_warning(pos_name_rewards, window=1000),
        **action_telemetry.summary(),
        "opponent_updates": int(opponent_updates),
        "pretrained": cfg.pretrained,
        "pretrained_opponent": cfg.pretrained_opponent,
        "resume_continuation": bool(cfg.resume_continuation),
        "resume_epsilon": float(cfg.resume_epsilon),
        "epsilon_start_effective": _effective_epsilon_start(cfg),
        "epsilon_end": float(cfg.epsilon_end),
        "teacher_warmup_episodes": _effective_teacher_warmup_episodes(cfg),
        "teacher_warmup_skipped": _teacher_warmup_skipped(cfg),
        "checkpoint": str(latest),
        "obs_dim": 96,
        "n_actions": 6,
        "hidden_dim": cfg.hidden_dim,
    }


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


def _margin_batch_size(cfg: SixMaxSelfPlayConfig) -> int:
    return max(32, cfg.batch_size // 4)


def _apply_good_fold_margin_updates(
    *,
    hero: DQNAgent,
    fold_buffer: ReplayBuffer,
    cfg: SixMaxSelfPlayConfig,
    margin_batch: int,
) -> tuple[float | None, dict[int, float]]:
    if len(fold_buffer) < margin_batch:
        return None, {}

    batch = fold_buffer.sample(margin_batch)
    losses: list[float] = []
    satisfied_by_action: dict[int, float] = {}
    for avoid_action in (CALL, RAISE):
        loss, satisfied = hero.action_margin_update(
            batch,
            avoid_action=avoid_action,
            margin=cfg.fold_margin,
            loss_weight=cfg.fold_margin_weight,
        )
        losses.append(loss)
        satisfied_by_action[avoid_action] = satisfied
    return float(sum(losses) / len(losses)), satisfied_by_action


def _maybe_imitation_update(
    *,
    cfg: SixMaxSelfPlayConfig,
    hero: DQNAgent,
    expert: ReplayBuffer,
) -> tuple[float | None, float | None, bool]:
    if cfg.resume_continuation:
        return None, None, False

    expert_bs = int(round(cfg.batch_size * cfg.expert_replay_ratio))
    if expert_bs <= 0 or len(expert) < expert_bs:
        return None, None, False

    imitation_loss, imitation_accuracy = hero.imitation_update(
        expert.sample(expert_bs),
        loss_weight=cfg.imitation_loss_weight,
    )
    return imitation_loss, imitation_accuracy, True


def _teacher_warmup(
    cfg: SixMaxSelfPlayConfig,
    hero: DQNAgent,
    replay: ReplayBuffer,
    expert: ReplayBuffer,
    fold_buffer: ReplayBuffer,
    call_buffer: ReplayBuffer,
) -> None:
    """Fill replay with 6-player BadugiEnv transitions.

    fold_buffer: good-fold states (reward > 0): trains Q(FOLD) > Q(CALL/RAISE).
    call_buffer: bad-fold states (reward < 0): trains Q(CALL) > Q(FOLD).
                   Stored with action=CALL so action_margin_update pushes
                   Q(CALL) above Q(FOLD) in states where hero folded wrongly.
    """
    teacher_warmup_episodes = _effective_teacher_warmup_episodes(cfg)
    print(f"[6max-SelfPlay] Teacher warm-up: {teacher_warmup_episodes} ep × 6 profiles")
    env = BadugiEnv(opponent_profile=cfg.teacher_profiles[0], table_size=6)
    for episode in range(1, teacher_warmup_episodes + 1):
        env.set_opponent_profile(cfg.teacher_profiles[(episode - 1) % len(cfg.teacher_profiles)])
        obs, _ = env.reset()
        for _ in range(cfg.max_steps_per_episode):
            mask = env.legal_action_mask()
            if np.random.random() < 0.25:
                legal = np.where(mask > 0)[0]
                action = int(np.random.choice(legal)) if len(legal) > 0 else 0
            else:
                if env.phase == "BET":
                    to_call = max(0, env.current_bet - env.player_bet)
                    action = 2 if to_call > 0 else 1
                else:
                    keep = _best_badugi_keep(env.player_hand)
                    action = min(3, len(env.player_hand) - len(keep))
            next_obs, reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            replay.add(obs, action, reward, next_obs, done, next_action_mask=mask)
            expert.add(obs, action, reward, next_obs, done, next_action_mask=mask)
            _add_fold_margin_transition(
                fold_buffer=fold_buffer,
                call_buffer=call_buffer,
                obs=obs,
                action=action,
                reward=reward,
                next_obs=next_obs,
                done=done,
                next_action_mask=mask,
            )
            obs = next_obs
            if done:
                break

    if cfg.imitation_pretrain_steps > 0 and len(expert) >= cfg.batch_size:
        for _ in range(cfg.imitation_pretrain_steps):
            hero.imitation_update(
                expert.sample(cfg.batch_size),
                loss_weight=cfg.imitation_loss_weight,
            )
    print(
        f"[6max-SelfPlay] Teacher done: replay={len(replay)} expert={len(expert)} "
        f"fold={len(fold_buffer)} call={len(call_buffer)}"
    )


def train_sixmax_selfplay_badugi_dqn(
    cfg: SixMaxSelfPlayConfig | None = None,
    device: str | torch.device = "cpu",
) -> dict:
    cfg = cfg or SixMaxSelfPlayConfig()
    output_dir = Path(cfg.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # pretrained があれば checkpoint の hidden_dim を自動検出してロード
    # なければ cfg.hidden_dim でフレッシュスタート
    hero_checkpoint_label = "fresh"
    if cfg.pretrained:
        pretrained_path = _resolve_checkpoint_path(cfg.pretrained)
        if pretrained_path.exists():
            hero = DQNAgent.load(str(pretrained_path), device=device)
            hero_checkpoint_label = str(pretrained_path)
            # lr / gamma / tau を上書き
            for pg in hero.optimizer.param_groups:
                pg["lr"] = cfg.learning_rate
            hero.gamma = 0.990
            hero.tau = 3e-3
            print(f"[6max-SelfPlay] Warm-started from {pretrained_path} "
                  f"(hidden_dim={hero.q_network.net[0].out_features})")
        else:
            print(f"[6max-SelfPlay] Pretrained not found: {pretrained_path} — fresh start")
            hero = DQNAgent(
                obs_dim=96, n_actions=6, device=device, hidden_dim=cfg.hidden_dim,
                hyperparams=DQNHyperParams(gamma=0.990, lr=cfg.learning_rate,
                                           batch_size=cfg.batch_size, tau=3e-3),
            )
    else:
        hero = DQNAgent(
            obs_dim=96, n_actions=6, device=device, hidden_dim=cfg.hidden_dim,
            hyperparams=DQNHyperParams(gamma=0.990, lr=cfg.learning_rate,
                                       batch_size=cfg.batch_size, tau=3e-3),
        )
    print(f"[6max-SelfPlay] Hero checkpoint: {hero_checkpoint_label}")

    opp = _load_initial_opponent_agent(cfg, hero, device)

    replay = ReplayBuffer(capacity=cfg.buffer_capacity)
    expert = ReplayBuffer(capacity=min(80_000, cfg.buffer_capacity // 4))
    # fold_buffer: good-fold states (shaping > 0) train Q(FOLD) > Q(CALL/RAISE)
    fold_buffer = ReplayBuffer(capacity=30_000, alpha=0.0)
    # call_buffer: bad-fold states (shaping < 0) train Q(CALL) > Q(FOLD)
    call_buffer = ReplayBuffer(capacity=15_000, alpha=0.0)

    epsilon_start_effective = _effective_epsilon_start(cfg)
    teacher_warmup_episodes = _effective_teacher_warmup_episodes(cfg)
    print(
        "[6max-SelfPlay] Continuation mode: "
        f"{'on' if cfg.resume_continuation else 'off'} "
        f"epsilon_start={epsilon_start_effective:.3f} "
        f"teacher_warmup_episodes={teacher_warmup_episodes}"
    )
    if teacher_warmup_episodes > 0:
        _teacher_warmup(cfg, hero, replay, expert, fold_buffer, call_buffer)
    else:
        skip_reason = "for continuation" if cfg.resume_continuation else "(0 episodes configured)"
        print(f"[6max-SelfPlay] Teacher warm-up skipped {skip_reason}")

    sp_env = SixMaxBadugiEnv(opp_epsilon=cfg.opp_epsilon)
    sp_env.set_agents(hero, opp)

    global_step = 0
    rewards: deque[float] = deque(maxlen=TELEMETRY_HISTORY_MAXLEN)
    # Position-stratified tracking (6 positions)
    pos_rewards: list[deque[float]] = [deque(maxlen=TELEMETRY_HISTORY_MAXLEN) for _ in range(6)]
    pos_name_rewards: dict[str, deque[float]] = {
        name: deque(maxlen=TELEMETRY_HISTORY_MAXLEN)
        for name in POSITION_NAMES_BY_BUTTON_OFFSET
    }
    window_actions = SixMaxActionTelemetry(max_draw_count=4, position_names=POSITION_NAMES_BY_BUTTON_OFFSET)
    total_actions = SixMaxActionTelemetry(max_draw_count=4, position_names=POSITION_NAMES_BY_BUTTON_OFFSET)
    loss = mean_q = imitation_loss = imitation_accuracy = fold_margin_loss = 0.0
    opponent_updates = 0
    t_start = time.time()

    print(f"[6max-SelfPlay] Starting: {cfg.total_episodes} episodes, device={device}")

    for episode in range(1, cfg.total_episodes + 1):
        obs, _ = sp_env.reset()
        hero_seat = sp_env.hero_seat
        hero_position = hero_position_name(hero_seat, sp_env.dealer_seat)
        window_actions.start_episode(position=hero_position)
        total_actions.start_episode(position=hero_position)
        total_reward = 0.0
        episode_steps = 0
        terminal_reason: str | None = None
        episode_truncated = False
        episode_done = False
        epsilon = _episode_epsilon(cfg, episode)

        for _ in range(cfg.max_steps_per_episode):
            global_step += 1
            episode_steps += 1
            mask = sp_env.legal_action_mask()
            action = hero.act(obs, epsilon, action_mask=mask)

            if sp_env.phase == "BET":
                hero_state = sp_env.players[hero_seat]
                facing_bet = max(0, sp_env.current_bet - hero_state["bet"]) > 0 or mask[0] > 0
                street = betting_round_name(sp_env.draw_round)
                no_voluntary_action = (
                    sp_env.draw_round == 0
                    and pre_draw_no_voluntary_action_before_hero(
                        players=sp_env.players,
                        dealer_seat=sp_env.dealer_seat,
                        hero_seat=hero_seat,
                    )
                )
                three_bet_opportunity = conservative_three_bet_opportunity(
                    draw_round=sp_env.draw_round,
                    facing_bet=facing_bet,
                    raise_legal=mask[4] > 0,
                    raise_count=sp_env.raise_count,
                )
                steal_opportunity = conservative_steal_opportunity(
                    position=hero_position,
                    betting_round=street,
                    no_voluntary_action_before_hero=no_voluntary_action,
                    bet_legal=mask[3] > 0,
                    raise_legal=mask[4] > 0,
                )
                blind_pressure_opportunity = blind_pre_draw_pressure_opportunity(
                    position=hero_position,
                    betting_round=street,
                    facing_bet=facing_bet,
                    fold_legal=mask[0] > 0,
                )
                for telemetry in (window_actions, total_actions):
                    telemetry.record_bet(
                        action,
                        facing_bet=facing_bet,
                        position=hero_position,
                        betting_round=street,
                        is_pre_draw=sp_env.draw_round == 0,
                        three_bet_opportunity=three_bet_opportunity,
                        steal_opportunity=steal_opportunity,
                        blind_pressure_opportunity=blind_pressure_opportunity,
                        hand_strength_class="unknown",
                    )
            elif sp_env.phase == "DRAW":
                draw_count = max(0, min(3, action))
                window_actions.record_draw(draw_count)
                total_actions.record_draw(draw_count)

            next_obs, reward, terminated, truncated, info = sp_env.step(action)
            done = terminated or truncated
            next_mask = sp_env.legal_action_mask()
            replay.add(obs, action, reward, next_obs, done, next_action_mask=next_mask)
            # ---- fold / call buffer fill (self-play) ----
            # After fold shaping was added to the env, hero-fold transitions are
            # done=True with reward = fold_shaping (positive good fold, negative bad fold).
            if action == FOLD and done:
                term = info.get("terminal_reason") if isinstance(info, dict) else None
                if term == "hero_fold":
                    _add_fold_margin_transition(
                        fold_buffer=fold_buffer,
                        call_buffer=call_buffer,
                        obs=obs,
                        action=action,
                        reward=reward,
                        next_obs=next_obs,
                        done=done,
                        next_action_mask=next_mask,
                    )
            # ---------------------------------------------
            obs = next_obs
            total_reward += float(reward)
            if done:
                episode_done = True
                episode_truncated = bool(truncated)
                terminal_reason = info.get("terminal_reason") or getattr(sp_env, "terminal_reason", None)

            if (
                global_step >= cfg.warmup_steps
                and len(replay) >= cfg.batch_size
                and global_step % max(1, cfg.train_every_steps) == 0
            ):
                batch, indices, is_weights = replay.sample(cfg.batch_size, return_meta=True)
                loss, mean_q, td_errors = hero.update(batch, weights=is_weights)
                window_actions.record_q(mean_q=mean_q)
                total_actions.record_q(mean_q=mean_q)
                replay.update_priorities(indices, td_errors)

                next_imitation_loss, next_imitation_accuracy, imitation_ran = _maybe_imitation_update(
                    cfg=cfg,
                    hero=hero,
                    expert=expert,
                )
                if imitation_ran:
                    imitation_loss = next_imitation_loss or 0.0
                    imitation_accuracy = next_imitation_accuracy or 0.0

                margin_batch = _margin_batch_size(cfg)
                if global_step % cfg.fold_margin_interval == 0:
                    # Good-fold states: Q(FOLD) > Q(CALL) and Q(FOLD) > Q(RAISE).
                    next_fold_margin_loss, _ = _apply_good_fold_margin_updates(
                        hero=hero,
                        fold_buffer=fold_buffer,
                        cfg=cfg,
                        margin_batch=margin_batch,
                    )
                    if next_fold_margin_loss is not None:
                        fold_margin_loss = next_fold_margin_loss
                    if len(call_buffer) >= margin_batch:
                        # Bad-fold states: Q(CALL) > Q(FOLD) by margin.
                        hero.action_margin_update(
                            call_buffer.sample(margin_batch),
                            avoid_action=FOLD,
                            margin=cfg.call_margin,
                            loss_weight=cfg.call_margin_weight,
                        )

            if done:
                break

        rewards.append(total_reward)
        pos_rewards[hero_seat % 6].append(total_reward)
        pos_name_rewards[hero_position].append(total_reward)
        max_step_hit = not episode_done
        if max_step_hit:
            terminal_reason = "truncated"
        for telemetry in (window_actions, total_actions):
            telemetry.record_episode(
                reward=total_reward,
                length=episode_steps,
                terminal_reason=terminal_reason,
                truncated=episode_truncated or max_step_hit,
                max_step_hit=max_step_hit,
                position=hero_position,
            )

        if episode % cfg.opponent_update_interval == 0:
            opp.q_network.load_state_dict(hero.q_network.state_dict())
            opp.target_network.load_state_dict(hero.target_network.state_dict())
            opponent_updates += 1

        if cfg.log_interval > 0 and episode % cfg.log_interval == 0:
            recent = list(rewards)[-cfg.log_interval:]
            action_rates = window_actions.rates(
                include_all_in=True,
                include_fold_to_bet=True,
                include_draw_average=True,
            )
            elapsed = time.time() - t_start
            eps_per_sec = episode / max(1, elapsed)
            eta_h = (cfg.total_episodes - episode) / max(1, eps_per_sec) / 3600

            warn = ""
            if action_rates["foldRate"] > 0.60:
                warn += " ⚠ HIGH-FOLD"
            if action_rates["aggressionRate"] < 0.04:
                warn += " ⚠ LOW-AGGRESSION"
            warn += _position_ev_warning(pos_name_rewards, window=200)

            # Per-position reward (last N samples per position)
            pos_str = " ".join(
                f"p{i}={_recent_mean(pos_rewards[i], 200):.2f}"
                for i in range(6) if pos_rewards[i]
            )
            pos_name_str = _format_position_rewards(pos_name_rewards, 200)
            print(
                f"[6max {episode:8d}] avg={sum(recent)/len(recent):8.3f} "
                f"ε={epsilon:.3f} buf={len(replay):7d} "
                f"loss={loss:.5f} q={mean_q:.3f} "
                f"{window_actions.format_log(include_all_in=True, include_fold_to_bet=True, include_draw_average=True, include_foundation=True)} "
                f"opp_upd={opponent_updates} "
                f"spd={eps_per_sec:.1f}ep/s ETA={eta_h:.1f}h "
                f"{pos_str} {pos_name_str}{warn}"
            )
            window_actions = SixMaxActionTelemetry(max_draw_count=4, position_names=POSITION_NAMES_BY_BUTTON_OFFSET)

        if cfg.save_interval > 0 and episode % cfg.save_interval == 0:
            ts = time.strftime("%Y%m%d-%H%M%S")
            ckpt = output_dir / f"badugi_sixmax_dqn_{episode:07d}_{ts}.pt"
            hero.save(str(ckpt))
            hero.save(str(output_dir / "badugi_sixmax_dqn_latest.pt"))
            # Per-position reward summary at checkpoint
            pos_avg = {
                f"pos_{i}": _recent_mean(pos_rewards[i], 1000)
                for i in range(6)
            }
            pos_name_avg = {
                name: _recent_mean(pos_name_rewards[name], 1000)
                for name in POSITION_NAMES_BY_BUTTON_OFFSET
            }
            latest = output_dir / "badugi_sixmax_dqn_latest.pt"
            summary = _build_summary(
                cfg=cfg,
                global_step=global_step,
                rewards=rewards,
                pos_rewards=pos_rewards,
                pos_name_rewards=pos_name_rewards,
                action_telemetry=total_actions,
                opponent_updates=opponent_updates,
                latest=latest,
            )
            (output_dir / "badugi_sixmax_dqn_latest_summary.json").write_text(
                json.dumps(summary, indent=2) + "\n", encoding="utf8"
            )
            print(f"[6max-SelfPlay] Saved → {ckpt} | pos_avgs={pos_avg} pos_name_avgs={pos_name_avg}")

    latest = output_dir / "badugi_sixmax_dqn_latest.pt"
    hero.save(str(latest))

    summary = _build_summary(
        cfg=cfg,
        global_step=global_step,
        rewards=rewards,
        pos_rewards=pos_rewards,
        pos_name_rewards=pos_name_rewards,
        action_telemetry=total_actions,
        opponent_updates=opponent_updates,
        latest=latest,
    )
    (output_dir / "badugi_sixmax_dqn_latest_summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf8"
    )
    print(f"[6max-SelfPlay] Done → {latest}")
    return summary


def parse_args():
    parser = argparse.ArgumentParser(description="6-max self-play DQN for Badugi Iron.")
    parser.add_argument("--episodes", type=int, default=SixMaxSelfPlayConfig.total_episodes)
    parser.add_argument("--pretrained", default=SixMaxSelfPlayConfig.pretrained)
    parser.add_argument("--pretrained-opponent", default=SixMaxSelfPlayConfig.pretrained_opponent)
    parser.add_argument("--output-dir", default=SixMaxSelfPlayConfig.output_dir)
    parser.add_argument("--save-interval", type=int, default=SixMaxSelfPlayConfig.save_interval)
    parser.add_argument("--log-interval", type=int, default=SixMaxSelfPlayConfig.log_interval)
    parser.add_argument("--opponent-update-interval", type=int, default=SixMaxSelfPlayConfig.opponent_update_interval)
    parser.add_argument("--opp-epsilon", type=float, default=SixMaxSelfPlayConfig.opp_epsilon)
    parser.add_argument("--hidden-dim", type=int, default=SixMaxSelfPlayConfig.hidden_dim)
    parser.add_argument("--batch-size", type=int, default=SixMaxSelfPlayConfig.batch_size)
    parser.add_argument("--buffer-capacity", type=int, default=SixMaxSelfPlayConfig.buffer_capacity)
    parser.add_argument("--teacher-warmup-episodes", type=int, default=None)
    parser.add_argument("--resume-continuation", action="store_true")
    parser.add_argument("--resume-epsilon", type=float, default=SixMaxSelfPlayConfig.resume_epsilon)
    parser.add_argument(
        "--resume-epsilon-decay-episodes",
        type=int,
        default=SixMaxSelfPlayConfig.resume_epsilon_decay_episodes,
    )
    parser.add_argument("--device", default=None)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    cfg = SixMaxSelfPlayConfig(
        total_episodes=args.episodes,
        pretrained=args.pretrained,
        pretrained_opponent=args.pretrained_opponent,
        output_dir=args.output_dir,
        save_interval=args.save_interval,
        log_interval=args.log_interval,
        opponent_update_interval=args.opponent_update_interval,
        opp_epsilon=args.opp_epsilon,
        hidden_dim=args.hidden_dim,
        batch_size=args.batch_size,
        buffer_capacity=args.buffer_capacity,
        teacher_warmup_episodes=args.teacher_warmup_episodes,
        resume_continuation=args.resume_continuation,
        resume_epsilon=args.resume_epsilon,
        resume_epsilon_decay_episodes=args.resume_epsilon_decay_episodes,
    )
    print(
        f"[6max-SelfPlay] device={device} episodes={cfg.total_episodes} "
        f"pretrained={cfg.pretrained!r} pretrained_opponent={cfg.pretrained_opponent!r}"
    )
    train_sixmax_selfplay_badugi_dqn(cfg=cfg, device=device)
