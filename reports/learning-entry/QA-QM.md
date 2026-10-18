# MGX 学習入口・ルール確認・MIXテンプレート 実装とQA/QM

追記: この記録にあるMIX自動進行の未接続は、[追加実装とQA/QM](MIX-QUIZ-QA-QM.md)で解消済み。以下は前回 `a705cb3` 時点の記録。

2026-09-13。今回の3機能について、ローカル実装・QA・QMを完了。
基準: リリース済み `origin/main` (`dec0cd17f7af93e8d85b2f41dd9b08416cbf6131`)。
作業ブランチ: `codex/mgx-learning-entry`。本番への反映は未実施。

## 実装したもの

- **種目別の学習入口**: メニューから `/learn` に進み、13種目の勝敗、Aの扱い、カード・交換、ベット形式、手番を日英で確認。公開済み種目は、既存の認証・公開制限を通して選択した種目を開始。言語設定、履歴画面への導線も接続。
- **種目切替のルール確認**: 対局の現在種目を表示し、変更時は通知ラベルと前種目との差分を表示。古いルールパネルは閉じる。キーボード開閉、フォーカス復帰に対応。スマートフォンは操作欄に配置。
- **目的別MIXテンプレート**: Lowball Basics（A-5 TD → 2-7 TD → Badugi、各4ハンド）、HORSE Practice（FLH → FLO8 → Razz → Stud → Stud8、各4ハンド）、8-Game Warm-up（2-7 TD → HORSE → NLH → PLO、各6ハンド）。種目順と切替ハンド数を端末に保存し、既存のMIX設定で確認・編集。重複追加と編集済み設定の上書きを防止。保存できない場合は端末に保存したと表示しない。

## QAの結果

| 確認 | 結果 |
| --- | --- |
| 指定された依存バージョンのクリーンインストール `npm ci` | 成功 |
| 本番用ビルド `npm run build` | 成功 |
| 単体・画面・回帰テスト | 24ファイル、172件成功 |
| PC Chromium / Android相当 Chromium / iPhone相当 WebKit | 15件成功、ページ実行エラー0件 |
| 新規コード・変更ファイルの静的検査 | エラー0件。既存Appの未使用import警告1件 |
| 差分の空白・競合マーカー確認 | 問題なし |

画面テストではメニュー遷移、ルール差分、重複保存防止、再読み込み、MIX設定への読み込み、英語保持、非公開FLHの開始抑止、未ログイン時のログイン要求、ログイン後の選択維持、対局開始、パネル開閉、フォールド操作を確認。スマートフォンの縦横表示と横はみ出し、横画面でパネルを最後までスクロールして閉じられることも確認。
単体・回帰テストには保存失敗、編集済み設定の保持、未知のURL、React StrictModeでの二重開始抑止、既存画面初期化、公開制限、ローテーション、Single Drawの進行・手番を含む。

再実行:

```sh
npm ci
npm run build
npx vitest run --project=tier1 src/ui/learning src/ui/screens/__tests__/MixedGameScreen.test.jsx src/ui/screens/__tests__/MainMenuScreen.test.jsx src/ui/screens/layouts src/ui/game src/ui/__tests__/AppInitialization.test.jsx src/ui/mixed src/games/config/__tests__/variantAvailability.test.js src/games/draw/__tests__/singleDrawBettingOrderSpec.test.js src/games/draw/__tests__/singleDrawProgressionSpec.test.js src/games/core/__tests__/variantDefinition.test.js
npx playwright test --config=playwright.learning.config.js
```

ブラウザー結果は `e2e-results.json`、画像は `browser-artifacts/` に生成される。生成物はローカル保存しGit対象外。

## QMの確認と修正

QMは本変更の仕様・品質の自己レビューとして実施。第三者によるレビューを意味しない。

- 一般的なポーカーの説明をそのまま使わず、MGXの実装と照合。S01は現在のエンジンが固定リミットであるため明記し、実際に生成したハンドの設定と一致するテストを追加。
- HORSEのOはFLO8（B09）を選択。PLO8（B06）との取り違えを防ぐ契約テストを追加。
- 新画面からの開始に既存の認証と公開判定を適用。未公開種目は学習のみ。MIX設定の既存解放条件を保持。
- スマートフォンでボタンが相手の名前に重なる点を画像確認で発見し、対局操作欄へ移動。閉じるボタンはスクロール中も表示。
- パネルは手動で開く方式とし、対局は進行することを表示。ベット・CPU・勝敗判定を変更していない。
- 保存済みの編集内容を再保存やリンクで上書きしないこと、ストレージ不使用時も表示が破綻しないことを確認。

## 完了範囲と制限

今回のMIX機能は**テンプレートの定義・保存・設定画面への接続**まで。学習画面のプレイは種目単位で開始する。
既存カスタムMIXの自動進行は今回の完了対象に含めない。既存実装では `MixedGameContext.handleHandCompletion` の対局側への接続がなく、`MixedGameScreen.handleStart` にも保存直後の参照と初回種目の受け渡しに課題があるため、連続自動プレイを完成済みとして扱わない。自動進行の完成には別途その接続とハンド単位の検証が必要。

ブラウザー検証はローカルの本番ビルドを使用し、認証・プロフィールAPIはテスト用応答に置き換えた。ゲーム進行は実際のフロントエンドエンジンを実行。実サーバー認証、実機端末、本番配信の確認は含めない。
ソルバー、専用配牌練習、EV判定、外部ハンド履歴の取り込み、日次継続機能は本変更に含めていない。
