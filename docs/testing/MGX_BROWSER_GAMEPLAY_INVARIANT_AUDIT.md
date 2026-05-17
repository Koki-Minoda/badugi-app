# MGX Browser Gameplay Invariant Audit

Date: 2026-05-17

## Result

`PASS_BADUGI_100HAND_AND_BADUGI_MODE_VIEWPORT_MATRIX__P1_POT_MONITOR`

The first Badugi cash desktop P0s are fixed locally. The 1-hand, 10-hand, and 100-hand Badugi cash desktop gates now pass without halt or P0 actor/terminal/action-reopen violations. The focused hand16 repro also completes through hand20. After the 100-hand pass, the allowed Badugi-only cash/tournament x desktop/portrait/landscape matrix completed 120/120 hands. Core5 full matrix expansion has not been run in this step.

## Evidence

| Artifact | Path |
|---|---|
| Summary | `reports/browser-gameplay/browser-gameplay-invariant-summary.json` |
| Failures | `reports/browser-gameplay/browser-gameplay-invariant-failures.json` |
| Badugi cash desktop trace | `reports/browser-gameplay/browser-gameplay-trace-badugi-cash-desktop.jsonl` |
| Hand16 focused trace | `reports/browser-gameplay/badugi-cash-desktop-hand16-halt-trace.jsonl` |
| Hand16 decision log | `reports/browser-gameplay/progress-helper-hand16-decision-log.jsonl` |
| Focused Badugi raise/call trace | `reports/browser-gameplay/browser-gameplay-trace-badugi-raise-call-reopen.jsonl` |
| Failure screenshots | `reports/screenshots/browser-gameplay-failure-*.png` |

## Smoke Summary

| Variant | Mode | Viewport | Hands Attempted | Hands Completed | Actions | Result |
|---|---|---:|---:|---:|---:|---|
| Badugi | cash | desktop 1280x720 | 1 | 1 | 27 | PASS |
| Badugi | cash | desktop 1280x720 | 10 | 10 | report-generated | PASS |
| Badugi | cash | desktop 1280x720 | 100 | 100 | report-generated | PASS |
| Badugi | cash | desktop/portrait/landscape | 20 each | 60 | 1,134 | PASS_WITH_P1_POT_MONITOR |
| Badugi | tournament | desktop/portrait/landscape | 20 each | 60 | 1,148 | PASS |

Observed counts in the latest clean 1-hand smoke:

| Metric | Count |
|---|---:|
| Calls/checks | 15 |
| Folds | 0 |
| Raises | 0 |
| Re-raises | 0 |
| Draw decisions | 12 |
| Showdowns | 1 |
| Violations | 0 |

Violation breakdown:

| Type | Count | Severity |
|---|---:|---|
| ACTOR | 0 | - |
| TERMINAL | 0 | - |
| POT | 0 | - |
| PHASE | 0 | - |

## Focused Badugi Raise/Call Reopen

`PASS_FOR_P0_REACTION`

The focused no-reraise scenario verified:

- Hero raises.
- Remaining active opponents call/fold.
- No illegal Hero re-action is observed in the same betting round.
- No P0 action reopen violation is emitted.

The same focused report still recorded P1 pot display/controller lag, so it does not clear the broader browser gameplay gate.

## Classification

| ID | Classification | Evidence | Release Impact |
|---|---|---|---|
| BROWSER-GAMEPLAY-001 | Minimal Badugi browser invariant gate fixed locally | 1-hand and 10-hand Badugi cash desktop pass | MONITOR |
| CORE5-BROWSER-ACTOR-001 | Initial actor P0 classified as collector/timing and fixed in harness/source-of-truth selection | Badugi 1-hand and 10-hand pass | MONITOR |
| CORE5-BROWSER-TERMINAL-001 | Initial terminal P0 classified as collector fallback from explicit null turn and fixed | Badugi 1-hand and 10-hand pass | MONITOR |
| CORE5-BROWSER-POT-001 | Pot/phase lag classified as transition-window P1 after bounded retry | Badugi 100-hand pass; Badugi matrix has 14 P1 pot rows in cash only | MONITOR |
| BROWSER-SOAK-001 | Hand16 halt classified as progress-helper stale-read / terminal and next-hand detection issue, then fixed locally | focused hand16 repro PASS through hand20; 100-hand Badugi cash desktop PASS | TEST_HARNESS_FIXED / MONITOR |

## Next Fix List

1. Preserve `BROWSER-SOAK-001` as monitor during the next browser matrix expansion.
2. Decide whether the cash-mode P1 pot display/controller timing rows should be normalized in the invariant or fixed in the snapshot adapter.
3. Expand only to the next approved ladder step; Core5 full matrix has not been run in this step.
4. Keep generated traces/screenshots out of commits.
