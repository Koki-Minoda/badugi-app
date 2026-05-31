# MGX Iron Bootstrap Step40 Report

Step40 ran the post-export dry-run smoke arena against the new Step39 dataset without changing routing, promotion, gameplay, source priority, or the production/base dataset.

## Smoke Arena

Dataset: `data/ai/action-value/iron-step39-action-value.jsonl`

| Variant | Iron | Pro | Standard | Iron-Pro |
| ------- | ---: | --: | -------: | -------: |
| D02 | 5.54 | 4.02 | 1.24 | 1.52 |
| S01 | 4.25 | 3.43 | 4.90 | 0.82 |
| S02 | 5.56 | 3.34 | 5.05 | 2.22 |

Regression audit: `PASS`

| Metric | Result |
| ------ | ------ |
| illegal | 0 |
| freeze | 0 |
| worst Iron-Pro gap | 0.82 |
| catastrophic regression | false |

## Forced Replay Attribution

| Source | Hits | Exact Opportunities | Legal | Fallback |
| ------ | ---: | ------------------: | ----: | -------: |
| verified-forced-replay | 0 | 0 | 2/2 | 0 |

The Step39 rows were legal and non-destructive. Zero smoke-arena hits is not a Step40 failure because this phase validates dry-run safety, not promotion readiness.

## Determinism

| Metric | Result |
| ------ | ------ |
| deterministic | true |
| mismatchCount | 0 |
| invalidReplayCount | 0 |
| replaySamples | 912 |

## Governance

| Item | Result |
| ---- | ------ |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| gameplay mutation | false |
| source priority changed | false |
| model registry mutation | false |

## Safety

| Metric | Result |
| ------ | ------ |
| illegal | 0 |
| freeze | 0 |
| invalidReplayCount | 0 |
| deterministic | true |
| mismatchCount | 0 |
| safety verdict | SAFE |

## Reports

| Report | Path |
| ------ | ---- |
| smoke arena | `reports/ai-iron/iron-step40-smoke-arena.json` |
| regression audit | `reports/ai-iron/iron-step40-regression-audit.json` |
| forced replay attribution | `reports/ai-iron/forced-replay-attribution-step40.json` |
| determinism refresh | `reports/ai-eval/replay-determinism-audit-iron-step40.json` |
| governance refresh | `reports/ai-iron/iron-step40-governance-refresh.json` |
| safety verification | `reports/ai-iron/iron-step40-safety-verification.json` |

## Tests

| Command | Result |
| ------- | ------ |
| `npm test -- src/ai/iron/__tests__/auditPostExportIronRegression.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditForcedReplayRowAttribution.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/refreshDryRunGovernanceState.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/verifySmokeArenaSafety.test.js` | PASS |
| `npm run test:ai:iron` | PASS |
| `npm run test:ai:pro` | PASS |
| `npm run test:rl:safety` | PASS |

## Step41 Recommendation

Proceed to a targeted opportunity/hit-path validation for `S02 deep RAISE-vs-CHECK` playerCount 3 and 4 using the Step39 dataset. Keep routing and promotion frozen. The main open question is not safety, but whether the new verified-forced-replay rows can be observed often enough in targeted dry-run conditions before any promotion discussion.
