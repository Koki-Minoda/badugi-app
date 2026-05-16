# MGX A-5 Triple Draw Game Progression Spec

Date: 2026-05-16

Scope: A-5 Triple Draw (`D02` / `ace_to_five_triple_draw`) only.

This document defines the expected release-audit behavior for A-5 Triple Draw. It does not change routing, production availability, AI, or RL behavior.

## Hand Setup

- The dealer button advances once per hand among active seats.
- In three-handed or larger games, the small blind is the first active seat left of the button and the big blind is the next active seat.
- Heads-up uses button-as-small-blind: BTN/SB posts small blind and the other player posts big blind.
- Blinds are posted before pre-draw action and create a nonzero starting pot.
- Each active player receives 5 cards.
- Folded, busted, sitting-out, or seat-out players are not dealt into the hand.

## Betting Order

- Three players or more, pre-draw: first actor is the first active player left of the big blind, commonly UTG.
- Heads-up, pre-draw: first actor is BTN/SB.
- Post-draw betting: first actor is the first active player left of the button.
- Folded and all-in players are skipped.
- If no eligible betting actor exists, the betting round closes and the hand advances to the next draw, showdown, or single-winner terminal state.

## Betting Rounds

A-5 Triple Draw has 4 betting rounds:

1. Pre-draw.
2. After draw 1.
3. After draw 2.
4. After draw 3.

Betting closes when all non-folded, non-all-in players have either matched the current bet or checked through with no outstanding bet. Fold-to-one ends the hand immediately. Fixed-limit sizing and raise caps should remain consistent with the shared draw-lowball structure when enabled.

## Draw Rounds

- Exactly 3 draw rounds occur at most: Draw 1, Draw 2, Draw 3.
- Each active non-folded, non-all-in player may discard 0 to 5 cards.
- Discarding 0 cards is pat.
- Folded and all-in players skip draw decisions.
- After draw 1 and draw 2, the hand transitions to the next betting round.
- After draw 3, the final betting round starts.
- No fourth draw may occur.

## Showdown / Hand Ranking

A-5 lowball rules:

- Aces are low.
- Straights do not count against the hand.
- Flushes do not count against the hand.
- Pairs are bad.
- The best hand is A-2-3-4-5.

If one active player remains, award the pot immediately. If multiple active players remain after the final betting round, proceed to showdown, evaluate A-5 lowball hands, award the pot, show the result overlay, then allow the next-hand transition.

## Pot Handling

- Blinds create a nonzero pot.
- Calls, bets, and raises add to the pot.
- Street and draw transitions must not clear the active pot.
- Showdown awards the pot but may keep terminal result metadata visible for UI display.
- The next hand resets the pot only after the result/next-hand transition starts a new hand.

## Audit Notes

This spec intentionally differs from 2-7 Triple Draw only in evaluator semantics. Betting order, draw count, hand size, and pot continuity are shared with the triple-draw family.
