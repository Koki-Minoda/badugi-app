# MGX Draw All-in Eligibility Spec

Scope: D01, D02, S01, S02.

MGX Core5 separates betting eligibility from draw eligibility:

| Player state | BET/CALL/RAISE/FOLD actor | DRAW actor | Showdown/pot eligible |
|---|---:|---:|---:|
| Active, not all-in | Yes | Yes | Yes |
| All-in, not folded/out | No | Yes | Yes |
| Folded | No | No | No |
| Out/busted/sitting out | No | No | No |

Rules:

- All-in players cannot be selected for additional betting actions.
- All-in players retain draw decision rights while they remain hand-eligible.
- Folded, out, busted, or sitting-out players cannot be selected for betting or drawing.
- After an all-in player resolves a draw decision, they must not be selected as a later BET actor.
- All-in players remain eligible for showdown and any pot/side-pot they are entitled to contest.
- If no betting-eligible players remain in a BET round, the round must close into the next DRAW, SHOWDOWN, COLLECT, or RESULT path rather than waiting on an all-in betting actor.
- If an all-in player is the only pending DRAW actor, that draw decision must still resolve and must not freeze the hand.

Regression coverage:

- `src/games/draw/__tests__/drawAllInEligibilityRegression.test.js`
- `tests/e2e/core5-draw-allin-eligibility-regression.spec.ts`
