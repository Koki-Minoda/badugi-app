# MGX Step4-Y Fresh vs Historical Corpus

Source artifacts:
- historical corpus tag: `step4w` (counterfactual score fallback: unlabeled/legacy report)
- fresh corpus tag: `step4w` (counterfactual score fallback used)
- compared variants: `D02,S01,S02`
- max counterfactual samples: `500`

## Corpus Summary

| Corpus | Tag | Samples | Valid Replays | Invalid Replays | Notes |
| ------ | --- | ------: | ------------: | --------------: | ----- |
| Historical | `step4w` | 14884 | 10000 | 0 | Step4-W baseline corpus |
| Fresh | `step4w` | 14884 | 10000 | 0 | Live post-patch Step4-X policy corpus |
| Postpatch tag presence | `step4x` | 0 | n/a | n/a | Dedicated Step4-X replay tag does not exist; fresh Step4-Y corpus is the current post-patch source of truth |

## Bucket Comparison

| Bucket | Historical Count | Fresh Count | Historical Delta | Fresh Delta | Status |
| ------ | ---------------: | ----------: | ---------------: | ----------: | ------ |
| D02 `mediumA5 small-pressure` | 0 | 0 | -16.67 | -16.67 | `NOISY` |
| D02 `premiumA5 value spots` | 10 | 10 | 0 | 0 | `NOISY` |
| D02 `strongA5 second-pressure` | 47 | 47 | -232.98 | -232.98 | `STABLE` |
| D02 `trashA5 FOLD/CALL verify` | 3444 | 3444 | -4.79 | -4.79 | `NOISY` |
| S01 `strongSD27 top-end pressure` | 51 | 51 | n/a | n/a | `NOISY` |
| S01 `trashSD27 FOLD/CALL verify` | 5667 | 5667 | n/a | n/a | `NOISY` |
| S01 `upperMediumSD27 small-pressure` | 12 | 12 | n/a | n/a | `NOISY` |
| S02 `premiumSDA5 CALL/RAISE` | 25 | 25 | n/a | n/a | `NOISY` |
| S02 `strongSDA5 CALL/FOLD/RAISE` | 60 | 60 | n/a | n/a | `NOISY` |
| S02 `trashSDA5 FOLD/CALL verify` | 5568 | 5568 | n/a | n/a | `NOISY` |

## Notes

- `DISAPPEARED` means the bucket no longer appears in the fresh tagged corpus at the filtered replay stage.
- `NOISY` means neither corpus yields a stable replay-backed edge after fresh rescoring.
- Dedicated `step4x` replay files are optional. When absent, Step4-Y fresh corpus is the authoritative post-patch comparison set.

