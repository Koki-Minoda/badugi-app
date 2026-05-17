# MGX Browser Gameplay Invariant Audit

Date: 2026-05-17

## Result

`PARTIAL_PASS_BADUGI_1HAND_AND_10HAND__FAIL_100HAND_SOAK`

The first Badugi cash desktop P0s are fixed locally. The 1-hand gate now passes with zero invariant violations, and the 10-hand Badugi cash desktop soak also passes. The 100-hand Badugi cash desktop soak was started only after those gates passed, but it halted at hand 16, so the release gate remains blocked and the Core5 matrix was not expanded.

## Evidence

| Artifact | Path |
|---|---|
| Summary | `reports/browser-gameplay/browser-gameplay-invariant-summary.json` |
| Failures | `reports/browser-gameplay/browser-gameplay-invariant-failures.json` |
| Badugi cash desktop trace | `reports/browser-gameplay/browser-gameplay-trace-badugi-cash-desktop.jsonl` |
| Focused Badugi raise/call trace | `reports/browser-gameplay/browser-gameplay-trace-badugi-raise-call-reopen.jsonl` |
| Failure screenshots | `reports/screenshots/browser-gameplay-failure-*.png` |

## Smoke Summary

| Variant | Mode | Viewport | Hands Attempted | Hands Completed | Actions | Result |
|---|---|---:|---:|---:|---:|---|
| Badugi | cash | desktop 1280x720 | 1 | 1 | 27 | PASS |
| Badugi | cash | desktop 1280x720 | 10 | 10 | report-generated | PASS |
| Badugi | cash | desktop 1280x720 | 100 | 15 before halt | report-generated | FAIL/HALT |

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
| CORE5-BROWSER-POT-001 | Pot/phase lag classified as transition-window P1 after bounded retry | Badugi 1-hand and 10-hand pass | MONITOR |
| BROWSER-SOAK-001 | Badugi 100-hand cash desktop soak halted at hand 16 | 100-hand command output and screenshot | P1 HOLD |

## Next Fix List

1. Isolate the 100-hand hand-16 halt: browser was in a result/terminal-style state while the progress helper still attempted a Hero call.
2. Verify whether stale `ACTING` decoration after `HAND_RESULT` is a real UI merge bug or a trace/progress helper stale-read.
3. Re-run Badugi cash desktop 100-hand until it passes before expanding to Badugi matrix.
4. Expand to Core5 x Cash/Tournament x desktop/portrait/landscape only after Badugi 100-hand is clean.
