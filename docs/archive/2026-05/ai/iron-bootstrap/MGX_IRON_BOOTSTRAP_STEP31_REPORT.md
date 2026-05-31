# MGX Iron Bootstrap Step31 Report

## Replay Diversity

| Dimension | Entropy | Coverage |
| --- | ---: | ---: |
| variant | 0.7316 | 1.0000 |
| position | 0.9269 | 0.7500 |
| playerCount | 0.6723 | 0.6667 |
| pressureFamily | 0.7955 | 1.0000 |
| stackDepth | 0.0000 | 0.0000 |
| drawRound | 0.8740 | 0.5000 |

## Corpus Diversity Plan

| Target | Priority | Target Samples | Reason |
| --- | --- | ---: | --- |
| stackDepth | HIGH | 40 | no current stack depth coverage |
| drawRound | MEDIUM | 20 | partial draw-round coverage |
| playerCount | MEDIUM | 20 | heads-up coverage missing in current replay audit |
| position | LOW | 20 | broad but incomplete position coverage |
| pressureFamily | LOW | 20 | covered but still eligible for rare-shape balancing |

## Entropy-Aware Candidates

| Classification | Count | Result |
| --- | ---: | --- |
| SAFE_CANDIDATE | 0 | none found |
| COUNTERFACTUAL_ONLY | 0 | none after Step30 closure override |
| MONITOR_ONLY | 8 | insufficient stable signal |
| DO_NOT_TOUCH | 12 | weak/trash, high signFlip, high entropy, or monitor-only closure |

## Rarity Scoring

| Classification | Count | Interpretation |
| --- | ---: | --- |
| VIABLE | 15 | sufficient frequency/matchability only; still blocked by entropy/rejection rules where applicable |
| SHADOW_ONLY | 4 | replay scarcity too high for export mining |
| TOO_RARE | 1 | below minimum opportunity frequency |

## Candidate Queue

| Candidate | Status | Reason |
| --- | --- | --- |
| S02 lowerMediumSDA5 bet-pressure | MONITOR_ONLY | monitor-only |
| SAFE_NEXT | empty | no safe export candidate in current evidence |
| COUNTERFACTUAL_FIRST | empty | no clean candidate survived entropy and early rejection filters |

## Rejected Buckets

| Bucket | RejectReason |
| --- | --- |
| D02 trashA5 FOLD/CALL verify | trash-bucket |
| S02 trashSDA5 FOLD/CALL verify | trash-bucket |
| S01 trashSD27 FOLD/CALL verify | trash-bucket |
| S01 weakSD27 bet-pressure | weak-bucket |
| S02 weakSDA5 bet-pressure | weak-bucket |
| S01 lowerMediumSD27 bet-pressure | do-not-touch |
| D02 weakA5 bet-pressure | weak-bucket |
| S02 lowerMediumSDA5 bet-pressure | monitor-only |

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
| replay diversity | `reports/ai-iron/replay-diversity-step31.json` |
| diverse corpus plan | `reports/ai-iron/diverse-corpus-generation-step31.json` |
| entropy-aware candidates | `reports/ai-iron/entropy-aware-candidates-step31.json` |
| candidate rarity | `reports/ai-iron/candidate-rarity-step31.json` |
| weak/trash rejection | `reports/ai-iron/weak-trash-rejection-step31.json` |
| future candidate queue | `reports/ai-iron/future-candidate-queue-step31.json` |

## Test Status

| Command | Result |
| --- | --- |
| `npm test -- src/ai/iron/__tests__/auditReplayDiversity.test.js` | passed, 1 file / 1 test |
| `npm test -- src/ai/iron/__tests__/generateDiverseCounterfactualCorpus.test.js` | passed, 1 file / 1 test |
| `npm test -- src/ai/iron/__tests__/mineEntropyAwareCandidates.test.js` | passed, 1 file / 1 test |
| `npm test -- src/ai/iron/__tests__/scoreCandidateRarity.test.js` | passed, 1 file / 1 test |
| `npm test -- src/ai/iron/__tests__/rejectWeakTrashBucketsEarly.test.js` | passed, 1 file / 1 test |
| `npm test -- src/ai/iron/__tests__/buildFutureCandidateQueue.test.js` | passed, 1 file / 1 test |
| `npm run test:ai:iron` | passed, 89 files / 111 tests |
| `npm run test:ai:pro` | passed, 2 files / 295 tests |
| `npm run test:rl:safety` | passed, 8 files / 52 tests |
