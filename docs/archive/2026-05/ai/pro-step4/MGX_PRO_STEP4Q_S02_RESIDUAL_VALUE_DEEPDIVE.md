# MGX Pro Step4-Q S02 Residual Value Deep Dive

Source evaluations:
- `reports/ai-eval/pro-vs-standard-20260506-s02-300-step4q.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-300-step4q.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-300-step4q.json`
- `reports/ai-eval/pro-vs-standard-20260506-s02-100-step4q-post-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260506-s02-100-step4q-baseline-detailed.json`

Summary:
- S02 no longer leaks through weak/trash inherited `CALL`; fallback is `0.0000`.
- The remaining gap is a sparse good-hand value problem, not a weak-hand defense problem.
- Full-suite `100-hand` samples are dominated by `4way+` pots, so heads-up-only tuning barely moves the aggregate.
- `premiumSDA5` and `strongSDA5` final value bets are positive when they happen, but they happen rarely.
- The main residual misses are pre-draw `CALL-only` on premium made lows and pre-draw `CHECK` on strong made lows in multiway spots.

| Hand Class | Spot | Count | EV Impact | Pro Action | Standard Action | Suggested Fix |
| --- | --- | ---: | ---: | --- | --- | --- |
| `premiumSDA5` | Pre-draw, `4way+`, facing medium pressure | 1 in the detailed `20260506` full run; same bucket appears in focused traces too | Negative in focused attribution; neutral-to-negative in short full-suite samples | `CALL` only | Standard line not directly logged, but Pro under-realizes by only continuing | Allow safe pre-draw value raises on small/medium pressure without touching weak/trash guards |
| `strongSDA5` | Pre-draw, first-in, `4way+` | Rare but recurring | Missed thin value | `CHECK` through the generic path before Step4-Q | Standard captures more value over the full sample | Add explicit S02 pre-draw open value bet for strong made lows |
| `upperMediumSDA5` | Final street, first-in, heads-up | Rare | Mild positive when thin value is available | Mostly `CHECK`; previous multiway thin bets were noisy | Standard has higher aggregate EV, but not from weak-hand defense | Keep thin `BET` available only in heads-up first-in spots; do not reopen multiway thin bets |
| `premiumSDA5` | Final street, first-in, `4way+` | Rare | Positive when reached | `BET` | Standard action not directly logged | Preserve final value line; do not trim premium final betting |
| `strongSDA5` | Final street, first-in, `4way+` | Rare | Positive when reached | `BET` | Standard action not directly logged | Preserve strong final value line; only add small pre-draw value, not more final suppression |

