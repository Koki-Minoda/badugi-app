"""Isolated D03 v2 real-controller DQN runner.

Default mode is a no-gradient preflight. Training requires an explicit frozen
GO manifest and writes only to a caller-supplied isolated output directory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import subprocess
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from rl.agents.dqn_agent import DQNAgent, DQNHyperParams
from rl.utils.replay_buffer import ReplayBuffer

BRIDGE = ROOT / "scripts" / "badugi-controller-v2-bridge.mjs"
PLAN = ROOT / "src" / "rl" / "training" / "badugi_controller_v2_plan_draft.json"
STANDARD_PLAN = ROOT / "src" / "rl" / "training" / "badugi_controller_v2_standard_plan.json"
PRO_PLAN = ROOT / "src" / "rl" / "training" / "badugi_controller_v2_pro_plan.json"
PRO_FOLD_PLAN = ROOT / "src" / "rl" / "training" / "badugi_controller_v2_pro_fold_anchor_plan.json"
PRO_ACTION_PLAN = ROOT / "src" / "rl" / "training" / "badugi_controller_v2_pro_action_anchor_plan.json"
PRO_FRESH_STACK_PLAN = ROOT / "src" / "rl" / "training" / "badugi_controller_v2_pro_fresh_stack_plan.json"
PRO_BET_ONLY_PLAN = ROOT / "src" / "rl" / "training" / "badugi_controller_v2_pro_bet_only_plan.json"
SCHEMA = "badugi-controller-observation-v2-draft"
PROFILES = ("passive", "pressure", "draw_heavy", "random_legal")
CONTRACT_FILES = (
    "src/rl/badugiControllerObservationV2Draft.js",
    "src/rl/badugiControllerEventProjectionV2Draft.js",
    "src/rl/badugiControllerSeatEventViewV2Draft.js",
    "src/rl/badugiControllerPublicChipStateV2Draft.js",
    "src/rl/badugiControllerBetDecisionRecordV2Draft.js",
    "src/rl/badugiControllerDrawDecisionRecordV2Draft.js",
    "src/rl/badugiControllerDrawIndexesV2Draft.js",
    "src/rl/badugiControllerInteractiveV2Draft.js",
    "scripts/badugi-controller-v2-bridge.mjs",
    "src/rl/agents/dqn_agent.py",
    "src/rl/utils/replay_buffer.py",
    "src/rl/training/train_badugi_controller_v2_draft.py",
)


def contract_hash():
    digest = hashlib.sha256()
    for name in CONTRACT_FILES:
        digest.update(name.encode() + b"\0")
        digest.update((ROOT / name).read_bytes())
    return digest.hexdigest()


def checkout_identity():
    code_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT,
                                       text=True).strip()
    dirty = subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT,
                                    text=True).strip()
    return code_sha, dirty


class ControllerBridge:
    def __init__(self):
        self.process = subprocess.Popen(["node", str(BRIDGE)], stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                        text=True, bufsize=1, cwd=ROOT)

    def send(self, command):
        self.process.stdin.write(json.dumps(command) + "\n")
        self.process.stdin.flush()
        line = self.process.stdout.readline()
        if not line:
            raise RuntimeError("controller bridge exited without a response")
        response = json.loads(line)
        if response.get("type") == "error":
            raise RuntimeError(response["message"])
        return response

    def close(self):
        self.process.stdin.close()
        self.process.wait(timeout=10)
        if self.process.returncode:
            raise RuntimeError(self.process.stderr.read())


def opponent_action(decision, profile, rng):
    allowed = [index for index, value in enumerate(decision["legalMask"]) if value == 1]
    if not allowed:
        raise ValueError("controller bridge returned an empty legal mask")
    if profile == "random_legal":
        return rng.choice(allowed)
    if decision["phase"] == "DRAW":
        order = {"passive": (0, 1, 2, 3, 4), "pressure": (1, 2, 0, 3, 4),
                 "draw_heavy": (4, 3, 2, 1, 0)}[profile]
    else:
        order = {"passive": (1, 2, 0, 3, 4), "pressure": (4, 3, 2, 1, 0),
                 "draw_heavy": (2, 1, 3, 4, 0)}[profile]
    return next(action for action in order if action in allowed)


def observable_reference_action(decision):
    """Public-information-only bootstrap policy; never reads opponent profile."""
    obs = decision["observation"]
    mask = decision["legalMask"]
    legal = lambda action: action < len(mask) and mask[action] == 1
    made = round(obs[24] * 4)
    high = round(obs[25] * 12)
    round_index = round(obs[9] * 3)
    if decision["phase"] == "DRAW":
        draw_count = min(4, max(0, 4 - made))
        return draw_count if legal(draw_count) else next(i for i, value in enumerate(mask) if value)
    to_call_bb = obs[18] * 20
    strong = made == 4 and high <= 8
    if to_call_bb > 0:
        if strong and legal(4):
            return 4
        if made == 4 or (made == 3 and round_index < 3 and to_call_bb <= 2):
            if legal(2):
                return 2
        if legal(0):
            return 0
    if strong and legal(3):
        return 3
    if legal(1):
        return 1
    return next(i for i, value in enumerate(mask) if value)


def check_decision(decision, seat_count, occupied_count, tournament):
    if (decision["type"] != "decision" or decision["schemaVersion"] != SCHEMA or
            decision["seatCount"] != seat_count or
            decision["occupiedSeatCount"] != occupied_count or
            decision["isTournament"] != tournament or
            len(decision["observation"]) != 96 or len(decision["legalMask"]) != 6 or
            not any(decision["legalMask"]) or
            decision["observation"][32:38] != decision["legalMask"]):
        raise ValueError("controller bridge observation contract mismatch")


def run_hand(bridge, first_response, agent, rng, hero_seat, profile, epsilon,
             seat_count, occupied_count, tournament, buffer=None, batch_size=64, warmup=512,
             bootstrap=False, demonstrations=None, bootstrap_agent=None,
             reference_draw_agent=None, bet_only_replay=False):
    response = first_response
    hero_decisions = []
    total_decisions = 0
    hero_bb = None
    hero_actual_decisions = 0
    opening = None
    while response["type"] == "decision":
        check_decision(response, seat_count, occupied_count, tournament)
        if response["seat"] == hero_seat:
            obs = np.asarray(response["observation"], dtype=np.float32)
            mask = np.asarray(response["legalMask"], dtype=np.float32)
            if reference_draw_agent is not None and response["phase"] == "DRAW":
                action = reference_draw_agent.act(obs, epsilon=0.0, action_mask=mask)
            elif bootstrap:
                action = (bootstrap_agent.act(obs, epsilon=0.0, action_mask=mask)
                          if bootstrap_agent else observable_reference_action(response))
            else:
                action = agent.act(obs, epsilon=epsilon, action_mask=mask)
            hero_actual_decisions += 1
            if response["phase"] == "BET" and round(float(obs[9] * 3)) == 0 and opening is None:
                opening = {"madeCards": round(float(obs[24] * 4)),
                           "highRank": round(float(obs[25] * 12)),
                           "raiseCount": round(float(obs[20] * 4)),
                           "position": float(obs[12]), "stackBb": float(obs[14] * 200),
                           "action": action}
            if not bet_only_replay or response["phase"] == "BET":
                hero_decisions.append((obs, mask, action))
            if demonstrations is not None and (not bet_only_replay or response["phase"] == "BET"):
                demonstrations.append((obs, action, response["phase"]))
            hero_bb = response["activeBigBlind"] if hero_bb is None else hero_bb
        else:
            action = opponent_action(response, profile, rng)
        if response["legalMask"][action] != 1:
            raise ValueError("agent selected an illegal controller action")
        response = bridge.send({"command": "step", "actionIndex": action})
        total_decisions += 1
        if total_decisions > 200:
            raise ValueError("controller bridge exceeded 200 decisions")
    if response["type"] != "hand_end" or sum(response["chipDeltaBySeat"]) != 0:
        raise ValueError("controller bridge did not return a balanced terminal hand")
    reward_bb = response["chipDeltaBySeat"][hero_seat] / hero_bb if hero_actual_decisions else None
    updates = 0
    if buffer is not None:
        for index, (obs, _, action) in enumerate(hero_decisions):
            done = index == len(hero_decisions) - 1
            next_obs = np.zeros(96, dtype=np.float32) if done else hero_decisions[index + 1][0]
            next_mask = None if done else hero_decisions[index + 1][1]
            buffer.add(obs, action, reward_bb if done else 0.0,
                       next_obs, done, next_action_mask=next_mask)
        if hero_decisions and len(buffer) >= max(batch_size, warmup):
            batch, indices, weights = buffer.sample(batch_size, return_meta=True)
            _, _, td_errors = agent.update(batch, weights)
            buffer.update_priorities(indices, td_errors)
            updates += 1
    return {"decisions": total_decisions, "heroDecisions": len(hero_decisions),
            "heroActualDecisions": hero_actual_decisions, "opening": opening,
            "heroChipBb": reward_bb, "updates": updates,
            "chipDeltaBySeat": response["chipDeltaBySeat"]}


class FrozenOnnxPolicy:
    """Published reference policy on the same observable v2 controller slots."""

    def __init__(self, path):
        self.session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        inputs, outputs = self.session.get_inputs(), self.session.get_outputs()
        if (len(inputs) != 1 or len(outputs) != 1 or
                inputs[0].name != "observation" or outputs[0].name != "q_values" or
                inputs[0].shape[-1] != 96 or outputs[0].shape[-1] != 6):
            raise ValueError("reference ONNX contract mismatch")

    def act(self, obs, epsilon, action_mask):
        if epsilon != 0.0:
            raise ValueError("reference policy must be greedy")
        scores = self.session.run(["q_values"], {
            "observation": np.asarray(obs, dtype=np.float32)[None, :]})[0][0]
        legal = np.flatnonzero(np.asarray(action_mask) > 0)
        if scores.shape != (6,) or not np.all(np.isfinite(scores)) or not len(legal):
            raise ValueError("reference policy returned invalid scores or legal mask")
        return int(legal[np.argmax(scores[legal])])


def sample_reference_demonstrations(demonstrations, batch_size, fold_anchor_per_batch=0,
                                    raise_anchor_per_batch=0, draw_three_anchor_per_batch=0):
    """Preserve distinct rare reference actions without conflating phases or indexes."""
    quotas = {("BET", 0): fold_anchor_per_batch,
              ("BET", 4): raise_anchor_per_batch,
              ("DRAW", 3): draw_three_anchor_per_batch}
    if any(value < 0 for value in quotas.values()) or sum(quotas.values()) >= batch_size:
        raise ValueError("invalid reference action anchor counts")
    if len(demonstrations) < batch_size:
        raise ValueError("insufficient public reference decisions for imitation")
    if any(quotas.values()):
        selected = []
        for (phase, action), count in quotas.items():
            matches = [item for item in demonstrations if item[2] == phase and item[1] == action]
            if len(matches) < count:
                raise ValueError(f"insufficient distinct public {phase}:{action} decisions for anchor")
            selected.extend(random.sample(matches, count))
        anchored_classes = {key for key, count in quotas.items() if count}
        remaining = [item for item in demonstrations if (item[2], item[1]) not in anchored_classes]
        if len(remaining) < batch_size - len(selected):
            raise ValueError("insufficient remaining public reference decisions")
        sample = selected + random.sample(remaining, batch_size - len(selected))
        random.shuffle(sample)
        return sample
    return random.sample(demonstrations, batch_size)


def training_opponent_profile(completed, session_index, fresh_session_per_hand=False):
    """Use every script opponent at fresh stacks in the Pro diagnostic curriculum."""
    offset = session_index if fresh_session_per_hand else completed + session_index
    return PROFILES[offset % len(PROFILES)]


def require_go_manifest(path, tier, hands, init_model=None, reference_model=None,
                        fold_anchor_per_batch=0, raise_anchor_per_batch=0,
                        draw_three_anchor_per_batch=0, fresh_session_per_hand=False,
                        bet_only_standard_draw=False):
    if path is None:
        raise ValueError("training requires --go-manifest with a frozen passing gate")
    manifest = json.loads(path.read_text())
    code_sha, dirty = checkout_identity()
    if (manifest.get("status") != "GO" or manifest.get("tier") != tier or
            manifest.get("trainingHost") != "mac" or
            manifest.get("codeGitSha") != code_sha or dirty or
            not isinstance(manifest.get("maxHands"), int) or
            hands > manifest["maxHands"] or
            manifest.get("schemaVersion") != SCHEMA or
            manifest.get("bridgeSha256") != hashlib.sha256(BRIDGE.read_bytes()).hexdigest() or
            manifest.get("contractSha256") != contract_hash() or
            manifest.get("planSha256") != hashlib.sha256(PLAN.read_bytes()).hexdigest() or
            not all(manifest.get(key) is True for key in
                    ("independentSlotAuditPassed", "uiEventAuditPassed",
                     "controllerActionAuditPassed",
                     "seedAndOpponentPlanFrozen", "macResourcePassed"))):
        raise ValueError("GO manifest is absent, stale or incomplete")
    if tier == "standard":
        tier_plan = json.loads(STANDARD_PLAN.read_text())
        if (init_model is None or not init_model.is_file() or
                manifest.get("initialModelSha256") != hashlib.sha256(init_model.read_bytes()).hexdigest() or
                tier_plan.get("initialCheckpointSha256") != manifest.get("initialModelSha256") or
                manifest.get("explorationEpsilon") != tier_plan.get("explorationEpsilon") or
                not 0 <= manifest.get("explorationEpsilon", -1) <= 1 or
                manifest.get("anchorPolicyId") != "published-v2-beginner" or
                manifest.get("tierPlanSha256") != hashlib.sha256(STANDARD_PLAN.read_bytes()).hexdigest()):
            raise ValueError("Standard requires the frozen v2 Beginner initial model and tier plan")
        if reference_model is not None:
            raise ValueError("Standard bootstrap uses its frozen checkpoint, not a separate reference ONNX")
    elif tier == "pro":
        tier_plan_path = (PRO_BET_ONLY_PLAN if bet_only_standard_draw else
                          PRO_FRESH_STACK_PLAN if fresh_session_per_hand else
                          PRO_ACTION_PLAN if raise_anchor_per_batch or draw_three_anchor_per_batch else
                          PRO_FOLD_PLAN if fold_anchor_per_batch else PRO_PLAN)
        tier_plan = json.loads(tier_plan_path.read_text())
        if (init_model is None or not init_model.is_file() or
                reference_model is None or not reference_model.is_file() or
                manifest.get("initialModelSha256") != hashlib.sha256(init_model.read_bytes()).hexdigest() or
                manifest.get("referenceModelSha256") != hashlib.sha256(reference_model.read_bytes()).hexdigest() or
                tier_plan.get("initialCheckpointSha256") != manifest.get("initialModelSha256") or
                tier_plan.get("publishedStandardOnnxSha256") != manifest.get("referenceModelSha256") or
                manifest.get("explorationEpsilon") != tier_plan.get("explorationEpsilon") or
                not 0 <= manifest.get("explorationEpsilon", -1) <= 1 or
                manifest.get("anchorPolicyId") != "published-v2-standard" or
                manifest.get("foldAnchorPerBatch", 0) != fold_anchor_per_batch or
                tier_plan.get("foldAnchorPerBatch", 0) != fold_anchor_per_batch or
                manifest.get("raiseAnchorPerBatch", 0) != raise_anchor_per_batch or
                tier_plan.get("raiseAnchorPerBatch", 0) != raise_anchor_per_batch or
                manifest.get("drawThreeAnchorPerBatch", 0) != draw_three_anchor_per_batch or
                tier_plan.get("drawThreeAnchorPerBatch", 0) != draw_three_anchor_per_batch or
                manifest.get("freshSessionPerHand", False) != fresh_session_per_hand or
                tier_plan.get("freshSessionPerHand", False) != fresh_session_per_hand or
                manifest.get("betOnlyStandardDraw", False) != bet_only_standard_draw or
                tier_plan.get("betOnlyStandardDraw", False) != bet_only_standard_draw or
                manifest.get("tierPlanSha256") != hashlib.sha256(tier_plan_path.read_bytes()).hexdigest()):
            raise ValueError("Pro requires frozen v2 Standard initial checkpoint and published reference ONNX")
    elif init_model is not None:
        raise ValueError("initial model is only approved for this Standard diagnostic run")
    elif reference_model is not None:
        raise ValueError("reference ONNX is only approved for the Pro diagnostic run")
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tier", choices=("beginner", "standard", "pro", "iron", "worldmaster"),
                        default="beginner")
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--hands", type=int, default=2)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--go-manifest", type=Path)
    parser.add_argument("--bootstrap-hands", type=int, default=0)
    parser.add_argument("--imitation-steps", type=int, default=0)
    parser.add_argument("--reference-anchor-every", type=int, default=0)
    parser.add_argument("--seed-base", type=int)
    parser.add_argument("--init-model", type=Path)
    parser.add_argument("--reference-model", type=Path)
    parser.add_argument("--fold-anchor-per-batch", type=int, default=0)
    parser.add_argument("--raise-anchor-per-batch", type=int, default=0)
    parser.add_argument("--draw-three-anchor-per-batch", type=int, default=0)
    parser.add_argument("--fresh-session-per-hand", action="store_true",
                        help="Pro diagnostic: reset controller and rotate opponent profile for every hand")
    parser.add_argument("--bet-only-standard-draw", action="store_true",
                        help="Pro diagnostic: learn BET only in 20-hand sessions; use frozen Standard DRAW")
    args = parser.parse_args()
    if not 1 <= args.hands <= 5000:
        raise ValueError("one explicit run must contain 1–5000 hands; 5k is a stop gate")
    if not 0 <= args.bootstrap_hands < args.hands or not 0 <= args.imitation_steps <= 5000:
        raise ValueError("invalid bootstrap or imitation count")
    if (args.bootstrap_hands == 0) != (args.imitation_steps == 0):
        raise ValueError("bootstrap hands and imitation steps must be set together")
    if args.reference_anchor_every < 0 or (args.reference_anchor_every and not args.bootstrap_hands):
        raise ValueError("reference anchoring requires bootstrap demonstrations")
    if (any(value < 0 for value in (args.fold_anchor_per_batch,
                                    args.raise_anchor_per_batch,
                                    args.draw_three_anchor_per_batch)) or
            sum((args.fold_anchor_per_batch, args.raise_anchor_per_batch,
                 args.draw_three_anchor_per_batch)) >= 64 or
            (any((args.fold_anchor_per_batch, args.raise_anchor_per_batch,
                  args.draw_three_anchor_per_batch)) and
             (args.tier != "pro" or not args.bootstrap_hands))):
        raise ValueError("action anchors require Pro bootstrap and a total below 64")
    if args.fresh_session_per_hand and (not args.train or args.tier != "pro"):
        raise ValueError("fresh-session curriculum is only approved for isolated Pro training")
    if args.bet_only_standard_draw and (not args.train or args.tier != "pro" or
                                       args.fresh_session_per_hand or args.draw_three_anchor_per_batch):
        raise ValueError("BET-only Pro requires isolated training, 20-hand sessions and no DRAW anchor")
    if args.train and (args.output is None or args.output.exists()):
        raise ValueError("training requires a new isolated --output directory")
    if args.train:
        manifest = require_go_manifest(args.go_manifest, args.tier, args.hands,
                                       args.init_model, args.reference_model,
                                       args.fold_anchor_per_batch,
                                       args.raise_anchor_per_batch,
                                       args.draw_three_anchor_per_batch,
                                       args.fresh_session_per_hand,
                                       args.bet_only_standard_draw)
        if (manifest.get("bootstrapHands", 0) != args.bootstrap_hands or
                manifest.get("imitationSteps", 0) != args.imitation_steps or
                manifest.get("referenceAnchorEvery", 0) != args.reference_anchor_every or
                (args.seed_base is not None and manifest.get("seedBase") != args.seed_base)):
            raise ValueError("training method differs from GO manifest")
    seed_base = (manifest["seedBase"] if args.train else
                 args.seed_base or (320040001 if args.bootstrap_hands else 310040001))
    random.seed(seed_base)
    np.random.seed(seed_base)
    torch.manual_seed(seed_base)
    agent = (DQNAgent.load(str(args.init_model), device="cpu") if args.init_model else
             DQNAgent(obs_dim=96, n_actions=6, device="cpu", hidden_dim=256,
                      hyperparams=DQNHyperParams(lr=0.0001, batch_size=64)))
    expected_initial_tier = "beginner" if args.tier == "standard" else "standard"
    if args.init_model and (agent.obs_dim != 96 or agent.n_actions != 6 or
                            agent.checkpoint_training_state.get("schemaVersion") != SCHEMA or
                            agent.checkpoint_training_state.get("tier") != expected_initial_tier):
        raise ValueError("initial model is not the expected v2 checkpoint contract")
    bootstrap_agent = (DQNAgent.load(str(args.init_model), device="cpu")
                       if args.train and args.tier == "standard" else
                       FrozenOnnxPolicy(args.reference_model)
                       if args.train and args.tier == "pro" else None)
    reference_draw_agent = (bootstrap_agent if args.bet_only_standard_draw else None)
    buffer = ReplayBuffer(capacity=100_000, seed=seed_base) if args.train else None
    bridge = ControllerBridge()
    results = []
    demonstrations = []
    imitation_losses = []
    anchor_steps = 0
    try:
        groups = tuple((seats, occupied, tournament) for tournament in (False, True)
                       for seats, occupied in ((2, 2), (3, 3), (6, 6), (6, 2), (6, 3)))
        stages = (("bootstrap", args.bootstrap_hands),
                  ("rl", args.hands - args.bootstrap_hands)) if args.bootstrap_hands else (("rl", args.hands),)
        for stage_index, (stage, stage_hands) in enumerate(stages):
          if stage == "rl" and args.bootstrap_hands:
            for _ in range(args.imitation_steps):
                sample = sample_reference_demonstrations(
                    demonstrations, 64, args.fold_anchor_per_batch,
                    args.raise_anchor_per_batch, args.draw_three_anchor_per_batch)
                loss, _ = agent.imitation_update({
                    "obs": np.stack([item[0] for item in sample]),
                    "actions": np.asarray([item[1] for item in sample], dtype=np.int64)})
                imitation_losses.append(loss)
            args.output.mkdir(parents=True)
            agent.save(str(args.output / "bootstrap-candidate.pt"), training_state={
                "schemaVersion": SCHEMA, "tier": args.tier,
                "hands": args.bootstrap_hands, "stage": "reference_imitation",
                "bridgeSha256": hashlib.sha256(BRIDGE.read_bytes()).hexdigest()})
          for group_index, (seat_count, occupied_count, tournament) in enumerate(groups):
            allocated = stage_hands // len(groups) + int(group_index < stage_hands % len(groups))
            if not args.train:
                allocated = args.hands
            if allocated == 0:
                continue
            completed = 0
            session_index = 0
            while completed < allocated:
                session_seed = seed_base + stage_index * 100_000_000 + group_index * 1_000_000 + session_index
                rng = random.Random(session_seed + 997)
                response = bridge.send({"command": "reset", "seatCount": seat_count,
                                        "occupiedSeatCount": occupied_count,
                                        "isTournament": tournament, "seed": session_seed})
                if response["type"] != "decision":
                    raise ValueError("new controller session did not start with a decision")
                fixed_hero_seat = None
                fixed_profile = PROFILES[session_index % len(PROFILES)] if args.bet_only_standard_draw else None
                for hand_in_session in range(min(1 if args.fresh_session_per_hand else 20,
                                                 allocated - completed)):
                    if hand_in_session:
                        response = bridge.send({"command": "next_hand"})
                        if response["type"] == "hand_end" and response["decisionCount"] == 0:
                            break  # Table finished: restart with a new training seed.
                    profile = (fixed_profile if fixed_profile is not None else
                               training_opponent_profile(completed, session_index,
                                                         args.fresh_session_per_hand))
                    eligible = response.get("eligibleSeats", [])
                    if not eligible:
                        raise ValueError("controller bridge has no eligible target seat")
                    if args.bet_only_standard_draw:
                        if fixed_hero_seat is None:
                            fixed_hero_seat = eligible[session_index % len(eligible)]
                        if fixed_hero_seat not in eligible:
                            break  # Preserve one target seat and restart after its elimination.
                        hero_seat = fixed_hero_seat
                    else:
                        hero_seat = eligible[(completed + session_index) % len(eligible)]
                    epsilon = (manifest["explorationEpsilon"] if args.train and args.tier in ("standard", "pro") else
                               max(0.05, 0.2 - (len(results) - args.bootstrap_hands) * 0.15 /
                                   max(1, args.hands - args.bootstrap_hands)) if args.bootstrap_hands else
                               max(0.05, 1.0 - len(results) / 5000)) if args.train else 0.0
                    outcome = run_hand(bridge, response, agent, rng, hero_seat, profile,
                                       epsilon, seat_count, occupied_count, tournament,
                                       buffer if stage == "rl" else None,
                                       bootstrap=stage == "bootstrap",
                                       demonstrations=demonstrations if stage == "bootstrap" else None,
                                       bootstrap_agent=bootstrap_agent,
                                       reference_draw_agent=reference_draw_agent,
                                       bet_only_replay=args.bet_only_standard_draw)
                    if (stage == "rl" and args.reference_anchor_every and
                            outcome["heroDecisions"] and
                            completed % args.reference_anchor_every == 0):
                        sample = sample_reference_demonstrations(
                            demonstrations, 64, args.fold_anchor_per_batch,
                            args.raise_anchor_per_batch, args.draw_three_anchor_per_batch)
                        loss, _ = agent.imitation_update({
                            "obs": np.stack([item[0] for item in sample]),
                            "actions": np.asarray([item[1] for item in sample], dtype=np.int64)})
                        imitation_losses.append(loss)
                        anchor_steps += 1
                    results.append({"seatCount": seat_count, "occupiedSeatCount": occupied_count,
                                    "isTournament": tournament,
                                    "stage": stage,
                                    "profile": profile, "seed": session_seed,
                                    "handInSession": hand_in_session, "heroSeat": hero_seat,
                                    **outcome})
                    completed += 1
                session_index += 1
    finally:
        bridge.close()
    report = {"status": "TRAINING_CHECKPOINT" if args.train else "NO_GRADIENT_PREFLIGHT",
              "tier": args.tier, "trained": args.train, "modelPublished": False,
              "schemaVersion": SCHEMA,
              "initialModelSha256": (hashlib.sha256(args.init_model.read_bytes()).hexdigest()
                                     if args.init_model else None),
              "referenceModelSha256": (hashlib.sha256(args.reference_model.read_bytes()).hexdigest()
                                       if args.reference_model else None),
              "explorationEpsilon": manifest.get("explorationEpsilon") if args.train else None,
              "anchorPolicyId": manifest.get("anchorPolicyId") if args.train else None,
              "bridgeSha256": hashlib.sha256(BRIDGE.read_bytes()).hexdigest(),
              "contractSha256": contract_hash(),
              "hands": len(results), "decisions": sum(row["decisions"] for row in results),
              "heroDecisions": sum(row["heroDecisions"] for row in results),
              "noHeroDecisionHands": sum(row["heroDecisions"] == 0 for row in results),
              "optimizerSteps": agent.train_steps, "zeroSumHands": sum(
                  sum(row["chipDeltaBySeat"]) == 0 for row in results),
              "bootstrapHands": args.bootstrap_hands,
              "referenceDecisions": len(demonstrations),
              "referenceBetFoldDecisions": sum(
                  item[2] == "BET" and item[1] == 0 for item in demonstrations),
              "referenceBetRaiseDecisions": sum(
                  item[2] == "BET" and item[1] == 4 for item in demonstrations),
              "referenceDrawThreeDecisions": sum(
                  item[2] == "DRAW" and item[1] == 3 for item in demonstrations),
              "foldAnchorPerBatch": args.fold_anchor_per_batch,
              "raiseAnchorPerBatch": args.raise_anchor_per_batch,
              "drawThreeAnchorPerBatch": args.draw_three_anchor_per_batch,
              "freshSessionPerHand": args.fresh_session_per_hand,
              "betOnlyStandardDraw": args.bet_only_standard_draw,
              "openingClassCounts": dict(Counter(
                  (f"{row['opening']['madeCards']}-card-high-{row['opening']['highRank']}"
                   if row.get('opening') else 'no-opening') for row in results)),
              "openingActionCounts": dict(Counter(
                  str(row['opening']['action']) if row.get('opening') else 'no-opening'
                  for row in results)),
              "pressureFirstHandsByStage": {
                  stage: sum(row["stage"] == stage and row["profile"] == "pressure" and
                             row["handInSession"] == 0 for row in results)
                  for stage in ("bootstrap", "rl")},
              "sixSeatCashPressureFirstHandsByStage": {
                  stage: sum(row["stage"] == stage and row["profile"] == "pressure" and
                             row["handInSession"] == 0 and row["seatCount"] == 6 and
                             row["occupiedSeatCount"] == 6 and not row["isTournament"]
                             for row in results)
                  for stage in ("bootstrap", "rl")},
              "imitationSteps": args.imitation_steps,
              "referenceAnchorEvery": args.reference_anchor_every,
              "referenceAnchorSteps": anchor_steps,
              "dqnSteps": sum(row["updates"] for row in results),
              "imitationLossFirst": imitation_losses[0] if imitation_losses else None,
              "imitationLossLast": imitation_losses[-1] if imitation_losses else None,
              "groups": sorted(set((row["seatCount"], row["occupiedSeatCount"],
                                    row["isTournament"]) for row in results)),
              "opponentProfiles": sorted(set(row["profile"] for row in results)),
              "seedSplit": f"{seed_base}+stage*100000000+group*1000000+session; distinct from evaluation seeds",
              "stopRule": "run stops at requested hands (max 5000); no automatic continuation or promotion"}
    if args.train:
        args.output.mkdir(parents=True, exist_ok=True)
        agent.save(str(args.output / "candidate.pt"), training_state={
            "schemaVersion": SCHEMA, "tier": args.tier, "hands": len(results),
            "bridgeSha256": report["bridgeSha256"]})
        (args.output / "hand-trace.jsonl").write_text("".join(
            json.dumps(row, separators=(",", ":")) + "\n" for row in results))
        (args.output / "run-summary.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
