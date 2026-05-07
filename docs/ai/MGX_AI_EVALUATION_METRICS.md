# MGX AI Evaluation Metrics

Last updated: 2026-05-07

Step3 では Pro をさらに強くする前に、Standard と Pro を同一 seed / 同一 variant / 同一 seat 条件で比較できる評価基盤を定義する。

## Required KPI

| Metric | Definition | Why Important |
|---|---|---|
| `handsPlayed` | 完了した hand 数 | サンプル数の下限 |
| `handCompletionRate` | `handsCompleted / handsRequested` | freeze や進行失敗の検知 |
| `winRate` | tier/seat の勝利 seat 比率 | 基本勝敗の比較 |
| `evPerHand` | 1 hand あたり平均 stack delta | 強さの主指標 |
| `bbPer100` | `evPerHand / bigBlind * 100` | poker 標準の比較軸 |
| `illegalActionRate` | 不正 action / action 数 | 安全性 |
| `fallbackRate` | `standard-rule` + `safe-fallback` 採用率 | Pro / model 信頼度 |
| `proOverlayRate` | `pro-overlay` 採用率 | Pro が実際に働いた割合 |
| `freezeRate` | `maxStepsPerHand` 超過率 | 進行バグの検知 |
| `evIntegrityFailureRate` | EV checker 失敗率 | stack / payout 整合性 |
| `variance` | stack delta の分散 | 安定性評価 |
| `drawMistakeRate` | made hand を壊す等の明白 draw ミス率 | Draw family 品質 |
| `recklessRaiseRate` | 弱い final hand の過剰 raise 率 | Pro 品質 |

## Step3 Scope Notes

- 評価用コードは本番 decision logic から分離する
- 同一 seed と mirrored seat assignment を使って seat bias を抑える
- illegal action / freeze / EV failure は除外せず failure として集計する
- `D03`, `D01`, `D02`, `S01`, `S02` は必須評価対象
- `B01`, `B05`, `B06`, `ST1`, `ST3` は Step3 では理由付き `NOT_RUN` を許容する
