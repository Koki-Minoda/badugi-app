# MGX Omaha release readiness

Status: PASS for public Alpha promotion.

## Released variants

- Pot-Limit Omaha (`plo` / B05)
- PLO8 (`plo8` / B06)
- FLO8 (`flo8` / B09)
- Big-O Hi/Lo (`big_o` / B07)
- 5-Card PLO (`five_card_plo` / B08)

## Rules and settlement gates

All five variants enforce the Omaha must-use-exactly-two-hole-cards rule. PLO8,
FLO8, and Big-O independently evaluate high and qualifying eight-or-better low
halves. Contribution-derived main and side pots, multiple winners, split pots,
chip conservation, and clockwise odd-chip allocation beginning left of the
dealer are covered by deterministic tests. Big-O is five-card Omaha Hi/Lo; it
is no longer treated as high-only five-card PLO.

## Browser QM

The release-candidate matrix completed 150/150 real-button hands:

- five variants × Desktop Chromium × ten hands;
- five variants × Android Chromium landscape × ten hands;
- five variants × iPhone WebKit landscape × ten hands.

Each case proves ten settlements, nine Next Hand transitions, expected hole
card count, fixed cash blinds, ten replay-ready histories, exact replay
settlement, cash-out return, and zero fatal browser, network, action-viewport,
or horizontal-overflow failures.

The first 5-Card PLO WebKit run exposed a browser-clock regression in canonical
history timestamps. Canonical event timestamps are now clamped monotonically
without reordering actions, with a focused unit regression. The complete
150-hand matrix passed again after that fix.
