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
| Badugi portrait mobile restore gate | FAIL / expected-fail gate |
| mobile variant disabled-state visibility | PASS |
| mobile Badugi full-hand gameplay | FAIL for portrait restore gate; landscape PASS |
| physical mobile QA | PENDING |
| new P0 | present for Badugi restore only; alpha scope remains protected because Badugi is gated |

## Rationale

The original focused Badugi P0 automation blocker remains fixed: the full 3-draw browser regression, pot continuity regression, stale-turn merge test, and no-next-alive actor test pass. However, the alpha restore gate found broader Badugi readiness blockers:

- a long-run preview smoke can still surface active-hand `Total Pot 0` / terminal transition mismatch symptoms
- portrait mobile restore launch is not consistently ready at 390x844 and 430x932

The friend alpha policy is safety-first. Badugi must not return to `alpha_playable` until the long-run and mobile restore gates pass without expected-failure annotations and physical mobile QA confirms pot/action/phase usability.

## Current Availability

| Variant | Availability |
| --- | --- |
| Badugi | `preview_only` |

## Required Before Reclassification

1. Run Badugi full hand on mobile portrait and landscape.
2. Make `tests/e2e/badugi-alpha-long-run-smoke.spec.ts` pass without `test.fail`.
3. Make portrait cases in `tests/e2e/badugi-mobile-gameplay-layout.spec.ts` pass without `test.fail`.
4. Confirm pot/action controls visibility through Draw 1-3.
5. Confirm next hand from result overlay.
6. Rerun targeted Playwright gates after any UI adjustment.
