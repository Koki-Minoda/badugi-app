# MGX Badugi Game Progression Spec

Status: alpha audit reference

Scope: `badugi` only. This document defines gameplay progression rules for release-readiness audits. It does not change routing, promotion, live RL, or variant availability.

## Hand Setup

| Item | Rule |
| --- | --- |
| Button assignment | The dealer/button advances one occupied active seat per new hand. Empty, busted, and seat-out seats are skipped by blind/actor helpers. |
| SB/BB assignment, 3+ players | Small blind is first eligible active seat left of button. Big blind is first eligible active seat left of small blind. |
| SB/BB assignment, heads-up | Button is also small blind. Big blind is the other eligible active seat. |
| Blinds payment | SB/BB are deducted from stack and added to each player's `betThisRound` and `totalInvested`. All-in blind posters become all-in and cannot be selected for later betting actions. |
| Starting pot | Starting pot is the sum of blinds, antes if enabled, and any all-in blind shortfall actually paid. It must be nonzero when at least one blind chip is paid. |
| Initial deal | Every active non-seat-out player receives four cards. Folded, busted, empty, and seat-out players have no active hand. |

## Betting Order

| Street | Rule |
| --- | --- |
| Pre-draw, 3+ players | First actor is the first active eligible betting seat left of the big blind, commonly UTG. The big blind acts only after action reaches them. |
| Pre-draw, heads-up | First actor is the button/small blind. |
| Post-draw betting | First actor is the first active eligible betting seat left of the button. |
| Folded/all-in seats | Folded and seat-out seats are skipped. All-in seats are skipped for betting actions. |
| No eligible actor | If no eligible betting actor exists, the betting round closes and the game advances to draw or showdown as appropriate. |

## Betting Round Closure

The betting round closes when all remaining non-folded, non-seat-out, non-all-in players have acted and their `betThisRound` values match the current maximum bet.

Additional closure states:

- Check-around closes the street when current bet is zero and every eligible bettor has checked.
- If all remaining players are all-in, the betting round closes and the hand proceeds through remaining draw/showdown logic without selecting an invalid bettor.
- A raise reopens action for other eligible bettors.
- Fixed-limit raise cap is enforced by validation. A capped raise attempt is rejected rather than mutating hand state.
- Minimum raise / fixed raise unit is derived from the fixed-limit street size: small bet before late draw streets and big bet on configured big-bet streets.

## Draw Rounds

Badugi has exactly three draw rounds:

1. Draw #1
2. Draw #2
3. Draw #3

Draw rules:

- Active non-folded players draw in order starting left of the button.
- Folded and seat-out players are skipped.
- All-in players may still draw while active in the hand.
- Each active player may discard 0 to 4 cards.
- A player can draw only once per draw round.
- When all eligible draw actors have drawn, the next betting round starts.

## Showdown

Showdown is reached after the final betting round following Draw #3.

Terminal handling:

- If only one active player remains, that player wins immediately.
- If multiple active players remain, Badugi hand ranking determines winner(s).
- The full active pot is awarded.
- Result overlay shows hand result, pot, and winner details.
- Next hand transition begins only after the result state has been exposed to the UI.

## Pot Handling

Pot source of truth is the combination of explicit pots and player investment.

Rules:

- Blinds create a nonzero pot.
- Bets, calls, raises, antes, and all-in contributions add to `totalInvested`.
- Street transitions may reset `betThisRound`, but must not clear active-hand pot visibility.
- Draw transitions must preserve the active pot.
- Showdown may distribute the pot, but the result snapshot must retain the resolved total for the result overlay.
- New hand setup is the only normal point where the active pot resets to zero for the next hand.

## Release Audit Gates

Badugi is release-ready only when:

- Betting order matches this spec in 6max, 3way, and heads-up scenarios.
- Full progression reaches `pre-draw bet -> draw1 -> bet -> draw2 -> bet -> draw3 -> final bet -> showdown`.
- Active-hand pot never renders as `Total Pot 0` after blinds/chips have been invested.
- Canonical controller actor cannot be overwritten by stale UI metadata.
- Result overlay and next-hand transition are both reachable.
- Known long-run and browser progression blockers are closed.
