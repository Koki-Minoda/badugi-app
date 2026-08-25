# MGX Iron Bootstrap Step42 Report

## Summary

Step42 validated repeatability for `S02 deep RAISE-vs-CHECK` using the Step39 dataset without promotion, routing changes, dataset overwrite, gameplay mutation, source-priority changes, model registry mutation, hidden-state injection, or D01 inclusion.

Result: `REPEATABLE`.

## Repeatability Arena

| Run | Exact Opportunities | Exact Hits | HitRate | Iron-Pro Gap |
| --- | ------------------: | ---------: | ------: | -----------: |
| A | 132 | 132 | 1.0000 | 0.87 |
| B | 116 | 116 | 1.0000 | 0.83 |

## Cross-run Summary

| Metric | Mean | Stddev | Min | Max |
| ------ | ---: | -----: | --: | --: |
| exactOpportunities | 124.0000 | 11.313708 | 116 | 132 |
| exactHits | 124.0000 | 11.313708 | 116 | 132 |
| exactHitRate | 1.0000 | 0.000000 | 1.0000 | 1.0000 |
| datasetHitRate | 0.00625 | 0.000354 | 0.0060 | 0.0065 |
| fallbackRate | 0.99375 | 0.000354 | 0.9935 | 0.9940 |
| Iron-Pro gap | 0.8500 | 0.028284 | 0.83 | 0.87 |

## Persistence

| PlayerCount | Hits |
| ----------- | ---: |
| 3 | 180 |
| 4 | 68 |

Both player-count branches kept `exactHits > 0` across both repeatability runs.

## Variance

| Metric | Mean | Stddev |
| ------ | ---: | -----: |
| Iron-Pro gap | 0.8500 | 0.028284 |
| datasetHitRate | 0.00625 | 0.000354 |
| exactHitRate | 1.0000 | 0.000000 |

Variance status: `PASS`.

## Stability

| Classification | Result |
| -------------- | ------ |
| Stability | REPEATABLE |
| Deterministic | true |
| Safety | SAFE |
| Regression audit | PASS |

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
| illegal | 0 |
| freeze | 0 |
| worst Iron-Pro gap | 0.83 |
| verdict | SAFE |

## Governance

| Item | Result |
| ---- | ------ |
| dataset rows changed | false |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| gameplay mutation | false |
| source priority changed | false |
| model registry mutation | false |
| dataset overwrite | false |
| hidden-state injection | false |

## Outputs

| Artifact | Path |
| -------- | ---- |
| Repeatability arena A | `reports/ai-iron/iron-step42-repeatability-arena-a.json` |
| Repeatability arena B | `reports/ai-iron/iron-step42-repeatability-arena-b.json` |
| Repeatability summary | `reports/ai-iron/step42-repeatability-summary.json` |
| Hit persistence | `reports/ai-iron/step42-hit-persistence.json` |
| Seed variance | `reports/ai-iron/step42-seed-variance.json` |
| Stability classification | `reports/ai-iron/step42-stability-classification.json` |
| Determinism refresh | `reports/ai-eval/replay-determinism-audit-iron-step42.json` |
| Regression safety | `reports/ai-iron/step42-regression-safety.json` |
| Governance freeze | `reports/ai-iron/governance-freeze-verification-step42.json` |

## Tests

| Command | Result |
| ------- | ------ |
| `npm test -- src/ai/iron/__tests__/aggregateStep42Repeatability.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditForcedReplayHitPersistence.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditStep42SeedVariance.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/classifyStep42Stability.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditStep42RegressionSafety.test.js` | PASS |
| `npm run test:ai:iron` | PASS |
| `npm run test:ai:pro` | PASS |
| `npm run test:rl:safety` | PASS |

## Step42 Decision

Minimum success condition met: `exactHits > 0` across all repeatability runs.

Ideal condition met: exact hit rate stayed at `1.0000`, Iron-Pro gap stayed positive, variance was low, deterministic replay remained intact, and stability classified as `REPEATABLE`.

Recommended next step: Step43 should move to a gated promotion-readiness review or broader mixed-exposure dry-run validation while keeping production routing and promotion frozen.
