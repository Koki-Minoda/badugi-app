# MGX Iron Bootstrap Step47 Report

## Summary

Step47 converted the repeatable Step46 exact-hit spots into preview-only handoff artifacts for coaching feedback, replay viewer metadata, supervised RL signal review, and tournament-end feedback.

No routing, promotion, production dataset, gameplay, model registry, source priority, hidden-state, synthetic replay, or D01 changes were made.

## Coaching Candidates

| Spot | EV Gain | Lesson |
| ---- | ------: | ------ |
| S02 deep RAISE-vs-CHECK playerCount=3 | 32.2 | missed-value |
| S02 deep RAISE-vs-CHECK playerCount=4 | 36.8 | missed-value |

Output:

```txt
reports/ai-iron/step47-coaching-handoff-package.json
```

## Replay Deep Links

| Spot | Deterministic | ReplayRef |
| ---- | ------------- | --------- |
| S02 deep RAISE-vs-CHECK playerCount=3 | true | step46-runA:20260609:1:5 |
| S02 deep RAISE-vs-CHECK playerCount=4 | true | step46-runA:20261099:6:5 |

Output:

```txt
reports/ai-iron/step47-replay-deeplink-metadata.json
```

## Coaching Feedback Draft

| Spot | JP Draft | EN Draft |
| ---- | -------- | -------- |
| playerCount=3 | この場面では、深いスタックの3人局面でSDA5が強く、チェックで回すよりレイズして価値を取りに行く方が期待値を改善できる可能性があります。 | In this deep-stack 3-player SDA5 spot, raising may capture more value than checking back. |
| playerCount=4 | この場面では、深いスタックの4人局面でSDA5が強く、チェックで回すよりレイズして価値を取りに行く方が期待値を改善できる可能性があります。 | In this deep-stack 4-player SDA5 spot, raising may capture more value than checking back. |

Tone is `coach-light`. The drafts avoid solver, GTO, and absolute-certainty claims.

Output:

```txt
reports/ai-iron/step47-coaching-feedback-draft.json
```

## Supervised Signal

| Category | Count |
| -------- | ----: |
| READY_FOR_SUPERVISED_TRAINING | 2 |
| READY_FOR_COACHING_ONLY | 0 |
| MONITOR_ONLY | 0 |

Both candidates met the preview gate:

| Candidate | ExactHitRate | Confidence | SignFlip | InvalidReplay |
| --------- | -----------: | ---------: | -------: | ------------: |
| S02_DEEP_RAISECHECK_PC3 | 1.0 | 0.95 | 0.0000 | 0 |
| S02_DEEP_RAISECHECK_PC4 | 1.0 | 0.95 | 0.0417 | 0 |

Output:

```txt
reports/ai-iron/step47-supervised-signal-handoff.json
```

## Tournament-End Feedback

| Item | Result |
| ---- | ------ |
| Payload type | tournament-end-feedback-preview |
| Worst leak candidate | S02 deep RAISE-vs-CHECK playerCount=4 |
| Estimated EV loss | 36.8 |
| Recommended action | RAISE |
| Baseline action | CHECK |

Output:

```txt
reports/ai-iron/step47-tournament-feedback-payload.json
```

## Determinism

| Metric | Result |
| ------ | ------ |
| deterministic | true |
| mismatchCount | 0 |
| invalidReplayCount | 0 |
| replaySamples | 912 |

Output:

```txt
reports/ai-eval/replay-determinism-audit-step47.json
```

## Rollback-Free Verification

| Item | Result |
| ---- | ------ |
| status | PASS |
| rollbackRequired | false |
| dataset mutation | false |
| routing changed | false |
| gameplay changed | false |
| source priority changed | false |

Output:

```txt
reports/ai-iron/step47-rollbackfree-verification.json
```

## Governance

| Item | Result |
| ---- | ------ |
| promoted | false |
| routingChanged | false |
| priorityFrozen | true |
| D01 excluded | true |
| production dataset overwrite | false |
| gameplay mutation | false |
| hidden-state injection | false |
| synthetic replay injection | false |
| source priority changed | false |
| modelRegistry mutation | false |
| rollbackRequired | false |

Output:

```txt
reports/ai-iron/governance-freeze-verification-step47.json
```

## Tests

| Command | Result |
| ------- | ------ |
| npm test -- src/ai/iron/__tests__/buildCoachingHandoffPackage.test.js src/ai/iron/__tests__/buildReplayDeepLinkMetadata.test.js src/ai/iron/__tests__/generateCoachingFeedbackDraft.test.js src/ai/iron/__tests__/buildSupervisedSignalHandoff.test.js src/ai/iron/__tests__/buildTournamentFeedbackPayload.test.js src/ai/iron/__tests__/verifyCoachingRollbackFree.test.js | PASS |
| npm run eval:ai:replay-determinism -- --corpus-tag=iron-step39 --max-samples=2500 | PASS |
| npm run test:ai:iron | PASS, 170 files, 214 passed, 3 skipped |
| npm run test:ai:pro | PASS, 2 files, 295 passed |
| npm run test:rl:safety | PASS, 8 files, 52 passed |

## Decision

Step47 handoff package is complete and rollback-free. The two S02 deep RAISE-vs-CHECK playerCount split spots are ready to be consumed by coaching preview, replay viewer metadata, tournament-end feedback preview, and supervised RL signal review without changing production routing or promotion state.
