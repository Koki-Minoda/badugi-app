# MGX Iron Bootstrap Step41 Report

Step41 expanded practical exposure for the Step39 `verified-forced-replay` rows without promotion, production routing changes, gameplay mutation, source priority changes, hidden-state injection, or synthetic state injection.

## Exact Opportunity Acquisition

Replay scan: `281300` decisions

| PlayerCount | Exact Opportunities | Legal | Replay Samples |
| ----------- | ------------------: | ----: | -------------: |
| 3 | 344 | 344 | 344 |
| 4 | 336 | 336 | 336 |

| Metric | Result |
| ------ | -----: |
| candidateReplayCount | 38286 |
| exactOpportunityCount | 680 |
| exactLegalCount | 680 |
| exactOpportunityRate | 0.002417 |
| scanTargetMet | true |

## Targeted Sampler

| PlayerCount | Available | Selected | Mechanism |
| ----------- | --------: | -------: | --------- |
| 3 | 344 | 50 | corpus filtering + deterministic replay ordering |
| 4 | 336 | 50 | corpus filtering + deterministic replay ordering |

Sampler governance: no hidden-state injection, no synthetic state injection, no gameplay mutation.

## Targeted Arena

Dataset: `data/ai/action-value/iron-step39-action-value.jsonl`

| Metric | Result |
| ------ | ------ |
| datasetHitRate | 0.0062 |
| exactHitRate | 1.0000 |
| fallbackRate | 0.9938 |
| Iron-Pro gap | 0.88 |
| Iron EV | 5.23 |
| Pro EV | 4.35 |
| Standard EV | 8.03 |

## Forced Replay Hits

| Source | Hits | SameAction | Fallback |
| ------ | ---: | ---------: | -------: |
| verified-forced-replay | 101 | 1.0000 | 0 |

| Bucket | Hits |
| ------ | ---: |
| S02 deep RAISE-vs-CHECK playerCount=3 | 66 |
| S02 deep RAISE-vs-CHECK playerCount=4 | 35 |

## Practical Exposure Gain

| Metric | Step40 | Step41 | Delta |
| ------ | -----: | -----: | ----: |
| exactOpportunities | 0 | 101 | 101 |
| exactHits | 0 | 101 | 101 |
| forcedReplayHitRate | 0.000000 | 0.001794 | 0.001794 |
| datasetHitRate | 0.0063 | 0.0062 | -0.0001 |
| Iron-Pro gap | 2.22 | 0.88 | -1.34 |

Minimum success condition met: `exactOpportunityCount > 0`.

Ideal condition partially met: exact hits are now positive and Iron-Pro remains positive, but overall S02 datasetHitRate did not rise versus Step40.

## Safety

| Metric | Result |
| ------ | ------ |
| illegal | 0 |
| freeze | 0 |
| deterministic | true |
| regression status | PASS |
| safety verdict | SAFE |

## Governance

| Item | Result |
| ---- | ------ |
| datasetRowsChanged | false |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| gameplay mutation | false |
| source priority changed | false |
| model registry mutation | false |

## Reports

| Report | Path |
| ------ | ---- |
| exact opportunities | `reports/ai-iron/s02-deep-exact-opportunities-step41.jsonl` |
| opportunity sampler | `reports/ai-iron/s02-opportunity-biased-sampler-step41.json` |
| targeted smoke arena | `reports/ai-iron/iron-step41-targeted-smoke-arena.json` |
| forced replay hit audit | `reports/ai-iron/step41-forced-replay-hit-audit.json` |
| practical exposure gain | `reports/ai-iron/step41-practical-exposure-gain.json` |
| regression safety | `reports/ai-iron/step41-regression-safety.json` |
| governance freeze | `reports/ai-iron/governance-freeze-verification-step41.json` |

## Tests

| Command | Result |
| ------- | ------ |
| `npm test -- src/ai/iron/__tests__/acquireS02DeepExactOpportunities.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/buildOpportunityBiasedReplaySampler.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditStep39ForcedReplayHits.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/evaluatePracticalExposureGain.test.js` | PASS |
| `npm test -- src/ai/iron/__tests__/auditStep41RegressionAndSafety.test.js` | PASS |
| `npm run test:ai:iron` | PASS |
| `npm run test:ai:pro` | PASS |
| `npm run test:rl:safety` | PASS |

## Step42 Recommendation

Proceed to repeatability and hit-rate stabilization for the exact same `S02 deep RAISE-vs-CHECK` rows across additional targeted seed sets. Promotion should remain frozen. The next decision should be based on whether forced-replay hits remain positive and Iron-Pro stays positive across multiple targeted exposure runs, not on a single targeted arena.
