# Verified Monitors

Last updated: 2026-05-21

This file contains rows that are fixed, covered, or intentionally retained as release-gate monitors. These are not active blocker rows unless a future run reopens them.

Summary:
- Verified monitor rows: 47
- Rule: keep regression references; reopen as P0/P1 if a monitored assertion fails in a settled trace or release gate.

| ID | What was fixed | Verification evidence | Regression coverage | Why it remains monitored |
|---|---|---|---|---|
| `BADUGI-ALPHA-01` | Badugi browser full 3-draw flow reaches result and long-run restore passes. | `badugi-flow.spec.ts`; `badugi-alpha-long-run-smoke.spec.ts` PASS. | Browser flow and long-run smoke. | Badugi is in friend-alpha Core5 scope. |
| `BADUGI-ALPHA-02` | Active-hand pot display no longer resets to invalid zero. | Pot snapshot merge, full-round pot regression, long-run smoke PASS. | Pot continuity assertions. | Prevent active-hand pot-zero regressions. |
| `BADUGI-ALPHA-03` | Canonical `nextTurn` wins over stale metadata; no-next-alive path transitions. | Turn snapshot merge and no-next-alive tests PASS. | Actor/stale metadata regressions. | Actor truth is release-critical. |
| `BADUGI-ALPHA-04` | Badugi portrait emulation launches and reaches actions/result. | Portrait/mobile interaction tests PASS. | Mobile emulation coverage. | Physical blockers are tracked separately. |
| `BADUGI-PROG-001` | Badugi progression spec, mapping, coverage audit, browser progression, long-run gates established. | Badugi spec docs and tests PASS. | Badugi release gates. | Reopen if P0 returns. |
| `BADUGI-BET-REOPEN-001` | Hero action reopens only after legal re-raise; no-reraise path does not reselect Hero. | Local/live closure proofs PASS. | Badugi betting closure gate. | Betting closure is regression-sensitive. |
| `CORE5-PHASE-MACHINE-001` | Core5 phase graph and detectors run in focused tests/browser matrix. | Phase spec, detectors, browser matrices PASS. | Impossible transition, mixed-state, stale-merge checks. | Reopen on settled phase-machine P0. |
| `CORE5-IMPOSSIBLE-TRANSITION-001` | Illegal transitions, terminal actors, collect-with-pending, multi-actor states detected. | Impossible-transition and graph tests PASS. | Release-gate detector. | Guard against silent impossible states. |
| `CORE5-DRAW-BET-MIX-001` | Detector flags BET with draw controls and DRAW with betting controls. | Unit/E2E regressions and browser matrix PASS. | Mixed DRAW/BET monitor. | Physical Badugi row owns real-device recheck. |
| `CORE5-STALE-PHASE-MERGE-001` | Stale phase merge detector now targets controller source-of-truth violations. | Stale phase merge tests PASS. | Snapshot/phase merge monitor. | PHASE/POT timing remains monitored. |
| `BADUGI-PROG-002` | Badugi fold actions emit E2E fold events with handId/seat context. | Fold-event logging E2E PASS. | Browser fold-event gate. | Fold path regressions can mask progression bugs. |
| `TEST-GAP-ALPHA-01` | Immediate Badugi P0 class covered by focused tests and browser specs. | Alpha and Badugi coverage audits. | Test coverage gate. | Remaining gap is manual/physical QA. |
| `PREVIEW-DEPLOY-01` | Preview deploy refreshed and live build info matched recorded head for that pass. | Live verification report and UI readability smoke. | Deploy build-info check. | Must be rerun after each deploy. |
| `DEPLOY-LIVE-001` | Live frontend build info and `/api/health` matched current verification. | `live-deploy-verification-after-structure-soak-ux.json`. | Live deploy verification. | Rerun after every fix/deploy. |
| `ALPHA-SCOPE-01` | Friend alpha scope exposes Core5 and keeps other families preview/coming-soon. | Variant availability and launch-scope docs. | Variant gate. | Badugi remains closely monitored. |
| `CORE5-ACTOR-001` | Core5 action-history audit found no fixed-opposite-seat or BB-before-UTG bug. | `core5-action-order-audit.spec.ts`; audit summary. | Actor order audit. | Screenshots alone are only repro hints. |
| `CORE5-ORDER-LIVE-001` | Live URL action-history audit had 0 invalid actor and 0 hero-control mismatch rows. | `live-core5-action-order-audit.spec.ts`; live report. | Live actor order gate. | Keep in deploy gate. |
| `CORE5-ORIENT-001` | Core5 cash/tournament supports portrait and landscape without hard orientation block. | Orientation support spec PASS. | Orientation policy gate. | Monitor layout regressions. |
| `CORE5-LIFECYCLE-001` | Local Core5 cash and tournament lifecycle gates pass. | Lifecycle invariant audit and reports. | Cash/tournament lifecycle gates. | Must rerun against intended live build. |
| `TOUR-INTEGRATION-001` | Tournament integration expansion passes for Core5. | Tournament coverage matrix/release gate. | Tournament blind, rebalance, bust, payout, all-in, resume/retire gates. | Keep in release checks. |
| `UI-CORE5-001` | 1280x720 desktop overflow/control clipping fixed for Core5. | Desktop layout visual audit PASS. | Desktop compact-width screenshot gate. | Prevent desktop regression. |
| `UI-CORE5-002` | D01 portrait pot/hero overlap fixed in emulation. | Mobile portrait visual audit PASS. | Pot/hero overlap assertion. | Monitor mobile visual layout. |
| `CORE5-UI-LIVE-001` | Live tournament runtime no longer throws missing action/street functions. | Live fatal and layout evidence checks PASS. | Live runtime fatal guard. | Keep in release gate. |
| `CORE5-TOUR-LIVE-001` | Live tournament matrix reaches result/next hand across Core5 desktop/mobile emulation. | Live browser gameplay invariant PASS. | Live tournament result/next-hand gate. | Rerun after tournament/controller changes. |
| `BROWSER-GAMEPLAY-001` | Local/live browser gameplay matrices fixed after deployed Badugi tournament DRAW1 fix. | Browser/live invariant harnesses and reports. | Browser gameplay release monitor. | Reopen on illegal actor, stale controls, action failure, terminal blocker. |
| `CORE5-BROWSER-ACTOR-001` | Initial actor P0s classified/fixed in collector/DOM/expected-actor handling. | Badugi trace analysis and browser harness. | Browser actor invariant. | Reopen on settled illegal actor. |
| `CORE5-BROWSER-TERMINAL-001` | Terminal stale-turn collector fallback fixed. | Badugi 100-hand and mode/viewport matrix PASS. | Terminal actor/next-hand monitor. | Watch long-run stale ACTING decoration. |
| `CORE5-BROWSER-POT-001` | No active-hand pot-zero P0 in Badugi matrices. | Browser invariant summaries. | Pot display monitor. | P1 timing semantics still tracked. |
| `BROWSER-SOAK-001` | Badugi cash desktop 100-hand halt classified as helper stale-read/terminal detection issue. | Hand16 analysis and helper regression reports. | Browser soak monitor. | Keep as monitor during ladder expansion. |
| `CORE5-BROWSER-MATRIX-001` | Core5 local/live browser matrices pass across cash/tournament/desktop/mobile emulation. | Matrix reports and fold-to-one terminal tests. | Core5 browser matrix gate. | Reopen on settled live actor/source/action failure. |
| `CORE5-BROWSER-DRAW-001` | Draw/terminal sync fixes and stale hidden Hero controls classified. | Focused draw terminal divergence spec and traces. | Draw/terminal sync monitor. | Reopen on visible Hero controls for non-Hero actor or unapplied draw. |
| `CORE5-BROWSER-RUNTIME-001` | D01/D02 100-hand cash desktop runs complete under runtime budget. | Runtime telemetry reports. | Long draw game runtime monitor. | Keep split-run/light trace strategy. |
| `CORE5-BROWSER-TERMINAL-COLLECT-001` | D01 fold-to-one collect path reaches terminal/result/next-hand with actor cleared. | E2E and unit collect terminal tests PASS. | Fold-to-one terminal monitor. | Reopen on no-actor collect with visible Hero controls. |
| `CORE5-BROWSER-HELPER-001` | Helper current-bet fallback normalized for draw variants. | Browser gameplay Step A PASS. | Harness helper monitor. | Split helper failures from real gameplay violations. |
| `CORE5-UI-POT-001` | Tournament mobile pot appears inside readable table area. | Tournament layout regression PASS. | Pot-in-table assertion. | Prevent mobile table collapse regression. |
| `TD-ALPHA-01` | Triple Draw mapping and actor order audited/fixed, including heads-up blind semantics. | Betting order spec and first actor regression. | Triple Draw alpha gate. | Monitor real-device QA. |
| `27TD-PROG-001` | D01 all-in players skipped for betting but retain draw/showdown eligibility. | All-in eligibility specs/tests PASS. | Core5 draw all-in gate. | Monitor side-pot browser coverage. |
| `A5TD-PROG-001` | D02 all-in players retain draw/showdown eligibility and are excluded from later BET actors. | Draw all-in eligibility tests PASS. | Core5 draw all-in gate. | Monitor side-pot browser coverage. |
| `SD-POT-001` | Single Draw effective-pot snapshot semantics fixed. | Single Draw pot/showdown/snapshot tests PASS. | Single Draw pot semantics gate. | Keep terminal pot echo and active pot distinct. |
| `27SD-PROG-001` | S01 all-in draw eligibility expected-fail converted to passing coverage. | Single Draw progression and visibility tests PASS. | Single Draw all-in gate. | Monitor side-pot browser coverage. |
| `A5SD-PROG-001` | S02 all-in draw eligibility expected-fail converted to passing coverage. | Single Draw progression and visibility tests PASS. | Single Draw all-in gate. | Monitor side-pot browser coverage. |
| `CORE5-ALLIN-VISIBILITY-001` | Draw games use showdown-only all-in reveal; board games can reveal only after action completion. | Policy and snapshot tests PASS. | All-in visibility gate. | Reopen if draw all-in hand is visible before showdown. |
| `PV90-16` | Badugi full 3-draw E2E is green again. | `badugi-flow.spec.ts` PASS. | Badugi deploy checklist. | Still depends on preview launch gating. |
| `UI-ACTION-VISIBILITY-001` | Decision panel now mirrors compact recent-action strip and current actor context. | UI readability smoke PASS/WARN. | Readability smoke. | Broader grouped action history is separate. |
| `TOURNAMENT-STRUCTURE-001` | Tournament preset simulation is viable; Store Turbo intentionally fast. | Tournament structure audit and simulation reports. | Preset monitor. | Preserve decision density in selected alpha preset. |
| `HU-ENDLESS-001` | Current tournament simulations show low heads-up endless risk. | Turbo structure simulation. | HU pacing monitor. | Reopen if flatter structures cause HU oscillation. |
| `CORE5-LONG-SOAK-001` | Fast Core5 soak covers variants/modes/viewports and latest run completed 100/100 hands. | Long-run soak script/spec and reports. | Fast local release soak. | Full 200-hand/variant soak waits for physical Badugi and sync clearance. |
