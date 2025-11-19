# Spec 17 – Professional Tournament System  
(全国大会〜世界大会レベルの構造、レベル進行、賞金、AI、テーブル移動)

## 1. Purpose

本仕様は、世界大会レベルの「プロ用トーナメントシステム」を標準搭載するための設計書である。  
一般的なトーナメント（Spec 11・Spec 12で扱う内容）より高度な要素を含む。

対応範囲:
- プレイヤー数最大 200～1000 の大規模大会
- マルチテーブル進行
- レベルアップ管理（SB/BB/Ante）
- Table Balancing（席移動）
- Break（休憩時間）
- Final Table へ統合
- 賞金ストラクチャー
- プロ用UI
- AIのプロ大会向け行動制御

本アプリの「世界大会モード」「全国大会モード」に直結する。

---

## 2. Tournament Structure（基本構造）

プロ大会トーナメントは以下の階層を持つ：

1) Day 1: マルチテーブル（数百名）  
2) Day 2: サバイバルフェーズ（残り各卓）  
3) Day 3: 準決勝卓  
4) Final Table（9人）  

本アプリでは簡略化し以下の規模で再現可能とする：

- Large Tournament（100〜300名）
- Multi-Table Tournament（MTT）
- Final Table 9-max

人数は CPU + プレイヤーの構成。

---

## 3. Blind Structure（レベルアップ）

Blind 進行は大会の生命線であるため厳密に管理する。

### 3.1 Blind Levels（例）

- Level1: 25 / 50
- Level2: 50 / 100
- Level3: 75 / 150
- Level4: 100 / 200
- Level5: 150 / 300
- Level6: 200 / 400
- Level7: 300 / 600
- Level8: 400 / 800
- Level9: 600 / 1200
- Level10: 800 / 1600
…  
- Final: 100k / 200k

この表は外部 JSON として読み込みできるようにする。

### 3.2 Level Duration

- 通常：10分  
- ショート：6分  
- ロング：15分  

UI設定で変更可能。

### 3.3 Antes

レベル3または4以降で Ante を導入するバージョンも設定可。

- BB Ante（推奨）
- 全員 Ante（旧版）

---

## 4. Multi-table System（マルチテーブル）

### 4.1 1テーブルの人数
- 標準：9-max  
- ハンド毎にディーラー位置（BTN）を時計回りに移動  

### 4.2 新規テーブルの生成
大会人数に応じて以下を作る：
- 100名 → 12卓（平均8.3人）  
- 200名 → 23卓  
- 最低人数 6〜10人/卓でバランス

### 4.3 テーブル移動（Table Balancing）

条件：
- 人数差が **2 以上** の卓間が発生したら自動で調整  

例：
- Table A: 9人  
- Table B: 6人  
→ 1〜2人をTable A から B へ移動

移動ルール：
- BTNから最も遠い席のプレイヤーを移動  
- 移動時はスタックそのまま  
- 次ハンド開始時に新テーブルへ初期着席

### 4.4 Table Closing（テーブル統合）

一つの卓が **4人以下** になったらテーブル閉鎖し、  
他卓へ全員を移動する。

---

## 5. Break System（休憩）

プロ大会では 4〜6レベルごとに休憩が入る。

仕様：
- breakInterval: レベル4ごと etc  
- breakDuration: 5分  
- UIカウントダウン  
- break 中は操作不可（設定だけ可能）  

---

## 6. Final Table（最終卓）

9人または8人に統合された時点で開始。

UI演出：

- Final Table 風背景  
- 特殊BGM  
- 名前プレート強調  
- elimination 順を表示  

Final Table 中のイベント：

- Player eliminate（順位表示更新）
- 新レベル突入アニメ
- Heads-up（残り2人）でUI切替

---

## 7. Prize Structure（賞金体系）

世界大会レベルの標準比率を採用：

例：100名大会

1: 25%  
2: 15%  
3: 10%  
4: 7%  
5: 6%  
6: 5%  
7: 4%  
8: 3%  
9: 2.5%  
10–12: 2%  
13–18: 1.5%  
19–27: 1%  

本アプリでは JSONで外部管理し柔軟に変更可能。

---

## 8. Player Progression & Elimination

### 8.1 Elimination（脱落）

- スタック0で即脱落  
- リストへ順位を記録  

### 8.2 Bubble（入賞境目）

- 賞金発生ライン（ITM = In The Money）  
- Bubble発生時に特別演出（低音 SE など）

### 8.3 Leaderboard（順位表）

Tournament Result まで常に更新される。

表示項目：
- Rank  
- PlayerName  
- CurrentStack  
- AvgStack  
- NextPayout  

---

## 9. Professional UI for MTT

大会画面では以下を常時表示：

1) 現在のレベル（例: “Level 7 (300/600)”）  
2) 現在のテーブル人数  
3) 総残り人数 + 自身の順位  
4) 平均スタック  
5) 次のブレイクまでの残り時間  
6) Mixed Game中なら次のゲームまで残りハンド（Spec 16連動）

Final Table では視覚優先モード：

- 大きなカード表示  
- 各プレイヤー名・スタック  
- elimination 演出  

---

## 10. AI for Professional Tournament

AI はハンド別に戦略を切替え、全ゲームに対応する。

### 10.1 Tournament-aware Strategy

AIは以下を考慮：

- 自分の順位  
- 残り人数  
- ICM（賞金期待値）  
- 相手のレンジ傾向  
- ブラインド上昇タイミング  
- Bubble Pressure（圧力）  

### 10.2 ICM モデル（簡易版）

- プレイヤーのスタック → 賞金配分 → EV を計算  
- AI はEVが向上するアクションを選択しやすくする  
- 特に Short stack 時は Push/Fold 戦略を採用する（NLH系）  

### 10.3 Multi-game ICM

Mixed GameではゲームごとにICMの影響が変わるため：

- Draw/Stud系はゆっくり戦う  
- NLH/PLO はバーストリスクが高い  

AIはこれを反映する。

---

## 11. Logging for Pro Tournament

必要ログ：

- tableId  
- seatNumber  
- elimination events  
- levelUp events  
- rebalance events  
- break events  
- finalTableStart  
- finalResult  

後からリプレイ可能な形へ。

---

## 12. Acceptance Criteria

Spec 17 が完了と見なされる条件：

1. Blind Structure / Level-up / Ante が正常動作  
2. 複数テーブルが生成・統合・席移動が可能  
3. Bubble, break, elimination ロジックが実装済み  
4. Final Table で特別UIが使用される  
5. 賞金構造が正確に適用される  
6. Tournament UI が常に順位情報を提供  
7. AI がICM / Bubble状況に対応  
8. Mixed Game (Spec 16) と矛盾しない  
9. ログが完全性と再現性を持つ  

