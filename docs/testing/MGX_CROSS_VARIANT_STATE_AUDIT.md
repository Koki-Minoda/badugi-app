# MGX Cross-Variant State Audit

Date: 2026-05-18

## Scope

This audit covers Core5 variant/mode boundaries where stale state can leak from one game into another:

- D01/D02/S01 cash to Badugi tournament
- Badugi tournament to D01 cash
- Cash out / return menu
- Tournament start / tournament back to menu
- Controller snapshot merge and browser gameplay trace collection

## Source-of-truth hierarchy

| Layer | Ownership | Rule |
| --- | --- | --- |
| Active variant | `gameVariantRef.current` / `gameVariant` | Must be updated before creating a controller for a new mode/session. |
| Controller | `gameControllerRef.current` + `controllerVariantRef.current` | Must match the active normalized variant. Controller snapshots with a mismatched variant are ignored. |
| Session controller | `sessionControllerRef.current` + `sessionControllerStateRef.current` | Cash/session scoped only. Cleared for tournament mode and variant switches. |
| Engine snapshot | `engineStateRef.current` / `engineState` | Derived cache. Cleared at hard reset boundaries and ignored if variant mismatches. |
| UI snapshot | `controllerUiSnapshotState` | Derived cache. Cleared at hard reset boundaries and ignored if variant mismatches. |
| Legacy turn/phase | `turn`, `phase`, `drawRound`, `betRoundIndex`, `currentBet` | Derived UI state. Reset at variant/mode boundaries and refreshed from compatible controller snapshots only. |
| QA trace | browser gameplay snapshot / cross-variant audit | Detector only. It cannot become a gameplay source of truth. |

## State ownership

| State | Scope | Classification | Reset boundary |
| --- | --- | --- | --- |
| `gameControllerRef` | variant/session | CANONICAL / STALE_RISK | variant switch, mode switch, cash out, tournament start, tournament back to menu |
| `controllerVariantRef` | variant/session | CANONICAL / STALE_RISK | same as controller |
| `sessionControllerRef` | cash session | SESSION_SCOPED / GLOBAL_LEAK_RISK | tournament start, cash out, variant switch |
| `sessionControllerStateRef` | cash hand/session | SESSION_SCOPED / GLOBAL_LEAK_RISK | tournament start, cash out, variant switch |
| `controllerUiSnapshotState` | hand/session cache | DERIVED / STALE_RISK | hard reset, controller mismatch |
| `engineStateRef` | hand/session cache | DERIVED / STALE_RISK | hard reset, controller mismatch |
| `turn`, `phase`, `drawRound`, `betRoundIndex` | UI hand state | DERIVED | hard reset, compatible snapshot merge |
| `currentBet`, `pots`, `betHead`, `lastAggressor` | UI hand state | DERIVED | hard reset, compatible snapshot merge |
| `tournamentStateRef` / HUD | tournament session | SESSION_SCOPED | tournament back to menu, new tournament |
| replay/history refs | hand/session | HAND_SCOPED / SESSION_SCOPED | hard reset, new tournament, cash out |
| QA trace/export | browser QA | DERIVED | generated report only |

## Finding

The live Badugi mobile matrix previously recorded `gameVariant=badugi` while the active controller class was `D1`. That is a P0 cross-variant controller contamination signature because a draw-lowball controller can return no Badugi tournament DRAW snapshot and block BET/DRAW progression.

Root cause classification:

`REAL_UI_MERGE_BUG / CROSS_VARIANT_CONTROLLER_REUSE`

The risky path was:

1. D01/D02/S01 cash used a draw-lowball controller.
2. Cash out / menu and tournament start reset visible table state but did not destroy controller/session refs or derived snapshots.
3. Badugi tournament could start with stale controller/session refs still reachable by action helpers or snapshot collection.
4. Browser/live trace could then show Badugi UI state with a `D1` controller source.

## Fix

Hard reset boundaries now destroy controller/session state and derived snapshots:

- `variant switch before ring start`
- `menu ring start`
- `cash out back to menu`
- `start tournament`
- `tournament back to menu`
- `ensureGameController` variant mismatch fallback

The reset clears:

- `gameControllerRef`
- `controllerVariantRef`
- `controllerStreetRef`
- `sessionControllerRef`
- `sessionControllerStateRef`
- `controllerUiSnapshotState`
- `engineStateRef` / `engineState`
- legacy phase/turn/bet/pot/action-history state

Snapshot merge now also rejects controller/session/engine snapshots whose variant does not match the active variant.

## Regression coverage

| Test | Coverage |
| --- | --- |
| `src/ui/__tests__/crossVariantStateResetRegression.test.jsx` | Detector flags Badugi running with stale D01 controller and accepts fresh Badugi state. |
| `src/games/_core/__tests__/controllerResetBoundaryRegression.test.js` | Core reset boundary detector rejects mismatched controller/snapshot variant reuse. |
| `tests/e2e/cross-variant-session-contamination.spec.ts` | D01/D02/S01 cash to Badugi tournament and Badugi tournament to D01 cash switch without stale controller/session state. |

## Result

Local E2E after the fix:

- D01 cash -> Badugi tournament: PASS
- D02 cash -> Badugi tournament: PASS
- S01 cash -> Badugi tournament: PASS
- Badugi tournament -> D01 cash: PASS

Generated trace:

- `reports/cross-variant/cross-variant-state-trace.jsonl`

The report is generated evidence and is not committed.

## Release status

`CROSS-VARIANT-STATE-001` was reopened as P0 after physical iPhone QA showed Badugi tournament rendering five-card draw-lowball hands after a cash-session variant switch.

The newly fixed local path is stricter than the previous controller-class-only guard:

- `gameVariantRef` and `modeRef` are the source of truth for immediate hand start after variant/mode switch.
- New-hand `prevPlayers` and `currentPlayers` are sanitized against the active variant hand-shape before deal.
- Badugi rejects non-empty five-card hand/card snapshots before UI merge.
- Folded/out/busted players are excluded from DRAW actor selection while all-in non-folded players remain draw eligible.

Local evidence:

- `tests/e2e/physical-cross-variant-badugi-contamination-regression.spec.ts` PASS for `D01 -> Badugi`, `D02 -> Badugi`, `S01 -> Badugi`, `S02 -> Badugi`, and `Badugi -> Badugi`.
- `tests/e2e/badugi-hand-shape-contamination.spec.ts` PASS.
- `tests/e2e/badugi-folded-draw-freeze-regression.spec.ts` PASS.

Status: `FIXED_LOCAL / NEEDS_DEPLOY_AND_PHYSICAL_RECHECK`. Friend Alpha remains HOLD until this build is deployed, live recheck passes, and the physical `?mgxQa=mobile` path is confirmed.
