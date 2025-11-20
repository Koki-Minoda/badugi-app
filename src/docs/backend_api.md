# Backend API / Sync Overview (Spec 21)

`server/` 以下に FastAPI ベースのサーバーを追加しました。トークンは開発用固定値 (`demo-token`) を利用しています。

## 起動方法

```bash
cd server
uvicorn server.main:app --reload --port 8000
```

API ドキュメントは `http://localhost:8000/api/docs` で確認できます。

## サポート中のエンドポイント（一部）

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | サインアップ |
| `POST` | `/api/auth/login` | ログイン |
| `POST` | `/api/auth/refresh` | トークン再発行 |
| `GET` | `/api/profile/me` | プロフィール取得 |
| `PATCH` | `/api/profile/me` | プロフィール更新 |
| `GET` | `/api/rating/me` | レーティング取得 |
| `POST` | `/api/rating/update` | レーティング更新結果をサーバ保存 |
| `POST` | `/api/history/hand` | ハンド履歴アップロード |
| `POST` | `/api/history/tournament` | トーナメント履歴 |
| `POST` | `/api/tournament/snapshot` | 進行スナップショット |
| `GET` | `/api/tournament/resume/{id}` | 中断データ取得 |
| `GET` | `/api/ai/model/latest` | 最新 AI モデルメタ取得 |
| `POST` | `/api/ai/rl/buffer` | P2P 学習データ送信 |

すべてのレスポンスは `{ "status": "ok", "data": ... }` でラップされます。

## フロントエンド同期

`src/ui/utils/syncManager.js` を追加し、以下のイベントで自動同期します。

- ショーダウン → ハンド履歴を `POST /history/hand`
- レーティング更新 → `POST /rating/update`
- トーナメント実行中 → `POST /tournament/snapshot`
- P2P（将来実装） → `POST /ai/rl/buffer`

同期キューは LocalStorage に蓄積され、オンライン復帰／30秒ごとの AutoSync で送信されます。

## 開発ノート

- 認証は簡易トークンですが、Spec21 の JWT/Refresh トークン構成に合わせたルータ構成にしてあります。
- DB は `server/storage.py` のインメモリ実装ですが、テーブル設計は Spec で定義された `users`, `ratings`, `history` に対応。
- Codex 自動開発用に API をモジュールごとに整理し、JSON に統一しました。
