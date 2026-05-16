# MGX Badugi Alpha Availability Decision

Date: 2026-05-16

## Decision

`BADUGI_ALPHA_PLAYABLE_FOR_FRIEND_ALPHA`

## Rationale

Badugi is a core MGX game and should be part of the closed friend alpha. The previous safety-first `preview_only` gate protected the alpha scope while Badugi progression, pot continuity, terminal transition, portrait mobile, and orientation blockers were being audited. Those automated gates now pass.

This change accepts remaining non-P0 risk for closed alpha while keeping all known risks visible in `docs/bugs/current_bugs.md`.

## Evidence

| Gate | Result |
| --- | --- |
| focused full 3-draw browser flow | PASS |
| pot regression | PASS |
| long-run active-pot / terminal restore | PASS |
| active-hand `Total Pot 0` | PASS, 0 observed in long-run restore gate |
| stale actor / terminal transition | PASS |
| portrait mobile blocker | PASS in automation |
| landscape / orientation | PASS in automation |
| actor order | PASS in Core5 audit |
| Core5 mobile tournament layout | PASS in automation and deployed smoke |
| P0 in automation | none confirmed |

## Availability

| Variant | Availability |
| --- | --- |
| Badugi | `alpha_playable` |

## Known Limitations Accepted For Closed Alpha

- Physical mobile QA is still required before broad sharing.
- Continue monitoring Badugi pot continuity, terminal transition, actor state, and next-hand behavior.
- If any P0 is reproduced on real devices, pause friend alpha and revert Badugi to `preview_only`.

## Guardrails

- Production routing unchanged.
- Live RL unchanged.
- Model promotion unchanged.
- Badugi-family side variants remain preview-only unless separately cleared.
