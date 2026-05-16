# MGX Badugi Alpha Availability Decision

Date: 2026-05-16

## Decision

`KEEP_PREVIEW_ONLY`

## Evidence

| Gate | Result |
| --- | --- |
| Playwright full 3-draw | PASS |
| pot regression | PASS |
| desktop preview full-hand smoke | PASS |
| desktop active-hand pot continuity | PASS, min observed pot `30` |
| post-draw betting observed | PASS |
| hand result reached | PASS |
| mobile variant disabled-state visibility | PASS |
| mobile Badugi full-hand gameplay | PENDING |
| physical mobile QA | PENDING |
| new P0 | none observed |

## Rationale

The Badugi P0 automation blocker is fixed and the deployed preview URL can complete a desktop preview full-hand smoke with pot continuity intact. However, the friend alpha policy is safety-first. Badugi should not return to `alpha_playable` until physical mobile or equivalent full-hand mobile gameplay confirms:

- pot remains visible
- action buttons remain tappable
- phase labels remain readable
- next-hand flow is usable

## Current Availability

| Variant | Availability |
| --- | --- |
| Badugi | `preview_only` |

## Required Before Reclassification

1. Run Badugi full hand on mobile portrait and landscape.
2. Confirm pot/action controls visibility through Draw 1-3.
3. Confirm next hand from result overlay.
4. Rerun targeted Playwright gates after any UI adjustment.
