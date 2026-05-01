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

## Building datasets from the app

Export the in-app RL logs (`JSONL`) and convert them into a dataset:

```bash
python rl/tools/export_dataset.py --input ~/Downloads/badugi_rl.jsonl --output rl/datasets/badugi_dataset.json
```

The resulting JSON stores `observation`, `actions`, and `reward` entries for each record so that trainers can load them directly.
