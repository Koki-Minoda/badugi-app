# MGX Iron Step5 Stable Bucket Discovery

Step5 expands the Iron bootstrap corpus with `iron-step5` quota-balanced sampling across `S01`, `D01`, `S02`, and `D02`.

## Stable Buckets

| Variant | Bucket | Samples | Confidence | Verdict | PromoteToDataset |
| ------- | ------ | ------: | ---------: | ------- | ---------------- |
| D02 | strongA5 second-pressure | 151 | 1.0000 | STABLE_STANDARD_BETTER | YES |
| S02 | strongSDA5 CALL/FOLD/RAISE | 146 | 1.0000 | STABLE_STANDARD_BETTER | YES |
| S01 | strongSD27 top-end pressure | 151 | 1.0000 | STABLE_STANDARD_BETTER | YES |

## Excluded Or Non-Stable Buckets

| Variant | Bucket | Samples | Confidence | Verdict | Reason |
| ------- | ------ | ------: | ---------: | ------- | ------ |
| D01 | premium27TD late pressure | 1 | 0.0333 | NEEDS_MORE_SAMPLES | Too sparse to promote |
| D01 | premium27TD late pressure | 2 | 0.0167 | NEEDS_MORE_SAMPLES | Too sparse to promote |
| D01 | strong27TD late pressure | 800 | 1.0000 | NOISY | Sign stability too weak despite large count |
| D01 | medium27TD pressure | 239 | 1.0000 | NOISY | Not directionally stable |
| S01 | upperMediumSD27 small-pressure | 28 | 0.4762 | NOISY | Confidence below threshold |
| S02 | premiumSDA5 CALL/RAISE | 49 | 0.0227 | NOISY | Sparse and unstable value spot |
| S02 | strongSDA5 CALL/FOLD/RAISE | 17 | 0.2824 | NOISY | FOLD vs CALL edge unstable |
| S02 | strongSDA5 CALL/FOLD/RAISE | 131 | 0.1133 | NOISY | CALL vs RAISE edge unstable |
| D02 | premiumA5 value spots | 24 | 0.0227 | NOISY | Too sparse and unstable |
| D02 | mediumA5 small-pressure | 5 | 0.1067 | NEEDS_MORE_SAMPLES | Too sparse to promote |
| D02 | strongA5 second-pressure | 19 | 0.1944 | NOISY | FOLD vs CALL edge unstable |
| D02 | strongA5 second-pressure | 2 | 0.0000 | NEEDS_MORE_SAMPLES | RAISE vs CALL sample too small |
| D02 | strongA5 second-pressure | 2 | 0.0000 | NEEDS_MORE_SAMPLES | CALL vs RAISE sample too small |

## Notes

- Step5 reaches multi-variant stability through `D02`, `S02`, and `S01`.
- `D01` quota targeting increased corpus presence, but no `D01` bucket met the stable promotion bar.
- Trash verify buckets were excluded at sampling time to avoid reintroducing weak-hand leakage into the supervised dataset.
