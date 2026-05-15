# MGX Iron Step7 D01 Sub-bucket Report

## Summary

Step7 decomposed the broad `D01` late-pressure buckets into replay-isolated sub-buckets by:

- player count
- position
- pressure size
- raise state
- draw round
- hand texture

This reduced bucket entropy, but it did **not** produce any `STABLE_STANDARD_BETTER` D01 sub-bucket that was eligible for dataset export.

## Counterfactual Results

| Bucket | Samples | Confidence | Verdict | DatasetEligible |
| ------ | ------: | ---------: | ------- | --------------- |
| `strong27TD late pressure|3way|blind|medium|repeatedPressure|finalRound|rough` | 70 | 1.0000 | `STABLE_PRO_BETTER` | NO |
| `strong27TD late pressure|4way+|OOP|medium|repeatedPressure|finalRound|rough` | 38 | 1.0000 | `STABLE_PRO_BETTER` | NO |
| `strong27TD late pressure|3way|IP|medium|repeatedPressure|finalRound|rough` | 240 | 1.0000 | `NOISY` | NO |
| `strong27TD late pressure|3way|button|medium|repeatedPressure|finalRound|rough` | 221 | 1.0000 | `NOISY` | NO |
| `strong27TD late pressure|3way|OOP|medium|repeatedPressure|finalRound|rough` | 167 | 1.0000 | `NOISY` | NO |
| `strong27TD late pressure|4way+|blind|medium|repeatedPressure|finalRound|rough` | 50 | 0.7690 | `NOISY` | NO |
| `premium27TD late pressure|4way+|IP|large|repeatedPressure|finalRound|premium smooth` | 1 | 0.0333 | `NEEDS_MORE_SAMPLES` | NO |
| `premium27TD late pressure|3way|IP|medium|repeatedPressure|finalRound|premium smooth` | 1 | 0.0000 | `NEEDS_MORE_SAMPLES` | NO |
| `premium27TD late pressure|3way|button|medium|repeatedPressure|finalRound|premium smooth` | 1 | 0.0000 | `NEEDS_MORE_SAMPLES` | NO |

## Conclusion

- `D01 stable bucket >= 1` for **dataset-eligible export** was **not achieved**
- the broad `strong27TD late pressure` bucket was successfully decomposed
- the resulting low-entropy sub-buckets either remained `NOISY` or flipped to `STABLE_PRO_BETTER`
- `premium27TD late pressure` is still sample-starved even after targeted D01-only collection
