# MGX A-5 Triple Draw Variant Mapping Audit

Date: 2026-05-16

Scope: A-5 Triple Draw only. This audit intentionally excludes 2-7 Triple Draw, 2-7 Single Draw, A-5 Single Draw, Badugi, and split draw variants.

## Result

A-5 Triple Draw maps to `D02` / `ace_to_five_triple_draw`.

`S02` is A-5 Single Draw, not A-5 Triple Draw. The current catalog, route aliases, controller, engine, and UI labels are consistent with the D02 mapping.

| Item | Expected | Actual | Status | Notes |
| --- | --- | --- | --- | --- |
| variantId | A-5TD ID | `D02` | PASS | `AceToFiveTripleDrawEngine.variantId` uses `D02`. |
| canonical route ID | `ace_to_five_triple_draw` | `ace_to_five_triple_draw` | PASS | E2E alias `d02` resolves to this ID. |
| displayName | `A-5 Triple Draw` | `A-5 Triple Draw` | PASS | Engine and UI catalog labels match. |
| controller | A-5 Triple Draw controller | `AceToFiveTripleDrawController` | PASS | Controller wraps `AceToFiveTripleDrawEngine`. |
| engine | A-5 Triple Draw engine | `AceToFiveTripleDrawEngine` | PASS | Engine ID is `ace_to_five_triple_draw`. |
| drawCount | 3 | 3 | PASS | Inherits triple draw `maxDrawRounds=3`. |
| handSize | 5 | 5 | PASS | Inherits draw lowball `handCardCount=5`. |
| lowballRule | ace-to-five | `lowType="A5"` / evaluator `low-a5` | PASS | Aces low, straight/flush penalties disabled. |
| ace | low | low | PASS | Evaluator ranks ace as `1`. |
| straight/flush | ignored | ignored | PASS | Evaluator does not penalize straight or flush in A-5 mode. |
| D01 separation | D01 must be 2-7 TD | D01 is `deuce_to_seven_triple_draw` | PASS | No D01/D02 cross-wire found in mapping. |
| Single Draw separation | S02 must be A-5 SD | S02 is `ace_to_five_single_draw` | PASS | D02 remains triple draw; S02 is single draw. |
| availability | alpha candidate / audit required | `alpha_playable` in current gate | PASS | This audit does not change availability or production routing. |

## ID Usage

| Surface | A-5TD ID | Status | Notes |
| --- | --- | --- | --- |
| Engine | `D02` / `ace_to_five_triple_draw` | PASS | Source of truth for rule behavior. |
| Controller snapshot | `D02` | PASS | Snapshot metadata carries variant ID. |
| Game selector | `ace_to_five_triple_draw` | PASS | Availability gate maps alias `d02` to canonical route ID. |
| E2E helpers | `D02` / `ace_to_five_triple_draw` | PASS | `authHelper.ts` resolves both aliases. |
| Replay/history smoke | `D02` | PASS | Existing history/replay helpers use D02 as A-5TD. |
| Coaching history | `D02` | PASS | D02 coaching history examples are variant-aware and separate from S02. |

## Audit Classification

No P0 variant mapping bug was found.

The main release risk for this step is not ID mixing. It is whether inherited triple-draw all-in draw eligibility matches the A-5TD progression spec.
