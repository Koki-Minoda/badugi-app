# MGX market comparison and polish backlog — 2026-09-05

## Comparison basis

This comparison uses current first-party product and help material rather than
third-party reviews. MGX is a training-first, single-table product; cashier,
rewards and regulated real-money operations are intentionally out of scope.

| Area | PokerStars | WSOP Online | GGPoker | MGX current state | Decision |
|---|---|---|---|---|---|
| Table controls | Exact action amounts, hand replay and desktop instant history | Mobile multi-table product | Preset sizes, slider/manual sizing and mobile table customisation | Exact Bet/Raise contribution, Min/Half-pot/Pot, NL All-in and legal clamps | **P0 closed.** Preserve forced Bet/Raise device gate |
| Rules/structure | Tournament lobby exposes blind structure, round length, rebuy and break information | Tournament formats include re-entry/multi-flight | Lobby identifies freezeout, rebuy, PKO, satellites and speed | Per-variant rules help; tournament HUD exposes level, blinds, ante, hands and next level; re-entry is stage-gated | **P1:** add a table-level route back to full structure without ending play |
| History/replay | Single hand, recent hands, date range or full tournament; desktop visual replay/export | Mobile history is materially more limited than PC | PokerCraft provides session/hand browser, P/L, win rate, ROI and position views | Versioned local JSON export, exact action/card/chip/phase replay and grounded tournament review | **P1:** add session/tournament filters and aggregate position views; never present outcome-only advice as causation |
| Tournament | Mature balancing, H4H, disconnect and button rules | Re-entry and large-event formats | Broad tournament type catalogue and explicit lobby labels | Store/local/world champion paths, blind progression, FT no-re-entry and resume/review gates | **P0 closed.** Production must receive the already-merged blind/resume fixes before claiming closure |
| Mobile | Broad play support but some desktop history features absent | Four-table mobile support | Full cash/tournament mobile with landscape guidance and configurable controls | Desktop Chromium, Android Chromium and iPhone WebKit landscape release matrices; action geometry/clickability checked | **P0 closed for supported single-table landscape. P1:** portrait one-hand layout and user control preferences |

## First-party references

- PokerStars: [tournament rules and lobby structure](https://www.pokerstars.com/poker/tournaments/rules/),
  [saving and replaying hand histories](https://www.pokerstars.com/help/articles/save-hand-histories/214105/),
  and [mobile feature limitations](https://www.pokerstars.com/help/articles/mob-feat-unavail-spec/).
- WSOP: [WSOP Online launch feature summary](https://www.wsop.com/news/world-series-of-poker-makes-online-poker-history-with-launch-of-all-new-wsop-online/)
  and [mobile hand-history FAQ](https://help.nv.wsop.com/hc/en-us/articles/48499363488795-WSOP-Mobile-App-Frequently-Asked-Questions).
- GGPoker: [tournament types](https://ggpoker.com/tournaments/tournament-types/?lang=en),
  [PokerCraft](https://ggpoker.com/blog/pokercraft-analyze-your-ggpoker-statistics/),
  [Smart HUD](https://ggpoker.com/poker-games/smart-hud/), and the
  [mobile feature guide](https://ggpoker.com/blog/all-about-the-ggpoker-mobile-app/).

Product behaviour must be rechecked before future parity work.

## P0/P1 release decision

No new P0 engine or mobile blocker was found in this comparison. The remaining
P0 is operational: the current main build must be deployed through the
administrator route, then production QM must prove the same gates. GitHub's
deploy identity cannot complete the privileged two-worker service change.

P1 implementation order:

1. in-play tournament structure access;
2. history filters and aggregate session/position summaries;
3. portrait one-hand mobile layout and saved control preferences;
4. richer multi-table views only after the single-table contract remains green.

Run It Twice, rabbit hunting, quick-seat pools, four-table mobile and real-money
cashier/rewards are deliberate product-scope decisions, not release defects.
