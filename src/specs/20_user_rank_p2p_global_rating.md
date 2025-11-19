# Spec 20 – User Rank / P2P Reinforcement Learning Integration / Global Rating  
(ユーザーランク、P2Pによる学習統合、世界ランキングシステム)

## 1. Purpose

本仕様は、アプリ内ユーザーの実力評価・レーティング管理・  
P2Pゲーム結果からの機械学習強化・グローバルランキング構築を目的とする。

目的:
- オフライン/オンライン両対応の User Rank 制度  
- P2P（対人）戦で収集した統計量を AI の追加学習に活用  
- 「CPU vs Player」「Player vs Player」どちらにも共通する評価軸  
- Mixed Game / Tournament / 各種ゲーム形式で統一評価  
- 世界ランキング（Global Rating）の算出  
- モバイル/PC/PWAどれでも同じIDでレート同期  

この仕組みは Spec 16〜19 と密結合しており、  
最終的に **「プレイヤーが AI を育てる」システム** を構築する。

---

## 2. User Rating Model Overview

User Rating は3種類のレートで構成される。

1) **Skill Rating（SR）**  
   → 将棋やチェスのレートに該当。勝敗をもとに増減。

2) **Style Rating（ST）**  
   → プレイヤーのプレイスタイル（LAG / TAG / NITなど）を数値化。

3) **Mixed Rating（MR）**  
   → Mixed Game（Spec16）専用の複合レーティング。  
     ゲーム間の総合力、応用力、アジャスト能力を評価。

総合レート:
- **Global Rating（GR） = SR × α + MR × β**  
  α=0.7 / β=0.3 が標準。

---

## 3. Skill Rating（SR）仕様（Elo / Glickoベース）

SRは Elo または簡易 Glicko を採用。

要素:
- 対戦相手のレート  
- トーナメントの順位（Spec17）  
- マルチテーブル戦の割合補正  
- Mixed Gameの危険度係数（Spec16）  
- ゲームごとの難易度

SRの更新式（概要）:
- SR_new = SR_old + K × (ResultEV - ExpectationEV)

大会では順位EVを使用する。

K-factor（例）:
- カジュアル: K = 24  
- プロ大会: K = 40  
- 世界大会: K = 48  

---

## 4. Style Rating（ST）仕様

ST はプレイスタイルを数値化し、AIの opponent modeling（Spec18）にも使用する。

計測する項目:
- VPIP  
- PFR  
- 3bet率  
- Aggression  
- Showdown率  
- Showdown勝率  
- Draw discard傾向  
- Stud upcard 選択  
- Mixed Game メタ安定性  
- Bluff頻度  

分類:
- NIT（タイト受け身）  
- TAG（タイトアグレ）  
- LAG（ルースアグレ）  
- MANIAC（超攻撃）  
- ROCK（慎重）  

STは **0〜100** の数値で表す。

例:
- ST 90〜100 → 超LAG  
- ST 40〜60 → 標準（TAG）  
- ST 0〜25 → NIT  

STはAI Tier判定にも利用可能（Spec19）。

---

## 5. Mixed Rating（MR）仕様（Multi-game総合力）

MR は Mixed Game の高次スキルを評価する。

評価項目:
- ゲーム間の切替速度  
- ゲーム間のVPIP変化の適正  
- 次ゲーム対策（Spec16）  
- Weighted Randomへのメタ適応  
- Draw系/Stud系/Board系の総合力  
- Discard効率  
- Tournament ICMへの一貫性  
- HORSE / 8Game / 10Game の総合順位  

MRレンジ:
- 0〜3000  
- 2500以上 → プロ級  
- 3000以上 → 世界トップ1%  

---

## 6. P2P Reinforcement Learning Integration（対人戦学習）

本アプリの重要要素は**P2P結果をAI学習に統合する**点。

学習に使うデータ:
- 全ハンドログ（Spec08）  
- discard選択  
- showdown結果  
- 相手プロフィール（Spec18）  
- gameID（Mixed Game）  
- reward（ICM EV 含む）  

学習方式:
- 対人戦の履歴は **external_training_buffer.jsonl** に蓄積  
- Python RL Trainer（外部）で学習  
- ONNXモデルとして出力→アプリへ再導入  

モデル更新:
- n回のトレーニングで  
  **model_pro_vX → model_pro_vX+1**
- バージョニング管理：  
  models/pro/model_v1.onnx  
  models/pro/model_v2.onnx  

P2Pデータは重量があるため、60～200ハンド単位で学習可能。

---

## 7. Global Rating（世界ランキング）

Global Rating（GR）は SR と MR を合成した世界レートである。

GR = SR × 0.7 + MR × 0.3

ランキング表示：
- 世界ランキング（TOP100）  
- 国内ランキング  
- ゲーム別ランキング（NLH / PLO / TD / Badugi etc）  
- Mixed Gameランキング  
- 期間限定ランキング（週 / 月 / 四半期）  

表示項目:
- Rank  
- PlayerName  
- Country  
- SR / MR / GR  
- 最近の成績  
- 得意ゲーム  
- Mixed Game実力  

---

## 8. User Rank（段位制度）

段位を以下のように設定する：

1) Bronze  
2) Silver  
3) Gold  
4) Platinum  
5) Diamond  
6) Master  
7) Grand Master  
8) Legend  

基準:
- GRが一定値に到達  
- Tournament優勝回数  
- Mixed Gameでの上位率  

昇段のUI演出あり。

---

## 9. Anti-cheating / フェアネス

レート算出の公平性確保のため：

- 同一デバイスのマルチアカウント対戦を禁止  
- 連続対戦の異常パターン検知  
- CPU戦はレート低変動  
- 低Tier CPUへの全勝はレート上昇を抑制  

---

## 10. Profile Integration（プロフィール連動）

プロフィール画面に表示：

- Global Rating  
- User Rank  
- Mixed Rating  
- 得意ゲーム  
- 利用モデル（AI entry model）  
- 最近の成績（10ハンド or 20ハンド）  

プロフィールアニメーション（Spec16のAsset利用）も可能。

---

## 11. Logging（Spec08対応）

Rating更新ログ:

- beforeSR / afterSR  
- beforeMR / afterMR  
- globalRating  
- tournamentRank  
- opponentRating  
- mixedSkillIndex  
- reason（Tournament, P2P, MixedGameなど）

このログは P2P学習にも使用。

---

## 12. Acceptance Criteria

Spec20 が完了とみなされる条件：

1. Skill Rating / Style Rating / Mixed Rating が統一計算可能  
2. Global Rating が SR/MR の線形合成として動作  
3. User Rank が適切に昇格・降格  
4. P2P戦のデータが RL buffer に保存  
5. Mixed Game の戦力評価が MR に反映  
6. 対人戦で AI 学習が自動で向上  
7. ランキング画面が正しく表示  
8. Spec 16〜19 と全て整合  
9. ログが学習に十分使える品質  

