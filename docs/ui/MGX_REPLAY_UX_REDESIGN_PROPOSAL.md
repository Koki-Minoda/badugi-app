# MGX Replay UX Redesign Proposal

Date: 2026-05-19

## Problem

The current replay screen is functional but reads like a raw frame debugger. It has frame controls, event rows, and seat snapshots, but it does not quickly answer:

- Who acted?
- In what order?
- Which street or draw round was this?
- What changed because of the action?
- Why did the hand end?

Evidence:

- `reports/screenshots/readability/replay-d01-desktop.png`
- `reports/ui/readability/ui-readability-smoke.json`

## Proposed Information Hierarchy

1. Hand summary: variant, stakes/blinds, button/SB/BB, final pot, winner.
2. Street groups: `Blinds`, `BET1`, `DRAW1`, `BET2`, `Showdown`, `Result`.
3. Action rows: position + name + action + amount/draw count.
4. State delta: pot, to-call/current bet, actor after action.
5. Player state: cards only where policy allows; stack/invested concise.
6. Controls: frame step, street jump, play speed.

## Event Row Format

Current style:

```txt
Seat 0 call Δ20 · #3
```

Recommended style:

```txt
BET1 · BTN You call 20 · Pot 30 -> 50 · Next: SB Mina
DRAW1 · BB Ren draws 2 · Next: UTG Sora
RESULT · You wins 120
```

## Street Grouping

Replay should show collapsible groups:

```txt
Blinds
  SB Mina posts 10
  BB Ren posts 20
BET1
  UTG Sora folds
  MP Hana calls 20
  BTN You calls 20
DRAW1
  BB Ren draws 2
  ...
```

## Mobile Replay

Mobile replay should default to a compact story list:

- current street header sticky
- one action row per event
- tap row to inspect table snapshot
- street jump controls instead of relying only on frame scrubber

## Acceptance Criteria

- A user can identify first actor and action order without reading raw seat numbers.
- Every action row includes name and position when available.
- Replay groups events by betting/draw street.
- Showdown/result rows show winner and pot movement.
- Mobile replay has no horizontal overflow and street controls are tappable.

## Suggested First Implementation

Add a derived replay view model that transforms existing frames/events into grouped display rows. Do not rewrite replay persistence or hand-history storage in the first pass.
