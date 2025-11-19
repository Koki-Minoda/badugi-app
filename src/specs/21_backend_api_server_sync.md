# Spec 21 – Backend API & Server Sync Architecture  
(バックエンドAPI / サーバ同期 / PWA対応 / ユーザーデータ保存 / マルチデバイス同期)

## 1. Purpose

本仕様は、アプリにバックエンド（FastAPI想定）を導入し、  
以下を実現するための完全なAPI & データ同期の設計書である。

目的:
- ユーザーデータのサーバ保存・復元  
- マルチデバイス同期（PC / スマホ / PWA すべて共通）  
- トーナメント進行同期（Spec17）  
- Rating / Record / MixedGameデータ送受信（Spec20）  
- リプレイデータ保存（Spec08）  
- AIモデル配信（Spec18 の ONNX）  
- Codex 自動開発と相性の良いスキーマ化  
- 将来のオンライン対戦の基礎

バックエンドは **FastAPI + PostgreSQL** を標準とし、  
本仕様では API 構造・テーブル・同期処理を定義する。

---

## 2. Architecture Overview

構成:
- Frontend（PWA / React）  
- Backend API（FastAPI）  
- DB（PostgreSQL）  
- File Storage（S3互換、モデル配布用）  
- Auth（JWT / Refresh Token）

同期方式:
- Pull（画面起動時に取得）  
- Push（プレイ終了時に送信）  
- AutoSync（一定間隔で差分更新）

APIは REST + JSON ベース。  
将来 GraphQL に拡張可能。

---

## 3. Authentication

### 3.1 Signup / Login
- `/auth/signup`
- `/auth/login`
- `/auth/refresh`

レスポンス:
- access_token（短期）
- refresh_token（長期）
- user_id

### 3.2 Device Binding
PWA/スマホ/PCすべて同一アカウントを使える。

---

## 4. Main API Endpoints

### 4.1 User Profile
- `GET /user/{id}`
- `PATCH /user/{id}`  
更新可能項目:
- nickname  
- avatar  
- country  
- settings（SE/BGM/theme/card skin）  

### 4.2 Rating（Spec20）
- `GET /rating/{userId}`
- `POST /rating/update`  
送信データ:
- sr_before / sr_after  
- mr_before / mr_after  
- new_global_rating  
- reason（tournament, p2p, mixed_game）  

### 4.3 Game History（Spec08）
- `POST /history/hand`  
  → handRecord を 1件送信  
- `POST /history/tournament`  
  → tournamentRecord  
- `POST /history/mixed`  
  → Mixed Game のゲーム切替

### 4.4 Tournament Sync（Spec17）
- `POST /tournament/snapshot`  
- `GET /tournament/resume/{id}`  

送信項目:
- level  
- blind  
- tableCount  
- playerStacks[]  
- eliminatedPlayers[]  
- break情報  
- finalTableフラグ  

### 4.5 AI Model Delivery（Spec18）
- `GET /ai/model/latest`
- `GET /ai/model/{version}`  
→ ONNX を返却

### 4.6 P2P Learning Buffer（Spec20）
- `POST /ai/rl/buffer`  
→ 経験データ(JSONL行単位)  
- `GET /ai/rl/buffer/stats`  

---

## 5. Data Sync Strategy（同期戦略）

### 5.1 Client → Server（Push）
Pushのタイミング:
- 1ハンド終了  
- トーナメント終了  
- Mixed Game のゲーム切替  
- 設定変更  
- Rating更新  

通信形式:
- batchモード（まとめて送信）
- retry queue（通信オフライン時保存）

### 5.2 Server → Client（Pull）
Pullのタイミング:
- アプリ起動  
- トーナメント再開  
- AIモデル更新チェック  
- プロフィール同期  
- 設定反映（テーマ等）  

### 5.3 AutoSync
- 30〜60秒間隔で差分Sync  
- カウンターベースで軽量化

---

## 6. Data Schema

PostgreSQL の主要テーブル。

### 6.1 users
- id  
- nickname  
- country  
- avatar  
- created_at  

### 6.2 user_settings
- bgm_on  
- se_on  
- theme  
- card_skin  

### 6.3 ratings
- user_id  
- sr  
- st  
- mr  
- gr  
- last_update  

### 6.4 hand_history
- user_id  
- hand_id  
- game_type  
- record_json (JSON)  
- created_at  

### 6.5 tournament_history
- user_id  
- tournament_id  
- result_json  
- rank  
- chips  
- created_at  

### 6.6 ai_models
- version  
- file_path  
- type（per-game / multi-head / pro）  

### 6.7 rl_buffer
- user_id  
- data_jsonl  
- created_at  

---

## 7. AI Model Sync（Spec18連動）

### 7.1 Versioning
クライアントは model_version を持つ:

例:
- "pro_v3"
- "badugi_v5"
- "multihead_v2"

古くなったらサーバが通知:

- `model_update_required: true`

### 7.2 Download
- ONNXモデル（1〜10MB）をダウンロード  
- ローカルキャッシュ

### 7.3 Rollback
問題があった場合 server で以前の model_version を返す。

---

## 8. Tournament Resume（中断・復帰）

Spec17のプロトーナメントは長時間のため、  
以下が必須。

- 経過情報を `/tournament/snapshot` に送信  
- プレイヤーがアプリを終了してもサーバに保存  
- 再ログインで `GET /tournament/resume/{id}`  
- 途中のテーブルバランスやlevelが復元される  

---

## 9. Security

- JWT + HTTPS  
- IPレート制限  
- 保存データはすべて user_id 紐付け  
- 不正な Rating 書き換えは不可  
- モデルファイルは署名付きURLで配信  

---

## 10. Developer / Codex Integration

Codex 自動開発のために API 仕様は一定ルールで書く：

1) すべてのAPIは GET or POST のみ（Codexが扱いやすい）  
2) JSONのみ使用  
3) 型定義は TypeScript interface 生成可能  
4) 1API＝1関心事  
5) モジュール名は以下に分ける  
   - auth  
   - user  
   - rating  
   - history  
   - tournament  
   - ai  
6) 応答には `status` と `data` を必ず含める

---

## 11. Acceptance Criteria

Spec21 が完了とみなされる条件：

1. 基本API（auth, user, rating, history）が動作  
2. Tournament同期（Spec17）をサーバ側で再現可能  
3. Mixed Gameデータも保存される  
4. AIモデル（Spec18）がダウンロード可能  
5. P2P学習データがサーバに蓄積される  
6. settings / profile がマルチデバイス同期される  
7. push/pull/autosync が安定  
8. 全APIがJSONで統一  
9. 統合ログが学習・分析可能  

