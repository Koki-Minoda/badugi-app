# MGX Pro Step4-R S02 Value Spot Report

| Spot | Before | After | EV Impact | Decision |
| ---- | ------ | ----- | --------: | -------- |
| `premiumSDA5` pre-draw first-in | `BET` | `BET` | Neutral | 維持 |
| `premiumSDA5` pre-draw multiway small/medium pressure | `RAISE/CALL` | `RAISE/CALL` | Neutral | Step4-Q value raise を維持 |
| `strongSDA5` pre-draw 4way+ first-in | `BET` | `BET` | Neutral | 維持 |
| `strongSDA5` heads-up medium pressure | `CALL/FOLD` | `upperStrong` のみ thin `RAISE` 候補追加 | 実測差分なし | 変更は安全だが aggregate は不変 |
| `upperMediumSDA5` heads-up first-in | `BET` | `BET` | Neutral | 維持 |
| `upperMediumSDA5` 3way first-in | `CHECK` | `BET` 候補追加 | 実測差分なし | 残してよいが効果は未観測 |
| `upperMediumSDA5` 4way+ first-in | `CHECK` | `CHECK` | Neutral | 4way+ は広げない |
| `weak/trash` call guard | `FOLD/CHECK` | `FOLD/CHECK` | Positive baseline preserved | 絶対維持 |
