# MGX Badugi Manual QA Checklist

Date: 2026-05-16

Status: `PENDING_BADUGI_RESTORE_FIXES`

Badugi remains `preview_only`. Use this checklist after the long-run and portrait mobile automation blockers are fixed.

## Desktop Full Hand

| Check | Status |
| --- | --- |
| pre-draw bet | automated focused PASS |
| Draw #1 | automated focused PASS |
| bet after Draw #1 | automated focused PASS |
| Draw #2 | automated focused PASS |
| bet after Draw #2 | automated focused PASS |
| Draw #3 | automated focused PASS |
| final bet | automated focused PASS |
| showdown / Hand Result | automated focused PASS |
| next hand | automated focused PASS |
| pot visible throughout active hand | focused PASS; long-run FAIL |
| hero action cleared after action | focused PASS; long-run monitor |
| no stuck ACTING | focused PASS; long-run monitor |

## Mobile

| Check | Status |
| --- | --- |
| portrait 390x844 launch | FAIL in restore gate |
| portrait 430x932 launch | FAIL in restore gate |
| landscape 844x390 launch | PASS |
| action controls visible | blocked by portrait launch readiness |
| draw controls visible | blocked by portrait launch readiness |
| result overlay usable | blocked by portrait launch readiness |
| replay/coaching link if available | not part of Badugi restore gate yet |

## Manual Execution Notes

Do not mark Badugi `alpha_playable` until portrait mobile automation and at least one real-device full-hand run pass.
