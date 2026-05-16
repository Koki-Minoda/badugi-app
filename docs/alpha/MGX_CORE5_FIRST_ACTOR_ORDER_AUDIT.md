# MGX Core 5 First Actor Order Audit

Date: 2026-05-16

## Result

`PASS`

The audit did not reproduce a fixed-opposite-seat actor bug. For six-max hands with Hero on the button, UTG can naturally be the visually opposite seat, so this can look like an opposite-seat start while still being rule-correct.

## Rule

| Situation | Expected First Actor |
| --- | --- |
| 3+ players pre-draw | first active seat left of BB / UTG |
| heads-up pre-draw | BTN/SB |
| post-draw betting | first active seat left of BTN |
| folded/all-in | skipped |

## Audit Summary

| Game | variantId | Classification | Notes |
| ---- | --------- | -------------- | ----- |
| Badugi | `badugi` | PASS | Expected UTG seat 3, actual seat 3; not BB |
| 2-7 Triple Draw | `D01` | PASS / prior action observed | No BB-first start observed; CPU may advance before first snapshot |
| A-5 Triple Draw | `D02` | PASS / prior action observed | No BB-first start observed |
| 2-7 Single Draw | `S01` | PASS / prior action observed | No BB-first start observed |
| A-5 Single Draw | `S02` | PASS / prior action observed | No BB-first start observed |

## Evidence

```txt
npx playwright test tests/e2e/core5-first-actor-order.spec.ts --project=badugi-flow
```

Result: 5 passed.

Report path:

```txt
reports/alpha/core5-first-actor-order.json
```
