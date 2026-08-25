# MGX Core5 Tournament Lifecycle Gate

Date: 2026-05-17

## Required Tournament Checks

| Area | Required Result |
|---|---|
| start | entrants, stacks, levels, blinds, and seats valid |
| CPU bust | busted CPU is removed and never selected as actor |
| hero bust | no further hero controls; result/feedback/menu path safe |
| champion | final player selected; no active actor remains |
| payout | placement/payout rows valid |
| feedback | loss/end feedback safe; replay CTA safe where present |
| rebalance | no duplicate/missing players when enabled |
| menu return | terminal path returns to menu |
| freeze detection | 0 freezes |

## Automation

```bash
node scripts/run-core5-tournament-lifecycle-invariant-sweep.js --variants=badugi,D01,D02,S01,S02 --tournaments=20 --seeds=20260611,20260612,20260613
npx playwright test tests/e2e/core5-tournament-full-lifecycle-gate.spec.ts --project=badugi-flow
```

## Current Status

`LOCAL_AUTOMATED_PASS`

Synthetic invariant sweep wrote:

- `reports/invariant/core5-tournament-lifecycle-summary.json`
- `reports/invariant/core5-tournament-lifecycle-failures.json`

## Evidence

| Check | Result |
|---|---|
| Variants | Badugi, D01, D02, S01, S02 |
| Seeds | 20260611, 20260612, 20260613 |
| Player counts | HU, 3max, 4max, 6max |
| Tournaments simulated | 1,200 |
| Invariant violations | 0 |
| Actor mismatches | 0 |
| Busted actor selected | 0 |
| Hero bust failures | 0 |
| CPU bust failures | 0 |
| Champion failures | 0 |
| Payout failures | 0 |
| Feedback failures | 0 |
| Menu-return failures | 0 |
| Freezes | 0 |
| Full browser lifecycle gate | PASS, 5/5 variants |
| Individual Tournament browser lifecycle specs | PASS, 30/30 checks |

Tournament mode passes the local automated lifecycle gate. This does not clear the separate live URL tournament runtime blocker until the deployed build is verified.
