# MGX Step4-Y Fresh vs Historical Corpus

Source artifacts:
- historical corpus tag: `step4w` (counterfactual score fallback: unlabeled/legacy report)
- fresh corpus tag: `step4w` (counterfactual score fallback used)
- compared variants: `D02,S01,S02`
- max counterfactual samples: `500`

## Corpus Summary

| Corpus | Tag | Samples | Valid Replays | Invalid Replays | Notes |
| ------ | --- | ------: | ------------: | --------------: | ----- |
| Historical | `step4w` | 9996 | 5610 | 0 | Step4-W baseline corpus |
| Fresh | `step4w` | 9996 | 5610 | 0 | Live post-patch Step4-X policy corpus |
| Postpatch tag presence | `step4x` | 0 | n/a | n/a | Dedicated Step4-X replay tag does not exist; fresh Step4-Y corpus is the current post-patch source of truth |

## Bucket Comparison

| Bucket | Historical Count | Fresh Count | Historical Delta | Fresh Delta | Status |
| ------ | ---------------: | ----------: | ---------------: | ----------: | ------ |
| D01 `medium27TD pressure` | 0 | 0 | -7.93 | -7.93 | `NOISY` |
| D01 `premium27TD late pressure` | 0 | 0 | -6.67 | -6.67 | `NOISY` |
| D01 `strong27TD late pressure` | 0 | 0 | -57.83 | -57.83 | `NOISY` |
| D02 `mediumA5 small-pressure` | 0 | 0 | -40 | -40 | `NOISY` |
| D02 `premiumA5 value spots` | 6 | 6 | 3.33 | 3.33 | `NOISY` |
| D02 `strongA5 second-pressure` | 35 | 35 | -258.34 | -258.34 | `STABLE` |
| D02 `trashA5 FOLD/CALL verify` | 2333 | 2333 | n/a | n/a | `NOISY` |
| S01 `strongSD27 top-end pressure` | 40 | 40 | -60.59 | -60.59 | `STABLE` |
| S01 `trashSD27 FOLD/CALL verify` | 3792 | 3792 | n/a | n/a | `NOISY` |
| S01 `upperMediumSD27 small-pressure` | 8 | 8 | -11.24 | -11.24 | `STABLE` |
| S02 `premiumSDA5 CALL/RAISE` | 12 | 12 | -0.22 | -0.22 | `NOISY` |
| S02 `strongSDA5 CALL/FOLD/RAISE` | 36 | 36 | -125.65 | -125.65 | `STABLE` |
| S02 `trashSDA5 FOLD/CALL verify` | 3734 | 3734 | n/a | n/a | `NOISY` |

## Notes

- `DISAPPEARED` means the bucket no longer appears in the fresh tagged corpus at the filtered replay stage.
- `NOISY` means neither corpus yields a stable replay-backed edge after fresh rescoring.
- Dedicated `step4x` replay files are optional. When absent, Step4-Y fresh corpus is the authoritative post-patch comparison set.

