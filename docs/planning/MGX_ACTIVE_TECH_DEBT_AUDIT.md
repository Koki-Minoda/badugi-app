# MGX Active Tech Debt Audit

Date: 2026-05-23

Scope: planning-only audit of currently known MGX risks. No behavior, test, engine, backend, RL, or deploy code changes were made for this pass.

Sources reviewed:
- `docs/bugs/ACTIVE_BLOCKERS.md`
- `docs/bugs/PHYSICAL_QA_PENDING.md`
- `docs/bugs/RELEASE_GATES.md`
- `docs/testing/MGX_VARIANT_FAMILY_COVERAGE_MATRIX.md`
- `docs/testing/MGX_ALPHA_TEST_COVERAGE_GAP_AUDIT.md`
- `docs/testing/MGX_TEST_RELIABILITY_AUDIT.md`
- `docs/testing/MGX_CORE5_INVARIANT_RELEASE_GATE.md`
- `docs/testing/MGX_TOURNAMENT_INTEGRATION_RELEASE_GATE.md`
- `docs/testing/MGX_RL_DATA_PIPELINE_AUDIT_REPORT.md`
- `docs/testing/MGX_CORE5_CPU_STRATEGY_SANITY_AUDIT.md`
- `docs/testing/MGX_LIVE_CPU_ACTION_DB_AUDIT.md`
- `docs/deploy/MGX_ALPHA_REMOTE_SYNC_STATUS.md`
- targeted code reads and greps in `src/ui`, `src/games`, `src/ai`, `src/rl`, `backend`, `tests/e2e`, and `scripts/deploy`

## Priority Definitions

- P0: can block play, freeze hands, hide legal user actions, deploy stale assets, or block friend-alpha release until proven fixed on live/physical paths.
- P1: likely to break under 35-variant expansion, AI/RL evaluation, tournament scale, or cross-family UI paths, but not proven as immediate production freeze.
- P2: operational quality, observability, physical polish, or coverage gaps that should be tracked but can follow alpha stabilization.

## Active Risk Matrix

| Priority | Area | Issue | Risk | Reproducible | Existing Tests | Missing Tests | Suggested Fix Direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | Badugi phase flow | Physical reports still list BET close not advancing to DRAW after Badugi betting closure. | Hand can stop at the BET/DRAW boundary even if automation passes. | Not currently reproduced in local/live emulation; physical recheck pending. | Badugi browser progress, phase machine, recent mobile regression. | Real iPhone Safari/PWA tournament path from BET through DRAW1 and next BET. | Keep engine unchanged until reproduced; collect physical trace with handId, phase, acting seat, legal actions. |
| P0 | Badugi DRAW CPU action | DRAW1 CPU action failure is fixed in local/live emulation but not physically revalidated. | CPU auto-action loop or stuck DRAW can still occur on device-only timing. | Physical pending. | DRAW round regression and local browser runs. | Real-device DRAW1 CPU discard/action trace including next actor after CPU. | Add physical QA evidence before closing; only patch UI/timing adapter if trace shows display drift. |
| P0 | Hand shape isolation | Physical Badugi showed five-card contamination after draw-lowball paths. | Cross-variant session leakage can corrupt Badugi hands and invalidate game state. | Local checks pass; original physical path not rechecked. | Cross-variant cash matrix, one-hand harness. | Browser and physical sequence D01/D02/S01/S02 to Badugi tournament with exported hand shape logs. | Treat as release blocker until same physical sequence proves 4-card Badugi state. |
| P0 | Fold/all-in/DRAW actor skip | Folded Hero or folded seats in DRAW no longer reproduce automation but remain physical blocker. | Acting seat can point at an ineligible folded/all-in seat and freeze progression. | Local automation passes; physical pending. | Core5 invariant release gate, folded/all-in skip checks. | Physical Badugi tournament fold-before-DRAW and all-in-before-DRAW paths. | Trace `nextTurn`, `metadata.actingPlayerIndex`, folded/all-in flags, and legal actions at every transition. |
| P0 | Cash opening actor | Badugi cash first opening actor freeze remains in physical pending list. | Hero action may never appear at hand start. | Local/live emulation pass; physical iPhone proof missing. | Cash lifecycle browser checks. | Real iPhone cash open, first actor, first legal action, and first pot update. | Close only with physical evidence; do not alter engine without fresh reproduction. |
| P0 | Phase display/controls drift | Physical report had DRAW/BET label or controls diverging from actual phase. | User may see BET controls during DRAW or stale DRAW status in BET/SHOWDOWN. | Detector exists; physical recheck pending. | DRAW RUSHER regression, phase color tests, mobile E2E. | Device proof for BET -> DRAW -> BET/SHOWDOWN with screenshots and DOM phase attributes. | Keep UI display normalization centralized; add trace-friendly phase labels to QA output if needed. |
| P0 | Mobile control availability | Portrait mobile UI has automated fixes, but iOS visual viewport/PWA proof remains a blocker. | Fold/Call/Raise can be hidden by browser chrome or safe area on physical devices. | 375/390/430 emulation covered; physical pending. | Mobile portrait E2E and smoke. | iPhone Safari and PWA standalone tap-through at 375-class width, rotation, and keyboard-free viewport. | Physical QA with bounding boxes and tap target evidence; keep any future fixes CSS-only. |
| P0 | Tournament seat lifecycle | Busted/out CPU seats can clutter or block readability; tournament busted-seat display tests exist but physical proof pending. | Reseat/balance and bust display can obscure action area or mislead active-seat status. | Local policy/test exists; live/physical proof pending. | Tournament busted seat display regression, tournament lifecycle gate. | Real tournament bust/reseat/balance run with visual capture and actor legality logs. | Separate display compactness from eligibility logic; avoid engine changes unless actor bug is reproduced. |
| P0 | Live/remote deploy source | Remote sync docs still flag local branch ahead / push credential risk; deploy can run from a head not preserved in origin. | Next deploy may omit local-only fixes or make rollback ambiguous. | Reproducible by comparing local and origin refs. | Deploy script asset sync verification now exists. | CI/deploy proof that target commit exists on remote before production deploy. | Add operational gate: deploy only pushed commit SHA; record deployed SHA in release note or health metadata. |
| P0 | Static asset serving | Deploy script now checks dist/live hashes, but Nginx fallback can still make missing static files look like SPA HTML unless `/assets` is strict. | Stale cached asset URLs may return HTML, causing blank app or confusing PWA/cache failures. | Needs Nginx config inspection on live. | Deploy script checks manifest is not HTML and live index has hashes. | Direct live check for missing `/assets/not-real.js` returns 404, not HTML. | Add Nginx static asset `try_files $uri =404` verification as a deploy/ops follow-up. |
| P1 | UI state orchestration | `src/ui/App.jsx` remains the high-complexity junction for engine state, UI state, action dispatch, debug logs, and recovery paths. | Small UI changes can accidentally affect actor, phase, or hand cleanup behavior. | Structurally visible. | Broad UI and E2E coverage. | Contract tests around App adapter inputs/outputs independent of React rendering. | Extract display adapters and action availability selectors without changing engine semantics. |
| P1 | Snapshot merge contract | `mergeEngineSnapshot` derives `metadata.actingPlayerIndex` from `snapshot.nextTurn`/`turn` and does not preserve a richer actor source contract. | Stale or null actor metadata can desync UI controls from engine turn. | Code-visible; historical stale actor risks documented. | Snapshot merge tests and stale actor E2E partial coverage. | Focused tests for null nextTurn, terminal states, folded/all-in seats, and snapshot metadata conflicts. | Define a canonical actor display contract with explicit terminal/no-actor states. |
| P1 | Legacy Badugi abstraction | Badugi controller and engine still wrap legacy round flow and fallback paths. | Variant abstraction can diverge from Badugi legacy behavior; fixes may land in one path only. | Code-visible. | Badugi-specific regression suite. | Cross-controller equivalence tests for action, draw, showdown, cleanup, and restore paths. | Gradually isolate legacy adapter behind a documented `GameController` contract. |
| P1 | Round flow fallback | `roundFlow.jsx` has safety fallbacks around betting advancement and phase transitions. | Fallback can hide primary transition bugs and make freeze causes harder to prove. | Code-visible and related to historical blockers. | BET/DRAW transition tests. | Failure-injection tests that assert fallback logs and final actor/phase invariants. | Keep fallback for now, but make diagnostics explicit and release-block on fallback frequency. |
| P1 | Side pot/component pot | `src/games/core/potResolver.js` still has TODO for side-pot accounting and winner selection per component. | Split variants, all-in, quartering, bomb pots, double boards, and hi/lo payouts can be wrong. | Code TODO. | Some pot continuity checks. | Component-pot E2E for all-in split, odd chip, hi/lo quartering, board-by-board, and bomb pot. | Implement resolver behind shared contract before broad variant release. |
| P1 | Showdown evaluator registry | `src/games/core/showdownResolver.js` still has TODO to dispatch evaluator registry. | Stud/Omaha/split/draw special variants can show or award incorrect winners. | Code TODO. | One-hand harness and selected evaluator tests. | Per-family showdown golden tests with normalized result schema. | Finish evaluator registry and normalized result contract before enabling unsupported families. |
| P1 | Board engine integration | `src/games/core/boardManager.js` only handles flop/turn/river and has TODOs for variant-specific board streets/deck manager. | Stud, double-board, Dramaha, Omaha, bomb pot, and OFC streets can break under shared UI assumptions. | Code TODO. | Board helper tests partial. | Full street progression tests for Stud, Omaha, double-board, Dramaha, and OFC. | Move board/street definitions into game definitions consumed by controller and UI. |
| P1 | Phase naming | UI and logic must normalize `BET`, `DRAW`, `DRAWING`, `SHOWDOWN`, waiting, and non-Badugi street names. | 35 variants can display wrong controls or accents if phase names are compared ad hoc. | Partially covered by recent DRAW indicator tests. | DRAW phase color regression. | Cross-family phase display tests for Stud streets, board streets, draw phases, showdown, and waiting. | Centralize phase normalization per variant family. |
| P1 | Action schema drift | CPU/RL/UI can emit `raise`, `bet`, `call`, `check`, discard/draw aliases, or fallback actions with different shapes. | Legal action checks, RL endpoint calls, and UI buttons can diverge. | Historical CPU alias fixes and code-visible normalization. | Action normalization tests. | Contract tests across UI, CPU overlay, RL decision, and persisted action logs. | Maintain one action schema adapter per family and assert canonical output at boundaries. |
| P1 | Card/seat/table layout assumptions | UI still has many Badugi/six-seat/table-density assumptions despite mobile improvements. | Stud/Omaha/double-board/large-hand variants will overlap seats, boards, pot, or controls. | Observable by code and family coverage docs. | Mobile regression and some layout smoke. | Variant-family visual smoke at desktop, portrait, and landscape for 35 variants. | Add layout definitions per family: hand size, board count, street summary, seat scale, and action density. |
| P1 | Replay/log schema | Replay, hand log, QA, and DB metadata do not yet capture all variant-specific fields consistently. | Repro of production issues can lack legal actions, mode, session, board/component, or decision source. | Live DB audit documents incomplete source attribution. | Some QA persistence tests. | End-to-end persisted hand log contract test with sessionId, mode, legalActions, decisionSource, phase, and variant metadata. | Version replay/log schema and make missing diagnostic fields explicit. |
| P1 | Variant registry completeness | Coverage docs mark several families WIP or partial, including split draw, Big-O hi/lo clarification, Dramaha, OFC, and direct mixed registry entries. | Product may expose variants before controller/evaluator/UI contracts are complete. | Documented. | One-hand variant harness. | Release-gated per-variant browser and evaluator matrix. | Treat registry enablement as release flag controlled by completed family contracts. |
| P1 | Counterfactual replay timeout | `counterfactualReplay.test.js` has a known timeout unrelated to mobile UI. | Full test suite reliability suffers; AI evaluation changes can be hidden behind slow/flaky tests. | Known timeout from recent runs. | AI evaluation tests exist. | Performance-bounded replay fixture and deterministic small-sample regression. | Profile `runCounterfactualDivergenceScore`; separate heavy evaluation from default unit suite. |
| P1 | RL endpoint contract drift | RL reports note state vector padding, generic model fallback, reward mismatch, and Badugi-focused benchmark storage. | Training/eval pipeline can diverge from live game behavior and produce weak or invalid CPU decisions. | Documented in RL pipeline audit. | RL pipeline tests and backend fallback checks. | Strict schema rejection tests and per-variant benchmark fixtures. | Version RL request/response schema and fail closed for missing critical fields. |
| P1 | CPU pro-overlay passivity | Core5 pro-overlay cash path was fold-heavy and source attribution was incomplete. | Gameplay quality may feel broken even when rules are correct. | Live/DB audit incomplete; Node audit shows high fold rates in pro-overlay cash. | CPU strategy sanity audit. | Live sessionId-tagged CPU decision audit with legal actions, source, and fallback reason. | Confirm decision source before tuning; then adjust policy/model with measured targets. |
| P1 | Live CPU telemetry | Historical live DB rows lack reliable session/mode/legalActions/fallbackReason/cpuPolicy. | Cannot conclusively prove whether live CPU decisions came from model, heuristic, or fallback. | Documented. | Metadata persistence implementation exists. | Post-deploy targeted DB audit by session id. | Make telemetry part of release gate for CPU behavior claims. |
| P1 | Tournament reseat/balance | Tournament lifecycle gates pass locally, but reseat/balance/seat-out edge cases remain high-impact. | Bad actor assignment, dead seats, or visual clutter after bust/reseat can block tournaments. | Local only; physical/live proof pending. | Tournament integration release gate. | Longer live tournament run with multiple busts, table balancing, and all-in eliminations. | Keep lifecycle invariants as release gate; add visual + actor telemetry around seat changes. |
| P2 | Rollback and backup | Deploy script verifies frontend sync, but rollback/backup procedure is not fully release-gated in reviewed docs. | A bad deploy can be detected but slower to reverse. | Process gap. | Deploy script syntax and live checks. | Dry-run rollback drill and backup restore check. | Document one-command rollback and retain previous `dist`/backend artifact. |
| P2 | Nginx failure handling | Deploy reload is checked, but broader restart failure, partial backend restart, and service health ordering need operational rehearsal. | Failed reload/restart can leave mixed frontend/backend state. | Process gap. | `nginx -t`, reload, `/api/health` check. | Simulated failed backend and failed manifest checks. | Add staged health verification and rollback instructions. |
| P2 | Migration drift | Backend docs mention temporary in-memory feeds and migration concerns remain in release gates. | Prod/dev schema drift can break history, hand log, or telemetry. | Process/documentation gap. | Backend tests and health db ok. | Alembic head/current check in deploy gate. | Add migration status command to deploy checklist. |
| P2 | Stale reports and dirty docs | Repository has multiple untracked/modified planning, bug, report, and E2E files. | Important release evidence can stay local and disappear or confuse next deploy. | Visible in `git status`. | None. | Documentation hygiene check before release branch. | Commit, archive, or intentionally ignore generated reports before alpha gate. |
| P2 | PWA cache lifecycle | Manifest fallback is checked, but PWA standalone upgrade/cache removal instructions remain manual. | Users can keep old assets after deploy and misreport fixed bugs. | Browser-dependent. | Deploy manifest live check. | PWA install/update physical test on iOS and Android. | Publish cache-clearing/PWA reinstall steps and consider explicit app version display. |
| P2 | UI density and tap polish | Mobile portrait is improved, but hero info density, CPU clutter, animation feedback, and tap misfire risks remain. | Game may be playable but still hard to read or error-prone on small devices. | Physical QA pending. | Mobile E2E layout bounds. | Physical usability pass with tap error notes and orientation changes. | Iterate CSS/display density only after P0 physical proof. |
| P2 | E2E cost and flake management | Multiple audit docs note smoke-first tests, heavy AI tests, and historical skipped/gated reports. | CI can become slow, noisy, or miss regressions hidden behind skipped paths. | Documented. | Existing E2E and unit suite. | Stable tiering: release smoke, full variant matrix, heavy AI nightly. | Split test tiers and label known slow tests clearly. |

## P0: Immediate Danger

These should remain treated as active release risks until proven closed with live or physical evidence:

1. Badugi BET close not advancing to DRAW on physical path.
2. DRAW1 CPU action/device timing freeze risk.
3. Cross-variant hand-shape contamination into Badugi.
4. Folded/all-in seat actor skip around DRAW.
5. Badugi cash opening actor disappearance.
6. DRAW/BET visual/control phase drift on physical device.
7. Mobile/PWA safe-area and visual viewport action availability.
8. Tournament busted/out seat lifecycle and readability.
9. Local-only or unpushed deployment source risk.
10. Static asset fallback/caching risk after deploy.

## P1: Variant Expansion Risks

Variant expansion is most exposed where the code still assumes Badugi-like phase flow, six-seat table geometry, a narrow action schema, or simple pot/showdown contracts.

Variant expansion must not proceed broadly until:

1. `GameController` input/output contracts are documented and tested per family.
2. Phase and action normalization are centralized per family.
3. Component-pot, side-pot, hi/lo, board-by-board, odd-chip, and all-in payout contracts are implemented.
4. Showdown evaluator registry returns normalized per-player results.
5. Board/street definitions are data-driven from game definitions.
6. UI layout metadata exists for hand size, board count, table density, and street summary.
7. Replay/log/DB schema captures variant-specific state without ad hoc fields.
8. CPU/RL action contracts are versioned and validated before execution.

## P1: AI, RL, and Evaluation Risks

1. `counterfactualReplay.test.js` timeout can make full-suite signal unreliable.
2. Pro-overlay cash decisions have shown excessive fold rates; live source attribution is still incomplete.
3. RL request state vectors can be padded instead of strictly rejected when fields are missing.
4. RL reward/eval assumptions differ from real chip-EV gameplay.
5. Human benchmark and fallback comparison paths are still Badugi-weighted.
6. CPU action aliases must remain normalized across UI, AI, RL, and persisted logs.
7. Replay determinism needs smaller, stable fixtures separate from heavy evaluation jobs.

## P2: Operational Quality

1. Add a rollback drill and previous-artifact retention to deploy practice.
2. Add strict `/assets` 404 verification to Nginx/live checks.
3. Add migration head/current checks before backend restart.
4. Publish PWA cache removal and reinstall instructions for testers.
5. Separate release, full matrix, and heavy AI test tiers.
6. Clean up or intentionally commit/archive local report and planning artifacts.

## UI/UX Residual Risks

1. iOS Safari/PWA visual viewport can still differ from Playwright emulation.
2. Mobile hero and CPU information density may still be high after controls are fixed.
3. Tournament seat-out and mucked seat visuals need real-game readability proof.
4. Tap feedback and accidental-tap risk are not covered by bounding-box E2E.
5. Landscape and portrait consistency needs physical rotation proof.
6. PWA standalone safe-area behavior needs separate validation from browser tab mode.

## Top 10 To Fix Now

1. Complete physical iPhone Safari/PWA proof for Badugi tournament BET -> DRAW -> BET/SHOWDOWN.
2. Complete physical proof for DRAW1 CPU action and folded/all-in actor skip.
3. Re-run cross-variant contamination path ending in Badugi tournament on physical device.
4. Prove Badugi cash opening actor on physical iPhone.
5. Prove mobile controls remain tappable in Safari and PWA standalone after browser chrome changes.
6. Add release gate that production deploy commit must exist on remote.
7. Add live check that missing `/assets/*.js` returns 404 rather than SPA HTML.
8. Capture live CPU decision telemetry by sessionId with legalActions and decisionSource.
9. Split or optimize `counterfactualReplay.test.js` so default suite is stable.
10. Add focused actor/phase snapshot tests around null actor, terminal actor, folded seats, and metadata conflicts.

## Required Before Variant Expansion

1. Finish side-pot/component-pot payout resolver.
2. Finish showdown evaluator registry and normalized result schema.
3. Move board and street definitions into variant definitions.
4. Centralize phase normalization and action schema adapters.
5. Add per-family UI layout metadata and visual smoke tests.
6. Version replay/log/DB schemas for variant-specific fields.
7. Add CPU/RL schema contract tests for every enabled family.
8. Treat registry exposure as a release flag, not just a code definition.

## Alpha Release Blockers

1. Physical mobile P0/P1 QA evidence listed in `docs/bugs/PHYSICAL_QA_PENDING.md`.
2. Active blocker closure or explicit accepted-risk signoff in `docs/bugs/ACTIVE_BLOCKERS.md`.
3. Remote/deploy source sync proof for the exact production commit.
4. Live Badugi and Core5 tournament runtime proof after current deployment.
5. CPU decision source attribution proof for pro-overlay gameplay quality claims.
6. Browser gameplay invariant pass on the same commit intended for alpha.
7. Mobile portrait/landscape/PWA controls proof on real devices.

## Safe To Defer

1. Animation polish and richer tactile feedback.
2. Non-blocking visual density improvements after physical playability is proven.
3. Long-run natural gameplay soak outside alpha critical variants.
4. Full Dramaha/OFC/mixed-family product polish if not exposed in alpha.
5. Heavy AI evaluation dashboards, provided default tests stay stable.
6. Historical report cleanup after release-critical artifacts are committed or archived.

## Most Dangerous Architecture Debt Top 5

1. `App.jsx` acts as a monolithic UI, state, action, recovery, and debug orchestrator.
2. Actor state has multiple sources (`nextTurn`, `turn`, metadata actor, controller state, UI-selected actor) with partial merge semantics.
3. Badugi legacy round flow and newer variant/controller abstractions coexist without a fully enforced contract.
4. Pot/showdown/board abstractions are scaffolded but not complete for split, hi/lo, double-board, bomb-pot, and Stud/Omaha families.
5. Live telemetry is not yet authoritative enough to diagnose CPU source, legal action set, mode, and session path from production data alone.

## Most Missing E2E Top 5

1. Physical iPhone Safari/PWA Badugi tournament full path: BET -> DRAW -> BET -> SHOWDOWN.
2. Cross-variant cash-to-tournament contamination path ending in Badugi with exported state evidence.
3. Side-pot/component-pot split tests for all-in, hi/lo quartering, odd chip, double board, and bomb pot.
4. 35-variant visual smoke across desktop, mobile portrait, and mobile landscape.
5. Live CPU decision-source audit by sessionId with legalActions, fallbackReason, policy/source, and resulting action.

## First 35-Variant Breakpoints Top 5

1. Table/layout assumptions around six seats, Badugi-sized hands, one board/pot center, and fixed HUD density.
2. Phase names and street models that do not map cleanly from Badugi DRAW/BET to Stud/Omaha/OFC/mixed variants.
3. Action schema differences across draw, board, split, all-in, cap, bet/raise, and discard paths.
4. Incomplete component-pot and showdown resolution for split, board-by-board, odd-chip, bomb-pot, and double-board games.
5. Replay/log/DB schema gaps for variant-specific boards, components, legal action sets, decision source, and session identity.

