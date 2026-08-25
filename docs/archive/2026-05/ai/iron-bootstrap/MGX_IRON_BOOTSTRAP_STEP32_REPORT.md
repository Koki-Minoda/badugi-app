# MGX Iron Bootstrap Step32 Report

## Summary

Step32 expanded deterministic replay discovery bandwidth without dataset export, routing changes, promotion, gameplay mutation, or source-priority changes.

The generated diversity-aware corpus is a replay-mining input only. It improved coverage over the Step31 weak dimensions and reran the entropy-aware candidate queue. No SAFE_NEXT candidate was produced, which is acceptable for this phase.

## Diversity Coverage

| Dimension | Before | After |
| --------- | -----: | ----: |
| stackDepth | 0.0000 | 1.0000 |
| drawRound | 0.5000 | 1.0000 |
| playerCount | 0.6667 | 1.0000 |

Additional rerun coverage:

| Dimension | After |
| --------- | ----: |
| variant | 1.0000 |
| position | 0.8750 |
| pressureFamily | 1.0000 |

## Corpus Expansion

| Shape | Added Samples |
| ----- | ------------: |
| stackDepth targeted shapes | 56 |
| drawRound targeted shapes | 56 |
| playerCount targeted shapes | 56 |
| diversity-aware merged corpus | 56 |

Clean replay constraints:

| Item | Result |
| ---- | ------ |
| deterministicReplay | true |
| invalidReplayCount | 0 |
| illegal | 0 |
| freeze | 0 |
| entropy metadata preserved | true |

## Candidate Queue

| SAFE_NEXT | COUNTERFACTUAL_FIRST | MONITOR_ONLY |
| --------: | -------------------: | -----------: |
| 0 | 0 | 4 |

Additional queue outcome:

| Status | Count |
| ------ | ----: |
| TOO_RARE | 1 |
| DO_NOT_TOUCH | 12 |

Monitor-only entries:

| Candidate | Reason |
| --------- | ------ |
| S02 lowerMediumSDA5 bet-pressure | monitor-only |
| S02 coverage-shadow stackDepth shallow | insufficient-stable-signal |
| S02 coverage-shadow stackDepth medium | insufficient-stable-signal |
| S02 coverage-shadow stackDepth deep | insufficient-stable-signal |

Too-rare entry:

| Candidate | Reason |
| --------- | ------ |
| S02 coverage-shadow stackDepth ultra-deep | insufficient-stable-signal |

## Generated Artifacts

| Artifact | Purpose |
| -------- | ------- |
| `reports/ai-iron/coverage-targeted-replay-corpus-step32.json` | deterministic targeted replay corpus |
| `reports/ai-iron/stackdepth-diversity-step32.json` | stackDepth coverage expansion |
| `reports/ai-iron/drawround-diversity-step32.json` | drawRound coverage expansion |
| `reports/ai-iron/playercount-diversity-step32.json` | playerCount coverage expansion |
| `reports/ai-iron/diversity-aware-corpus-step32.json` | clean merged diversity corpus |
| `reports/ai-iron/replay-diversity-rerun-step32.json` | post-expansion diversity audit |
| `reports/ai-iron/entropy-aware-candidates-rerun-step32.json` | post-expansion entropy-aware mining |
| `reports/ai-iron/candidate-rarity-rerun-step32.json` | post-expansion rarity scoring |
| `reports/ai-iron/future-candidate-queue-rerun-step32.json` | post-expansion candidate queue |

## Governance

| Item | Result |
| ---- | ------ |
| dataset rows changed | false |
| promoted | false |
| routingChanged | false |
| D01 excluded | true |
| priorityFrozen | true |
| gameplayMutation | false |
| sourcePriorityChanged | false |

## Tests

| Command | Result |
| ------- | ------ |
| `npm test -- src/ai/iron/__tests__/generateCoverageTargetedReplayCorpus.test.js` | pass, 1 test |
| `npm test -- src/ai/iron/__tests__/expandStackDepthCoverage.test.js` | pass, 1 test |
| `npm test -- src/ai/iron/__tests__/expandDrawRoundCoverage.test.js` | pass, 1 test |
| `npm test -- src/ai/iron/__tests__/expandPlayerCountCoverage.test.js` | pass, 1 test |
| `npm test -- src/ai/iron/__tests__/buildDiversityAwareCorpus.test.js` | pass, 1 test |
| `npm run test:ai:iron` | pass, 94 files / 116 tests |
| `npm run test:ai:pro` | pass, 2 files / 295 tests |
| `npm run test:rl:safety` | pass, 8 files / 52 tests |

## Conclusion

Step32 confirms the Step31 scarcity hypothesis enough to continue infrastructure-first work: stackDepth, drawRound, and playerCount discovery coverage improved to 1.0000 while deterministic and legality-clean constraints remained intact.

No SAFE_NEXT candidate emerged from the rerun queue. The next step should continue evidence acquisition rather than export: run forced/counterfactual validation only after a future queue item reaches stable non-shadow signal.
