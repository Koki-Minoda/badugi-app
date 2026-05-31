# MGX Badugi Portrait Mobile Failure Audit

Date: 2026-05-16

Scope: Badugi portrait mobile only, 390x844 and 430x932.

This audit is limited to UI/readability/operability. It does not change Badugi rules, actor order, hand evaluation, routing, RL, promotion, or availability.

## Failure Classification

| Viewport | Failure | Evidence | Suspected Cause | Fix Strategy |
| -------- | ------- | -------- | --------------- | ------------ |
| 390x844 | Badugi preview launch did not become ready; orientation gate screen shown instead of the table. | `reports/screenshots/core5-mobile-portrait-badugi-390x844-failure.png` | `MobileOrientationGate` still required landscape for Badugi, while draw-lowball variants were already allowed in portrait. | Treat single-table Badugi like draw-lowball for orientation gating; keep preview availability unchanged. |
| 430x932 | Badugi preview launch did not become ready; orientation gate screen shown instead of the table. | `reports/screenshots/core5-mobile-portrait-badugi-430x932-failure.png` | Same as 390x844. | Same orientation-gate adjustment, then run visual/result-flow regression. |

## Non-Causes

| Category | Result |
| --- | --- |
| card overlap | Not observed because table was blocked before launch. |
| player panel overlap | Not observed because table was blocked before launch. |
| pot obstruction | Not observed because table was blocked before launch. |
| action controls clipped | Not observed because table was blocked before launch. |
| draw controls clipped | Not observed because table was blocked before launch. |
| result overlay overflow | Not observed because table was blocked before launch. |
| browser chrome safe-area issue | Not proven by the failure evidence. |
| viewport height issue | Not proven by the failure evidence. |
| table center too dense | Not proven by the failure evidence. |

## Required Recheck

After removing the Badugi portrait orientation block, run:

- `tests/e2e/badugi-portrait-mobile-layout.spec.ts`
- `tests/e2e/core5-mobile-portrait-layout-visual.spec.ts`
- `tests/e2e/core5-mobile-interaction.spec.ts`
- `tests/e2e/core5-mobile-landscape-layout-visual.spec.ts`
- `tests/e2e/core5-desktop-layout-visual.spec.ts`

