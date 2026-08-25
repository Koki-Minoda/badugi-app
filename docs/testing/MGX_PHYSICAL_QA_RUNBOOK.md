# MGX Physical QA Runbook

Date: 2026-05-23

Scope: operational checklist for physical-device QA. Documentation only; no implementation, tests, engine, backend, RL, or deploy script changes.

Use with:
- `docs/testing/MGX_PHYSICAL_QA_EVIDENCE_FRAMEWORK.md`
- `docs/testing/MGX_PHYSICAL_QA_EVIDENCE_TEMPLATE.md`
- `docs/bugs/PHYSICAL_QA_PENDING.md`
- `docs/bugs/ACTIVE_BLOCKERS.md`

## Goal

Close physical blockers only with evidence that the blocker does not reproduce on the required real device/browser path. Local, emulated, and desktop-only passes are supporting evidence, not closure evidence for physical-only blockers.

## Pre-QA Preparation

Before starting any physical run:

1. Pick one blocker ID from `docs/bugs/PHYSICAL_QA_PENDING.md`.
2. Confirm whether the blocker also appears in `docs/bugs/ACTIVE_BLOCKERS.md`.
3. Open `docs/testing/MGX_PHYSICAL_QA_EVIDENCE_TEMPLATE.md` and create a filled evidence packet for the run.
4. Confirm the target URL, usually `https://mgx-poker.com/?mgxQa=mobile`.
5. Confirm the target variant and mode: cash or tournament.
6. Confirm the required device/browser mode: iPhone Safari, iPhone PWA, Android Chrome, or a combination.
7. Prepare screenshot/video capture.
8. Prepare QA/export capture if available.
9. Prepare a place to store artifacts:

```text
reports/physical/<YYYYMMDD>/<blocker-id>/
```

Required metadata before play:

- blocker ID
- device model
- OS version
- browser and mode
- orientation
- URL
- release id / commit SHA / deployed asset hash
- tester/reviewer
- local timestamp

## Target Commit And Deploy Hash Check

Record the production build before the scenario starts.

Minimum evidence:

| Item | How to capture |
| --- | --- |
| URL | Screenshot address bar or write exact URL in evidence packet. |
| commit/release id | Use visible build/debug info if available, deploy note, or server-side release record. |
| asset hash | Record the JS/CSS asset hash from production `index.html` when available. |
| API health | Record whether `/api/health` reports `status ok`, `env prod`, and `db ok` when checked separately. |

Do not close a blocker if the evidence packet cannot be tied to the intended release build.

## iPhone Safari Procedure

Use this for blockers originally reported in iPhone Safari and for all mobile Safari release gates.

1. Open Safari.
2. Navigate to the target production URL.
3. Start in portrait unless the blocker specifies landscape.
4. Capture the initial loaded table screen.
5. Record viewport and visual viewport values if available from QA/debug output.
6. Play the exact scenario path.
7. Capture screenshots at every required phase/actor boundary.
8. Collapse/expand Safari browser chrome when testing controls or safe area.
9. Rotate to landscape only when the scenario requires it.
10. Save export JSON or QA/debug logs at the end, and immediately when a failure appears.

Safari-specific pass checks:

- bottom controls are not hidden by Safari toolbar
- primary buttons are tappable after browser chrome changes
- no horizontal overflow is needed to reach actions
- phase labels and accents remain readable
- no stale Hero controls appear for non-Hero actor

## iPhone PWA Procedure

Use this for safe-area, visual viewport, standalone, and PWA release gates.

1. Install or refresh the PWA from the production URL.
2. Launch from the iOS home screen.
3. Record that the run is PWA standalone, not Safari tab mode.
4. Start in portrait.
5. Capture the table before first action.
6. Confirm bottom controls clear the iOS home indicator safe area.
7. Play the target scenario.
8. Rotate if the blocker mentions landscape or visual viewport.
9. Background and resume the PWA if the blocker mentions waiting/freezing or lifecycle.
10. Save screenshots and export JSON.

PWA-specific pass checks:

- no Safari URL bar is present
- home indicator does not cover action controls
- controls remain visible after rotate/resume
- PWA does not serve stale assets from an old install
- phase/actor state survives app resume without stale controls

## Badugi Tournament BET -> DRAW -> BET -> SHOWDOWN

Use for:

- `BADUGI-BET-DRAW-TRANSITION-001`
- `BADUGI-DRAW-BET-MIX-001`
- `PHYSICAL-MOBILE-BADUGI-WAITING-001`
- `BG-005`

Procedure:

1. Start Badugi tournament on the target physical device.
2. Capture hand start: Hero cards, pot, phase, acting seat, and controls.
3. Capture active BET state:
   - raw phase
   - displayed phase
   - no DRAW RUSHER
   - legal controls
4. Play until the last betting action before transition.
5. Capture the final BET action that should close betting.
6. Confirm transition to DRAW:
   - DRAW phase visible
   - DRAW RUSHER/red accent visible
   - no BET-only stale controls
   - acting seat is valid
7. Complete DRAW1 action path.
8. Confirm next BET:
   - BET phase visible
   - DRAW RUSHER removed
   - betting controls match legal actions
9. Continue until SHOWDOWN/result or next hand if practical.
10. Capture final state and export replay/QA JSON.

Pass conditions:

- no closed BET stall
- no mixed DRAW/BET controls
- DRAW RUSHER appears only during DRAW
- Hero controls appear only when Hero is canonical actor
- hand advances beyond every historical failing boundary

## DRAW1 CPU Action Check

Use for `BADUGI-DRAW1-CPU-ACTION-001`.

Procedure:

1. Reach DRAW1 in Badugi tournament.
2. Capture the state before CPU action:
   - phase
   - acting seat
   - CPU seat label
   - player statuses
3. Let CPU act without manual intervention.
4. Capture immediately after CPU action.
5. Continue to next playable actor or next phase.
6. Export logs/QA JSON.

Pass conditions:

- CPU acts once for the expected DRAW1 decision
- controller returns a playable state
- actor advances to a valid next actor or phase
- no CPU auto-action loop
- no stale "waiting" state remains

Failure preservation:

- if CPU action stalls, save screenshot and export immediately
- record console errors and failed network requests
- do not continue until evidence is saved

## Folded/All-In Actor Skip Check

Use for:

- `BADUGI-FOLD-DRAW-FREEZE-001`
- tournament actor legality blockers
- all-in/fold edge-case closure

Procedure:

1. Start the required cash or tournament scenario.
2. Force or play into a fold/all-in state naturally.
3. Capture the action that creates folded/all-in status.
4. Capture player statuses after the action.
5. Continue through DRAW or next betting boundary.
6. Capture every acting seat after the fold/all-in status exists.
7. Confirm no folded/all-in/busted/seat-out player receives illegal controls.
8. Export replay/QA JSON.

Pass conditions:

- folded players do not receive betting or draw controls
- all-in players do not receive betting controls
- busted or seat-out players are never acting seat
- DRAW does not revive a folded player
- terminal/no-actor states do not show stale Hero controls

## Mobile Controls And Safe-Area Check

Use for:

- `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`
- `UI-MOBILE-LANDSCAPE-CONTROLS-001`
- `CORE5-UI-CONTROLS-001`
- `CORE5-MOBILE-BROWSER-001`
- any mobile action disappearance blocker

Procedure:

1. Start the target game mode on physical device.
2. Reach a Hero decision point.
3. Capture portrait controls:
   - Fold on left
   - Call/Check in center
   - Raise/Bet on right
4. Confirm all primary buttons are visible inside the visual viewport.
5. Tap a legal action and confirm it applies.
6. Rotate to landscape when required.
7. Repeat visibility/tap check.
8. In Safari, repeat after browser toolbar changes.
9. In PWA, repeat near the home indicator safe area.
10. Capture screenshot and bounding boxes/debug output when available.

Pass conditions:

- no primary action is clipped
- no primary action is covered by browser chrome or safe area
- no horizontal scroll is required
- disabled buttons remain visible but not tappable
- legal button tap applies exactly once

## Cross-Variant Contamination Check

Use for:

- `BADUGI-HAND-SHAPE-001`
- `CROSS-VARIANT-STATE-001`

Procedure:

1. Start on production in physical Safari or PWA.
2. Play the required prior variant sequence, usually D01/D02/S01/S02 cash paths.
3. Capture variant, mode, phase, and hand shape during each prior variant.
4. Switch to Badugi tournament without clearing local app state unless the blocker specifies otherwise.
5. Capture Badugi tournament hand start.
6. Verify Badugi hand shape remains four cards.
7. Continue through BET -> DRAW if practical.
8. Export replay/QA JSON.

Pass conditions:

- Badugi starts with four-card hands
- no prior board/cards/phase/control state leaks into Badugi
- controller/session identity is correct for Badugi
- actor and legal actions are valid for Badugi

## Tournament Reseat And Busted Seat Check

Use for:

- `TOUR-SEAT-LIFECYCLE-001`
- tournament lifecycle physical blockers

Procedure:

1. Start tournament on physical mobile.
2. Capture active seats before bust/reseat.
3. Play until a bust, seat-out, or rebalance condition is reached.
4. Capture the bust/reseat moment.
5. Capture the next playable state.
6. Record actor, player statuses, stacks, and visible controls.
7. Confirm busted/out seats are compact or visually de-emphasized.
8. Confirm busted/out seats do not cover table, pot, Hero cards, or controls.
9. Export replay/QA JSON.

Pass conditions:

- busted/out seats are not eligible for action
- reseated players keep readable stack/status
- active actor remains clear
- controls remain accessible
- no tournament progression freeze

## Failure Save Rules

If any recurrence condition appears:

1. Stop advancing the hand unless one more tap is needed to expose state.
2. Take a screenshot immediately.
3. Save or export QA JSON immediately.
4. Record timestamp, handId, phase, actor, legal actions, and player statuses.
5. Capture console errors and failed network requests when possible.
6. Preserve the exact URL and release hash.
7. Save artifacts under the blocker ID.
8. Do not overwrite failure artifacts with a later passing run.
9. Keep the blocker open or reopen it as active.

Failure artifact naming:

```text
reports/physical/<YYYYMMDD>/<blocker-id>/<device-browser-mode>-<scenario>-fail.json
reports/physical/<YYYYMMDD>/<blocker-id>/<device-browser-mode>-<scenario>-fail.png
```

## Moving A Blocker To Closed Or Verified Monitor

Do not change status based on this runbook alone. First attach or reference the completed evidence packet.

Close conditions:

1. Required physical device/browser mode was tested.
2. Evidence is tied to the intended release commit/hash.
3. Historical failure boundary is covered by screenshot/video and logs.
4. Scenario advances beyond the historical failure point.
5. Phase, actor, legal actions, player statuses, and controls match.
6. No recurrence condition appears.
7. Evidence packet is filled using `MGX_PHYSICAL_QA_EVIDENCE_TEMPLATE.md`.
8. Reviewer signs off with date and residual risk.

Move to verified monitor when:

- the blocker has passed the required physical evidence packet
- the original risk is high enough to keep watching
- the monitor includes a concrete recurrence condition
- the evidence paths are linked from the blocker row

Keep active when:

- the physical mode was not tested
- the release hash is unknown or wrong
- logs/export are missing for a P0 progression/actor blocker
- any recurrence condition appears
- screenshots and logs cannot be tied to the same run

## Suggested First QA Order

1. `BADUGI-BET-DRAW-TRANSITION-001`
2. `BADUGI-DRAW1-CPU-ACTION-001`
3. `BADUGI-FOLD-DRAW-FREEZE-001`
4. `UI-MOBILE-TOURNAMENT-LANDSCAPE-001`
5. `CROSS-VARIANT-STATE-001`

