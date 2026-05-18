# MGX Variant All-in Hand Visibility Spec

Scope: Core5 draw games and board-game family policy.

## Policy families

| Variant family | Examples | Policy |
|---|---|---|
| Draw games | Badugi, D01, D02, S01, S02 | `SHOWDOWN_ONLY` |
| Board games | NLH, FLH, PLO, PLO8, FLO8, 5-card PLO, Big-O | `ACTION_COMPLETE` |
| Unknown variants | Any unconfigured variant | `SHOWDOWN_ONLY` |

## Draw games: showdown-only reveal

- All-in does not reveal a draw-game hand early.
- Remaining draw rounds must still collect draw decisions from all-in, hand-eligible players.
- Non-hero all-in draw hands stay hidden in active-hand UI until showdown/result.
- Replay/debug trace may retain internal hand data, but UI visibility must respect `SHOWDOWN_ONLY`.
- Folded hands remain hidden.
- Showdown reveals non-folded, showdown-eligible hands.

## Board games: all-in action-complete reveal

- Board games may reveal all-in hands once betting action is complete and no further betting decisions remain.
- The reveal is not triggered merely by the all-in flag; action completion is required.
- Folded hands remain hidden.

## Canonical helper

Implementation source of truth:

- `src/games/_core/allInVisibilityPolicy.js`

The default is safe: unknown variants use `SHOWDOWN_ONLY`.
