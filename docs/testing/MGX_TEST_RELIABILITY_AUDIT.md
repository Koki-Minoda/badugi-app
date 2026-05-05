# MGX Test Reliability Audit

Last updated: 2026-05-06

This audit checks whether the current MGX progress, regression, and E2E tests can actually detect game-progress bugs. It does not replace existing tests. Weak points were strengthened only where the fix was small and did not require production-code changes.

## Scope

| Item | Count / Scope | Notes |
|---|---:|---|
| All discovered test/spec files under `src` and `tests` | 146 | Inventory from `find src tests -type f \( -name "*.test.*" -o -name "*.spec.*" \)` |
| Progress-focused files audited in detail | 23 | `src/games/testing/**` plus `tests/e2e/**` |
| Required progress scripts checked | 3 | `test:game:known-bugs`, `test:game:progress`, `test:e2e:progress` |
| Full Vitest suite checked | 1 | `npm test` |

## Test Inventory

| Test File | Test Count | Main Area | Coverage | Notes |
|---|---:|---|---|---|
| `src/games/testing/regression/gameProgressKnownBugs.test.js` | 18 | ACTION / ALLIN / DRAW / MTT regressions | PARTIAL | Strong negative invariant fixtures; some ACTION positives are synthetic state checks. |
| `src/games/testing/scenario/allVariantsProgressSmoke.test.js` | 43 | Variant registry smoke | BROAD/PARTIAL | Covers registered variants through harness where supported; 12 explicit skips remain. |
| `tests/e2e/mgx-game-progress.spec.js` | 5 | Cash, Badugi draw, PLO result, tournament, mobile action UI | PARTIAL | Strengthened this audit to require real action execution and pot result evidence. |
| `tests/e2e/badugi-flow.spec.ts` | 33 | Badugi UI/game flow | BADUGI_ONLY | Broad Badugi scenarios, but some older assertions are still shallow. |
| `tests/e2e/badugi-mtt-flow.spec.ts` | 3 | Badugi tournament flow | BADUGI_ONLY | Useful smoke, but reseat/table merge depth remains limited. |
| `tests/e2e/cross-variant-five-hand-smoke.spec.ts` | 2 | Cross-variant 5-hand UI smoke | BROAD | Good operational signal; still mostly UI progression, not pot correctness. |
| `tests/e2e/cross-variant-fold-recovery.spec.ts` | 1 | Fold recovery across variants | BROAD/PARTIAL | Important regression target; needs all-in/fold matrix expansion. |
| `tests/e2e/cross-variant-history-replay-smoke.spec.ts` | 1 | History/replay smoke | BROAD/PARTIAL | Ensures link exists, but not complete result audit. |
| `tests/e2e/cross-variant-operational-smoke.spec.ts` | 3 | Operational UI smoke | BROAD/PARTIAL | Detects major freezes; not enough for variant-specific rules. |
| `tests/e2e/dramaha-draw-action.spec.ts` | 1 | Dramaha draw UI | PARTIAL | Single scenario; one shallow assertion pattern remains. |
| `tests/e2e/draw-lowball-app-smoke.spec.ts` | 2 | 2-7/A-5 app smoke | PARTIAL | Useful for draw games; not full 5-hand coverage. |
| `tests/e2e/friend-publish-candidate-regression.spec.ts` | 6 | Friend/publish candidate regression | PARTIAL | UI-oriented, not full multiplayer correctness. |
| `tests/e2e/game-ui-layout-smoke.spec.ts` | 3 | Desktop game layout | PARTIAL | Visual regression signal only. |
| `tests/e2e/history-mobile-smoke.spec.ts` | 1 | Mobile history | PARTIAL | Smoke only. |
| `tests/e2e/main-menu-history-smoke.spec.ts` | 2 | Menu/history navigation | PARTIAL | Navigation signal only. |
| `tests/e2e/mixed-rotation-core-progression.spec.ts` | 2 | Mixed rotation progression | PARTIAL | Rotation smoke; not every game rule. |
| `tests/e2e/mobile-app-smoke.spec.ts` | 2 | Mobile app shell | PARTIAL | Viewport/action availability only. |
| `tests/e2e/p2p-friend-match-real-ws.spec.ts` | 1 | Real WS P2P | PARTIAL | Important integration test, environment-sensitive. |
| `tests/e2e/p2p-friend-match-smoke.spec.ts` | 5 | P2P smoke | PARTIAL | Smoke-level. |
| `tests/e2e/responsive-layout-separation.spec.ts` | 2 | PC/mobile layout separation | PARTIAL | Layout only. |
| `tests/e2e/stud-street-progression.spec.ts` | 3 | Stud street progression | PARTIAL | Needs stronger bring-in/complete/7th street action-path coverage. |
| `tests/e2e/tournament-ui-layout-smoke.spec.ts` | 3 | Tournament layout | PARTIAL | UI-only; not enough for MTT progression correctness. |

## Test Quality Audit

| Test ID/File | Assertion Quality | Regression Fidelity | Coverage Validity | False Positive Risk | Flaky Risk | Verdict | Notes |
|---|---|---|---|---|---|---|---|
| `ACTION-001` | MEDIUM | MEDIUM | PARTIAL | MEDIUM | LOW | NEEDS_STRENGTHENING | Validates BB option state, but does not mutate the real next-actor selector. |
| `ACTION-002` | MEDIUM | MEDIUM | PARTIAL | MEDIUM | LOW | NEEDS_STRENGTHENING | Same limitation as ACTION-001; useful guard but not enough alone. |
| `ACTION-003` | MEDIUM | MEDIUM | PARTIAL | MEDIUM | MEDIUM | NEEDS_STRENGTHENING | E2E checks decision panel; should later assert exact legal buttons by phase. |
| `ACTION-004` | MEDIUM | MEDIUM | PARTIAL | MEDIUM | LOW | NEEDS_STRENGTHENING | Covers stale metadata shape, not a full controller path mutation. |
| `ACTION-005` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | Negative fixture detects folded actor regressions. |
| `ACTION-006` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | Negative fixture detects eligible-player/no-actor freeze states. |
| `ACTION-007` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | Negative fixture detects duplicate UI turn flags. |
| `ALLIN-001` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | Negative fixture proves all-in betting-turn bug is detected. |
| `ALLIN-002` | MEDIUM | MEDIUM | PARTIAL | MEDIUM | LOW | NEEDS_STRENGTHENING | Terminal state is checked, but heads-up all-in path is still fixture-based. |
| `ALLIN-003` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | PLO scenario runner checks freeze-free multiway all-in progression. |
| `DRAW-001` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | Runs draw full-cycle scenario and invariants. |
| `DRAW-002` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | CPU draw auto-resolve path is scenario-tested. |
| `DRAW-003` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | Negative fixture detects already-drawn actor. |
| `DRAW-004` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | Negative fixture detects invalid hand size after draw. |
| `MTT-001` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | Negative fixture detects busted player turn. |
| `MTT-002` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | Detects empty active tournament table state. |
| `MTT-003` | STRONG | HIGH | PARTIAL | LOW | LOW | TRUSTED | Detects duplicate playerId after reseat/merge. |
| `MTT-004` | MEDIUM | MEDIUM | PARTIAL | MEDIUM | LOW | NEEDS_STRENGTHENING | Valid terminal fixture only; needs full MTT terminal E2E. |
| `allVariantsProgressSmoke.test.js` | MEDIUM | MEDIUM | BROAD/PARTIAL | MEDIUM | LOW | NEEDS_STRENGTHENING | Good broad harness, but 12 variants skipped and some harnesses are simplified. |
| `mgx-game-progress.spec.js` | MEDIUM | MEDIUM | PARTIAL | MEDIUM | MEDIUM | NEEDS_STRENGTHENING | Strengthened PLO action/result assertions; still uses E2E helper for speed. |
| Older E2E smoke files | MEDIUM | LOW/MEDIUM | PARTIAL | MEDIUM | MEDIUM | NEEDS_STRENGTHENING | Useful operational signal, but several are smoke-first and not full rule audits. |

## Mutation Verification

No permanent production-code mutation was committed. Where possible, negative invariant fixtures were used as mutation-style checks. Real temporary source mutations for next-actor and phase-transition internals remain a separate follow-up because they require carefully patching and reverting production controller code.

| Mutation | Expected Failing Tests | Actual Result | Verdict | Notes |
|---|---|---|---|---|
| All-in player is selected for betting turn | `ALLIN-001` | Invariant throws | DETECTED | Covered by negative fixture. |
| Folded player is selected for turn | `ACTION-005` | Invariant throws | DETECTED | Added during bugfix sweep. |
| Eligible players exist with no actor | `ACTION-006` | Invariant throws | DETECTED | Added during bugfix sweep. |
| Multiple seats expose `isTurn=true` | `ACTION-007` | Invariant throws | DETECTED | Added during bugfix sweep. |
| Already-drawn player receives draw turn | `DRAW-003` | Invariant throws | DETECTED | Covered by negative fixture. |
| Draw hand size drifts below configured size | `DRAW-004` | Invariant throws | DETECTED | Covered by negative fixture. |
| Busted player remains current actor | `MTT-001` | Invariant throws | DETECTED | Covered by negative fixture. |
| Tournament has zero active players while nonterminal | `MTT-002` | Invariant throws | DETECTED | Covered by negative fixture. |
| Reseat/table merge duplicates playerId | `MTT-003` | Invariant throws | DETECTED | Covered by negative fixture. |
| Next actor selector skips BB option | `ACTION-001`, `ACTION-002` | Not source-mutated | NOT_RUN | Positive fixture exists, but real selector mutation was not applied. |
| Stale metadata is preferred over valid turn | `ACTION-004` | Not source-mutated | NOT_RUN | Fixture covers shape; controller mutation still needed. |
| Draw count is decremented in production config | `DRAW-001` | Not source-mutated | NOT_RUN | Full-cycle scenario exists; no temporary source mutation run. |
| CPU draw auto-resolve disabled | `DRAW-002` | Not source-mutated | NOT_RUN | Scenario currently passes; mutation not applied. |
| All-in phase transition is stopped | `ALLIN-002`, `ALLIN-003` | Not source-mutated | NOT_RUN | Scenario would catch freeze in common path; no source mutation run. |

## Weak Tests Fixed

| Test | Issue | Fix | Verification |
|---|---|---|---|
| `tests/e2e/mgx-game-progress.spec.js` PLO action/result | `toBeTruthy` could pass with shallow helper success and no result evidence | `forceCurrentControllerAction` now returns actual helper result; test asserts state diff, accepted terminal/progress phases, and non-empty pot summary | `npm run test:e2e:progress` passed |
| `src/games/testing/regression/gameProgressKnownBugs.test.js` ACTION coverage | ACTION regressions had positive fixtures but lacked negative detection for folded/no-actor/duplicate-turn states | Added `ACTION-005`, `ACTION-006`, and `ACTION-007` negative fixtures | `npm run test:game:known-bugs` passed |
| `src/games/testing/scenario/allVariantsProgressSmoke.test.js` skipped variants | Skip reason was logged separately but not visible in test title | Skip test title now includes `[skip: ...]` | `npm run test:game:progress` passed |
| `src/ui/components/__tests__/VariantSelectModal.test.jsx` Badugi selector | Full suite failed because selector matched both Badugi and Badugi Single Draw | Selector now chooses exact Badugi button and asserts it exists | `npm test` passed |

## Command Results

| Command | Result | Notes |
|---|---|---|
| `npm run test:game:known-bugs` | PASS | 1 file, 18 tests passed |
| `npm run test:game:progress` | PASS | 2 files, 44 tests passed, 12 skipped with explicit reasons |
| `npm run test:e2e:progress` | PASS | 5 Playwright tests passed after strengthening PLO assertions |
| `npm test` | PASS | 126 files passed; 849 tests passed, 12 skipped |

## Remaining Risks

| Risk | Impact | Suggested Next Action |
|---|---|---|
| ACTION positive tests are still mostly synthetic | Real next-actor selector could regress while some fixtures still pass | Add temporary mutation verification or controller-path fixtures for SB fold / BB option. |
| 12 variant progress harness skips remain | Broad coverage can be overestimated | Add harness adapters or E2E substitutes for skipped variants, especially Chinese/OFC and legacy Badugi. |
| Some older E2E tests remain smoke-oriented | UI can exist while game state is wrong | Convert high-risk smoke tests to assert actor, phase, pot, stack, hand count, and result. |
| Tournament reseat/table merge is not deeply E2E-covered | MTT bugs may still reach production | Add deterministic MTT bust/merge/winner E2E with seed and state assertions. |
| Heavy deck/debug logging makes failures noisy | Real failure signal can be buried | Gate debug logs behind env flag during test runs. |
| E2E helper-forced actions are faster but less human-faithful | Some button wiring bugs may be missed | Pair helper tests with UI-click-only tests for representative variants. |
| Stud/Razz progression remains rule-sensitive | Bring-in/complete/7th street regressions may slip | Add per-street actor/order assertions and 5-hand Stud/Razz E2E loops. |

## Summary Counts

| Verdict | Count |
|---|---:|
| TRUSTED | 12 |
| NEEDS_STRENGTHENING | 9 |
| WEAK | 0 |
| INVALID | 0 |

| Mutation Verdict | Count |
|---|---:|
| DETECTED | 9 |
| NOT_DETECTED | 0 |
| NOT_RUN | 5 |
