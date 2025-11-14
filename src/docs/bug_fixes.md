# Bug Fixes / Progress Log

> 状態凡例: ✅ 完了 / 🟡 進行中 / ⛔ 未着手

## Bug-01: All-in 後にスタックが負になる
- **状態**: ✅ 完了  
- **対応**:
  - `ui/App.jsx`: ブラインド支払いを `Math.min` で制限し、`isBusted` フラグを追加。単独勝利・ショーダウン終了時にも bust 状態を更新。
  - `games/badugi/logic/roundFlow.js`: `sanitizeStacks` で 0 スタックを bust 扱いに。  
  - `games/badugi/logic/showdown.js`: 配当後にも `isBusted` を再計算。

## Bug-02: All-in 状態でベットラウンドが完了しない
- **状態**: 🟡 対応中  
- **現状**: `maxBetThisRound` / `isBetRoundComplete` を見直したが、`hasActedThisRound` / `lastAggressor` の運用は App 側に未実装。BB 行動判定は暫定ロジックのまま。

## Bug-03: DRAW 開始座席がズレる
- **状態**: ✅ 完了  
- **対応**: `calcDrawStartIndex` で常に SB（ディーラー左）を起点にするよう統一。

## Bug-04: ベットラウンド終了条件が曖昧
- **状態**: 🟡 準備のみ  
- **現状**: `hasActedThisRound` / `lastAggressor` のステート追加は済みだが、各アクションでの更新・リセット処理が未実装。

## Bug-05: UI 表示と Badugi 評価の不一致
- **状態**: 🟡 進行中  
- **対応**: `games/badugi/utils/badugiEvaluator.js` を再実装し、返り値を `{ rankType, ranks, kicker, isBadugi }` へ統一。  
- **残課題**: `ui/App.jsx` ではまだ `evaluateBadugi(...).score` を参照しており、新フォーマットの表示/ログ出力に置き換えが必要。

## Bug-06: CPU の stack/bet が見にくい
- **状態**: 🟡 進行中  
- **対応**: `ui/components/Player.jsx` をカード型 UI に刷新。  
- **残課題**: テーブル配置（`ui/App.jsx`）は従来の絶対配置のままで、レスポンシブ対応はこれから。

## Bug-07: 画面リサイズで座席が崩れる
- **状態**: ⛔ 未着手  
- **メモ**: Player パネル刷新は前提作業。レイアウト自体の Grid/Flex 化は未実装。

## Bug-08: 行動ログに途中経過が残らない
- **状態**: 🟡 進行中  
- **対応**: `games/badugi/logic/drawRound.js` から `recordActionToLog` を呼び出せるようになり、DRAW アクションを記録可能に。`utils/history_rl.js` も JSONL append 方式へ変更。  
- **残課題**: `recordActionToLog` のフォーマット拡張（`stackAfter` や DRAW の詳細）と、App 側のアクションログ整備がまだ。

---

## 変更ファイル一覧と状態

| ファイル | 内容 | 状態 |
| --- | --- | --- |
| `gameLogic/betRound.js` | NPC の意思決定ロジックを新 Badugi 評価に合わせて調整 | ✅ |
| `games/badugi/logic/drawRound.js` | DRAW アクションをログ出力できるよう `onActionLog` を追加 | 🟡 |
| `games/badugi/logic/roundFlow.js` | BET→DRAW フロー、`calcDrawStartIndex`、スタック補正を改修 | 🟡 |
| `games/badugi/logic/showdown.js` | 評価ログの整備と bust フラグ更新 | ✅ |
| `games/badugi/utils/badugiEvaluator.js` | Badugi 評価ロジックの再設計 | ✅ |
| `games/badugi/utils/handRankings.js` | 未対応ゲームのデフォルト返り値を新フォーマットへ | ✅ |
| `ui/App.jsx` | Bust 管理／ブラインド支払いの修正（Bug-01 分） | ✅（Bug-02/04/08 は未完） |
| `ui/components/Player.jsx` | プレイヤーパネルを情報カード化 | 🟡 |
| `utils/badugi.js` | 旧 Badugi 評価をラッパー化して canonical evaluator を利用 | ✅ |
| `utils/history_rl.js` | JSONL 追記方式で履歴を保存・エクスポート | 🟡 |

---

## Pending / Follow-up Tasks
1. `recordActionToLog` のインターフェースを拡張し、DRAW から渡された `stackAfter` や `drawInfo` を永続化する。  
2. `hasActedThisRound` / `lastAggressor` を App の各アクションで更新し、BET 終了条件を正しく判定する。  
3. メインテーブル UI を Grid/Flex レイアウトへ刷新し、Player カードと整合させる。  
4. Badugi 評価表示 (`ev.score` 依存) を全て新フォーマットへ差し替える。
