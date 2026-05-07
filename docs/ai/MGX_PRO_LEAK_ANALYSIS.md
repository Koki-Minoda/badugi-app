# MGX Pro Leak Analysis

Source: `reports/ai-eval/pro-vs-standard-20260506.json`

## Regression Priority

- `D02`: EV gap 216.8
- `D01`: EV gap 174.8
- `S01`: EV gap 46.4
- `S02`: EV gap 45.6

## Fallback Reason Breakdown

| Variant | missing-logic | no-rule-match | unsafe-action | illegal-block |
| ------- | ------------: | ------------: | ------------: | ------------: |
| D03 | 0 | 0 | 0 | 0 |
| D01 | 0 | 0 | 0 | 0 |
| D02 | 0 | 0 | 0 | 0 |
| S01 | 0 | 0 | 0 | 0 |
| S02 | 0 | 0 | 0 | 0 |

## Fallback Spot Samples

| Variant | Phase | Action | Category | Reason | Hand |
| ------- | ----- | ------ | -------- | ------ | ---- |
| D01 | BET | CALL | missing-logic | standard-fallback | AS 4S 3S 10S 6C |
| D01 | BET | CALL | missing-logic | standard-fallback | 6D 2D 3C JD 8C |
| D01 | BET | CALL | missing-logic | standard-fallback | KD 6D 7C KH 8D |
| D01 | BET | CALL | missing-logic | standard-fallback | JH KC 8H KS AS |
| D01 | BET | CALL | missing-logic | standard-fallback | AC QH 6C 3S QD |
| D01 | BET | CALL | missing-logic | standard-fallback | 7D 9C AD KC 4H |
| D02 | BET | CALL | missing-logic | standard-fallback | AS 4S 3S 10S 6C |
| D02 | BET | CALL | missing-logic | standard-fallback | 6D 2D 3C JD 8C |
| D02 | BET | CALL | missing-logic | standard-fallback | 4C 9H JS 3D AC |
| D02 | BET | CALL | missing-logic | standard-fallback | AS 4S 3S 8H 5C |
| D02 | BET | CALL | missing-logic | standard-fallback | 6D 2D 3C 5D QH |
| D02 | BET | CALL | missing-logic | standard-fallback | 2D 3C 5D 10H 7H |
| S01 | BET | CALL | missing-logic | standard-fallback | AS 4S 3S 10S 6C |
| S01 | BET | CALL | missing-logic | standard-fallback | 6D 2D 3C JD 8C |
| S01 | BET | CALL | missing-logic | standard-fallback | KD 6D 7C KH 8D |
| S01 | BET | CALL | missing-logic | standard-fallback | JH KC 8H KS AS |
| S01 | BET | CALL | missing-logic | standard-fallback | AC QH 6C 3S QD |
| S01 | BET | CALL | missing-logic | standard-fallback | 7D 9C AD KC 4H |
| S02 | BET | CALL | missing-logic | standard-fallback | AS 4S 3S 10S 6C |
| S02 | BET | CALL | missing-logic | standard-fallback | 6D 2D 3C JD 8C |
| S02 | BET | CALL | missing-logic | standard-fallback | KD 6D 7C KH 8D |
| S02 | BET | CALL | missing-logic | standard-fallback | JH KC 8H KS AS |
| S02 | BET | CALL | missing-logic | standard-fallback | AC QH 6C 3S QD |
| S02 | BET | CALL | missing-logic | standard-fallback | 7D 9C AD KC 4H |

## Pro Losing Hand Samples

| Variant | Delta | Category | High Rank | Hand |
| ------- | ----: | -------- | --------: | ---- |
| D01 | -20 | highCard | 13 | 6D 2D 3C 5H KH |
| D01 | -20 | highCard | 10 | 4S 3S 5C 6S 10H |
| D01 | -10 | onePair | 14 | 6C 3S 4C 3H AD |
| D01 | -20 | highCard | 13 | KD 6D 7C 8D 10H |
| D01 | -20 | highCard | 13 | JH 8H 7S 2S KH |
| D01 | -80 | highCard | 11 | 3C 5C 8D 9H JS |
| D02 | -80 | onePair | 11 | 2D 3C 5D JH 5H |
| D02 | -60 | highCard | 12 | 3D AC 2C QH 10H |
| D02 | -80 | onePair | 11 | AS 4S 3S JC JS |
| D02 | -10 | twoPair | 4 | AC 3S 4C 3H AD |
| D02 | -20 | highCard | 13 | KD 6D 7C 8D 3C |
| D02 | -60 | onePair | 8 | 3C 5C 8D 3S 6H |
| S01 | -20 | highCard | 12 | 6D 2D 3C 8C QH |
| S01 | -20 | highCard | 10 | 4S 3S 10S 6C 8H |
| S01 | -10 | onePair | 14 | AC QH 6C 3S 6S |
| S01 | -20 | onePair | 13 | KD 6D 7C 8D 7D |
| S01 | -20 | highCard | 11 | 3C 9S JC 5C 8D |
| S01 | -20 | onePair | 13 | 7D 9C KC 4H 4S |
| S02 | -20 | highCard | 8 | 6D 2D 3C 8C 5D |
| S02 | -20 | onePair | 6 | AS 4S 3S 6C AC |
| S02 | -10 | onePair | 12 | AC QH 6C 3S 6S |
| S02 | -20 | onePair | 13 | KD 6D 7C 8D 7D |
| S02 | -20 | onePair | 11 | 3C 9S JC 5C 9D |
| S02 | -20 | highCard | 11 | 7D 9C AD 4H JS |

## Draw/Betting Leak Metrics

| Variant | Draw Mistake Rate | Betting Mistake Rate | Fallback Rate | Pro EV/Hand |
| ------- | ----------------: | -------------------: | ------------: | ----------: |
| D03 | 0.0000 | 0.0000 | 0.0000 | 7.5 |
| D01 | 0.0261 | 0.0000 | 0.2510 | -72.4 |
| D02 | 0.0121 | 0.0000 | 0.2671 | -93.4 |
| S01 | 0.0031 | 0.0000 | 0.2684 | -8.2 |
| S02 | 0.0050 | 0.0000 | 0.2603 | -7.8 |

## Pat Decision Misses

- `D01`: 32 sampled pat/draw misses
- `D02`: 29 sampled pat/draw misses
- `S01`: 3 sampled pat/draw misses
- `S02`: 5 sampled pat/draw misses
