# MGX Pro Step4-T Action Divergence Report

Source evaluations:
- `reports/ai-eval/pro-vs-standard-20260506-s02-s01-d02-300-step4t.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-s01-d02-300-step4t.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-s01-d02-300-step4t.json`

Method:
- Each actor state now records both the `Pro` action and the `Standard` action on the same snapshot.
- The raw divergence row stores the actual realized seat delta only for the tier that really occupied the seat in that hand.
- The mining pass then groups mirrored/alternating runs by spot signature and estimates `Pro EV delta`, `Standard EV delta`, and `EV gap` from those grouped realized deltas.
- This is useful for ranking likely leaks, but it is still an observational estimate, not a perfect counterfactual solver.

## Divergence Collection

| Item | Value |
| --- | ---: |
| Target variants | `S02`, `S01`, `D02` |
| Seeds | `20260506`, `20260507`, `20260508` |
| Hands per seed | `300` |
| Total divergence rows | `5400` |
| Fallback | `0.0000` on all targets |
| Illegal / Freeze / EV fail | `0 / 0 / 0` |

## Category Frequency

| Category | Frequency |
| --- | ---: |
| `overfold` | `4842` |
| `insufficient-aggression` | `511` |
| `underraise` | `22` |
| `missed-value` | `13` |
| `multiway-leak` | `12` |

## EV Impact Ranking

| Rank | Variant | Spot | Pro Action | Standard Action | EV Gap | Frequency | Category |
| ---: | --- | --- | --- | --- | ---: | ---: | --- |
| 1 | `D02` | `trashA5`, `4way+`, pre-draw, `small-blind`, facing bet | `FOLD` | `CALL` | `-32.0` | `139` | `overfold` |
| 2 | `S02` | `trashSDA5`, `4way+`, pre-draw, `small-blind`, facing bet | `FOLD` | `CALL` | `-17.8` | `231` | `overfold` |
| 3 | `S01` | `trashSD27`, `4way+`, pre-draw, `small-blind`, facing bet | `FOLD` | `CALL` | `-13.2` | `237` | `overfold` |
| 4 | `S02` | `weakSDA5`, `4way+`, pre-draw, `early`, facing bet | `FOLD` | `CALL` | `-60.0` | `23` | `overfold` |
| 5 | `S01` | `weakSD27`, `4way+`, pre-draw, `cutoff`, facing bet | `FOLD` | `CALL` | `-29.5` | `39` | `overfold` |
| 6 | `S02` | `premiumSDA5`, `3way`, post-draw pressure | `CALL` | `RAISE` | observational only | `2` | `underraise` |
| 7 | `S02` | `strongSDA5`, `3way`, post-draw pressure | `FOLD` | `RAISE` | observational only | `2` | `overfold` |
| 8 | `S01` | `strongSD27`, `4way+`, post-draw pressure | `FOLD` | `CALL` | `-130.0` | `3` | `overfold` |

## Variant Top Leak

| Variant | Top Leak | Why It Matters | Interpretation |
| --- | --- | --- | --- |
| `D02` | `trashA5` pre-draw multiway `FOLD` vs Standard `CALL` | highest weighted divergence in the mining output | not immediately actionable; sign flips by seat and seed, so this is likely variance-sensitive rather than a safe heuristic reversal |
| `S02` | `trashSDA5` pre-draw multiway `FOLD` vs Standard `CALL` | same high-frequency pattern as D02 | weak/trash guard should not be reverted; this bucket is too noisy and was previously the structural leak |
| `S01` | `trashSD27` / `weakSD27` pre-draw multiway `FOLD` vs Standard `CALL` | highest-frequency S01 divergence after call-guard work | again noisy and not a good candidate to undo |

## Good-Hand Divergence Candidates

These are the buckets that still look worth revisiting with heuristics:

| Variant | Spot | Pro Action | Standard Action | Frequency | Category | Why It Is Actionable |
| --- | --- | --- | --- | ---: | --- | --- |
| `S02` | `premiumSDA5`, `3way`, post-draw facing raise | `CALL` | `RAISE` | `2` | `underraise` | good hand, safe pressure size, and directly aligned with the remaining S02 value-realization gap |
| `S02` | `strongSDA5`, `3way`, post-draw facing raise | `FOLD` | `RAISE` | `2` | `overfold` | sparse but directionally consistent with the known good-hand under-capture problem |
| `S02` | `strongSDA5`, `3way/4way+`, pre-draw or post-draw small pressure | `CALL` | `RAISE` | `1-2` | `underraise` | candidate for a very narrow thin-value raise condition |
| `S01` | `strongSD27`, `4way+`, post-draw facing bet | `FOLD` | `CALL` | `3` | `overfold` | small sample, but this is a top-end 2-7 made hand rather than a weak defense bucket |

## Non-Actionable Divergence

The following buckets should *not* be turned straight back into heuristics:

| Bucket | Reason |
| --- | --- |
| `trash*` / `weak*` multiway `FOLD` vs Standard `CALL` | highest frequency, but sign flips by position and seed; reverting the guard would re-open previously fixed structural leaks |
| single-observation `premium/strong` raise spots with only one actual tier sample | too sparse to estimate a stable EV gap from mirrored runs alone |
| cross-position multiway trash buckets | observational EV is dominated by seat variance, not a clean policy edge |

## Conclusion

Step4-T establishes the mining foundation that later Iron / WorldMaster work needs:
- same-snapshot dual action capture
- grouped EV-gap ranking
- category-level leak summaries
- separation between heuristic-safe and heuristic-unsafe buckets

The immediate lesson is that the remaining gaps are no longer dominated by obvious weak-hand mistakes. The high-frequency divergence is mostly noisy guard-vs-call behavior, while the genuinely actionable candidates are now sparse good-hand raise / value spots, especially in `S02`.
