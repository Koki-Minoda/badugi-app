# Spec 16 – Mixed Game Professional Specification  
(全国大会〜世界大会向け：HORSE / 8-Game / 10-Game / Custom Rotation / AI対応)

## 1. Purpose

Spec 11 の Mixed Game 基本仕様を強化し、  
**全国大会～世界大会レベルのプロ向け Mixed Game** を実装するための上位仕様である。

対象とするプロ仕様:
- HORSE  
- 8-Game  
- 10-Game  
- Dealer’s Choice（プロ仕様拡張）  
- Weighted Rotation  
- Category-based Random  
- Tournament向けUIと制約  
- AI戦略レイヤー

一般カジュアル向けの Mixed Game (Spec 11) の上位互換であり、  
プロ大会や WSOP MIX 系に準拠したロジックを採用する。

---

## 2. Tournament-grade Mixed Game Formats

プロ大会で使われる代表的 MIX フォーマットを標準搭載する。

### 2.1 HORSE（固定フォーマット）
順番:
1. Hold’em (FLH)
2. Omaha Hi-Lo (O8)
3. Razz
4. Stud
5. Stud Hi-Lo (Stud8)

### 2.2 8-Game
順番:
1. NL Hold’em
2. Limit Hold’em
3. Omaha Hi-Lo (O8)
4. Razz
5. Stud
6. Stud8
7. 2-7 Triple Draw
8. PLO

### 2.3 10-Game（Upper Mix）
順番の基本:
1. NL Hold’em
2. Limit Hold’em
3. Omaha Hi-Lo
4. Razz
5. Stud
6. Stud8
7. 2-7 Triple Draw
8. PLO
9. Badugi（標準バージョン）
10. No-Limit 2-7 Single Draw

本アプリでは **Badugi TD** は既に実装済みなので、最終的な 10-Game も完全対応可能。

---

## 3. Professional Rotation Rules（プロ仕様のゲーム切替）

### 3.1 固定ハンド数（標準）
1ゲームにつき固定 8 ハンド（業界標準）
変更可能：4 / 6 / 8 / 10 / 12

### 3.2 Blind / Ante の特殊処理
Hold’em / Omaha / Draw / Stud で異なるため、  
Mixed Game 内の各ゲームで以下の切替が必要。

- Stud 系: Bring-in, Ante  
- Draw 系: Ante  
- Hold’em / Omaha: SB/BB  
- PLO / PLO8: PL上限の式が変わる

### 3.3 Fixed Limit ⇄ No-Limit ⇄ Pot-Limit の切替
プロ仕様では **ベッティング構造がゲームごとに異なる**。

Mixed Game state は以下の状態を常に保持:

- betType: "FL" | "NL" | "PL"  
- streetCount  
- anteRequired  
- bringInRequired  

GameEngine 切替時に **bettingRule オブジェクト**を初期化。

---

## 4. Weighted Rotation（プロ版 Dealer’s Choice）

プロ大会では Dealer’s choice に以下の制約がある。

### 4.1 Weighted Random（重み付きランダム）

例:
- NLH: weight 2  
- PLO: weight 2  
- Badugi: weight 1  
- Stud8: weight 1  

ウェイトに応じて選択確率が変動する。

### 4.2 Category-based Random

カテゴリを選んで、その中からランダム。

例:
- Draw: {2-7 TD, A-5 TD, Badugi, Badacey}  
- Stud: {Stud, Razz, Stud8, Razzdugi}  
- Board: {NLH, FLH, PLO, PLO8, BigO}

大会によって「Drawゲームは2倍頻度」なども可設定。

### 4.3 Hard Ban / Soft Ban
特定のゲームを禁止（普段の Home Game ではよく使われる）

- hardBan: 選択不可  
- softBan: weighted random で低確率に調整  

---

## 5. Professional Mixed UI

### 5.1 フォーマットプリセット
GameSelectorに以下を即選択可能なプリセットとして追加:

- HORSE（固定）  
- 8-Game（固定）  
- 10-Game（固定）  
- Pro Dealer’s Choice（重み付き）  
- Custom（ユーザーカスタム）

### 5.2 プロ表示
テーブル上部に常に表示:

- 現在のゲーム（例: “Game 4/8: Razz”）
- 残りハンド数（例: “Next game in 3 hands”）
- ベット形式（FL / NL / PL / Hi-Lo8 / TD etc）

### 5.3 Tournament専用UI
- レベルアップ通知（Mixedでも共通）  
- 次のゲーム名の予告  
- Bring-in や Ante のルール表示  

---

## 6. Professional Rule Enforcement

### 6.1 誤選択防止
プロ版 Dealer’s Choice では “間違えてゲームを選ぶ”が禁止。  
→ プレイヤー選択 UI を簡略化してミスを防ぐ。

### 6.2 延長（Overtime）
大会では以下の処理が必要になることがある。

- プレイヤーが決めるまでの制限時間  
- 自動選択  

本アプリでは CPU 最適選択を実装。

### 6.3 Table Balancing
プロ向け Mixed Tournament では以下の処理がある:

- プレイヤー減少時の席移動  
- Table Rebalance（均等人数化）

本アプリでは簡易版を採用:

- “人数差が2以上”で自動シート移動

---

## 7. AI for Professional Mixed

プロ仕様 Mixed Game では AIの要求も高い。

### 7.1 AI Strategy Layer（ゲーム別に分離）

AIは以下の 3 層構造に:

1. Base Strategy Layer  
   - NLH / PLO 用 GTO 簡易バージョン  
   - Draw 用 discard model  
2. Adjustment Layer  
   - Mixed Game に合わせた値調整  
   - 8-Game風の Frequency 調整  
3. Meta Layer  
   - 他ゲームとの相互影響  
   - 例えば Badugi で tight なら Stud8 でも tight 傾向 etc.

### 7.2 Mixed Game Memory
AIが各ゲームの直前のプレイスタイルを記憶して判断を変える。

例:
- NLH: loose  
- 2-7TD: tight  
- PLO: aggressive  

このパターンを記憶し、次ゲームのレンジを調整。

### 7.3 Weighted Decision Making
Weighted DC の場合、AI は Weighted に基づいてゲーム選択を行う。

---

## 8. Logging for Pro Mixed

プロ大会向けの Mixed Game はログが必須。

追加ログ項目:
- mixGameFormat（HORSE, 8G, 10G etc.）
- currentGameIndex
- handsPerGame
- weightedSelectionTable
- selectedGameHistory

大会リプレイに利用可能。

---

## 9. Acceptance Criteria

Spec 16 を完了と見なす条件:

1. HORSE / 8-Game / 10-Game のプリセットが実装済み  
2. Weighted Random / Category-based Random が動作  
3. NL / FL / PL の切替がゲーム切替ごとに正しく行われる  
4. Stud / Draw / Board の ante/bring-in 設定が正確  
5. Tournament UI にゲーム切替情報が表示  
6. AI がゲームごとに戦略を切替可能  
7. ログにプロ仕様 Mixed Game の情報が含まれる  
8. Mixed Game 全体が Spec11/Spec15 と矛盾しない  

