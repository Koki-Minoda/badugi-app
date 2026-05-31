# MGX Iron Bootstrap Step36 Report

## Scope

Step36 audited the Step35 `S02 deep RAISE vs CHECK` signal for narrow export safety. This was a governance and isolation audit only. No dataset rows were added, and routing, promotion, gameplay, source priority, and D01 inclusion remained frozen.

## Isolation

| Bucket | Sample | MeanDelta | SignFlip | Confidence | Entropy | Verdict |
| ------ | -----: | --------: | -------: | ---------: | ------: | ------- |
| deep RAISE vs CHECK | 60 | 26.3333 | 0.0455 | 0.9500 | 0.2668 | STABLE |
| handClass=lowerMediumSDA5 | 60 | 26.3333 | 0.0455 | 0.9500 | 0.2668 | STABLE |
| position=big-blind | 60 | 26.3333 | 0.0455 | 0.9500 | 0.2668 | STABLE |
| pressureFamily=none-pressure | 60 | 26.3333 | 0.0455 | 0.9500 | 0.2668 | STABLE |
| drawRound=draw-0 | 60 | 26.3333 | 0.0455 | 0.9500 | 0.2668 | STABLE |
| callBand=small | 60 | 26.3333 | 0.0455 | 0.9500 | 0.2668 | STABLE |
| playerCount=3 | 30 | 23.3333 | 0.0000 | 0.7500 | 0.0000 | UNDERPOWERED |
| playerCount=4 | 30 | 29.3333 | 0.0833 | 0.6875 | 0.4138 | UNDERPOWERED |

The apparent stable context is narrow on handClass, position, pressureFamily, drawRound, and callBand. It is not yet narrow on playerCount: the data splits evenly across `3` and `4`, and each side is still below confidence threshold.

## Entropy Source Audit

| Source | Unique | Entropy | Severity |
| ------ | -----: | ------: | -------- |
| position entropy | 1 | 0.0000 | LOW_ENTROPY |
| pressure entropy | 1 | 0.0000 | LOW_ENTROPY |
| drawRound entropy | 1 | 0.0000 | LOW_ENTROPY |
| playerCount entropy | 2 | 1.0000 | HIGH_ENTROPY |
| callBand entropy | 1 | 0.0000 | LOW_ENTROPY |

The only broad-context contamination source is playerCount. Because playerCount entropy is high, Step36 does not mark this safe for immediate dataset export.

## Narrow Candidates

| Candidate | Sample | Confidence | Entropy | Verdict |
| --------- | -----: | ---------: | ------: | ------- |
| deep RAISE vs CHECK | 60 | 0.9500 | 0.2668 | EXPORTABLE_CANDIDATE |
| handClass=lowerMediumSDA5 | 60 | 0.9500 | 0.2668 | EXPORTABLE_CANDIDATE |
| position=big-blind | 60 | 0.9500 | 0.2668 | EXPORTABLE_CANDIDATE |
| pressureFamily=none-pressure | 60 | 0.9500 | 0.2668 | EXPORTABLE_CANDIDATE |
| drawRound=draw-0 | 60 | 0.9500 | 0.2668 | EXPORTABLE_CANDIDATE |
| callBand=small | 60 | 0.9500 | 0.2668 | EXPORTABLE_CANDIDATE |
| playerCount=3 | 30 | 0.7500 | 0.0000 | COUNTERFACTUAL_ONLY |
| playerCount=4 | 30 | 0.6875 | 0.4138 | COUNTERFACTUAL_ONLY |

## Cross-Bucket Stability

| Item | Result |
| ---- | ------ |
| consistency | CONSISTENT |
| directionConsistent | true |
| playerCount=3 direction | POSITIVE |
| playerCount=4 direction | POSITIVE |

Both playerCount branches remain positive, so direction is not broken. The blocker is confidence and entropy, not sign direction.

## Export Governance

| Item | Result |
| ---- | ------ |
| decision | COUNTERFACTUAL_ONLY |
| reason | high-entropy-source |
| deterministicReplay | true |
| crossBucketConsistency | CONSISTENT |
| entropyClassification | HIGH_ENTROPY |

This is a near export candidate, but not yet `SAFE_TO_EXPORT_NEXT`. The playerCount split must be stabilized first.

## Determinism

| Item | Result |
| ---- | ------ |
| deterministic | true |
| mismatchCount | 0 |
| invalidReplayCount | 0 |
| illegal | 0 |
| freeze | 0 |
| sampleCount | 60 |

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
| Deep RAISE/CHECK isolation | `reports/ai-iron/s02-deep-raisecheck-isolation-step36.json` |
| Entropy audit | `reports/ai-iron/s02-deep-entropy-step36.json` |
| Narrow candidate scan | `reports/ai-iron/s02-deep-narrow-candidates-step36.json` |
| Cross-bucket stability | `reports/ai-iron/s02-deep-crossbucket-stability-step36.json` |
| Export governance | `reports/ai-iron/s02-deep-export-governance-step36.json` |
| Determinism audit | `reports/ai-eval/replay-determinism-audit-step36.json` |
| Governance freeze | `reports/ai-iron/governance-freeze-verification-step36.json` |

## Tests

| Command | Result |
| ------- | ------ |
| `npm test -- src/ai/iron/__tests__/isolateS02DeepRaiseCheck.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/auditS02DeepEntropySources.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/scanS02DeepNarrowCandidates.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/auditS02DeepCrossBucketStability.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/decideS02DeepExportGovernance.test.js` | passed |
| `npm run test:ai:iron` | passed, 114 files, 141 tests, 2 gated tests skipped |
| `npm run test:ai:pro` | passed, 2 files, 295 tests |
| `npm run test:rl:safety` | passed, 8 files, 52 tests |

## Next Step

Step37 should remain pre-export and acquire more deep `RAISE vs CHECK` samples split by `playerCount=3` and `playerCount=4`. The target is to raise each playerCount branch to confidence >= 0.80 while preserving signFlip <= 0.10, invalidReplayCount = 0, and deterministic replay.
