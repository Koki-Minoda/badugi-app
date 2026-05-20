# MGX Replay and Table Readability Audit

Date: 2026-05-19

## Scope

This audit covers readability and information architecture for Core5 gameplay and replay. It is not a gameplay-rule audit and does not change progression, RL routing, or evaluator logic.

Evidence was captured with:

```bash
npx playwright test tests/e2e/ui-readability-smoke.spec.ts --project=badugi-flow
```

Result: `WARN`, 10/10 tests passed. WARN rows are structural readability risks, not action/progression failures.

## Evidence

| Scenario | Screenshot |
| --- | --- |
| Badugi desktop cash | `reports/screenshots/readability/badugi-desktop-cash.png` |
| Badugi portrait cash | `reports/screenshots/readability/badugi-portrait-cash.png` |
| Badugi landscape tournament | `reports/screenshots/readability/badugi-landscape-tournament.png` |
| D01 desktop cash | `reports/screenshots/readability/d01-desktop-cash.png` |
| D01 portrait cash | `reports/screenshots/readability/d01-portrait-cash.png` |
| D01 landscape tournament | `reports/screenshots/readability/d01-landscape-tournament.png` |
| S01 desktop cash | `reports/screenshots/readability/s01-desktop-cash.png` |
| S01 portrait cash | `reports/screenshots/readability/s01-portrait-cash.png` |
| S01 landscape tournament | `reports/screenshots/readability/s01-landscape-tournament.png` |
| D01 desktop replay | `reports/screenshots/readability/replay-d01-desktop.png` |

Structured report:

- `reports/ui/readability/ui-readability-smoke.json`

Videos were not captured in this pass.

## Matrix

| Category | Symptoms | Repro / Evidence | Severity | Root Cause | Direction | Difficulty | Gameplay Impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ACTION_VISIBILITY` | It is hard to tell who just folded/called/raised without reading side status panels. Action vocabulary count is low in table view. | D01/S01 desktop and mobile screenshots; smoke report records only 1-2 visible action terms. | P1 | No persistent street action rail; last action is buried in seat panels or transient text. | Add a compact current-street action strip grouped by actor and street. | M | High: users misread legal order and CPU behavior. |
| `CURRENT_ACTOR_VISIBILITY` | The active seat has a border/status, but it competes with cards, stack pills, and HUD. Mobile `Waiting for other players...` does not name the pending actor. | D01 desktop cash, D01 portrait cash. | P1 | Actor state is visually distributed across table, sidebar, and decision panel. | Centralize actor callout: seat name/position/action required in one stable area. | S-M | High: users suspect wrong actor order. |
| `POSITION_CLARITY` | BTN/SB/BB/UTG labels are easy to miss or confuse with player names/stack pills. Automated smoke flags low position-badge density. | All table screenshots; prior BB/UTG physical reports. | P1 | Position badges are small local tags with weak hierarchy and no cross-check in the action panel. | Make position badges larger/consistent; mirror Hero position and next actor in action panel. | S | High: creates false blind/order bug reports. |
| `SEAT_IDENTITY` | Seat names, position, and status are split across table panels and sidebar. Mobile loses the sidebar context. | D01 portrait cash; desktop sidebar vs mobile table-only view. | P2 | Desktop has a table-status sidebar; mobile does not preserve the same identity summary. | Add mobile compact seat legend or action log with name + position. | M | Medium: repeated play requires scanning seat identity quickly. |
| `CARD_READABILITY` | Cards are readable, but desktop opponent panels occupy large overlapping clusters around the pot. | D01 desktop cash. | P2 | Dense seat cards and table geometry compete near center. | Keep card size, but reduce overlap around pot/action lane. | M | Medium: hand state is visible but table scanning is slow. |
| `CARD_OVERLAP` | Opponent card panels visually overlap table center and nearby panels on desktop; mobile cards fit but crowd pot/phase. | D01 desktop cash, D01 portrait cash. | P1/P2 | Seat panels are large relative to table surface; no reserved center lane. | Reserve pot/action center lane; cap opponent card strip width. | M | Medium-high: overlap increases misclick and misread risk. |
| `BETTING_VISIBILITY` | Current bet, to-call, raise unit, cap are visible only in Hero controls, not as a table-wide betting story. | D01 portrait cash. | P1 | Betting info is hero-centric; no street-level contribution summary. | Add current-street contribution/action summary. | M | High: users cannot verify whether BB/SB paid or who raised. |
| `POT_VISIBILITY` | Pot is visible and in-bounds in smoke, but can visually collide with center table state on mobile. | Portrait screenshots; prior pot-overlap history. | P2 | Pot badge shares center space with phase and seat card strips. | Keep pot in stable center, reduce adjacent badges. | S | Medium: pot is readable in evidence but fragile. |
| `DRAW_STATE_VISIBILITY` | Phase badge says `BET · Draw 1`, while draw count also appears as separate number; users may read it as mixed state. | D01 portrait cash, replay screenshot. | P1 | Phase and draw round labels are split and use terse copy. | Use explicit `Betting after Draw 1` / `Draw 1 decision` text. | S | High for draw games: phase confusion caused physical reports. |
| `REPLAY_TIMELINE` | Replay exposes frames and event rows, but the frame list is raw and long. | `replay-d01-desktop.png`, 11 event rows. | P1 | Timeline is frame-based, not street/action-group based. | Group by blinds, BET1, DRAW1, BET2, showdown/result. | M | High for debugging and learning. |
| `REPLAY_EVENT_GROUPING` | Actions are listed as repeated `Seat 0 call/pat/check`; names/positions and street groups are not first-class. | Replay screenshot. | P1 | Event rendering favors raw action sequence over player-readable hand story. | Show actor name + position + action; collapsible street groups. | M | High: replay does not answer “who did what when”. |
| `REPLAY_ACTION_ORDER` | Replay can step frame-by-frame, but action order is not summarized as a single street sequence. | Replay screenshot. | P1 | No street-level sequence lane. | Add one-line per-street sequence: `UTG fold -> MP call -> CO raise`. | M | High for actor/order trust. |
| `MOBILE_TOUCH_ERGONOMICS` | Controls fit in smoke, but mobile action area is below a dense table and uses large vertical travel. | D01 portrait cash; mobile matrix screenshots. | P2 | Table and controls are separated by large phase panel; no sticky compact action log. | Keep controls stable; add top-of-controls actor/action summary. | S-M | Medium: actions are usable, context is weak. |
| `TOURNAMENT_INFO_HIERARCHY` | Tournament side/HUD data competes with phase/action info, especially landscape. | Landscape tournament screenshots. | P2 | Tournament info is not prioritized by play moment. | Reduce tournament HUD to level/remaining/current blind during hand; expand details on demand. | M | Medium: can obscure decision context. |
| `SHOWDOWN_READABILITY` | Result overlays are reachable, but showdown/winner story is separate from replay timeline. | Existing result gates; replay screenshot hand-end row. | P1 | Result and replay use different information hierarchy. | Align result overlay with replay: winners, shown hands, pot breakdown, final action. | M | Medium-high for learning and trust. |
| `ANIMATION_TIMING` | No direct video evidence in this pass; prior user reports imply transient actions are easy to miss. | Needs video capture. | P2 | Action labels may be transient and not mirrored in persistent log. | Add persistent log first; tune animation later. | S-M | Medium. |
| `HUD_DENSITY` | Desktop side status is useful but can dominate; mobile loses that information and relies on table labels. | D01 desktop vs portrait screenshots. | P2 | Different desktop/mobile information hierarchy. | Define a shared minimum: actor, last action, position, pot, phase, tournament level. | M | Medium. |
| `TOURNAMENT_SEAT_LIFECYCLE` | Busted/out CPU panels can remain as large table seats and cover pot/cards/Hero area on physical mobile. | Physical mobile Badugi tournament screenshot; `TOUR-SEAT-LIFECYCLE-001`. | P1/P0 | Tournament state correctly tracks busts, but display layout did not compact eliminated seats away from active table geometry. | Hide eliminated seats from the full table layout and show them in a compact eliminated rail. | S-M | High: gameplay may continue, but table readability becomes close to unusable. |
| `MOBILE_TOURNAMENT_LANDSCAPE_ACTIONS` | iPhone PWA/standalone landscape can show Hero Controls while clipping Call/Raise/Fold below the viewport. | Physical iPhone PWA Badugi tournament screenshot; `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`. | P0 | Right-column vertical allocation gives HUD/phase/context/stat rows space before reserving a guaranteed action-button area. | In mobile landscape tournament, compact HUD/phase/context first and keep action buttons fully visible/tappable without scroll. | S-M | Critical: Hero is actor but cannot play. |
| `MOBILE_TOURNAMENT_TABLE_DENSITY` | Physical iPhone tournament play is technically progressing, but table/card/player recognition is too dense because HUD, rail, phase, and Hero metadata remain permanently visible. | Physical iPhone tournament QA; `reports/ui/mobile-tournament-readability.json`; `reports/screenshots/mobile-readability/`. | P1 | Mobile tournament information hierarchy treated prize/next/remaining/rail/phase as always-visible peers with cards, actor, pot, and actions. | Make mobile tournament HUD one-row by default, collapse rail/details, inline the phase strip, suppress inactive seat metadata, and preserve 55-60%+ table battlefield height. | S-M | High: gameplay is possible but too tiring and error-prone for real tournament play. |

## Desktop vs Mobile

Desktop has more room but also more competing panels: top nav, table status, center table, right action panel, and bottom latency overlay. The D01 desktop screenshot shows the useful sidebar, but the main table still has large card panels clustered around the pot.

Mobile portrait is playable and has no horizontal overflow in the smoke, but loses the desktop table-status sidebar. This makes position and prior action harder to verify. The action panel says `Waiting for other players...`, but does not name the pending actor or show the already-resolved street sequence.

Mobile landscape has enough width for tournament play but compresses tournament HUD, table, and action context into a dense view. It should be treated as a readability risk even when automation passes.

iPhone PWA/standalone does not remove the landscape tournament risk. The URL bar is not the root cause when the right column itself allocates more vertical content than the visual viewport can show. The layout policy now treats Hero action buttons as the first priority and tournament details as collapsible/compact context.

## Classification of Prior User Confusion

| User Report Class | Audit Classification |
| --- | --- |
| “BB did not pay / UTG skipped?” | `POSITION_BADGE_CONFUSION` + `ACTION_VISIBILITY_CONFUSION` unless action-history trace proves logic failure |
| “Who acted?” | `ACTION_VISIBILITY` / `CURRENT_ACTOR_VISIBILITY` |
| “DRAW and BET mixed?” | `DRAW_STATE_VISIBILITY`; remains P0 only if settled controls truly mix, otherwise readability copy issue |
| “Replay is hard to read” | `REPLAY_EVENT_GROUPING` / `REPLAY_ACTION_ORDER` |
| “Mobile is hard to tap/read” | `MOBILE_TOUCH_ERGONOMICS` / `HUD_DENSITY` |

## Low-Risk Quick Wins

These are allowed before a full redesign because they do not alter game rules or routing:

- Add pending actor name/position to `Waiting for other players...`.
- Persist last 3-5 street actions near the table.
- Make Hero position and current actor position appear in the decision panel.
- Increase badge contrast/size for BTN/SB/BB/UTG/MP/CO.
- Rename draw-game phase copy to reduce `BET · Draw n` ambiguity.
- Keep action labels visible until superseded by the next action.
- Add replay street headers and actor name/position to each event row.
- Move busted/out tournament seats to a compact eliminated rail instead of full table panels.
- Reserve mobile landscape tournament space for Hero action buttons before HUD/phase/detail rows.
- Reserve mobile tournament battlefield before metadata; default prize, next level, and rail details to collapsed/compact states.

## Recommendation

Start with table/action readability quick wins and a replay redesign proposal. Do not start a full layout rewrite until the physical Badugi P0 recheck and remote sync are cleared.
