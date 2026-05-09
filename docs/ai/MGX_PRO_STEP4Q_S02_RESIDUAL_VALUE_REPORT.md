# MGX Pro Step4-Q S02 Residual Value Report

| Spot | Before | After | EV Impact | Decision |
| ---- | ------ | ----- | --------: | -------- |
| `premiumSDA5` pre-draw facing small/medium pressure | `CALL` only | Safe `RAISE` candidate added, `CALL` retained under large pressure | Slight positive shift in full-suite (`Gap -20.7 -> -20.3`) | Keep |
| `strongSDA5` pre-draw first-in | Generic `CHECK` in some multiway spots | Explicit `BET` value line added | Helped focused suite more than full suite | Keep |
| `strongSDA5` final small-pressure value | `CALL` heavy, rare raise | Existing thin raise kept for safe heads-up/3-way spots | No safety regression; raise frequency remains tiny | Keep |
| `upperMediumSDA5` final heads-up first-in | Mostly `CHECK` | Heads-up thin `BET` preserved | Small focused improvement, little full-suite effect | Keep |
| `lowerMediumSDA5` / `weakSDA5` / `trashSDA5` guard | Guarded from inherited `CALL` | Unchanged | Fallback stays `0.0000`; no illegal/freeze/EV failures | Keep unchanged |

