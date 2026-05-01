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
```

Use `--device cuda` only when the host has a compatible GPU setup.
Do not promote a checkpoint to Pro / Iron / WorldMaster unless it was trained
after the latest `BadugiEnv` reward/showdown fixes, has positive or clearly
tier-appropriate avgReward across multiple opponent profiles, and passes ONNX
evaluation. New DQN checkpoints should default to the beginner/experimental
slot until those gates are met.
For current CPU training, keep `--train-every-steps 4` unless you are doing a
small diagnostic run; updating every environment step is much slower and did not
improve the short-run policy.
The Badugi DQN uses the frontend action order
`fold, check, call, bet, raise, all_in`, but fixed-limit training masks illegal
actions by street. Promotion candidates must be evaluated with the same action
masking used during training.

## Building datasets from the app

Export the in-app RL logs (`JSONL`) and convert them into a dataset:

```bash
python rl/tools/export_dataset.py --input ~/Downloads/badugi_rl.jsonl --output rl/datasets/badugi_dataset.json
```

The resulting JSON stores `observation`, `actions`, and `reward` entries for each record so that trainers can load them directly.
