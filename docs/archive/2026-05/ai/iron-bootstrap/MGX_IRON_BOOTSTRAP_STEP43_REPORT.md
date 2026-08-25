# MGX Iron Bootstrap Step43 Report

## Summary

Step43 tested `S02 deep RAISE-vs-CHECK` in a mixed D02/S01/S02 arena without targeted sampling, promotion, routing changes, production dataset overwrite, gameplay mutation, source-priority changes, model registry mutation, hidden-state injection, or D01 inclusion.

The original 24k-hands mixed arena command hit the Vitest runner timeout before completion. A bounded mixed/no-targeted run was completed with `--hands=24000 --max-hands=8000` to preserve the mixed exposure shape while keeping the run executable.

Result: safety passed, cross-variant regression passed, fallback coexistence passed, but forced-replay mixed exposure did not occur. Promotion readiness is `NOT_READY`.

## Mixed Arena

| Variant | Iron-Pro Gap | DatasetHitRate |
| ------- | -----------: | -------------: |
| D02 | 2.83 | 0.0049 |
| S01 | 1.05 | 0.0038 |
| S02 | 1.84 | 0.0051 |

## Forced Replay Exposure

| PlayerCount | Opportunities | Hits |
| ----------- | ------------: | ---: |
| 3 | 0 | 0 |
| 4 | 0 | 0 |

Mixed exposure maintained: `false`.

## Cross-Variant Regression

| Item | Result |
| ---- | ------ |
| status | PASS |
| all Iron-Pro positive | true |
| worst Iron-Pro gap | 1.05 |
| illegal | 0 |
| freeze | 0 |

## Fallback Coexistence

| Metric | Result |
| ------ | -----: |
| status | PASS |
| fallback stable | true |
| proFallbackRate mean | 0.9954 |
| proFallbackRate stddev | 0.0007 |
| fallback oscillation | 0.0013 |
| datasetHitRate mean | 0.0046 |

## Robustness

| Classification | Result |
| -------------- | ------ |
| Mixed exposure robustness | FRAGILE |

Reasons:

| Reason |
| ------ |
| mixed-arena-zero-exact-hits |
| mixed-arena-zero-exact-opportunities |

## Promotion Readiness

| Item | Result |
| ---- | ------ |
| Repeatable | true |
| Mixed Robust | false |
| Deterministic | true |
| Safety Clean | true |
| Cross-variant Stable | true |
| Fallback Coexistence | true |
| Concentration Risk Acceptable | true |
| Promotion Ready | NOT_READY |

Blocker: `mixedRobust`.

## Concentration Risk

| Metric | Before | After |
| ------ | -----: | ----: |
| rows | 1069 | 1071 |
| S02 rows | 658 | 660 |
| S02 share | 0.615529 | 0.616246 |

Risk level: `LOW`.

## Determinism

| Metric | Result |
| ------ | ------ |
| deterministic | true |
| mismatchCount | 0 |
| invalidReplayCount | 0 |
| replaySamples | 912 |

## Safety

| Metric | Result |
| ------ | ------ |
| status | PASS |
| verdict | SAFE |
| illegal | 0 |
| freeze | 0 |
| worst Iron-Pro gap | 1.05 |

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
| production dataset overwrite | false |
| hidden-state injection | false |

## Outputs

| Artifact | Path |
| -------- | ---- |
| Mixed arena | `reports/ai-iron/iron-step43-mixed-arena.json` |
| Mixed hit audit | `reports/ai-iron/step43-mixed-hit-audit.json` |
| Cross-variant regression | `reports/ai-iron/step43-cross-variant-regression.json` |
| Fallback coexistence | `reports/ai-iron/step43-fallback-coexistence.json` |
| Mixed robustness | `reports/ai-iron/step43-mixed-robustness.json` |
| Promotion readiness | `reports/ai-iron/step43-promotion-readiness.json` |
| Concentration risk | `reports/ai-iron/step43-concentration-risk.json` |
| Determinism refresh | `reports/ai-eval/replay-determinism-audit-iron-step43.json` |
| Safety | `reports/ai-iron/step43-safety.json` |
| Governance freeze | `reports/ai-iron/governance-freeze-verification-step43.json` |

## Tests

| Command | Result |
| ------- | ------ |
| `npm test -- src/ai/iron/__tests__/auditMixedExposureHits.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditCrossVariantRegression.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditFallbackCoexistence.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/classifyMixedExposureRobustness.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/reviewPromotionReadiness.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/refreshDatasetConcentrationRisk.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditStep43Safety.test.js` | PASS |

## Step43 Decision

Minimum success condition was not met because mixed arena exact hits remained `0`.

Safety and cross-variant coexistence are clean, but `S02 deep RAISE-vs-CHECK` is not ready for gated promotion review until no-targeted mixed exposure produces exact opportunities and hits.

Recommended next step: Step44 should diagnose why no-targeted mixed arena does not naturally reach the `playerCount=3/4` deep RAISE-vs-CHECK rows, focusing on realistic player-count distribution and exposure mechanics while keeping routing and promotion frozen.
