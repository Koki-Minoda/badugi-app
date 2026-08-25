# MGX Alpha Playable Desktop Smoke

Date: 2026-05-16

Scope: friend-alpha playable variants only.

| Variant | Launch | One Hand Complete | Pot Visible | Action Buttons | Result Overlay | Next Hand | Fatal Console |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D02 | PASS | PASS | PASS | PASS | PASS | PASS | none blocking |
| S01 | PASS | PASS | PASS | PASS | PASS | PASS | none blocking |
| S02 | PASS | PASS | PASS | PASS | PASS | PASS | none blocking |

## Evidence

Automated local Playwright smoke:

```bash
npx playwright test tests/e2e/alpha-playable-variants-smoke.spec.ts --project=badugi-flow
```

Result:

```txt
3 passed
9 skipped
```

The 9 skipped checks are mobile gameplay layout guards marked `fixme` because mobile action controls currently overflow narrow viewports. That is tracked as P1 and must not be treated as friend-alpha green.

Manual deployed desktop browser smoke on `https://mgx-poker.com/` also confirmed:

- D02 / S01 / S02 are enabled in the alpha gate.
- Badugi remains disabled without the preview variants flag.
- Chinese/OFC remains disabled as coming soon.
- Learning Dashboard preview opens under the coaching preview flag.

## Decision

Desktop alpha scope for D02/S01/S02 is playable enough for continued QA.

Friend launch remains gated by physical mobile QA and remote GitHub sync.
