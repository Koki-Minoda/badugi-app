# MGX Core 5 UI Acceptance Criteria

Date: 2026-05-16

Scope:

- Badugi
- 2-7 Triple Draw
- A-5 Triple Draw
- 2-7 Single Draw
- A-5 Single Draw

This document defines the UI/layout acceptance gate for friend-alpha usability. It does not change game rules, progression, routing, AI/RL behavior, or variant availability.

## Desktop Gate

| Item | Acceptance Criteria |
| --- | --- |
| Table visibility | The whole active table area is visible at 1440x900 and 1280x720 without horizontal scrolling. |
| Hero cards | Hero cards are visible and not covered by the pot badge, phase badge, action controls, or overlays. |
| CPU cards | CPU card strips are visible enough to communicate seat state; minor compacting is acceptable. |
| Pot | The pot display is visible during active hands and does not obstruct the hero controls. |
| Phase | Phase, draw round, and betting state are visible enough to understand the current step. |
| Actions | Fold/call/check/raise/draw controls are visible when action is required. |
| Result overlay | Hand Result content is readable, including pot/result summary. |
| Next hand | The Next Hand control is visible and clickable after a hand result. |
| Replay/coaching | Replay/coaching entry points must not break the primary gameplay layout. |

## Mobile Portrait Gate

| Item | Acceptance Criteria |
| --- | --- |
| Horizontal overflow | No horizontal document overflow at 390x844 and 430x932. |
| Actions | Action controls are visible, tappable, and not blocked by table elements. |
| Tap target | Primary action controls should be approximately 44px high or larger when possible. |
| Pot | Pot remains visible and does not cover the action row. |
| Phase | Phase/draw/bet status remains visible. |
| Hero cards | Hero cards remain visible and not fully clipped. |
| CPU cards | CPU cards may be compact, but should not be fully hidden. |
| Player labels | Player name/stack/status must remain minimally readable. |
| Result overlay | Result overlay fits the viewport or can be read without losing the action path. |
| Dashboard/coaching | Dashboard and coaching panels remain readable enough for alpha feedback. |
| Browser chrome | Core controls remain reachable with mobile browser chrome present. |

## Mobile Landscape Gate

| Item | Acceptance Criteria |
| --- | --- |
| Horizontal overflow | No horizontal document overflow at 844x390. |
| Table framing | Table uses the wider viewport without clipping the hero/action zone. |
| Actions | Action controls are visible and tappable. |
| Pot/phase | Pot and phase remain visible. |
| Cards | Hero cards and key CPU seat cards are visible enough to play. |
| Result overlay | Result overlay remains usable. |

## Classification

| Priority | Meaning |
| --- | --- |
| P0 | Operation-blocking: action buttons unusable, game cannot be completed, or core table content is inaccessible. |
| P1 | Friend-alpha blocker candidate: readable/playable but too visually fragile for external testing. |
| P2 | Polish issue that can remain after alpha if the game remains playable. |
| MONITOR | Previously fixed or borderline behavior that should stay in visual smoke coverage. |

