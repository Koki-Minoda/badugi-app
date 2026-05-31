# MGX Iron Bootstrap Step27 Coverage Audit Report

## Summary

Step27 audited why Standard can still outperform Iron/Pro in some areas. The evidence points to coverage scarcity rather than a governance or routing issue: Iron's dataset hit rate remains near `0.0037` mean and Pro fallback remains near `0.9962` mean.

No dataset rows, routing, promotion, source priority, D01 teacher data, or gameplay behavior were changed.

## Standard Advantage

| Variant | Main Advantage | Evidence |
| --- | --- | --- |
| D02 | Standard advantage is mostly broad trash/weak continuation, not a safe expansion target. | D02 aggregate Iron remains above Standard by `2.3225`; top Standard bucket is trashA5 FOLD/CALL verify, freq `1208`, DO_NOT_TOUCH. |
| S01 | Standard gains from CALL/FOLD differences in trash, weak, and lowerMedium pressure buckets. | S01 aggregate Standard-Iron gap `0.6375`; lowerMediumSD27 bet-pressure freq `57`, gap `32.4561`, but signFlipRate `0.4615`. |
| S02 | Standard pressure signal appears in lowerMediumSDA5, but total Iron remains slightly above Standard. | S02 aggregate Iron-Standard gap `0.1325`; lowerMediumSDA5 bet-pressure freq `17`, gap `35.2941`, NEEDS_COUNTERFACTUAL. |

## Coverage Gap

| Variant | HitRate | FallbackRate | Missing Coverage |
| --- | ---: | ---: | --- |
| D02 | `0.0026` | `0.9973` | premiumA5 value spots; trashA5; weakA5 bet/open/raise pressure |
| S01 | `0.0039` | `0.9961` | lowerMediumSD27 bet/open/raise; premiumSD27; upperMediumSD27; weak/trash SD27 |
| S02 | `0.0046` | `0.9953` | lowerMediumSDA5 bet/open/raise; premiumSDA5; weak/trash SDA5 |

## Fallback Hotspots

| Variant | Bucket | Freq | Gap | Classification |
| --- | --- | ---: | ---: | --- |
| D02 | trashA5 FOLD/CALL verify | `1208` | `6.7345` | DO_NOT_TOUCH |
| S01 | trashSD27 FOLD/CALL verify | `1419` | `4.2426` | DO_NOT_TOUCH |
| S02 | trashSDA5 FOLD/CALL verify | `1504` | `4.3424` | DO_NOT_TOUCH |
| S01 | weakSD27 bet-pressure | `186` | `26.4875` | DO_NOT_TOUCH |
| S02 | weakSDA5 bet-pressure | `87` | `47.0082` | DO_NOT_TOUCH |
| S01 | lowerMediumSD27 bet-pressure | `57` | `32.4561` | NEEDS_COUNTERFACTUAL in fallback mining; DO_NOT_TOUCH for expansion due high signFlipRate |
| S02 | lowerMediumSDA5 bet-pressure | `17` | `35.2941` | NEEDS_COUNTERFACTUAL |

## Medium EV Leak Candidates

| Variant | Bucket | SampleCount | MeanDelta | Frequency | Classification |
| --- | --- | ---: | ---: | ---: | --- |
| D02 | trashA5 FOLD/CALL verify | `1208` | `6.7345` | `1208` | DO_NOT_TOUCH |
| S02 | trashSDA5 FOLD/CALL verify | `1504` | `4.3424` | `1504` | DO_NOT_TOUCH |
| S01 | trashSD27 FOLD/CALL verify | `1419` | `4.2426` | `1419` | DO_NOT_TOUCH |
| S01 | weakSD27 bet-pressure | `186` | `26.4875` | `186` | DO_NOT_TOUCH |
| S02 | weakSDA5 bet-pressure | `87` | `47.0082` | `87` | DO_NOT_TOUCH |
| S01 | lowerMediumSD27 bet-pressure | `57` | `32.4561` | `57` | DO_NOT_TOUCH |
| D02 | weakA5 bet-pressure | `26` | `19.2308` | `26` | DO_NOT_TOUCH |

## Expansion Ranking

| Priority | Variant | Bucket Family | Score | Next Action |
| --- | --- | --- | ---: | --- |
| P2_COUNTERFACTUAL_FIRST | S02 | lowerMediumSDA5 bet-pressure | `0.0089` | Run focused counterfactual replay before dataset expansion. |
| DO_NOT_TOUCH | D02 | trashA5 FOLD/CALL verify | `0` | Monitor only. |
| DO_NOT_TOUCH | S01 | trashSD27 FOLD/CALL verify | `0` | Monitor only. |
| DO_NOT_TOUCH | S02 | trashSDA5 FOLD/CALL verify | `0` | Monitor only. |
| DO_NOT_TOUCH | S01 | weakSD27 bet-pressure | `0` | Monitor only. |
| DO_NOT_TOUCH | S02 | weakSDA5 bet-pressure | `0` | Monitor only. |
| DO_NOT_TOUCH | S01 | lowerMediumSD27 bet-pressure | `0` | Do not expand under Step27; signFlipRate is too high. |

## Action Difference

| Variant | Bucket | StandardAction | ProAction | Freq | EV Delta | Interpretation |
| --- | --- | --- | --- | ---: | ---: | --- |
| D02 | trashA5 FOLD/CALL verify | CALL | FOLD | `1095` | `7.4295` | Standard continues where Pro folds. |
| S02 | trashSDA5 FOLD/CALL verify | CALL | FOLD | `1411` | `4.6286` | Standard continues where Pro folds. |
| S01 | trashSD27 FOLD/CALL verify | CALL | FOLD | `1345` | `4.4760` | Standard continues where Pro folds. |
| S01 | weakSD27 bet-pressure | CALL | FOLD | `186` | `26.4875` | Standard continues where Pro folds. |
| S02 | weakSDA5 bet-pressure | CALL | FOLD | `87` | `47.0082` | Standard continues where Pro folds. |
| S01 | lowerMediumSD27 bet-pressure | CALL | FOLD | `57` | `32.4561` | Standard continues where Pro folds. |
| S02 | lowerMediumSDA5 bet-pressure | CALL | FOLD | `17` | `35.2941` | Standard continues where Pro folds. |

## Generated Artifacts

| Artifact | Result |
| --- | --- |
| `reports/ai-iron/standard-advantage-attribution-step27.json` | generated |
| `reports/ai-iron/iron-coverage-gap-step27.json` | generated |
| `reports/ai-iron/iron-fallback-hotspots-step27.json` | generated |
| `reports/ai-iron/medium-ev-leak-candidates-step27.json` | generated |
| `reports/ai-iron/standard-pro-action-diff-step27.json` | generated |
| `reports/ai-iron/coverage-expansion-ranking-step27.json` | generated |

## Governance

| Item | Result |
| --- | --- |
| dataset rows unchanged | true |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| no gameplay mutation | true |
| source priority unchanged | true |

## Tests

| Command | Result |
| --- | --- |
| `npm test -- src/ai/iron/__tests__/analyzeStandardAdvantage.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/analyzeIronCoverageGap.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/mineIronFallbackHotspots.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/mineMediumEVLeaks.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/analyzeStandardProActionDiff.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/rankCoverageExpansionCandidates.test.js` | pass |
| `npm run test:ai:iron` | pass, 71 files / 90 tests |
| `npm run test:ai:pro` | pass, 2 files / 295 tests |
| `npm run test:rl:safety` | pass, 8 files / 52 tests |

## Next Step

Step28 should run focused counterfactual replay for `S02 lowerMediumSDA5 bet-pressure` before any dataset expansion decision. `S01 lowerMediumSD27 bet-pressure` should not be expanded unless a future counterfactual audit resolves the high signFlipRate.
