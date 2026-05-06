# MGX Game Progress QA Matrix

Last updated: 2026-05-06

This matrix tracks add-on coverage for game progression regressions. Existing Vitest / Playwright suites remain intact; new rows point to additive tests only.

## QA Matrix 1: Known Bug Regression

| ID | Bug Category | Scenario | Expected Result | Test Type | Target File | Status | Notes |
|---|---|---|---|---|---|---|---|
| ACTION-001 | Action skip | SB fold後にBBが飛ばされない | BB option actor remains eligible | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Synthetic BB option fixture |
| ACTION-002 | Action skip | Limp/call後にBB optionが残る | BB has check/raise opportunity | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Fixed-limit option fixture |
| ACTION-003 | Hero UI | Hero turnでaction buttonsが消えない | Hero actor is valid and single-turn | Vitest + E2E | `gameProgressKnownBugs.test.js`, `tests/e2e/mgx-game-progress.spec.js` | Added | UI E2E checks decision panel |
| ACTION-004 | Turn sync | stale actingPlayerIndexでturnが壊れない | `currentActor/turn` wins over stale metadata | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Covers Stud-style sync bug |
| ACTION-005 | Action eligibility | folded playerにturnが回らない | invariant catches folded actor | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Negative fixture added during bugfix sweep |
| ACTION-006 | Freeze prevention | eligible playerがいるのにactor nullで止まらない | invariant catches no-actor freeze state | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Negative fixture added during bugfix sweep |
| ACTION-007 | Turn sync | UI上で複数seatがturn表示にならない | invariant catches multiple `isTurn` flags | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Negative fixture added during bugfix sweep |
| ALLIN-001 | All-in | all-in playerにbetting actionを要求しない | invariant fails if all-in actor is selected | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Negative fixture |
| ALLIN-002 | All-in | HU all-in後にshowdownへ進む | terminal/showdown state is valid | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Terminal fixture |
| ALLIN-003 | All-in | multiway all-in後にfreezeしない | scenario runner reaches terminal | Vitest scenario | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | PLO controller passive progression |
| DRAW-001 | Draw count | draw countがvariant configと一致 | drawRound never exceeds max | Vitest scenario | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | D01 triple draw full cycle |
| DRAW-002 | CPU draw | CPU drawが自動解決される | draw scenario reaches terminal | Vitest scenario | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | D02 full cycle |
| DRAW-003 | Draw turn | draw済みplayerに再度draw turnが回らない | invariant catches duplicate draw actor | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Negative fixture |
| DRAW-004 | Hand size | draw後のhand sizeが正しい | invariant catches hand size drift | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Negative fixture |
| HIST-REG-05 | History/replay | handId/action/result/frame jumpをvariant横断で確認 | Replay UI controls move the frame counter from history row entry | Playwright E2E | `tests/e2e/cross-variant-history-replay-smoke.spec.ts` | Added | 35 playable variants; Chinese/OFC body integration tracked as HIST-REG-06 |
| MTT-001 | Tournament | busted playerにturnが回らない | invariant catches busted actor | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Negative fixture |
| MTT-002 | Tournament | CPU bust後にtableが空にならない | non-terminal active table required | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Negative fixture |
| MTT-003 | Tournament | table merge/reseat後にplayerIdが壊れない | duplicate playerId is rejected | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Negative fixture |
| MTT-004 | Tournament | tournamentがvalid terminal stateに到達する | single winner terminal is valid | Vitest invariant | `src/games/testing/regression/gameProgressKnownBugs.test.js` | Added | Terminal fixture |

## QA Matrix 2: Variant Coverage

| Variant ID | Game Name | Implemented | Supports Betting | Supports Draw | Supports All-in | Supports Tournament | Required Progress Tests | Added Tests | Missing Tests | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---|---|---|---|---|
| B01 | NL Hold'em | Yes | Yes | No | Yes | Yes | betting/all-in/showdown | scenario smoke | MTT E2E variant-specific | Added | Alias `nlh` |
| B02 | FL Hold'em | Yes | Yes | No | Yes | Yes | cap/betting/all-in/showdown | scenario smoke + cap unit + CAP-REG-05 UI E2E | CPU natural cap long-run | Added | Alias `flh` |
| B03 | NL Super Hold'em | Yes | Yes | No | Yes | Yes | betting/all-in/showdown | scenario smoke | variant-specific E2E | Added | Alias `super_holdem` |
| B04 | FL Super Hold'em | Yes | Yes | No | Yes | Yes | cap/betting/all-in/showdown | scenario smoke | UI cap E2E | Added | Alias `fl_super_holdem` |
| B05 | Pot-Limit Omaha | Yes | Yes | No | Yes | Yes | betting/all-in/side pot/showdown | scenario smoke + E2E progress | deeper side-pot E2E | Added | Alias `plo` |
| B06 | PLO8 | Yes | Yes | No | Yes | Yes | hi/lo split/all-in/showdown | scenario smoke | hi/lo UI result E2E | Added | Alias `plo8` |
| B07 | Big-O | Yes | Yes | No | Yes | Yes | hi/lo split/all-in/showdown | scenario smoke | hi/lo UI result E2E | Added | Alias `big_o` |
| B08 | 5-Card PLO | Yes | Yes | No | Yes | Yes | betting/all-in/showdown | scenario smoke | variant-specific E2E | Added | Alias `five_card_plo` |
| B09 | FLO8 | Yes | Yes | No | Yes | Yes | cap/hi-lo/all-in/showdown | scenario smoke + cap unit + CAP-REG-05 UI E2E | CPU natural cap long-run | Added | Alias `flo8` |
| D01 | 2-7 Triple Draw | WIP | Yes | Yes | Yes | Yes | draw count/betting/showdown | scenario smoke + known bug | UI 5-hand per variant exists separately | Added | Controller harness |
| D02 | A-5 Triple Draw | WIP | Yes | Yes | Yes | Yes | draw count/betting/showdown | scenario smoke + known bug | UI 5-hand per variant exists separately | Added | Controller harness |
| D03 | Badugi | Yes | Yes | Yes | Yes | Yes | action/all-in/draw/MTT | E2E progress existing + matrix + one-hand controller guarantee | UI 5-hand/MTT long-run | Added | Core Badugi controller is mapped in the one-hand harness |
| D04 | Badeucey TD | Yes | Yes | Yes | Yes | Yes | split draw/result | scenario smoke | component-pot UI E2E | Added | Controller harness |
| D05 | Badacey TD | Yes | Yes | Yes | Yes | Yes | split draw/result | scenario smoke | component-pot UI E2E | Added | Controller harness |
| D06 | Hidugi TD | Yes | Yes | Yes | Yes | Yes | split draw/result | scenario smoke | component-pot UI E2E | Added | Controller harness |
| D07 | Archie TD | Yes | Yes | Yes | Yes | Yes | split draw/result | scenario smoke | component-pot UI E2E | Added | Controller harness |
| S01 | 2-7 Single Draw | WIP | Yes | Yes | Yes | Yes | single draw/showdown | scenario smoke | variant-specific UI E2E | Added | Controller harness |
| S02 | A-5 Single Draw | WIP | Yes | Yes | Yes | Yes | single draw/showdown | scenario smoke | variant-specific UI E2E | Added | Controller harness |
| S03 | 5-Card Single Draw | Yes | Yes | Yes | Yes | Yes | single draw/showdown | scenario smoke | variant-specific UI E2E | Added | Controller harness |
| S04 | Badugi SD | Yes | Yes | Yes | Yes | Yes | single draw/showdown | scenario smoke | variant-specific UI E2E | Added | Controller harness |
| S05 | Badeucey SD | Yes | Yes | Yes | Yes | Yes | split single draw/result | scenario smoke | component-pot UI E2E | Added | Controller harness |
| S06 | Badacey SD | Yes | Yes | Yes | Yes | Yes | split single draw/result | scenario smoke | component-pot UI E2E | Added | Controller harness |
| S07 | Hidugi SD | Yes | Yes | Yes | Yes | Yes | single draw/showdown | scenario smoke | variant-specific UI E2E | Added | Controller harness |
| H01 | Dramaha Hi | WIP | Yes | Yes | Yes | Yes | board+draw/final/showdown | scenario smoke | result UI detail | Added | Alias `dramaha_hi` |
| H02 | Dramaha 2-7 | WIP | Yes | Yes | Yes | Yes | board+draw/split result | scenario smoke | result UI detail | Added | Alias `dramaha_27` |
| H03 | Dramaha A-5 | WIP | Yes | Yes | Yes | Yes | board+draw/split result | scenario smoke | result UI detail | Added | Alias `dramaha_a5` |
| H04 | Dramaha Zero | WIP | Yes | Yes | Yes | Yes | board+draw/split result | scenario smoke | result UI detail | Added | Alias `dramaha_zero` |
| H05 | Dramaha Hidugi | WIP | Yes | Yes | Yes | Yes | board+draw/split result | scenario smoke | result UI detail | Added | Alias `dramaha_hidugi` |
| H06 | Dramaha Badugi | WIP | Yes | Yes | Yes | Yes | board+draw/split result | scenario smoke | result UI detail | Added | Alias `dramaha_badugi` |
| ST1 | Stud | Yes | Yes | No | Yes | Yes | bring-in/3rd-7th/showdown | scenario smoke + Stud E2E UI-only 2hand | none for BUG-55 | Added | Alias `stud`; visible Hero buttons only |
| ST2 | Stud 8 | Yes | Yes | No | Yes | Yes | bring-in/hi-lo/showdown | scenario smoke | hi/lo result UI E2E | Added | Alias `stud8` |
| ST3 | Razz | Yes | Yes | No | Yes | Yes | bring-in/low/showdown | scenario smoke + Stud E2E UI-only 2hand | none for BUG-55 | Added | Alias `razz`; visible Hero buttons only |
| ST4 | Razzdugi | Yes | Yes | No | Yes | Yes | split stud result | scenario smoke | component-pot UI E2E | Added | Alias `razzdugi` |
| ST5 | Razzducey | Yes | Yes | No | Yes | Yes | split stud result | scenario smoke | component-pot UI E2E | Added | Alias `razzducey` |
| ST6 | 2-7 Razz | Yes | Yes | No | Yes | Yes | bring-in/2-7 low/showdown | scenario smoke | low result UI E2E | Added | Alias `razz27` |
| CP1 | Chinese Poker | Yes | No | No | No | No | set/result/next hand | CP1 set/result/next-hand + one-hand controller guarantee | OFC street-by-street/fantasyland | Added | Classic Chinese Poker path covered; OFC remains separate |

## QA Matrix 2b: One Hand Progression Guarantee

`npm run test:game:one-hand` enumerates all 36 catalog variants and drives one hand through the real controller/engine/action path with fixed seed `20260506`. Runnable variants must reach a valid hand terminal state within the step budget; skip is only allowed with an explicit unsupported-controller reason.

| Variant ID | Name | Family | Controller Registered | Engine Registered | Test Status | Steps | Terminal Phase | Skip/Fail Reason | Next Action |
|---|---|---|---:|---:|---|---:|---|---|---|
| B01 | NL Hold'em | FLOP_HOLDEM | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add deeper UI side-pot/BB-option E2E |
| B02 | FL Hold'em | FLOP_HOLDEM | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Keep CAP-REG-05 and natural cap long-run separate |
| B03 | NL Super Hold'em | FLOP_HOLDEM | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add UI 5-hand variant spot check |
| B04 | FL Super Hold'em | FLOP_HOLDEM | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add UI cap variant spot check |
| B05 | Pot-Limit Omaha | FLOP_OMAHA | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add deeper side-pot E2E |
| B06 | PLO8 | FLOP_OMAHA | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add hi/lo result UI E2E |
| B07 | Big-O | FLOP_OMAHA | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Resolve high-only vs hi/lo product expectation |
| B08 | 5-Card PLO | FLOP_OMAHA | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add side-pot E2E |
| B09 | FLO8 | FLOP_OMAHA | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Keep split/cap UI E2E coverage separate |
| D01 | 2-7 Triple Draw | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add UI 5-hand variant spot check |
| D02 | A-5 Triple Draw | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add UI 5-hand variant spot check |
| D03 | Badugi | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add longer MTT/UI all-in run |
| D04 | Badeucey TD | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add component-pot result E2E |
| D05 | Badacey TD | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add component-pot result E2E |
| D06 | Hidugi TD | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add component-pot result E2E |
| D07 | Archie TD | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add result clarity E2E |
| S01 | 2-7 Single Draw | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add UI 5-hand variant spot check |
| S02 | A-5 Single Draw | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add UI 5-hand variant spot check |
| S03 | 5-Card Single Draw | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add UI 5-hand variant spot check |
| S04 | Badugi SD | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add UI 5-hand variant spot check |
| S05 | Badeucey SD | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add component-pot result E2E |
| S06 | Badacey SD | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add component-pot result E2E |
| S07 | Hidugi SD | DRAW | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add UI 5-hand variant spot check |
| H01 | Dramaha Hi | SPECIAL | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add odd-chip/result UI assertions |
| H02 | Dramaha 2-7 | SPECIAL | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add split result UI assertions |
| H03 | Dramaha A-5 | SPECIAL | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add split result UI assertions |
| H04 | Dramaha Zero | SPECIAL | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add split result UI assertions |
| H05 | Dramaha Hidugi | SPECIAL | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add split result UI assertions |
| H06 | Dramaha Badugi | SPECIAL | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add split result UI assertions |
| ST1 | Stud | STUD | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add longer UI street/call/raise audit |
| ST2 | Stud 8 | STUD | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add hi/lo result UI E2E |
| ST3 | Razz | STUD | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add longer UI street/call/raise audit |
| ST4 | Razzdugi | STUD | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add split component result E2E |
| ST5 | Razzducey | STUD | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add split component result E2E |
| ST6 | 2-7 Razz | STUD | Yes | Yes | PASS | <=320 | HAND_RESULT/TERMINAL | - | Add low-result UI E2E |
| CP1 | Chinese Poker | CHINESE | Yes | Yes | PASS | <=320 | SHOWDOWN/HAND_RESULT | - | Add OFC street-by-street/fantasyland |

## One Hand Family Summary

| Family | Total Variants | Runnable | Passed | Failed | Skipped | Main Remaining Risk |
|---|---:|---:|---:|---:|---:|---|
| DRAW | 14 | 14 | 14 | 0 | 0 | UI 5-hand and split-component result clarity |
| STUD | 6 | 6 | 6 | 0 | 0 | UI-only 3rd-7th street long-run and result clarity |
| FLOP_HOLDEM | 4 | 4 | 4 | 0 | 0 | Natural cap/BB-option UI long-run |
| FLOP_OMAHA | 5 | 5 | 5 | 0 | 0 | Side-pot and hi/lo UI result detail |
| SPECIAL | 6 | 6 | 6 | 0 | 0 | Dramaha odd-chip/component-pot result UI |
| CHINESE | 1 | 1 | 1 | 0 | 0 | OFC street-by-street/fantasyland |
| Total | 36 | 36 | 36 | 0 | 0 | E2E long-run remains separate from controller guarantee |

## QA Matrix 3: Manual QA

| Area | Checkpoint | Expected Result | Pass/Fail | Notes |
|---|---|---|---|---|
| Cash game | 起動 | Selected variant table loads | TBD | Use latest deployed build |
| Cash game | 1 hand完走 | Showdown/result/next hand reachable | TBD | Per variant spot check |
| Cash game | 10 hands連続進行 | No freeze, stacks persist | TBD | Prioritize Badugi/NLH/PLO/Stud/Razz |
| Hero action | fold/call/check/raise | Button click changes state and never freezes | TBD | Covered partly by E2E |
| Draw | draw/pat | Hand size valid, next phase reached | TBD | Badugi/D01/D02/Dramaha重点 |
| Showdown | result表示 | Winner/pot/component pot readable | TBD | split games need manual UI QA |
| Next hand | 次hand | Fold/all-in flags reset | TBD | Existing fold recovery + manual |
| Tournament | start | Valid active table | TBD | E2E smoke added |
| Tournament | CPU bust | Busted player removed from turn eligibility | TBD | Invariant added, UI manual needed |
| Tournament | Table merge | playerId/stack preserved | TBD | Invariant added, MTT E2E future |
| Tournament | Reseat | Seat/button/blinds valid after merge | TBD | Manual/MTT E2E future |
| Tournament | Winner | Valid terminal state and single winner | TBD | Invariant added |
| Mobile | Chrome landscape | No page scroll, buttons tappable | TBD | E2E progress smoke added |
| Mobile | Buttons clickable | Key action button >=44px | TBD | E2E progress smoke added |
| Mobile | No scroll hell | Body/root do not force gameplay scroll | TBD | Dedicated mobile tests existing |

## QA Matrix 4: Variant Family Coverage

| Test ID | Family | Variant(s) | Scenario | Expected | Test File | Status | Notes |
|---|---|---|---|---|---|---|---|
| STUD-001 | STUD | ST1-ST6 | ante / bring-in | pot and next actor valid | `src/games/testing/scenario/studFamilyProgress.test.js` | Added | Stud family no longer Badugi-only |
| STUD-002 | STUD | ST1-ST6 | street progression | 3rd through terminal path does not freeze | `src/games/testing/scenario/studFamilyProgress.test.js` | Added | Controller-level smoke |
| STUD-003 | STUD | ST1 | folded deal exclusion | folded player not dealt later street | `src/games/testing/scenario/studFamilyProgress.test.js` | Added | Direct Stud controller fixture |
| STUD-004 | STUD | ST1 | all-in street progression | terminal/showdown path reached | `src/games/testing/scenario/studFamilyProgress.test.js` | Added | All-in guard |
| STUD-005 | STUD/SPLIT_POT | ST2/ST3/ST6 | evaluator routing | Razz/Stud8/2-7 Razz config remains distinct | `src/games/testing/scenario/studFamilyProgress.test.js` | Added | Config smoke |
| STUD-006 | STUD | ST1/ST3 | heads-up/multiway freeze | representative six-max smoke passes | `src/games/testing/scenario/studFamilyProgress.test.js` | Added | Stud and Razz |
| FLOP-001 | FLOP_HOLDEM | B01 | blinds / preflop order | SB/BB posted and actor valid | `src/games/testing/scenario/flopFamilyProgress.test.js` | Added | Board controller fixture |
| FLOP-002 | FLOP_HOLDEM | B01-B04 | street progression | no phase skip / freeze | `src/games/testing/scenario/flopFamilyProgress.test.js` | Added | Family runner |
| FLOP-003 | FLOP_OMAHA | B05-B09 | all-in runout | all-in does not freeze | `src/games/testing/scenario/flopFamilyProgress.test.js` | Added | Family runner |
| OMAHA-001 | FLOP_OMAHA | B05-B09 | hole card rule | exactly 2 hole cards used | `src/games/testing/scenario/flopFamilyProgress.test.js` | Added | Evaluator fixture |
| SPLIT-001 | SPLIT_POT | B06/B09 | hi/lo split smoke | split variants progress | `src/games/testing/scenario/flopFamilyProgress.test.js` | Added | UI split detail remains future |
| DRAW-FAMILY-001 | DRAW | D/S draw variants | draw count | configured draw rounds do not drift | `src/games/testing/scenario/drawFamilyProgress.test.js` | Added | Family runner |
| DRAW-FAMILY-002 | DRAW | D01/D02/S01/S02 | lowball evaluator | A-5 and 2-7 do not cross-wire | `src/games/testing/scenario/drawFamilyProgress.test.js` | Added | Evaluator output assertion |
| DRAW-FAMILY-003 | DRAW/SPLIT_POT | D04/D05/S05/S06 | split draw result | component result reached | `src/games/testing/scenario/drawFamilyProgress.test.js` | Added | Badeucey/Badacey smoke |
| MIXED-001 | MIXED | H.O.R.S.E./8-game/DC | registry classification | mode-level gap is explicit | `src/games/testing/scenario/mixedSpecialFamilyProgress.test.js` | Added | No false full-coverage claim |
| SPECIAL-001 | SPECIAL | B03/B04/H01-H06 | special smoke | special variants do not freeze | `src/games/testing/scenario/mixedSpecialFamilyProgress.test.js` | Added | Super Hold'em + Dramaha |
| ONEHAND-001 | ALL | all 36 variants | one-hand controller progression | each runnable variant reaches terminal state via real controller/action path | `src/games/testing/scenario/allVariantsOneHandProgression.test.js` | Added | Fixed seed `20260506`; PASS 36/36 |
| ONEHAND-FAMILY-001 | ALL families | representative variants | family-level one-hand progression | each family representative reaches terminal state | `src/games/testing/scenario/familyOneHandProgression.test.js` | Added | DRAW/STUD/FLOP/SPLIT/SPECIAL/CHINESE representatives |
