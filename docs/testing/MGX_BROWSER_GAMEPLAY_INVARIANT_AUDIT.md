# MGX Browser Gameplay Invariant Audit

Date: 2026-05-17

## Result

`FAIL`

The browser invariant framework is now installed, but the first stable browser trace still finds P0 violations. The full Core5 matrix was not expanded after the first Badugi cash desktop smoke failed; release remains blocked until the minimal case is clean.

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
| Badugi | cash | desktop 1280x720 | 1 | 1 | 31 | FAIL |

Observed counts in the latest smoke:

| Metric | Count |
|---|---:|
| Calls/checks | 16 |
| Folds | 0 |
| Raises | 0 |
| Re-raises | 0 |
| Draw decisions | 15 |
| Showdowns | 1 |
| Violations | 7 |

Violation breakdown:

| Type | Count | Severity |
|---|---:|---|
| ACTOR | 2 | P0 |
| TERMINAL | 2 | P0 |
| POT | 1 | P1 |
| PHASE | 2 | P1 |

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
| BROWSER-GAMEPLAY-001 | Browser invariant release gate failed | summary/failure JSON | P0 HOLD |
| CORE5-BROWSER-ACTOR-001 | Browser controller selected folded/ineligible actor or actor mismatched expected actor | Badugi cash desktop trace | P0 HOLD |
| CORE5-BROWSER-TERMINAL-001 | Terminal state keeps controller actor after result/next-hand is visible | Badugi cash desktop trace | P0 HOLD |
| CORE5-BROWSER-POT-001 | Browser controller/displayed pot lag remains | Badugi cash desktop and raise/call traces | P1 |

## Next Fix List

1. Audit single-table Badugi snapshot source of truth after forced/browser actions.
2. Clear controller actor when terminal/result state is visible.
3. Prevent folded/ineligible actor from remaining in the browser controller snapshot.
4. Align browser controller pot with active displayed pot at action boundaries.
5. Re-run the Badugi cash desktop smoke, then expand to Core5 x Cash/Tournament x desktop/portrait/landscape.
