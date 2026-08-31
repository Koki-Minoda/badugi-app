# MGX 36-game maturity audit (2026-08-29)

This audit records what the source and executable gates prove. `status: live` is
not inferred from selector reachability, and `status: wip` is not promoted by
this change.

## Catalog truth

| Family | Variant IDs | Catalog status | Deterministic multi-hand | Strict settlement | History/replay UI |
|---|---|---:|---:|---:|---:|
| Board | B01-B09 | 9 live | 10 hands | Enforced | Covered |
| Triple draw | D01-D07 | 5 live, 2 wip (D01/D02) | 10 hands | Enforced | Covered |
| Single draw | S01-S07 | 5 live, 2 wip (S01/S02) | 10 hands | Enforced | Covered |
| Dramaha | H01-H06 | 6 wip | 10 hands | Enforced: board/draw components | Covered |
| Stud | ST1-ST6 | 6 live | 10 hands | Enforced | Covered |
| Chinese Poker | CP1 | 1 live | 10 hands | Enforced: zero-sum points gate; chip-pot gate not applicable | Dedicated deterministic history replay |

Totals: 36 selector/controller routes, 26 `live`, 10 `wip`, 35 strict
chip-settlement variants plus CP1's dedicated strict points gate, and no
settlement allowlist. CP1 is
classic Chinese Poker only; OFC street progression and fantasyland are not
implemented and must not be implied by its `live` status.

## Work completed in this branch

- Confirmed `codex/mgx-games-quality` and `codex/mgx-nlh-completion` are
  patch-equivalent to current `origin/main`; neither needs to be reapplied.
- Promoted ST1-ST6 from settlement allowlisting to strict enforcement.
- Normalized every Stud showdown pot with `potAmount`,
  `eligibleSeatIndexes`, and explicit winner metadata so persisted JSON retains
  enough information for deterministic settlement replay.
- Verify high, low, 8-or-better, Badugi/A-5, and Badugi/2-7 component winners
  against independently recomputed evaluators.
- Enforce result presence, exact pot/payout totals, winner eligibility, terminal
  pot echo, and stack-plus-pot chip conservation.
- Exercise all six Stud games for 10 deterministic hands each through the
  shared progression path. Existing browser coverage supplies the actionable
  Stud UI and history/replay route; the new result contract is JSON round-trip
  tested.
- Add a deterministic Stud all-in main/side-pot case proving the short-stack
  main-pot winner, deep-stack side-pot winner, and exact chip conservation.
- Promote D01-D07 and S01-S07 to strict settlement using independently
  recomputed 2-7, A-5, high, Badugi-low, Badugi-high, and split-component
  winners for ten deterministic hands per variant.
- Promote H01-H06 to strict settlement. Each source pot is reconstructed from
  player contributions, its board/draw halves and eligibility are checked,
  board and draw winners are independently evaluated, exact tied payouts are
  recomputed, and the odd chip is required on the draw half.
- Add CP1's non-chip strict points gate for 2-4 players. It independently
  recomputes every row, foul, scoop and royalty for every pair, then requires
  the published matchup list and totals to match exactly and sum to zero.

## Remaining highest-risk maturity gaps

1. Variant-specific odd-chip position rules remain broader work; current Stud
   splits are deterministic but use seat-order allocation.
2. CP1 remains classic 13-card Chinese Poker; its strict points gate does not
   imply OFC street-by-street play.
3. OFC street-by-street play and fantasyland remain unimplemented.
