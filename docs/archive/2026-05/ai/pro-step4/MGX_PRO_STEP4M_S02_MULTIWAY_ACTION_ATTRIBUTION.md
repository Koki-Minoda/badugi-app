# MGX Pro Step4-M S02 Multiway Action Attribution

Source:
- `reports/ai-eval/pro-vs-standard-20260506-s02-300-step4m-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-300-step4m-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-300-step4m-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260506-s02-100-step4m-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260507-s02-100-step4m-detailed.json`
- `reports/ai-eval/pro-vs-standard-20260508-s02-100-step4m-detailed.json`

The table below focuses on the spots that actually move EV.

| Spot | Hand Class | Player Count | Action | Count | EV Impact | Verdict | Suggested Fix |
| --- | --- | ---: | --- | ---: | ---: | --- | --- |
| First-in final value | `premiumSDA5` | `4way+` | `BET` | `18` focused / `6` full | `+4300` focused / `+1620` full | Positive | Keep first-in premium value betting. |
| Facing raise after premium final line | `premiumSDA5` | `4way+` | `CALL` | `14` focused / `5` full | `+3500` focused / `+1040` full | Positive | Keep premium defend/call; do not over-trim. |
| First-in final value | `strongSDA5` | `4way+` | `BET` | `40` focused / `9` full | `+8390` focused / `+2220` full | Positive | Keep strong first-in value betting. |
| Facing raise after strong line | `strongSDA5` | `4way+` | `FOLD` | `21` focused / `7` full | `-470` focused / `-160` full | Mild negative, not dominant | Do not chase this bucket first; it is much smaller than trash-call leakage. |
| First-in / facing-bet thin line | `upperMediumSDA5` | `4way+` | `BET` / `CALL` | `12+` focused / `9` full | Positive in both samples | Positive | The Step4-L upper-medium line is not the regression source. |
| Facing bet | `trashSDA5` | `4way+` | `CALL` | `2014` focused / `682` full | `-19180` focused / `-4520` full | Primary loss bucket | Replace `standard-rule` call inheritance with explicit S02 `CHECK/FOLD` / `FOLD` guards earlier in the hand. |
| Facing raise | `trashSDA5` | `4way+` | `FOLD` | `1296` focused / `448` full | `-21340` focused / `-7380` full | Secondary symptom | These folds mostly reflect bad entry into the pot; fix the earlier continue node instead. |
| First-in passive line | `weakSDA5` | `4way+` | `CHECK` | `351` focused / `121` full | `+6470` focused / `+3160` full | Positive | Weak hand passivity is not the issue. |
| First-in passive line | `trashSDA5` | `4way+` | `CHECK` | `1729` focused / `569` full | `-11740` focused / `-4520` full | Neutral-to-bad but safer than call | Leaving trash as passive is preferable to reopening defense. |

## Attribution Verdict

- The multiway audit does not support the theory that premium/strong value raises are over-aggressive.
- The multiway audit does not support the theory that `upperMediumSDA5` open thin value is the main leak.
- The dominant EV loss remains early and mid-hand `standard-rule` `CALL` volume on `trashSDA5` in `4way+` pots.
- Step4-M should therefore target S02 early decision coverage, not further suppression of the final-street value line.
