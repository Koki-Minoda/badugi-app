# MGX Core5 Cash Lifecycle Gate

Date: 2026-05-17

## Required Cash Checks

| Area | Required Result |
|---|---|
| launch | each Core5 variant opens in cash mode |
| hand lifecycle | hand completes |
| next hand | next hand starts cleanly |
| cash out | cash out summary opens and returns to game selection/menu |
| re-enter | re-enter starts cleanly or resumes safely |
| CPU stack lifecycle | CPU win/loss updates stack without illegal actor |
| feedback | safe when enabled; explicitly absent without crash when disabled |
| freeze detection | 0 freezes |

## Automation

```bash
node scripts/run-core5-cash-lifecycle-invariant-sweep.js --variants=badugi,D01,D02,S01,S02 --hands=100 --seeds=20260601,20260602,20260603
npx playwright test tests/e2e/core5-cash-full-lifecycle-gate.spec.ts --project=badugi-flow
```

## Current Status

`LOCAL_AUTOMATED_PASS`

Synthetic invariant sweep wrote:

- `reports/invariant/core5-cash-lifecycle-summary.json`
- `reports/invariant/core5-cash-lifecycle-failures.json`

## Evidence

| Check | Result |
|---|---|
| Variants | Badugi, D01, D02, S01, S02 |
| Seeds | 20260601, 20260602, 20260603 |
| Player counts | HU, 3max, 4max, 6max |
| Hands simulated | 6,000 |
| Sessions completed | 60 |
| Invariant violations | 0 |
| Actor mismatches | 0 |
| Action reopen failures | 0 |
| Pot failures | 0 |
| Cash-out failures | 0 |
| Menu-return failures | 0 |
| Freezes | 0 |
| Full browser lifecycle gate | PASS, 5/5 variants |
| Individual Cash browser lifecycle specs | PASS, 25/25 checks |

Cash mode passes the local automated lifecycle gate. Live URL verification and physical mobile QA remain separate release gates.
