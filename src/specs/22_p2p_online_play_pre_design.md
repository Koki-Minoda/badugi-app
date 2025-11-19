# Spec 22 – P2P Online Play Pre-Design  
(オンライン対戦の事前仕様 / 部屋管理 / 同期方式 / 遅延補正 / 不正対策 / 将来拡張)

## 1. Purpose

本仕様は、アプリに将来統合される **リアルタイム P2P オンライン対戦機能** の  
基礎アーキテクチャを定義する事前設計である。

目的:
- プレイヤー同士がリアルタイムに対戦可能  
- P2P（直接通信）/ サーバルーム方式 の両対応  
- Mixed Game / Tournament / Cash game に全対応  
- Rating / Ranking（Spec20）と連動  
- AI と人間の混合卓（ハイブリッド卓）の提供  
- 将来の観戦モードやイベント運用を見据えた設計  
- Codex によるオンライン機能の自動生成に対応する API 構造の基礎化

本仕様は「ネットワーク設計」「対戦同期」「チート対策」「通信プロトコル」を中心に  
オンライン対戦の全体像を提示する。

---

## 2. System Architecture Overview

オンライン対戦は 2 方式をサポートする。

### 2.1 Standard: Server-hosted Room（推奨）
- サーバが Room を管理  
- 全クライアントはサーバへ「状態 → 差分」を送信  
- 統一されたゲーム状態を保証  
- チート対策がしやすい

### 2.2 Peer-to-Peer（将来 / 低レイテンシ用）
- WebRTC を用いて P2P 通信  
- サーバはシグナリングのみ  
- モバイル/PC で低遅延を実現  
- 小規模対戦（2〜6人）向け

本アプリの初期実装は **サーバホスト方式（FastAPI + WebSocket）** を採用し、  
将来 P2P を追加する方針とする。

---

## 3. Room System（部屋管理）

### 3.1 Room Creation
- `/room/create`  
- Owner が Room を作成  
- モード指定可能:  
  - Heads-Up  
  - 4max / 6max / 9max  
  - Mixed Game（Spec16）  
  - Tournament Mini / MTT-lite（Spec17簡易版）

### 3.2 Room Join / Leave
- `POST /room/join`  
- `POST /room/leave`  
- 強制退出（kick）も可能

### 3.3 Room States
Room は以下の状態を持つ。

1) waiting（待機中）  
2) starting（開始カウントダウン）  
3) playing（対戦中）  
4) finishing（終了演出）  
5) closed（部屋破棄）

---

## 4. Real-time Sync（リアルタイム同期）

通信は WebSocket を使用。

### 4.1 Sync Types
クライアント → サーバ:
- action  
- reaction（draw discard など）  
- seat position  
- ready flag  
- heartbeat  

サーバ → クライアント:
- updated_state  
- pot / bet 状態  
- player stacks  
- card distribution（暗号化）  
- discard result  
- showdown結果  
- next dealer / next game（Mixed）  

### 4.2 Delta Sync（差分同期）
- 毎回全状態を送らず、差分（変更点のみ）を送信  
- 回線が弱い端末に強い

### 4.3 Heartbeat
- 3〜5秒間隔  
- 無応答 10秒 → 再接続  
- 30秒で自動フォールド or AIが代理行動

---

## 5. Card Security（チート対策）

オンラインの最重要要素として  
**配られるカード情報はクライアントが覗けないようにする。**

### 5.1 Secure Dealing
1) サーバのみが deck を保持  
2) サーバが「暗号化カードID」をクライアントへ送る  
3) 自分のカードだけ復号可能  
4) 公開カードはそのまま送信

### 5.2 Anti-ghosting
複数端末で同時ログイン → 即終了

### 5.3 Timing Check
異常なレスポンス速度（bot対策）は自動検出。

---

## 6. Game Sync Flow（対戦処理フロー）

例：NLH / Mixed / Draw 共通

1) サーバ → 全員  
   - `start_hand`  
2) サーバ  
   - deck生成  
   - 各プレイヤーに暗号化カード送信  
3) クライアント  
   - 復号→UIへ表示  
4) プレイヤー操作 → サーバへ送信  
5) サーバ  
   - ルール（Spec 09〜16）に従い合法性チェック  
   - 状態更新  
6) サーバ → 全員  
   - 差分状態を broadcast  
7) showdown → ログ記録  
8) 次ハンド  

---

## 7. Match Logging（Spec08連動）

対戦ログの保存:

- handRecord  
- showdown  
- tournamentRecord（ミニ版）  
- mixedGameSwitch（Spec16）  
- playerActions[]  
- replay-compatible format

クライアント側でも replay 用に保存可能。

---

## 8. Rating Integration（Spec20）

P2P対戦後は以下を計算・送信：

- SR 更新  
- MR 更新（MixedGameの対戦なら）  
- 全体 Global Rating  
- Style Rating（VPIP/PFR等解析）

Rating 更新はサーバで行い、  
クライアントは結果だけ受け取る。

---

## 9. Connection Loss Handling（切断処理）

### 9.1 一時切断
- 30秒以内復帰 → そのまま継続  
- 代理AIが一時的に操作（Spec19の Strong Tier）  

### 9.2 完全切断
- 時間切れ → 自動フォールド  
- トーナメントならスタック残して続行  
- キャッシュゲームなら席離脱  

---

## 10. Cross-Platform Support（マルチデバイス）

対応端末:
- PC（Chrome / Edge）  
- iOS PWA  
- Android PWA  
- ネイティブアプリ（将来）

全端末で WebSocket + HTTP REST が共通動作。

---

## 11. Future: Spectator Mode（観戦機能）

将来の拡張として：

- Live観戦（遅延付き）  
- ハンド履歴クリックで過去リプレイ  
- Final Table演出（Spec17）  
- 大会実況向けAPI（第三者用）

Spectator は「public情報のみ」閲覧可能。

---

## 12. Future: P2P Direct Mode（WebRTC）

標準サーバ方式に加えて、P2Pモードも構想。

メリット:
- 超低遅延  
- サーバ負荷が極小  

方式:
- signalingサーバから peer情報交換  
- P2P の data channel で sync  

ただし:
- セキュリティ面で暗号化が必須  
- カード情報は server-sealed model を利用  

---

## 13. API Spec（REST + WebSocket）

### 13.1 REST
- POST /room/create  
- POST /room/join  
- POST /room/leave  
- GET /room/info  

### 13.2 WebSocket Channels
- ws://server/room/{roomId}/play  
送受信メッセージ:
- action  
- state  
- card_enc  
- discard  
- next_game  
- tournament_sync  
- error  

すべて JSON に統一。

---

## 14. Anti-Cheat System（不正対策）

- 異常タイミング行動  
- 異常的中率  
- 多重ログイン  
- デッキ参照を禁止（暗号化）  
- クライアント側でコード改変検知  
- シグネチャで検証（message sign）  

BANレベル:
- warning  
- temporary ban  
- permanent ban  

---

## 15. Acceptance Criteria

Spec 24 完了条件：

1. Room構造（作成/参加/退出）が明確  
2. WebSocket同期の流れが定義済み  
3. Secure Dealing（カード暗号化）が定義済み  
4. MixedGame・Tournament対応（Spec16/17整合）  
5. Rating反映（Spec20）  
6. 切断処理/復帰処理が明確  
7. AI代理行動が定義（Spec19準拠）  
8. ReplayログがSpec08準拠  
9. 将来拡張（観戦/P2P/WebRTC）が想定済み  

