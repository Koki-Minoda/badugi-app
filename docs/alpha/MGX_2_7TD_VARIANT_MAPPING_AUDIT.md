# MGX 2-7 Triple Draw Variant Mapping Audit

Date: 2026-05-16

Scope: 2-7 Triple Draw only. This audit intentionally excludes A-5 Triple Draw, 2-7 Single Draw, A-5 Single Draw, Badugi, and split draw variants.

## Result

2-7 Triple Draw maps to `D01` / `deuce_to_seven_triple_draw`.

`D02` is A-5 Triple Draw, not 2-7 Triple Draw. The current catalog, i18n labels, E2E aliases, and controller/engine IDs are consistent with that mapping.

| Item | Expected | Actual | Status | Notes |
| --- | --- | --- | --- | --- |
| variantId | `D01` | `D01` | PASS | `DeuceToSevenTripleDrawEngine.variantId` and metadata use `D01`. |
| canonical route ID | `deuce_to_seven_triple_draw` | `deuce_to_seven_triple_draw` | PASS | E2E alias `d01` resolves to this ID. |
| displayName | `2-7 Triple Draw` | `2-7 Triple Draw` | PASS | `src/i18n/variants.ja.json` and engine display name match. |
| controller | 2-7 Triple Draw controller | `DeuceToSevenTripleDrawController` | PASS | Controller wraps `DeuceToSevenTripleDrawEngine`. |
| engine | 2-7 Triple Draw engine | `DeuceToSevenTripleDrawEngine` | PASS | Engine ID is `deuce_to_seven_triple_draw`. |
| drawCount | 3 | 3 | PASS | `maxDrawRounds=3`. |
| handSize | 5 | 5 | PASS | `handCardCount=5`. |
| lowballRule | deuce-to-seven | `lowType="27"` / evaluator `low-27` | PASS | Aces high, straight/flush penalties enabled. |
| D02 separation | D02 must be A-5 TD | D02 is `ace_to_five_triple_draw` | PASS | No 2-7/A-5 cross-wire found in mapping. |
| Single Draw separation | Single draw must be separate | `S01` is 2-7 Single Draw | PASS | D01 remains triple draw; S01 is single draw. |
| availability | audit required | `preview_only` | PASS | D01 remains non-alpha selectable in current friend alpha gate. |

## ID Usage

| Surface | 2-7TD ID | Status | Notes |
| --- | --- | --- | --- |
| Engine | `D01` / `deuce_to_seven_triple_draw` | PASS | Source of truth for rule behavior. |
| Controller snapshot | `D01` | PASS | Snapshot metadata carries variant ID. |
| Game selector | `deuce_to_seven_triple_draw` | PASS | Availability gate maps alias `d01` to canonical route ID. |
| E2E helpers | `D01` / `deuce_to_seven_triple_draw` | PASS | `authHelper.ts` resolves both aliases. |
| Replay/history smoke | `D01` | PASS | Existing cross-variant E2E uses D01 title `2-7 Triple Draw`. |
| Coaching/RL alpha scope | excluded from Iron teacher rows | PASS | This audit does not change D01 routing or RL inclusion. |

## Audit Classification

No P0 variant mapping bug was found.

The main release risk for this step is not ID mixing. It is whether D01 has enough focused rule/progression/evaluator/browser evidence to be treated as release-ready later.

