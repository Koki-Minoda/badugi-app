# MGX Single Draw Game Progression Spec

Date: 2026-05-16

Scope:

- 2-7 Single Draw (`S01` / `deuce_to_seven_single_draw`)
- A-5 Single Draw (`S02` / `ace_to_five_single_draw`)

This document defines expected release-audit behavior. It does not change routing, production availability, AI, or RL behavior.

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
- If no eligible betting actor exists, the betting round closes and the hand advances to showdown or single-winner terminal state.

## Betting Rounds

Single Draw has 2 betting rounds:

1. Pre-draw.
2. After the single draw.

Betting closes when all non-folded, non-all-in players have either matched the current bet or checked through with no outstanding bet. Fold-to-one ends the hand immediately. Fixed-limit/no-limit structure should be documented per active implementation; the current draw-lowball implementation uses fixed-limit metadata.

## Draw Round

- Exactly 1 draw round occurs.
- Each active non-folded, non-all-in player may discard 0 to 5 cards.
- Discarding 0 cards is pat.
- Folded and all-in players skip draw decisions.
- After draw 1, the hand transitions to the final betting round.
- No draw 2 may occur.
- No draw 3 may occur.

## 2-7 Showdown / Hand Ranking

2-7 lowball rules:

- Aces are high.
- Straights count against the hand.
- Flushes count against the hand.
- Pairs are bad.
- The best hand is 7-5-4-3-2 unsuited.

## A-5 Showdown / Hand Ranking

A-5 lowball rules:

- Aces are low.
- Straights do not count against the hand.
- Flushes do not count against the hand.
- Pairs are bad.
- The best hand is A-2-3-4-5.

## Pot Handling

- Blinds create a nonzero pot.
- Calls, bets, and raises add to the pot.
- Draw transition must not clear the active pot.
- Showdown awards the pot but may keep terminal result metadata visible for UI display.
- The next hand resets the pot only after the result/next-hand transition starts a new hand.

## Audit Notes

Single Draw must prove it is not simply Triple Draw with labels changed. The release-critical checks are `maxDrawRounds=1`, no second draw, evaluator separation between S01 and S02, and stable pot/actor state through the one draw transition.
