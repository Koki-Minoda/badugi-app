# MGX Pro Step4-I S01 Leak Deep Dive

Sources:
- `reports/ai-eval/pro-vs-standard-20260506-s01-300-step4i.json`
- `reports/ai-eval/pro-vs-standard-20260507-s01-300-step4i.json`
- `reports/ai-eval/pro-vs-standard-20260508-s01-300-step4i.json`

Readout:
- Step4-I improves `S01` from the Step4-H full-suite average `-9.6` to `-6.8`.
- The main remaining gap is still value realization on made `7/8/9-low` holdings, not safety or fallback.
- Pair / straight / flush penalties are now explicitly separated and are no longer the primary leak class.

| Leak Type | Count | EV Impact | Hand Class | Street | Pro Action | Standard Action | Suggested Fix |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| missed value bet | Low but still material; `valueBetFrequency` only `0.0041-0.0072` on the focused runs | Medium negative | `premiumSD27`, `strongSD27` | final betting, unopened | `BET`, but not often enough | Standard still out-earns Pro by `36.0-49.7` per seed | Add thinner `BET` coverage for the top edge of `strongSD27`, especially cleaner rough `8-low` and smooth `9-low`. |
| over-check | `checkBackFrequency` remains `0.2860-0.2955` | Medium negative | `strongSD27`, `mediumSD27` | final betting, unopened | too many `CHECK` end states | Standard converts more medium-strength made lows into thin value | Split `strongSD27` further between cleaner rough `8-low` and weaker smooth `9-low` before adding more value bets. |
| weak call | `callFacingBetFrequency` remains `0.2619-0.2672` | Medium negative | `mediumSD27`, lower `strongSD27` | facing bet | `CALL` on small bets | Standard likely folds the bottom of these classes more cleanly | Tighten small-bet defense for rough `9-low` and thin `T-low`. |
| rough 8/9-low over-defense | present mostly on the weakest seed (`20260508`) where Pro still lands at `-9.9` | Medium negative | `strongSD27`, `mediumSD27` | final betting facing pressure | `CALL` | Standard likely either value-bets stronger hands or folds weaker ones more sharply | Separate rough `8-low` from smooth `9-low` and reduce `CALL` volume at the bottom edge. |
| penalty hand call | now rare after explicit `trashSD27` handling | Low negative | `trashSD27` | facing bet | mostly `FOLD` | Standard also avoids these spots | Keep current penalty discipline. This is no longer the priority leak. |
| strong made low under-realization | still visible in the focused gap `-41.4` | High negative | `premiumSD27`, `strongSD27` | final betting | `BET/CALL`, not enough `RAISE` or thin value | Standard captures more with strong completions | Consider allowing selective premium re-raises on clearly capped final-street spots. |
| final betting leak | broad symptom of low value frequency | High negative | all made-low classes above `weakSD27` | final betting | too passive once the draw is complete | Standard realizes more value from one-draw completions | Keep the new classes, then tune strong and top-medium value thresholds. |
| wrong pat / wrong draw | reduced materially; tests now pin clean `7-low`, smooth `8-low`, pair break, penalty break, and ace-high handling | Low negative | draw classes | draw phase | mostly correct | Standard no longer has a clear structural edge here | Leave draw logic mostly stable and focus the next pass on betting thresholds. |
