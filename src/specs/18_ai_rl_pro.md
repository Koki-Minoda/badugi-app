# Spec 18 – Professional AI & Reinforcement Learning System  
(Multi-Game戦略モデル / 世界大会レベルのCPU / RL学習・推論 / メタ戦略)

## 1. Purpose

本仕様はアプリの AI（CPU）の最高難易度層である  
「プロ大会向けAI」および  
「Multi-gameに適応する強化学習AI」  
の統一アーキテクチャを定義する。

目的:
- ゲーム別最適戦略（GTO近似）を利用した強いCPU
- Mixed Game（Spec 16）でゲームごとに戦略が切り替わるメタAI
- 世界大会レベル（Spec 17）で ICM対応や相手適応が可能
- Reinforcement Learning（RL）による学習と推論を分離
- ゲーム履歴（Spec 08）からモデルがアップデート可能
- プロ用 CPU Tier（Beginner → Iron → Pro → WorldMaster）

---

## 2. AI Layered Architecture（3層構造）

AIは以下の3層で構成される。

### 2.1 Layer 1: Base Strategy Layer（ゲーム固有・静的）
各ゲームに対して「ベース戦略」を保持する。

例:
- NLH: GTO簡易レンジ / Push-Foldレンジ / Postflop簡易規則
- PLO: 4cardレンジ / PLベット規則
- 2-7 TD: discardモデル（捨てる枚数の確率）
- Badugi: discard選択 + ベット頻度
- Stud系: 3rd〜7thのアップカード情報からの戦略テーブル
- Dramaha: Hybirdレンジ

→ ベース戦略は「手動 + 半自動生成」。

### 2.2 Layer 2: Adjustment Layer（Mixed Game / Tournament対応）
ゲーム状況で戦略を調整。

調整要素:
- Mixed Gameのゲーム順（Spec 16）
- 現在のゲームの危険度（NLH/PLOは高、Draw系は低）
- スタック深さ
- テーブル人数
- TournamentのICM圧力（Spec 17）
- 対戦相手のスタイル（loose/tight 等）

### 2.3 Layer 3: Meta Layer（プレイヤー・ゲーム間相互影響）
AIが「ゲーム間で他ゲームのプレイ傾向を記憶して」  
次ゲームの戦略を変える。

例:
- NLHでtight → Badugiでもtight寄り
- PLOでaggressive → Studでもbet頻度高
- Mixed Game全体で相手のrange傾向を学習

Meta Layer は RL で学習可能。

---

## 3. Tier Structure（CPU難易度体系）

CPUは以下の難易度Tierを持つ。

1) Beginner（初心者）  
   - 設定通りの弱い行動、ブラフ少ない  
2) Standard  
   - ルール理解、平均的強さ  
3) Strong / Semi-Pro  
   - ほぼミスなし、捨てるカード良い  
4) Pro  
   - 相手のパターンを読む / ICMに対応  
5) Iron（鉄強）  
   - RLモデル + メタ戦略  
6) WorldMaster（最終ボス）  
   - 全ゲームのメタ学習・ランダム性の調整完備  
   - 人間トップレベルと対戦できるレベル

Iron と WorldMaster は RLを使用したモデル必須。

---

## 4. RL Data Pipeline

強化学習（RL）は以下のパイプラインで構成される。

### 4.1 Observation（状態）
状態空間はゲームごとに異なるが共通構造を持つ：

共通要素:
- 自分のハンド
- ボード（Hold’em/Omaha系）
- ドロー回数（Draw系）
- 見えているアップカード（Stud系）
- スタック
- ベットラウンド
- Mixed Gameの現在ゲームID
- 相手人数
- 相手スタイル（推定）

### 4.2 Action（行動）
ゲーム共通の行動:
- fold  
- call  
- check  
- bet/raise (size)  
- discard selection（Draw系）  
- bring-in（Stud系）

RLでは**bet sizingは階層化または離散化**して扱う。

### 4.3 Reward（報酬）
標準報酬：
- 戦利金増減  
- TournamentではICMベースの報酬  
- Mixed Gameではメタ報酬（総合勝率）  

### 4.4 Storage
Spec 08 の履歴 JSONL をそのまま RL experience buffer として使用:

- handRecord  
- tournamentRecord  
- mixedGameSwitch  
- showdown情報  
- discard選択  
- 最終Reward（chips, ICM EV）  

### 4.5 Training
本アプリでは RL training は外部（ユーザーPCまたはPythonスクリプト）。

ファイル出力:
- model_xxx.onnx  
- stats.json  
- training_log.jsonl  

### 4.6 Inference（推論）
アプリ内部では ONNX推論のみ実行する。  
学習は外部で行い、結果を ONNX として読み込む。

---

## 5. Model Switching（Multi-game対応）

Mixed Game（Spec 11/16）ではゲームごとにモデルを切り替える。

方式：
- 各ゲームに専用モデルを用意  
  例: nlh_v3.onnx / badugi_v2.onnx / 27td_v4.onnx
- または1モデルにゲームID埋め込み（Multi-head）  

WorldMaster Tierでは Multi-head model を採用。

---

## 6. Dynamic Opponent Modeling（相手モデリング）

AIはプレイヤーのパターンを記録する。

記録する特徴量:
- VPIP（参加率）
- PFR（プリフロップレイズ率）
- 3bet率
- fold to cbet率
- showdown率
- draw discard傾向（Draw系）
- Studの upcard aggression
- Mixed Gameでの「ゲーム別強さ」

AIは数ハンドごとに opponentProfile を更新し、  
Layer2の調整に反映する。

---

## 7. Mixed Game 特有のAI拡張

プロ仕様 Mixed Game ではAIは以下を考慮する。

1) ゲーム危険度  
   - NLH/PLO は高 → タイト戦略  
   - Draw/Stud は低 → 広いレンジ  

2) 次のゲーム  
   - 次が Badugi → このゲームでスタック調整  
   - 次が NLH → tightに切り替え  

3) Weighted rotation  
   - 選ばれやすいゲームを意識して戦略を最適化  

4) プロ Dealers Choice  
   - HardBanを理解  
   - Weighted選択  

5) トーナメントICM  
   - NLHはICMが強く効く  
   - Draw系は弱い  
   → レベルに応じて危険度調整

---

## 8. WorldMaster AI（最終ボス仕様）

最終難易度（CPUの最高峰）は以下の要求を満たす。

1) 全ゲームの Multi-head RL モデル  
2) Meta Layer によるゲーム間の戦略連動  
3) ICM最適化  
4) 対戦履歴による相手の exploitable 対策  
5) Mixed Game の予測値計算  
6) Bluff率・Value率の調整  
7) 過剰なGTO固執を避ける「ランダム性注入」  
8) スタックに応じた高次意思決定

---

## 9. Logging for AI Debugging

AI決定をログとして残す：

- chosenAction  
- actionProbabilities  
- modelVersion  
- opponentProfileSnapshot  
- gameType（NLH, Badugi etc）  
- tournamentContext（レベル、順位）  
- mixedContext（currentGameID, nextGameID）

デバッグしやすくし、RL訓練にも使用。

---

## 10. Acceptance Criteria

Spec 18が完成と見なされる条件：

1. AIが3層構造で整理されている  
2. 各ゲームの Base 戦略が個別に定義されている  
3. Adjustment Layer が Tournament / Mixed / ICM に適応  
4. Meta Layer にゲーム間連動がある  
5. RL pipeline（Observation / Action / Reward / Storage）が完成  
6. ONNX推論でアプリ内のCPUが動作する  
7. Mixed Game プレイ中にゲーム別モデル切替が可能  
8. WorldMaster Tier でプロ大会級のAIが実行できる  
9. 全ログが学習用として十分な情報量を持つ  

