# MGX Iron Bootstrap Step34 Report

## Scope

Step34 ran Vitest-backed forced-action replay for the Step33 S02 stackDepth shadow signals. This step did not export dataset rows, change routing, promote Iron, mutate gameplay, or change source priority.

Direct Node execution is still intentionally unsuitable for this path because the replay engine imports `.jsx` modules. The Step34 reports were generated through the Vitest-backed harness with `MGX_IRON_STEP34_WRITE_REPORTS=1`.

## Forced Replay

| StackDepth | Sample | Valid | MeanDelta | SignFlip | Confidence | Verdict |
| ---------- | -----: | ----: | --------: | -------: | ---------: | ------- |
| shallow | 0 | 0 | 0.0000 | 0.0000 | 0.0000 | NO_REPLAY_SIGNAL |
| medium | 20 | 20 | 103.0000 | 0.3000 | 0.3500 | VOLATILE |
| deep | 20 | 20 | 40.0000 | 0.0833 | 0.4583 | POSITIVE_UNDERPOWERED |

## Per-depth Stability

| StackDepth | Sample | MeanDelta | MedianDelta | SignFlip | Confidence | Interpretation |
| ---------- | -----: | --------: | ----------: | -------: | ---------: | -------------- |
| shallow | 0 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Missing engine-backed replay samples. |
| medium | 20 | 103.0000 | -40.0000 | 0.3000 | 0.3500 | Positive mean, but unstable distribution. |
| deep | 20 | 40.0000 | 70.0000 | 0.0833 | 0.4583 | Low signFlip, but confidence is under export threshold. |

## Cross-depth Consistency

| Item | Result |
| ---- | ------ |
| Direction consistent | false |
| Consistency | PARTIAL |
| Best depth | medium |
| Worst depth | deep |
| Exportable | false |

Available engine-backed depths were directionally positive, but full consistency is not established because shallow has no engine-backed replay signal and both available depths remain below confidence requirements.

## Determinism

| Item | Result |
| ---- | ------ |
| deterministic | true |
| mismatchCount | 0 |
| invalidReplayCount | 0 |
| validReplayCount | 40 |

## Exportability Decision

| Candidate | Decision | Reason |
| --------- | -------- | ------ |
| S02 coverage-shadow stackDepth | MONITOR_ONLY | missing-engine-backed-depth; medium signFlipRate > 0.10; confidence < 0.80 |

Depth-level failures:

| StackDepth | Decision | Failures |
| ---------- | -------- | -------- |
| shallow | NO_REPLAY_SIGNAL | sampleCount<20; confidence<0.80; meanDelta<=0 |
| medium | VOLATILE | signFlipRate>0.10; confidence<0.80 |
| deep | POSITIVE_UNDERPOWERED | confidence<0.80 |

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

## Tests

| Command | Result |
| ------- | ------ |
| `MGX_IRON_STEP34_WRITE_REPORTS=1 npm test -- src/ai/iron/__tests__/runS02StackDepthForcedReplay.test.js` | generated Step34 JSON reports |
| `npm test -- src/ai/iron/__tests__/runS02StackDepthForcedReplay.test.js` | passed, 2 tests, 1 gated report-generation test skipped |
| `npm test -- src/ai/iron/__tests__/auditS02StackDepthStability.test.js` | passed, 1 test |
| `npm test -- src/ai/iron/__tests__/checkS02CrossDepthConsistency.test.js` | passed, 2 tests |
| `npm test -- src/ai/iron/__tests__/decideS02StackDepthExportability.test.js` | passed, 2 tests |
| `npm run test:ai:iron` | passed, 103 files, 128 tests, 1 gated test skipped |
| `npm run test:ai:pro` | passed, 2 files, 295 tests |
| `npm run test:rl:safety` | passed, 8 files, 52 tests |

## Next Step

Step35 should stay in verification mode and acquire engine-backed shallow S02 replay samples, then rerun stackDepth forced replay with higher per-depth sample size and action-pair isolation. No dataset export should occur until shallow is replay-backed and every candidate depth meets signFlip, confidence, repair, and determinism thresholds.
