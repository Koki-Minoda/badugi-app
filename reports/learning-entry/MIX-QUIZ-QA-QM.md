# MIX自動切替・ルールクイズ追加：QA / QM

2026-09-13。前回の学習入口実装 `a705cb3` に続く追加実装。
ブランチ: `codex/mgx-learning-entry`。ローカル実装・QA・QMを完了。本番反映は未実施。

## 利用できる機能

### MIXの連続プレイ

MIX設定で保存した内容から、認証と既存の解放条件を確認して対局を開始する。
各ハンド終了後の「次のハンド」で、指定ハンド数に達すると種目を自動で切り替える。
プレイヤーの判断や「次のハンド」の操作を自動化する機能ではない。

- 固定順、ランダム、重み付き、カテゴリ別の既存選択方式を接続。
- 公開前の種目と必ず除外する種目を飛ばす。公開済みのStud・ボード系も、通常対局と同じコントローラー判定で選択できる。
- 前ハンドの履歴を保存してから切替。持ち点、席、ボタンの順序を引き継ぐ。
- 現在の種目内のハンド数を `MIX 1/4` 形式で表示。
- 完了ハンドIDで重複加算を防止。古い「次のハンド」操作を二重切替に使わない。
- セッション開始時の設定を保持し、保存テンプレートの編集が進行中の対局へ混入しないようにする。
- 重複を許した種目順を保存できる。空候補カテゴリで選択が止まらないように修正。
- 除外IDの空白・カンマ区切り、小文字入力を処理。入力途中の区切り文字が消えないように修正。

### ルール・役比較クイズ

学習画面から `/learn/quiz` へ移動。日本語・英語に対応。
問題集は22問（A-5／2-7比較10問、Badugi枚数6問、8-or-better成立6問）。1回6問を重複なしで出題。
回答後に正解と理由を示し、回答変更をロックする。最後に正解数を表示し、間違えた問題だけ復習できる。
既存の役判定を利用し、8-or-betterでは異なる5ランクの条件も明示的に確認する。戦略のEVやGTO正解率は扱わない。

## QA結果

| 確認 | 結果 |
| --- | --- |
| 本番用ビルド | 成功 |
| 単体・画面・回帰テスト | 33ファイル・276件成功。最終表示調整後にPlayerの23件も再確認 |
| PC Chromium / Android相当 Chromium / iPhone相当 WebKit | 合計24件成功 |
| 変更コードの静的検査 | エラー0件。既存Appの未使用import警告1件 |
| 差分の空白・競合マーカー | 問題なし |

ブラウザでは前回の学習画面の15件に加え、各端末で以下を確認した。

1. A-5 TD → 2-7 TD → Badugi → Stud → NLH → PLO → A-5 TDと一巡して続行。通常のコントローラーへフォールド操作を送りハンドを終了し、種目・持ち点・席順・ボタン位置・元の種目の履歴を確認。Stud切替時の3rd Street、各CPUの公開1枚・伏せ2枚の表示枠、Drawバッジの非表示、席同士の非重複も検証。
2. 各2ハンドの切替、未公開FLHと除外したStudのスキップ、進行中の古い次ハンド操作・終了時の二重操作への耐性。
3. クイズの回答ロック、正解と理由、6問の採点、間違いだけの復習、テーマ切替、横はみ出しの確認。

単体テストでは全22問の答えを個別にレビューした期待値と照合。保存直後の新規プロフィール、連続する完了通知、設定スナップショット、固定・ランダム・重み・カテゴリ選択、除外条件、既存大会セッションが変更されないことも確認した。

## QMの確認

QMは本変更の仕様・品質の自己レビューとして実施。第三者レビューではない。

- 保存直後の古い設定参照と初回種目の受け渡し漏れを解消。
- 種目切替を次の配牌直前に置き、履歴の種目と精算済み持ち点を維持。
- 新しいStud・ボード系コントローラーへ配牌前の持ち点とボタンを渡す。通常の単一種目対局は既存の設定取得経路を維持。
- キャッシュMIXの進行情報を既存の大会セッションへ書き込む旧経路を外し、別の大会データへ混入させない。
- クイズはBadugiの文字列表現に対応した評価関数を利用。2-7のストレートの扱いを問題の期待値と照合し、適切な比較例へ修正。
- 切替後に古い種目の表示アダプターが残る問題を修正。種目と表示アダプターを対応させ、更新時に再描画する。
- Studの進行表示からDraw段階を取り除き、公開カード・伏せ札を区別。PCのStud席配置も重ならない上下2列へ修正。
- PC・スマートフォンの画像でクイズ、カード、結果表示、MIXハンド数を確認。

## 検証範囲の限界

ブラウザはローカルの本番ビルドを使用。認証・プロフィールAPIはテスト用の応答で、ゲーム自体は実際のフロントエンドコントローラーを動かした。実サーバー認証と実機端末の検証は含めない。
端末に保存されるのはMIX設定と既存のハンド履歴。今回、対局途中の再読み込みから持ち点を復元する機能は追加していない。クイズの成績はその回の画面内で扱う。
ブックマーク・メモ、条件指定配牌練習は今回の実装対象に含めていない。

## 再実行

```sh
npm run build
npx vitest run --project=tier1 src/ui/learning src/ui/mixed src/ui/game src/ui/screens/__tests__/MixedGameScreen.test.jsx src/ui/screens/__tests__/MainMenuScreen.test.jsx src/ui/__tests__/AppInitialization.test.jsx src/games/config/__tests__/variantAvailability.test.js src/games/nlh/__tests__/NLHGameController.test.js src/games/plo/__tests__/PLOGameController.test.js src/games/stud/__tests__/StudGameController.test.js src/games/draw/__tests__/singleDrawBettingOrderSpec.test.js src/games/draw/__tests__/singleDrawProgressionSpec.test.js src/games/badugi/flow/__tests__/handReplay.test.js src/ui/utils/__tests__/handHistory.test.js src/ui/utils/__tests__/persistedHandHistory.test.js src/ui/utils/__tests__/seatViewMerge.test.js src/ui/components/__tests__/Player.test.jsx src/tournament/__tests__/startResumeRetire.test.js
npx playwright test --config=playwright.learning.config.js
```

ブラウザ結果: `e2e-results.json`。画像: `browser-artifacts/`。生成物はGit対象外。
