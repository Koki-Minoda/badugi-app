"""Clean 6-max Badugi DQN evaluation gate.

This evaluator is intentionally separate from training. It runs with
epsilon=0, no teacher warm-up, no opponent exploration, and records whether
decisions came from ONNX or a fallback path. Reports are written to
reports/ai-eval/ so friend/pro promotion decisions do not depend on raw
training reward alone.
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.env.badugi_env import resolve_opponent_profile
from rl.env.badugi_draw_policy import ideal_draw_count
from rl.env.badugi_env_selfplay import _evaluate_badugi_features
from rl.env.badugi_env_sixmax_profiled import (
    ProfiledSixMaxBadugiEnv,
    deterministic_profile_action,
)
from rl.env.badugi_env_sixmax_selfplay import (
    BET,
    CALL,
    CHECK,
    FOLD,
    NUM_PLAYERS,
    RAISE,
    SixMaxBadugiEnv,
)
from rl.training.export_badugi_dqn_onnx import export_checkpoint
from rl.training.gate_badugi_model import build_promotion_report, parse_csv, parse_seeds


DEFAULT_REPORT_DIR = PROJECT_ROOT / "reports/ai-eval"
DEFAULT_EVAL_ONNX_DIR = PROJECT_ROOT / "rl/evaluations/badugi_sixmax_clean"
DEFAULT_MILESTONES = (50_000, 100_000, 200_000, 500_000, 1_000_000)
DEFAULT_MIN_ONNX_USAGE_RATE = 0.99
DEFAULT_MAX_FALLBACK_RATE = 0.01
DEFAULT_PROFILES = (
    "balanced",
    "loose_passive",
    "loose_aggressive",
    "tight_passive",
    "tight_aggressive",
    "pat_heavy",
    "draw_heavy",
)
POSITION_LABELS = ("SB", "BB", "UTG", "MP", "CO", "BTN")


def checkpoint_episode(path: Path) -> int | None:
    for part in path.stem.split("_"):
        if part.isdigit():
            return int(part)
    return None


def parse_milestones(value: str) -> list[int]:
    milestones = [
        int(item.strip().lower().replace("k", "000").replace("m", "000000"))
        for item in value.split(",")
        if item.strip()
    ]
    if not milestones:
        raise argparse.ArgumentTypeError("at least one milestone is required")
    return milestones


def list_checkpoint_candidates(checkpoint_dir: Path, patterns: list[str]) -> list[Path]:
    seen: set[Path] = set()
    candidates: list[Path] = []
    for pattern in patterns:
        for path in checkpoint_dir.glob(pattern):
            if path.is_file() and path not in seen:
                seen.add(path)
                candidates.append(path)
    return sorted(candidates, key=lambda path: (checkpoint_episode(path) or -1, path.name))


def select_milestone_checkpoints(
    checkpoints: list[Path],
    milestones: list[int],
    *,
    allow_nearest: bool = False,
) -> tuple[list[dict], list[dict]]:
    by_episode: dict[int, Path] = {}
    for checkpoint in checkpoints:
        episode = checkpoint_episode(checkpoint)
        if episode is not None:
            by_episode[episode] = checkpoint

    selected: list[dict] = []
    missing: list[dict] = []
    used: set[Path] = set()
    available = sorted(by_episode)
    for milestone in milestones:
        checkpoint = by_episode.get(milestone)
        exact = checkpoint is not None
        if checkpoint is None and allow_nearest and available:
            nearest_episode = min(available, key=lambda episode: abs(episode - milestone))
            checkpoint = by_episode[nearest_episode]
        if checkpoint is None:
            missing.append({"milestone": milestone, "reason": "checkpoint-not-found"})
            continue
        if checkpoint in used:
            continue
        used.add(checkpoint)
        selected.append(
            {
                "milestone": milestone,
                "episode": checkpoint_episode(checkpoint),
                "checkpoint": checkpoint,
                "exact": exact,
            }
        )
    return selected, missing


def position_label(env: SixMaxBadugiEnv, seat: int) -> str:
    order = [(env.dealer_seat + 1 + i) % NUM_PLAYERS for i in range(NUM_PLAYERS)]
    try:
        return POSITION_LABELS[order.index(seat)]
    except ValueError:
        return "UNKNOWN"


def hand_strength_class(hand: list) -> str:
    features = _evaluate_badugi_features(hand)
    if features["count"] == 4 and features["highest_rank"] <= 7:
        return "strongMade"
    if features["count"] == 4 and features["highest_rank"] <= 9:
        return "mediumMade"
    if features["count"] == 4:
        return "weakMade"
    if features["count"] == 3 and features["highest_rank"] <= 8:
        return "strongDraw"
    if features["count"] == 3:
        return "draw"
    return "trash"


def legal_argmax(q_values: np.ndarray, action_mask: np.ndarray) -> int:
    q = np.asarray(q_values, dtype=np.float32).reshape(-1).copy()
    q[np.asarray(action_mask) <= 0] = -1e9
    return int(np.argmax(q))


@dataclass
class DecisionCounters:
    decisions: int = 0
    bet_decisions: int = 0
    draw_decisions: int = 0
    fold_actions: int = 0
    value_opportunities: int = 0
    value_bets: int = 0
    bluff_opportunities: int = 0
    bluffs: int = 0
    pat_actions: int = 0
    draw_correct: int = 0
    onnx_calls: int = 0
    fallback_actions: int = 0
    overlay_actions: int = 0
    action_counts: dict[str, int] = field(default_factory=lambda: {str(i): 0 for i in range(6)})

    def merge(self, other: "DecisionCounters") -> None:
        for key in (
            "decisions",
            "bet_decisions",
            "draw_decisions",
            "fold_actions",
            "value_opportunities",
            "value_bets",
            "bluff_opportunities",
            "bluffs",
            "pat_actions",
            "draw_correct",
            "onnx_calls",
            "fallback_actions",
            "overlay_actions",
        ):
            setattr(self, key, getattr(self, key) + getattr(other, key))
        for action, count in other.action_counts.items():
            self.action_counts[action] = self.action_counts.get(action, 0) + count

    def rates(self) -> dict:
        return {
            "valueBetRate": self.value_bets / self.value_opportunities if self.value_opportunities else 0.0,
            "bluffRate": self.bluffs / self.bluff_opportunities if self.bluff_opportunities else 0.0,
            "patFrequency": self.pat_actions / self.draw_decisions if self.draw_decisions else 0.0,
            "foldRate": self.fold_actions / self.bet_decisions if self.bet_decisions else 0.0,
            "drawDecisionAccuracy": self.draw_correct / self.draw_decisions if self.draw_decisions else 0.0,
            "onnxUsageRate": self.onnx_calls / self.decisions if self.decisions else 0.0,
            "fallbackRate": self.fallback_actions / self.decisions if self.decisions else 0.0,
            "proOverlayRate": self.overlay_actions / self.decisions if self.decisions else 0.0,
        }


class TorchPolicy:
    def __init__(self, checkpoint: Path, *, device: str = "cpu") -> None:
        import torch
        from rl.agents.dqn_agent import DQNAgent

        self.torch = torch
        self.agent = DQNAgent.load(str(checkpoint), device=device)
        self.device = device

    def act(self, obs: np.ndarray, action_mask: np.ndarray) -> int:
        with self.torch.no_grad():
            obs_t = self.torch.as_tensor(obs, dtype=self.torch.float32, device=self.device).reshape(1, -1)
            q_values = self.agent.q_network(obs_t).detach().cpu().numpy()[0]
        return legal_argmax(q_values, action_mask)


class OnnxPolicy:
    def __init__(self, model: Path) -> None:
        import onnxruntime as ort

        self.session = ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.input_shape = [dim if isinstance(dim, int) else None for dim in self.session.get_inputs()[0].shape]
        self.output_shape = [dim if isinstance(dim, int) else None for dim in self.session.get_outputs()[0].shape]

    def act(self, obs: np.ndarray, action_mask: np.ndarray) -> int:
        obs_batch = obs.astype(np.float32).reshape(1, -1)
        try:
            q_values = self.session.run([self.output_name], {self.input_name: obs_batch})[0]
        except Exception:
            q_values = self.session.run([self.output_name], {self.input_name: obs.astype(np.float32)})[0]
        return legal_argmax(np.asarray(q_values).reshape(-1), action_mask)


def pro_overlay_action(env: SixMaxBadugiEnv, raw_action: int, action_mask: np.ndarray) -> tuple[int, bool, str | None]:
    hand = env.players[env.hero_seat]["hand"]
    features = _evaluate_badugi_features(hand)
    if env.phase == "DRAW":
        target = ideal_draw_count(hand)
        if action_mask[target] > 0 and raw_action != target:
            return target, True, "clean-draw-policy"
        return raw_action, False, None

    to_call = max(0, env.current_bet - env.players[env.hero_seat]["bet"])
    strong_made = features["count"] == 4 and features["highest_rank"] <= 7
    medium_made = features["count"] == 4 and features["highest_rank"] <= 9
    weak = features["count"] < 3 or (features["count"] == 3 and features["highest_rank"] >= 10)
    final_round = env.draw_round >= 3

    if to_call > 0 and strong_made and action_mask[RAISE] > 0:
        return RAISE, raw_action != RAISE, "strong-made-value-raise"
    if to_call > 0 and (strong_made or medium_made) and action_mask[CALL] > 0:
        return CALL, raw_action != CALL, "made-hand-continue"
    if to_call > 0 and weak and final_round and action_mask[FOLD] > 0:
        return FOLD, raw_action != FOLD, "final-weak-fold"
    if to_call == 0 and strong_made and action_mask[BET] > 0:
        return BET, raw_action != BET, "strong-made-value-bet"
    return raw_action, False, None


def observe_decision(
    counters: DecisionCounters,
    env: SixMaxBadugiEnv,
    action: int,
    *,
    onnx_used: bool,
    fallback_used: bool,
    overlay_used: bool,
) -> None:
    counters.decisions += 1
    counters.action_counts[str(action)] = counters.action_counts.get(str(action), 0) + 1
    if onnx_used:
        counters.onnx_calls += 1
    if fallback_used:
        counters.fallback_actions += 1
    if overlay_used:
        counters.overlay_actions += 1

    if env.phase == "DRAW":
        counters.draw_decisions += 1
        target = ideal_draw_count(env.players[env.hero_seat]["hand"])
        if action == 0:
            counters.pat_actions += 1
        if action == target:
            counters.draw_correct += 1
        return

    counters.bet_decisions += 1
    if action == FOLD:
        counters.fold_actions += 1

    hand_class = hand_strength_class(env.players[env.hero_seat]["hand"])
    to_call = max(0, env.current_bet - env.players[env.hero_seat]["bet"])
    can_aggress = env._mask_for(env.hero_seat)[BET] > 0 or env._mask_for(env.hero_seat)[RAISE] > 0
    if hand_class in {"strongMade", "mediumMade"} and can_aggress:
        counters.value_opportunities += 1
        if action in (BET, RAISE):
            counters.value_bets += 1
    if to_call == 0 and hand_class in {"draw", "trash"} and can_aggress:
        counters.bluff_opportunities += 1
        if action in (BET, RAISE):
            counters.bluffs += 1


def choose_clean_action(
    *,
    env: SixMaxBadugiEnv,
    onnx_policy: OnnxPolicy | None,
    fallback_policy: TorchPolicy | None,
    overlay_enabled: bool,
) -> tuple[int, dict]:
    obs = env._obs_for(env.hero_seat)
    mask = env.legal_action_mask()
    onnx_used = False
    fallback_used = False
    raw_action: int | None = None
    reason = None
    if onnx_policy is not None:
        try:
            raw_action = onnx_policy.act(obs, mask)
            onnx_used = True
        except Exception as exc:
            reason = f"onnx-error:{exc.__class__.__name__}"
    if raw_action is None:
        if fallback_policy is not None:
            raw_action = fallback_policy.act(obs, mask)
        else:
            raw_action = deterministic_profile_action(env, env.hero_seat, resolve_opponent_profile("balanced"), phase=env.phase)
        fallback_used = True

    action = raw_action
    overlay_used = False
    overlay_reason = None
    if overlay_enabled:
        action, overlay_used, overlay_reason = pro_overlay_action(env, raw_action, mask)
    return action, {
        "onnxUsed": onnx_used,
        "fallbackUsed": fallback_used,
        "fallbackReason": reason,
        "overlayUsed": overlay_used,
        "overlayReason": overlay_reason,
        "rawAction": raw_action,
    }


def summarize_group(rows: list[dict], counters: DecisionCounters) -> dict:
    episodes = len(rows)
    showdowns = sum(1 for row in rows if row["terminalReason"] == "showdown")
    wins = sum(1 for row in rows if row["terminalReason"] == "showdown" and row["result"] == "win")
    folds = sum(1 for row in rows if row["terminalReason"] == "fold_win" and row["result"] == "loss")
    rewards = [float(row["reward"]) for row in rows]
    rates = counters.rates()
    return {
        "episodes": episodes,
        "avgReward": statistics.fmean(rewards) if rewards else 0.0,
        "minReward": min(rewards) if rewards else 0.0,
        "maxReward": max(rewards) if rewards else 0.0,
        "showdowns": showdowns,
        "wins": wins,
        "folds": folds,
        "showdownWinRate": wins / showdowns if showdowns else 0.0,
        "terminalFoldRate": folds / episodes if episodes else 0.0,
        "actionCounts": counters.action_counts,
        "decisionCounts": {
            "decisions": counters.decisions,
            "betDecisions": counters.bet_decisions,
            "drawDecisions": counters.draw_decisions,
            "foldActions": counters.fold_actions,
            "valueBetOpportunities": counters.value_opportunities,
            "valueBetActions": counters.value_bets,
            "bluffOpportunities": counters.bluff_opportunities,
            "bluffActions": counters.bluffs,
            "patActions": counters.pat_actions,
            "drawCorrect": counters.draw_correct,
            "onnxCalls": counters.onnx_calls,
            "fallbackActions": counters.fallback_actions,
            "proOverlayActions": counters.overlay_actions,
        },
        **rates,
    }


def position_ev_warnings(position_ev: dict[str, float | None]) -> list[str]:
    warnings = []
    btn = position_ev.get("BTN")
    utg = position_ev.get("UTG")
    co = position_ev.get("CO")
    if btn is not None and utg is not None and btn < utg:
        warnings.append(f"BTN_EV_BELOW_UTG:BTN={btn:.3f}<UTG={utg:.3f}")
    if btn is not None and co is not None and btn < co:
        warnings.append(f"BTN_EV_BELOW_CO:BTN={btn:.3f}<CO={co:.3f}")
    return warnings


def evaluate_policy_once(
    *,
    model: Path,
    checkpoint: Path | None,
    episodes: int,
    max_steps: int,
    seed: int,
    opponent_profile: str,
    overlay_enabled: bool,
    allow_torch_fallback: bool,
) -> dict:
    random.seed(seed)
    np.random.seed(seed)
    onnx_policy: OnnxPolicy | None = None
    onnx_error = None
    try:
        onnx_policy = OnnxPolicy(model)
    except Exception as exc:
        onnx_error = f"{exc.__class__.__name__}: {exc}"

    fallback_policy = None
    if allow_torch_fallback and checkpoint is not None and checkpoint.exists():
        fallback_policy = TorchPolicy(checkpoint)

    env = ProfiledSixMaxBadugiEnv(opponent_profile=opponent_profile, seed=seed, opp_epsilon=0.0)
    rows: list[dict] = []
    counters = DecisionCounters()
    position_rows: dict[str, list[dict]] = {label: [] for label in POSITION_LABELS}
    position_counters: dict[str, DecisionCounters] = {label: DecisionCounters() for label in POSITION_LABELS}

    for episode in range(episodes):
        _obs, _ = env.reset(seed=seed + episode)
        hero_position = position_label(env, env.hero_seat)
        episode_reward = 0.0
        local_counters = DecisionCounters()
        terminal_reason = None
        result = "unknown"
        for _step in range(max_steps):
            action, source = choose_clean_action(
                env=env,
                onnx_policy=onnx_policy,
                fallback_policy=fallback_policy,
                overlay_enabled=overlay_enabled,
            )
            observe_decision(
                counters,
                env,
                action,
                onnx_used=source["onnxUsed"],
                fallback_used=source["fallbackUsed"],
                overlay_used=source["overlayUsed"],
            )
            observe_decision(
                local_counters,
                env,
                action,
                onnx_used=source["onnxUsed"],
                fallback_used=source["fallbackUsed"],
                overlay_used=source["overlayUsed"],
            )
            _obs, reward, terminated, truncated, info = env.step(action)
            episode_reward += float(reward)
            if terminated or truncated:
                terminal_reason = info.get("terminal_reason") or env.terminal_reason
                if terminal_reason == "showdown":
                    result = "win" if reward > 0 else "loss"
                elif terminal_reason == "fold_win":
                    result = "win" if reward > 0 else "loss"
                break
        row = {
            "episode": episode,
            "reward": episode_reward,
            "position": hero_position,
            "terminalReason": terminal_reason,
            "result": result,
        }
        rows.append(row)
        position_rows.setdefault(hero_position, []).append(row)
        position_counters.setdefault(hero_position, DecisionCounters()).merge(local_counters)

    summary = summarize_group(rows, counters)
    by_position = {
        label: summarize_group(position_rows.get(label, []), position_counters.get(label, DecisionCounters()))
        for label in POSITION_LABELS
    }
    return {
        "model": str(model),
        "checkpoint": str(checkpoint) if checkpoint else None,
        "episodes": episodes,
        "maxSteps": max_steps,
        "epsilon": 0.0,
        "teacher": "off",
        "exploration": "off",
        "seed": seed,
        "opponentProfile": opponent_profile,
        "tableSize": 6,
        "proOverlay": "on" if overlay_enabled else "off",
        "onnxLoadError": onnx_error,
        "summary": summary,
        "positionSummaries": by_position,
    }


def summarize_runs(runs: list[dict]) -> dict:
    counters = DecisionCounters()
    profile_summaries: dict[str, dict] = {}
    position_summaries: dict[str, dict] = {}
    for run in runs:
        summary = run["summary"]
        dc = DecisionCounters()
        counts = summary.get("decisionCounts", {})
        dc.decisions = int(counts.get("decisions", 0))
        dc.bet_decisions = int(counts.get("betDecisions", 0))
        dc.draw_decisions = int(counts.get("drawDecisions", 0))
        dc.fold_actions = int(counts.get("foldActions", 0))
        dc.value_opportunities = int(counts.get("valueBetOpportunities", 0))
        dc.value_bets = int(counts.get("valueBetActions", 0))
        dc.bluff_opportunities = int(counts.get("bluffOpportunities", 0))
        dc.bluffs = int(counts.get("bluffActions", 0))
        dc.pat_actions = int(counts.get("patActions", 0))
        dc.draw_correct = int(counts.get("drawCorrect", 0))
        dc.onnx_calls = int(counts.get("onnxCalls", 0))
        dc.fallback_actions = int(counts.get("fallbackActions", 0))
        dc.overlay_actions = int(counts.get("proOverlayActions", 0))
        dc.action_counts = dict(summary.get("actionCounts", {}))
        counters.merge(dc)

        profile_summaries.setdefault(run["opponentProfile"], []).append(summary)
        for label, pos_summary in run.get("positionSummaries", {}).items():
            position_summaries.setdefault(label, []).append(pos_summary)

    profile_summary_out = {}
    for profile, summaries in profile_summaries.items():
        profile_summary_out[profile] = {
            "runs": len(summaries),
            "episodes": sum(int(summary["episodes"]) for summary in summaries),
            "avgReward": statistics.fmean(float(summary["avgReward"]) for summary in summaries),
            "showdownWinRate": statistics.fmean(float(summary["showdownWinRate"]) for summary in summaries),
            "foldRate": statistics.fmean(float(summary["foldRate"]) for summary in summaries),
            "valueBetRate": statistics.fmean(float(summary["valueBetRate"]) for summary in summaries),
            "bluffRate": statistics.fmean(float(summary["bluffRate"]) for summary in summaries),
            "patFrequency": statistics.fmean(float(summary["patFrequency"]) for summary in summaries),
            "drawDecisionAccuracy": statistics.fmean(float(summary["drawDecisionAccuracy"]) for summary in summaries),
        }

    position_summary_out = {}
    for label, summaries in position_summaries.items():
        position_summary_out[label] = {
            "runs": len(summaries),
            "episodes": sum(int(summary["episodes"]) for summary in summaries),
            "avgReward": statistics.fmean(float(summary["avgReward"]) for summary in summaries),
            "showdownWinRate": statistics.fmean(float(summary["showdownWinRate"]) for summary in summaries),
            "foldRate": statistics.fmean(float(summary["foldRate"]) for summary in summaries),
            "drawDecisionAccuracy": statistics.fmean(float(summary["drawDecisionAccuracy"]) for summary in summaries),
        }
    position_ev = {
        label: float(summary["avgReward"])
        for label, summary in position_summary_out.items()
        if int(summary.get("episodes", 0)) > 0
    }

    worst_profile = min(
        profile_summary_out.items(),
        key=lambda item: item[1]["avgReward"],
        default=(None, {"avgReward": 0.0}),
    )
    rewards = [float(run["summary"]["avgReward"]) for run in runs]
    total_episodes = sum(int(run["summary"]["episodes"]) for run in runs)
    total_showdowns = sum(int(run["summary"]["showdowns"]) for run in runs)
    total_wins = sum(int(run["summary"]["wins"]) for run in runs)
    total_folds = sum(int(run["summary"].get("folds", 0)) for run in runs)
    return {
        "runs": len(runs),
        "episodes": total_episodes,
        "avgReward": statistics.fmean(rewards) if rewards else 0.0,
        "minAvgReward": min(rewards) if rewards else 0.0,
        "minReward": min(float(run["summary"].get("minReward", 0.0)) for run in runs) if runs else 0.0,
        "maxReward": max(float(run["summary"].get("maxReward", 0.0)) for run in runs) if runs else 0.0,
        "showdowns": total_showdowns,
        "wins": total_wins,
        "folds": total_folds,
        "showdownWinRate": total_wins / total_showdowns if total_showdowns else 0.0,
        "profileSummaries": profile_summary_out,
        "positionSummaries": position_summary_out,
        "positionEV": position_ev,
        "warnings": position_ev_warnings(position_ev),
        "worstProfile": worst_profile[0],
        "worstProfileAvgReward": worst_profile[1]["avgReward"],
        **counters.rates(),
        "actionCounts": counters.action_counts,
        "decisionCounts": {
            "decisions": counters.decisions,
            "betDecisions": counters.bet_decisions,
            "drawDecisions": counters.draw_decisions,
            "foldActions": counters.fold_actions,
            "valueBetOpportunities": counters.value_opportunities,
            "valueBetActions": counters.value_bets,
            "bluffOpportunities": counters.bluff_opportunities,
            "bluffActions": counters.bluffs,
            "patActions": counters.pat_actions,
            "drawCorrect": counters.draw_correct,
            "onnxCalls": counters.onnx_calls,
            "fallbackActions": counters.fallback_actions,
            "proOverlayActions": counters.overlay_actions,
        },
        "evDiagnostics": {},
    }


def build_clean_eval_gate(summary: dict, *, min_onnx_usage_rate: float, max_fallback_rate: float) -> dict:
    checks = {
        "onnxUsageRate": float(summary.get("onnxUsageRate", 0.0)) >= float(min_onnx_usage_rate),
        "fallbackRate": float(summary.get("fallbackRate", 1.0)) <= float(max_fallback_rate),
        "episodes": int(summary.get("episodes", 0)) > 0,
    }
    fail_reasons = []
    if not checks["onnxUsageRate"]:
        fail_reasons.append(
            f"ONNX_USAGE_LOW:{float(summary.get('onnxUsageRate', 0.0)):.4f}<"
            f"{float(min_onnx_usage_rate):.4f}"
        )
    if not checks["fallbackRate"]:
        fail_reasons.append(
            f"FALLBACK_RATE_HIGH:{float(summary.get('fallbackRate', 1.0)):.4f}>"
            f"{float(max_fallback_rate):.4f}"
        )
    if not checks["episodes"]:
        fail_reasons.append("NO_EVALUATION_EPISODES")
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "failReasons": fail_reasons,
        "thresholds": {
            "minOnnxUsageRate": float(min_onnx_usage_rate),
            "maxFallbackRate": float(max_fallback_rate),
        },
    }


def ensure_onnx_for_checkpoint(checkpoint: Path, output_dir: Path, device: str) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    if checkpoint.suffix == ".onnx":
        return {"output": str(checkpoint), "checkpoint": str(checkpoint), "exported": False}
    output = output_dir / f"{checkpoint.stem}.onnx"
    export_result = export_checkpoint(
        checkpoint=checkpoint,
        output=output,
        registry=PROJECT_ROOT / "src/config/ai/modelRegistry.json",
        model_id="badugi-sixmax-clean-eval",
        update_registry=False,
        device=device,
    )
    export_result["exported"] = True
    return export_result


def evaluate_checkpoint(
    *,
    checkpoint: Path,
    milestone: int | None,
    episode: int | None,
    exact: bool,
    args,
) -> dict:
    export_result = ensure_onnx_for_checkpoint(checkpoint, args.onnx_dir, args.device)
    model_path = Path(export_result["output"])
    mode_results = {}
    for overlay_enabled in (False, True):
        mode = "proOverlayOn" if overlay_enabled else "proOverlayOff"
        runs = [
            evaluate_policy_once(
                model=model_path,
                checkpoint=checkpoint if checkpoint.suffix != ".onnx" else None,
                episodes=args.episodes,
                max_steps=args.max_steps,
                seed=seed,
                opponent_profile=profile,
                overlay_enabled=overlay_enabled,
                allow_torch_fallback=args.allow_torch_fallback,
            )
            for seed in args.seeds
            for profile in args.opponent_profiles
        ]
        summary = summarize_runs(runs)
        gate = build_clean_eval_gate(
            summary,
            min_onnx_usage_rate=args.min_onnx_usage_rate,
            max_fallback_rate=args.max_fallback_rate,
        )
        mode_results[mode] = {
            "passed": gate["passed"],
            "gate": gate,
            "summary": summary,
            "promotion": build_promotion_report(summary, avg_delta=None),
            "runs": runs,
        }
    return {
        "milestone": milestone,
        "episode": episode,
        "exactMilestoneMatch": exact,
        "checkpoint": str(checkpoint),
        "onnx": export_result,
        "cleanEval": mode_results,
    }


def build_report(args) -> dict:
    checkpoint_dir = Path(args.checkpoint_dir)
    patterns = parse_csv(args.patterns)
    checkpoints = list_checkpoint_candidates(checkpoint_dir, patterns)
    selected, missing = select_milestone_checkpoints(
        checkpoints,
        args.milestones,
        allow_nearest=args.allow_nearest,
    )
    if args.checkpoint:
        checkpoint = Path(args.checkpoint)
        if checkpoint.exists():
            selected = [
                {
                    "milestone": checkpoint_episode(checkpoint),
                    "episode": checkpoint_episode(checkpoint),
                    "checkpoint": checkpoint,
                    "exact": True,
                }
            ]
            missing = []
        else:
            selected = []
            missing = [{"milestone": checkpoint_episode(checkpoint), "reason": "checkpoint-not-found", "checkpoint": str(checkpoint)}]
    results = [
        evaluate_checkpoint(
            checkpoint=item["checkpoint"],
            milestone=item["milestone"],
            episode=item["episode"],
            exact=item["exact"],
            args=args,
        )
        for item in selected
    ]
    checkpoint_gate = {
        "passed": not missing and bool(results),
        "failReasons": [],
    }
    if missing:
        checkpoint_gate["failReasons"].extend(
            f"CHECKPOINT_NOT_FOUND:{row['milestone']}" for row in missing
        )
    if not results:
        checkpoint_gate["failReasons"].append("NO_CHECKPOINTS_EVALUATED")
    clean_eval_passed = checkpoint_gate["passed"] and all(
        mode["passed"]
        for result in results
        for mode in result.get("cleanEval", {}).values()
    )
    return {
        "schemaVersion": "badugi-sixmax-clean-eval-v1",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "purpose": "friend-distribution/pro-clean-evaluation-gate",
        "passed": clean_eval_passed,
        "gate": checkpoint_gate,
        "cleanEvalConfig": {
            "epsilon": 0.0,
            "teacher": "off",
            "exploration": "off",
            "tableSize": 6,
            "episodesPerSeedProfile": args.episodes,
            "maxSteps": args.max_steps,
            "seeds": args.seeds,
            "opponentProfiles": args.opponent_profiles,
            "milestones": args.milestones,
            "minOnnxUsageRate": args.min_onnx_usage_rate,
            "maxFallbackRate": args.max_fallback_rate,
            "trainingRewardPromotionEligible": False,
            "promotionNote": "Tier promotion must use clean evaluation metrics and human/practice evidence, not training reward alone.",
        },
        "checkpointDir": str(checkpoint_dir),
        "patterns": patterns,
        "missingMilestones": missing,
        "results": results,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Clean-evaluate Badugi 6-max DQN checkpoints.")
    parser.add_argument("--checkpoint-dir", default="rl/models/badugi_sixmax_selfplay")
    parser.add_argument("--checkpoint", default=None, help="Evaluate one explicit .pt or .onnx file")
    parser.add_argument("--patterns", default="badugi_sixmax_dqn_*.pt,badugi_dqn_*.pt")
    parser.add_argument("--milestones", type=parse_milestones, default=list(DEFAULT_MILESTONES))
    parser.add_argument("--allow-nearest", action="store_true")
    parser.add_argument("--episodes", type=int, default=120)
    parser.add_argument("--max-steps", type=int, default=120)
    parser.add_argument("--seeds", type=parse_seeds, default=parse_seeds("20260602,20260603"))
    parser.add_argument("--opponent-profiles", type=parse_csv, default=list(DEFAULT_PROFILES))
    parser.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    parser.add_argument("--report", default=None)
    parser.add_argument("--onnx-dir", default=str(DEFAULT_EVAL_ONNX_DIR))
    parser.add_argument("--allow-torch-fallback", action="store_true")
    parser.add_argument("--min-onnx-usage-rate", type=float, default=DEFAULT_MIN_ONNX_USAGE_RATE)
    parser.add_argument("--max-fallback-rate", type=float, default=DEFAULT_MAX_FALLBACK_RATE)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--report-only", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    args.report_dir = Path(args.report_dir)
    args.onnx_dir = Path(args.onnx_dir)
    args.report_dir.mkdir(parents=True, exist_ok=True)
    report = build_report(args)
    report_path = Path(args.report) if args.report else args.report_dir / f"badugi-sixmax-clean-eval-{datetime.now().strftime('%Y%m%d')}.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf8")

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        if not report["passed"] and not args.report_only:
            raise SystemExit(1)
        return

    for result in report["results"]:
        off = result["cleanEval"]["proOverlayOff"]["summary"]
        on = result["cleanEval"]["proOverlayOn"]["summary"]
        print(
            "[BADUGI 6MAX CLEAN] "
            f"checkpoint={Path(result['checkpoint']).name} "
            f"episode={result['episode']} "
            f"off.avg={off['avgReward']:.3f} off.worst={off['worstProfileAvgReward']:.3f} "
            f"off.onnx={off['onnxUsageRate']:.1%} off.fallback={off['fallbackRate']:.1%} "
            f"on.avg={on['avgReward']:.3f} on.worst={on['worstProfileAvgReward']:.3f} "
            f"on.overlay={on['proOverlayRate']:.1%}"
        )
    print(f"[BADUGI 6MAX CLEAN STATUS] {'PASS' if report['passed'] else 'FAIL'}")
    if report["missingMilestones"]:
        print(f"[BADUGI 6MAX CLEAN MISSING] {report['missingMilestones']}")
    print(f"[BADUGI 6MAX CLEAN REPORT] {report_path}")
    if not report["passed"] and not args.report_only:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
