"""Evaluate a self-play (or any draw DQN) checkpoint against fixed-profile opponents.

Loads a .pt checkpoint and runs it against each of the five standard opponent
profiles, reporting win_rate and avg_reward per profile and in aggregate.

Usage::

    # Evaluate the latest self-play checkpoint
    python src/rl/training/evaluate_selfplay_draw.py \\
        --checkpoint rl/models/draw/low-27_selfplay_dqn_latest.pt \\
        --family low-27

    # Compare against the standard single-agent checkpoint
    python src/rl/training/evaluate_selfplay_draw.py \\
        --checkpoint rl/models/draw/low-27_draw_dqn_latest.pt \\
        --family low-27 --episodes 2000

Exit code is 0 on success, 1 on missing checkpoint.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.agents.dqn_agent import DQNAgent
from rl.env.draw_lowball_env import DRAW_OPPONENT_PROFILES, DrawLowballEnv


@dataclass
class ProfileResult:
    profile: str
    episodes: int
    wins: int
    losses: int
    draws: int
    total_reward: float
    avg_reward: float = field(init=False)
    win_rate: float = field(init=False)

    def __post_init__(self):
        self.avg_reward = self.total_reward / max(1, self.episodes)
        self.win_rate = self.wins / max(1, self.episodes)


def evaluate_against_profiles(
    agent: DQNAgent,
    family: str = "low-27",
    episodes_per_profile: int = 500,
    max_steps: int = 80,
    profiles: tuple[str, ...] = ("beginner", "standard", "tight", "loose", "aggressive"),
    seed: int = 20260601,
) -> list[ProfileResult]:
    results: list[ProfileResult] = []

    for profile_name in profiles:
        env = DrawLowballEnv(
            family=family,
            opponent_profile=profile_name,
            max_draws=3,
            seed=seed,
        )
        wins = losses = draws = 0
        total_reward = 0.0

        for _ in range(episodes_per_profile):
            obs, _ = env.reset()
            episode_reward = 0.0
            terminal_info: dict = {}

            for _step in range(max_steps):
                action = agent.act(obs, epsilon=0.0, action_mask=env.legal_action_mask())
                obs, reward, terminated, truncated, info = env.step(action)
                episode_reward += float(reward)
                if terminated or truncated:
                    terminal_info = info
                    break

            total_reward += episode_reward

            # Classify episode outcome from terminal info and reward sign.
            if terminal_info.get("opponentFolded"):
                wins += 1
            elif terminal_info.get("folded"):
                losses += 1
            elif terminal_info.get("showdown"):
                if episode_reward > 0.5:
                    wins += 1
                elif episode_reward < -0.5:
                    losses += 1
                else:
                    draws += 1
            else:
                # Truncated or unknown — classify by reward sign.
                if episode_reward > 0.3:
                    wins += 1
                elif episode_reward < -0.3:
                    losses += 1
                else:
                    draws += 1

        results.append(
            ProfileResult(
                profile=profile_name,
                episodes=episodes_per_profile,
                wins=wins,
                losses=losses,
                draws=draws,
                total_reward=total_reward,
            )
        )

    return results


def print_report(results: list[ProfileResult], checkpoint: str, family: str) -> None:
    print(f"\n{'=' * 62}")
    print(f"  Self-Play Evaluation — {family.upper()}")
    print(f"  Checkpoint: {checkpoint}")
    print(f"{'=' * 62}")
    print(f"  {'Profile':<12} {'Episodes':>8} {'Win%':>7} {'Wins':>6} {'Losses':>7} {'AvgRew':>8}")
    print(f"  {'-' * 52}")

    total_ep = total_wins = 0
    total_rew = 0.0
    for r in results:
        print(
            f"  {r.profile:<12} {r.episodes:>8} "
            f"{r.win_rate*100:>6.1f}% {r.wins:>6} {r.losses:>7} "
            f"{r.avg_reward:>8.3f}"
        )
        total_ep += r.episodes
        total_wins += r.wins
        total_rew += r.total_reward

    overall_wr = total_wins / max(1, total_ep)
    overall_avg = total_rew / max(1, total_ep)
    print(f"  {'-' * 52}")
    print(
        f"  {'OVERALL':<12} {total_ep:>8} "
        f"{overall_wr*100:>6.1f}% {total_wins:>6} {'':>7} "
        f"{overall_avg:>8.3f}"
    )
    print(f"{'=' * 62}\n")


def main() -> int:
    args = _parse_args()

    checkpoint_path = Path(args.checkpoint)
    if not checkpoint_path.is_absolute():
        checkpoint_path = PROJECT_ROOT / checkpoint_path

    if not checkpoint_path.exists():
        print(f"[ERROR] Checkpoint not found: {checkpoint_path}", file=sys.stderr)
        return 1

    device = args.device or "cpu"
    agent = DQNAgent.load(str(checkpoint_path), device=device)

    profiles = tuple(p.strip() for p in args.profiles.split(",") if p.strip())
    results = evaluate_against_profiles(
        agent=agent,
        family=args.family,
        episodes_per_profile=args.episodes,
        max_steps=args.max_steps,
        profiles=profiles,
        seed=args.seed,
    )

    print_report(results, str(checkpoint_path), args.family)

    if args.json_out:
        json_path = Path(args.json_out)
        payload = {
            "checkpoint": str(checkpoint_path),
            "family": args.family,
            "episodes_per_profile": args.episodes,
            "profiles": [
                {
                    "profile": r.profile,
                    "win_rate": round(r.win_rate, 4),
                    "avg_reward": round(r.avg_reward, 4),
                    "wins": r.wins,
                    "losses": r.losses,
                    "draws": r.draws,
                }
                for r in results
            ],
            "overall_win_rate": round(
                sum(r.wins for r in results) / max(1, sum(r.episodes for r in results)), 4
            ),
            "overall_avg_reward": round(
                sum(r.total_reward for r in results) / max(1, sum(r.episodes for r in results)), 4
            ),
        }
        json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf8")
        print(f"JSON report saved → {json_path}")

    return 0


def _parse_args():
    default_profiles = ",".join(DRAW_OPPONENT_PROFILES.keys())
    parser = argparse.ArgumentParser(description="Evaluate a draw DQN checkpoint.")
    parser.add_argument(
        "--checkpoint", required=True,
        help="Path to .pt checkpoint (relative to project root or absolute)"
    )
    parser.add_argument("--family", choices=["low-27", "low-a5"], default="low-27")
    parser.add_argument("--episodes", type=int, default=500,
                        help="Episodes per opponent profile")
    parser.add_argument("--max-steps", type=int, default=80)
    parser.add_argument("--profiles", default=default_profiles,
                        help="Comma-separated list of profiles to evaluate against")
    parser.add_argument("--seed", type=int, default=20260601)
    parser.add_argument("--device", default=None)
    parser.add_argument("--json-out", default="",
                        help="Optional path to write a JSON evaluation report")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
