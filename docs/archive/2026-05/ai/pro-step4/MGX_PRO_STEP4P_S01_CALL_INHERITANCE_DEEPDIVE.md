# MGX Pro Step4-P S01 Call Inheritance Deep Dive

Baseline source:
- `reports/ai-eval/pro-vs-standard-20260506-full-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260507-full-step4o.json`
- `reports/ai-eval/pro-vs-standard-20260508-full-step4o.json`

Validation source:
- `reports/ai-eval/pro-vs-standard-20260506-s01-100-step4p-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260507-s01-100-step4p-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260508-s01-100-step4p-detailed.json`

## Buckets

| Bucket | Count | EV Impact | Draw Round | Hand Class | Facing Action | Candidate Source | Pro Action | Suggested Guard |
|---|---:|---:|---|---|---|---|---|---|
| weak high-card `CALL` inheritance | 367 | High | `0` | `weakSD27` | `4way+` facing bet, usually large | `standard-rule` `CALL` | `FOLD` via `s01-weak-early-multiway-call-guard-fold` | Block inherited `CALL` before generic default-call rails. |
| pair / penalty `CALL` inheritance | 351 | High | `0` | `trashSD27` | `4way+` facing bet, usually large | `standard-rule` `CALL` | `FOLD` via `s01-trash-early-multiway-call-guard-fold` | Treat pair / straight / flush / penalty-heavy hands as early trash. |
| lower-medium `rough 9/T-low` continue | 24 | Medium | `0` | `lowerMediumSD27` / `T-low` | multiway facing pressure | `standard-rule` `CALL` candidate | `FOLD` via lower-medium / `T-low` guard reasons | Keep only upper-medium tiny defense; fold the lower edge. |
| upper-medium small-call exception | 0 recorded in `100-hand x 3 seed` validation | Low | `0` | `upperMediumSD27` | tiny pressure | direct overlay decision | allowed but rare | Keep the exception narrow; it did not dominate the validated sample. |
| remaining fallback | 0 after Step4-P | Low | - | - | - | - | - | No extra guard needed unless new regression appears. |

## Baseline Evidence

- Step4-O full-suite average: `Pro -0.3 / Standard 30.3 / Gap -30.5 / Fallback 0.2631`
- Baseline fallback sample count: `144`
- Dominant fallback buckets:
  - `37` x `CALL | standard-fallback | drawRound 0 | large | highCard | 14`
  - `26` x `CALL | standard-fallback | drawRound 0 | large | onePair | 14`
  - `20` x `CALL | standard-fallback | drawRound 0 | large | highCard | 13`
  - `13` x `CALL | standard-fallback | drawRound 0 | large | onePair | 13`
- Representative baseline fallback hand:
  - `AS 4S 3S 10S 6C`
  - `4way+`, `toCall=20`, `betSizeBucket=large`
  - pre-Step4-P action: `standard-rule CALL`

## Step4-P Validation

| Metric | Value |
| ------ | ----: |
| Total `call-guard` hits | 742 |
| `trashSD27` guard hits | 351 |
| `weakSD27` guard hits | 367 |
| `lowerMediumSD27 / T-low` guard hits | 24 |
| Remaining fallback samples | 0 |

## Evaluation Effect

| Evaluation Set | Pro EV | Standard EV | Gap | Fallback |
| -------------- | -----: | ----------: | --: | -------: |
| S01 full `100-hand x 3 seed` Step4-O | `-0.3` | `30.3` | `-30.5` | `0.2631` |
| S01 full `100-hand x 3 seed` Step4-P | `8.0` | `22.0` | `-14.0` | `0.0000` |
| S01 focused `300-hand x 3 seed` Step4-P | `9.5` | `20.5` | `-11.1` | `0.0000` |

## Notes

- S01 responds to the same pattern that fixed D01 and S02: weak/trash inherited `CALL` was the real leak.
- The fix does not come from adding more value; it comes from preventing weak pre-draw continues in `2-7 Single Draw`.
- `A` remains high and straight/flush remain penalties throughout the guard path.
