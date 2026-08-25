# MGX Core 5 Orientation Policy

Date: 2026-05-16

## Policy

Core 5 games must not be hard-blocked by mobile orientation.

| Mode | Portrait | Landscape | Notes |
| --- | --- | --- | --- |
| cash | supported | supported | compact layout if needed |
| tournament | supported | supported | compact layout if needed |

Warnings may be shown for very small screens, but Core 5 gameplay should continue in both portrait and landscape unless the viewport is genuinely unusable.

## Covered Games

| Game | variantId | Cash Portrait | Cash Landscape | Tournament Portrait | Tournament Landscape |
| ---- | --------- | ------------- | -------------- | ------------------- | -------------------- |
| Badugi | `badugi` | PASS | PASS | PASS | PASS |
| 2-7 Triple Draw | `D01` | PASS | PASS | PASS | PASS |
| A-5 Triple Draw | `D02` | PASS | PASS | PASS | PASS |
| 2-7 Single Draw | `S01` | PASS | PASS | PASS | PASS |
| A-5 Single Draw | `S02` | PASS | PASS | PASS | PASS |

## Implementation

`MobileOrientationGate` remains available for non-Core5 routes, but Badugi and draw-lowball Core 5 variants are allowed in both orientations for cash and tournament modes.

## Evidence

```txt
npx playwright test tests/e2e/core5-orientation-support.spec.ts --project=badugi-flow
```

Result: 20 passed.
