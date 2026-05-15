# MGX Iron Step9 Hit Expansion Candidates

## Summary

Step9 の offline arena dry-run では、dataset hit は依然 sparse だが、`D02` / `S01` / `S02` の hit spot はいずれも `Pro` fallback より高い EV を示した。次に広げる候補は、既存 stable bucket の近傍だけに限定する。

| Variant | Candidate Bucket | Reason | Risk | Next |
| ------- | ---------------- | ------ | ---- | ---- |
| D02 | `strongA5 second-pressure` 近傍の safe small/medium repeated pressure | hit rate は低いが impact が最大。既存 stable bucket に隣接し、D02 dry-run 改善の主因。 | medium | `EXPAND_NOW` |
| S01 | `strongSD27 top-end pressure` の safe small/medium pressure 近傍 | hit 数が最も多く、Step9 でも Iron が Pro を安定して上回った。 | medium | `EXPAND_NOW` |
| S01 | `upperMediumSD27 small-pressure` | hit は存在するが impact は限定的で、広げる前に counterfactual 再確認が必要。 | medium-high | `NEEDS_COUNTERFACTUAL` |
| S02 | `strongSDA5 CALL/FOLD/RAISE` の safe pressure 近傍 | Step9 で大きい impact を維持。S02 の本命候補。 | medium | `EXPAND_NOW` |
| S02 | `premiumSDA5 CALL/RAISE` / sparse good-hand pressure | 既存 corpus では sparse。広げる前に stability 再取得が必要。 | high | `NEEDS_COUNTERFACTUAL` |
| D01 | `premium27TD late pressure` / `strong27TD late pressure` | Standard teacher の stable bucket が未成立。Step9 でも除外継続。 | high | `DO_NOT_TOUCH` |

## Notes

- `EXPAND_NOW` は既存 stable bucket の近傍だけを対象にする。
- `NEEDS_COUNTERFACTUAL` は新しい teacher action を入れる前に replay-backed stability を再確認する。
- `D01` は `STABLE_PRO_BETTER` が先に出ており、現時点では Standard teacher dataset に入れない。
