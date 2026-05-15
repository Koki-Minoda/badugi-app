# MGX Pro Step4-P S01 Call Guard Report

| Spot | Before | After | Block Count | EV Impact | Notes |
| ---- | ------ | ----- | ----------: | --------: | ----- |
| `trashSD27` facing bet | inherited `standard-rule CALL` in multiway pre-draw pots | `FOLD/CHECK` via `s01-trash-early-*-call-guard-*` | 351 | Strong positive | Pair / straight / flush / penalty hands no longer ride the generic `CALL` rail. |
| `weakSD27` facing bet | inherited `standard-rule CALL` in multiway pre-draw pots | `FOLD/CHECK` via `s01-weak-early-*-call-guard-*` | 367 | Strong positive | High-card weak `2-7` hands stop calling large early pressure. |
| `lowerMediumSD27` / `T-low` facing bet | inherited `CALL` on the lower edge of medium | `FOLD` via lower-medium / `T-low` guard reasons | 24 | Positive | Lower rough `9-low` and `T-low` no longer bluff-catch early. |
| `upperMediumSD27` small defense | broad medium defense path | narrow exception only | 0 in validation sample | Neutral | The exception stays legal but did not show up in the validated `100-hand x 3 seed` sample. |
| premium / strong value | already positive | preserved | - | Preserved | `clean 7-low`, `smooth 8-low`, rough `8-low`, and non-rough `9-low` value lines are unchanged. |

## Summary

- Step4-O S01 fallback avg: `0.2631`
- Step4-P S01 fallback avg: `0.0000`
- Step4-P `call-guard` hits: `742`
- Step4-P full-suite EV improvement: `Pro -0.3 -> 8.0`, gap `-30.5 -> -14.0`
