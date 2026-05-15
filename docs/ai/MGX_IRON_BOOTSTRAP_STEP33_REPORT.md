# MGX Iron Bootstrap Step33 Report

## Summary

Step33 added a shadow-to-replay validation pipeline without dataset export, routing changes, promotion, gameplay mutation, source-priority changes, or D01 teacher inclusion.

The pipeline converted Step32 MONITOR_ONLY shadow signals into deterministic replay-backed validation targets. Three stackDepth shadow signals are now ready for forced-replay measurement. The previously closed `S02 lowerMediumSDA5 bet-pressure` bucket remains MONITOR_ONLY.

## Shadow Replay Acquisition

| Signal | Replay Samples |
| ------ | -------------: |
| S02 lowerMediumSDA5 bet-pressure | 6 |
| S02 coverage-shadow stackDepth shallow | 5 |
| S02 coverage-shadow stackDepth medium | 6 |
| S02 coverage-shadow stackDepth deep | 5 |

Acquisition totals:

| Item | Result |
| ---- | ------ |
| signalCount | 4 |
| totalReplaySamples | 22 |
| deterministicReplay | true |
| invalidReplayCount | 0 |
| illegal | 0 |
| freeze | 0 |

## Replay-backed Validation

| Category | Count |
| -------- | ----: |
| REPLAY_VALIDATED | 3 |
| COUNTERFACTUAL_ONLY | 0 |
| MONITOR_ONLY | 1 |
| DO_NOT_TOUCH | 0 |

Validated signals:

| Signal | Classification | Reason |
| ------ | -------------- | ------ |
| S02 coverage-shadow stackDepth shallow | REPLAY_VALIDATED | deterministic-clean-replay, stable-shadow-sign |
| S02 coverage-shadow stackDepth medium | REPLAY_VALIDATED | deterministic-clean-replay, stable-shadow-sign |
| S02 coverage-shadow stackDepth deep | REPLAY_VALIDATED | deterministic-clean-replay, stable-shadow-sign |
| S02 lowerMediumSDA5 bet-pressure | MONITOR_ONLY | closed-monitor-only |

## Shadow Replay Divergence

| Metric | Result |
| ------ | -----: |
| maxSignFlipDivergence | 0.0000 |
| maxEntropyDivergence | 0.3500 |
| maxPressureFamilyDivergence | 0.0000 |
| maxPlayerCountDivergence | 1.0000 |
| maxStackDepthDivergence | 0.0000 |

Interpretation:

| Item | Result |
| ---- | ------ |
| stackDepth shadow match | clean |
| pressure-family requested match | clean where requested |
| playerCount mix | still broad across shadow signals |
| lowerMedium status | remains closed monitor-only |

## Replay Reproducibility

| Item | Result |
| ---- | ------ |
| deterministicReplay | true |
| invalidReplayCount | 0 |
| illegal | 0 |
| freeze | 0 |
| mismatchCount | 0 |

## Forced Replay Eligibility

| READY | COUNTERFACTUAL_ONLY | MONITOR_ONLY | REJECT |
| ----: | ------------------: | -----------: | -----: |
| 3 | 0 | 1 | 0 |

Ready signals:

| Signal | Replay Samples | Reason |
| ------ | -------------: | ------ |
| S02 coverage-shadow stackDepth shallow | 5 | clean-replay-backed-signal |
| S02 coverage-shadow stackDepth medium | 6 | clean-replay-backed-signal |
| S02 coverage-shadow stackDepth deep | 5 | clean-replay-backed-signal |

Monitor-only signal:

| Signal | Reason |
| ------ | ------ |
| S02 lowerMediumSDA5 bet-pressure | closed-monitor-only |

## Generated Artifacts

| Artifact | Purpose |
| -------- | ------- |
| `reports/ai-iron/shadow-replay-acquisition-step33.json` | shadow signal to replay acquisition |
| `reports/ai-iron/replay-backed-signal-validation-step33.json` | replay-backed classification |
| `reports/ai-iron/shadow-replay-divergence-step33.json` | shadow vs replay divergence audit |
| `reports/ai-iron/replay-reproducibility-step33.json` | deterministic replay reproducibility audit |
| `reports/ai-iron/forced-replay-eligibility-step33.json` | forced replay eligibility scan |
| `reports/ai-iron/governance-freeze-verification-step33.json` | governance freeze verification |

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
| `npm test -- src/ai/iron/__tests__/acquireReplayFromShadowSignals.test.js` | pass, 1 test |
| `npm test -- src/ai/iron/__tests__/validateReplayBackedSignals.test.js` | pass, 1 test |
| `npm test -- src/ai/iron/__tests__/auditShadowReplayDivergence.test.js` | pass, 1 test |
| `npm test -- src/ai/iron/__tests__/auditReplayReproducibility.test.js` | pass, 1 test |
| `npm test -- src/ai/iron/__tests__/scanForcedReplayEligibility.test.js` | pass, 1 test |
| `npm run test:ai:iron` | pass, 99 files / 121 tests |
| `npm run test:ai:pro` | pass, 2 files / 295 tests |
| `npm run test:rl:safety` | pass, 8 files / 52 tests |

## Conclusion

Step33 successfully bridged three stackDepth shadow signals into replay-backed forced-replay candidates:

| Candidate | Next Status |
| --------- | ----------- |
| S02 coverage-shadow stackDepth shallow | FORCED_REPLAY_READY |
| S02 coverage-shadow stackDepth medium | FORCED_REPLAY_READY |
| S02 coverage-shadow stackDepth deep | FORCED_REPLAY_READY |

The next step should run forced-action EV replay for these three stackDepth candidates before any dataset expansion decision.
