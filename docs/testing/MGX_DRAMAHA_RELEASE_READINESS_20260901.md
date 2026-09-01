# MGX Dramaha release readiness — 2026-09-01

## Scope

The public contract covers H01–H06: Dramaha Hi, 2-7, A-5, Zero, Hidugi, and Badugi.

## Rules implemented

- Each player receives five private cards.
- The shared board runs flop, turn, and river for five total cards.
- A single draw occurs after the flop betting round.
- The pot is divided into a board half and a draw half. An indivisible outer chip goes to the draw half.
- A component tied between multiple players awards remainder chips clockwise starting left of the button.
- Zero scores J/Q/K as zero, ace as one, and 2–10 at face value; the lowest five-card total wins.
- Zero, Hidugi, and Badugi permit at most three replacements. Hi, 2-7, and A-5 permit up to five.

Rule references:

- BARGE Dramaha: https://www.barge.org/rulebook/dramaha.html
- BARGE Dramaha Zero: https://www.barge.org/rulebook/dramaha-zero.html
- BARGE Dramadugi: https://www.barge.org/rulebook/dramadugi.html
- BARGE ties and odd chips: https://www.barge.org/rulebook/ties-odd-chips.html

## Automated evidence

- Desktop Chromium: H01–H06, ten real-button hands each (60 hands).
- Android Chromium at 844×390: H01–H06, ten real-button hands each (60 hands).
- iPhone WebKit at 844×390: H01–H06, ten real-button hands each (60 hands).
- Total: 180 completed hands with real Hero controls.

Every case requires five board cards, both settlement components, exact component totals, draw-half outer odd chips, button-relative tie remainders, ten persisted histories, exact final replay award, nine Next Hand transitions, cash-out to Game Select, visible/clickable controls, no horizontal overflow, and no fatal browser/network errors.

Unit and invariant gates independently verify Zero point values, draw caps, Omaha exactly-two/three board evaluation, all-in draw participation, side pots, tied component remainders, total payouts, and chip conservation.

## Publication decision

H01–H06 are public Alpha games. `PUBLIC_PLAYABLE_VARIANTS` is the source of truth, so every public-game QA summary and release workflow now fails closed if a Dramaha device report is missing or below threshold.
