# Badugi GameEngine Migration Plan

Spec 09 の移行作業を番号付きで管理するためのメモ。完了済みタスクと今後の作業を切り分け、常に最新状況を反映する。

## 1. 完了タスク

1. `games/core/models.js` / `gameEngine.js` を整備し、共通テーブルモデルとエンジン基底クラスを用意した。
2. `GameEngineProvider` / `useGameEngine` を `RootApp.jsx` に導入し、`/game` ルートを常にエンジン経由で描画する構成に変更した。
3. `BadugiEngine` を `engineRegistry` に登録し、対応する単体テストを追加した。
4. 旧 `games/badugi/logic/*` を `games/badugi/engine/` 配下へ整理し、参照パスとテストをすべて更新した。
5. `BadugiEngine` に `IllegalActionError` などの例外ハンドリングを実装し、不正操作を即時検知できるようにした。
6. `engineTableRef` + `syncEngineTableSnapshot()` を追加し、UI state と Engine state を常時同期する仕組みを導入した。
7. `BadugiEngine.applyForcedBets()` / `advanceAfterBet()` を実装し、SB/BB/ラウンド遷移をエンジン主導へ移行した（UI にはフォールバックのみ残す）。
8. DRAW フェーズは `BadugiEngine.applyPlayerAction("DRAW")` で追跡し、`runDrawRound()` 側は互換レイヤーとして `advanceAfterAction` を呼ぶだけの構造にした。
9. Hero BET アクション（Fold / Call / Raise）を `resolveHero*` ヘルパーへ集約し、UI ハンドラーはログとエンジン同期のみを担当するよう整理した。
10. `BadugiEngine` の `DeckManager` を正規の山札として扱い、UI から独自 `deckRef` を排除した。
11. `BadugiEngine.applyPlayerAction()` / `advanceAfterBet()` がスタック・投資額・ポット系メタデータ（`totalCommitted`, `potAmount`, `betHead` など）を自動更新するよう拡張し、BET フローの数値整合性をエンジン側で保証するようにした。
12. `ui/App.jsx` 側の BET ループでターン管理・`currentBet` 参照・NPC/RING アクション処理をエンジンメタデータに寄せ、手動で `betHead` / `lastAggressor` を設定しない構成へ整理した。
13. `BadugiEngine.resolveShowdown()` を実装し、`runShowdown` / `goShowdownNow` はエンジンの配当結果（またはフォールバック）を描画するだけに変更した。
14. `dealHeadsUpFinal` でも `applyForcedBetsFromEngine()` を利用し、トーナメント終盤のフォールバック（手動 SB/BB 差し引き）を廃止した。

## 2. 進行中 / 今後のタスク

1. **テスト / ドキュメント拡充**
   - `games/__tests__/badugiEngine.test.js` をさらに拡充し（特に multi-pot / side pot / showdown summary 系）、新しい挙動をカバーする。
   - 本メモと `docs/badugi_bugs_and_roadmap.md` を更新し、`npm test` 実行を移行ステップの一部に含める。
2. **UI 側のエンジン同期仕上げ**
   - `afterBetActionWithSnapshot` など legacy ヘルパーを段階的に縮小し、RoundFlow のみが UI state を mutate する形へ寄せる。
