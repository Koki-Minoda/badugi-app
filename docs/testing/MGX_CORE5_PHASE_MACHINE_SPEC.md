# MGX Core5 Phase Machine Spec

Date: 2026-05-18

## Scope

Core5 variants:

- Badugi
- D01 / 2-7 Triple Draw
- D02 / A-5 Triple Draw
- S01 / 2-7 Single Draw
- S02 / A-5 Single Draw

Modes: cash and tournament.

## Canonical Source Rule

Controller snapshot wins. Legacy/session/metadata state may provide fallback only when no controller snapshot exists. A stale metadata/session/legacy phase, actor, handId, drawRound, or betRound must not override the controller snapshot.

## Canonical States

| State | Meaning |
| --- | --- |
| `HAND_START` | New hand is being initialized. |
| `POST_BLINDS` | Button/blinds/antes are assigned and paid. |
| `BET` | Betting action is open. |
| `DRAW` | Draw/discard action is open. |
| `SHOWDOWN` | Multiple players remain after final betting. |
| `COLLECT` | One-left winner or pot award path is executing. |
| `RESULT` / `HAND_RESULT` | Result overlay / hand complete state. |
| `NEXT_HAND` / `WAITING_NEXT_HAND` | No current-hand actor; next hand may start. |
| `TABLE_FINISHED` | Cash table or tournament has no next playable hand. |

## Legal Graph

| From | Legal Next |
| --- | --- |
| `HAND_START` | `POST_BLINDS`, `BET` |
| `POST_BLINDS` | `BET` |
| `BET` | `DRAW`, `SHOWDOWN`, `COLLECT`, `RESULT`, `HAND_RESULT`, `NEXT_HAND`, `TABLE_FINISHED` |
| `DRAW` | `BET`, `SHOWDOWN`, `COLLECT`, `RESULT`, `HAND_RESULT`, `NEXT_HAND`, `TABLE_FINISHED` |
| `SHOWDOWN` | `COLLECT`, `RESULT`, `HAND_RESULT`, `NEXT_HAND`, `TABLE_FINISHED` |
| `COLLECT` | `RESULT`, `HAND_RESULT`, `NEXT_HAND`, `TABLE_FINISHED` |
| `RESULT` / `HAND_RESULT` | `NEXT_HAND`, `TABLE_FINISHED`, next hand `HAND_START`/`POST_BLINDS`/`BET` |
| `NEXT_HAND` / `WAITING_NEXT_HAND` | `HAND_START`, `POST_BLINDS`, `BET`, `TABLE_FINISHED` |

## Variant Sequences

Badugi / D01 / D02:

```txt
BET1 -> DRAW1
DRAW1 -> BET2
BET2 -> DRAW2
DRAW2 -> BET3
BET3 -> DRAW3
DRAW3 -> BET4
BET4 -> SHOWDOWN/COLLECT/RESULT
```

S01 / S02:

```txt
BET1 -> DRAW1
DRAW1 -> BET2
BET2 -> SHOWDOWN/COLLECT/RESULT
```

## Actor Ownership

- `BET`: actor must be a live, non-folded, non-all-in, non-busted player who needs betting action.
- `DRAW`: actor must be a live, non-folded, non-busted player eligible to draw.
- Terminal states (`SHOWDOWN`, `COLLECT`, `RESULT`, `NEXT_HAND`, `TABLE_FINISHED`) must not expose an active actor or Hero controls.

## Round Closure

Betting round closes when every non-folded, non-all-in player has acted and matched `currentBet`, or only one live player remains.

Draw round closes when every eligible non-folded player has completed a draw decision. Single Draw variants must not enter draw round 2.

## P0 Impossible States

| Type | Condition |
| --- | --- |
| `IMPOSSIBLE_PHASE_TRANSITION` | Transition is not in the legal graph. |
| `DRAW_BET_MIXED_STATE` | `BET` exposes draw controls, or `DRAW` exposes betting controls. |
| `TERMINAL_WITH_ACTOR` | Terminal phase still has controller actor or Hero controls. |
| `COLLECT_WITH_PENDING_ACTION` | Collect path still has pending action actor. |
| `PHASE_REGRESSION` | Same hand rolls drawRound/betRound backward. |
| `STALE_PHASE_MERGE` | Controller phase/actor/drawRound is overridden by stale session/legacy/metadata. |
| `MULTI_ACTOR_STATE` | Controller/nextTurn/merged actor disagree. |
| `ILLEGAL_DRAW_SEQUENCE` | Draw round exceeds variant maximum. |

## Release Gate

Core5 phase machine release gate passes only when all P0 counts are zero in focused tests and browser gameplay matrix:

- `IMPOSSIBLE_PHASE_TRANSITION = 0`
- `DRAW_BET_MIXED_STATE = 0`
- `STALE_PHASE_MERGE = 0`
- `TERMINAL_WITH_ACTOR = 0`
- `ILLEGAL_DRAW_SEQUENCE = 0`
