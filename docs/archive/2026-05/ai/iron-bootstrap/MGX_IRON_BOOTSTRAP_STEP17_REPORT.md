| Item | Result |
| --- | --- |
| Target bucket | `S02_RELAXED_V3` |
| strongSDA5 count | 57 |
| 3way count | 0 |
| exact opportunities | 0 |
| exact hits | 0 |
| targeted arena hands | 3000 |
| dataset rows changed | NO |
| deterministic replay | true |
| promoted | false |
| routingChanged | false |

| Stage | Count |
| --- | ---: |
| S02 decisions | 4290 |
| strongSDA5 | 57 |
| 3way | 0 |
| IP | 1530 |
| small call | 414 |
| pressureChain match | 2897 |
| exact opportunity | 0 |
| dataset hit | 0 |

| Variant | Iron EV | Pro EV | Standard EV | Iron-Pro Gap | HitRate |
| --- | ---: | ---: | ---: | ---: | ---: |
| D02 | 4.16 | 3.21 | 1.93 | 0.95 | 0.0036 |
| S01 | 4.00 | 3.28 | 2.19 | 0.72 | 0.0031 |
| S02 | 4.79 | 3.52 | 0.61 | 1.27 | 0.0039 |

| Corpus Metric | Result |
| --- | ---: |
| Step17 replay samples | 275 |
| strongSDA5 replay samples | 275 |
| 3way replay samples | 275 |
| exact-opportunity-like replay samples | 246 |
| counterfactual deterministic | true |
| counterfactual invalidReplayCount | 0 |

| Safety | Result |
| --- | --- |
| illegal | 0 |
| freeze | 0 |
| D01 excluded | true |
| promoted | false |
| routingChanged | false |

Step17 conclusion:

- Arena blocker remains `PLAYERCOUNT_MISMATCH`.
- `strongSDA5` does appear live, but all observed candidate decisions stayed at `4way+` / `activePlayersAtDecision=6`.
- Step17 corpus proves the target shape exists in replay data: `275` S02 replay samples, all `3way`, with `246` exact-opportunity-like rows.
- Counterfactual on the Step17 corpus remained clean and stable for `S02 strongSDA5 CALL/FOLD/RAISE` with `invalidReplays=0`.
- Dataset rows were intentionally left unchanged in this diagnostic step.
