# MGX Core5 TDA Alignment Spec

Date: 2026-05-18

This pass aligns Core5 alpha rules around all-in draw eligibility and hand visibility. It does not change betting reopen, fixed-limit cap, heads-up button/blind order, blind/ante posting, evaluator behavior, or effective-pot semantics.

## Core5 draw all-in eligibility

Core5 draw games:

- Badugi
- D01 / 2-7 Triple Draw
- D02 / A-5 Triple Draw
- S01 / 2-7 Single Draw
- S02 / A-5 Single Draw

Rules:

- All-in players cannot take additional BET/CALL/RAISE/FOLD actions.
- All-in players can still take DRAW decisions while hand-eligible.
- All-in players retain showdown and pot eligibility.
- Folded, out, or busted players cannot bet, draw, or reach showdown.
- All-in draw decisions must resolve before advancing to the next betting/showdown path.
- After draw, all-in players must not be selected as BET actors.

## Core5 draw visibility

Core5 draw games use `SHOWDOWN_ONLY` visibility:

- All-in does not expose the hand before showdown.
- Draw decisions can occur while the hand remains hidden from opponents.
- Folded hands are not revealed.
- Showdown/result reveals eligible non-folded hands.

## Board-game visibility

Board games use `ACTION_COMPLETE` visibility:

- All-in hands may be revealed only after betting action is complete and no further betting decisions remain.
- The policy covers NLH/FLH/PLO/PLO8/FLO8/5-card PLO/Big-O family variants.

## Explicitly unchanged

- Reopen rule after raises.
- Fixed-limit five-bet cap implementation.
- Heads-up BTN/SB/BB action order.
- Blind and ante posting.
- Single Draw active-hand effective pot semantics.
