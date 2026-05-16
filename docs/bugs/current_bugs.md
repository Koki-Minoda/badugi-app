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
| `BADUGI-ALPHA-01` | Badugi browser progression | Fixed in the alpha hardening sprint: full 3-draw browser flow now reaches `Hand Result` with the preview flag enabled. Keep as monitor until manual preview QA. | P2 | `tests/e2e/badugi-flow.spec.ts` full 3-draw regression PASS | Keep Badugi `preview_only` until manual browser/mobile QA confirms the fix outside CI. |
| `BADUGI-ALPHA-02` | Badugi pot display | Fixed: active-hand pot now falls back to controller `totalInvested` when street bets reset and explicit pots are not present. | P2 | `src/ui/__tests__/badugiPotSnapshotMerge.test.jsx`; `tests/e2e/badugi-full-round-pot-regression.spec.ts` PASS | Monitor in preview deploy; do not promote Badugi to friend-alpha playable yet. |
| `BADUGI-ALPHA-03` | Badugi actor election | Fixed/covered: canonical controller `nextTurn` wins over stale metadata and no-next-alive path transitions instead of re-electing checked Hero. | P2 | `src/ui/__tests__/badugiTurnSnapshotMerge.test.jsx`; `src/games/badugi/__tests__/badugiNoNextAliveRegression.test.js` PASS | Keep regression in alpha gate. |
| `TEST-GAP-ALPHA-01` | Test coverage | Closed for the immediate Badugi P0 class: browser pot continuity, snapshot pot merge, stale turn merge, and no-next-alive regressions now have tests. | P2 | `docs/testing/MGX_ALPHA_TEST_COVERAGE_GAP_AUDIT.md` | Remaining gap is real-device mobile/manual QA. |
| `PREVIEW-DEPLOY-01` | Deploy readiness | Preview deploy completed from a clean snapshot after stashing unrelated Step59-65 files. Remaining risk is branch not pushed and physical mobile QA pending. | P2 | `docs/deploy/MGX_ALPHA_PREVIEW_DEPLOY_CHECK.md` | Push or otherwise preserve the deployed commits before wider sharing. |
| `PREVIEW-DEPLOY-02` | Remote sync | Local branch is ahead of origin and HTTPS dry-run push is blocked by missing credentials; `gh` CLI is not installed in this environment. | P1 | `docs/deploy/MGX_ALPHA_REMOTE_SYNC_STATUS.md` | Configure GitHub CLI, SSH, or a credential helper outside logs, then push the deployed commits. |
| `ALPHA-SCOPE-01` | Variant availability | Friend alpha variant gate is now required: D02/S01/S02 playable, Badugi/board/stud/dramaha preview-only, Chinese/OFC coming soon. | P1 | `docs/alpha/MGX_ALPHA_VARIANT_AVAILABILITY_AUDIT.md`; `docs/alpha/MGX_ALPHA_FRIEND_LAUNCH_SCOPE.md` | Keep gate enabled until each variant clears its blocker list. |
| `ALPHA-MOBILE-01` | Mobile gameplay layout | D02/S01/S02 desktop smoke passes, but mobile emulation shows the gameplay action row overflowing narrow viewports. | P1 | `docs/alpha/MGX_ALPHA_PLAYABLE_MOBILE_EMULATION_SMOKE.md`; `tests/e2e/alpha-playable-variants-smoke.spec.ts` mobile checks marked `fixme` | Fix/verify action controls on 390px-class portrait view before external friend alpha. |
| `PV90-16` | Badugi E2E fixture | Full 3-draw E2E is green again, but still depends on preview launch gating and should stay in the alpha gate. | P2 | `tests/e2e/badugi-flow.spec.ts` PASS | Keep fixed-stack/no-all-in coverage on the deploy checklist. |
| `DRAW-NAT-01` | Draw UI E2E | Natural Draw#1-#3 UI path reaches result locally and on the deployed preview desktop smoke. Mobile full-hand gameplay is still pending. | P2 | `tests/e2e/badugi-flow.spec.ts`; `tests/e2e/badugi-full-round-pot-regression.spec.ts`; `docs/alpha/MGX_BADUGI_ALPHA_AVAILABILITY_DECISION.md` | Keep Badugi `preview_only` until mobile full-hand QA passes. |
| `HIST-REG-06` | History / Replay | Chinese/OFC history/replay smoke is separate from the 35 betting/draw variants and remains incomplete. | P3 | `docs/badugi_rl_and_variant_status.md` | Add CP1/OFC handId/action/result/replay frame smoke. |
| `FB-REG-06-MANUAL` | Feedback | Feedback variant separation and replay links are unit-tested; real OpenAI-key manual quality check is still pending. | P3 | `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md` | Run production-like 30+ hand feedback checks per variant. |
| `CHINESE-03` | Chinese / OFC | CP1 controller smoke passes, but OFC street-by-street and fantasyland are not fully playable/verified. | P3 | `docs/testing/MGX_VARIANT_FAMILY_COVERAGE_REPORT.md` | Implement/verify OFC street progression and fantasyland. |
| `CAP-NAT-01` | Fixed-limit cap | FLH/FLO8/Stud cap UI E2E passes; CPU-natural cap long-run smoke remains open. | P3 | `docs/badugi_rl_and_variant_status.md` | Add long-run CPU cap arrival and post-cap continuation smoke. |
| `BG-005` | Mobile manual QA | Chrome/Playwright mobile emulation passes for alpha variant gate and dashboard preview; D02/S01/S02 gameplay action overflow and physical device QA remain incomplete. | P1 | `docs/alpha/MGX_ALPHA_MOBILE_MANUAL_QA.md`; `docs/alpha/MGX_ALPHA_PHYSICAL_MOBILE_QA_CHECKLIST.md` | Run real Android/iOS QA and fix or confirm mobile action-control fit before external friend alpha. |

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
