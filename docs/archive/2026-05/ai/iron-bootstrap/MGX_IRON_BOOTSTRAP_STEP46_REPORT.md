# MGX Iron Bootstrap Step46 Report

Step46 repeated the Step45 natural mixed exposure setup across three dry-run arena runs. No promotion, routing change, dataset overwrite, source-priority change, gameplay mutation, hidden-state injection, synthetic opportunity injection, model registry mutation, or D01 teacher inclusion was performed.

Each run used `iron-step39-action-value.jsonl`, variants `D02,S01,S02`, `hands=18000`, `max-hands=1800`, and natural mixed exposure with deterministic table-size schedule `6max, 6max, 4max, 3way`.

## Natural Mixed Repeatability

| Run | Exact Opps | Hits | HitRate | Worst Iron-Pro |
| --- | ---------: | ---: | ------: | -------------: |
| A | 7 | 7 | 1.0000 | 0.63 |
| B | 4 | 4 | 1.0000 | 0.12 |
| C | 6 | 6 | 1.0000 | 0.20 |

Summary:

| Metric | Mean | Stddev | Min | Max |
| ------ | ---: | -----: | --: | --: |
| Exact opportunities | 5.6667 | 1.5275 | 4 | 7 |
| Exact hits | 5.6667 | 1.5275 | 4 | 7 |
| Exact hit rate | 1.0000 | 0.0000 | 1.0000 | 1.0000 |
| S02 Iron-Pro gap | 1.1367 | 0.9773 | 0.20 | 2.15 |
| Worst variant Iron-Pro gap | 0.3167 | 0.2743 | 0.12 | 0.63 |

All runs had `illegal=0`, `freeze=0`, exact hits, and positive Iron-Pro gap across D02/S01/S02.

## Iron Results

| Run | S02 Iron-Pro | S02 Iron-Standard | DatasetHitRate | ProFallbackRate |
| --- | -----------: | ----------------: | -------------: | --------------: |
| A | 2.15 | -3.38 | 0.0079 | 0.9921 |
| B | 1.06 | -3.99 | 0.0040 | 0.9960 |
| C | 0.20 | -7.17 | 0.0034 | 0.9966 |

Iron-Pro remained positive. Iron-Standard remains negative in this narrow dry-run, so this remains a gated learning/export-validation path, not a promotion path.

## Coaching Material Candidates

| Variant | Spot | LessonTag | EVGain |
| ------- | ---- | --------- | -----: |
| S02 | deep RAISE-vs-CHECK playerCount=3 | missed-value | 32.2 |
| S02 | deep RAISE-vs-CHECK playerCount=4 | missed-value | 36.8 |

Both candidates are preview-only coaching/RL material. They were not exported into a training dataset.

## RL Signal Preview

| Category | Count |
| -------- | ----: |
| READY_FOR_SUPERVISED_SIGNAL | 2 |
| READY_FOR_COACHING_ONLY | 0 |
| MONITOR_ONLY | 0 |
| REJECT | 0 |

## Repeatability Classification

| Item | Result |
| ---- | ------ |
| Classification | REPEATABLE |
| Runs with exact hits | 3 / 3 |
| Deterministic | true |
| mismatchCount | 0 |
| invalidReplayCount | 0 |

## Governance

| Item | Result |
| ---- | ------ |
| dataset rows changed | false |
| training dataset mutation | false |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| gameplay mutation | false |
| source priority changed | false |
| model registry mutation | false |
| hidden-state injection | false |
| synthetic opportunity injection | false |

## Artifacts

| Artifact | Path |
| -------- | ---- |
| Repeatability run A | `reports/ai-iron/iron-step46-natural-repeat-a.json` |
| Repeatability run B | `reports/ai-iron/iron-step46-natural-repeat-b.json` |
| Repeatability run C | `reports/ai-iron/iron-step46-natural-repeat-c.json` |
| Repeatability summary | `reports/ai-iron/step46-natural-repeatability-summary.json` |
| Coaching candidates | `reports/ai-iron/step46-coaching-material-candidates.jsonl` |
| RL signal preview | `reports/ai-iron/step46-rl-signal-preview.json` |
| Classification | `reports/ai-iron/step46-repeatability-classification.json` |
| Determinism refresh | `reports/ai-eval/replay-determinism-audit-iron-step46.json` |
| Governance freeze | `reports/ai-iron/governance-freeze-verification-step46.json` |

## Conclusion

Natural mixed exposure recovery is repeatable across three independent Step46 runs. Exact hits appeared in every run, exact hit rate stayed at `1.0`, all variants remained Iron-Pro positive, and safety/governance remained frozen.

Recommended next step: prepare a gated coaching/RL handoff package that keeps these rows preview-only while adding lesson metadata, replay references, and supervised-signal eligibility checks for downstream training or feedback systems.
