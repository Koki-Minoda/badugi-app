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

## Building datasets from the app

Export the in-app RL logs (`JSONL`) and convert them into a dataset:

```bash
python rl/tools/export_dataset.py --input ~/Downloads/badugi_rl.jsonl --output rl/datasets/badugi_dataset.json
```

The resulting JSON stores `observation`, `actions`, and `reward` entries for each record so that trainers can load them directly.
