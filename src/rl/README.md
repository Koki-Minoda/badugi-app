# Badugi RL Toolkit

This folder contains the reinforcement learning agents used for CPU opponents.

```
rl/
  agents/         # Policy implementations (e.g., DQN)
  env/            # Gymnasium environments for Badugi
  utils/          # Replay buffers and shared helpers
  training/       # Training entrypoints
  models/         # Saved checkpoints (.pt)
```

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r rl/requirements.txt
python rl/training/train_dqn.py
```

Set `PYTHONPATH=.` when running from the repo root so that `rl.*` imports resolve correctly.

## Building bootstrap ONNX models

To create real ONNX files for the frontend inference path before long-running
RL training is available:

```bash
source .venv/bin/activate
python3 -m pip install -r src/rl/requirements.txt
npm run ai:build-bootstrap-models
npm run ai:verify-models
```

This writes Badugi Pro / Iron / WorldMaster bootstrap models to
`public/models/` and updates `src/config/ai/modelRegistry.json` with SHA-256
checksums. These are heuristic bootstrap policies, not final trained models.

## Training and exporting a DQN checkpoint

Short smoke run:

```bash
npm run ai:train-badugi -- \
  --episodes 3 \
  --max-steps 20 \
  --warmup-steps 1 \
  --batch-size 2 \
  --output-dir /tmp/mgx-badugi-rl-smoke \
  --device cpu

npm run ai:export-badugi-onnx -- \
  --checkpoint /tmp/mgx-badugi-rl-smoke/badugi_dqn_latest.pt \
  --output /tmp/mgx-badugi-rl-smoke/badugi_worldmaster_smoke.onnx \
  --no-update-registry

npm run ai:evaluate-badugi-onnx -- \
  --model /tmp/mgx-badugi-rl-smoke/badugi_worldmaster_smoke.onnx \
  --episodes 100 \
  --max-steps 100
```

Longer run template:

```bash
npm run ai:train-badugi -- \
  --episodes 50000 \
  --max-steps 200 \
  --warmup-steps 10000 \
  --batch-size 64 \
  --save-interval 1000 \
  --output-dir rl/models \
  --train-every-steps 4 \
  --teacher-warmup-episodes 5000 \
  --imitation-pretrain-steps 2000 \
  --expert-replay-ratio 0.25 \
  --opponent-profiles balanced,loose_passive,loose_aggressive,tight_passive,tight_aggressive \
  --device cpu

npm run ai:export-badugi-onnx -- \
  --checkpoint rl/models/badugi_dqn_latest.pt \
  --output public/models/badugi_beginner_dqn_v1.onnx \
  --model-id model-badugi-beginner-dqn-v1

npm run ai:verify-models

npm run ai:evaluate-badugi-onnx -- \
  --model public/models/badugi_beginner_dqn_v1.onnx \
  --episodes 1000 \
  --max-steps 200

npm run ai:gate-badugi-model -- \
  --candidate public/models/badugi_beginner_dqn_v1.onnx \
  --baseline public/models/badugi_worldmaster_v1.onnx \
  --episodes 500 \
  --opponent-profiles balanced,loose_passive,loose_aggressive,tight_passive,tight_aggressive
```

Use `--device cuda` only when the host has a compatible GPU setup.
Do not promote a checkpoint to Pro / Iron / WorldMaster unless it was trained
after the latest `BadugiEnv` reward/showdown fixes, has positive or clearly
tier-appropriate avgReward across multiple opponent profiles, and passes ONNX
evaluation. New DQN checkpoints should default to the beginner/experimental
slot until those gates are met.
`npm run ai:gate-badugi-model` exits non-zero unless the candidate clears the
configured avgReward, showdown win-rate, fold-rate, and baseline-delta gates.
Training and gate commands support opponent style mixes through
`--opponent-profiles`; currently available profiles include `balanced`,
`loose_passive`, `loose_aggressive`, `tight_passive`, `tight_aggressive`,
`pat_heavy`, `draw_heavy`, and `random`.
Use `--table-size 6` for Pro-and-above Badugi candidates. The current 6-max
environment is an aggregate approximation: the hero still compares against one
showdown hand, while the other seats contribute position pressure, multiway dead
money, reduced fold equity, and tighter semi-bluff incentives. Promote those
models only against 6-max gates, not heads-up gates.
For current CPU training, keep `--train-every-steps 4` unless you are doing a
small diagnostic run; updating every environment step is much slower and did not
improve the short-run policy.
The Badugi DQN uses the frontend action order
`fold, check, call, bet, raise, all_in`, but fixed-limit training masks illegal
actions by street. Promotion candidates must be evaluated with the same action
masking used during training.

For non-smoke runs, prefer `--teacher-warmup-episodes` instead of starting from
an empty replay buffer. The teacher uses explicit Badugi opening ranges:
A-2-7-or-better one-card draws continue heads-up, rough made Badugis are street
dependent, and hands whose one-draw equity reaches the top half of the starting
hand distribution can continue at a fair fixed-limit price.
The range helper enumerates the full 52C4 starting-hand distribution for the
median strength table. During training, three-card one-away draws use exact
one-draw enumeration, while two-card and weaker keeps use a fast range estimate
so teacher warmup does not dominate runtime.
`--imitation-pretrain-steps` runs supervised behavior cloning on the teacher
states before DQN updates start, and `--expert-replay-ratio` keeps a fixed share
of expert actions in later updates so the opening range is not immediately
overwritten by sparse terminal rewards.

## Building datasets from the app

Export the in-app RL logs (`JSONL`) and convert them into a dataset:

```bash
python rl/tools/export_dataset.py --input ~/Downloads/badugi_rl.jsonl --output rl/datasets/badugi_dataset.json
```

The resulting JSON stores `observation`, `actions`, and `reward` entries for each record so that trainers can load them directly.
