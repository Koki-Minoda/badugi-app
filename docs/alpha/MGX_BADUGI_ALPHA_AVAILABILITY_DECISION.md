# MGX Badugi Alpha Availability Decision

Date: 2026-05-16

## Decision

`BADUGI_REMAINS_PREVIEW_ONLY`

## Evidence

| Gate | Result |
| --- | --- |
| Playwright full 3-draw | PASS |
| pot regression | PASS |
| desktop preview full-hand smoke | PASS |
| desktop active-hand pot continuity | PASS, min observed pot `30` |
| post-draw betting observed | PASS |
| hand result reached | PASS |
| Badugi long-run alpha restore smoke | FAIL / expected-fail gate |
| Badugi portrait mobile UI gate | PASS |
| mobile variant disabled-state visibility | PASS |
| mobile Badugi full-hand gameplay | PASS in portrait emulation and landscape automation; physical mobile still pending |
| physical mobile QA | PENDING |
| new P0 | none from portrait UI; alpha scope remains protected because Badugi is gated |

## Rationale

The original focused Badugi P0 automation blocker remains fixed: the full 3-draw browser regression, pot continuity regression, stale-turn merge test, and no-next-alive actor test pass. However, the alpha restore gate found broader Badugi readiness blockers:

- a long-run preview smoke can still surface active-hand `Total Pot 0` / terminal transition mismatch symptoms
- portrait mobile launch/readability was blocked by the mobile orientation gate, but Step6 cleared that UI blocker in 390x844 and 430x932 automation

The friend alpha policy is safety-first. Badugi must not return to `alpha_playable` until the long-run restore gate passes without expected-failure annotations and physical mobile QA confirms pot/action/phase usability.

## Current Availability

| Variant | Availability |
| --- | --- |
| Badugi | `preview_only` |

## Required Before Reclassification

1. Run Badugi full hand on mobile portrait and landscape.
2. Make `tests/e2e/badugi-alpha-long-run-smoke.spec.ts` pass without `test.fail`.
3. Confirm pot/action controls visibility through Draw 1-3 on a physical mobile device.
4. Confirm next hand from result overlay on a physical mobile device.
5. Rerun targeted Playwright gates after any UI adjustment.
