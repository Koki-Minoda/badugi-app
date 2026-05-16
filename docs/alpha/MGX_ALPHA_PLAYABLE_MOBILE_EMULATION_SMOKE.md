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
| D02 | PASS | Controls fit 390x844, 430x932, and 844x390; one-hand result reachable on 390x844 |
| S01 | PASS | Controls fit 390x844, 430x932, and 844x390; one-hand result reachable on 390x844 |
| S02 | PASS | Controls fit 390x844, 430x932, and 844x390; one-hand result reachable on 390x844 |

The mobile action-row overflow was reproduced in Playwright before the fix: controls were visible, but narrow portrait bounding boxes extended beyond the viewport. The fix makes narrow viewports use the mobile gameplay layout, stacks the table/action areas in portrait, and gives action buttons full-width mobile sizing.

Verification:

```bash
npx playwright test tests/e2e/alpha-playable-variants-smoke.spec.ts --project=badugi-flow
npx playwright test tests/e2e/alpha-mobile-gameplay-layout.spec.ts --project=badugi-flow
```

Results:

- `alpha-playable-variants-smoke`: 12 passed
- `alpha-mobile-gameplay-layout`: 12 passed

## Decision

Mobile emulation is sufficient for D02/S01/S02 friend-alpha scope.

Friend alpha should stay internal/controlled until:

1. Physical Android Chrome QA passes.
2. iPhone Safari or Chrome QA is completed if available.
3. Remote sync is resolved or the deploy snapshot is otherwise backed up.
