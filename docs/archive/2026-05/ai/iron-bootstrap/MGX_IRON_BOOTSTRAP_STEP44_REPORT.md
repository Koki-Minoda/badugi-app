# MGX Iron Bootstrap Step44 Report

## Summary

Step44 diagnosed why `S02 deep RAISE-vs-CHECK` is repeatable under targeted exposure but disappears in mixed no-targeted arena. This was an audit-only step: no promotion, routing change, dataset overwrite, source-priority change, hidden-state injection, synthetic opportunity injection, gameplay mutation, model registry mutation, or D01 inclusion was performed.

Result: the issue is not safety or matcher failure. The scarcity source is `TABLE_DISTRIBUTION_BIAS`, and mixed robustness is `RECOVERABLE`.

## Opportunity Funnel

| Stage | Remaining |
| ----- | --------: |
| S02 iron decisions | 11363 |
| S02 candidate bucket observations | 58 |
| S02 4way+ observed candidates | 58 |
| S02 deep RAISE-vs-CHECK family observed | 0 |
| playerCount=3 exact opportunities | 0 |
| playerCount=4 exact opportunities | 0 |
| verified-forced-replay exact opportunities | 0 |
| verified-forced-replay exact hits | 0 |

Disappearance stage: `S02 deep RAISE-vs-CHECK family observed`.

## PlayerCount Collapse

| Timing | Count |
| ------ | ----: |
| hand-start 6max mixed default | 8000 |
| decision observed as pc=4way+ | 58 |
| decision observed as playerCount=3 exact | 0 |
| decision observed as playerCount=4 exact | 0 |

Classification: `NO_TARGET_COLLAPSE_TO_EXACT_PLAYERCOUNT`.

## Table Exposure

| TableType | Exact Opportunities |
| --------- | ------------------: |
| 6max-start mixed | 0 |
| 4way+ observed band | 0 |
| targeted 3way/4way exposure | 248 |

Diagnosis: table-size exposure drives target opportunity recovery.

## Targeted vs Mixed Divergence

| Dimension | Targeted | Mixed | Divergence |
| --------- | -------- | ----- | ---------- |
| targetedSampling | true | false | enabled-vs-disabled |
| targetBucket | S02_DEEP_RAISE_CHECK | null | targeted-only |
| exactOpportunities | 101 | 0 | 101 |
| exactHits | 101 | 0 | 101 |
| repeatabilityMeanExactHits | 124 | 0 | 124 |

Divergence source: `targeted-table-size-exposure-absent-in-mixed`.

## Natural Opportunity Recovery

| Scenario | Expected Exact Opportunities | Verdict |
| -------- | ---------------------------: | ------- |
| more hands with observed mixed rate | 0 | UNDERPOWERED_WITH_ZERO_OBSERVED_RATE |
| different table-size weighting | 124 | RECOVERS_WITH_NATURAL_3_4_EXPOSURE |
| different elimination pacing | 0 | NEEDS_REAL_ARENA_MEASUREMENT_NO_SYNTHETIC_INJECTION |

Recovery possible: `true`.

## Scarcity Diagnosis

| Classification | Result |
| -------------- | ------ |
| Scarcity | TABLE_DISTRIBUTION_BIAS |

Reasons:

| Reason |
| ------ |
| targeted-table-size-exposure-absent-in-mixed |

## Robustness

| Classification | Result |
| -------------- | ------ |
| Mixed robustness after diagnosis | RECOVERABLE |

Reasons:

| Reason |
| ------ |
| unsafe-not-observed |
| targeted-repeatability-proven |
| scarcity-is-recoverable |

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
| deterministic | true |

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
| dataset overwrite | false |
| hidden-state injection | false |
| synthetic opportunity injection | false |

## Outputs

| Artifact | Path |
| -------- | ---- |
| Opportunity funnel | `reports/ai-iron/step44-opportunity-funnel.json` |
| PlayerCount collapse | `reports/ai-iron/step44-playercount-collapse.json` |
| Table exposure | `reports/ai-iron/step44-table-exposure.json` |
| Targeted/mixed divergence | `reports/ai-iron/step44-targeted-mixed-divergence.json` |
| Natural recovery | `reports/ai-iron/step44-natural-opportunity-recovery.json` |
| Scarcity classification | `reports/ai-iron/step44-scarcity-classification.json` |
| Mixed robustness review | `reports/ai-iron/step44-mixed-robustness-review.json` |
| Determinism refresh | `reports/ai-eval/replay-determinism-audit-iron-step44.json` |
| Governance freeze | `reports/ai-iron/governance-freeze-verification-step44.json` |
| Safety | `reports/ai-iron/step44-safety.json` |

## Tests

| Command | Result |
| ------- | ------ |
| `npm test -- src/ai/iron/__tests__/auditMixedOpportunityFunnels.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditPlayerCountCollapseTiming.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditTableSizeExposureMechanics.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditTargetedMixedDivergence.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/simulateNaturalOpportunityRecovery.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/classifyMixedExposureScarcity.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/reviewMixedRobustnessAfterDiagnosis.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditStep44Safety.test.js` | PASS |

## Step44 Decision

Minimum success condition met: the Step43 failure is fixed as scarcity, not unsafe behavior.

Ideal condition met: classification is `TABLE_DISTRIBUTION_BIAS`, and mixed robustness after diagnosis is `RECOVERABLE`.

Recommended next step: Step45 should run natural table-size exposure validation without synthetic state injection. The safest path is a mixed arena that naturally varies table size or uses table-size cohorts as an evaluation condition, while keeping promotion and routing frozen.
