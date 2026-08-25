# MGX 2-7 Triple Draw Implementation Mapping Audit

Date: 2026-05-16

Scope: `D01` / `deuce_to_seven_triple_draw`.

| Spec Item | Source File | Function | Covered? | Notes |
| --- | --- | --- | --- | --- |
| Variant ID | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | constructor | Yes | `variantId="D01"`, `gameId="deuce_to_seven_triple_draw"`. |
| UI alias | `tests/e2e/authHelper.ts` | `VARIANT_TEST_ID_BY_ALIAS` | Yes | `d01` maps to `deuce_to_seven_triple_draw`. |
| Availability | `src/games/config/variantAvailability.js` | `VARIANT_AVAILABILITY` | Yes | D01 is `preview_only`, not alpha selectable. |
| Initial deal | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `initHand` | Yes | Deals `handCardCount=5` to active seats. |
| Button / blinds | `src/games/core/drawEngineBase.js` | `applyForcedBets` | Yes | HU BTN=SB; 3+ SB/BB left of button. |
| First pre-draw actor | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `applyForcedBets` | Yes | Uses live seat after BB via `getNextBettingSeat`. |
| Next actor | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `getNextBettingSeat` | Yes | Skips folded, sitting-out, busted, and all-in seats. |
| Betting close | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `hasBettingRoundCompleted` | Yes | Requires acted and matched current bet for betting players. |
| Fixed-limit raise cap | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `getRaiseCap`, `applyBettingAction` | Yes | Metadata `raiseCap` defaults to 4. |
| Draw transition | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `advanceAfterBet`, `transitionToDraw` | Yes | Advances to draw rounds 1-3 and then showdown after final bet. |
| Draw order | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `transitionToDraw`, `applyDrawAction` | Yes | Starts left of button and uses pending draw seats. |
| All-in draw skip | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `transitionToDraw` | No | Step2 spec says all-in players skip draw, but current draw eligibility can mark all-in seats as pending draw actors. Tracked as `27TD-PROG-001`. |
| Discard 0-5 | `src/games/core/draw/normalizeDrawAction.js` | `normalizeDrawAction` | Yes | Validates index uniqueness and max discard count. |
| Exactly 3 draws | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `maxDrawRounds`, `advanceAfterBet` | Yes | `D01` max draw rounds is 3. |
| 2-7 evaluator | `src/games/evaluators/low.js` | `evaluateLowHand` | Yes | `lowType="27"` treats A high and penalizes straight/flush. |
| Showdown transition | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `resolveShowdown` | Yes | Settles outstanding bets, evaluates eligible hands, writes result metadata. |
| Fold-to-one | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `resolveFoldWin` | Yes | Awards pot to sole active player. |
| Pot calculation | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `settleCurrentBets`, `resolveShowdown` | Yes | Active bets move into pot at street/showdown. |
| Side pot | `src/games/draw/DeuceToSevenTripleDrawEngine.js` | `normalizePotEligibleSeats`, pot loop | Partial | Eligible-seat handling exists; deep all-in side-pot browser evidence remains broader coverage. |
| UI snapshot | `src/games/draw/DeuceToSevenTripleDrawController.js` | `getUiSnapshot` | Yes | Exposes phase, drawRound, pot, turn, max discard, hand result. |
| UI merge | `src/ui/utils/engineSnapshotUtils.js` | `mergeEngineSnapshot` | Yes | Canonical turn/nextTurn wins over stale metadata. |
| Next hand | `src/games/draw/DeuceToSevenTripleDrawController.js` | `createNewHandState` | Yes | Rehydrates current stacks and starts a new D01 hand. |

## Notes

- No D01/D02 cross-wire was found.
- This audit does not change D01 availability or production routing.
- The focused audit found one rule mismatch: all-in seats can still be selected for draw action. No production fix was made in this audit sprint.
- Side-pot and long-run browser evidence are additional areas that should remain monitored before widening alpha scope.
