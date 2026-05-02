"""Evaluate a frontend-compatible Badugi ONNX policy in the training env."""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

import numpy as np

try:
    import onnxruntime as ort
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: onnxruntime. Install RL deps first: "
        "python3 -m pip install -r src/rl/requirements.txt"
    ) from exc

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from rl.env.badugi_env import BadugiEnv

DEFAULT_MODEL = PROJECT_ROOT / "public/models/badugi_worldmaster_v1.onnx"


def choose_action(
    session: ort.InferenceSession,
    obs: np.ndarray,
    epsilon: float,
    action_mask: np.ndarray | None = None,
) -> int:
    output_name = session.get_outputs()[0].name
    input_name = session.get_inputs()[0].name
    legal_actions = None
    if action_mask is not None:
        legal_actions = np.flatnonzero(np.asarray(action_mask) > 0)
        if len(legal_actions) == 0:
            legal_actions = None
    if random.random() < epsilon:
        if legal_actions is not None:
            return int(random.choice(legal_actions))
        return random.randrange(6)
    q_values = session.run([output_name], {input_name: obs.astype(np.float32)})[0]
    if action_mask is not None:
        q_values = np.array(q_values, copy=True)
        q_values[np.asarray(action_mask) <= 0] = -1e9
    return int(np.argmax(q_values))


def evaluate_model(
    *,
    model: Path,
    episodes: int,
    max_steps: int,
    epsilon: float,
    seed: int,
    opponent_profile: str = "balanced",
    table_size: int = 2,
) -> dict:
    if not model.exists():
        raise FileNotFoundError(f"ONNX model not found: {model}")

    random.seed(seed)
    np.random.seed(seed)
    session = ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])
    input_shape = [dim if isinstance(dim, int) else None for dim in session.get_inputs()[0].shape]
    output_shape = [dim if isinstance(dim, int) else None for dim in session.get_outputs()[0].shape]

    env = BadugiEnv(opponent_profile=opponent_profile, table_size=table_size)
    rewards: list[float] = []
    wins = losses = ties = folds = opponent_folds = showdowns = 0
    profitable_fold_misses = 0
    positive_call_ev_actions = 0
    negative_call_ev_actions = 0
    positive_raise_ev_actions = 0
    negative_raise_ev_actions = 0
    action_counts = {str(action): 0 for action in range(6)}

    for episode in range(episodes):
        obs, _ = env.reset(seed=seed + episode)
        total_reward = 0.0
        last_result = None

        for _ in range(max_steps):
            action = choose_action(session, obs, epsilon, env.legal_action_mask())
            action_counts[str(action)] += 1
            obs, reward, terminated, truncated, info = env.step(action)
            total_reward += float(reward)
            ev = info.get("ev") if isinstance(info, dict) else None
            if ev:
                is_bet_phase = ev.get("phase") == "BET"
                call_ev = float(ev.get("callEV", 0.0))
                raise_ev = float(ev.get("raiseEV", 0.0))
                fold_ev = float(ev.get("foldEV", 0.0))
                if is_bet_phase and action == 0 and call_ev > fold_ev:
                    profitable_fold_misses += 1
                if is_bet_phase and action == 2:
                    if call_ev >= fold_ev:
                        positive_call_ev_actions += 1
                    else:
                        negative_call_ev_actions += 1
                if is_bet_phase and action in (3, 4):
                    if raise_ev >= call_ev:
                        positive_raise_ev_actions += 1
                    else:
                        negative_raise_ev_actions += 1
            if getattr(env, "last_result", None) is not None:
                last_result = env.last_result
            if terminated or truncated:
                break

        terminal_reason = getattr(env, "terminal_reason", None)
        if terminal_reason == "opponent_fold":
            opponent_folds += 1
        elif terminal_reason == "player_fold":
            folds += 1
        elif last_result == 1:
            wins += 1
            showdowns += 1
        elif last_result == -1:
            losses += 1
            showdowns += 1
        elif last_result == 0:
            ties += 1
            showdowns += 1

        rewards.append(total_reward)

    env.close()
    return {
        "model": str(model),
        "episodes": episodes,
        "max_steps": max_steps,
        "epsilon": epsilon,
        "seed": seed,
        "opponentProfile": opponent_profile,
        "tableSize": table_size,
        "inputShape": input_shape,
        "outputShape": output_shape,
        "avgReward": float(np.mean(rewards)) if rewards else 0.0,
        "minReward": float(np.min(rewards)) if rewards else 0.0,
        "maxReward": float(np.max(rewards)) if rewards else 0.0,
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "showdowns": showdowns,
        "folds": folds,
        "opponentFolds": opponent_folds,
        "showdownWinRate": wins / showdowns if showdowns else 0.0,
        "actionCounts": action_counts,
        "evDiagnostics": {
            "profitableFoldMisses": profitable_fold_misses,
            "positiveCallEVActions": positive_call_ev_actions,
            "negativeCallEVActions": negative_call_ev_actions,
            "positiveRaiseEVActions": positive_raise_ev_actions,
            "negativeRaiseEVActions": negative_raise_ev_actions,
        },
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate a Badugi ONNX policy.")
    parser.add_argument("--model", default=str(DEFAULT_MODEL))
    parser.add_argument("--episodes", type=int, default=500)
    parser.add_argument("--max-steps", type=int, default=200)
    parser.add_argument("--epsilon", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=20260501)
    parser.add_argument("--opponent-profile", default="balanced")
    parser.add_argument("--table-size", type=int, default=2)
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    result = evaluate_model(
        model=Path(args.model),
        episodes=args.episodes,
        max_steps=args.max_steps,
        epsilon=args.epsilon,
        seed=args.seed,
        opponent_profile=args.opponent_profile,
        table_size=args.table_size,
    )
    if args.json:
        print(json.dumps(result, indent=2))
        return
    print(
        "[ONNX EVAL] "
        f"model={result['model']} episodes={result['episodes']} "
        f"opponentProfile={result['opponentProfile']} "
        f"avgReward={result['avgReward']:.3f} "
        f"showdownWinRate={result['showdownWinRate']:.3f} "
        f"showdowns={result['showdowns']} folds={result['folds']} "
        f"opponentFolds={result['opponentFolds']} "
        f"actions={result['actionCounts']} "
        f"ev={result['evDiagnostics']}"
    )


if __name__ == "__main__":
    main()
