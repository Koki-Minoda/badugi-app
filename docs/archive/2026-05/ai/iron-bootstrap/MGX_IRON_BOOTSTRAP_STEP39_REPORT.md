# MGX Iron Bootstrap Step39 Report

## Scope

Step39 exported the Step38-approved `S02 deep RAISE vs CHECK` rows into a new action-value dataset file. The base dataset was not overwritten. Production routing, promotion, model registry, gameplay, source priority, and D01 inclusion remained frozen.

## Dataset Export

| Item | Result |
| ---------------- | ------ |
| Base dataset | `data/ai/action-value/iron-step15-action-value.jsonl` |
| New dataset | `data/ai/action-value/iron-step39-action-value.jsonl` |
| Base rows | 1069 |
| Added rows | 2 |
| Final rows | 1071 |
| Duplicate rows | 0 |
| Base overwritten | false |

## Added Rows

| Bucket | PlayerCount | MeanDelta | SignFlip | Confidence |
| ------ | ----------: | --------: | -------: | ---------: |
| S02 deep RAISE-vs-CHECK playerCount=3 | 3 | 32.2000 | 0.0000 | 0.9500 |
| S02 deep RAISE-vs-CHECK playerCount=4 | 4 | 36.8000 | 0.0417 | 0.9500 |

Both rows preserve `sourceType=verified-forced-replay`, `sourceStep=step37`, forced replay metadata, and governance metadata.

## Validation

| Gate | Result |
| ----------------- | ------ |
| schema validation | PASS, valid=1071 invalid=0 |
| trainingAllowed | true |
| dry-run eligible | true |
| D01 excluded | true |
| deterministicReplay | true |

## Final Dataset Diff

| Metric | Before | After | Delta |
| ------ | -----: | ----: | ----: |
| rows | 1069 | 1071 | +2 |
| D02 rows | 157 | 157 | 0 |
| S01 rows | 254 | 254 | 0 |
| S02 rows | 658 | 660 | +2 |
| D01 rows | 0 | 0 | 0 |
| verified-forced-replay sourceType | 0 | 2 | +2 |

## Quality Gate

| Item | Result |
| ---- | ------ |
| okForSupervisedTraining | true |
| okForIronCandidate | false |
| eligibleForOfflineArena | false |
| eligibleForPromotion | false |
| blocker | single-variant-share-too-high |
| warning | single-variant-dominance |

The `okForIronCandidate=false` result is acceptable for Step39 because the single-variant share issue already exists in the Step15 base distribution and is not introduced by the two-row export. The dry-run eligibility gate below remains true for the three-variant dry-run path.

## Dry-run Eligibility

| Item | Result |
| ---- | ------ |
| okForThreeVariantDryRun | true |
| okForFourVariantIronCandidate | false |
| validRows | 1071 |
| invalidRows | 0 |
| promoted | false |
| routingChanged | false |

## Smoke Arena

| Item | Result |
| ---- | ------ |
| status | skipped |
| reason | optional phase; avoided extra heavy arena run after validation and gate pass |

## Governance

| Item | Result |
| -------------------------- | ------ |
| baseDatasetOverwritten | false |
| newDatasetCreated | true |
| datasetRowsChanged | true |
| production dataset changed | false |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| gameplay mutation | false |
| sourcePriorityChanged | false |
| modelRegistryMutation | false |

## Reports

| Artifact | Path |
| -------- | ---- |
| Dataset write metadata | `reports/ai-iron/iron-step39-dataset-write.json` |
| Post-export validation | `reports/ai-eval/action-value-validation-iron-step39.json` |
| Final dataset diff | `reports/ai-iron/dataset-diff-final-step39.json` |
| Dataset quality gate | `reports/ai-iron/iron-dataset-quality-iron-step39.json` |
| Dry-run eligibility | `reports/ai-iron/iron-step39-dryrun-eligibility.json` |
| Determinism audit | `reports/ai-eval/replay-determinism-audit-iron-step39.json` |
| Governance freeze | `reports/ai-iron/governance-freeze-verification-step39.json` |

## Tests

| Command | Result |
| ------- | ------ |
| `npm test -- src/ai/iron/__tests__/writeApprovedActionValueDataset.test.js` | passed |
| `npm test -- src/ai/iron/__tests__/finalizeActionValueDatasetDiff.test.js` | passed |
| `npm run test:ai:iron` | passed, 126 files, 155 tests, 3 skipped |
| `npm run test:ai:pro` | passed, 2 files, 295 tests |
| `npm run test:rl:safety` | passed, 8 files, 52 tests |

## Next Step

Step40 should run a post-export Iron dry-run or smoke arena using `data/ai/action-value/iron-step39-action-value.jsonl`, keeping routing and promotion frozen. The goal is to verify that the new verified-forced-replay rows improve hit behavior without causing illegal actions, freeze events, or negative Iron-Pro regression.
