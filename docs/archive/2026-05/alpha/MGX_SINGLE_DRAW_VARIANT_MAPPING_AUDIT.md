# MGX Single Draw Variant Mapping Audit

Date: 2026-05-16

Scope: 2-7 Single Draw and A-5 Single Draw only.

## Result

2-7 Single Draw maps to `S01` / `deuce_to_seven_single_draw`.

A-5 Single Draw maps to `S02` / `ace_to_five_single_draw`.

No Single Draw / Triple Draw cross-wire was found. `D01` and `D02` remain Triple Draw; `S01` and `S02` are Single Draw.

| Game | Item | Expected | Actual | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 2-7SD | variantId | 2-7SD ID | `S01` | PASS | `DeuceToSevenSingleDrawEngine.variantId` uses `S01`. |
| 2-7SD | canonical route ID | `deuce_to_seven_single_draw` | `deuce_to_seven_single_draw` | PASS | Route aliases resolve `S01`, `s01`, and `27sd`. |
| 2-7SD | displayName | `2-7 Single Draw` | `2-7 Single Draw` | PASS | Engine and UI catalog labels match. |
| 2-7SD | drawCount | 1 | 1 | PASS | Engine sets `maxDrawRounds=1`. |
| 2-7SD | handSize | 5 | 5 | PASS | Inherits draw-lowball `handCardCount=5`. |
| 2-7SD | lowballRule | deuce-to-seven | `lowType="27"` / evaluator `low-27` | PASS | Aces high, straight/flush penalties enabled. |
| A-5SD | variantId | A-5SD ID | `S02` | PASS | `AceToFiveSingleDrawEngine.variantId` uses `S02`. |
| A-5SD | canonical route ID | `ace_to_five_single_draw` | `ace_to_five_single_draw` | PASS | Route aliases resolve `S02`, `s02`, and `a5sd`. |
| A-5SD | displayName | `A-5 Single Draw` | `A-5 Single Draw` | PASS | Engine and UI catalog labels match. |
| A-5SD | drawCount | 1 | 1 | PASS | Engine sets `maxDrawRounds=1`. |
| A-5SD | handSize | 5 | 5 | PASS | Inherits draw-lowball `handCardCount=5`. |
| A-5SD | lowballRule | ace-to-five | `lowType="A5"` / evaluator `low-a5` | PASS | Ace low, straight/flush penalties disabled. |
| Triple Draw separation | Single Draw must not use D01/D02 | `S01`/`S02` are separate from `D01`/`D02` | PASS | No D/S route or engine cross-wire found. |
| availability | alpha candidate / audit required | S01/S02 currently alpha-playable | PASS | This audit does not change availability or production routing. |

## ID Usage

| Surface | 2-7SD ID | A-5SD ID | Status | Notes |
| --- | --- | --- | --- | --- |
| Engine | `S01` / `deuce_to_seven_single_draw` | `S02` / `ace_to_five_single_draw` | PASS | Source of truth for rule behavior. |
| Controller snapshot | `S01` | `S02` | PASS | Snapshot metadata carries variant ID. |
| Game selector | `deuce_to_seven_single_draw` | `ace_to_five_single_draw` | PASS | Availability gate maps aliases to canonical route IDs. |
| E2E helpers | `S01` / `deuce_to_seven_single_draw` | `S02` / `ace_to_five_single_draw` | PASS | `authHelper.ts` resolves both aliases. |
| Replay/history smoke | `S01` | `S02` | PASS | Hand history utilities label both variants distinctly. |

## Audit Classification

No P0 variant mapping bug was found.

The main release risk for this step is inherited all-in draw eligibility: Single Draw inherits the same draw transition path as Triple Draw, so all-in seats must be explicitly audited against the one-draw spec.
