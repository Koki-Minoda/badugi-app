# MGX market gap and polish decision — 2026-09-03

## Scope and evidence

This review compares MGX's 37 catalog entries and released play paths with current official product/rules material. It does not infer support from third-party reviews.

Primary references:

- [PokerStars software features](https://www.pokerstars.com/poker/room/features/software-news/) — instant history/replay, statistics, notes, auto buy-in and Run It Twice.
- [PokerStars Badugi rules](https://www.pokerstars.com/poker/games/badugi/) — fixed-limit betting, three draws and draw-order information.
- [PokerStars 2-7 and Hi/Lo rules](https://www.pokerstars.com/help/articles/po-game-rules-m/215793/) — single/triple draw and 8-or-better split behavior.
- [PokerStars draw reshuffle rules](https://www.pokerstars.com/poker/games/draw/reshuffle/) — discard recycling and Stud deck-exhaustion behavior.
- [PokerStars Omaha Hi/Lo rules](https://www.pokerstars.com/poker/games/omaha/high-low/) — exactly two hole cards, three board cards, scoop and legal bet limits.
- [PokerStars Seven Card Stud rules](https://www.pokerstars.com/poker/games/stud/) and [Razz rules](https://www.pokerstars.com/poker/games/razz/) — bring-in, street order and exposed-card action order.
- [PokerStars 8-Game rules](https://www.pokerstars.com/poker/games/8-game/) — six-hand rotation and visible game/hand counter.
- [partypoker mobile product](https://www.partypoker.com/en/poker/p/mobile) — portrait one-hand play, central raise slider, replay and multi-table UX.
- [Pokerrrr OFC rules](https://www.pokerrrrapp.com/single-post/how-to-play-open-face-chinese-poker-ofc-complete-rules-scoring-guide) — locked street placement and Fantasyland boundary.

## Per-game comparison

| MGX catalog | Current MGX strength | Market expectation / difference | Decision |
|---|---|---|---|
| B01 NLH, B03 NL Super Hold'em | Side-pot settlement, exact replay, 3-device release QM | Commercial NL games allow any legal amount from minimum through all-in and expose the selected amount | **P0 now:** legal sizing presets/input and exact action label |
| B02 FLH, B04 FL Super Hold'em | Fixed increments and raise cap | Market uses one legal increment and visible cap | Keep fixed controls; explicitly distinguish them from NL |
| B05 PLO, B06 PLO8, B07 Big-O, B08 5-card PLO | Must-use-two, Hi/Lo, side pots and odd-chip order are strict | Pot-limit clients expose maximum pot raise and prevent over-limit input | **P0 now:** Min / 1/2 Pot / Pot sizing with authoritative clamp |
| B09 FLO8 | Hi/Lo and fixed-limit settlement are strict | Fixed increment, cap and low qualification should remain visible | Keep fixed controls; improve rule label |
| D01–D07 triple draw | 10-hand progression, draw selection, split variants and deck recycling | Mature clients show draw number, opponent draw count and exact low system | Keep engine; make rule/structure metadata consistent |
| S01–S07 single draw | One-draw progression and exact history | Mature clients separate single draw from triple draw and never recycle a player's own discard in the same draw | Keep engine; make catalog/public state truthful |
| ST1–ST6 Stud/Razz | Bring-in, 3rd–7th street, split pots, all-in and exact replay | Market exposes street/bring-in/big-bet transition and visible boards | Keep release; retain 3-device long-run gate |
| H01–H06 Dramaha | MGX has unusually broad six-variant coverage, strict board/draw halves and odd chips | Niche market has no single dominant online reference; result explanation matters more than lobby breadth | Keep release; preserve component result/replay evidence |
| CP1 Classic Chinese Poker | Manual 13-card rows, foul/royalties, zero-sum points and exact replay | Classic closed-deal play is distinct from OFC | Public, with dedicated 3-device QM |
| CP2 OFC / Fantasyland | Catalog and disabled UI now exist separately | OFC requires irreversible street placement and Fantasyland | **Do not publish** until both are implemented and tested |

## Cross-product gap decision

### Implement in this polish release

1. **Authoritative variable bet sizing.** NLH/Super Hold'em get minimum, half-pot, pot and all-in choices. PLO/PLO8/Big-O/5-card PLO get minimum, half-pot and pot choices clamped to the controller's pot-limit maximum. Fixed-limit, draw, Stud and Dramaha retain one legal increment.
2. **Action transparency.** The button must say Bet or Raise as appropriate and show the exact contribution. The UI must show min/max and reject stale/out-of-range values before sending them.
3. **Portable own history.** Export the player's local single-player cash/tournament history as versioned JSON. P2P room state is separate and is never included.
4. **Catalog truth.** Public availability, catalog maturity and QM scope must not contradict each other. OFC remains explicitly deferred.
5. **Release gates.** Force actual Bet and Raise actions on Desktop Chromium, Android Chromium and iPhone WebKit, then verify amount, pot/stack conservation, history and exact replay.

### Defer intentionally

- Run It Twice, rabbit hunting, quick-seat pools and multi-table UI are product-format features, not prerequisites for deterministic single-table training play.
- Real-money cashier, rewards and regulatory tooling are outside MGX's current training-product scope.
- OFC/Fantasyland remains a separate future game.
- Portrait one-handed play remains a future layout project; current release contract is tested landscape plus dedicated portrait screens where supported.

## Acceptance

- A zero-current-bet board street can make a real Bet; facing a bet can make a real Raise.
- NL contribution is within `[minimum, stack]`; PLO contribution is within `[minimum, min(stack, pot-limit maximum)]`.
- Fixed-limit variants never display a free-form sizing control.
- Chosen amount is present in canonical history and exact replay.
- Desktop, Android and WebKit each complete the forced bet/raise regression without overflow or unreachable controls.
- Full Tier1, settlement/progress gates, all published-game QM, PR CI, manual deployment and production smoke pass.

## Implemented polish

- NL and pot-limit games now derive a legal contribution range from the authoritative table bet, Hero street contribution, stack, pot, blind and last full raise.
- The action control distinguishes `Bet` from `Raise`, displays the exact chips to commit and provides Min / 1/2 Pot / Pot presets; NL also provides All-in and a continuous desktop slider.
- Mobile landscape automatically switches to the dense action layout. The first Android run caught the old full-height panel pushing all three action buttons below the visual viewport; the corrected layout passed the full ten-hand run.
- Cash and tournament history can be downloaded as `mgx-hand-history-export/v1` JSON from both history entry points.
- D01, D02, S01, S02 and H01–H06 now say `live` in the catalog, matching the already-public release manifest and completed release QM. CP2 remains `wip`.

Local release evidence before PR:

- NLH: Desktop Chromium, Android Chromium and iPhone WebKit each completed 10 real-button hands, including explicit pot sizing, nine Next Hand transitions, exact history/replay and cash-out.
- PLO: the same three-device 10-hand contract passed, with the chosen amount staying inside the pot-limit maximum.
- Focused sizing/history/catalog/UI tests passed; full gates and remaining published Omaha variants are delegated to mandatory PR CI before merge.
