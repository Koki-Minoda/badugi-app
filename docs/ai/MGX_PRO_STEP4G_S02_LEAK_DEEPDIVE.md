# MGX Pro Step4-G S02 Leak Deep Dive

Sources:
- `reports/ai-eval/pro-vs-standard-20260506-s02-300-step4g.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-300-step4g.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-300-step4g.json`

Readout:
- Step4-G successfully introduced deterministic frequency control into `S02`.
- It did not improve EV. `S02` regressed further versus Step4-F.
- The largest symptoms are still under-realized strong hands and too many passive end states.

| Leak Type | Count | EV Impact | Hand Class | Street | Pro Action | Standard Action | Suggested Fix |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| missed value bet | 15 frequency-driven `CHECK` choices across 3 seeds | High negative, because `valueBetFrequency` stays around `0.0003-0.0024` while Standard materially out-earns Pro | `premiumA5`, `strongA5` | final betting, unopened | `CHECK` from deterministic mix | Standard appears to bet/value-continue more often from the aggregate EV gap | Raise the premium/strong bet weight. The current `BET/CHECK` mix is still too passive for S02. |
| over-check | `checkBackFrequency` around `0.248-0.252` on all 3 seeds | Persistent under-realization | `strongA5`, `mediumA5` | final betting, unopened | `CHECK` | Standard likely converts more of these to thin value bets | Narrow frequency control to premium/strong only and remove medium-hand check leakage from value regions. |
| strong hand under-realization | frequency breakdown shows only `BET 1-7` and `RAISE 0-2` per 300-hand run | Major contributor to `-60.4`, `-68.9`, `-62.0` gaps | `premiumA5`, `strongA5` | final betting | too many `CHECK/CALL` lines | Standard outperforms strongly despite similar safety | Increase premium raise/value rates and reduce `CHECK` fallback for strong made A-5 lows. |
| medium hand too passive | `CALL` remains `0.265-0.268`, while value frequency stays near zero | Medium negative | `mediumA5` | facing bet | `CALL` / `FOLD`, almost never thin value | Standard likely realizes more by pressing stronger subsets and folding weaker ones cleanly | Split `mediumA5` into smoother and rougher buckets, then bet the top edge and fold the bottom edge. |
| weak hand correct fold | `foldFacingBetFrequency` is `0.178-0.184` and safety remains perfect | Positive safety effect | `weakA5`, `trashA5` | facing bet | `FOLD` / `CHECK` | Standard may still be looser, but this is not the leak | Keep this behavior. Weak-hand discipline is not the problem anymore. |
| facing raise leak | very low `raiseFrequency` and no defensive explosion | Small | `premiumA5` only | facing pressure | mostly `CALL`, rare `RAISE` | Standard probably attacks more, not less | Do not add broad aggression. Only allow more premium value raises. |
| final betting leak | `frequencyDecisionRate` is present, but mostly converts to passive outcomes | High negative | `premiumA5`, `strongA5` | final betting | `CHECK/CALL` | Standard seems to finish stronger lines | Make final-street premium/strong frequencies more value-heavy. |
| single-draw value realization failure | overall 300-hand Pro EV is `-15.2`, `-19.4`, `-16.0` vs Standard `45.2`, `49.4`, `46.0` | Core Step4-G blocker | all made-low classes above weak | final betting | too passive after one draw | Standard clearly captures more value from made lows | Replace the current mixed premium/strong policy with stronger deterministic value thresholds before trying more frequency. |
