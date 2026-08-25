"""Train DQN checkpoints for 2-7 and A-5 draw lowball policies."""

from __future__ import annotations

import argparse
import json
import os
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
from rl.utils.replay_buffer import ReplayBuffer


@dataclass
class DrawTrainConfig:
    family: str = "low-27"
    total_episodes: int = 10_000
    max_steps_per_episode: int = 80
    buffer_capacity: int = 120_000
    warmup_steps: int = 2_000
    batch_size: int = 64
    epsilon_start: float = 0.8
    epsilon_end: float = 0.06
    epsilon_decay_episodes: int = 8_000
    teacher_warmup_episodes: int = 1_000
    imitation_pretrain_steps: int = 300
    expert_replay_ratio: float = 0.35
    imitation_loss_weight: float = 0.65
    # Imitation loss is annealed from imitation_loss_weight down to
    # imitation_loss_weight_end over imitation_anneal_episodes.
    # This lets the teacher bootstrap early without suppressing RL correction later.
    imitation_loss_weight_end: float = 0.10
    imitation_anneal_episodes: int = 6_000
    # Fold Q-margin: push Q(fold) > Q(call) + fold_margin for fold-worthy states.
    # Call Q-margin: symmetric push Q(call) > Q(fold) + call_margin for
    # call-worthy states (e.g. ace-holding strong-draw hands in 2-7).
    # Both run every fold_margin_interval steps to prevent over-generalisation.
    fold_margin: float = 0.10
    call_margin: float = 0.10
    fold_margin_weight: float = 0.35
    fold_margin_interval: int = 5
    output_dir: str = "rl/models/draw"
    hidden_dim: int = 192
    learning_rate: float = 1e-4
    train_every_steps: int = 3
    save_interval: int = 5_000
    log_interval: int = 500
    opponent_profiles: tuple[str, ...] = ("beginner", "standard", "tight", "loose", "aggressive")
    max_draws: int = 3
    fixture_replay_copies: int = 80


def _card(rank: int, suit: int):
    return (rank, suit)


def add_draw_fixture_examples(env: DrawLowballEnv, replay: ReplayBuffer, expert: ReplayBuffer, copies: int):
    if copies <= 0:
        return
    fixtures = []
    if env.family == "low-27":
        fixtures = [
            ([_card(7, 0), _card(5, 1), _card(4, 2), _card(3, 3), _card(2, 0)], 5),
            ([_card(13, 0), _card(13, 1), _card(8, 2), _card(5, 3), _card(2, 0)], 7),
            ([_card(7, 0), _card(6, 1), _card(5, 2), _card(4, 3), _card(3, 0)], 6),
            ([_card(9, 0), _card(8, 0), _card(6, 0), _card(4, 0), _card(2, 0)], 6),
        ]
    else:
        fixtures = [
            ([_card(14, 0), _card(2, 0), _card(3, 0), _card(4, 0), _card(5, 0)], 5),
            ([_card(14, 0), _card(14, 1), _card(6, 2), _card(4, 3), _card(2, 0)], 6),
            ([_card(12, 0), _card(9, 1), _card(7, 2), _card(4, 3), _card(2, 0)], 6),
        ]
    for _ in range(copies):
        for hand, action in fixtures:
            env.reset()
            env.phase = "DRAW"
            env.hero_hand = list(hand)
            obs = env._observation()
            next_obs = obs.copy()
            replay.add(obs, action, 0.2, next_obs, False, next_action_mask=env.legal_action_mask())
            expert.add(obs, action, 0.2, next_obs, False, next_action_mask=env.legal_action_mask())
        for obs, action in _bet_phase_ace_hand_fixtures(env.family):
            # BET phase: teach that ace-holding hands in 2-7 (or high-card hands in A-5)
            # should CALL when facing a raise, not fold.
            mask = np.zeros(11, dtype=np.float32)
            mask[0] = 1.0  # fold legal
            mask[2] = 1.0  # call legal
            mask[4] = 1.0  # raise legal
            replay.add(obs, action, 0.3, obs, False, next_action_mask=mask)
            expert.add(obs, action, 0.3, obs, False, next_action_mask=mask)
        _add_fold_fixture_examples(env, replay, expert)
        for obs, action in _synthetic_gate_vectors(env.family):
            mask = np.zeros(11, dtype=np.float32)
            mask[5:] = 1.0
            replay.add(obs, action, 0.25, obs, False, next_action_mask=mask)
            expert.add(obs, action, 0.25, obs, False, next_action_mask=mask)


def _add_fold_fixture_examples(env: DrawLowballEnv, replay: ReplayBuffer, expert: ReplayBuffer):
    """Inject good-fold examples so the DQN learns folding is sometimes correct.

    The teacher only folds ~5% of the time, leaving the expert buffer almost
    devoid of fold examples.  Without explicit fold training data the DQN
    converges to a never-fold policy (reward-hacking the good-fold signal).
    Each example here is a genuinely weak hand facing a raise where pot odds
    exceed hero equity — folding earns the good-fold reward (+0.15).
    """
    from rl.env.draw_lowball_env import evaluate_lowball, _draw_adjusted_strength

    # Weak hands that should fold to a raise in every variant
    if env.family == "low-27":
        fold_hands = [
            # All high cards — eff ≈ 0.0
            [_card(14, 0), _card(13, 1), _card(12, 2), _card(11, 3), _card(10, 0)],
            [_card(14, 0), _card(13, 1), _card(9, 2), _card(8, 3), _card(7, 0)],
            [_card(13, 0), _card(12, 1), _card(11, 2), _card(10, 3), _card(9, 0)],
            # Pair of aces — eff ≈ 0.0 (structural + high)
            [_card(14, 0), _card(14, 1), _card(13, 2), _card(12, 3), _card(11, 0)],
            # NOTE: flush and straight hands are intentionally excluded here.
            # After fixing _draw_adjusted_strength those hands have real draw
            # equity and should be called, not folded.
        ]
    else:  # low-a5
        fold_hands = [
            # All high, no ace — eff ≈ 0.0
            [_card(13, 0), _card(12, 1), _card(11, 2), _card(10, 3), _card(9, 0)],
            [_card(11, 0), _card(10, 1), _card(9, 2),  _card(8, 3),  _card(7, 0)],
            # Pair of kings
            [_card(13, 0), _card(13, 1), _card(10, 2), _card(9, 3),  _card(8, 0)],
        ]

    # Bet scenarios: (current_bet, hero_bet, pot) → varying pot_odds
    # pot_odds = (current_bet-hero_bet) / (pot + current_bet - hero_bet)
    bet_scenarios = [
        (4, 1, 5),   # to_call=3, pot_odds ≈ 0.38
        (6, 1, 7),   # to_call=5, pot_odds ≈ 0.42
        (6, 2, 9),   # to_call=4, pot_odds ≈ 0.31
        (8, 2, 11),  # to_call=6, pot_odds ≈ 0.35
    ]

    action_fold = 0
    fold_reward = 0.15  # mirrors the good-fold reward in _apply_bet_action

    mask = np.zeros(11, dtype=np.float32)
    mask[0] = 1.0  # fold legal
    mask[2] = 1.0  # call legal

    for hand in fold_hands:
        for (current_bet, hero_bet, pot) in bet_scenarios:
            env.reset()
            env.phase = "BET"
            env.hero_hand = list(hand)
            env.current_bet = current_bet
            env.hero_bet = hero_bet
            env.pot = pot
            env.raise_count = 1

            # Verify this really is a good fold before adding
            feat = evaluate_lowball(list(hand), env.family)
            eff = _draw_adjusted_strength(list(hand), env.family, feat)
            to_call = current_bet - hero_bet
            pot_odds = to_call / max(1, pot + to_call)
            if eff >= pot_odds:
                continue  # skip: folding here would actually be wrong

            obs = env._observation()
            next_obs = obs.copy()
            replay.add(obs, action_fold, fold_reward, next_obs, True, next_action_mask=mask)
            expert.add(obs, action_fold, fold_reward, next_obs, True, next_action_mask=mask)


def _call_margin_examples(env: DrawLowballEnv) -> list[tuple[np.ndarray, int]]:
    """Real-env BET-phase observations for hands that should CALL, not fold.

    Used for the symmetric call-margin update that counteracts fold_margin
    over-generalising to ace-holding strong-draw hands.
    Action 2 = call.
    """
    if env.family == "low-27":
        call_hands = [
            # Ace + strong 4-card draw — fold ace, keep powerful low cards
            [_card(14, 0), _card(5, 1), _card(2, 2), _card(3, 3), _card(7, 0)],
            [_card(14, 0), _card(5, 0), _card(3, 1), _card(4, 2), _card(6, 3)],
            [_card(14, 1), _card(5, 0), _card(2, 0), _card(4, 3), _card(8, 2)],
        ]
    else:
        call_hands = [
            # A-5 lowball: ace is GOOD (=1), strong wheel draws
            [_card(14, 0), _card(5, 1), _card(2, 2), _card(3, 3), _card(4, 0)],
            [_card(14, 0), _card(3, 1), _card(2, 2), _card(4, 3), _card(5, 0)],
        ]

    bet_scenarios = [(4, 1, 7), (6, 2, 9), (4, 1, 5)]
    results = []
    for hand in call_hands:
        for (current_bet, hero_bet, pot) in bet_scenarios:
            env.reset()
            env.phase = "BET"
            env.hero_hand = list(hand)
            env.current_bet = current_bet
            env.hero_bet = hero_bet
            env.pot = pot
            env.raise_count = 1
            results.append((env._observation(), 2))
    return results


def _bet_phase_ace_hand_fixtures(family: str):
    """BET-phase observation vectors for ace-holding hands that should CALL, not fold.

    In 2-7 TD: A-5-x-x-x hands (ace will be discarded) have strong draw potential.
    In A-5:    similarly, high-card + low cards should continue, not fold.
    Action 2 = call.
    """
    def bet_obs(*, highest_rank: int, rank_sum: int, made_cards: int = 5,
                raise_count: int = 1, fam: str) -> np.ndarray:
        obs = np.zeros(96, dtype=np.float32)
        obs[1] = 1.0  # BET phase
        obs[15] = made_cards / 5.0
        obs[16] = highest_rank / 14.0
        obs[17] = rank_sum / 70.0
        obs[25] = 4.0 / 20.0  # current_bet=4 (after a raise)
        obs[26] = raise_count / 4.0
        obs[41] = 1.0 if fam == "low-27" else 0.0
        obs[42] = 1.0 if fam == "low-a5" else 0.0
        return obs

    action_call = 2
    if family == "low-27":
        # A(14)-5-2-3-7: keep=[5,2,3,7] after discarding ace → strong draw
        return [
            (bet_obs(highest_rank=14, rank_sum=31, fam="low-27"), action_call),
            (bet_obs(highest_rank=14, rank_sum=27, fam="low-27"), action_call),  # A-5-2-3-6
            (bet_obs(highest_rank=14, rank_sum=33, fam="low-27"), action_call),  # A-5-4-3-7
            (bet_obs(highest_rank=13, rank_sum=27, fam="low-27"), action_call),  # K-5-2-3-7
        ]
    else:
        # A-5 variant: high card + good lows should call
        return [
            (bet_obs(highest_rank=9, rank_sum=21, fam="low-a5"), action_call),   # 9+A2345 style
            (bet_obs(highest_rank=7, rank_sum=17, fam="low-a5"), action_call),   # 7-low draw
        ]


def _synthetic_gate_vectors(family: str):
    def vector(
        *,
        made_cards: int,
        highest_rank: int,
        rank_sum: int,
        duplicate_ranks: int = 0,
        duplicate_suits: int = 0,
        straight: bool = False,
        flush: bool = False,
    ):
        obs = np.zeros(96, dtype=np.float32)
        obs[2] = 1.0
        obs[15] = made_cards / 5.0
        obs[16] = highest_rank / 14.0
        obs[17] = rank_sum / 70.0
        obs[18] = duplicate_ranks / 4.0
        obs[19] = duplicate_suits / 4.0
        obs[20] = 1.0 if straight else 0.0
        obs[21] = 1.0 if flush else 0.0
        obs[22] = 1.0
        obs[41] = 1.0 if family == "low-27" else 0.0
        obs[42] = 1.0 if family == "low-a5" else 0.0
        obs[53:59] = 1.0
        return obs

    if family == "low-27":
        return [
            (vector(made_cards=5, highest_rank=7, rank_sum=21), 5),
            (vector(made_cards=3, highest_rank=13, rank_sum=38, duplicate_ranks=1), 6),
            (vector(made_cards=4, highest_rank=7, rank_sum=25, straight=True), 6),
        ]
    return [
        (vector(made_cards=5, highest_rank=5, rank_sum=15, straight=True), 5),
        (vector(made_cards=5, highest_rank=5, rank_sum=15, straight=True, flush=True), 5),
        (vector(made_cards=3, highest_rank=12, rank_sum=34, duplicate_ranks=1), 6),
    ]


def linear_decay(episode: int, start: float, end: float, decay_episodes: int) -> float:
    if episode >= decay_episodes:
        return end
    frac = episode / float(decay_episodes)
    return start + frac * (end - start)


def linear_epsilon_decay(episode: int, start_eps: float, end_eps: float, decay_episodes: int) -> float:
    return linear_decay(episode, start_eps, end_eps, decay_episodes)


def train_draw_dqn(cfg: DrawTrainConfig | None = None, device: str | torch.device = "cpu"):
    cfg = cfg or DrawTrainConfig()
    output_dir = Path(cfg.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    env = DrawLowballEnv(family=cfg.family, opponent_profile=cfg.opponent_profiles[0], max_draws=cfg.max_draws)
    obs, _ = env.reset()
    obs_dim = int(np.prod(env.observation_space.shape))
    n_actions = env.action_space.n
    agent = DQNAgent(
        obs_dim=obs_dim,
        n_actions=n_actions,
        device=device,
        hidden_dim=cfg.hidden_dim,
        hyperparams=DQNHyperParams(gamma=0.985, lr=cfg.learning_rate, batch_size=cfg.batch_size, tau=5e-3),
    )
    replay = ReplayBuffer(capacity=cfg.buffer_capacity)
    expert = ReplayBuffer(capacity=cfg.buffer_capacity)
    # Dedicated fold buffer: only good-fold examples.
    # Sampled independently to enforce Q(fold) > Q(call) via margin update,
    # which stays effective even after imitation weight anneals to near zero.
    fold_buffer = ReplayBuffer(capacity=10_000, alpha=0.0)
    global_step = 0
    rewards: list[float] = []
    imitation_loss = 0.0
    imitation_accuracy = 0.0
    fold_margin_loss = 0.0

    for episode in range(1, cfg.teacher_warmup_episodes + 1):
        env.set_opponent_profile(cfg.opponent_profiles[(episode - 1) % len(cfg.opponent_profiles)])
        obs, _ = env.reset()
        for _ in range(cfg.max_steps_per_episode):
            action = draw_teacher_action(env)
            next_obs, reward, terminated, truncated, _info = env.step(action)
            done = terminated or truncated
            item = (obs, action, reward, next_obs, done, env.legal_action_mask())
            replay.add(*item[:-1], next_action_mask=item[-1])
            expert.add(*item[:-1], next_action_mask=item[-1])
            # Also collect teacher folds into fold_buffer
            if action == 0:
                fold_buffer.add(*item[:-1], next_action_mask=item[-1])
            obs = next_obs
            if done:
                break
    add_draw_fixture_examples(env, replay, expert, cfg.fixture_replay_copies)
    # Populate fold_buffer with verified good-fold fixture examples
    _add_fold_fixture_examples(env, fold_buffer, fold_buffer)
    # call_buffer: ace + strong draw hands (e.g. A-5-2-3-7 in 2-7).
    # Repeated to roughly match fold_buffer density so both margin updates
    # have equal influence — prevents fold from over-generalising to good hands.
    call_buffer = ReplayBuffer(capacity=5_000, alpha=0.0)
    call_margin_obs = _call_margin_examples(env)
    for _ in range(30):
        for obs, action in call_margin_obs:
            call_buffer.add(obs, action, 0.3, obs, False)
    if cfg.imitation_pretrain_steps > 0:
        if len(expert) < cfg.batch_size:
            raise ValueError("Not enough teacher samples for imitation pretrain")
        for _ in range(cfg.imitation_pretrain_steps):
            imitation_loss, imitation_accuracy = agent.imitation_update(
                expert.sample(cfg.batch_size),
                loss_weight=cfg.imitation_loss_weight,
            )
    print(
        "[Draw teacher] "
        f"family={cfg.family} teacher_episodes={cfg.teacher_warmup_episodes} "
        f"expert={len(expert)} bc_loss={imitation_loss:.5f} bc_acc={imitation_accuracy:.3f}"
    )

    loss = 0.0
    mean_q = 0.0
    for episode in range(1, cfg.total_episodes + 1):
        env.set_opponent_profile(cfg.opponent_profiles[(episode - 1) % len(cfg.opponent_profiles)])
        obs, _ = env.reset()
        total_reward = 0.0
        epsilon = linear_epsilon_decay(episode, cfg.epsilon_start, cfg.epsilon_end, cfg.epsilon_decay_episodes)
        # Anneal imitation weight so teacher bootstraps early but RL can correct later.
        current_imitation_weight = linear_decay(
            episode, cfg.imitation_loss_weight, cfg.imitation_loss_weight_end, cfg.imitation_anneal_episodes
        )
        for _ in range(cfg.max_steps_per_episode):
            global_step += 1
            action = agent.act(obs, epsilon, action_mask=env.legal_action_mask())
            next_obs, reward, terminated, truncated, _info = env.step(action)
            done = terminated or truncated
            replay.add(obs, action, reward, next_obs, done, next_action_mask=env.legal_action_mask())
            obs = next_obs
            total_reward += float(reward)
            if (
                global_step >= cfg.warmup_steps
                and len(replay) >= cfg.batch_size
                and global_step % max(1, cfg.train_every_steps) == 0
            ):
                batch, indices, is_weights = replay.sample(cfg.batch_size, return_meta=True)
                loss, mean_q, td_errors = agent.update(batch, weights=is_weights)
                replay.update_priorities(indices, td_errors)
                expert_batch_size = int(round(cfg.batch_size * cfg.expert_replay_ratio))
                if expert_batch_size > 0 and len(expert) >= expert_batch_size:
                    imitation_loss, imitation_accuracy = agent.imitation_update(
                        expert.sample(expert_batch_size),
                        loss_weight=current_imitation_weight,
                    )
                # Margin updates: applied every fold_margin_interval steps.
                # fold_margin: Q(fold) > Q(call) + margin for weak hands
                # call_margin: Q(call) > Q(fold) + margin for strong-draw hands
                # Running both prevents fold from over-generalising to good hands.
                margin_batch = max(8, cfg.batch_size // 8)
                if global_step % cfg.fold_margin_interval == 0:
                    if len(fold_buffer) >= margin_batch:
                        fold_margin_loss, _ = agent.action_margin_update(
                            fold_buffer.sample(margin_batch),
                            avoid_action=2,
                            margin=cfg.fold_margin,
                            loss_weight=cfg.fold_margin_weight,
                        )
                    if len(call_buffer) >= margin_batch:
                        agent.action_margin_update(
                            call_buffer.sample(margin_batch),
                            avoid_action=0,   # push Q(call) above Q(fold)
                            margin=cfg.call_margin,
                            loss_weight=cfg.fold_margin_weight,
                        )
            if done:
                break
        rewards.append(total_reward)
        if cfg.log_interval > 0 and episode % cfg.log_interval == 0:
            recent = rewards[-cfg.log_interval :]
            print(
                f"[Draw {cfg.family} {episode:6d}] "
                f"avg_reward={sum(recent) / len(recent):8.3f} epsilon={epsilon:5.3f} "
                f"buffer={len(replay):7d} loss={loss:8.5f} mean_q={mean_q:8.3f} "
                f"bc_acc={imitation_accuracy:5.3f} imit_w={current_imitation_weight:.3f} fold_m={fold_margin_loss:.4f}"
            )
        if cfg.save_interval > 0 and episode % cfg.save_interval == 0:
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            checkpoint = output_dir / f"{cfg.family}_draw_dqn_{episode:06d}_{timestamp}.pt"
            agent.save(str(checkpoint))
            print(f"Saved model to {checkpoint}")

    latest = output_dir / f"{cfg.family}_draw_dqn_latest.pt"
    agent.save(str(latest))
    summary = {
        "family": cfg.family,
        "episodes": int(cfg.total_episodes),
        "global_steps": int(global_step),
        "avg_reward_last_100": float(sum(rewards[-100:]) / max(1, len(rewards[-100:]))),
        "opponent_profiles": list(cfg.opponent_profiles),
        "teacher_warmup_episodes": int(cfg.teacher_warmup_episodes),
        "imitation_pretrain_steps": int(cfg.imitation_pretrain_steps),
        "checkpoint": str(latest),
        "obs_dim": int(obs_dim),
        "n_actions": int(n_actions),
        "max_draws": int(cfg.max_draws),
    }
    summary_path = output_dir / f"{cfg.family}_draw_dqn_latest_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8")
    print(f"Saved latest model to {latest}")
    print(f"Saved summary to {summary_path}")
    return summary


def parse_args():
    parser = argparse.ArgumentParser(description="Train a 2-7/A-5 draw DQN checkpoint.")
    parser.add_argument("--family", choices=["low-27", "low-a5"], default=DrawTrainConfig.family)
    parser.add_argument("--episodes", type=int, default=DrawTrainConfig.total_episodes)
    parser.add_argument("--max-steps", type=int, default=DrawTrainConfig.max_steps_per_episode)
    parser.add_argument("--buffer-capacity", type=int, default=DrawTrainConfig.buffer_capacity)
    parser.add_argument("--warmup-steps", type=int, default=DrawTrainConfig.warmup_steps)
    parser.add_argument("--batch-size", type=int, default=DrawTrainConfig.batch_size)
    parser.add_argument("--epsilon-start", type=float, default=DrawTrainConfig.epsilon_start)
    parser.add_argument("--epsilon-end", type=float, default=DrawTrainConfig.epsilon_end)
    parser.add_argument("--epsilon-decay-episodes", type=int, default=DrawTrainConfig.epsilon_decay_episodes)
    parser.add_argument("--teacher-warmup-episodes", type=int, default=DrawTrainConfig.teacher_warmup_episodes)
    parser.add_argument("--imitation-pretrain-steps", type=int, default=DrawTrainConfig.imitation_pretrain_steps)
    parser.add_argument("--expert-replay-ratio", type=float, default=DrawTrainConfig.expert_replay_ratio)
    parser.add_argument("--imitation-loss-weight", type=float, default=DrawTrainConfig.imitation_loss_weight)
    parser.add_argument("--hidden-dim", type=int, default=DrawTrainConfig.hidden_dim)
    parser.add_argument("--learning-rate", type=float, default=DrawTrainConfig.learning_rate)
    parser.add_argument("--train-every-steps", type=int, default=DrawTrainConfig.train_every_steps)
    parser.add_argument("--output-dir", default=DrawTrainConfig.output_dir)
    parser.add_argument("--save-interval", type=int, default=DrawTrainConfig.save_interval)
    parser.add_argument("--log-interval", type=int, default=DrawTrainConfig.log_interval)
    parser.add_argument("--max-draws", type=int, default=DrawTrainConfig.max_draws)
    parser.add_argument("--fixture-replay-copies", type=int, default=DrawTrainConfig.fixture_replay_copies)
    parser.add_argument("--opponent-profiles", default=",".join(DrawTrainConfig.opponent_profiles))
    parser.add_argument("--device", default=None)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    cfg = DrawTrainConfig(
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
        expert_replay_ratio=args.expert_replay_ratio,
        imitation_loss_weight=args.imitation_loss_weight,
        hidden_dim=args.hidden_dim,
        learning_rate=args.learning_rate,
        train_every_steps=args.train_every_steps,
        output_dir=args.output_dir,
        save_interval=args.save_interval,
        log_interval=args.log_interval,
        max_draws=args.max_draws,
        fixture_replay_copies=args.fixture_replay_copies,
        opponent_profiles=tuple(item.strip() for item in args.opponent_profiles.split(",") if item.strip()),
    )
    print(f"Using device: {device}")
    train_draw_dqn(cfg=cfg, device=device)
