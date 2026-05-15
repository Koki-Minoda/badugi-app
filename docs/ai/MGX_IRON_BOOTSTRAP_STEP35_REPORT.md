# MGX Iron Bootstrap Step35 Report

## Scope

Step35 performed engine-backed shallow replay acquisition, medium signFlip isolation, deep sample-size expansion, action-pair isolation, replay stability re-evaluation, and exportability recheck. No dataset export, routing change, promotion, gameplay mutation, source-priority change, or D01 inclusion was performed.

## Replay Acquisition

| Depth | Samples | Valid | Invalid |
| ----- | ------: | ----: | ------: |
| shallow | 0 | 0 | 0 |
| medium | 44 | 44 | 0 |
| deep | 60 | 60 | 0 |

Shallow acquisition scanned 68,496 S02 engine-backed replay samples, including the Step35 acquisition corpora. The resulting depth distribution was `deep=68451`, `medium=45`, `shallow=0`, so shallow remains `NO_SIGNAL` without synthetic injection.

## Stability

| Depth | MeanDelta | SignFlip | Confidence | Verdict |
| ----- | --------: | -------: | ---------: | ------- |
| shallow | 0.0000 | 0.0000 | 0.0000 | NO_SIGNAL |
| medium | 118.6364 | 0.3636 | 0.7000 | VOLATILE |
| deep | 26.3333 | 0.0455 | 0.9500 | STABLE |

Medium improved sample count from 20 to 44, but signFlip increased from 0.3000 to 0.3636. Deep improved from 20 to 60 samples and confidence improved from 0.4583 to 0.9500 while keeping invalid replay count at 0.

## Medium SignFlip Isolation

| Axis | Bucket | Sample | MeanDelta | SignFlip | Confidence | Verdict |
| ---- | ------ | -----: | --------: | -------: | ---------: | ------- |
| actionPair | CALL vs FOLD | 41 | 107.3171 | 0.3415 | 0.6750 | HIGH_FLIP |
| actionPair | RAISE vs FOLD | 3 | 273.3333 | 0.3333 | 0.0500 | HIGH_FLIP |
| pressureFamily | raise-pressure | 44 | 118.6364 | 0.3636 | 0.7000 | HIGH_FLIP |
| playerCount | 3 | 44 | 118.6364 | 0.3636 | 0.7000 | HIGH_FLIP |
| drawRound | draw-1 | 44 | 118.6364 | 0.3636 | 0.7000 | HIGH_FLIP |

The medium signal remains mixed. The broad positive mean is not export-safe because negative outcomes are frequent across the dominant CALL vs FOLD pair.

## Action Pair Isolation

| Pair | MeanDelta | SignFlip | Confidence |
| ---- | --------: | -------: | ---------: |
| RAISE vs CHECK | 26.3333 | 0.0455 | 0.9500 |
| CALL vs FOLD | 107.3171 | 0.3415 | 0.6750 |
| RAISE vs FOLD | 273.3333 | 0.3333 | 0.0500 |

The only stable action-pair signal is deep `RAISE vs CHECK`. The medium action pairs remain high-flip and should not be exported.

## Exportability Recheck

| Depth | Decision | Failures |
| ----- | -------- | -------- |
| shallow | NO_SIGNAL | sampleCount<30; confidence<0.80; meanDelta<=0 |
| medium | VOLATILE | signFlipRate>0.10; confidence<0.80 |
| deep | STABLE / EXPORTABLE_CANDIDATE | none |

Overall recheck result: `EXPORTABLE_CANDIDATE`, scoped only to `deep`. Shallow and medium remain non-exportable.

## Determinism

| Item | Result |
| ---- | ------ |
| deterministic | true |
| mismatchCount | 0 |
| invalidReplayCount | 0 |
| illegal | 0 |
| freeze | 0 |
| sampleCount | 104 |

## Governance

| Item | Result |
| ---- | ------ |
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
| Shallow replay acquisition | `reports/ai-iron/s02-shallow-replay-acquisition-step35.json` |
| StackDepth forced replay | `reports/ai-iron/s02-stackdepth-forced-replay-step35.json` |
| Medium signFlip isolation | `reports/ai-iron/s02-medium-signflip-isolation-step35.json` |
| Deep confidence expansion | `reports/ai-iron/s02-deep-confidence-expansion-step35.json` |
| Action-pair isolation | `reports/ai-iron/s02-actionpair-isolation-step35.json` |
| Stability re-evaluation | `reports/ai-iron/s02-replay-stability-reeval-step35.json` |
| Exportability recheck | `reports/ai-iron/s02-exportability-recheck-step35.json` |
| Governance freeze | `reports/ai-iron/governance-freeze-verification-step35.json` |
| Determinism audit | `reports/ai-eval/replay-determinism-audit-step35.json` |

## Tests

| Command | Result |
| ------- | ------ |
| `npm run eval:ai:pro -- --variants=S02 --seed=20350514 --hands=300 --playerCount=6 --capture-divergence=true --corpus-tag=iron-step35 --max-divergence-samples=800 --max-replay-samples=800` | passed, generated deep-only acquisition corpus |
| `npm run eval:ai:pro -- --variants=S02 --seed=20350515 --hands=3000 --playerCount=6 --capture-divergence=true --corpus-tag=iron-step35 --max-divergence-samples=2500 --max-replay-samples=2500` | passed, generated deep/medium acquisition corpus |
| `MGX_IRON_STEP35_WRITE_REPORTS=1 npm test -- src/ai/iron/__tests__/runS02StackDepthForcedReplay.test.js` | passed, generated Step35 reports |
| `npm test -- src/ai/iron/__tests__/acquireS02ShallowReplaySignals.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/isolateS02MediumSignFlip.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/expandS02DeepReplaySamples.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/isolateS02ActionPairs.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/reEvaluateS02ReplayStability.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/recheckS02Exportability.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/runS02StackDepthForcedReplay.test.js` | passed, 2 tests, 2 gated report tests skipped |
| `npm run test:ai:iron` | passed, 109 files, 135 tests, 2 gated tests skipped |
| `npm run test:ai:pro` | passed, 2 files, 295 tests |
| `npm run test:rl:safety` | passed, 8 files, 52 tests |

## Next Step

Step36 should stay in verification mode and isolate the deep `RAISE vs CHECK` candidate by handClass, position, pressure family, drawRound, and playerCount before any dataset export. Shallow should remain acquisition-only until the engine-backed corpus naturally contains shallow samples.
