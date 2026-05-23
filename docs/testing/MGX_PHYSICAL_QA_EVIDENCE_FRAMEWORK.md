# MGX Physical QA Evidence Framework

Date: 2026-05-23

Scope: planning and documentation only. This framework defines the evidence required to close physical-device release blockers. It does not change game logic, UI code, tests, backend, RL, deployment, or data schemas.

Purpose:
- Treat "fixed locally" as insufficient for physical-device blockers.
- Require proof that the issue does not reproduce on the original physical device/browser path.
- Standardize iPhone Safari and iPhone PWA evidence.
- Make P0 blocker closure auditable with screenshots, logs, DOM captures, and replay exports.

Related release docs:
- `docs/bugs/ACTIVE_BLOCKERS.md`
- `docs/bugs/PHYSICAL_QA_PENDING.md`
- `docs/bugs/RELEASE_GATES.md`
- `docs/planning/MGX_ACTIVE_TECH_DEBT_AUDIT.md`

## 1. Physical QA Targets

Physical QA is required for any release-blocking row where Playwright emulation, unit tests, or local browser checks cannot prove the user path.

Required target scenarios:

| Scenario | Required coverage | Blocks release when missing |
| --- | --- | --- |
| Badugi tournament phase path | BET -> DRAW -> BET -> SHOWDOWN, including visible phase labels and legal controls. | Yes |
| Folded/all-in actor skip | Folded, all-in, busted, and seat-out players are not elected as acting seat. | Yes |
| DRAW1 CPU action | CPU completes DRAW1 discard/action and the hand remains playable. | Yes |
| Mobile controls | Fold, Call/Check, Raise/Bet remain visible and tappable. | Yes |
| Safe area | Bottom controls are not hidden by iOS home indicator, Safari toolbar, or PWA safe area. | Yes |
| Visual viewport | Layout remains valid after browser chrome expands/collapses and after rotation. | Yes |
| Tournament reseat | Reseat/balance does not corrupt actor, stack, seat status, or visible controls. | Yes for tournament alpha |
| Busted seat | Busted/out seats are compact, readable, and not eligible for action. | Yes for tournament alpha |
| Cross-variant contamination | D01/D02/S01/S02 paths followed by Badugi tournament do not leak cards, phase, controller, or hand shape. | Yes |

## 2. Required Devices

Minimum friend-alpha physical matrix:

| Device/browser | Required | Purpose |
| --- | --- | --- |
| iPhone Safari | Required | Primary reproduction path for mobile P0 reports. |
| iPhone PWA standalone | Required | Verifies safe-area, visual viewport, and installed-app behavior. |
| Android Chrome | Required for Core5 smoke, optional for Badugi-only closure unless the blocker mentions Android. | Cross-browser mobile sanity. |
| Desktop Chrome/Safari | Support evidence only. | Confirms production build and debug/export behavior, but does not close iPhone-only blockers. |

Each evidence packet must record:
- device model
- OS version
- browser and browser version when available
- Safari tab mode or PWA standalone mode
- orientation: portrait or landscape
- viewport dimensions reported by the page
- URL
- deployed commit SHA or release identifier
- scenario ID from `PHYSICAL_QA_PENDING.md` or `ACTIVE_BLOCKERS.md`

## 3. Safari/PWA Differences

Safari and PWA evidence are not interchangeable.

Safari evidence must cover:
- URL bar and toolbar visible at initial load.
- URL bar collapsed after scrolling/tapping when applicable.
- orientation changes with browser chrome present.
- controls near bottom edge with normal Safari safe area.

PWA evidence must cover:
- standalone launch from home screen.
- no Safari URL bar.
- iOS home indicator safe area.
- app resume from background when possible.
- orientation changes inside standalone mode.

Closure rule:
- If a blocker was originally reported in Safari, Safari evidence is mandatory.
- If a blocker affects safe-area, bottom controls, visual viewport, or installed mobile use, PWA evidence is mandatory too.
- A blocker can be marked "physical-only closed" only when the relevant physical mode has passing evidence.

## 4. Required Screenshots

Every physical QA packet must include screenshots or short video frames for the exact release-blocking moment.

Minimum screenshots for Badugi tournament:

| Moment | Screenshot requirement |
| --- | --- |
| Hand start | Table, Hero cards, pot, phase/round display, acting seat, and controls if Hero acts. |
| BET active | BET phase visible; no DRAW RUSHER; legal Fold/Call-or-Check/Raise-or-Bet state visible. |
| BET closing action | Last action that should transition to DRAW, with pot and acting seat visible. |
| DRAW active | DRAW phase visible; DRAW RUSHER/red accent visible; discard/draw UI or CPU action status visible. |
| DRAW1 CPU action | CPU acting or completed state, then next playable state. |
| Next BET | BET phase restored; DRAW RUSHER absent; controls match legal betting state. |
| SHOWDOWN/result | SHOWDOWN/result visible; no stale actor controls; next-hand entry visible when applicable. |
| Next hand | New hand has correct hand shape, phase, actor, and reset controls. |

Minimum screenshots for mobile controls:

| Moment | Screenshot requirement |
| --- | --- |
| Portrait before tap | Fold, Call/Check, Raise/Bet all visible in one row when applicable. |
| Portrait after browser chrome change | Bottom controls still visible and tappable. |
| PWA standalone | Bottom controls clear iOS home indicator safe area. |
| Landscape | Controls are inside viewport; no horizontal scroll required. |
| Disabled state | Disabled controls remain visible but not misleading. |

Minimum screenshots for tournament seats:

| Moment | Screenshot requirement |
| --- | --- |
| Before bust | Seat stack, status, actor, and controls visible. |
| Bust action/result | Eliminated player status visible and not acting. |
| After bust | Busted/out seat compacted or visually de-emphasized; no controls blocked. |
| Reseat/balance | New seat assignment, stack, and actor are readable. |

## 5. Required Logs

Screenshots alone are insufficient for P0 closure. Each physical packet must include logs or exports that prove the underlying state matched the visual state.

Required log fields:

| Field | Requirement |
| --- | --- |
| timestamp | Local timestamp for each capture step. |
| release id | Commit SHA, build id, or deployed hash. |
| scenario id | Bug/blocker ID, for example `BADUGI-BET-DRAW-TRANSITION-001`. |
| variant | `badugi`, `D01`, `D02`, `S01`, `S02`, or exact registry id. |
| mode | cash or tournament. |
| handId | Required when available. |
| phase | Raw phase and display-normalized phase. |
| round/draw index | Draw number and round number when available. |
| acting seat | Seat index and position label, for example MP. |
| hero seat | Seat index and position label. |
| legal actions | Legal action names and disabled/enabled UI state. |
| player statuses | Folded, all-in, busted, seat-out, mucked. |
| pot/stack | Pot amount, to-call amount, Hero stack, acting player stack. |
| deck/hand shape | Card counts for relevant players; Badugi must remain four-card. |
| CPU source | decisionSource, fallbackReason, cpuPolicy, or explicit "not captured". |
| errors | Console errors, uncaught exceptions, failed network requests. |

Acceptable evidence sources:
- existing QA/debug export JSON
- browser console copied from the physical device remote inspector
- screenshot plus manually transcribed DOM/debug panel values
- server/API logs tied to a session id
- database rows tied to the same session id

Non-acceptable evidence:
- "Works locally" without physical capture.
- Playwright-only screenshots for physical-only blockers.
- A screenshot with no phase/actor/handId or no way to tie it to the blocker.
- A different browser mode than the original reported failure path.

## 6. Required DOM Attributes

Physical QA should capture DOM/debug state for the same moment as the screenshot. If a field is not currently exposed as a DOM attribute, capture it from the QA/debug panel or exported JSON instead.

Required DOM/debug fields:

| Field | Required value or rule |
| --- | --- |
| app route | Current game route and table mode. |
| variant id | Exact variant id. |
| mode | cash or tournament. |
| layout mode | desktop, mobile-portrait, mobile-landscape, or equivalent. |
| viewport width/height | CSS viewport size from the page. |
| visual viewport width/height | VisualViewport dimensions when available. |
| safe-area evidence | Bottom inset or screenshot showing home indicator clearance. |
| phase raw | Raw state phase. |
| phase display | Visible phase label. |
| phase accent | BET is non-red; DRAW uses red accent/DRAW RUSHER; SHOWDOWN/WAITING do not keep DRAW RUSHER. |
| acting seat | Canonical acting seat index and label. |
| hero active | Whether Hero is allowed to act. |
| controls visible | Fold/Call-or-Check/Raise-or-Bet bounding boxes inside viewport. |
| controls enabled | Enabled/disabled state matches legal actions. |
| horizontal overflow | Must be false for mobile portrait and landscape controls. |
| table bounds | Table/board/seat region inside visible viewport enough to identify actor and pot. |

For mobile controls, capture bounding boxes:
- Fold button: x, y, width, height.
- Call/Check button: x, y, width, height.
- Raise/Bet button: x, y, width, height.
- viewport width and height.
- visual viewport width and height when available.
- bottom distance from each button to visual viewport bottom.

Pass rule:
- Each primary action button must be fully inside the visual viewport when it is expected to be visible.
- No primary action button may be covered by Safari toolbar, PWA home indicator safe area, or another UI layer.
- Horizontal overflow must be absent.

## 7. Phase/Actor Capture Rules

Capture phase and actor at every boundary, not just at the start and end.

Required phase sequence for Badugi tournament:

1. Initial BET.
2. Last action before BET closes.
3. First DRAW state.
4. DRAW1 CPU action or Hero draw/discard decision.
5. First BET state after DRAW.
6. Later DRAW/BET boundaries when reached.
7. SHOWDOWN or result.
8. Next hand reset.

For each boundary, record:
- raw phase
- displayed phase
- phase accent state
- draw index, round index, and street label if present
- canonical acting seat
- Hero active state
- legal action list
- visible controls
- pot and to-call
- player statuses

Actor pass rules:
- Acting seat must be active, seated, not busted, not seat-out, not folded for future action, and not terminal all-in unless the current rules explicitly require no action.
- If no actor should exist, the UI must show terminal/result/waiting state and no stale Hero controls.
- Hero controls must appear only when Hero is the canonical actor and has legal actions.
- CPU auto-action must not repeatedly elect the same ineligible seat.

## 8. Fold/All-In/Draw Capture

Fold/all-in/DRAW evidence must prove both visual state and engine-derived state.

Required capture points:

| Path | Capture |
| --- | --- |
| Hero folds before DRAW | Screenshot after fold, log showing Hero folded, no Hero controls, next eligible actor selected. |
| CPU folds before DRAW | Folded CPU visually de-emphasized, log showing not re-elected. |
| Player all-in before DRAW | All-in status visible, no illegal action prompt, hand progresses. |
| Folded/all-in player during DRAW | Draw/discard action is skipped or handled according to rules; no freeze. |
| DRAW1 CPU action | CPU action completes once, draw/discard result captured, next phase/actor valid. |
| Mucked/busted seat | Seat is visually compact/de-emphasized and not elected. |

Pass rules:
- Folded players cannot receive betting or draw controls.
- All-in players cannot receive betting controls.
- Busted or seat-out players cannot be acting seat.
- DRAW must not revive a folded player.
- SHOWDOWN must not leave a stale actor or stale DRAW controls.

## 9. Replay Export Rules

Every P0 physical closure should include a replay/export artifact when available.

Required export metadata:
- blocker ID
- device/browser/mode/orientation
- release id or commit SHA
- URL
- timestamp
- variant and mode
- table/tournament id if available
- session id if available
- handId
- raw phases and displayed phases
- actor sequence
- action sequence
- legal actions per decision
- player statuses per step
- pot/stack changes
- card counts and board counts
- CPU source/fallback metadata when available
- console/network errors

Export naming convention:

```text
reports/physical/<YYYYMMDD>/<blocker-id>/<device-browser-mode>-<scenario>-<pass-or-fail>.json
reports/physical/<YYYYMMDD>/<blocker-id>/<device-browser-mode>-<scenario>-<step>.png
```

Example:

```text
reports/physical/20260523/BADUGI-BET-DRAW-TRANSITION-001/iphone-safari-portrait-bet-draw-pass.json
reports/physical/20260523/BADUGI-BET-DRAW-TRANSITION-001/iphone-safari-portrait-draw-active.png
```

Failure exports must preserve the failing state. Do not overwrite them with a later passing run.

## 10. Release Signoff Conditions

A physical blocker can be closed only when all required evidence exists and points to the same release build.

Required close packet:

| Evidence | Required |
| --- | --- |
| Bug/blocker ID | Yes |
| Device/browser/mode | Yes |
| Release id/commit/deployed hash | Yes |
| Scenario steps | Yes |
| Screenshots/video frames | Yes |
| Phase/actor capture | Yes |
| Legal controls capture | Yes |
| Player status capture | Yes for actor/fold/all-in/bust blockers |
| Replay/export JSON | Required when available; otherwise explain why unavailable |
| Console/network error status | Yes |
| Pass/fail conclusion | Yes |
| Reviewer/signoff | Yes |

Signoff language:

```text
Physical QA close: <blocker-id>
Device/browser: <device>, <OS>, <Safari/PWA/Chrome>, <orientation>
Release: <commit/build/hash>
Scenario: <short path>
Evidence: <paths to screenshots/logs/export>
Result: PASS, no recurrence observed
Residual risk: <none or listed>
Signed off by: <name/date>
```

Do not close if:
- the evidence is from local desktop only
- the evidence uses a different release build
- screenshots and logs cannot be tied to the same run
- the original failure browser mode was not tested
- phase, actor, and legal actions were not captured
- any recurrence condition below is observed

## Minimum Evidence Required To Close A Release Blocker

For P0 progression/actor blockers:

1. Physical device screenshot/video at the failing boundary.
2. Log/export with handId, phase, actor, legal actions, player statuses, and pot/stack.
3. At least one full successful continuation beyond the historical failure point.
4. No console errors or failed critical requests during the scenario.
5. Same release commit/hash as the intended alpha deploy.
6. Evidence path recorded in the blocker row before closing.

For mobile control blockers:

1. Physical screenshot in Safari and PWA if safe-area/visual viewport is involved.
2. Button bounding boxes or visible proof that Fold, Call/Check, and Raise/Bet are inside the visual viewport.
3. Tap proof for at least one legal action.
4. Proof of no horizontal overflow.
5. Orientation evidence if the blocker mentions landscape or rotation.

For cross-variant contamination blockers:

1. Physical path showing prior variant sequence.
2. Badugi tournament start after that sequence.
3. Badugi hand shape remains four cards.
4. Phase, controller/session, and handId evidence.
5. No stale board/cards/phase from prior variant.

For tournament reseat/busted seat blockers:

1. Physical tournament state before bust/reseat.
2. Bust/reseat moment.
3. Next playable state after bust/reseat.
4. Actor and eligibility logs showing busted/out seats are not elected.
5. Screenshot showing busted/out seats do not block controls or table readability.

## Recurrence Conditions

Any of the following reopens or keeps open the blocker:

| Condition | Classification |
| --- | --- |
| Hand stops at BET -> DRAW, DRAW -> BET, or BET -> SHOWDOWN boundary. | P0 recurrence |
| UI shows DRAW while legal controls are BET, or BET while draw/discard action is expected. | P0 recurrence |
| DRAW RUSHER/red accent appears outside DRAW. | P1/P0 depending on control drift |
| DRAW phase lacks DRAW RUSHER/red accent on physical device. | P1; P0 if it hides legal action context |
| Hero controls appear when Hero is not canonical actor. | P0 recurrence |
| Hero controls disappear when Hero is canonical actor with legal actions. | P0 recurrence |
| Folded, all-in, busted, or seat-out player is elected for illegal action. | P0 recurrence |
| CPU auto-action loops without advancing actor/phase. | P0 recurrence |
| Fold/Call/Raise are clipped, covered, or untappable. | P0 recurrence |
| Horizontal overflow prevents action access on mobile. | P0 recurrence |
| Badugi hand contains more or fewer than four cards after cross-variant path. | P0 recurrence |
| Busted/out tournament seat blocks controls or is visually indistinguishable from active actor. | P1/P0 depending on actor impact |
| Console error or failed API request coincides with stalled progression. | P0 until triaged |

## Physical-Only Blocker Definition

A physical-only blocker is a release blocker that:

1. Was reported on a real device/browser path.
2. Cannot be reproduced in local unit tests, desktop browser, or Playwright emulation.
3. Affects progression, actor legality, mobile controls, visual viewport, safe area, PWA behavior, or device-specific lifecycle.
4. Requires physical evidence to close.

Physical-only blocker policy:
- Automated passing tests can reduce risk but cannot close the blocker.
- Closure requires the minimum evidence packet for the original device/browser path.
- If the original path is unknown, test iPhone Safari and iPhone PWA at minimum.
- If physical evidence fails, preserve the failure export and reopen/keep the blocker as P0 unless the issue is proven cosmetic.
- If physical evidence passes twice on the same release build and no recurrence condition is observed, the blocker may move from active blocker to verified monitor with links to evidence.

## Evidence Review Checklist

Before changing a blocker status to closed or verified monitor:

1. Evidence is from a physical device, not emulation.
2. Device/browser/mode matches the blocker.
3. Release id matches intended deploy.
4. Screenshots cover the historical failure moment.
5. Logs/export cover phase, actor, legal actions, and statuses.
6. Scenario advances beyond the historical failure point.
7. No recurrence condition appears.
8. Evidence paths are listed in the blocker row.
9. Reviewer signs off with date and residual risk.

