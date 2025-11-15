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
