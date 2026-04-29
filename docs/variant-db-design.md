# Variant DB Design

更新日: 2026-04-29

## 目的

MGX の Variant Definition を将来的に DB 管理へ移行できるように、Variant / Rule / Modifier / Evaluator / Betting Structure の永続化設計を定義する。

今回は設計文書、SQLAlchemy モデル案、Pydantic schema 案のみを追加する。API route、seed、frontend 接続、ゲーム進行接続、Alembic migration 作成は行わない。

## 設計方針

- 手動 `CREATE TABLE` は使わず、Alembic migration で schema を作成する。
- MySQL 固有関数や MySQL 専用型に依存しない。
- PostgreSQL 移行を妨げない SQLAlchemy 標準型を優先する。
- JSON payload は SQLAlchemy `JSON` 型で表現する。
  - 既存 backend で `JSON` 型を利用済み。
  - SQLAlchemy が dialect 差分を吸収する。
  - JSON 内部検索や MySQL 固有 JSON 関数には依存しない。
- Variant Definition の正規化対象は DB カラムへ置き、ゲーム固有の可変 rule は JSON payload に閉じ込める。
- 既存 Badugi / MTT / RL API / frontend の実行経路には接続しない。

## ER 概要

- `variants` 1 -- 1 `variant_rules`
- `variants` N -- N `variant_modifiers` through `variant_modifier_links`
- `variants` N -- 1 `variant_evaluators`
- `variants` N -- 1 `variant_betting_structures`

## Tables

### variants

Variant の基本情報と lookup key を持つ。

| Column | Type | Constraint | Notes |
| --- | --- | --- | --- |
| `id` | bigint/integer | PK | dialect 互換の autoincrement id |
| `variant_key` | string | UNIQUE, NOT NULL | frontend の VariantDefinition `id` と対応 |
| `name` | string | NOT NULL | 表示名 |
| `description` | text | nullable | 説明 |
| `base_game` | string | NOT NULL | `badugi`, `holdem`, `omaha`, `draw`, `stud` など |
| `deck_type` | string | NOT NULL | `standard52`, `shortDeck36` など |
| `min_players` | integer | NOT NULL | 最小人数 |
| `max_players` | integer | NOT NULL | 最大人数 |
| `evaluator_id` | bigint/integer | FK -> `variant_evaluators.id`, NOT NULL | evaluator 参照 |
| `betting_structure_id` | bigint/integer | FK -> `variant_betting_structures.id`, NOT NULL | betting structure 参照 |
| `is_active` | boolean | NOT NULL | 使用可能フラグ |
| `is_official` | boolean | NOT NULL | 公式 variant フラグ |
| `sort_order` | integer | NOT NULL | 表示順 |
| `created_at` | datetime | NOT NULL | 作成日時 |
| `updated_at` | datetime | NOT NULL | 更新日時 |

### variant_rules

Variant ごとのルール JSON を保持する。`variant_id` は UNIQUE とし、1 variant に 1 rule record のみ許可する。

| Column | Type | Constraint | Notes |
| --- | --- | --- | --- |
| `id` | bigint/integer | PK | dialect 互換の autoincrement id |
| `variant_id` | bigint/integer | FK -> `variants.id`, UNIQUE, NOT NULL | variant 参照 |
| `hole_cards` | JSON | NOT NULL | `{ count, mustUse? }` |
| `boards` | JSON | NOT NULL | `{ count, cardsPerBoard, streets }` |
| `betting` | JSON | NOT NULL | `{ structure, streets, hasPreflop }` |
| `forced_bets` | JSON | NOT NULL | `{ type, everyonePosts?, amountBB? }` |
| `showdown` | JSON | NOT NULL | `{ evaluator, splitMode, scoopAllowed? }` |
| `draw_rules` | JSON | nullable | draw family 固有 |
| `stud_rules` | JSON | nullable | stud family 固有 |
| `lowball_rules` | JSON | nullable | lowball 固有 |
| `special_rules` | JSON | nullable | bomb pot / double board 等の追加仕様 |
| `created_at` | datetime | NOT NULL | 作成日時 |
| `updated_at` | datetime | NOT NULL | 更新日時 |

### variant_modifiers

Double board、bomb pot、no preflop などの modifier master。

| Column | Type | Constraint | Notes |
| --- | --- | --- | --- |
| `id` | bigint/integer | PK | dialect 互換の autoincrement id |
| `modifier_key` | string | UNIQUE, NOT NULL | `doubleBoard`, `bombPot` など |
| `name` | string | NOT NULL | 表示名 |
| `description` | text | nullable | 説明 |
| `created_at` | datetime | NOT NULL | 作成日時 |
| `updated_at` | datetime | NOT NULL | 更新日時 |

### variant_modifier_links

Variant と modifier の N:N 中間テーブル。

| Column | Type | Constraint | Notes |
| --- | --- | --- | --- |
| `variant_id` | bigint/integer | PK, FK -> `variants.id` | variant 参照 |
| `modifier_id` | bigint/integer | PK, FK -> `variant_modifiers.id` | modifier 参照 |

### variant_evaluators

Evaluator master。Variant は必ず 1 evaluator を参照する。

| Column | Type | Constraint | Notes |
| --- | --- | --- | --- |
| `id` | bigint/integer | PK | dialect 互換の autoincrement id |
| `evaluator_key` | string | UNIQUE, NOT NULL | `badugiLow`, `omahaHigh` など |
| `name` | string | NOT NULL | 表示名 |
| `description` | text | nullable | 説明 |
| `base_game` | string | NOT NULL | 主な game family |
| `split_mode` | string | NOT NULL | `single`, `byBoard`, `hiLo` |
| `is_active` | boolean | NOT NULL | 使用可能フラグ |
| `created_at` | datetime | NOT NULL | 作成日時 |
| `updated_at` | datetime | NOT NULL | 更新日時 |

### variant_betting_structures

Betting structure master。

| Column | Type | Constraint | Notes |
| --- | --- | --- | --- |
| `id` | bigint/integer | PK | dialect 互換の autoincrement id |
| `betting_key` | string | UNIQUE, NOT NULL | `noLimit`, `potLimit`, `limit`, `fixed`, `none` など |
| `name` | string | NOT NULL | 表示名 |
| `description` | text | nullable | 説明 |
| `created_at` | datetime | NOT NULL | 作成日時 |
| `updated_at` | datetime | NOT NULL | 更新日時 |

## Frontend VariantDefinition 復元イメージ

DB response は frontend の `VariantDefinition` に復元しやすい flat + JSON shape にする。

```json
{
  "variant_key": "double_board_bomb_pot_omaha",
  "name": "Double Board Bomb Pot Omaha",
  "base_game": "omaha",
  "deck_type": "standard52",
  "min_players": 2,
  "max_players": 9,
  "hole_cards": {
    "count": 4,
    "mustUse": 2
  },
  "boards": {
    "count": 2,
    "cardsPerBoard": 5,
    "streets": ["flop", "turn", "river"]
  },
  "betting": {
    "structure": "potLimit",
    "streets": ["flop", "turn", "river"],
    "hasPreflop": false
  },
  "forced_bets": {
    "type": "bombPot",
    "everyonePosts": true,
    "amountBB": 5
  },
  "showdown": {
    "evaluator": "omahaHigh",
    "splitMode": "byBoard",
    "scoopAllowed": true
  },
  "modifiers": [
    "doubleBoard",
    "bombPot",
    "potLimit",
    "noPreflop"
  ]
}
```

## Alembic 前提

実テーブル作成は Alembic revision で行う。

想定手順:

1. `backend/app/models/variant.py` を Alembic env から import される model set に含める。
2. `alembic revision --autogenerate` で migration を生成する。
3. 生成 migration を review し、dialect 固有 SQL が混入していないことを確認する。
4. `alembic upgrade head` で適用する。

## 今回やらないこと

- Alembic migration 作成
- seed 実装
- `GET /api/variants`
- `GET /api/variants/{variant_key}`
- 管理用 `POST` / `PUT`
- frontend 接続
- UI 接続
- ゲーム進行への接続

## TODO

- Alembic migration の作成と review。
- 初期 variant seed の投入方針を決める。
- `VariantDetailRead` から frontend `VariantDefinition` への変換関数を追加する。
- evaluator registry / betting engine との整合チェックを追加する。
