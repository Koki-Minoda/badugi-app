# MGX Iron Bootstrap Step16 Report

## Summary

| Item | Result |
| --- | --- |
| Dataset rows changed | NO |
| Target bucket | S02_RELAXED_V3 |
| Exact opportunities | 0 |
| Exact hits | 0 |
| Near misses | 4301 |
| Targeted arena hands | 1000 x 3 seed |
| Targeted arena opportunities | 0 |
| Deterministic replay | true |
| promoted | false |
| routingChanged | false |

Dataset remained [iron-step15-action-value.jsonl](/home/mgx/badugi-app/data/ai/action-value/iron-step15-action-value.jsonl) with `1069` rows. No Step16 dataset rows were added because this step was diagnostic only.

## Opportunity Funnel

| Stage | Count |
| --- | ---: |
| S02 decisions | 4301 |
| strongSDA5 | 62 |
| 3way | 0 |
| IP | 1525 |
| small call | 405 |
| pressureChain match | 2896 |
| exact opportunity | 0 |
| dataset hit | 0 |

## Near Miss Reasons

| Reason | Count |
| --- | ---: |
| NO_STRONG_SDA5 | 4239 |
| PLAYERCOUNT_MISMATCH | 62 |
| POSITION_MISMATCH | 0 |
| CALL_BAND_MISMATCH | 0 |
| PRESSURE_CHAIN_MISMATCH | 0 |
| ACTION_ILLEGAL | 0 |
| DATASET_ACTION_NOT_LEGAL | 0 |
| MATCHED_BUT_NOT_SELECTED | 0 |
| LEGAL_BUT_NOT_SELECTED | 0 |
| EXACT_HIT | 0 |

The blocker is not legality and not action mismatch. In the targeted Step16 arena, the exact `3way` opportunity never formed. Every `strongSDA5` candidate that survived the first funnel failed at `PLAYERCOUNT_MISMATCH`.

## Normal Arena

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | HitRate |
| --- | ---: | ---: | ---: | ---: | ---: |
| D02 | 4.16 | 3.21 | 1.93 | 0.95 | 0.0036 |
| S01 | 4.00 | 3.28 | 2.19 | 0.72 | 0.0031 |
| S02 | 4.79 | 3.52 | 0.61 | 1.27 | 0.0039 |

Normal arena command:

```bash
npm run eval:ai:iron:arena -- --dataset=data/ai/action-value/iron-step15-action-value.jsonl --variants=D02,S01,S02 --hands=500 --seeds=20260702,20260703,20260704,20260705,20260706
```

`Iron > Pro` was preserved for `D02`, `S01`, and `S02`.

## Targeted S02 Arena

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | HitRate |
| --- | ---: | ---: | ---: | ---: | ---: |
| S02 | 5.98 | 4.68 | 7.86 | 1.30 | 0.0049 |

Targeted arena command:

```bash
npm run eval:ai:iron:arena -- --dataset=data/ai/action-value/iron-step15-action-value.jsonl --variants=S02 --hands=1000 --seeds=20260629,20260630,20260701 --target-bucket=S02_RELAXED_V3 --targeted-sampling --target-min-opportunities=20
```

Targeted arena result:

| Item | Value |
| --- | ---: |
| datasetHitRate | 0.0049 |
| proFallbackRate | 0.9951 |
| exact opportunities | 0 |
| exact hits | 0 |
| relaxed hits | 0 |

## S02 Hit Impact

Existing S02 rows still drove the gains.

| Source | Hits | Impact |
| --- | ---: | ---: |
| stable-bucket | 17 | 462.07 |
| verified-neighbor-v1 | 2 | 341.45 |
| verified-neighbor-v2 | 2 | 596.45 |
| verified-neighbor-v3-isolated | 0 | 0.00 |
| verified-relaxed-match | 0 | 0.00 |

## Safety

| Item | Result |
| --- | --- |
| illegal | 0 |
| freeze | 0 |
| acceptedInvalidReplayCount | 0 |
| deterministicReplay | true |
| D01 excluded | true |
| promoted | false |
| routingChanged | false |

Artifacts:

- [replay-determinism-audit-iron-step16.json](/home/mgx/badugi-app/reports/ai-eval/replay-determinism-audit-iron-step16.json)
- [s02-relaxed-opportunity-profile-step16.json](/home/mgx/badugi-app/reports/ai-iron/s02-relaxed-opportunity-profile-step16.json)
- [s02-relaxed-near-miss-step16.jsonl](/home/mgx/badugi-app/reports/ai-iron/s02-relaxed-near-miss-step16.jsonl)
- [iron-step16-s02-targeted-arena.json](/home/mgx/badugi-app/reports/ai-iron/iron-step16-s02-targeted-arena.json)
- [iron-step15-offline-arena-result.json](/home/mgx/badugi-app/reports/ai-iron/iron-step15-offline-arena-result.json)
