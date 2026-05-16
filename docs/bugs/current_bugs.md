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
| `BADUGI-ALPHA-01` | Badugi browser progression | Alpha audit reproduced a full 3-draw browser stall: `Hand Result` never appears and phase labels disagree (`DRAW#1` vs `BET · Draw 1` vs `BET`). | P0 | `docs/bugs/MGX_BADUGI_ROUND_POT_REGRESSION_AUDIT.md`; `tests/e2e/badugi-flow.spec.ts` full 3-draw regression | Fix betting closure / draw transition / stale actor path, then rerun the targeted Playwright regression. |
| `BADUGI-ALPHA-02` | Badugi pot display | Alpha audit reproduced active-hand `Total Pot 0` while stacks had already changed, suggesting pot carry-forward or UI snapshot merge loss. | P0 | `reports/alpha/pot-disappearance-audit.json`; failing Playwright screenshot | Add pot continuity regression and fix engine/UI pot source-of-truth loss. |
| `BADUGI-ALPHA-03` | Badugi actor election | Partial `badugi-flow` run failed the no-next-alive regression and showed Hero still `ACTING` after visible `[Check]`. | P1 | `reports/alpha/badugi-round-progression-audit.json` | Narrow next actor election after folds/checks and stale metadata priority. |
| `TEST-GAP-ALPHA-01` | Test coverage | Unit/controller/EV tests pass while browser full-flow pot/phase regression fails; phase-by-phase visible pot and stale actor assertions are missing. | P1 | `docs/testing/MGX_ALPHA_TEST_COVERAGE_GAP_AUDIT.md` | Add browser and snapshot-merge tests before fixing broad behavior. |
| `PREVIEW-DEPLOY-01` | Deploy readiness | Preview deploy was skipped because the worktree contains untracked Step59-65 RL alpha files. | P1 | `docs/deploy/MGX_ALPHA_PREVIEW_DEPLOY_CHECK.md` | Commit/stash unrelated files and deploy only from a clean worktree after Badugi blockers are addressed. |
| `ALPHA-SCOPE-01` | Variant availability | Friend alpha variant gate is now required: D02/S01/S02 playable, Badugi/board/stud/dramaha preview-only, Chinese/OFC coming soon. | P1 | `docs/alpha/MGX_ALPHA_VARIANT_AVAILABILITY_AUDIT.md`; `docs/alpha/MGX_ALPHA_FRIEND_LAUNCH_SCOPE.md` | Keep gate enabled until each variant clears its blocker list. |
| `PV90-16` | Badugi E2E fixture | Full 3-draw E2E still needs a no-all-in deterministic fixture; current progression E2E now fails in alpha hardening. | P1 | `docs/testing/MGX_ALPHA_LATEST_SNAPSHOT_BASELINE.md` | Build fixed-stack/no-all-in full draw UI path and keep it in the alpha gate. |
| `DRAW-NAT-01` | Draw UI E2E | Natural Draw#1-#3 UI path without test hook is not guaranteed and currently fails before hand result in browser QA. | P1 | `docs/bugs/MGX_BADUGI_ROUND_POT_REGRESSION_AUDIT.md` | Add/fix long UI smoke that reaches all draw rounds naturally. |
| `HIST-REG-06` | History / Replay | Chinese/OFC history/replay smoke is separate from the 35 betting/draw variants and remains incomplete. | P3 | `docs/badugi_rl_and_variant_status.md` | Add CP1/OFC handId/action/result/replay frame smoke. |
| `FB-REG-06-MANUAL` | Feedback | Feedback variant separation and replay links are unit-tested; real OpenAI-key manual quality check is still pending. | P3 | `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md` | Run production-like 30+ hand feedback checks per variant. |
| `CHINESE-03` | Chinese / OFC | CP1 controller smoke passes, but OFC street-by-street and fantasyland are not fully playable/verified. | P3 | `docs/testing/MGX_VARIANT_FAMILY_COVERAGE_REPORT.md` | Implement/verify OFC street progression and fantasyland. |
| `CAP-NAT-01` | Fixed-limit cap | FLH/FLO8/Stud cap UI E2E passes; CPU-natural cap long-run smoke remains open. | P3 | `docs/badugi_rl_and_variant_status.md` | Add long-run CPU cap arrival and post-cap continuation smoke. |
| `BG-005` | Mobile manual QA | Playwright mobile landscape coverage exists, but real device touch/orientation/next-hand inventory is incomplete and has not been rerun against the alpha blocker snapshot. | P1 | `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md`; `docs/alpha/MGX_ALPHA_PRODUCT_HARDENING_READINESS.md` | Add real-device QA checklist after Badugi pot/round blocker is fixed. |

## Quantitative Snapshot

| Area | Current Estimate | Basis | Main Gap |
|---|---:|---|---|
| Game implementation | 84% | 36 variants are reachable/playable enough for one-hand controller tests; Chinese/OFC and special/mixed polish remain. | OFC/fantasyland, Dramaha/split result UX depth. |
| Progression guarantee | 78% | Controller, one-hand, EV, and safety gates pass, but Badugi browser full 3-draw regression is currently failing. | Badugi full browser path, visible pot continuity, and no-next-alive actor election. |
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
