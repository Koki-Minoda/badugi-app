# MGX Pro Step4-R S02 Good-Hand Value Spots

Step4-Q 後の `S02` は weak/trash defense ではなく、sparse な good-hand value spot だけが残差でした。Step4-R では `premiumSDA5 / strongSDA5 / upperMediumSDA5` の pre-draw / 4way+ spot を detailed trace で確認し、最小限の value 拡張だけを試しました。

| Hand Class | Spot | Count | Current Action | EV Impact | Standard Action | Suggested Fix |
| --- | --- | ---: | --- | ---: | --- | --- |
| `premiumSDA5` | Pre-draw 4way+ facing small pressure | 1 | `RAISE` | Positive | `CALL` | 既に Step4-Q で value raise が入っており、追加 trim は不要 |
| `premiumSDA5` | Final 4way+ first-in | 1 | `BET` | Positive | `BET` | 維持 |
| `strongSDA5` | Final 4way+ first-in | 3 | `BET` | Positive | `BET` | 維持 |
| `strongSDA5` | Final 4way+ facing follow-up pressure | 1 | `FOLD` | Negative sample | `CALL` | 1 サンプルのみで、ここを広げると weak-side reopen のリスクがあるため Step4-R では不採用 |
| `upperMediumSDA5` | Pre-draw 4way+ first-in | 1 | `CHECK` | Neutral | `CHECK` | 4way+ は `CHECK` 維持 |
| `upperMediumSDA5` | Pre-draw 3way first-in | Sparse | `CHECK` baseline | 未観測 | `BET/CHECK` | heads-up に加えて 3way だけ thin `BET` を許可しても aggregate は不変 |

## Summary

- Step4-R で実際に触るべき spot はかなり sparse だった。
- `premiumSDA5` と `strongSDA5` の main value line は既に Step4-Q 時点で十分プラス。
- aggregate gap を押し下げている主因は「明確にミスしている good-hand line」ではなく、rare spot の分散に近い。
- そのため Step4-R の安全な小幅拡張では、focused / full-suite とも平均 EV は Step4-Q から実質不変だった。
