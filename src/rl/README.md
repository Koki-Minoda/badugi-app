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
  --first-in-value-bet-replay-ratio 0.25 \
  --first-in-value-bet-loss-weight 0.75 \
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

## Windows GPU training

The PowerShell launcher is safe by default: without arguments it only reports
the local Python, PyTorch, CUDA, and GPU status. From PowerShell in
`C:\projects\badugi-app`:

```powershell
.\scripts\windows-badugi-rl.ps1 -Mode Setup
.\scripts\windows-badugi-rl.ps1 -Mode Smoke
```

`Setup` creates the isolated `.venv-rl` environment. If the default PyTorch
package cannot see the NVIDIA GPU, obtain the current Windows CUDA wheel index
URL from the official PyTorch installer and pass it explicitly with
`-TorchIndexUrl`. The launcher refuses `-Device cuda` when CUDA is unavailable.
`Train` starts a fresh run; `Resume` is the only mode that loads `-Checkpoint`.

After the smoke run succeeds, start an explicit 100k continuation from the
tracked 50k checkpoint:

```powershell
.\scripts\windows-badugi-rl.ps1 `
  -Mode Resume `
  -Device auto `
  -Episodes 100000 `
  -SaveInterval 10000 `
  -OutputDir rl/models/badugi_sixmax_windows_100k
```

Controlled continuation experiments can expose the trainer settings without
editing the launcher. For example, a deterministic 10k profile-mix probe is:

```powershell
.\scripts\windows-badugi-rl.ps1 `
  -Mode Resume `
  -Device cpu `
  -Episodes 10000 `
  -SaveInterval 10000 `
  -OutputDir rl/models/badugi_probe_profile_mix `
  -ProfileMixRate 0.5 `
  -TrainingProfiles "loose_aggressive,draw_heavy,loose_passive" `
  -LearningRate 0.00003 `
  -ResumeEpsilon 0.10 `
  -ResumeEpsilonDecayEpisodes 200000 `
  -OpponentUpdateInterval 1000 `
  -OpponentEpsilon 0.05 `
  -Seed 20260827
```

`Diagnose` prints these effective settings. The launcher rejects out-of-range
rates, non-positive intervals, and unknown profile names before training.

The default checkpoint is
`rl/models/badugi_sixmax_foldmargin_100k_from_raiseev_fix/badugi_sixmax_dqn_latest.pt`.
`Resume` loads its weights, uses continuation epsilon decay, and skips teacher
warm-up/imitation. Checkpoints, the latest summary JSON, and a timestamped log
are kept under the output directory. This is a continuation run, not a
bit-for-bit process resume. New-format checkpoints restore optimizer state,
training step/episode counters, global RNG state, and six-max environment RNG
state. Legacy checkpoints remain loadable but do not contain those fields.
Replay, expert, fold, and call buffers plus rolling telemetry histories are
intentionally not stored yet because the current 300k replay design needs a
separate size/compatibility decision.
Every run writes `badugi_sixmax_run_manifest.json` with the exact configuration,
runtime versions, Git commit, input hashes, and this resume-capability boundary.

## Resumable six-max checkpoint inventory

Evaluate existing 10k through 100k checkpoints with one fixed clean-evaluation
matrix and atomically save progress after each checkpoint:

```powershell
npm run ai:inventory-badugi-sixmax -- `
  --checkpoint-dir rl/models/badugi_sixmax_windows_100k_20260827 `
  --baseline rl/models/badugi_sixmax_foldmargin_100k_from_raiseev_fix/badugi_sixmax_dqn_latest.pt `
  --onnx-dir rl/evaluations/badugi_sixmax_windows_100k_20260827 `
  --report reports/ai-eval/badugi-sixmax-windows-100k-inventory.json `
  --device cpu
```

Rerunning the same command resumes from the JSON report and skips checkpoints
whose SHA-256 result is already complete. Selection first requires source
health and baseline-regression checks, then ranks survivors by worst-profile
reward, average reward, and value-bet rate. If none pass, the report explicitly
recommends retaining the baseline.

## Windows Phase 2 experiment matrix

The controlled 10k probes use one pinned baseline SHA, one fixed seed, separate
output directories, and refuse to start while another six-max trainer is
running. Run them serially:

```powershell
.\scripts\windows-badugi-rl-phase2.ps1 -Experiment E0
.\scripts\windows-badugi-rl-phase2.ps1 -Experiment E1
.\scripts\windows-badugi-rl-phase2.ps1 -Experiment E2
.\scripts\windows-badugi-rl-phase2.ps1 -Experiment E3
```

E0 is the control, E1 mixes 50% named profile opponents, E2 uses learning rate
`3e-5`, and E3 lowers continuation epsilon to `0.10`. Each command trains from
the same baseline and immediately runs the fixed seven-profile, two-seed clean
screen. It will not overwrite a partial directory containing checkpoints.
After all four screens complete, aggregate the extension decision with:

```powershell
npm run ai:summarize-badugi-phase2 -- `
  --root rl/models/badugi_phase2_20260827 `
  --output rl/models/badugi_phase2_20260827/phase2-comparison.json
```

Only a run that passes the regression screen and avoids every declared stop
threshold is eligible for a 25k extension. Run that winner from the same common
baseline with `-Episodes 25000`; other episode counts are rejected so result
directories cannot collide through rounded names.

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
Human/practice benchmark is intentionally separate from the synthetic promotion
gate:

```bash
npm run ai:benchmark-badugi-human-practice -- \
  --model public/models/badugi_pro_v1.onnx \
  --tier pro \
  --episodes 200 \
  --report-only
```

Without `--human-log`, the result is `practiceOnly=true` and must not be used to
claim a verified human win rate. To make a human-verified claim, provide
JSON/JSONL hand logs and add `--require-human-logs`; records may use
`heroResult` (`win`/`loss`/`tie`) or numeric `heroNet`.
For current CPU training, keep `--train-every-steps 4` unless you are doing a
small diagnostic run; updating every environment step is much slower and did not
improve the short-run policy.
For Iron-and-above Badugi probes, tune sample quality before increasing episode
count. In particular, use `--first-in-value-bet-replay-ratio` to keep first-in
made-hand value bet fixtures in the supervised mix. This is separate from
`--profitable-continue-replay-ratio`: the former teaches open-bet frequency when
no one has bet yet, while the latter protects EV-positive calls against facing
bets.
The Badugi DQN uses the frontend action order
`fold, check, call, bet, raise, all_in`, but fixed-limit training masks illegal
actions by street. Promotion candidates must be evaluated with the same action
masking used during training.

## NLH / FLH / PLO / PLO8 board DQN

Board-game CPUs use a separate 16-feature betting observation and the same
frontend betting action order: `fold, check, call, bet, raise, all_in`.

Short bootstrap smoke:

```bash
npm run ai:train-board -- \
  --family nlh \
  --tier standard \
  --episodes 80 \
  --teacher-warmup-episodes 30 \
  --imitation-pretrain-steps 3 \
  --batch-size 8 \
  --output-dir /tmp/mgx-board-smoke \
  --device cpu
```

Long-horizon smoke should resume from the current bootstrap checkpoint so it
does not destroy the minimum fixture policy in a tiny run:

```bash
npm run ai:train-board -- \
  --family nlh \
  --tier standard \
  --long-horizon \
  --episodes 120 \
  --max-steps 6 \
  --teacher-warmup-episodes 40 \
  --imitation-pretrain-steps 5 \
  --batch-size 8 \
  --resume-checkpoint rl/models/board_nlh_standard_20260505/nlh_standard_board_dqn_latest.pt \
  --output-dir /tmp/mgx-board-long-resume-nlh \
  --device cpu

npm run ai:export-board-onnx -- \
  --family nlh \
  --tier standard \
  --checkpoint /tmp/mgx-board-long-resume-nlh/nlh_standard_board_dqn_latest.pt \
  --output /tmp/nlh_long_resume_smoke.onnx \
  --no-update-registry \
  --device cpu

npm run ai:evaluate-board-onnx -- \
  --model /tmp/nlh_long_resume_smoke.onnx \
  --variant-id B01
```

Use `--family flh`, `--family plo`, or `--family plo8` with variant IDs `B02`,
`B05`, and `B06` respectively. Promotion beyond Beginner/Standard requires a
separate gate for EV delta, fold discipline, thin value, bluff frequency,
multiway isolation, and PLO8 scoop/no-low behavior.

The board teacher now includes a GTO-inspired preflop range layer without
copying proprietary solver charts. NLH/FLH use position-specific open floors
for UTG/MP/CO/BTN/SB/BB and score pairs, suited aces, broadways, connectors,
and dominated offsuit trash separately. PLO/PLO8 weight nut potential,
connectedness, double-suited structure, premium pairs, dangler penalties, and
multiway pressure; PLO8 adds scoop-oriented A2/wheel-low plus high-backup
credit and folds weak no-low structures more often.

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
