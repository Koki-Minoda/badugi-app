| Item | Result |
| --- | --- |
| Dry-run variants | `D02 / S01 / S02` |
| D01 included | `NO` |
| Reason D01 excluded | `no STABLE_STANDARD_BETTER bucket; STABLE_PRO_BETTER only` |
| Dataset rows | `649` |
| Dry-run eligible | `true` |
| Promotion eligible | `NO` |
| Routing changed | `NO` |

| Variant | Iron EV | Pro EV | Standard EV | Dataset hit rate | Pro fallback rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| D02 | 10.33 | 6.69 | 8.29 | 0.0042 | 0.9958 |
| S01 | 5.54 | 4.32 | 7.64 | 0.0063 | 0.9937 |
| S02 | 5.17 | 5.26 | 12.29 | 0.0039 | 0.9961 |

## Summary

- Step8 defines a `3-variant` dry-run-only Iron candidate for `D02/S01/S02`.
- `D01` remains explicitly excluded because Step7 produced no `STABLE_STANDARD_BETTER` exportable bucket; its best isolated buckets were `STABLE_PRO_BETTER`.
- The arena policy is dataset-backed only on matching stable buckets and otherwise falls back to `Pro`.
- Offline arena metadata keeps `promoted=false`, `eligibleForPromotion=false`, and `routingChanged=false`.

## Notes

- Dataset hit rate is intentionally low because the current action-value dataset only covers narrow stable buckets.
- High `proFallbackRate` is expected in this dry-run phase and confirms that unmatched spots still defer to Pro rather than mutating routing.
- The dry-run is benchmark-only and does not mutate `modelRouter`, `tierManager`, or production policy selection.
