# MGX 2-7 Triple Draw Game Progression Spec

Date: 2026-05-16

Scope: `D01` / `deuce_to_seven_triple_draw` only.

## Hand Setup

- Each hand has a dealer button.
- Small blind and big blind are posted before cards are dealt into betting.
- Heads-up: button is the small blind.
- Three or more players: small blind is first active seat left of button, big blind is first active seat left of small blind.
- Blinds create a nonzero starting pot obligation and current bet.
- Each active, non-empty player receives five private cards.
- Empty, busted, or sitting-out seats receive no cards and are not action candidates.

## Betting Order

- Three or more players pre-draw: first actor is the first active player left of the big blind, also UTG.
- Heads-up pre-draw: first actor is BTN/SB.
- After each draw: first actor is first active non-all-in player left of the button. In heads-up this is BB.
- Folded, sitting-out, busted, and all-in players are skipped for betting action.
- If no eligible betting actor remains, the betting round closes and the hand either advances to draw, showdown, or a single-player win.

## Betting Rounds

There are four betting rounds:

1. Pre-draw betting.
2. Betting after draw 1.
3. Betting after draw 2.
4. Betting after draw 3.

MGX currently implements D01 as fixed-limit draw:

- A fixed raise unit is derived from the blind structure and draw round.
- Raise cap is enforced by metadata `raiseCap`.
- A betting round closes when all non-folded, non-all-in betting players have acted and matched the current bet.
- Check-around closes a zero-bet street.
- Call-around closes once all live bets are matched.

## Draw Rounds

- Exactly three draw rounds are allowed.
- Each active non-folded player, including all-in hand-eligible players, may discard 0 to 5 cards.
- Discarding 0 cards is pat.
- Discarding more than 5 cards or an out-of-range index is illegal.
- Folded, sitting-out, busted, and non-draw-eligible seats skip draw action.
- All-in draw decisions must resolve before the hand can advance to the next betting round or showdown path.
- After draw 1 and draw 2, the game transitions to the next betting round.
- After draw 3, the game transitions to the final betting round.
- There is no fourth draw.

## Showdown And 2-7 Ranking

2-7 lowball ranking:

- Aces are high.
- Straights count against the hand.
- Flushes count against the hand.
- Pairs are bad.
- Best possible hand is unsuited 7-5-4-3-2.

Terminal behavior:

- If one active player remains after folds, award the pot immediately.
- If multiple active players remain after final betting, run showdown.
- Pot is awarded to the best 2-7 low hand among eligible live contenders.
- Result overlay must include winner and pot evidence.
- Next hand transition must reset street state while preserving updated stacks.

## Pot Handling

- Blinds and antes contribute to the hand's invested chips.
- Calls, bets, and raises add to player investments and then to pots at street transition/showdown.
- Street and draw transitions must not clear the active visible pot.
- Showdown/fold-win may empty active pots only after recording result metadata.
- New hand reset may initialize a fresh pot only after result/next-hand transition.
