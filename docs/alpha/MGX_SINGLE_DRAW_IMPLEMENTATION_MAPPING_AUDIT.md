# MGX Single Draw Implementation Mapping Audit

Date: 2026-05-16

Scope: `S01` / `deuce_to_seven_single_draw` and `S02` / `ace_to_five_single_draw`.

## Mapping Table

| Spec Item | Source File | Function / Surface | Covered? | Notes |
| --- | --- | --- | --- | --- |
| S01 variant ID | `src/games/draw/DeuceToSevenSingleDrawEngine.js` | constructor | Yes | Sets `variantId: "S01"` and `gameId: "deuce_to_seven_single_draw"`. |
| S02 variant ID | `src/games/draw/AceToFiveSingleDrawEngine.js` | constructor | Yes | Sets `variantId: "S02"` and `gameId: "ace_to_five_single_draw"`. |
| Controllers | `src/games/draw/*SingleDrawController.js` | constructors | Yes | Both wrap the matching Single Draw engine. |
| Catalog | `src/games/core/variants.js` | `deuce_to_seven_single_draw`, `ace_to_five_single_draw` | Yes | Labels and variant IDs map to S01/S02. |
| Availability | `src/games/config/variantAvailability.js` | `VARIANT_AVAILABILITY` | Yes | S01/S02 are currently alpha-playable; this audit does not change that. |
| Route aliases | `src/ui/game/appVariantRouting.js` | `APP_VARIANT_ALIASES` | Yes | `S01`/`27sd` and `S02`/`a5sd` resolve separately. |
| E2E aliases | `tests/e2e/authHelper.ts` | `GAME_VARIANT_ALIASES` | Yes | S01/S02 route IDs are distinct. |
| Button assignment | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited `startHand` path | Yes | Single Draw inherits the shared draw-lowball table structure. |
| Blinds assignment/payment | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited blind posting | Yes | S01/S02 post SB/BB through inherited behavior. |
| Initial deal | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited deal path | Yes | 5 cards per active player. |
| First actor | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited actor selection | Yes | Focused tests cover 6max/3way/HU pre-draw order. |
| Next actor | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited next-actor logic | Yes | Focused tests cover folded/all-in skip for betting actors. |
| Betting close | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited betting transition | Yes | Check-around and call-closure covered in Single Draw tests. |
| Draw transition | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited `transitionToDraw` | Partial | Non-all-in progression passes; all-in draw skip is a release blocker. |
| Draw order | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited draw actor queue | Partial | Active players draw in order; all-in seats may still be elected as draw actors. |
| Discard count | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited legal draw actions | Yes | 0-5 accepted, >5 rejected. |
| Exactly 1 draw | `src/games/draw/*SingleDrawEngine.js` | `maxDrawRounds=1` | Yes | Focused tests verify no second or third draw. |
| 2-7 evaluator | `src/games/draw/DeuceToSevenSingleDrawEngine.js` | `lowType="27"` | Yes | Ace high, straight bad, flush bad. |
| A-5 evaluator | `src/games/draw/AceToFiveSingleDrawEngine.js` | `lowType="A5"` | Yes | Ace low, straight/flush ignored. |
| Showdown transition | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited terminal handling | Yes | Focused progression and showdown tests reach result. |
| Fold-to-one | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited fold terminal | Yes | Focused tests cover immediate single-winner result. |
| Pot calculation | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | inherited pot/investment fields | Yes | Focused pot continuity tests pass. |
| Side pot | shared engine result path | all-in terminal result | Partial | S01/S02-specific browser side-pot release gate is not yet present. |
| UI snapshot merge | `src/ui/utils/engineSnapshotUtils.js` | `mergeEngineSnapshot` | Yes | Single Draw snapshot tests cover canonical turn over stale metadata. |
| Next hand reset | controller inherited path | `createNewHandState` | Yes | Focused tests verify a new hand starts with clean active pot. |

## Findings

- No Single Draw / Triple Draw mapping cross-wire was found.
- S01 and S02 evaluator behavior is separated correctly.
- Release readiness is blocked by inherited all-in draw eligibility evidence: all-in seats can still be elected as draw actors in a no-next-alive transition path, contrary to the Step4 spec.
