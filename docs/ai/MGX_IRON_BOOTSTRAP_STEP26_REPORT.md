# MGX Iron Bootstrap Step26 Report

## Summary

Step26 accumulated Iron monitor history to 5 completed runs and rebuilt rolling governance telemetry.

The Step26 monitor runs used `hands=3000` because `hands=5000` was too heavy in this environment. No coverage expansion, dataset row addition, routing change, promotion, gameplay mutation, D01 teacher dataset addition, or source priority change was performed.

## Required Results

| Item | Result |
| --- | --- |
| History entries | `5` |
| Completed runs | `5` |
| Rolling datasetHitRate | `0.0030` |
| Rolling Iron-Pro gap | `1.0653` |
| Telemetry stability | `STABLE` |
| Governance status | `PASS` |
| Escalation action | `NO_ACTION` |
| Threshold changes | recommendation-only: datasetHitRateDropMax `0.74`, Iron-Pro lower bound `-0.05`, sparse review after `5` runs, Iron-Pro fail after `3` runs |
| promoted | `false` |
| routingChanged | `false` |

## Run History

| RunId | Raw | Hardened | HitRate | Iron-Pro D02 | Iron-Pro S01 | Iron-Pro S02 |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `iron-step25` | `WARN` | `PASS` | `0.0000` | `0.00` | `0.00` | `0.00` |
| `iron-step26-run1` | `PASS` | `PASS` | `0.0040` | `1.79` | `1.23` | `1.25` |
| `iron-step26-run2` | `PASS` | `PASS` | `0.0037` | `1.60` | `0.91` | `1.16` |
| `iron-step26-run3` | `PASS` | `PASS` | `0.0039` | `1.51` | `1.06` | `1.79` |
| `iron-step26-run4` | `PASS` | `PASS` | `0.0034` | `1.03` | `1.00` | `1.65` |

## Generated Artifacts

| Artifact | Result |
| --- | --- |
| `reports/ai-iron/iron-step26-history-completeness.json` | `PASS`, completedRuns `5` |
| `reports/ai-iron/iron-step26-rolling-governance-baseline.json` | rollingDatasetHitRate `0.0030`, rollingIronProGap `1.0653` |
| `reports/ai-iron/iron-step26-telemetry-stability.json` | `STABLE` |
| `reports/ai-iron/iron-step26-threshold-calibration.json` | recommendation-only calibration |
| `reports/ai-iron/iron-step26-governance-drift.json` | `PASS` |
| `reports/ai-iron/iron-step26-governance-escalation.json` | `NO_ACTION` |

## Stability

The 5-run window moved from Step25 `SPARSE` to Step26 `STABLE`.

| Metric | Mean | Stddev | Status |
| --- | ---: | ---: | --- |
| datasetHitRate | `0.0030` | `0.001514` | stable |
| Iron-Pro gap | `1.065333` | `0.541227` | stable |
| exactOpportunityRate | `0.0000` | `0.000000` | stable |
| sameActionRate | `1.0000` | `0.000000` | stable |
| fallbackRate | `0.9970` | `0.001514` | stable |

## Threshold Calibration

| Item | Recommendation |
| --- | --- |
| datasetHitRateDropMaxRecommended | `0.74` |
| ironProGapLowerBoundRecommended | `-0.05` |
| consecutiveSparseWarnForReview | `5` |
| ironProGapFailRuns | `3` |
| Policy mutation | none |

## Safety

| Item | Result |
| --- | --- |
| deterministicReplay | `true` for all completed runs |
| invalidReplayCount | `0` for all completed Step26 runs |
| promoted | `false` |
| routingChanged | `false` |
| dataset row addition | none |
| routing change | none |
| promotion | none |
| gameplay mutation | none |
| D01 teacher dataset addition | none |
| source priority change | none |

## Tests

| Command | Result |
| --- | --- |
| `npm test -- src/ai/iron/__tests__/checkMonitorHistoryCompleteness.test.js` | pass, 2 tests |
| `npm test -- src/ai/iron/__tests__/classifyTelemetryStability.test.js` | pass, 4 tests |
| `npm test -- src/ai/iron/__tests__/calibrateGovernanceThresholds.test.js` | pass, 2 tests |
| `npm run test:ai:iron` | pass, 65 files / 84 tests |
| `npm run test:ai:pro` | pass, 2 files / 295 tests |
| `npm run test:rl:safety` | pass, 8 files / 52 tests |

## Next Step

Coverage audit can proceed after review. Step26 did not start coverage expansion.
