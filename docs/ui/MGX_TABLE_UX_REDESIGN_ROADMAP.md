# MGX Table UX Redesign Roadmap

Date: 2026-05-19

## Goal

Improve gameplay readability without changing rules, evaluator behavior, CPU strategy, routing, or progression logic.

## P0 Gameplay Clarity

These are not engine P0s, but they are release-critical clarity issues because they cause false reports of actor/order/blind bugs.

| Priority | Item | Direction | Evidence |
| --- | --- | --- | --- |
| P0 clarity | Current actor clarity | Add a stable actor callout: name, position, required action, to-call. Mirror it in mobile decision panel. | `reports/screenshots/readability/d01-portrait-cash.png` |
| P0 clarity | Action visibility | Add a compact street action strip that persists fold/call/raise/draw decisions. | `reports/screenshots/readability/d01-desktop-cash.png` |
| P0 clarity | Position clarity | Increase and standardize BTN/SB/BB/UTG/MP/CO badges; display Hero position in controls. | `reports/ui/readability/ui-readability-smoke.json` |
| P0 clarity | Draw/BET wording | Replace terse `BET · Draw 1` with phase text that explains whether this is betting before/after a draw. | `reports/screenshots/readability/d01-portrait-cash.png` |

## P1 Replay Readability

| Priority | Item | Direction | Evidence |
| --- | --- | --- | --- |
| P1 | Street grouping | Group replay rows by blinds, BET, DRAW, SHOWDOWN, RESULT. | `reports/screenshots/readability/replay-d01-desktop.png` |
| P1 | Actor naming | Replace bare `Seat 0` rows with name + position + seat. | `reports/screenshots/readability/replay-d01-desktop.png` |
| P1 | Action sequence summary | Show one-line action order per street. | `reports/screenshots/readability/replay-d01-desktop.png` |
| P1 | Showdown story | Align replay final rows with result overlay: shown hands, winners, pot split. | Existing result/replay split |
| P1 | Replay controls | Keep frame controls, but add street jump controls. | Replay smoke shows frame controls exist |

## P2 Polish

| Priority | Item | Direction |
| --- | --- | --- |
| P2 | Chip animation | Defer until action log is persistent. |
| P2 | Card motion | Defer until card overlap and action context are stable. |
| P2 | HUD refinement | Collapse secondary tournament stats during active decisions. |
| P2 | Visual theme refinement | Only after clarity hierarchy is fixed. |

## Implementation Slices

1. `SAFE_LOW_RISK_UI_FIX`: actor/action callout and badge contrast.
2. `TABLE_ACTION_HISTORY`: current street action strip.
3. `DRAW_PHASE_COPY`: clear phase text for draw games.
4. `REPLAY_GROUPING`: group replay event rows by street.
5. `REPLAY_SHOWDOWN_STORY`: winner/pot/showdown summary.
6. `MOBILE_CONTEXT_BAR`: compact mobile actor/action/position bar.

## Non-Goals

- No gameplay rule changes.
- No routing changes.
- No RL or CPU strategy changes.
- No full table rewrite in the first pass.
- No pixel-perfect gate; use structural smoke and visual review.

## Gate

Keep `tests/e2e/ui-readability-smoke.spec.ts` as a WARN-only structural audit until quick wins are implemented. Promote individual checks to blocking only when they guard against a known playability failure, such as invisible action controls or offscreen buttons.
