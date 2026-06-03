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
from datetime import datetime
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.agents.dqn_agent import DQNAgent
from rl.env.draw_lowball_env import (
    DRAW_OPPONENT_PROFILES,
    DrawLowballEnv,
    discard_indexes_for_family,
    evaluate_lowball,
)


DEFAULT_REPORT_DIR = PROJECT_ROOT / "reports/ai-eval"
FOLD_TO_BET_PREDRAW_ONLY_NOTE = (
    "foldToBetPct is currently pre-draw only because DrawLowballEnv uses a "
    "single-action-per-BET-round model."
)
DRAW_VARIANTS = {
    "D01": {"family": "low-27", "maxDraws": 3, "label": "2-7 Triple Draw"},
    "D02": {"family": "low-a5", "maxDraws": 3, "label": "A-5 Triple Draw"},
    "S01": {"family": "low-27", "maxDraws": 1, "label": "2-7 Single Draw"},
    "S02": {"family": "low-a5", "maxDraws": 1, "label": "A-5 Single Draw"},
}


def infer_variant_config(variant_id: str | None, family: str, max_draws: int | None) -> dict:
    if variant_id:
        normalized = variant_id.upper()
        if normalized not in DRAW_VARIANTS:
            raise ValueError(f"Unsupported draw variant id: {variant_id}")
        config = dict(DRAW_VARIANTS[normalized])
        config["variantId"] = normalized
    else:
        inferred_max_draws = 3 if max_draws is None else int(max_draws)
        config = {
            "variantId": "D01" if family == "low-27" and inferred_max_draws == 3 else (
                "D02" if family == "low-a5" and inferred_max_draws == 3 else (
                    "S01" if family == "low-27" else "S02"
                )
            ),
            "family": family,
            "maxDraws": inferred_max_draws,
            "label": f"{family} {'Triple Draw' if inferred_max_draws == 3 else 'Single Draw'}",
        }
    if max_draws is not None:
        config["maxDraws"] = max(1, min(3, int(max_draws)))
    return config


def is_strong_low(hand: list, family: str, max_draws: int) -> bool:
    features = evaluate_lowball(hand, family)
    if features.category != 0 or features.made_cards < 5:
        return False
    if family == "low-a5":
        return features.highest_rank <= 8
    return features.highest_rank <= (8 if max_draws == 3 else 9)


@dataclass
class ProfileResult:
    profile: str
    episodes: int
    wins: int
    losses: int
    draws: int
    showdowns: int
    showdown_wins: int
    folds: int
    opponent_folds: int
    draw_decisions: int
    pat_actions: int
    strong_low_draw_decisions: int
    strong_low_pats: int
    draw_correct: int
    draw_mistakes: int
    total_reward: float
    fold_to_bet_count: int = field(default=0)
    fold_opportunity_count: int = field(default=0)
    avg_reward: float = field(init=False)
    win_rate: float = field(init=False)
    showdown_win_rate: float = field(init=False)
    fold_rate: float = field(init=False)
    fold_to_bet_rate: float = field(init=False)
    pat_frequency: float = field(init=False)
    pat_rate_with_strong_low: float = field(init=False)
    draw_accuracy: float = field(init=False)
    draw_mistake_rate: float = field(init=False)

    def __post_init__(self):
        self.avg_reward = self.total_reward / max(1, self.episodes)
        self.win_rate = self.wins / max(1, self.episodes)
        self.showdown_win_rate = self.showdown_wins / max(1, self.showdowns)
        self.fold_rate = self.folds / max(1, self.episodes)
        self.fold_to_bet_rate = self.fold_to_bet_count / max(1, self.fold_opportunity_count)
        self.pat_frequency = self.pat_actions / max(1, self.draw_decisions)
        self.pat_rate_with_strong_low = self.strong_low_pats / max(1, self.strong_low_draw_decisions)
        self.draw_accuracy = self.draw_correct / max(1, self.draw_decisions)
        self.draw_mistake_rate = self.draw_mistakes / max(1, self.draw_decisions)


def evaluate_against_profiles(
    agent: DQNAgent,
    family: str = "low-27",
    variant_id: str = "D01",
    max_draws: int = 3,
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
            max_draws=max_draws,
            seed=seed,
        )
        wins = losses = draws = 0
        showdowns = showdown_wins = folds = opponent_folds = 0
        draw_decisions = pat_actions = 0
        strong_low_draw_decisions = strong_low_pats = 0
        draw_correct = draw_mistakes = 0
        fold_to_bet_count = fold_opportunity_count = 0
        total_reward = 0.0

        for episode in range(episodes_per_profile):
            obs, _ = env.reset(seed=seed + episode)
            episode_reward = 0.0
            terminal_info: dict = {}

            for _step in range(max_steps):
                _mask = env.legal_action_mask()
                action = agent.act(obs, epsilon=0.0, action_mask=_mask)
                if env.phase == "BET" and _mask[0] > 0:
                    fold_opportunity_count += 1
                    if action == 0:
                        fold_to_bet_count += 1
                if env.phase == "DRAW":
                    draw_count = max(0, min(5, action - 5))
                    ideal_draw_count = len(discard_indexes_for_family(env.hero_hand, env.family))
                    draw_decisions += 1
                    if draw_count == 0:
                        pat_actions += 1
                    if is_strong_low(env.hero_hand, env.family, env.max_draws):
                        strong_low_draw_decisions += 1
                        if draw_count == 0:
                            strong_low_pats += 1
                    if draw_count == ideal_draw_count:
                        draw_correct += 1
                    else:
                        draw_mistakes += 1
                obs, reward, terminated, truncated, info = env.step(action)
                episode_reward += float(reward)
                if terminated or truncated:
                    terminal_info = info
                    break

            total_reward += episode_reward

            # Classify episode outcome from terminal info and reward sign.
            if terminal_info.get("opponentFolded"):
                opponent_folds += 1
                wins += 1
            elif terminal_info.get("folded"):
                folds += 1
                losses += 1
            elif terminal_info.get("showdown"):
                showdowns += 1
                if episode_reward > 0.5:
                    wins += 1
                    showdown_wins += 1
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
                showdowns=showdowns,
                showdown_wins=showdown_wins,
                folds=folds,
                opponent_folds=opponent_folds,
                draw_decisions=draw_decisions,
                pat_actions=pat_actions,
                strong_low_draw_decisions=strong_low_draw_decisions,
                strong_low_pats=strong_low_pats,
                draw_correct=draw_correct,
                draw_mistakes=draw_mistakes,
                total_reward=total_reward,
                fold_to_bet_count=fold_to_bet_count,
                fold_opportunity_count=fold_opportunity_count,
            )
        )

    return results


def summarize_results(results: list[ProfileResult]) -> dict:
    episodes = sum(r.episodes for r in results)
    wins = sum(r.wins for r in results)
    losses = sum(r.losses for r in results)
    draws = sum(r.draws for r in results)
    showdowns = sum(r.showdowns for r in results)
    showdown_wins = sum(r.showdown_wins for r in results)
    folds = sum(r.folds for r in results)
    fold_to_bet_count = sum(r.fold_to_bet_count for r in results)
    fold_opportunity_count = sum(r.fold_opportunity_count for r in results)
    draw_decisions = sum(r.draw_decisions for r in results)
    pat_actions = sum(r.pat_actions for r in results)
    strong_low_draw_decisions = sum(r.strong_low_draw_decisions for r in results)
    strong_low_pats = sum(r.strong_low_pats for r in results)
    draw_correct = sum(r.draw_correct for r in results)
    draw_mistakes = sum(r.draw_mistakes for r in results)
    total_reward = sum(r.total_reward for r in results)
    worst_profile = min(results, key=lambda r: r.avg_reward, default=None)
    predraw_fold_to_bet_pct = fold_to_bet_count / max(1, fold_opportunity_count)
    return {
        "episodes": episodes,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "avgReward": total_reward / max(1, episodes),
        "winRate": wins / max(1, episodes),
        "showdowns": showdowns,
        "showdownWins": showdown_wins,
        "showdownWinRate": showdown_wins / max(1, showdowns),
        "folds": folds,
        "foldRate": folds / max(1, episodes),
        "predrawFoldToBetCount": fold_to_bet_count,
        "predrawFoldOpportunityCount": fold_opportunity_count,
        "predrawFoldToBetPct": predraw_fold_to_bet_pct,
        "foldToBetCount": fold_to_bet_count,
        "foldOpportunityCount": fold_opportunity_count,
        "foldToBetPct": predraw_fold_to_bet_pct,
        "drawDecisions": draw_decisions,
        "patActions": pat_actions,
        "patFrequency": pat_actions / max(1, draw_decisions),
        "strongLowDrawDecisions": strong_low_draw_decisions,
        "strongLowPats": strong_low_pats,
        "patRateWithStrongLow": strong_low_pats / max(1, strong_low_draw_decisions),
        "drawCorrect": draw_correct,
        "drawMistakes": draw_mistakes,
        "drawAccuracy": draw_correct / max(1, draw_decisions),
        "drawMistakeRate": draw_mistakes / max(1, draw_decisions),
        "worstProfile": worst_profile.profile if worst_profile else None,
        "worstProfileAvgReward": worst_profile.avg_reward if worst_profile else 0.0,
    }


def result_to_dict(result: ProfileResult) -> dict:
    return {
        "profile": result.profile,
        "episodes": result.episodes,
        "avgReward": result.avg_reward,
        "avg_reward": result.avg_reward,
        "winRate": result.win_rate,
        "win_rate": result.win_rate,
        "showdownWinRate": result.showdown_win_rate,
        "foldRate": result.fold_rate,
        "predrawFoldToBetCount": result.fold_to_bet_count,
        "predrawFoldOpportunityCount": result.fold_opportunity_count,
        "predrawFoldToBetPct": result.fold_to_bet_rate,
        "foldToBetCount": result.fold_to_bet_count,
        "foldOpportunityCount": result.fold_opportunity_count,
        "foldToBetPct": result.fold_to_bet_rate,
        "foldToBetRate": result.fold_to_bet_rate,
        "patFrequency": result.pat_frequency,
        "patRateWithStrongLow": result.pat_rate_with_strong_low,
        "drawAccuracy": result.draw_accuracy,
        "drawMistakeRate": result.draw_mistake_rate,
        "wins": result.wins,
        "losses": result.losses,
        "draws": result.draws,
        "showdowns": result.showdowns,
        "showdownWins": result.showdown_wins,
        "folds": result.folds,
        "opponentFolds": result.opponent_folds,
        "drawDecisions": result.draw_decisions,
        "patActions": result.pat_actions,
        "strongLowDrawDecisions": result.strong_low_draw_decisions,
        "strongLowPats": result.strong_low_pats,
        "drawCorrect": result.draw_correct,
        "drawMistakes": result.draw_mistakes,
    }


def print_report(results: list[ProfileResult], checkpoint: str, variant_id: str, family: str, max_draws: int) -> None:
    summary = summarize_results(results)
    print(f"\n{'=' * 62}")
    print(f"  Self-Play Evaluation — {variant_id} {family.upper()} max_draws={max_draws}")
    print(f"  Checkpoint: {checkpoint}")
    print(f"{'=' * 62}")
    print(f"  {'Profile':<12} {'Episodes':>8} {'Win%':>7} {'Show%':>7} {'Fold%':>7} {'Pat%':>7} {'DrawAcc':>7} {'AvgRew':>8}")
    print(f"  {'-' * 72}")
    for r in results:
        print(
            f"  {r.profile:<12} {r.episodes:>8} "
            f"{r.win_rate*100:>6.1f}% {r.showdown_win_rate*100:>6.1f}% "
            f"{r.fold_rate*100:>6.1f}% {r.pat_frequency*100:>6.1f}% "
            f"{r.draw_accuracy*100:>6.1f}% "
            f"{r.avg_reward:>8.3f}"
        )
    print(f"  {'-' * 72}")
    print(
        f"  {'OVERALL':<12} {summary['episodes']:>8} "
        f"{summary['winRate']*100:>6.1f}% {summary['showdownWinRate']*100:>6.1f}% "
        f"{summary['foldRate']*100:>6.1f}% {summary['patFrequency']*100:>6.1f}% "
        f"{summary['drawAccuracy']*100:>6.1f}% "
        f"{summary['avgReward']:>8.3f}"
    )
    print(f"  Worst profile: {summary['worstProfile']} avgReward={summary['worstProfileAvgReward']:.3f}")
    print(f"{'=' * 62}\n")


def build_report_payload(
    *,
    checkpoint_path: Path,
    variant_id: str,
    family: str,
    max_draws: int,
    episodes: int,
    max_steps: int,
    seed: int,
    profiles: tuple[str, ...],
    results: list[ProfileResult],
) -> dict:
    summary = summarize_results(results)
    return {
        "schemaVersion": "draw-lowball-selfplay-eval-v1",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "checkpoint": str(checkpoint_path),
        "variantId": variant_id,
        "family": family,
        "maxDraws": max_draws,
        "episodesPerProfile": episodes,
        "episodes_per_profile": episodes,
        "maxSteps": max_steps,
        "seed": seed,
        "profiles": [result_to_dict(r) for r in results],
        "summary": summary,
        "profileSummaries": {r.profile: result_to_dict(r) for r in results},
        "notes": [FOLD_TO_BET_PREDRAW_ONLY_NOTE],
        "metadata": {
            "notes": [FOLD_TO_BET_PREDRAW_ONLY_NOTE],
        },
        "overall_win_rate": summary["winRate"],
        "overall_avg_reward": summary["avgReward"],
    }


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

    variant_config = infer_variant_config(args.variant_id, args.family, args.max_draws)
    profiles = tuple(p.strip() for p in args.profiles.split(",") if p.strip())
    results = evaluate_against_profiles(
        agent=agent,
        family=variant_config["family"],
        variant_id=variant_config["variantId"],
        max_draws=variant_config["maxDraws"],
        episodes_per_profile=args.episodes,
        max_steps=args.max_steps,
        profiles=profiles,
        seed=args.seed,
    )

    print_report(
        results,
        str(checkpoint_path),
        variant_config["variantId"],
        variant_config["family"],
        variant_config["maxDraws"],
    )

    if args.json_out or args.write_report:
        json_path = Path(args.json_out) if args.json_out else (
            Path(args.report_dir)
            / f"draw-lowball-eval-{variant_config['variantId']}-{datetime.now().strftime('%Y%m%d')}.json"
        )
        if not json_path.is_absolute():
            json_path = PROJECT_ROOT / json_path
        json_path.parent.mkdir(parents=True, exist_ok=True)
        payload = build_report_payload(
            checkpoint_path=checkpoint_path,
            variant_id=variant_config["variantId"],
            family=variant_config["family"],
            max_draws=variant_config["maxDraws"],
            episodes=args.episodes,
            max_steps=args.max_steps,
            seed=args.seed,
            profiles=profiles,
            results=results,
        )
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
    parser.add_argument("--variant-id", choices=sorted(DRAW_VARIANTS), default=None)
    parser.add_argument("--max-draws", type=int, default=None)
    parser.add_argument("--episodes", type=int, default=500,
                        help="Episodes per opponent profile")
    parser.add_argument("--max-steps", type=int, default=80)
    parser.add_argument("--profiles", default=default_profiles,
                        help="Comma-separated list of profiles to evaluate against")
    parser.add_argument("--seed", type=int, default=20260601)
    parser.add_argument("--device", default=None)
    parser.add_argument("--json-out", default="",
                        help="Optional path to write a JSON evaluation report")
    parser.add_argument("--write-report", action="store_true")
    parser.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(main())
