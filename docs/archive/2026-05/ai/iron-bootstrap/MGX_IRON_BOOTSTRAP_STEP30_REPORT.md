# MGX Iron Bootstrap Step30 Report

## Closed Candidate

| Candidate | Decision | Reason |
| --- | --- | --- |
| S02 lowerMediumSDA5 bet-pressure | MONITOR_ONLY / DO_NOT_EXPORT | signFlip-too-high; confidence-too-low; entropy-not-isolated |

## Forced Replay Evidence

| Sample | MeanDelta | SignFlip | Confidence |
| ---: | ---: | ---: | ---: |
| 30 | 24.0000 | 0.4333 | 0.4250 |

## Ranking Update

| Candidate | Previous Priority | Step30 Priority | Reason |
| --- | --- | --- | --- |
| S02 lowerMediumSDA5 bet-pressure | P2_COUNTERFACTUAL_FIRST | P3_MONITOR_ONLY | forced replay positive mean but unstable distribution |

## Next Candidate

| Candidate | Priority | Reason |
| --- | --- | --- |
| NONE_FOUND | NONE_FOUND | Remaining Step27 candidates are closed, weak/trash, high signFlip, high/noisy, or otherwise excluded by Step30 safe-search rules. |

## Governance

| Item | Result |
| --- | --- |
| dataset rows changed | false |
| promoted | false |
| routingChanged | false |
| D01 excluded | true |
| priorityFrozen | true |
| gameplayMutation | false |
| sourcePriorityChanged | false |

## Artifacts

| Artifact | Path |
| --- | --- |
| Closure decision | `reports/ai-iron/s02-lowermedium-closure-step30.json` |
| Ranking update | `reports/ai-iron/coverage-expansion-ranking-step30.json` |
| Next safe candidate | `reports/ai-iron/next-safe-coverage-candidate-step30.json` |
| Monitor-only list | `docs/ai/MGX_IRON_MONITOR_ONLY_BUCKETS.md` |
| Coverage search status | `docs/ai/MGX_IRON_COVERAGE_SEARCH_STATUS.md` |

## Test Status

| Command | Result |
| --- | --- |
| `npm test -- src/ai/iron/__tests__/closeCoverageCandidate.test.js` | passed, 1 file / 1 test |
| `npm test -- src/ai/iron/__tests__/searchNextSafeCoverageCandidate.test.js` | passed, 1 file / 2 tests |
| `npm run test:ai:iron` | passed, 83 files / 105 tests |
| `npm run test:ai:pro` | passed, 2 files / 295 tests |
| `npm run test:rl:safety` | passed, 8 files / 52 tests |
