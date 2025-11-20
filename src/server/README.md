# Badugi Backend (Spec 21)

FastAPI で動作する軽量バックエンドです。ローカル環境で API をモックしつつ、同期ロジックや Codex 自動開発の土台になります。

## セットアップ

```bash
cd server
python -m venv .venv
.venv\\Scripts\\activate
pip install fastapi uvicorn
uvicorn server.main:app --reload --port 8000
```

ブラウザで [http://localhost:8000/api/docs](http://localhost:8000/api/docs) を開くと OpenAPI ドキュメントを確認できます。

## 認証

開発用トークンは `demo-token` を使用しています。フロントエンド側 `syncManager` から `Authorization: Bearer demo-token` で呼び出します。

## 主な実装済みエンドポイント

- `/api/auth/signup`, `/api/auth/login`, `/api/auth/refresh`
- `/api/profile/me`, `/api/profile/me (PATCH)`
- `/api/rating/me`, `/api/rating/update`
- `/api/history/hand`, `/api/history/tournament`, `/api/history/mixed`
- `/api/tournament/snapshot`, `/api/tournament/resume/{id}`
- `/api/ai/model/latest`, `/api/ai/rl/buffer`, `/api/ai/rl/buffer/stats`

すべて `{ "status": "ok", "data": ... }` 形式でレスポンスを返します。
