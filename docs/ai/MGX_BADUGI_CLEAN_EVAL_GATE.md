# Badugi 6-max Clean Evaluation Gate

This gate is the formal Badugi DQN promotion check for friend distribution and Pro/Iron review. It is separate from training reward.

## Rule

Training reward alone must not promote a Badugi model. Promotion review uses clean evaluation output plus human/practice evidence.

Clean eval means:

- `epsilon=0`
- teacher off
- exploration off
- 6-max table
- opponent-profile breakdown
- position breakdown
- Pro overlay on/off reported separately
- ONNX usage and fallback rate recorded

## Run Checkpoints

Default target milestones are `50k,100k,200k,500k,1m`.

```bash
npm run ai:evaluate-badugi-sixmax-clean -- \
  --checkpoint-dir rl/models/badugi_sixmax_selfplay \
  --milestones 50k,100k,200k,500k,1m
```

The report is written to:

```text
reports/ai-eval/badugi-sixmax-clean-eval-YYYYMMDD.json
```

## Gate A Report

Use the existing promotion gate against the clean-eval JSON:

```bash
npm run ai:gate-badugi-model -- \
  --clean-eval-report reports/ai-eval/badugi-sixmax-clean-eval-YYYYMMDD.json \
  --clean-eval-mode proOverlayOff
```

Run the overlay path separately when checking deployed Pro behavior:

```bash
npm run ai:gate-badugi-model -- \
  --clean-eval-report reports/ai-eval/badugi-sixmax-clean-eval-YYYYMMDD.json \
  --clean-eval-mode proOverlayOn
```

## Watch Training

During 6-max training, run the watcher with clean eval enabled:

```bash
PYTHONPATH=src .venv/bin/python src/rl/training/watch_sixmax_checkpoints.py \
  --checkpoint-dir rl/models/badugi_sixmax_selfplay \
  --clean-eval
```

Each watched checkpoint writes a clean-eval report path into `sixmax_eval_report.json`.

## Automatic FAIL Conditions

The clean gate fails explicitly when any of these happen:

- target checkpoint/milestone is missing
- no checkpoint is evaluated
- ONNX usage is below `--min-onnx-usage-rate` default `0.99`
- fallback rate is above `--max-fallback-rate` default `0.01`
- zero evaluation episodes are recorded

The report still includes KPI details for diagnosis:

- `valueBetRate`
- `bluffRate`
- `patFrequency`
- `foldRate`
- `showdownWinRate`
- `drawDecisionAccuracy`
- `worstProfileAvgReward`
- `profileSummaries`
- `positionSummaries`
