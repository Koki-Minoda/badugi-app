"""Audit profile-prior sensitivity in the historical Pro observation path.

This is an artificial same-state input audit, not a played-hand strength test.
"""

import argparse
import ast
import hashlib
import json
import random
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from rl.env.badugi_env import BadugiEnv, OPPONENT_PROFILES  # noqa: E402

MODEL = ROOT / "public/models/badugi_pro_v1.onnx"
MODEL_SHA256 = "7735e4367f9e24eab5481075855ed6ef221a5d06c053cf70bc449ec3d7fba3ce"
HISTORICAL_COMMIT = "8d55e628301e9faee46c31cd64f57a5e8b565179"
HISTORICAL_METHODS = (
    "_get_obs", "_opponent_aggression_rate", "_opponent_passivity_rate",
    "_opponent_foldability_estimate", "_bet_ev_diagnostic",
    "_future_street_value", "_opponent_exploit_opportunity", "_estimated_equity",
)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def methods(source):
    tree = ast.parse(source)
    env = next(node for node in tree.body
               if isinstance(node, ast.ClassDef) and node.name == "BadugiEnv")
    return {node.name: ast.unparse(node) for node in env.body
            if isinstance(node, ast.FunctionDef)}


def profile_definition(source):
    tree = ast.parse(source)
    return next(ast.unparse(node) for node in tree.body
                if isinstance(node, ast.Assign)
                and any(isinstance(target, ast.Name) and target.id == "OPPONENT_PROFILES"
                        for target in node.targets))


def public_state(env):
    """Fields held fixed when only the latent opponent profile is switched."""
    fields = (
        "player_hand", "opponent_hand", "player_stack", "opponent_stack",
        "pot", "current_bet", "player_bet", "opponent_bet", "round",
        "phase", "bet_round", "opponent_action_count", "opponent_fold_count",
        "opponent_aggressive_action_count", "opponent_passive_action_count",
        "opponent_draw_count", "opponent_pat_count", "hero_bet_history",
        "hero_draw_history", "opp_draw_history",
    )
    return json.dumps({field: getattr(env, field, None) for field in fields},
                      sort_keys=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    current_source = (ROOT / "src/rl/env/badugi_env.py").read_text()
    historical_source = subprocess.check_output(
        ["git", "show", f"{HISTORICAL_COMMIT}:src/rl/env/badugi_env.py"],
        cwd=ROOT, text=True)
    current_methods, historical_methods = methods(current_source), methods(historical_source)
    same_methods = {name: current_methods.get(name) == historical_methods.get(name)
                    for name in HISTORICAL_METHODS}
    if not all(same_methods.values()):
        raise RuntimeError(f"Historical Pro observation dependencies changed: {same_methods}")
    profiles_match = profile_definition(current_source) == profile_definition(historical_source)
    if not profiles_match:
        raise RuntimeError("Historical opponent profiles differ from current source")
    if sha256(MODEL) != MODEL_SHA256:
        raise RuntimeError("Pro ONNX checksum differs from the audited asset")

    session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    changed_slots = set()
    choice_changes = Counter()
    vector_changes = Counter()
    cases = []
    profiles = sorted(name for name in OPPONENT_PROFILES if name != "balanced")
    for seed in range(13001, 13033):
        random.seed(seed)
        env = BadugiEnv(opponent_profile="balanced", table_size=6)
        for phase in ("BET", "DRAW"):
            env.phase = phase
            if phase == "DRAW":
                env.round = 1
                env.current_bet = env.player_bet = env.opponent_bet = 0
            fixed_state = public_state(env)
            env.set_opponent_profile("balanced")
            baseline = env._get_obs()
            legal = np.flatnonzero(env.legal_action_mask())
            if len(legal) == 0:
                raise RuntimeError("Artificial state has no legal action")
            base_q = session.run(None, {input_name: baseline})[0].reshape(-1)
            base_choice = int(max(legal, key=lambda index: base_q[index]))
            for profile in profiles:
                env.set_opponent_profile(profile)
                if public_state(env) != fixed_state:
                    raise RuntimeError("Opponent-profile switch changed public state")
                if not np.array_equal(np.flatnonzero(env.legal_action_mask()), legal):
                    raise RuntimeError("Opponent-profile switch changed legal actions")
                obs = env._get_obs()
                slots = np.flatnonzero(np.abs(obs - baseline) > 1e-6).tolist()
                q = session.run(None, {input_name: obs})[0].reshape(-1)
                choice = int(max(legal, key=lambda index: q[index]))
                key = f"{phase}:{profile}"
                vector_changes[key] += bool(slots)
                choice_changes[key] += choice != base_choice
                changed_slots.update(slots)
                cases.append({"seed": seed, "phase": phase, "profile": profile,
                              "changedSlots": slots, "baselineAction": base_choice,
                              "profileAction": choice})

    report = {
        "status": "PROFILE_PRIOR_INPUT_SENSITIVITY_ONLY",
        "scope": "Same artificial game state, legal mask and model; switch only the hidden opponent_profile attribute. No played hands, independent sessions or chip EV.",
        "sourceHead": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "historicalSourceCommit": HISTORICAL_COMMIT,
        "historicalMethodBodiesMatchCurrent": same_methods,
        "historicalOpponentProfilesMatchCurrent": profiles_match,
        "model": str(MODEL.relative_to(ROOT)), "modelSha256": MODEL_SHA256,
        "baselineProfile": "balanced", "comparisonProfiles": profiles,
        "seedCount": 32, "phaseCount": 2, "comparisonCount": len(cases),
        "vectorChangeCount": sum(vector_changes.values()),
        "actionChangeCount": sum(choice_changes.values()),
        "changedSlots": sorted(changed_slots),
        "vectorChangesByPhaseProfile": dict(vector_changes),
        "actionChangesByPhaseProfile": dict(choice_changes),
        "cases": cases,
        "limits": [
            "The imported historical code is committed source, not proof of the original checkpoint's working tree.",
            "The altered profile is not observable from the public game state in this audit.",
            "Action sensitivity is not a frequency or causal EV estimate in the live controller.",
        ],
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in (
        "status", "comparisonCount", "vectorChangeCount", "actionChangeCount", "changedSlots")}))


if __name__ == "__main__":
    main()
