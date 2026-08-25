# MGX Iron Bootstrap Step29 Forced Replay Report

## Summary

Step29 added a Vitest-backed forced-action replay runner so the `.jsx` engine dependency is resolved by Vitest rather than direct Node execution. The target bucket was `S02 lowerMediumSDA5 bet-pressure`, comparing Standard-like `CALL` against Pro-like `FOLD` from the same replay state.

This step did not export dataset rows, change routing, promote Iron, mutate gameplay, add D01 teacher data, or change source priority.

The final run used `max-samples=30`, the minimum sample count for the Step29 exportability gate. The requested runner supports higher values, but `500` would be unnecessarily heavy in this environment.

## Forced Replay Summary

| Bucket | ActionA | ActionB | Sample | Valid | MeanDelta | SignFlip | Verdict |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| S02 lowerMediumSDA5 bet-pressure | CALL | FOLD | `30` | `30` | `24.0000` | `0.4333` | COUNTERFACTUAL_ONLY |

| Metric | Result |
| --- | ---: |
| invalidReplays | `0` |
| medianDelta | `40.0000` |
| confidence | `0.4250` |
| repairRate | `0.0000` |
| deterministicReplay | `true` |
| positive delta count | `17` |
| negative delta count | `13` |
| minDelta | `-20.0000` |
| maxDelta | `70.0000` |

CALL has positive average EV over FOLD, but the sign flip rate is too high for export.

## Sub-bucket Replay

| SubBucket | Sample | MeanDelta | SignFlip | Verdict |
| --- | ---: | ---: | ---: | --- |
| playerCount=4way+ | `30` | `24.0000` | `0.4333` | COUNTERFACTUAL_ONLY |
| callBand=small | `30` | `24.0000` | `0.4333` | COUNTERFACTUAL_ONLY |
| pressureFamily=bet-pressure | `30` | `24.0000` | `0.4333` | COUNTERFACTUAL_ONLY |
| drawRound=draw-0 | `30` | `24.0000` | `0.4333` | COUNTERFACTUAL_ONLY |

No isolated sub-bucket reached `EXPORTABLE_CANDIDATE`.

## Determinism

| Item | Result |
| --- | --- |
| deterministic | `true` |
| mismatchCount | `0` |
| invalidReplayCount | `0` |

## Exportability Decision

| Decision | Reason |
| --- | --- |
| COUNTERFACTUAL_ONLY | signFlip-too-high, confidence-too-low, entropy-not-isolated |

The forced replay result resolves the Step28 proxy limitation. The bucket remains non-exportable because the real forced EV distribution flips sign on `13/30` valid replays.

## Generated Artifacts

| Artifact | Result |
| --- | --- |
| `src/ai/iron/runForcedActionReplay.js` | forced replay core |
| `src/ai/iron/__tests__/forcedActionReplayHarness.test.js` | Vitest-backed harness |
| `scripts/runIronForcedReplayVitest.mjs` | CLI wrapper |
| `reports/ai-iron/s02-lowermedium-forced-replay-step29.json` | generated |
| `reports/ai-iron/s02-lowermedium-subbucket-forced-replay-step29.json` | generated |
| `reports/ai-iron/s02-forced-replay-determinism-step29.json` | generated |
| `reports/ai-iron/s02-exportability-decision-step29.json` | generated |

## Governance

| Item | Result |
| --- | --- |
| dataset rows changed | false |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| gameplay mutation | false |
| source priority changed | false |

## Tests

| Command | Result |
| --- | --- |
| `npm test -- src/ai/iron/__tests__/runForcedActionReplay.test.js` | pass, 2 tests |
| `npm test -- src/ai/iron/__tests__/forcedActionReplayHarness.test.js` | pass, 1 test |
| `npm test -- src/ai/iron/__tests__/s02LowerMediumForcedReplay.test.js` | pass, 1 test |
| `npm run test:ai:iron` | pass, 81 files / 102 tests |
| `npm run test:ai:pro` | pass, 2 files / 295 tests |
| `npm run test:rl:safety` | pass, 8 files / 52 tests |

## Next Step

Step30 should not expand the dataset for this bucket. The evidence supports either closing `S02 lowerMediumSDA5 bet-pressure` as `COUNTERFACTUAL_ONLY / monitor`, or starting a new coverage audit for a different non-trash, non-weak, lower-entropy family.
