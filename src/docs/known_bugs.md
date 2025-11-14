# Known Bugs (Snapshot)

| Bug ID | Title/概要 | Status | 備考 |
| --- | --- | --- | --- |
| Bug-01 | All-in 後に stack が負になる | ✅ Fixed | `isBusted` 導入、SB/BB Clamp 済 |
| Bug-02 | All-in 状態でベットが終わらない | 🟡 In progress | `isBetRoundComplete` 改修済、App 側の acted フラグ未導入 |
| Bug-03 | DRAW 開始座席が誤っている | ✅ Fixed | `calcDrawStartIndex` で統一 |
| Bug-04 | BET ラウンドの終了条件が曖昧 | 🟡 Pending | `hasActedThisRound` 追加のみ、実運用まだ |
| Bug-05 | UI 表示と Badugi 評価がズレる | 🟡 In progress | Evaluator 再実装、UI 側の表示切替待ち |
| Bug-06 | CPU の stack/bet が見づらい | 🟡 In progress | Player カード更新済、テーブル未調整 |
| Bug-07 | 画面サイズ変更で座席が崩れる | ⛔ Not started | レイアウト刷新が必要 |
| Bug-08 | ハンド履歴に途中のアクションが残らない | 🟡 In progress | DRAW ログ化済、`recordActionToLog`/JSONL 整備途中 |

## TODO / Follow-ups
- `recordActionToLog` の新フォーマット反映、および history export/import の仕様書き直し。  
- `hasActedThisRound` / `lastAggressor` の初期化・更新ロジックを App 側アクションへ実装。  
- メインテーブルをレスポンシブな Grid/Flex レイアウトへ移行し、Player パネルと合わせる。  
- Badugi 評価表示を全 UI で `rankType` / `ranks` ベースへ統一。
