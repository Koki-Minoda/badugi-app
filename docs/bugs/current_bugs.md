---
title: Current bug tracking index
---

# Current Bug Index

Last updated: 2026-05-26

This file is now a compact index. The mixed ledger has been split into focused tracking files so release status is visible without losing historical evidence.

Primary source before reorganization:
- `docs/bugs/current_bugs.md` as of 2026-05-20
- `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md`
- release/testing/alpha docs and reports referenced by the migrated rows

## Friend Alpha Status

Status: HOLD

Blocking reasons:
- Active P0/P1 rows remain in `ACTIVE_BLOCKERS.md`.
- Physical mobile proof is still missing for required iPhone/PWA/Android rows in `PHYSICAL_QA_PENDING.md`.
- Remote sync is still unresolved.
- CPU decision-source / nit-passive quality rows still need targeted deployed-session evidence.

## New Tracking Files

| File | Purpose |
|---|---|
| `docs/bugs/ACTIVE_BLOCKERS.md` | Actual unresolved P0/P1 release blockers and user-visible failures. |
| `docs/bugs/PHYSICAL_QA_PENDING.md` | Rows that cannot be closed from Playwright emulation alone. |
| `docs/bugs/VERIFIED_MONITORS.md` | Fixed/covered rows intentionally retained in regression gates. |
| `docs/bugs/AUDIT_FINDINGS.md` | Spec, semantics, evidence, expected-fail, and non-blocking correctness gaps. |
| `docs/bugs/RELEASE_GATES.md` | Mandatory friend-alpha GO gates. Not a bug list. |
| `docs/bugs/HISTORICAL_ARCHIVE.md` | Readable archive of resolved historical regressions; detailed ledger remains in `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md`. |

## Summary Counts

Counts are based on the 95 table rows from the old `current_bugs.md`.

| Category | Primary row count | Notes |
|---|---:|---|
| Active blockers | 6 primary active-only rows; 22 active blocker entries total | 16 physical QA rows are also listed as active blockers because they block friend alpha. |
| Physical QA pending | 28 | Primary owner for real-device proof rows. |
| Verified monitors | 47 | Fixed/covered or release-gate monitor rows. |
| Audit findings | 14 | Non-blocking spec/evidence/semantics gaps. |
| Historical archive | 0 current table rows; 6 historical groups | Historical evidence preserved in archive plus `MGX_GAME_PROGRESS_BUGFIX_LEDGER.md`. |

Primary classification total: 95 rows.

## Primary Classification Map

| Category | IDs |
|---|---|
| Active blockers | `PREVIEW-DEPLOY-02`, `UI-REPLAY-READABILITY-001`, `CORE5-CPU-FOLD-001`, `BADUGI-CPU-VALUE-BET-001`, `CPU-TOO-NIT-001`, `MEANINGFUL-DECISION-001` |
| Physical QA pending | `BADUGI-BET-DRAW-TRANSITION-001`, `BADUGI-DRAW1-CPU-ACTION-001`, `BADUGI-HAND-SHAPE-001`, `BADUGI-FOLD-DRAW-FREEZE-001`, `PHYSICAL-MOBILE-BADUGI-WAITING-001`, `TOUR-SEAT-LIFECYCLE-001`, `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`, `UI-MOBILE-TABLE-DENSITY-001`, `UI-MOBILE-HUD-OVERLAY-001`, `UI-MOBILE-LANDSCAPE-CONTROLS-001`, `UI-MOBILE-LAYOUT-MODE-001`, `BADUGI-CASH-OPENING-ACTOR-001`, `BADUGI-DRAW-BET-MIX-001`, `CROSS-VARIANT-STATE-001`, `D01-BLIND-POSTING-001`, `DRAW-OPENING-ACTOR-001`, `ALPHA-MOBILE-01`, `UI-CORE5-003`, `CORE5-UI-TOURNAMENT-001`, `CORE5-UI-TOURNAMENT-002`, `CORE5-MOBILE-BROWSER-001`, `CORE5-UI-CONTROLS-001`, `TD-ALPHA-02`, `DRAW-NAT-01`, `CORE5-BET-CAP-001`, `CORE5-DRAW-FELT-001`, `UI-POSITION-CLARITY-001`, `BG-005` |
| Verified monitors | `BADUGI-ALPHA-01`, `BADUGI-ALPHA-02`, `BADUGI-ALPHA-03`, `BADUGI-ALPHA-04`, `BADUGI-PROG-001`, `BADUGI-BET-REOPEN-001`, `CORE5-PHASE-MACHINE-001`, `CORE5-IMPOSSIBLE-TRANSITION-001`, `CORE5-DRAW-BET-MIX-001`, `CORE5-STALE-PHASE-MERGE-001`, `BADUGI-PROG-002`, `TEST-GAP-ALPHA-01`, `PREVIEW-DEPLOY-01`, `DEPLOY-LIVE-001`, `ALPHA-SCOPE-01`, `CORE5-ACTOR-001`, `CORE5-ORDER-LIVE-001`, `CORE5-ORIENT-001`, `CORE5-LIFECYCLE-001`, `TOUR-INTEGRATION-001`, `UI-CORE5-001`, `UI-CORE5-002`, `CORE5-UI-LIVE-001`, `CORE5-TOUR-LIVE-001`, `BROWSER-GAMEPLAY-001`, `CORE5-BROWSER-ACTOR-001`, `CORE5-BROWSER-TERMINAL-001`, `CORE5-BROWSER-POT-001`, `BROWSER-SOAK-001`, `CORE5-BROWSER-MATRIX-001`, `CORE5-BROWSER-DRAW-001`, `CORE5-BROWSER-RUNTIME-001`, `CORE5-BROWSER-TERMINAL-COLLECT-001`, `CORE5-BROWSER-HELPER-001`, `CORE5-UI-POT-001`, `TD-ALPHA-01`, `27TD-PROG-001`, `A5TD-PROG-001`, `SD-POT-001`, `27SD-PROG-001`, `A5SD-PROG-001`, `CORE5-ALLIN-VISIBILITY-001`, `PV90-16`, `UI-ACTION-VISIBILITY-001`, `TOURNAMENT-STRUCTURE-001`, `HU-ENDLESS-001`, `CORE5-LONG-SOAK-001` |
| Audit findings | `RL-SAFE-03`, `MIX-PROG-06`, `EV-GUARD-06`, `EV-GUARD-07`, `EV-GUARD-08`, `27TD-PROG-002`, `A5TD-PROG-002`, `SD-PROG-002`, `HIST-REG-06`, `FB-REG-06-MANUAL`, `CHINESE-03`, `CORE5-CPU-TELEMETRY-001`, `UI-MOBILE-ERGONOMICS-001`, `CAP-NAT-01` |
| Historical archive | No primary current table rows. Historical groups are summarized in `HISTORICAL_ARCHIVE.md` and detailed in `MGX_GAME_PROGRESS_BUGFIX_LEDGER.md`. |

## Duplication Rule

Rows in `PHYSICAL_QA_PENDING.md` may also appear in `ACTIVE_BLOCKERS.md` when they still block friend alpha. In that case:
- `PHYSICAL_QA_PENDING.md` owns closure evidence.
- `ACTIVE_BLOCKERS.md` explains release impact and next action.

No row should be silently downgraded. Do not move a row out of its owner file unless the required evidence is attached.
