# MGX Core5 Browser Soak Runtime Classification

Date: 2026-05-18

## Decision

`STEP_B_BLOCKED_BY_D01_TERMINAL_UI_DIVERGENCE`

The D01/D02 100-hand runtime question is no longer classified as a pure runtime-budget problem. Runtime telemetry was added, but the calibrated D01 run exposed a settled P0 before the 100-hand comparison could be trusted: after a fold-to-one collect path, the controller/browser state remained in `BET` with no actor while Hero action controls were still visible. The hand did not reach terminal within the stricter completion gate.

Because a real browser invariant P0 exists, D02 60/100 and normal-vs-light 100-hand comparisons were intentionally not expanded in this pass.

## Harness Changes

| Area | Change | Reason |
|---|---|---|
| Runtime telemetry | Added per-hand/action/transition timing, retry/wait counts, snapshot/assertion counts, click counts, idle-loop tracking, trace/screenshot counters, and runtime classification. | Distinguish real freezes from slow progress and harness overhead. |
| Hand completion gate | A hand that does not reach terminal before `BROWSER_GAMEPLAY_MAX_STEPS` now fails with `HAND_COMPLETION_TIMEOUT`. | Prevent false PASS when a run advances actions but leaves a hand incomplete. |
| Hero action application | A visible Hero click is not accepted as successful unless progress changes or terminal state appears. | Catch stale/no-op action controls. |
| Call/check selection | When `toCall > 0`, the helper no longer treats `CHECK` as a valid fallback. | Avoid masking bad `currentBet` or stale action button states. |
| Draw fallback | Added an E2E-only `forceSeatDraw` path for draw actors. | Separate draw application failures from runtime/progression failures. |
| Freeze detector | Added a D01/D02 cash desktop detector that fails on unchanged hand/action/phase for a bounded threshold. | Classify fixed-state hangs independently from long runtime. |

## Calibrated Results

| Run | Result | Classification | Notes |
|---|---|---|---|
| D01 cash desktop 1-hand light trace | PASS | Smoke only | Runtime telemetry path generated for smoke validation. |
| D01 cash desktop 30-hand normal trace, first telemetry pass | FALSE_PASS_DETECTED | HARNESS_GAP | Test process passed, but telemetry showed only 7/30 hands completed and a repeated no-op Hero check/call state. This led to the stricter hand completion gate. |
| D01 cash desktop 30-hand normal trace, after stricter gate | FAIL | REAL_UI_MERGE_BUG / TERMINAL_DIVERGENCE | Hand `D03-h25-d3-mpa8mipd` remained `BET`, `actor=null`, `currentBet=0`, `pot=90`, Hero had `Collect 90`, all other seats folded, and Hero controls were still visible. |
| D01 cash desktop 60-hand | NOT RUN | BLOCKED | D01 30-hand settled P0 blocks further expansion. |
| D01 cash desktop 100-hand | NOT RUN | BLOCKED | D01 30-hand settled P0 blocks 100-hand runtime classification. |
| D02 cash desktop 30-hand | NOT RERUN IN THIS PASS | BLOCKED_BY_D01_P0 | Prior shorter D02 result is not sufficient under the stricter completion gate. |
| D02 cash desktop 60-hand | NOT RUN | BLOCKED | D01 P0 blocks expansion. |
| D02 cash desktop 100-hand | NOT RUN | BLOCKED | D01 P0 blocks expansion. |

## Evidence

| Evidence | Path |
|---|---|
| D01 runtime telemetry | `reports/browser-gameplay/runtime/d01-cash-desktop-runtime-telemetry.json` |
| D01 trace | `reports/browser-gameplay/browser-gameplay-trace-d01-cash-desktop.jsonl` |
| D01 failure screenshots | `reports/screenshots/browser-gameplay-failure-D01-cash-desktop-D03-h25-d3-mpa8mipd-*.png` |
| Freeze detector smoke output | `reports/browser-gameplay/runtime/draw-cash-freeze-detector.json` |

## Runtime Classification

| Label | Decision |
|---|---|
| `REAL_FREEZE` | Not proven as a long idle-only freeze. |
| `SLOW_PROGRESS` | Not accepted; the run now fails on a settled terminal/UI divergence before runtime-only classification is possible. |
| `EXCESSIVE_RETRY` | Secondary monitor only. The main blocker is not retry count. |
| `TRACE_OVERHEAD` | Not accepted; light/normal 100-hand comparison was stopped because a P0 exists. |
| `PLAYWRIGHT_TIMEOUT_ONLY` | Not accepted. The stricter gate finds a gameplay/UI invariant failure before timeout-only classification. |
| `REAL_UI_MERGE_BUG` | Active P0: terminal/fold-to-one state leaves stale Hero controls visible with no canonical actor. |

## Gate Status

`CORE5_CASH_DESKTOP_STEP_B_FAIL`

Do not run tournament desktop, mobile viewport, or live browser matrix expansion until D01 cash desktop 30-hand and then D01/D02 100-hand cash desktop pass with:

- `HAND_COMPLETION_TIMEOUT = 0`
- `UI_CONTROLLER_DIVERGENCE = 0`
- `ACTION_APPLICATION_FAILED = 0`
- actor P0 = 0
- terminal P0 = 0
- illegal reopen = 0
- real freeze = 0
