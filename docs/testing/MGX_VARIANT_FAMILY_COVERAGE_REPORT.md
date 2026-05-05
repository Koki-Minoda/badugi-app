# MGX Variant Family Coverage Report

Last updated: 2026-05-06

## Command Results

| Command | Result | Notes |
|---|---|---|
| `npm run test:game:stud` | PASS | 1 file, 13 tests passed |
| `npm run test:game:flop` | PASS | 1 file, 5 tests passed |
| `npm run test:game:draw-family` | PASS | 1 file, 6 tests passed |
| `npm run test:game:family` | PASS | 5 files, 28 tests passed |
| `npm run test:game:chinese` | PASS | 1 file, 2 tests passed |
| `npm run test:game:progress` | PASS | 6 files, 71 tests passed, 12 skipped with explicit reasons |

## Family Summary

| Family | Variants Found | Tested | Skipped | Failed | Main Gaps |
|---|---:|---:|---:|---:|---|
| DRAW | 14 | 13 | 1 | 0 | D03 Badugi still uses App E2E rather than controller harness |
| STUD | 6 | 6 | 0 | 0 | UI-level repeated street/call/raise E2E remains separate |
| FLOP_HOLDEM | 4 | 4 | 0 | 0 | UI BB-option/cap path E2E should be expanded |
| FLOP_OMAHA | 5 | 5 | 0 | 0 | B07 Big-O is currently high-only in catalog; hi/lo expectation needs product/config decision |
| SPLIT_POT | 9 | 9 | 0 | 0 | Component-pot / odd-chip UI clarity still needs E2E assertions |
| SPECIAL | 8 | 8 | 0 | 0 | Dramaha result UI and board+draw explainability still need manual/E2E QA |
| MIXED | 0 | 0 | 1 | 0 | Mixed rotations are mode-level, not direct registry variants |
| CHINESE/OFC | 1 | 1 | 0 | 0 | CP1 classic set/result/next-hand covered; OFC street-by-street/fantasyland remains |

## Added Files

| File | Purpose | Notes |
|---|---|---|
| `src/games/testing/scenario/runVariantFamilyScenario.js` | Family-aware wrapper around existing progress scenario runner | Reuses registry and explicit skip reasons |
| `src/games/testing/scenario/studFamilyProgress.test.js` | Stud/Razz family progression add-on | ante, bring-in, street, all-in, evaluator routing |
| `src/games/testing/scenario/flopFamilyProgress.test.js` | Hold'em/Omaha family progression add-on | blinds, street progression, all-in, Omaha 2-hole rule, split smoke |
| `src/games/testing/scenario/drawFamilyProgress.test.js` | Draw/lowball/split-draw family add-on | draw count, A-5 vs 2-7 evaluator, Badeucey/Badacey component result |
| `src/games/testing/scenario/mixedSpecialFamilyProgress.test.js` | Mixed/Special tracking add-on | prevents false “all family covered” claim for mode-level mixed games |
| `src/games/testing/scenario/chineseFamilyProgress.test.js` | Chinese/OFC family progress add-on | Covers CP1 set, showdown result, next-hand reset, and hidden opponent hand |
| `docs/testing/MGX_VARIANT_FAMILY_COVERAGE_MATRIX.md` | Family coverage matrix | Tracks variants, family-level tests, gaps |
| `docs/testing/MGX_VARIANT_FAMILY_COVERAGE_REPORT.md` | Family execution report | Records command results and remaining gaps |

## Added Family Tests

| Test ID | Family | Result | Notes |
|---|---|---|---|
| STUD-001 | STUD | PASS | ST1-ST6 ante / bring-in posted and next actor valid |
| STUD-002 | STUD | PASS | ST1-ST6 street progression does not freeze |
| STUD-003 | STUD | PASS | Folded player is not dealt on later Stud streets |
| STUD-004 | STUD | PASS | Stud all-in reaches terminal/showdown path |
| STUD-005 | STUD | PASS | Razz / Stud8 / 2-7 Razz evaluator routing smoke |
| STUD-006 | STUD | PASS | Stud and Razz six-max smoke |
| FLOP-001 | FLOP_HOLDEM | PASS | Blinds and preflop actor are valid |
| FLOP-002 | FLOP_HOLDEM | PASS | Hold'em family progresses without freeze |
| FLOP-003 | FLOP_OMAHA | PASS | Omaha family all-in smoke |
| OMAHA-001 | FLOP_OMAHA | PASS | PLO evaluator uses exactly two hole cards |
| SPLIT-001 | SPLIT_POT | PASS | PLO8/FLO8 split smoke |
| DRAW-FAMILY-001 | DRAW | PASS | Draw count matches configured draw rounds |
| DRAW-FAMILY-002 | DRAW | PASS | A-5 and 2-7 lowball evaluators do not cross-wire |
| DRAW-FAMILY-003 | SPLIT_POT | PASS | Badeucey/Badacey split draw component result smoke |
| MIXED-001 | MIXED | PASS | Explicitly records mode-level rotation gap instead of false pass |
| SPECIAL-001 | SPECIAL | PASS | Super Hold'em and Dramaha family smoke |
| CHINESE-001 | CHINESE/OFC | PASS | CP1 set/result/next-hand controller path |

## Stud Findings

| Finding | Status | Notes |
|---|---|---|
| New Vitest-level Stud progression failures | None detected | Added tests passed for ST1-ST6 |
| Remaining risk: UI-only Stud/Razz street actions | Open | Existing manual reports around call/raise UI need Playwright expansion |
| Remaining risk: 7th-street down-card clarity | Open | UI representation is outside this family runner scope |

## Skips / Unhandled

| Area | Reason | Next Action |
|---|---|---|
| D03 Badugi controller harness | Existing App lifecycle is still the authoritative path for Badugi UI/MTT | Extract reusable Badugi controller fixture later |
| MIXED family | H.O.R.S.E./8-game/Dealer's Choice are mode-level rotations, not variant registry entries | Add rotation runner that starts a mixed mode and advances variants |
| CP1 Chinese/OFC OFC mode | Current CP1 coverage is classic 13-card set, not OFC street-by-street | Add OFC 5-card open, one-card placement, fantasyland, and history/replay smoke |
| B07 Big-O split expectation | Current catalog does not mark Big-O as hi/lo | Decide whether product requires Big-O hi/lo, then update evaluator/config/tests |
