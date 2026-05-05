# MGX Variant Family Coverage Matrix

Last updated: 2026-05-06

This matrix tracks add-on progress coverage by variant family. It does not replace existing Badugi-specific tests; it makes non-Badugi gaps visible.

## Family Coverage

| Family | Variant | Implemented | Existing Tests | Missing Family-Level Tests | Added Tests | Status | Notes |
|---|---|---:|---|---|---|---|---|
| DRAW | D01 2-7 Triple Draw | WIP | progress scenario | UI 5-hand per variant | DRAW-FAMILY-001/002 | Added | Harnessed despite catalog WIP |
| DRAW | D02 A-5 Triple Draw | WIP | progress scenario | UI 5-hand per variant | DRAW-FAMILY-001/002 | Added | Harnessed despite catalog WIP |
| DRAW | D03 Badugi | Yes | App E2E, known bug tests | controller fixture mapping | DRAW-FAMILY-001 skip reason | Partial | Legacy lifecycle still separate |
| DRAW | D04 Badeucey TD | Yes | progress scenario | component-pot UI details | DRAW-FAMILY-001/003 | Added | Split draw smoke |
| DRAW | D05 Badacey TD | Yes | progress scenario | component-pot UI details | DRAW-FAMILY-001/003 | Added | Split draw smoke |
| DRAW | D06 Hidugi TD | Yes | progress scenario | component-pot UI details | DRAW-FAMILY-001 | Added | Triple-draw smoke |
| DRAW | D07 Archie TD | Yes | progress scenario | component-pot UI details | DRAW-FAMILY-001 | Added | Triple-draw smoke |
| DRAW | S01 2-7 Single Draw | WIP | progress scenario | UI 5-hand per variant | DRAW-FAMILY-001/002 | Added | Harnessed despite catalog WIP |
| DRAW | S02 A-5 Single Draw | WIP | progress scenario | UI 5-hand per variant | DRAW-FAMILY-001/002 | Added | Harnessed despite catalog WIP |
| DRAW | S03 5-Card Single Draw | Yes | progress scenario | UI 5-hand per variant | DRAW-FAMILY-001 | Added | Single-draw smoke |
| DRAW | S04 Badugi SD | Yes | progress scenario | UI 5-hand per variant | DRAW-FAMILY-001 | Added | Single-draw smoke |
| DRAW | S05 Badeucey SD | Yes | progress scenario | component-pot UI details | DRAW-FAMILY-001/003 | Added | Split draw smoke |
| DRAW | S06 Badacey SD | Yes | progress scenario | component-pot UI details | DRAW-FAMILY-001/003 | Added | Split draw smoke |
| DRAW | S07 Hidugi SD | Yes | progress scenario | UI 5-hand per variant | DRAW-FAMILY-001 | Added | Single-draw smoke |
| STUD | ST1 Stud | Yes | progress scenario, Stud E2E | longer UI street audit | STUD-001/002/003/004/006 | Added | 3rd-7th progression covered in harness |
| STUD | ST2 Stud 8 | Yes | progress scenario | hi/lo result UI detail | STUD-001/002/005 | Added | Evaluator config smoke |
| STUD | ST3 Razz | Yes | progress scenario, Stud E2E | longer UI street audit | STUD-001/002/005/006 | Added | Low evaluator config smoke |
| STUD | ST4 Razzdugi | Yes | progress scenario | split result UI detail | STUD-001/002/005 | Added | Split Stud smoke |
| STUD | ST5 Razzducey | Yes | progress scenario | split result UI detail | STUD-001/002/005 | Added | Split Stud smoke |
| STUD | ST6 2-7 Razz | Yes | progress scenario | low result UI detail | STUD-001/002/005 | Added | 2-7 low evaluator smoke |
| FLOP_HOLDEM | B01 NL Hold'em | Yes | progress scenario | UI preflop option E2E | FLOP-001/002/003 | Added | 6-max blinds/order smoke |
| FLOP_HOLDEM | B02 FL Hold'em | Yes | progress scenario | UI cap E2E | FLOP-001/002/003 | Added | Limit cap covered elsewhere |
| FLOP_HOLDEM | B03 NL Super Hold'em | Yes | progress scenario | UI 5-hand per variant | FLOP-002/003, SPECIAL-001 | Added | Also SPECIAL |
| FLOP_HOLDEM | B04 FL Super Hold'em | Yes | progress scenario | UI cap E2E | FLOP-002/003, SPECIAL-001 | Added | Also SPECIAL |
| FLOP_OMAHA | B05 PLO | Yes | progress scenario, PLO E2E | deeper side-pot E2E | FLOP-003/OMAHA-001 | Added | Must-use-two checked |
| FLOP_OMAHA | B06 PLO8 | Yes | progress scenario | hi/lo result UI detail | FLOP-003/OMAHA-001/SPLIT-001 | Added | Split-pot family |
| FLOP_OMAHA | B07 Big-O | Yes | progress scenario | hi/lo catalog/evaluator clarification | FLOP-003/OMAHA-001 | Partial | Current catalog is high-only despite product expectation |
| FLOP_OMAHA | B08 5-Card PLO | Yes | progress scenario | deeper side-pot E2E | FLOP-003/OMAHA-001 | Added | Must-use-two checked through evaluator fixture |
| FLOP_OMAHA | B09 FLO8 | Yes | progress scenario | hi/lo result UI detail | FLOP-003/OMAHA-001/SPLIT-001 | Added | Split-pot family |
| SPLIT_POT | B06 PLO8 | Yes | progress scenario | quartering/odd-chip UI | SPLIT-001 | Added | Smoke only |
| SPLIT_POT | B09 FLO8 | Yes | progress scenario | quartering/odd-chip UI | SPLIT-001 | Added | Smoke only |
| SPLIT_POT | D04/D05/S05/S06 split draw | Yes | progress scenario | component pot UI | DRAW-FAMILY-003 | Added | Badeucey/Badacey paths |
| SPLIT_POT | ST2/ST4/ST5 split Stud | Yes | progress scenario | component pot UI | STUD-005 | Added | Evaluator config and smoke |
| SPECIAL | B03/B04 Super Hold'em | Yes | progress scenario | UI 5-hand per variant | SPECIAL-001 | Added | Special board-hole variant |
| SPECIAL | H01-H06 Dramaha | WIP | progress scenario | result UI and component details | SPECIAL-001 | Added | Harnessed despite catalog WIP |
| MIXED | H.O.R.S.E. / 8-game / Dealer's Choice | Mode-level | manual / UI routes + MIX-PROG-05 E2E | H.O.R.S.E. / Dealer's Choice specific rotation E2E | MIXED-001, MIX-PROG-05 | Partial | 8Game/10Game rotation boundary covered; no direct registry variant |
| CHINESE | CP1 Chinese Poker | Yes | scorer/controller tests | OFC street-by-street / fantasyland / history replay | CHINESE-001 | Added | CP1 set/result/next-hand covered; OFC remains separate |

## Family Test IDs

| Test ID | Family | Variant(s) | Scenario | Expected | Test File | Status | Notes |
|---|---|---|---|---|---|---|---|
| STUD-001 | STUD | ST1-ST6 | ante / bring-in | pot and next actor valid | `studFamilyProgress.test.js` | Added | Per-variant loop |
| STUD-002 | STUD | ST1-ST6 | street progression | no skipped/undefined street | `studFamilyProgress.test.js` | Added | Family runner |
| STUD-003 | STUD | ST1 | folded/busted deal exclusion | folded player not dealt later street | `studFamilyProgress.test.js` | Added | Direct controller fixture |
| STUD-004 | STUD | ST1 | all-in progression | terminal/showdown reached | `studFamilyProgress.test.js` | Added | Scenario runner |
| STUD-005 | STUD | ST2/ST3/ST6 | evaluator routing | low / hi-lo config visible | `studFamilyProgress.test.js` | Added | Config-level guard |
| STUD-006 | STUD | ST1/ST3 | HU / multiway freeze | six-max smoke passes | `studFamilyProgress.test.js` | Added | 2 representative variants |
| FLOP-001 | FLOP_HOLDEM | B01 | blinds / preflop order | SB/BB posted, actor valid | `flopFamilyProgress.test.js` | Added | Board controller fixture |
| FLOP-002 | FLOP_HOLDEM | B01-B04 | street progression | preflop to terminal without freeze | `flopFamilyProgress.test.js` | Added | Family runner |
| FLOP-003 | FLOP_OMAHA | B05-B09 | all-in runout | no all-in freeze | `flopFamilyProgress.test.js` | Added | Family runner |
| OMAHA-001 | FLOP_OMAHA | B05/B06/B07/B08/B09 | hole-card rule | exactly 2 hole + 3 board in best hand | `flopFamilyProgress.test.js` | Added | Evaluator fixture |
| SPLIT-001 | SPLIT_POT | B06/B09 | hi/lo split smoke | split variants progress | `flopFamilyProgress.test.js` | Added | UI split detail remains future |
| DRAW-FAMILY-001 | DRAW | D/S draw variants | draw count | configured draw rounds do not drift | `drawFamilyProgress.test.js` | Added | Family runner |
| DRAW-FAMILY-002 | DRAW | D01/D02/S01/S02 | lowball evaluator | A-5 and 2-7 do not cross-wire | `drawFamilyProgress.test.js` | Added | Evaluator output assertion |
| DRAW-FAMILY-003 | SPLIT_POT | D04/D05/S05/S06 | split draw result | component result reached | `drawFamilyProgress.test.js` | Added | Split draw smoke |
| MIXED-001 | MIXED | mode-level rotations | registry classification | explicit gap, not false pass | `mixedSpecialFamilyProgress.test.js` | Added | No direct registry variant |
| MIX-PROG-05 | MIXED | 8Game / 10Game | 5-cycle per-hand rotation boundary | variantId / seat / dealer button / stack+pot total persists | `mixed-rotation-core-progression.spec.ts` | Added | 8Game 40 boundaries and 10Game 50 boundaries covered |
| SPECIAL-001 | SPECIAL | B03/B04/H01-H06 | special smoke | supported special variants do not freeze | `mixedSpecialFamilyProgress.test.js` | Added | Family runner |
| CHINESE-001 | CHINESE | CP1 | set -> showdown -> next hand | result totals exist and next hand resets state | `chineseFamilyProgress.test.js` | Added | CP1 classic Chinese Poker path |
