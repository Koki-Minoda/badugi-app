# MGX Physical QA Execution Plan

Date: 2026-05-23

Scope: execution plan for the first physical QA pass against the current Top5 release blockers. Documentation only; no implementation, tests, engine, backend, RL, or deploy script changes.

Use with:
- `docs/testing/MGX_PHYSICAL_QA_EVIDENCE_FRAMEWORK.md`
- `docs/testing/MGX_PHYSICAL_QA_RUNBOOK.md`
- `docs/testing/MGX_PHYSICAL_QA_EVIDENCE_TEMPLATE.md`
- `docs/bugs/PHYSICAL_QA_PENDING.md`
- `docs/bugs/ACTIVE_BLOCKERS.md`

## Top5 Target Blockers

| Order | Blocker | Primary risk | Required device/mode |
| ---: | --- | --- | --- |
| 1 | `BADUGI-BET-DRAW-TRANSITION-001` | BET closes but does not advance cleanly to DRAW. | iPhone Safari, iPhone PWA |
| 2 | `BADUGI-DRAW1-CPU-ACTION-001` | CPU DRAW1 action stalls or returns no playable state. | iPhone Safari, iPhone PWA |
| 3 | `BADUGI-HAND-SHAPE-001` / `CROSS-VARIANT-STATE-001` | Prior draw-lowball variants contaminate Badugi hand/controller state. | iPhone Safari first; PWA if time permits |
| 4 | `BADUGI-FOLD-DRAW-FREEZE-001` | Folded/all-in/out seats are re-elected or freeze DRAW progression. | iPhone Safari, iPhone PWA |
| 5 | `UI-MOBILE-TOURNAMENT-LANDSCAPE-001` | Landscape controls clip under real visual viewport/safe area. | iPhone Safari landscape, iPhone PWA landscape |

## Execution Order

Run physical QA in this order to maximize evidence reuse:

1. Safari cross-variant setup run:
   - D01/D02/S01/S02 cash path.
   - Switch to Badugi tournament.
   - Capture `BADUGI-HAND-SHAPE-001` and `CROSS-VARIANT-STATE-001`.
   - Continue the same Badugi tournament into BET -> DRAW -> BET.
   - Capture `BADUGI-BET-DRAW-TRANSITION-001` and `BADUGI-DRAW1-CPU-ACTION-001` if reached cleanly.
2. Safari fold/DRAW run:
   - Start Badugi tournament.
   - Create Hero fold or folded-seat path before/inside DRAW.
   - Capture `BADUGI-FOLD-DRAW-FREEZE-001`.
3. Safari landscape controls run:
   - Start Badugi tournament.
   - Reach Hero decision point.
   - Rotate to landscape.
   - Capture `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`.
4. PWA Badugi tournament run:
   - Repeat BET -> DRAW -> BET and DRAW1 CPU action in standalone mode.
   - Confirm safe-area and bottom controls in portrait.
5. PWA landscape controls run:
   - Repeat landscape action visibility/tap proof in standalone mode.

## Run 1: Safari Cross-Variant Into Badugi Tournament

Primary blockers:
- `BADUGI-HAND-SHAPE-001`
- `CROSS-VARIANT-STATE-001`

Close candidates in same run:
- `BADUGI-BET-DRAW-TRANSITION-001`
- `BADUGI-DRAW1-CPU-ACTION-001`
- `BADUGI-DRAW-BET-MIX-001`
- `PHYSICAL-MOBILE-BADUGI-WAITING-001`

Safari steps:

1. Open iPhone Safari.
2. Navigate to `https://mgx-poker.com/?mgxQa=mobile`.
3. Record release id / commit / deployed asset hash.
4. Play or open D01 cash and capture variant, phase, actor, and hand shape.
5. Repeat for D02/S01/S02 as practical.
6. Switch to Badugi tournament without clearing app state.
7. Capture Badugi tournament hand start.
8. Verify every Badugi hand is four-card only.
9. Continue to first BET.
10. Capture final BET action before DRAW transition.
11. Capture first DRAW state.
12. Capture DRAW1 CPU action if CPU acts.
13. Capture next BET state.
14. Continue to SHOWDOWN/result or next stable hand if practical.
15. Export QA/replay JSON and save screenshots.

Screenshot timing:

| Timing | Required screenshot |
| --- | --- |
| Prior variant start | variant id, mode, hand/card shape, phase |
| Prior variant action | actor, legal actions, pot |
| Badugi tournament start | four-card hand, phase, actor, pot |
| BET active | BET label, no DRAW RUSHER, legal controls |
| BET closing action | last action before transition |
| DRAW active | DRAW label, DRAW RUSHER/red accent, actor |
| DRAW1 CPU action | CPU actor before and after action |
| Next BET | BET label restored, no DRAW RUSHER |
| SHOWDOWN/result | no stale actor controls |

Pass/fail:

- PASS if Badugi starts and remains four-card, no prior variant state leaks, BET advances to DRAW, DRAW1 CPU action advances, and next BET or result is reachable.
- FAIL if Badugi shows five-card contamination, stale prior variant phase/board/control state, closed BET stall, DRAW1 CPU stall, mixed DRAW/BET controls, or stale actor controls.

Export/log save path:

```text
reports/physical/<YYYYMMDD>/CROSS-VARIANT-STATE-001/iphone-safari-cross-variant-badugi-pass.json
reports/physical/<YYYYMMDD>/BADUGI-BET-DRAW-TRANSITION-001/iphone-safari-bet-draw-pass.json
reports/physical/<YYYYMMDD>/BADUGI-DRAW1-CPU-ACTION-001/iphone-safari-draw1-cpu-pass.json
```

## Run 2: Safari Folded/All-In Actor Skip

Primary blocker:
- `BADUGI-FOLD-DRAW-FREEZE-001`

Same-run close candidates:
- folded-seat portion of `PHYSICAL-MOBILE-BADUGI-WAITING-001`
- actor legality monitor rows if evidence includes phase/actor/legal actions

Safari steps:

1. Open iPhone Safari on production.
2. Start Badugi tournament.
3. Reach a hand where Hero can fold before DRAW or during a DRAW-adjacent decision.
4. Capture pre-fold state: phase, actor, legal actions.
5. Fold Hero or capture CPU fold path.
6. Capture folded player status.
7. Continue through the next DRAW or BET boundary.
8. Capture every acting seat after the fold.
9. Export QA/replay JSON.

Screenshot timing:

| Timing | Required screenshot |
| --- | --- |
| Before fold | Hero/actor, legal controls, phase |
| Fold action | action applied once |
| After fold | Hero folded, no Hero controls if not actor |
| DRAW boundary | folded seat not re-elected |
| Next BET/result | no stale folded-player controls |

Pass/fail:

- PASS if folded/all-in/busted/out seats are not elected and the hand advances.
- FAIL if folded Hero receives controls, folded CPU acts illegally, DRAW revives a folded player, or no valid next actor appears.

Export/log save path:

```text
reports/physical/<YYYYMMDD>/BADUGI-FOLD-DRAW-FREEZE-001/iphone-safari-fold-draw-pass.json
```

## Run 3: Safari Landscape Controls

Primary blocker:
- `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`

Same-run close candidates:
- `UI-MOBILE-LANDSCAPE-CONTROLS-001`
- `CORE5-UI-CONTROLS-001` if Core5 coverage is explicitly included

Safari steps:

1. Open iPhone Safari on production.
2. Start Badugi tournament.
3. Reach a Hero decision point.
4. Capture portrait controls first.
5. Rotate to landscape.
6. Let Safari toolbar settle, then capture visible controls.
7. Collapse/expand browser chrome if possible and recapture.
8. Tap one legal action.
9. Confirm action applies exactly once.
10. Export QA/debug data.

Screenshot timing:

| Timing | Required screenshot |
| --- | --- |
| Portrait Hero action | Fold/Call-or-Check/Raise-or-Bet visible |
| Landscape before tap | all primary controls inside visual viewport |
| Landscape after toolbar change | no clipping, no horizontal scroll |
| After legal tap | action applied, state advanced |

Pass/fail:

- PASS if primary controls are visible, tappable, not clipped by toolbar, and no horizontal scroll is required.
- FAIL if any primary action is clipped, covered, outside visual viewport, untappable, or requires horizontal scroll.

Export/log save path:

```text
reports/physical/<YYYYMMDD>/UI-MOBILE-TOURNAMENT-LANDSCAPE-001/iphone-safari-landscape-controls-pass.json
```

## Run 4: PWA Badugi Tournament Phase Path

Primary blockers:
- `BADUGI-BET-DRAW-TRANSITION-001`
- `BADUGI-DRAW1-CPU-ACTION-001`

Same-run close candidates:
- PWA portion of `PHYSICAL-MOBILE-BADUGI-WAITING-001`
- PWA safe-area evidence for mobile control rows

PWA steps:

1. Launch MGX from iOS home screen.
2. Confirm standalone PWA mode.
3. Record release id / asset hash if available.
4. Start Badugi tournament.
5. Capture hand start.
6. Continue BET -> DRAW -> BET.
7. Capture DRAW1 CPU action.
8. Continue to SHOWDOWN/result or next stable state.
9. Background/resume once if safe to do so after a stable state.
10. Export QA/replay JSON.

Screenshot timing:

| Timing | Required screenshot |
| --- | --- |
| PWA launch | standalone mode, no Safari URL bar |
| BET active | phase/actor/controls |
| DRAW active | DRAW RUSHER/red accent |
| DRAW1 CPU | before/after CPU action |
| Next BET | BET restored, no DRAW RUSHER |
| Result/next hand | no stale controls |

Pass/fail:

- PASS if phase/actor/control behavior matches Safari and bottom controls clear PWA safe area.
- FAIL if PWA shows stale assets, stale phase, stale actor, hidden controls, or DRAW1 stall.

Export/log save path:

```text
reports/physical/<YYYYMMDD>/BADUGI-BET-DRAW-TRANSITION-001/iphone-pwa-bet-draw-pass.json
reports/physical/<YYYYMMDD>/BADUGI-DRAW1-CPU-ACTION-001/iphone-pwa-draw1-cpu-pass.json
```

## Run 5: PWA Landscape Controls

Primary blocker:
- `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`

Same-run close candidates:
- PWA safe-area proof for mobile controls
- visual viewport proof for `UI-MOBILE-LANDSCAPE-CONTROLS-001`

PWA steps:

1. Launch standalone PWA.
2. Start Badugi tournament.
3. Reach Hero decision point.
4. Capture portrait safe-area controls.
5. Rotate to landscape.
6. Capture landscape visual viewport and controls.
7. Tap one legal action.
8. Confirm action applies exactly once.
9. Export QA/debug data.

Pass/fail:

- PASS if controls clear the home indicator, remain inside visual viewport, and are tappable in portrait and landscape.
- FAIL if home indicator covers controls, landscape clips controls, or action cannot be tapped.

Export/log save path:

```text
reports/physical/<YYYYMMDD>/UI-MOBILE-TOURNAMENT-LANDSCAPE-001/iphone-pwa-landscape-controls-pass.json
```

## One-Run Close Candidate Mapping

| Run | Can close candidate blockers when evidence is complete |
| --- | --- |
| Safari cross-variant into Badugi | `BADUGI-HAND-SHAPE-001`, `CROSS-VARIANT-STATE-001`, possibly `BADUGI-BET-DRAW-TRANSITION-001`, `BADUGI-DRAW1-CPU-ACTION-001`, `BADUGI-DRAW-BET-MIX-001` |
| Safari fold/DRAW | `BADUGI-FOLD-DRAW-FREEZE-001` |
| Safari landscape controls | Safari side of `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`, possibly `UI-MOBILE-LANDSCAPE-CONTROLS-001` |
| PWA Badugi tournament | PWA side of `BADUGI-BET-DRAW-TRANSITION-001`, `BADUGI-DRAW1-CPU-ACTION-001`, `PHYSICAL-MOBILE-BADUGI-WAITING-001` |
| PWA landscape controls | PWA side of `UI-MOBILE-TOURNAMENT-LANDSCAPE-001` and safe-area control evidence |

## Failure Save Requirements

If any run fails, save this before retrying:

- blocker ID
- device model, OS, browser/mode, orientation
- URL and release id / commit / asset hash
- exact step where failure appeared
- screenshot or video frame
- export JSON path
- handId/sessionId if available
- raw phase and display phase
- actor seat and Hero seat
- legal actions
- visible controls and enabled/disabled state
- player statuses: folded, all-in, busted, seat-out, mucked
- pot, to-call, and visible stack values
- console errors
- failed network requests
- whether one more tap changes the state

Failure path convention:

```text
reports/physical/<YYYYMMDD>/<blocker-id>/<device-browser-mode>-<scenario>-fail.json
reports/physical/<YYYYMMDD>/<blocker-id>/<device-browser-mode>-<scenario>-fail.png
```

## First Run Recommendation

Start with Run 1: Safari cross-variant into Badugi tournament.

Reason:
- It targets two blockers directly: `BADUGI-HAND-SHAPE-001` and `CROSS-VARIANT-STATE-001`.
- If the Badugi tournament continues naturally, the same run can also collect evidence for `BADUGI-BET-DRAW-TRANSITION-001`, `BADUGI-DRAW1-CPU-ACTION-001`, and `BADUGI-DRAW-BET-MIX-001`.
- It exercises the highest-risk release path: prior draw-lowball state followed by Badugi tournament phase progression on physical iPhone Safari.

