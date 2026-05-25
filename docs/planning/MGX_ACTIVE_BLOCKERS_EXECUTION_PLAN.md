# MGX Active Blockers Execution Plan

Last updated: 2026-05-21

## Scope And Boundary

This is a planning-only execution plan for all rows in `docs/bugs/ACTIVE_BLOCKERS.md`.

Hard boundary for this phase:
- Do not modify product code.
- Do not modify test code.
- Do not change runtime behavior.
- Do not update `ACTIVE_BLOCKERS.md`, `PHYSICAL_QA_PENDING.md`, or other blocker state files.
- If implementation is required, stop after documenting the exact implementation plan and wait for execution approval.

Source of truth:
- `docs/bugs/ACTIVE_BLOCKERS.md`
- `docs/bugs/PHYSICAL_QA_PENDING.md`
- `docs/bugs/RELEASE_GATES.md`
- Existing testing, alpha, and report evidence referenced by those files.

Important count: `ACTIVE_BLOCKERS.md` currently contains 22 rows. The user-provided execution list contains 21 IDs, but `BADUGI-HAND-SHAPE-001` is present in the source-of-truth blocker file and is therefore included in this plan.

## Status Rules

Physical-QA-required blockers:
- Keep in `ACTIVE_BLOCKERS.md` until physical evidence is attached, historical guard passes, and the row no longer affects friend-alpha GO/HOLD.
- If automation/emulation passes but device evidence is missing, planning status is `automated/emulation verified, physical QA pending`.
- Keep cross-reference to `docs/bugs/PHYSICAL_QA_PENDING.md`.
- Do not move to monitor or historical archive from emulation alone.

Telemetry-required blockers:
- Keep open until sessionId-linked live/deployed evidence exists.
- Local unit tests are insufficient for closure.
- Required proof must tie decision source, selected/final action, legal actions, fold/nit behavior, value-pressure spots, or meaningful-decision density to deployed session data.

Implementation-required blockers:
- Add or strengthen a regression test first during later execution.
- Fix only the root cause and only related files.
- Run focused tests, the required matrix, and historical guards before any blocker state update.

## Execution Order

### Phase 1 - Progression / Actor / Terminal P0

| Order | Blocker | Classification | Later execution decision |
|---:|---|---|---|
| 1 | `BADUGI-CASH-OPENING-ACTOR-001` | Physical QA required / P0 progression | No code unless physical recheck or focused automation reproduces. First action is physical Badugi cash opening actor QA packet. |
| 2 | `BADUGI-BET-DRAW-TRANSITION-001` | Physical QA required / P0 progression | No code unless physical export shows closed BET stall. First action is physical Badugi tournament BET-to-DRAW recheck. |
| 3 | `BADUGI-DRAW-BET-MIX-001` | Physical QA required / P0 phase sync | No code unless physical export shows settled DRAW/BET mixed state. Add focused export regression if reproduced. |
| 4 | `BADUGI-DRAW1-CPU-ACTION-001` | Physical QA required / P0 draw action | No code unless physical DRAW1 action failure reproduces. |
| 5 | `BADUGI-FOLD-DRAW-FREEZE-001` | Physical QA required / P0 draw actor eligibility | No code unless folded/out/busted actor is elected on physical path. |
| 6 | `PHYSICAL-MOBILE-BADUGI-WAITING-001` | Physical QA umbrella / P0 freeze | Aggregate physical Badugi tournament recheck. Do not close until concrete child rows are cleared. |
| 7 | `CROSS-VARIANT-STATE-001` | Physical QA required / P0 cross-variant state | No code unless physical recheck shows contamination after cash-to-tournament path. |
| 8 | `BADUGI-HAND-SHAPE-001` | Physical QA required / P0 hand-shape contamination | No code unless physical recheck shows Badugi five-card contamination. |

### Phase 2 - Tournament / Mobile P0-P1

| Order | Blocker | Classification | Later execution decision |
|---:|---|---|---|
| 9 | `TOUR-SEAT-LIFECYCLE-001` | Physical QA required / tournament readability | No code unless physical busted-seat panel remains or actor eligibility breaks. |
| 10 | `UI-MOBILE-TOURNAMENT-LANDSCAPE-001` | Physical QA required / P0 mobile controls | No code unless physical Safari/PWA still clips or blocks controls. |
| 11 | `UI-MOBILE-TABLE-DENSITY-001` | Physical QA required / P1 readability | No code unless physical readability fails. |
| 12 | `UI-MOBILE-HUD-OVERLAY-001` | Physical QA required / P1 HUD density | No code unless physical HUD/rail/phase covers cards or actions. |
| 13 | `UI-MOBILE-LANDSCAPE-CONTROLS-001` | Physical QA required / P1 landscape controls | No code unless physical landscape controls are not tappable. |
| 14 | `UI-MOBILE-LAYOUT-MODE-001` | Physical QA required / P1 layout mode | No code unless physical orientation chooses wrong layout mode or causes clipping. |
| 15 | `D01-BLIND-POSTING-001` | Physical QA required / P1 blind display | No code unless physical trace proves actual blind/pot/stack mismatch or display regression. |
| 16 | `BG-005` | Physical QA umbrella / P1 mobile manual QA | Remains open until concrete physical rows clear and iOS/Android QA passes. |

### Phase 3 - Deployment / Replay / CPU Quality

| Order | Blocker | Classification | Later execution decision |
|---:|---|---|---|
| 17 | `PREVIEW-DEPLOY-02` | Credentialed deploy/sync required | Agent prepares checklist only. Credentialed human pushes/deploys and records live proof. |
| 18 | `UI-REPLAY-READABILITY-001` | Implementation required / P1 replay UX | Later implementation must add regression for grouped replay view before product change. |
| 19 | `CORE5-CPU-FOLD-001` | Telemetry required / P1 CPU quality | No strategy tuning until deployed sessionId telemetry proves source and fold behavior. |
| 20 | `BADUGI-CPU-VALUE-BET-001` | Telemetry required / P1 value pressure | No strategy tuning until live pressure-row evidence is captured by sessionId. |
| 21 | `CPU-TOO-NIT-001` | Telemetry required / P1 tournament CPU realism | Keep separate from Badugi adapter proof; require deployed tournament decision-density/source audit. |
| 22 | `MEANINGFUL-DECISION-001` | Telemetry required / P1 decision density | Require deployed sessionId measurement of meaningful-decision density before closure. |

## Later Execution Workflow Per Blocker

1. Confirm row in `ACTIVE_BLOCKERS.md` and, if physical, matching row in `PHYSICAL_QA_PENDING.md`.
2. Reproduce or identify exact missing proof.
3. If behavior is reproducible and implementation is needed, add/strengthen a failing regression first.
4. Fix root cause only after proof is established.
5. Run targeted tests for the blocker.
6. Run the required integration matrix from `MGX_ACTIVE_BLOCKERS_QA_MATRIX.md`.
7. Run historical regression guard.
8. Update planning/tracking evidence only after gates complete.
9. Decide: `resolved`, `monitor`, `physical QA pending`, `telemetry pending`, or `reopened`.

## Later Implementation Targets By Blocker Type

Physical progression blockers:
- Likely affected areas only if physical repro returns: Badugi controller/session snapshot synchronization, Badugi MTT draw action path, cross-variant hand-shape sanitization, draw actor eligibility, mixed DRAW/BET snapshot validation.
- Tests first: focused existing unit/UI/E2E named in the blocker row, plus an export-derived regression if physical QA produces JSON.

Mobile/tournament blockers:
- Likely affected areas only if physical repro returns: tournament eliminated-seat projection, mobile visual viewport sizing, mobile tournament layout policy, HUD density, layout-mode detection, D01 blind/position adapter.
- Tests first: mobile visual viewport/layout/readability specs, tournament busted-seat regression, D01 blind snapshot tests.

Replay readability:
- Likely affected areas in later implementation: replay frame/view-model construction and replay UI rendering.
- Tests first: replay view-model/unit regression plus `ui-readability-smoke.spec.ts` evidence for grouped street/name/position/action order readability.

CPU quality:
- Likely affected areas only after telemetry proves source: CPU decision persistence/audit scripts, pro-overlay normalization, decision-density reports.
- Tests first: CPU decision metadata persistence, Badugi value-pressure regression, deployed sessionId DB audit.

Remote sync:
- No code implementation by agent.
- Credentialed human must push/deploy; agent may prepare checklist and expected verification commands.

## Stop Conditions

Stop new blocker work immediately if any of these appear during later execution:
- actor/order P0 reappears
- terminal/result or next-hand becomes unreachable
- Cash or Tournament instability appears
- mobile controls become unusable
- stale turn returns
- BET/DRAW mixed state returns
- historical guard fails
- change scope exceeds one blocker
- a physical-QA-required row is about to be closed without physical evidence
- a telemetry-required row is about to be closed without sessionId-linked deployed evidence

In the planning-only phase, discovery of any implementation need must be recorded here or in `MGX_ACTIVE_BLOCKERS_PROGRESS.md`; implementation waits for explicit approval.
