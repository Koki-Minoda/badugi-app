# MGX Alpha Playable Mobile Emulation Smoke

Date: 2026-05-16

Viewports checked:

- 390x844 portrait
- 430x932 portrait
- 844x390 landscape

## Navigation / Preview UI

| Check | Result |
| --- | --- |
| Main menu loads | PASS |
| Variant disabled status readable | PASS |
| Badugi disabled without preview flag | PASS |
| Learning Dashboard preview visible | PASS |
| Dashboard graph visible | PASS |
| Dashboard replay queue visible | PASS |

## Gameplay Layout

| Variant | Mobile Emulation Result | Issue |
| --- | --- | --- |
| D02 | BLOCKED_FOR_FRIEND_ALPHA | Action row overflows narrow viewport in gameplay view |
| S01 | BLOCKED_FOR_FRIEND_ALPHA | Action row overflows narrow viewport in gameplay view |
| S02 | BLOCKED_FOR_FRIEND_ALPHA | Action row overflows narrow viewport in gameplay view |

The new Playwright smoke confirms desktop progression for D02/S01/S02, but marks mobile gameplay checks as `fixme` until the action row overflow is fixed. During the attempted mobile assertions, action controls were visible but their bounding boxes extended beyond the viewport.

## Decision

Mobile emulation is not yet sufficient for friend alpha.

Friend alpha should stay internal/controlled until:

1. D02/S01/S02 action controls fit within 390px portrait width.
2. Physical Android Chrome QA passes.
3. iPhone Safari or Chrome QA is completed if available.
