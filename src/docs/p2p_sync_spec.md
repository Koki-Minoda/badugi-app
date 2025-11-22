# Spec 22.1 WebSocket Synchronization Schema (ドラフト)

## 1. イベント一覧
| event | direction | description |
| --- | --- | --- |
| `join_room` | client -> server | roomId/playerId/seatHint を含む参加リクエスト。サーバは waiting status を broadcast。 |
| `leave_room` | client -> server | 退出。サーバは player list を更新し broadcast。 |
| `action` | client -> server | Fold/Call/Raise/Draw/Discard の action payload（bet, selectedCards, signature）。 |
| `reaction` | client -> server | ready flag, draw selection, heartbeat signal（3s）。 |
| `updated_state` | server -> clients | 差分状態（pot, bets, stacks, turn, lastAction）。sequenceId + timestamp 付き。 |
| `secure_deal` | server -> client | 暗号化カードトークン（keyId, iv, tag, ciphertext）。クライアントは deckManager で復号。 |
| `discard` | server -> client | 捨て札＋ discard pile 更新通知。 |
| `showdown` | server -> client | 勝者/hand summary/payouts broadcast。 |
| `heartbeat` | bidirectional | WebSocket health check (3s ping / 10s failover)。 |
| `room_state` | server -> clients | waiting/starting/playing/finishing/closed などステータス更新。 |
| `error` | bidirectional | error code/message/recoverable flag。 |

## 2. ペイロード仕様
- `sequenceId`: 単調増加整数。クライアントはこの ID でソート。
- `delta`: { bets: {seat: amount}, pot: number, stacks: {seat: amount}, lastAction }
- `cardToken`: { keyId, iv, tag, ciphertext, slot }
- `playerContext`: { seatId, ready, isAI, latencyMs }
- `heartbeat`: { timestamp, pendingActions }
- `roomMeta`: { roomId, mode, handId, dealer, blindLevel }

## 3. 同期サイクル
1. クライアントが `action` 送信 → サーバは `BadugiEngine` で合法性チェック。
2. 差分 `delta` を計算し `sequenceId` を付与。
3. `updated_state` で全クライアントに broadcast。
4. `secure_deal` は shuffle の直後に broadcast、クライアントで `deckManager.revealCard(token)` を呼ぶ。
5. クライアントは `delta` を `applyEngineAction` で state に適用。
6. `heartbeat` が 10s 応答なしなら reconnect / AI fallback。

## 4. FastAPI/WebSocket エンドポイント
- `/ws/room/{roomId}`: WebSocket 接続。`roomManager` で state 管理し、broadcast は `sequenceId` 付き。
- `broadcast_state(roomId, payload)`: `updated_state` を全クライアントに送信。
- `secure_deal` は `p2p/security.ts` で生成されたトークン。
- `delta_serializer(payload)`: JSON schema (`docs/json/p2p_sync_schema.json`) で validate。

## 5. クライアント連携
- `useRoomSync(roomId)` フックで WebSocket 接続 → event dispatch → `BadugiEngine` snapshot sync。
- `delta` は `applyEngineAction` で差分更新。
- `secure_deal` 受信時に `deckManager.revealCard(encryptedCardId)` で復号。

## 6. テスト / 契約
- JSON schema を Vitest で検証。
- FastAPI で `openapi` + WebSocket schema を contract test。
- `docs/badugi_bugs_and_roadmap.md` Spec22 からこのドキュメントを参照。

## 7. Document linkage
- JSON schema: `docs/json/p2p_sync_schema.json` keeps every WebSocket payload validated.
- AsyncAPI: `docs/asyncapi/p2p_ws.yaml` documents the `/ws/room/{roomId}/play` channel for PC/iOS/Android clients.
