# MGX A-5 Triple Draw Implementation Mapping Audit

Date: 2026-05-16

Scope: `D02` / `ace_to_five_triple_draw`.

## Mapping Table

| Spec Item | Source File | Function / Surface | Covered? | Notes |
| --- | --- | --- | --- | --- |
| Variant ID | `src/games/draw/AceToFiveTripleDrawEngine.js` | constructor | Yes | Sets `variantId: "D02"` and `gameId: "ace_to_five_triple_draw"`. |
| Controller | `src/games/draw/AceToFiveTripleDrawController.js` | constructor | Yes | Wraps `AceToFiveTripleDrawEngine`. |
| Catalog | `src/games/core/variants.js` | `ace_to_five_triple_draw` | Yes | Label and variant ID map to D02. |
| Availability | `src/games/config/variantAvailability.js` | `VARIANT_AVAILABILITY` | Yes | D02 is currently alpha-playable; this audit does not change that. |
| Route aliases | `src/ui/game/appVariantRouting.js` | `APP_VARIANT_ALIASES` | Yes | `D02`, `d02`, `a5td`, and `ace_to_five_triple_draw` resolve to D02. |
| E2E aliases | `tests/e2e/authHelper.ts` | `GAME_VARIANT_ALIASES` | Yes | D02 resolves to `ace_to_five_triple_draw`. |
| Button assignment | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited `startHand` path | Yes | Shared triple-draw button/blind structure. |
| Blinds assignment/payment | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited blind posting | Yes | A-5TD posts SB/BB through inherited engine behavior. |
| Initial deal | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited deal path | Yes | 5 cards per active player. |
| First actor | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited actor selection | Yes | 6max/3way/HU focused tests cover pre-draw order. |
| Next actor | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited next-actor logic | Yes | Focused tests cover folded/all-in skip for betting actors. |
| Betting close | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited betting transition | Yes | Check-around and call-closure covered in A-5TD tests. |
| Draw transition | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited `transitionToDraw` | Partial | Non-all-in draw progression passes; all-in draw skip is a release blocker. |
| Draw order | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited draw actor queue | Partial | Active players draw in order; all-in seats may still be elected as draw actors. |
| Discard count | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited legal draw actions | Yes | 0-5 accepted, >5 rejected. |
| Exactly 3 draws | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `maxDrawRounds=3` | Yes | Focused tests verify no fourth draw. |
| A-5 evaluator | `src/games/draw/AceToFiveTripleDrawEngine.js` | `lowType="A5"` | Yes | Uses shared lowball evaluator in A-5 mode. |
| Ace low | `src/games/draw/lowballEvaluator.js` | A-5 mode | Yes | Focused evaluator tests verify ace rank `1`. |
| Straight/flush ignored | `src/games/draw/lowballEvaluator.js` | A-5 mode | Yes | Focused evaluator tests verify no straight/flush penalty. |
| Showdown transition | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited terminal handling | Yes | Focused progression and showdown tests reach result. |
| Fold-to-one | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited fold terminal | Yes | Focused tests cover immediate single-winner result. |
| Pot calculation | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited pot/investment fields | Yes | Focused pot continuity tests pass. |
| Side pot | shared engine result path | all-in terminal result | Partial | D02-specific browser side-pot release gate is not yet present. |
| UI snapshot merge | `src/ui/utils/engineSnapshotUtils.js` | `mergeEngineSnapshot` | Yes | A-5TD snapshot merge tests cover canonical turn over stale metadata. |
| Next hand reset | controller inherited path | `createNewHandState` | Yes | Focused tests verify new hand starts with clean active pot. |

## Findings

- No D02/S02 mapping cross-wire was found. D02 is A-5 Triple Draw; S02 is A-5 Single Draw.
- A-5 evaluator behavior is separated from 2-7TD: ace is low, straight and flush penalties are ignored.
- Release readiness is blocked by inherited all-in draw eligibility evidence: all-in seats can still be elected as draw actors in a no-next-alive transition path, contrary to the Step3 spec.
