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
| `npm run test:game:one-hand` | PASS | 2 files, 53 tests passed |
| `npm run test:game:progress` | PASS | 9 files, 127 tests passed, 11 skipped with explicit reasons |

## Family Summary

| Family | Variants Found | Tested | Skipped | Failed | Main Gaps |
|---|---:|---:|---:|---:|---|
| DRAW | 14 | 14 | 0 | 0 | UI 5-hand and split-component result clarity remain separate from one-hand controller guarantee |
| STUD | 6 | 6 | 0 | 0 | UI-level repeated street/call/raise E2E remains separate |
| FLOP_HOLDEM | 4 | 4 | 0 | 0 | CAP-REG-05 covers FLH cap UI; BB-option/natural cap long-run still useful |
| FLOP_OMAHA | 5 | 5 | 0 | 0 | B07 Big-O is currently high-only in catalog; hi/lo expectation needs product/config decision |
| SPLIT_POT | 9 | 9 | 0 | 0 | Component-pot / odd-chip UI clarity still needs E2E assertions |
| SPECIAL | 8 | 8 | 0 | 0 | Dramaha result UI E2E covers High/Board half + Draw half component display; CPU discard strategy and official odd-chip documentation remain |
| MIXED | 0 | 2 mode rotations | 1 | 0 | 8Game/10Game rotation boundaries covered by MIX-PROG-05; H.O.R.S.E./Dealer's Choice still mode-level gaps |
| CHINESE/OFC | 1 | 1 | 0 | 0 | CP1 classic set/result/next-hand covered; OFC street-by-street/fantasyland remains |

## One-Hand Progression Guarantee Summary

| Total Variants | Runnable | Passed | Failed | Skipped | Notes |
|---:|---:|---:|---:|---:|---|
| 36 | 36 | 36 | 0 | 0 | `allVariantsOneHandProgression.test.js` drives every catalog variant through the real controller/action path with seed `20260506` |

## Added Files

| File | Purpose | Notes |
|---|---|---|
| `src/games/testing/scenario/runVariantFamilyScenario.js` | Family-aware wrapper around existing progress scenario runner | Reuses registry and explicit skip reasons |
| `src/games/testing/scenario/studFamilyProgress.test.js` | Stud/Razz family progression add-on | ante, bring-in, street, all-in, evaluator routing |
| `src/games/testing/scenario/flopFamilyProgress.test.js` | Hold'em/Omaha family progression add-on | blinds, street progression, all-in, Omaha 2-hole rule, split smoke |
| `src/games/testing/scenario/drawFamilyProgress.test.js` | Draw/lowball/split-draw family add-on | draw count, A-5 vs 2-7 evaluator, Badeucey/Badacey component result |
| `src/games/testing/scenario/mixedSpecialFamilyProgress.test.js` | Mixed/Special tracking add-on | prevents false “all family covered” claim for mode-level mixed games |
| `src/games/testing/scenario/chineseFamilyProgress.test.js` | Chinese/OFC family progress add-on | Covers CP1 set, showdown result, next-hand reset, and hidden opponent hand |
| `src/games/testing/scenario/safeActionPolicy.js` | Deterministic safe action selector | CHECK/CALL/PAT-first policy for terminal progression, not strategy quality |
| `src/games/testing/scenario/runOneHandProgression.js` | One-hand controller progression harness | Enumerates catalog variants, maps family, runs invariants at every step |
| `src/games/testing/scenario/allVariantsOneHandProgression.test.js` | All-variant one-hand guarantee | 36 catalog variants, PASS/FAIL/SKIP summary |
| `src/games/testing/scenario/familyOneHandProgression.test.js` | Family representative one-hand guarantee | Ensures each family has a real controller-path terminal test |
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
| MIX-PROG-05 | MIXED | PASS | 8Game 40 boundaries and 10Game 50 boundaries preserve variantId / seat / dealer button / stack+pot total |
| SPECIAL-001 | SPECIAL | PASS | Super Hold'em and Dramaha family smoke |
| DRAMAHA-RESULT-001 | SPECIAL/SPLIT_POT | PASS | `dramaha_hi` Playwright smoke reaches result overlay and verifies High/Board half, Draw half, and component pot DOM |
| CHINESE-001 | CHINESE/OFC | PASS | CP1 set/result/next-hand controller path |
| ONEHAND-001 | ALL | PASS | 36/36 catalog variants complete one controller-path hand |
| ONEHAND-FAMILY-001 | ALL families | PASS | DRAW/STUD/FLOP/SPLIT/SPECIAL/CHINESE representatives complete one hand |

## Stud Findings

| Finding | Status | Notes |
|---|---|---|
| New Vitest-level Stud progression failures | None detected | Added tests passed for ST1-ST6 |
| UI-only Stud/Razz street actions | Covered | `stud-street-progression.spec.ts` now drives Stud/Razz through two consecutive hands using visible Hero buttons only; full spec passes 6/6 |
| 7th-street down-card clarity | Covered | `Player` unit and `stud-street-progression.spec.ts` now assert `VISIBLE` / `HOLE` / `7TH DOWN`, Visible/Down seat summaries, and Stud/Razz 7th street UI before showdown |

## Skips / Unhandled

| Area | Reason | Next Action |
|---|---|---|
| MIXED family | H.O.R.S.E./Dealer's Choice are mode-level rotations, not variant registry entries | Reuse MIX-PROG-05 runner for H.O.R.S.E. fixed rotation and weighted Dealer's Choice smoke |
| CP1 Chinese/OFC OFC mode | Current CP1 coverage is classic 13-card set, not OFC street-by-street | Add OFC 5-card open, one-card placement, fantasyland, and history/replay smoke |
| B07 Big-O split expectation | Current catalog does not mark Big-O as hi/lo | Decide whether product requires Big-O hi/lo, then update evaluator/config/tests |
