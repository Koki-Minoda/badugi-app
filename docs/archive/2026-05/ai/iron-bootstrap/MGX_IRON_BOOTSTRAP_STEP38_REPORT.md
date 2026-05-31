# MGX Iron Bootstrap Step38 Report

## Scope

Step38 prepared a gated pre-export package for `S02 deep RAISE vs CHECK` split by `playerCount=3` and `playerCount=4`. This step produced preview artifacts only. The production action-value dataset was not overwritten or mutated, and routing, promotion, gameplay, source priority, and D01 inclusion remained frozen.

## Pre-export Rows

| PlayerCount | Rows | MeanDelta | SignFlip | Confidence |
| ----------- | ---: | --------: | -------: | ---------: |
| 3 | 1 | 32.2000 | 0.0000 | 0.9500 |
| 4 | 1 | 36.8000 | 0.0417 | 0.9500 |

The preview package contains 2 rows with `sourceType=verified-forced-replay`, `sourceStep=step37`, `chosenBestAction=RAISE`, and `rejectedAction=CHECK`.

## Dataset Diff Preview

| Metric | Before | After |
| ------ | -----: | ----: |
| rows | 1069 | 1071 |
| S02 rows | 658 | 660 |
| sourceTypes | 5 | 6 |

| Source Type | Before | After |
| ----------- | -----: | ----: |
| stable-bucket | 606 | 606 |
| verified-neighbor-v1 | 64 | 64 |
| verified-neighbor-v2 | 71 | 71 |
| verified-neighbor-v3-isolated | 239 | 239 |
| verified-relaxed-match | 89 | 89 |
| verified-forced-replay | 0 | 2 |

| Risk Item | Result |
| --------- | ------ |
| riskFlags | none |
| highRiskFlags | none |
| actualDatasetMutation | false |

## Validation

| Gate | Result |
| --------------------- | ------ |
| schema | PASS |
| forcedReplay metadata | PASS |
| thresholds | PASS |
| governance freeze | PASS |
| legal action | PASS |

Validation result: `PASS`, with 2 valid rows and 0 invalid rows.

## Rollback Plan

| Item | Result |
| ---- | ------ |
| baseDataset | `data/ai/action-value/iron-step15-action-value.jsonl` |
| preexportRows | `reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl` |
| actualDatasetMutation | false |
| rollbackRequired | false |
| step39IfApproved | write new dataset file, do not overwrite base |

## Approval

| Item | Result |
| ---- | ------ |
| approval | APPROVED_FOR_STEP39_EXPORT |
| reason | all-gates-pass |
| validationStatus | PASS |
| highRiskFlags | none |
| rollbackPlanExists | true |
| governanceFreezeIntact | true |

This approval is for Step39 only. Step38 did not export or mutate the production dataset.

## Governance

| Item | Result |
| ---------------------- | ------ |
| actual dataset changed | false |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| gameplayMutation | false |
| sourcePriorityChanged | false |

## Reports

| Artifact | Path |
| -------- | ---- |
| Pre-export rows | `reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl` |
| Dataset diff preview | `reports/ai-iron/dataset-diff-preview-step38.json` |
| Pre-export validation | `reports/ai-iron/preexport-validation-step38.json` |
| Rollback plan | `reports/ai-iron/preexport-rollback-plan-step38.json` |
| Approval decision | `reports/ai-iron/preexport-approval-step38.json` |
| Governance freeze | `reports/ai-iron/governance-freeze-verification-step38.json` |

## Tests

| Command | Result |
| ------- | ------ |
| `npm test -- src/ai/iron/__tests__/buildS02DeepPreExportRows.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/previewActionValueDatasetDiff.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/validatePreExportPackage.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/createPreExportRollbackPlan.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/decidePreExportApproval.test.js` | passed |
| `npm run test:ai:iron` | passed, 124 files, 153 tests, 3 skipped |
| `npm run test:ai:pro` | passed, 2 files, 295 tests |
| `npm run test:rl:safety` | passed, 8 files, 52 tests |

## Next Step

Step39 can export the approved rows into a new action-value dataset file without overwriting `iron-step15-action-value.jsonl`. Routing and promotion should remain frozen until post-export validation and monitor replay pass.
