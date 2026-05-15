# MGX Iron Bootstrap Step28 Report

## Summary

Step28 investigated `S02 lowerMediumSDA5 bet-pressure`, the only Step27 `P2_COUNTERFACTUAL_FIRST` bucket.

This step did not export data, add dataset rows, change routing, promote Iron, mutate gameplay, add D01 teacher data, or change source priority. The report uses focused replay-sample forensic evidence. Direct forced-action replay is not used by the Node CLI path because the existing engine import path includes `.jsx`; exportability is therefore intentionally capped at `COUNTERFACTUAL_ONLY`.

## Counterfactual Summary

| Bucket | Sample | MeanDelta | SignFlip | Entropy | Repair | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| S02 lowerMediumSDA5 bet-pressure | `60` | `1.0000` | `0.0000` | `0.0984` | `0.0000` | `COUNTERFACTUAL_ONLY` |

| Item | Result |
| --- | --- |
| EV source | `replay-sample-action-proxy` |
| actualCounterfactualReplay | `false` |
| confidence | `0.9500` |
| invalidReplayCount | `0` |
| legalActionMismatch | `0` |
| fallbackDistribution | `FOLD: 60` |

## Sign Flip Sources

No sign flip was observed inside the focused sample. The Step27 risk is therefore not explained by this isolated bucket's sign direction; the remaining issue is broad context entropy and the lack of forced-action EV replay.

| Axis | Bucket | SignFlip | Entropy | Interpretation |
| --- | --- | ---: | ---: | --- |
| playerCount | 4way+ | `0.0000` | `0.0000` | clean |
| callBand | small | `0.0000` | `0.0000` | clean |
| pressureFamily | bet-pressure | `0.0000` | `0.0000` | clean |
| stackDepth | deep | `0.0000` | `0.0000` | clean |
| drawRound | draw-0 | `0.0000` | `0.0000` | clean |
| pressureChain | fold\|raises=0 | `0.0000` | `0.0000` | clean, sample `27` |
| pressureChain | call\|raises=0 | `0.0000` | `0.0000` | clean, sample `26` |
| position | button | `0.0000` | `0.0000` | clean, sample `14` |

## Entropy Sources

| Source | Entropy | Severity |
| --- | ---: | --- |
| actionDistributionEntropy | `0.0000` | LOW |
| fallbackEntropy | `0.0000` | LOW |
| pressureEntropy | `0.8851` | HIGH |
| callBandEntropy | `0.0000` | LOW |
| positionEntropy | `0.9836` | HIGH |

Entropy classification: `UNEXPORTABLE`.

Interpretation: the action pair is stable (`Standard CALL / Pro FOLD`), but the bucket still collapses several pressure-chain and position contexts. That is enough to block direct export in Step28.

## Repair Dependency

| Repair Type | Rate | Risk |
| --- | ---: | --- |
| none | `0.0000` | SAFE |
| RAISE_TO_CALL | `0.0000` | none observed |
| stale action dependency | `false` | none observed |

Repair verdict: `SAFE`. Positive-EV observations do not depend on repair.

## Isolated Sub-buckets

| Bucket | Sample | SignFlip | Repair | Verdict |
| --- | ---: | ---: | ---: | --- |
| playerCount=4way+ | `60` | `0.0000` | `0.0000` | COUNTERFACTUAL_ONLY |
| callBand=small | `60` | `0.0000` | `0.0000` | COUNTERFACTUAL_ONLY |
| pressureFamily=bet-pressure | `60` | `0.0000` | `0.0000` | COUNTERFACTUAL_ONLY |
| stackDepth=deep | `60` | `0.0000` | `0.0000` | COUNTERFACTUAL_ONLY |
| drawRound=draw-0 | `60` | `0.0000` | `0.0000` | COUNTERFACTUAL_ONLY |
| toCallRatio=>0.50 | `60` | `0.0000` | `0.0000` | COUNTERFACTUAL_ONLY |

No `EXPORTABLE_CANDIDATE` was approved because Step28 did not produce forced-action EV replay and entropy remains high across pressure/position sources.

## Standard-vs-Pro Decision Audit

| Pair | Position | DrawRound | Sample | MeanDelta | Interpretation |
| --- | --- | --- | ---: | ---: | --- |
| CALL/FOLD | button | draw-0 | `14` | `1.0000` | Standard continuation over Pro overfold |
| CALL/FOLD | cutoff | draw-0 | `14` | `1.0000` | Standard continuation over Pro overfold |
| CALL/FOLD | late | draw-0 | `13` | `1.0000` | Standard continuation over Pro overfold |
| CALL/FOLD | small-blind | draw-0 | `12` | `1.0000` | Standard continuation over Pro overfold |
| CALL/FOLD | early | draw-0 | `7` | `1.0000` | low sample |

Standard's advantage is a broad continuation pattern over Pro folding, not a safely exportable narrow correction yet.

## Exportability Decision

| Decision | Reason |
| --- | --- |
| COUNTERFACTUAL_ONLY | entropy-too-high, no-isolated-exportable-sub-bucket |

## Generated Artifacts

| Artifact | Result |
| --- | --- |
| `reports/ai-iron/s02-lowermedium-counterfactual-step28.json` | generated |
| `reports/ai-iron/s02-signflip-isolation-step28.json` | generated |
| `reports/ai-iron/s02-entropy-audit-step28.json` | generated |
| `reports/ai-iron/s02-repair-dependency-step28.json` | generated |
| `reports/ai-iron/s02-isolated-subbuckets-step28.json` | generated |
| `reports/ai-iron/s02-standard-pro-decision-audit-step28.json` | generated |
| `reports/ai-iron/s02-exportability-decision-step28.json` | generated |

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
| `npm test -- src/ai/iron/__tests__/runFocusedS02Counterfactual.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/isolateS02SignFlipSources.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/auditS02EntropySources.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/auditS02RepairDependency.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/searchS02IsolatedSubBuckets.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/auditS02StandardProDecisionDiff.test.js` | pass |
| `npm test -- src/ai/iron/__tests__/decideS02Exportability.test.js` | pass |
| `npm run test:ai:iron` | pass, 78 files / 98 tests |
| `npm run test:ai:pro` | pass, 2 files / 295 tests |
| `npm run test:rl:safety` | pass, 8 files / 52 tests |

## Next Step

Step29 should add a Vitest-backed forced-action replay runner for `S02 lowerMediumSDA5 bet-pressure` so the `.jsx` engine dependency is handled consistently. Only after forced replay confirms low entropy, low sign flip, low repair dependency, and stable positive EV should dataset expansion be reconsidered.
