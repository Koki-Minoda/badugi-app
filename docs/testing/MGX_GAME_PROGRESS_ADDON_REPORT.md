# MGX Game Progress Add-on Report

Last updated: 2026-05-06

## Added Files

| File | Purpose | Notes |
|---|---|---|
| `docs/testing/MGX_GAME_PROGRESS_QA_MATRIX.md` | Known bug / variant / manual QA matrix | Table-first tracking |
| `docs/testing/MGX_GAME_PROGRESS_ADDON_REPORT.md` | Implementation and test result report | Updated after command runs |
| `src/games/testing/progress/gameProgressInvariants.js` | Cross-cutting progress invariant checker | Turn, betting, draw, tournament |
| `src/games/testing/regression/gameProgressKnownBugs.test.js` | Known bug regression fixtures | ACTION / ALLIN / DRAW / MTT IDs |
| `src/games/testing/scenario/runProgressScenario.js` | Controller scenario runner | Board, Stud, Draw, Dramaha harnesses |
| `src/games/testing/scenario/runVariantFamilyScenario.js` | Family-aware scenario runner | Reuses existing progress scenario runner and skip reasons |
| `src/games/testing/scenario/allVariantsProgressSmoke.test.js` | Variant registry progress smoke | Skips unsupported variants with reason |
| `src/games/testing/scenario/studFamilyProgress.test.js` | Stud/Razz family add-on | ante, bring-in, streets, all-in, evaluator routing |
| `src/games/testing/scenario/flopFamilyProgress.test.js` | Hold'em/Omaha family add-on | blinds, streets, all-in, Omaha 2-hole rule |
| `src/games/testing/scenario/drawFamilyProgress.test.js` | Draw/lowball/split-draw family add-on | draw counts, A-5/2-7 evaluator separation, component result |
| `src/games/testing/scenario/mixedSpecialFamilyProgress.test.js` | Mixed/Special family add-on | rotation gap tracking and special variant smoke |
| `src/games/testing/scenario/safeActionPolicy.js` | Deterministic safe action policy | CHECK/CALL/PAT-first progression policy |
| `src/games/testing/scenario/runOneHandProgression.js` | One-hand controller progression harness | Enumerates catalog variants and runs real controller/action paths |
| `src/games/testing/scenario/allVariantsOneHandProgression.test.js` | All-variant one-hand guarantee | 36 variants must reach terminal state or explicit skip |
| `src/games/testing/scenario/familyOneHandProgression.test.js` | Family representative one-hand guarantee | Ensures each family has controller-path terminal coverage |
| `tests/e2e/mgx-game-progress.spec.js` | Minimal Playwright progress add-on | Cash, draw/pat, PLO, tournament, mobile |
| `docs/testing/MGX_VARIANT_FAMILY_COVERAGE_MATRIX.md` | Variant family coverage matrix | Tracks family-level coverage and gaps |
| `docs/testing/MGX_VARIANT_FAMILY_COVERAGE_REPORT.md` | Variant family execution report | Command results and family summary |

## Added Tests

| Test ID | Category | File | Status | Notes |
|---|---|---|---|---|
| ACTION-001 | Action skip | `gameProgressKnownBugs.test.js` | Pass | SB fold should not skip BB option |
| ACTION-002 | Action skip | `gameProgressKnownBugs.test.js` | Pass | BB option after limp/call |
| ACTION-003 | Hero UI | `gameProgressKnownBugs.test.js`, `mgx-game-progress.spec.js` | Pass | Hero action UI stays visible |
| ACTION-004 | Turn sync | `gameProgressKnownBugs.test.js` | Pass | Stale actingPlayerIndex cannot override valid turn |
| ACTION-005 | Action eligibility | `gameProgressKnownBugs.test.js` | Pass | Folded player cannot receive turn |
| ACTION-006 | Freeze prevention | `gameProgressKnownBugs.test.js` | Pass | Eligible players with null actor are rejected |
| ACTION-007 | Turn sync | `gameProgressKnownBugs.test.js` | Pass | Multiple UI turn flags are rejected |
| ALLIN-001 | All-in | `gameProgressKnownBugs.test.js` | Pass | All-in player cannot receive betting turn |
| ALLIN-002 | All-in | `gameProgressKnownBugs.test.js` | Pass | HU all-in terminal state valid |
| ALLIN-003 | All-in | `gameProgressKnownBugs.test.js` | Pass | PLO multiway progression scenario |
| DRAW-001 | Draw | `gameProgressKnownBugs.test.js` | Pass | D01 draw full cycle |
| DRAW-002 | Draw | `gameProgressKnownBugs.test.js` | Pass | D02 CPU draw auto-resolve |
| DRAW-003 | Draw | `gameProgressKnownBugs.test.js` | Pass | Already drawn player cannot draw twice |
| DRAW-004 | Draw | `gameProgressKnownBugs.test.js` | Pass | Hand size drift is detected |
| MTT-001 | Tournament | `gameProgressKnownBugs.test.js` | Pass | Busted player cannot receive turn |
| MTT-002 | Tournament | `gameProgressKnownBugs.test.js` | Pass | Non-terminal empty active table rejected |
| MTT-003 | Tournament | `gameProgressKnownBugs.test.js` | Pass | Duplicate playerId after merge rejected |
| MTT-004 | Tournament | `gameProgressKnownBugs.test.js` | Pass | Single-winner terminal state valid |
| E2E-PROG-001 | E2E | `mgx-game-progress.spec.js` | Pass | Menu -> cash -> decision panel |
| E2E-PROG-002 | E2E | `mgx-game-progress.spec.js` | Pass | Badugi draw/pat path smoke |
| E2E-PROG-003 | E2E | `mgx-game-progress.spec.js` | Pass | PLO controller action + hand result smoke |
| E2E-PROG-004 | E2E | `mgx-game-progress.spec.js` | Pass | Tournament start remains valid |
| E2E-PROG-005 | E2E | `mgx-game-progress.spec.js` | Pass | Mobile landscape action button is tappable |
| HIST-REG-05 | History/replay E2E | `cross-variant-history-replay-smoke.spec.ts` | Pass | 35 playable variantsでhandId/action/result/Replay-ready + Replay UI first/next/last/event-row frame jump |
| STUD-001..006 | Stud family | `studFamilyProgress.test.js` | Pass | ST1-ST6 ante/bring-in/street/all-in/evaluator coverage |
| FLOP-001..003 | Flop family | `flopFamilyProgress.test.js` | Pass | Hold'em/Omaha blinds, streets, all-in coverage |
| OMAHA-001 | Omaha family | `flopFamilyProgress.test.js` | Pass | Omaha evaluator uses exactly two hole cards |
| SPLIT-001 | Split-pot family | `flopFamilyProgress.test.js` | Pass | PLO8/FLO8 split smoke |
| DRAW-FAMILY-001..003 | Draw family | `drawFamilyProgress.test.js` | Pass | Draw count, lowball evaluator, split draw result smoke |
| MIXED-001 | Mixed family | `mixedSpecialFamilyProgress.test.js` | Pass | Mode-level rotation gap explicitly tracked |
| SPECIAL-001 | Special family | `mixedSpecialFamilyProgress.test.js` | Pass | Super Hold'em / Dramaha smoke |
| ONEHAND-001 | All variants | `allVariantsOneHandProgression.test.js` | Pass | 36/36 catalog variants complete one controller-path hand |
| ONEHAND-FAMILY-001 | Family representatives | `familyOneHandProgression.test.js` | Pass | DRAW/STUD/FLOP/SPLIT/SPECIAL/CHINESE representatives complete one hand |

## Known Bugs Covered

| Bug ID | Covered By | Pass/Fail | Remaining Risk |
|---|---|---|---|
| ACTION-001 | Vitest invariant fixture | Pass | Needs real UI BB-option E2E later |
| ACTION-002 | Vitest invariant fixture + CAP-REG-05 E2E | Pass | BB option still needs broader natural-hand UI coverage |
| CAP-REG-05 | `tests/e2e/fixed-limit-cap-ui.spec.ts` | Pass | CPU natural cap long-run remains future coverage |
| ACTION-003 | Vitest + E2E | Pass | Broaden to every public variant |
| ACTION-004 | Vitest invariant fixture | Pass | Existing Stud E2E covers one UI call path |
| ACTION-005 | Vitest negative fixture | Pass | Guards folded actor freeze regressions |
| ACTION-006 | Vitest negative fixture | Pass | Guards no-actor freeze regressions |
| ACTION-007 | Vitest negative fixture | Pass | Guards duplicate UI turn flag regressions |
| ALLIN-001 | Vitest negative fixture | Pass | Add all-variant all-in scenario expansion |
| ALLIN-002 | Vitest terminal fixture | Pass | Side-pot UI still separate |
| ALLIN-003 | Scenario runner | Pass | Synthetic passive actions, not GTO actions |
| DRAW-001 | Scenario runner | Pass | UI draw selection covered separately |
| DRAW-002 | Scenario runner | Pass | CPU policy-specific draw choices not audited |
| DRAW-003 | Vitest negative fixture | Pass | UI duplicate-click debounce separate |
| DRAW-004 | Vitest negative fixture | Pass | Deck/discard duplicate-card audit future |
| HIST-REG-05 | `cross-variant-history-replay-smoke.spec.ts` | Pass | Chinese/OFC本体履歴接続はHIST-REG-06として継続 |
| MTT-001 | Vitest negative fixture | Pass | Full table merge E2E still needed |
| MTT-002 | Vitest negative fixture | Pass | Full MTT long-run E2E still needed |
| MTT-003 | Vitest negative fixture | Pass | Stack/button movement audit future |
| MTT-004 | Vitest terminal fixture | Pass | Stage unlock E2E separate |

## Variant Coverage Summary

| Total variants | Tested variants | Skipped variants | Failed variants | Unknown variants |
|---:|---:|---:|---:|---:|
| 36 | 36 | 0 | 0 | 0 |

## Command Results

| Command | Result | Notes |
|---|---|---|
| `npm run test:game:known-bugs` | Pass | 1 file, 18 tests passed |
| `npm run test:game:stud` | Pass | 1 file, 13 tests passed |
| `npm run test:game:flop` | Pass | 1 file, 5 tests passed |
| `npm run test:game:draw-family` | Pass | 1 file, 6 tests passed |
| `npm run test:game:family` | Pass | 5 files, 28 tests passed |
| `npm run test:game:one-hand` | Pass | 2 files, 53 tests passed |
| `npm run test:game:progress` | Pass | 9 files, 127 tests passed, 11 skipped with explicit reasons |
| `npm run test:e2e:progress` | Pass | 5 Playwright tests passed on `badugi-flow` project |
| `npm test -- --run src/ui/screens/__tests__/ReplayScreen.test.jsx src/ui/screens/__tests__/HandHistoryScreen.test.jsx` | Pass | 2 files, 4 tests passed |
| `npx playwright test tests/e2e/cross-variant-history-replay-smoke.spec.ts --project=badugi-flow` | Pass | 35 playable variants passed with Replay UI frame jumps |
| `npm test` | Pass | 126 files passed; 849 tests passed, 12 skipped |
| `npm run build` | Pass | Vite build completed; existing chunk-size warning remains |
| `npm run lint` | Pass with warning | Existing `src/ui/App.jsx` hook dependency warning remains; no new lint warnings |

## Remaining Gaps

| Gap | Risk | Suggested Next Action |
|---|---|---|
| OFC street-by-street / fantasyland is still separate from CP1 classic Chinese Poker | CP1 set/result/next-hand is covered, but OFC-specific turn order is not | Add OFC 5-card open, one-card placement, fantasyland, and history/replay smoke |
| Scenario runner uses passive action policy | It catches freezes but not all strategic UI edge cases | Add scenario action plans for raise/cap/all-in/fold paths |
| Full MTT table merge E2E remains expensive | CPU bust/reseat bugs may still require manual reproduction | Add deterministic MTT fixture with forced bust and merge |
