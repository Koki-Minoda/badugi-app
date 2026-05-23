# Physical QA Pending

Last updated: 2026-05-21

This file contains rows that cannot be closed from Playwright emulation alone. Each requires real-device proof such as iPhone Safari, iPhone PWA, Android Chrome, rotation, touch, or physical mobile interaction evidence.

Operational evidence docs:
- Framework: `docs/testing/MGX_PHYSICAL_QA_EVIDENCE_FRAMEWORK.md`
- Runbook: `docs/testing/MGX_PHYSICAL_QA_RUNBOOK.md`
- Evidence packet template: `docs/testing/MGX_PHYSICAL_QA_EVIDENCE_TEMPLATE.md`

Closure rule:
- Do not close, remove, or move a row to a verified monitor from this file without a completed physical QA evidence packet.
- The evidence packet must identify the blocker ID, physical device/browser mode, release commit/hash, screenshots, export/log paths, phase/actor/legal-action captures, player statuses, pass/fail result, residual risk, reviewer, and date.
- Existing automated/local/Playwright passes are supporting evidence only; they do not close physical-only blockers.

Summary:
- Physical QA pending rows: 28
- Rows also blocking friend alpha in `ACTIVE_BLOCKERS.md`: 16
- Current automated status: emulation/local/live automated gates are passing or locally covered unless noted.
- Close rule: do not close or move to ledger without the required real-device evidence.

| ID | Required device/browser | Required scenario | Current automated status | Required evidence to close | Current risk |
|---|---|---|---|---|---|
| `BADUGI-BET-DRAW-TRANSITION-001` | iPhone Safari/PWA | Badugi tournament reaches BET closure and advances to DRAW without stale labels/actor. | Emulation/live focused regressions PASS. | Screenshot or exported snapshot showing no closed-BET stall on the original physical path. | P0 progression freeze if recurrent. |
| `BADUGI-DRAW1-CPU-ACTION-001` | iPhone Safari/PWA | Badugi tournament CPU DRAW1 applies and returns variant-stamped snapshot. | Unit/UI/E2E/live regressions PASS. | Physical trace where CPU DRAW1 completes and hand remains playable. | P0 draw action failure. |
| `BADUGI-HAND-SHAPE-001` | iPhone Safari/PWA | D01/D02/S01/S02 cash paths followed by Badugi tournament. | Hand-shape and cross-variant regressions PASS. | Physical Badugi tournament starts and stays four-card only. | P0 cross-variant contamination. |
| `BADUGI-FOLD-DRAW-FREEZE-001` | iPhone Safari/PWA | Hero folds before/inside DRAW; folded/out/busted seats are not re-elected. | Folded draw regressions PASS. | Physical proof that folded Hero does not receive controls and hand progresses. | P0 folded-player revival/freeze. |
| `PHYSICAL-MOBILE-BADUGI-WAITING-001` | iPhone Safari/PWA | Full Badugi tournament physical recheck after deployed fixes. | Live/emulation checks PASS. | Completed physical recheck with freeze JSON only if reproduced. | Umbrella P0 physical Badugi waiting freeze. |
| `TOUR-SEAT-LIFECYCLE-001` | iPhone Safari/PWA, Android Chrome optional | Tournament with busted/out CPU seats on mobile. | Local unit/E2E pass; Core5 matrix pass. | Physical screenshot/video showing busted seats compacted to rail and not blocking table/controls. | P0/P1 readability and actor eligibility risk. |
| `UI-MOBILE-TOURNAMENT-LANDSCAPE-001` | iPhone Safari and iPhone PWA | Landscape with Safari URL/tab bar reduced visual viewport. | Landscape/visual-viewport Playwright gates PASS. | Physical proof Call/Raise/Fold are fully visible/tappable without scroll. | P0 clipped controls. |
| `UI-MOBILE-TABLE-DENSITY-001` | iPhone Safari/PWA | Tournament portrait and landscape table readability. | Readability/battlefield gates PASS. | Physical confirmation Hero cards, active actor, pot, and controls are readable. | P1 fatigue/readability risk. |
| `UI-MOBILE-HUD-OVERLAY-001` | iPhone Safari/PWA | Tournament HUD, rail, phase, prize/next-level density. | Battlefield/HUD structural gates PASS. | Physical evidence HUD does not cover Hero cards/table/actions. | P1 overlay risk. |
| `UI-MOBILE-LANDSCAPE-CONTROLS-001` | iPhone Safari/PWA | Mobile landscape action controls with no scroll. | Landscape/layout-mode gates PASS. | Physical tap proof for legal controls in landscape. | P1 landscape usability risk. |
| `UI-MOBILE-LAYOUT-MODE-001` | iPhone Safari/PWA, Android Chrome | Portrait and landscape route mode switching. | Layout-mode regression PASS. | Physical evidence `mobile-portrait` and `mobile-landscape` modes behave correctly. | P1 wrong-mode layout risk. |
| `BADUGI-CASH-OPENING-ACTOR-001` | iPhone Safari | Badugi cash first hand opening actor. | Focused local/unit/UI/E2E and six-cell emulation PASS. | Physical Badugi cash opening actor progresses on real Safari. | P0 first-hand cash freeze. |
| `BADUGI-DRAW-BET-MIX-001` | iPhone Safari/PWA | Badugi tournament after physical DRAW/BET divergence screenshot. | Mixed-state detector and emulation gates PASS. | Physical proof no settled DRAW/BET mixed controls/labels. | P0 legal-action corruption. |
| `CROSS-VARIANT-STATE-001` | iPhone Safari/PWA | Cash variants then Badugi tournament. | Cross-variant local/live regressions PASS. | Physical proof no hand-shape/session/controller contamination. | P0 variant state corruption. |
| `D01-BLIND-POSTING-001` | iPhone Safari/PWA | D01 cash/tournament opening blinds and position badges. | D01 blind invariant/snapshot/E2E PASS. | Physical trace showing Hero blind label, bet, pot, and To Call are consistent. | P1 blind display confusion; P0 if actual pot/stack broken. |
| `DRAW-OPENING-ACTOR-001` | iPhone Safari/PWA | Draw-lowball opening actor and position badge after physical screenshot suspicion. | Not reproduced locally; actor order audits PASS. | Physical trace proving no MP-before-UTG unopened-pot action, or export if reproduced. | P2 monitor; reopen P0/P1 if physical trace proves order/display bug. |
| `ALPHA-MOBILE-01` | iPhone Safari/PWA, Android Chrome | D02/S01/S02 playable mobile layout and result reachability. | Emulation deployed smoke PASS. | Physical smoke covering controls, pot, phase, and result. | Core alpha mobile confidence gap. |
| `UI-CORE5-003` | iPhone Safari/PWA | Badugi portrait launch, tap, result, next hand. | Portrait emulation PASS. | Physical Badugi portrait acceptance proof. | Badugi mobile restore confidence gap. |
| `CORE5-UI-TOURNAMENT-001` | iPhone Safari/PWA, Android Chrome | Core5 mobile tournament portrait. | Tournament portrait layout gates PASS. | Physical portrait tournament screenshot/tap proof. | HUD/table collapse recurrence risk. |
| `CORE5-UI-TOURNAMENT-002` | iPhone Safari/PWA, Android Chrome | Core5 mobile tournament landscape 844x390 and 932x430. | Tournament landscape layout gate PASS. | Physical landscape screenshot/tap proof. | Hero/control clipping recurrence risk. |
| `CORE5-MOBILE-BROWSER-001` | iPhone Safari/PWA, Android Chrome | Core5 cash/tournament mobile browser matrix. | Local/live emulation PASS. | Physical proof no Hero controls for non-Hero actor and no mobile progression stall. | Real-device actor/control mismatch risk. |
| `CORE5-UI-CONTROLS-001` | iPhone Safari/PWA, Android Chrome | Tournament mobile action/Fold controls. | Regression gates PASS. | Physical tap comfort proof. | Control clipping/touch target risk. |
| `TD-ALPHA-02` | iPhone Safari/PWA, Android Chrome | D02/S01/S02 mobile card strips, pot badge, compact panels. | Triple Draw mobile visual E2E PASS. | Physical readability proof before friend alpha. | Lowball mobile readability risk. |
| `DRAW-NAT-01` | iPhone Safari/PWA | Natural Badugi draw UI full-hand path. | Local/deployed desktop and mobile emulation pass. | Physical full-hand gameplay reaching result/next hand. | Natural mobile full-hand confidence gap. |
| `CORE5-BET-CAP-001` | iPhone Safari/PWA | Core5 fixed-limit cap on mobile. | Local cap unit/UI/E2E PASS. | Physical proof no fifth raise appears/applies at cap. | P1/P0 cap legality risk if recurrent. |
| `CORE5-DRAW-FELT-001` | iPhone Safari/PWA | DRAW phase table felt/border styling. | Color unit test PASS. | Physical visual confirmation after deploy. | Low readability risk; not a progression blocker. |
| `UI-POSITION-CLARITY-001` | iPhone Safari/PWA | Mobile position/actor context readability after Badugi P0 recheck. | Readability smoke PASS/WARN. | Physical validation of actor/position clarity. | Misread actor/order risk. |
| `BG-005` | iPhone Safari/PWA, Android Chrome | End-to-end physical mobile QA for Core5, especially Badugi tournament. | Automation/deployed browser smoke PASS, but physical findings remain open. | Completed iOS/Android QA checklist with concrete P0 rows cleared. | Friend alpha HOLD. |
