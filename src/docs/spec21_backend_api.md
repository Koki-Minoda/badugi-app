# Spec 21: Backend API & Server Sync Summary
FastAPI + PostgreSQL 想定のバックエンドを想定し、現段階で以下の API モジュール／同期フローを実装済みです。

## 1. サーバ構成
- `server/main.py`: FastAPI アプリ本体。認証ミドルウェア、ヘルスチェック、`/api/` プレフィックスで各ルーターを登録。
- `server/routers/auth.py`: `/api/auth/login`, `/api/auth/signup`, `/api/auth/refresh` を提供（開発用トークンによる固定レスポンス）。
- `server/routers/profile.py`: `/api/profile/me` 取得と更新。ユーザープロフィール保存の REST レイヤーを模倣。
- `server/routers/history.py`: `/api/history` でハンド履歴のリストを返却。Mongo 風のスキーマを Pydantic で定義。
- `server/routers/tournament.py`: トーナメントステージ一覧と `/api/tournament/enter/{stage_id}` 処理。ステージ同期用の `TournamentStage` モデルを返す。
- `server/routers/tasks.py`: タスク一覧（Bug/Spec など）のレポートを返し、Codexループとの連携を示す。
- `server/routers/ai_models.py`: ONNX 配信を想定し、モデルエントリを列挙するエンドポイントを配置。
- 要件に応じて `server/__init__.py` でルーターを集約済み。`server/requirements.txt` に FastAPI/uvicorn/`pydantic` を記載。

## 2. 同期戦略
- 認証 (`/api/auth/*`) → ユーザー／レート／履歴／トーナメント／AI モデルの同期はすべて JSON で統一。ステータスや `status`/`data` 返却は FastAPI 標準で対応可能。
- クライアント側は現在 `useRatingState` のエクスポート・JSONL 書き出しで P2P データを蓄積し、`exportP2PMatchesAsJSONL` でサーバへの upload に備えることが可能（エンドポイントは今後 `POST /api/ai/rl/buffer` へ接続予定）。
- Server側に対して `GET /api/health`, `GET /api/status` を提供済み。これらは autosync の ping/heartbeat で利用可能。

## 3. 開発と運用
- `uvicorn server.main:app --reload --port 8001` で起動可能（`server/requirements.txt` をインストール済み）。実運用では PostgreSQL や S3 連携エンドポイントを追加予定。
- docs 内に `docs/badugi_bugs_and_roadmap.md` で「Spec21」を参照し、バックエンド API と同期フローの進捗を記載。
- フロントエンドは `/leaderboard` などの画面が存在し、将来的には `/api/history` を叩いてランキング/履歴を描画する想定。
