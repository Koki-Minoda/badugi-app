# Spec 15 – UI/UX Flow System (全画面・全遷移・共通UI設計)
(Title → Menu → GameSelector → Table → Result → History までの完全体系)

## 1. Purpose

本仕様はアプリ全体の UI/UX フローを統一するための「全画面網羅仕様」である。  
以下すべてを扱う：

- タイトル画面
- メインメニュー
- ゲームセレクター（Single / Mixed / Tournament）
- ロック/アンロック（Spec 12）
- テーブル画面（ゲーム中 UI）
- モーダル / 設定 / 履歴
- 勝敗画面（Hand Result / Tournament Result）
- Mixed Game 切替 UI (Spec 11)
- テーマ・アニメーション指針
- モバイル/PC 共通レイアウトポリシー

UIとUX全体がバラバラに開発されないようにするため、Codex用の基礎ガイドラインでもある。

---

## 2. Global UI Principles

アプリ全体で統一するUX基本方針：

1. 「2タップ以内で目的に到達できる」  
2. 「ゲーム中の邪魔になる要素は極限まで排除」  
3. 「情報量を絞り、判断要素だけを見やすくする」  
4. レスポンシブ（PC / iPad / スマホ）でレイアウト破綻しない  
5. フォントサイズは 14〜18px を最低ラインに  
6. モーダル・ポップアップは原則フルスクリーン（スマホ）  
7. テーブル画面では UI 操作を画面下部に集約  
8. 重要モードはアイコン化して視線移動を最小化

---

## 3. High-level Screen Map（遷移図）

アプリ全体の画面遷移：

Title  
→ MainMenu  
→ GameSelector  
→ Table (ゲーム中)  
→ HandResult  
→ GameResult / TournamentResult  
→ Return to MainMenu

補助画面：

MainMenu  
→ Settings  
→ History  
→ Profile  
→ UnlockPopup（Spec 12）

GameSelector  
→ MixedGameSetup（Spec 11）  
→ TournamentSetup  
→ RingSetup

Table  
→ PauseMenu  
→ RulesHelp  
→ Settings（In-game）

---

## 4. Title Screen

要素：

- アプリアイコン（世界観統一）
- "START" ボタン
- バージョン番号
- ユーザーデータ読み込み

UX要件：

- START 押下後 0.3〜0.5 秒で MainMenu へ遷移  
- ローディング不要（事前ロード済み）  
- スキップ不可の演出は置かない（長くなるのでNG）  

---

## 5. Main Menu（メインメニュー）

構成要素：

- Play（ゲーム開始）
- History（ハンド履歴）
- Settings
- Profile
- Unlock 状態（Spec 12）
- ニュースバナー（任意）

UX要件：

- Play を最上部に置いて最短導線を確保  
- Locked モードは灰色・COMING SOON 表示  

---

## 6. GameSelector

ゲームの種類を選択する画面。  
表示順：

1. Badugi（常時解放）
2. Mixed Game（WCクリア後解放）
3. Single Game 一覧
4. Tournament（WCクリア前でも Badugi 限定で選択可）
5. Ring（キャッシュゲーム）

各カード要素：

- アイコン（ゲームごとに色分け）
- タイトル
- モード種別（Single / Multi / Draw / Stud etc.）
- ロック状態

UX要件：

- 1行に2カード  
- スマホは縦スクロール、PCはグリッド  
- Locked はタップ時に説明表示（Spec 12）

---

## 7. Mixed Game Setup（Spec 11 準拠）

要素：

- ゲーム一覧 (最大20選択)
- チェックボックス
- ドラッグ＆ドロップ順序
- Dealer's Choice (RANDOM) 切替
- Hands-per-Game 設定
- プロファイル保存・読み込み

UX要件：

- 選択されたゲームは画面下部のサマリーに表示  
- ゲーム数 1〜20 の制限を常に UI に表示  
- エラーメッセージはモーダルではなく「画面内通知」にする  

---

## 8. Tournament Setup

項目：

- スタートチップ量
- Blind 構造（レベル上昇間隔）
- CPU 数
- レベル進行表
- 開始ボタン

UX要件：

- 最重要情報は「開 始」ボタンの近くに集約  
- CPU 難易度選択を視覚化  
- WC（World Championship）は専用UI  

---

## 9. Table Screen（ゲーム中 UI）

テーブル画面は最重要画面。  
要素：

- カード表示（Player / CPU）
- ベット・フォールド・チェックなどの操作ボタン
- Pot / 現在のベット額 / スタック
- ドローボタン（Drawゲーム）
- Boardカード（Hold’em/Omaha/Dramaha）
- Upcards（Stud）
- Mixed Game 現在ゲーム（Spec 11）
- 設定/一時停止

UX ガイドライン：

1. ボタンは画面下中央に集約  
2. Player Cards は常に最大サイズで表示  
3. CPU のベット額は Player より控えめ  
4. Mixed Game 中は「現在のゲーム名」を画面上部に固定表示  
5. Card Squeeze (絞り演出) は軽量アニメーションで  

レイアウト崩れの防止（重要）：

- プレイヤー位置は 6max/8max 共通の相対ポジションで管理  
- ズーム/回転で崩れないように等比スケール固定  
- React + CSS で座標指定ではなく flex + relative で処理  

---

## 10. Result Screens

### Hand Result

- 勝敗表示
- 使われた役（High/Low/Badugi）  
- Showdown に使われた最終5枚  
- Mixed Game 中は「次のゲームまであとXハンド」（Spec 11）

### Tournament Result

- 順位
- 獲得賞金
- CPU名・難易度
- 次リーグへの導線（WC）

UX ガイドライン：

- 画面の半分以上をカード表示/役表示に割り当てる  
- 再戦ボタンとロビーに戻るボタン  

---

## 11. History Screen（ハンド履歴）

要素：

- 日付フィルター
- ゲーム種別フィルター
- ハンドID
- ゲームID（Badugi / NLH / 27TD）
- Showdown結果
- JSON閲覧（Spec 08）

UX要件：

- モバイルでは縦長リスト  
- PCでは2カラムで見やすく  
- JSON は折り畳み可能にする  

---

## 12. Settings

要素：

- BGM / SE 音量
- カードスキン
- テーマカラー
- 言語
- 規約・最新版情報

UX方針：

- 1ページに詰め込みすぎない  
- トグルスイッチで即時反映  

---

## 13. Modal / Popup / System UI

基本ルール：

- 全画面ダイアログ（スマホ）
- 中央モーダル（PC）
- 外側タップで閉じない（誤操作防止）
- アニメーションは 200ms〜250ms

Popup 種類：

- UnlockPopup（Spec 12）
- ErrorPopup
- ConfirmPopup
- PauseMenu

---

## 14. Responsive Layout Rules

端末ごとに要求する最低限のルール：

### モバイル
- 主操作は下部
- カードは大きく
- リストは縦スクロール

### タブレット
- 2カラム表示
- テーブルは広い円周レイアウト

### PC
- 横幅広く高密度表示
- GameSelector はグリッド6列まで

全端末共通：

- 画面の比率が変わっても player seat が崩れない  
- card scale は最大カード幅に応じて auto-fit  

---

## 15. UX Performance Requirements

- タップ応答 50ms 以内  
- 画面遷移 0.4秒以内  
- モーダル表示 0.2秒  
- カードアニメーション 60fps  
- ゲーム切替（Mixed） 0.5秒以内  

---

## 16. Acceptance Criteria

Spec 15 が完了したとみなす条件：

1. Title → Main → Selector → Table → Result の全連携が記述されている  
2. Mixed Game / Unlock / Tournament / Ring を UI が完全に説明  
3. テーブル画面のボタン配置・ポジション変動に関するルールが明示されている  
4. レスポンシブ対応の最低要件を満たす  
5. History / Settings / Modal すべて定義済み  
6. Codex が UI 部品を自動生成するとき参照できる十分な情報量がある

