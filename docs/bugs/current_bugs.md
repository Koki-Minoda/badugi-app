---
title: Current blocker list
---

# Current Bug Index

Last updated: 2026-05-16

This file is now a compact index of **currently open or partially guaranteed** issues. Historical Badugi regressions such as SB fold freeze, draw rollback, single-pot side-pot duplication, next-hand button loss, all-in betting actor selection, stale turn metadata, and draw hand rollback are consolidated in `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md` and are covered by automated regression suites.

## Active / Residual Items

| ID | Area | Current Status | Priority | Verification / Source | Next Action |
|---|---|---|---|---|---|
| `RL-SAFE-03` | Backend QA | Backend full pytest is not green: 32 passed / 4 failed in non-RL Badugi stats and variants API areas. | P2 | `docs/testing/MGX_RL_RESUME_READINESS_REPORT.md` | Fix stats/variant API failures and rerun full backend pytest. |
| `MIX-PROG-06` | RL / 8-10Game | PLO/Stud/Razz real hand-history EV / position / showdown gate is not yet built. | P2 | `docs/badugi_rl_and_variant_status.md` | Add real-log EV gate before promoting board/stud RL tiers. |
| `EV-GUARD-06` | EV integrity | Board/Omaha/Stud terminal evaluator replay against real hand history is still open. | P2 | `docs/testing/MGX_EV_INTEGRITY_REPORT.md` | Replay terminal hands and compare evaluator winner/result. |
| `EV-GUARD-07` | EV integrity | Strict chip conservation is not yet enabled for every controller because terminal pot echo differs by controller. | P2 | `docs/testing/MGX_EV_INTEGRITY_REPORT.md` | Normalize terminal snapshots and enable strict conservation. |
| `EV-GUARD-08` | Split pot | Odd-chip policy is deterministic but not yet aligned to every TDA/variant-specific position rule. | P2 | `docs/testing/MGX_EV_INTEGRITY_REPORT.md` | Define per-variant odd-chip policy and add fixtures. |
| `BADUGI-ALPHA-01` | Badugi browser progression | Focused full 3-draw browser flow is fixed and reaches `Hand Result`, but the new alpha long-run restore gate still finds a broader active-pot / terminal-transition mismatch. | P1 | `tests/e2e/badugi-flow.spec.ts` PASS; `tests/e2e/badugi-alpha-long-run-smoke.spec.ts` expected-fail | Keep Badugi `preview_only`; make the long-run restore gate pass without `test.fail`. |
| `BADUGI-ALPHA-02` | Badugi pot display | Focused pot continuity is fixed, but long-run restore smoke can still surface active-hand `Total Pot 0` symptoms before Badugi is safe for friend alpha. | P1 | `src/ui/__tests__/badugiPotSnapshotMerge.test.jsx` PASS; `tests/e2e/badugi-full-round-pot-regression.spec.ts` PASS; long-run restore expected-fail | Trace the long-run controller/UI pot source at terminal transitions and keep Badugi gated. |
| `BADUGI-ALPHA-03` | Badugi actor election | Fixed/covered: canonical controller `nextTurn` wins over stale metadata and no-next-alive path transitions instead of re-electing checked Hero. | P2 | `src/ui/__tests__/badugiTurnSnapshotMerge.test.jsx`; `src/games/badugi/__tests__/badugiNoNextAliveRegression.test.js` PASS | Keep regression in alpha gate. |
| `BADUGI-ALPHA-04` | Badugi mobile restore | Badugi portrait mobile restore launch is not consistently ready at 390x844 and 430x932; landscape 844x390 passes. | P1 | `tests/e2e/badugi-mobile-gameplay-layout.spec.ts` expected-fail for portrait, PASS for landscape | Fix portrait mobile launch/readiness before restoring Badugi to `alpha_playable`. |
| `BADUGI-PROG-001` | Badugi release audit | Focused Step1 progression audit now has explicit spec docs, implementation mapping, coverage audit, and added release-spec tests for betting order, draw progression, pot continuity, showdown/next-hand, snapshot merge, and focused browser progression. Long-run browser restore remains blocked. | P1 | `docs/rules/MGX_BADUGI_GAME_PROGRESSION_SPEC.md`; `docs/testing/MGX_BADUGI_TEST_COVERAGE_AUDIT.md`; `src/games/badugi/__tests__/badugiProgressionSpec.test.js`; `tests/e2e/badugi-progression-spec.spec.ts` | Keep Badugi `preview_only`; next fix should target long-run active-pot / terminal-transition mismatch. |
| `BADUGI-PROG-002` | Badugi browser fold events | Full `badugi-flow.spec.ts` still has three fold-event assertions where expected fold event logs are missing for hero-fold, position-specific fold, and consecutive-hand reset paths. Focused progression and pot gates pass, so this is isolated as browser event/logging vs engine-state evidence until repro proves otherwise. | P1 | `npx playwright test tests/e2e/badugi-flow.spec.ts --project=badugi-flow` failed 3/17 on 2026-05-16 | Audit fold event emission, handId filtering, and E2E log collection before release. |
| `TEST-GAP-ALPHA-01` | Test coverage | Closed for the immediate Badugi P0 class: browser pot continuity, snapshot pot merge, stale turn merge, no-next-alive, Badugi release-spec docs, and focused progression rule tests now exist. | P2 | `docs/testing/MGX_ALPHA_TEST_COVERAGE_GAP_AUDIT.md`; `docs/testing/MGX_BADUGI_TEST_COVERAGE_AUDIT.md` | Remaining gap is real-device mobile/manual QA plus Badugi long-run expected-fail removal. |
| `PREVIEW-DEPLOY-01` | Deploy readiness | Preview deploy updated to `f121d732dd0a1debf699eb43699484e06d0a5c1d`, including the mobile gameplay overflow fix. Physical mobile QA remains pending. | P2 | `docs/deploy/MGX_ALPHA_PREVIEW_DEPLOY_CHECK.md`; `docs/alpha/MGX_ALPHA_POST_DEPLOY_BROWSER_SMOKE.md` | Keep current preview live for D02/S01/S02 QA; do not widen friend alpha until physical device QA passes. |
| `PREVIEW-DEPLOY-02` | Remote sync | Source/mobile-fix commits are present on the tracked remote branch, but this shell still cannot push new docs because HTTPS credentials are unavailable and `gh`/SSH key are not configured. | P1 | `docs/deploy/MGX_ALPHA_REMOTE_SYNC_STATUS.md` | Push final-gate docs from a credentialed environment. Do not expose tokens in logs. |
| `ALPHA-SCOPE-01` | Variant availability | Friend alpha variant gate is now required: D02/S01/S02 playable, Badugi/board/stud/dramaha preview-only, Chinese/OFC coming soon. | P1 | `docs/alpha/MGX_ALPHA_VARIANT_AVAILABILITY_AUDIT.md`; `docs/alpha/MGX_ALPHA_FRIEND_LAUNCH_SCOPE.md` | Keep gate enabled until each variant clears its blocker list. |
| `ALPHA-MOBILE-01` | Mobile gameplay layout | Fixed, deployed, and covered in emulation: D02/S01/S02 controls fit 390x844, 430x932, and 844x390, with one-hand result reachability on 390x844. | P2 | `docs/alpha/MGX_ALPHA_PLAYABLE_MOBILE_EMULATION_SMOKE.md`; `tests/e2e/alpha-playable-variants-smoke.spec.ts`; `tests/e2e/alpha-mobile-gameplay-layout.spec.ts` PASS | Keep monitoring during physical mobile QA. |
| `TD-ALPHA-01` | Triple Draw actor order | Audited/fixed: D02/S01/S02/D01 mapping is correct; 6max/5max/3way pre-draw starts left of BB, not BB. Heads-up blind/button semantics were corrected so pre-draw starts BTN/SB and post-draw starts BB. | P2 | `docs/rules/MGX_TRIPLE_DRAW_BETTING_ORDER_SPEC.md`; `src/games/draw/__tests__/tripleDrawFirstActorRegression.test.js`; `tests/e2e/triple-draw-first-actor-mobile.spec.ts` PASS | Keep in alpha gate and monitor real-device QA. |
| `TD-ALPHA-02` | Triple Draw mobile readability | Improved: D02/S01/S02 mobile card strips, pot badge, and compact player panels pass 390x844, 430x932, and 844x390 visual E2E. | P2 | `tests/e2e/triple-draw-mobile-layout-visual.spec.ts` PASS; screenshots under `reports/screenshots/` | Keep physical-device readability check before friend alpha. |
| `27TD-PROG-001` | 2-7 Triple Draw release audit | Step2 audit found that D01 mapping/evaluator/non-all-in progression pass, but an all-in seat can still be elected as a draw actor after no-next-alive betting closure. The Step2 spec says all-in players skip draw. | P1 | `docs/rules/MGX_2_7TD_GAME_PROGRESSION_SPEC.md`; `src/games/draw/__tests__/twoSevenTDProgressionSpec.test.js` expected-fail | Decide whether MGX should enforce all-in draw skip for D01; if yes, update `transitionToDraw`/draw eligibility and convert the expected-fail test to normal pass. |
| `27TD-PROG-002` | 2-7 Triple Draw release evidence | D01 has focused rule, evaluator, pot, snapshot, and browser progression coverage, but still lacks a D01-specific multi-hand all-in side-pot release gate. | P2 | `docs/testing/MGX_2_7TD_TEST_COVERAGE_AUDIT.md`; `tests/e2e/two-seven-td-progression-spec.spec.ts` | Add a D01 all-in/side-pot browser gate before considering D01 alpha exposure. |
| `PV90-16` | Badugi E2E fixture | Full 3-draw E2E is green again, but still depends on preview launch gating and should stay in the alpha gate. | P2 | `tests/e2e/badugi-flow.spec.ts` PASS | Keep fixed-stack/no-all-in coverage on the deploy checklist. |
| `DRAW-NAT-01` | Draw UI E2E | Natural Draw#1-#3 UI path reaches result locally and on the deployed preview desktop smoke. Mobile full-hand gameplay is still pending. | P2 | `tests/e2e/badugi-flow.spec.ts`; `tests/e2e/badugi-full-round-pot-regression.spec.ts`; `docs/alpha/MGX_BADUGI_ALPHA_AVAILABILITY_DECISION.md` | Keep Badugi `preview_only` until mobile full-hand QA passes. |
| `HIST-REG-06` | History / Replay | Chinese/OFC history/replay smoke is separate from the 35 betting/draw variants and remains incomplete. | P3 | `docs/badugi_rl_and_variant_status.md` | Add CP1/OFC handId/action/result/replay frame smoke. |
| `FB-REG-06-MANUAL` | Feedback | Feedback variant separation and replay links are unit-tested; real OpenAI-key manual quality check is still pending. | P3 | `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md` | Run production-like 30+ hand feedback checks per variant. |
| `CHINESE-03` | Chinese / OFC | CP1 controller smoke passes, but OFC street-by-street and fantasyland are not fully playable/verified. | P3 | `docs/testing/MGX_VARIANT_FAMILY_COVERAGE_REPORT.md` | Implement/verify OFC street progression and fantasyland. |
| `CAP-NAT-01` | Fixed-limit cap | FLH/FLO8/Stud cap UI E2E passes; CPU-natural cap long-run smoke remains open. | P3 | `docs/badugi_rl_and_variant_status.md` | Add long-run CPU cap arrival and post-cap continuation smoke. |
| `BG-005` | Mobile manual QA | Playwright mobile emulation and deployed browser smoke pass for alpha scope. Physical device QA remains incomplete, so friend alpha is still HOLD. | P1 | `docs/alpha/MGX_ALPHA_PHYSICAL_MOBILE_QA_CHECKLIST.md`; `docs/alpha/MGX_ALPHA_PHYSICAL_MOBILE_QA_RESULT.md`; `docs/alpha/MGX_FRIEND_ALPHA_GO_NO_GO.md` | Run real Android/iOS QA before external friend alpha. |

## Quantitative Snapshot

| Area | Current Estimate | Basis | Main Gap |
|---|---:|---|---|
| Game implementation | 84% | 36 variants are reachable/playable enough for one-hand controller tests; Chinese/OFC and special/mixed polish remain. | OFC/fantasyland, Dramaha/split result UX depth. |
| Progression guarantee | 84% | Controller, one-hand, EV, safety gates, and targeted Badugi browser full-flow regressions pass. | Manual preview/mobile QA and broader long-run browser coverage. |
| UI/UX completion | 68% | Core table UI improved, mobile landscape exists, Stud up/down and HUD improved. | Friend/manual polish, result clarity for split games, real phone QA. |
| History/replay | 86% | 35 playable variants have replay smoke; feedback replay links are covered. | Chinese/OFC replay and richer frame semantics. |
| Feedback pipeline | 70% | Variant selection, 30-hand gate, replay links are tested. | Real OpenAI-key output quality and latency checks. |
| RL safety | 82% | 96-dim gates, transition validator, EV reward guard, clean-dataset requirement exist. | Backend full pytest and real hand-history EV gates. |
| RL strength | 58% | 10-Game Beginner/Standard routing and entrypoints exist. | Long-run training/evaluation, Pro/Iron/WorldMaster promotion gates. |

## Historical Archive

The old entries that previously lived here are no longer considered active blockers:

- SB fold did not hand turn to BB/UTG.
- Stale `metadata.actingPlayerIndex` overrode the real actor.
- All-in seats were selected for betting action.
- Draw round / hand rollback after card exchange.
- Single-pot results rendered fake side-pot blocks.
- Result overlay blocked next-hand controls.

Regression coverage for these is tracked in `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md`.
