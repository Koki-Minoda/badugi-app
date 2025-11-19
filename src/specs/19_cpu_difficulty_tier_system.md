# Spec 19 – CPU Difficulty & KPI Tier System  
(難易度階層 / KPIセット / Mixed / Tournament / AIモデル連動)

## 1. Purpose

本仕様はアプリ内CPUの難易度設計を標準化し、  
世界大会仕様（Spec 17）、AIプロモデル（Spec 18）、Mixed Game（Spec 16）の  
すべてと整合する「AI難易度層（Tier）」を定義する。

目的:
- “弱いCPU”〜“世界王者級CPU”まで階層的に設計  
- 各難易度で使用する KPI（プレイスタイル指標）を明確化  
- 各Tierで必要なAIモデルの種類・ランダム性を調整  
- プレイヤーにとって自然な強さの違いを表現  
- Mixed / Tournament / Draw / Stud すべてで整合  
- CodexがAIを自動生成しやすくするための基礎仕様  

---

## 2. Tier Structure（CPU難易度階層）

CPU Tier は6階層で構成。

1) Beginner  
2) Standard  
3) Strong  
4) Pro  
5) Iron（鉄強）  
6) WorldMaster（最終ボス）

以下で詳述。

---

## 3. KPI Definitions（評価指標）

CPU難易度は単なる「強い/弱い」ではなく、  
以下の **21項目のKPI（行動指標）** の組み合わせで定義される。

必須KPI:

- VPIP（VPIP%：参加率）
- PFR（プリフロップレイズ率）
- 3Bet率
- Aggression Factor（AF）
- C-Bet率（フロップ/ターン）
- Fold to C-Bet
- Bluff率（全体）
- HeroCall率（ブラフキャッチ率）
- Showdown率
- Showdown勝率
- Opening Range（ポジション別）
- Draw discard率（Drawゲーム専用）
- Stud bring-in後アグレッション
- Stud upcard攻撃率
- Badugi discard=1枚の頻度
- Badugi discard=2〜3枚の頻度
- Multi-street aggression（NL / PLO）
- Limp率（弱いCPUは高い）
- Cold-call率
- Tournament ICM遵守度（高Tierほど強い）
- Mixed Game meta適応度（Tierが高いほど良い）

これらを Tier別に設定。

---

## 4. Tier-by-Tier Specification（階層別詳細）

### 4.1 Beginner（初心者）
目的：明確に弱いCPU。  
特徴：
- VPIP 45〜60%  
- PFR 5〜10%  
- 3Bet ほぼ0  
- CBet低い  
- Bluff率 1〜3%  
- Discard選択が未熟（Draw系）  
- Studでbring-inにすら消極的  
- TournamentではICM無視  
- Mixed Gameでもゲーム違いを考慮しない  
モデル：固定ルールベースのみ（RL不使用）

### 4.2 Standard
- VPIP 30〜40%  
- PFR 10〜12%  
- Bluff率 5% 前後  
- Discardは平均レベル  
- Studも最低限理解  
- Tournamentで軽いICM対応  
モデル：部分的な確率ルール（No RL）

### 4.3 Strong
- VPIP 20〜30%  
- PFR 12〜18%  
- 3Bet率適度  
- CBet、Fold to CBetが標準的  
- Discardはゲーム別に最適化  
- Tournamentで押し引きが正確  
- Mixed Gameでゲーム危険度を考慮  
モデル：固定戦略 + ハンドカテゴリ推論

### 4.4 Pro
- VPIP 15〜25%  
- PFR 18〜22%  
- Aggression中  
- Bluff率 10〜15%  
- Draw選択精度高い  
- Studのアップカード戦略が正確  
- Tournament ICM準拠  
- Mixed Game：次ゲーム・危険度への対応  
モデル：stat-based + 軽量推論（ONNX Light）

### 4.5 Iron（鉄強）
- VPIP 12〜22%  
- PFR 20〜28%  
- 3Bet率高め  
- Bluff率 15〜20%  
- 悪いレンジをほぼ排除  
- Tournament ICM最適に近い  
- Mixed Game Meta対応（Spec 16/18）  
- プレイヤーの過去数ハンドのパターンでレンジ調整  
モデル：  
- RLモデル（ゲーム別モデル）  
- opponentModel = 有り  
- Meta-Learning enabling

### 4.6 WorldMaster（最終ボス）
**本アプリ最高峰。世界大会優勝レベル。**

行動特性：
- VPIP 10〜20%  
- PFR 24〜30%  
- 高度な3Betバランス  
- Bluff率 18〜25%（game-basedで変動）  
- 完璧に近い Discard 戦略（Badugi/27TD）  
- Studでアップカードの情報を最大利用  
- ICM至上主義（Spec 17）  
- Mixed meta（前のゲームでtightなら次はaggressive等）  
- プレイヤーの傾向をメタレベルで推論  

モデル：
- Multi-head RL ONNXモデル  
- GameEmbedding（ゲームIDをembedding化）  
- Meta Layer（Spec 18）  
- Weighted Decision（Spec 16）  
- Exploit/Human-like randomness

---

## 5. Tier Parameters（階層別パラメータ表）

### 5.1 Randomness（ランダム性）
Beginner: 0.40  
Standard: 0.30  
Strong: 0.20  
Pro: 0.12  
Iron: 0.08  
WorldMaster: 0.05  

値が低いほどブレが少なく強い。

### 5.2 Decision Latency（思考時間）
Beginner: 即決  
…  
WorldMaster: 0.4〜1.2秒（人間っぽく）

### 5.3 Discard Accuracy（Draw系正確度）
Beginner: 30%  
Standard: 55%  
Strong: 75%  
Pro: 85%  
Iron: 93%  
WorldMaster: 98%  

### 5.4 Bluff Weight
Beginner: 1/100  
Standard: 1/40  
Strong: 1/25  
Pro: 1/12  
Iron: 1/8  
WorldMaster: 1/5（状況次第で可変）

---

## 6. Tier Selection by Tournament Stage

TournamentでCPU Tierは以下のルールで変動する：

Day1: Standard〜Strong  
Day2: Strong〜Pro  
Semi-Final: Pro〜Iron  
Final Table: Iron〜WorldMaster  

Mixed Game Final Tableでは特に強化：

- Weighted meta適応  
- 次のゲーム予測  
- スタック調整を優先  

---

## 7. Dynamic Difficulty (DD) System

プレイヤーのレベルが高い場合、CPUが動的に Tier 上昇する。

評価するプレイヤーKPI:
- VPIP
- Aggression
- Showdown勝率
- 連勝数
- エラー率（明らかに鋭いプレイ）

これらが高値なら CPU の Tier を 1段階上げる。

例：
プレイヤーが Proレベル → CPUはIron相当へ

---

## 8. Tier-to-Model Mapping（AIモデルとの紐付け）

Tier → 使用するAIモデル：

Beginner: no-RL rule  
Standard: no-RL rule  
Strong: rule + simple heuristic  
Pro: ONNX Light  
Iron: ONNX per-game model  
WorldMaster: Multi-head RL ONNX（Spec18）

また Tier が高いほど opponentProfile を使用。

---

## 9. Logging（デバッグ・分析用）

CPU行動ログには以下を追加：

- cpuTier  
- decisionRandomness  
- discardScore  
- tournamentContext  
- mixedGameContext  
- opponentReadAccuracy  

AIデバッグ・RL追加学習に利用。

---

## 10. Acceptance Criteria

Spec 19 完成条件：

1. 6階層のCPU Tierが明確に定義されている  
2. KPIが統一され全ゲームで共通利用できる  
3. TierごとにVPIP/PFR/discard/bluff等の指標値が定まっている  
4. Tournament（Spec 17）・Mixed（Spec 16）と完全整合  
5. AIモデル（Spec 18）と適切に紐付いている  
6. Dynamic Difficultyが機能する  
7. ログが学習/分析可能な形式で残る  

