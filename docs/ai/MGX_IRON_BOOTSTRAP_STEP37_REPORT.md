# MGX Iron Bootstrap Step37 Report

## Scope

Step37 expanded branch confidence for the `S02 deep RAISE vs CHECK` candidate by acquiring additional engine-backed replay samples for `playerCount=3` and `playerCount=4`. This was a pre-export governance step only. No dataset rows were added, and routing, promotion, gameplay, source priority, and D01 inclusion remained frozen.

## PlayerCount Acquisition

| PlayerCount | Target Sample | Acquired | Valid | Invalid | Deterministic |
| ----------- | ------------: | -------: | ----: | ------: | ------------- |
| 3 | 50 | 50 | 50 | 0 | true |
| 4 | 50 | 50 | 50 | 0 | true |

Both playerCount branches reached the Step37 target with engine-backed replay samples only. No synthetic injection or hidden-state mutation was used.

## PlayerCount Branch Replay

| PlayerCount | Sample | MeanDelta | SignFlip | Confidence | Verdict |
| ----------- | -----: | --------: | -------: | ---------: | ------- |
| 3 | 50 | 32.2000 | 0.0000 | 0.9500 | CONFIDENT |
| 4 | 50 | 36.8000 | 0.0417 | 0.9500 | CONFIDENT |

Both branches cleared the Step37 confidence threshold. The `playerCount=4` branch retained a small signFlip rate, but it stayed below the export-governance limit.

## Aggregate Stability

| Metric | Result |
| ------ | ------ |
| sample | 100 |
| meanDelta | 34.5000 |
| medianDelta | 0.0000 |
| signFlip | 0.0213 |
| confidence | 0.9500 |
| invalidReplayCount | 0 |
| deterministicReplay | true |
| verdict | STABLE |

The aggregate remained stable after branch-targeted acquisition. The playerCount entropy blocker from Step36 is resolved at the confidence-governance layer.

## Export Governance

| Item | Result |
| ---- | ------ |
| decision | SAFE_TO_EXPORT_NEXT |
| playerCount=3 | CONFIDENT |
| playerCount=4 | CONFIDENT |
| aggregateStability | STABLE |
| crossBucketConsistency | CONSISTENT |
| deterministicReplay | true |
| invalidReplayCount | 0 |
| reason | none |

This is a governance-only decision. Step37 did not export dataset rows.

## Determinism

| Item | Result |
| ---- | ------ |
| deterministic | true |
| mismatchCount | 0 |
| invalidReplayCount | 0 |
| illegal | 0 |
| freeze | 0 |
| sampleCount | 100 |

## Governance

| Item | Result |
| -------------------- | ------ |
| dataset rows changed | false |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| gameplayMutation | false |
| sourcePriorityChanged | false |

## Reports

| Artifact | Path |
| -------- | ---- |
| PlayerCount acquisition | `reports/ai-iron/s02-deep-playercount-acquisition-step37.json` |
| Branch forced replay | `reports/ai-iron/s02-deep-playercount-forced-replay-step37.json` |
| Branch confidence audit | `reports/ai-iron/s02-deep-branch-confidence-step37.json` |
| Aggregate stability recheck | `reports/ai-iron/s02-deep-aggregate-stability-step37.json` |
| Export governance re-decision | `reports/ai-iron/s02-deep-export-governance-step37.json` |
| Determinism audit | `reports/ai-eval/replay-determinism-audit-step37.json` |
| Governance freeze | `reports/ai-iron/governance-freeze-verification-step37.json` |

## Tests

| Command | Result |
| ------- | ------ |
| `npm test -- src/ai/iron/__tests__/acquireS02DeepPlayerCountReplay.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/replayS02DeepPlayerCountBranches.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/auditS02DeepBranchConfidence.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/recheckS02DeepAggregateStability.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/redecideS02DeepExportGovernance.test.js` | passed |
| `MGX_IRON_STEP37_WRITE_REPORTS=1 npm test -- src/ai/iron/__tests__/replayS02DeepPlayerCountBranches.test.js` | passed |
| `npm run test:ai:iron` | passed, 119 files, 147 tests, 3 skipped |
| `npm run test:ai:pro` | passed, 2 files, 295 tests |
| `npm run test:rl:safety` | passed, 8 files, 52 tests |

## Next Step

Step38 can prepare a guarded pre-export package for `S02 deep RAISE vs CHECK` split by `playerCount=3` and `playerCount=4`. The next step should still keep promotion and routing frozen, generate a dataset diff preview first, and require governance approval before any dataset row is added.
