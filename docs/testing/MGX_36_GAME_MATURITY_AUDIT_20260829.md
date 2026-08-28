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
| Dramaha | H01-H06 | 6 wip | 10 hands | Allowlisted | Covered |
| Stud | ST1-ST6 | 6 live | 10 hands | Enforced | Covered |
| Chinese Poker | CP1 | 1 live | 10 hands | Points gate only; chip-pot gate not applicable | Not in the cross-variant browser replay matrix |

Totals: 36 selector/controller routes, 26 `live`, 10 `wip`, 29 strict
chip-settlement variants, and 7 explicitly allowlisted variants. CP1 is
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

## Remaining highest-risk maturity gaps

1. Dramaha settlement remains allowlisted pending normalized board/draw
   component-pot results and evaluator replay.
2. Variant-specific odd-chip position rules remain broader work; current Stud
   splits are deterministic but use seat-order allocation.
3. CP1 still needs browser history/replay coverage and a dedicated strict
   points-conservation gate.
4. OFC street-by-street play and fantasyland remain unimplemented.
