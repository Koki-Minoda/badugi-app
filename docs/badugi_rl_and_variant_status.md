# Badugi RL / Multi-Game 実行計画

更新日: 2026-04-30
目的: この文書を、Badugi RL と Draw 系マルチゲーム実装の作業基準書として使う。

## 1. この文書の使い方

- 仕様メモではなく、実装順・依存関係・完了条件を持つ実行計画として扱う。
- 新規タスクを起こすときは、まずこの文書のタスク ID を参照する。
- 迷ったときの優先順位は以下。
  1. `src/games/config/multiGameList.json`
  2. `src/games/config/variantCatalog.js`
  3. `src/specs/09_game_engine_architecture.md`
  4. `src/specs/10_multigame_list_and_requirements.md`
  5. `src/specs/14_evaluator_architecture.md`
  6. `src/specs/18_ai_rl_pro.md`
  7. 本文書
- `docs/game_catalog.md` と `src/docs/variant_metadata.json` は生成物として扱い、手修正しない。

## 2. 現状サマリ

### 2.1 いま確定していること

- バリアント定義の正本は `src/games/config/multiGameList.json`。
- 現行バリアント数は 35。
- `live` 扱いは `D03 Badugi` のみ。
- `D01` / `D02` / `S01` / `S02` の engine / controller / test は実装済みで、catalog status は `wip`。
- Draw 系の UI 本格接続と production smoke は別途確認対象。
- evaluator は以下が実装済み。
  - High
  - 2-7 Low
  - A-5 Low
  - Badugi Low
  - Badugi High
  - Hi-Lo8
  - Badeucey / Badacey
- draw family の共通土台として `src/games/core/drawEngineBase.js` がある。
- 実 engine registry は `badugi` / `D01` / `D02` / `S01` / `S02` 相当を登録済み。
  - `src/games/core/engineRegistry.js`
- 実 controller registry 相当は Badugi / D01 / D02 / S01 / S02 の factory を登録済み。
  - `src/games/core/variants.js`
- UI の variant 選択は一部先行しており、`badugi` と `nlh` が enabled 扱い。
  - `src/ui/game/variants.js`

### 2.2 Badugi RL の現状

- 学習用コードはある。
  - `src/rl/env/badugi_env.py`
  - `src/rl/agents/dqn_agent.py`
  - `src/rl/training/train_dqn.py`
- ログ出力と dataset 変換導線はある。
  - `src/ui/App.jsx` の `recordActionToLog(...)`
  - `src/rl/tools/export_dataset.py`
- tier / model ルーティングはある。
  - `src/config/ai/tiers.json`
  - `src/config/ai/modelRegistry.json`
  - `src/ai/modelRouter.js`
  - `src/ai/tierManager.js`
- ONNX 実行のフロント側ローダはある。
  - `src/ai/onnxExecutor.js`
  - `src/ai/onnxPolicyAdapter.js`
- backend の RL API は frontend ONNX の比較検証 / 将来拡張用 endpoint として残っており、現在は deterministic-safe fallback を返す。
  - `backend/app/api/badugi_rl.py`
- 実 `.onnx` モデルはリポジトリ内で未確認。
- Badugi / Draw 系の observation と model registry は 96-dim schema に揃えている。
  - backend API: Badugi schema v1 / 96-dim
  - frontend ONNX: Badugi / Draw schema v1 / 96-dim
  - model registry: Badugi / Draw model entries は `[96]`

### 2.3 2-7 / A-5 系の現状

- 仕様書と variant 定義はある。
- evaluator はある。
  - `src/games/evaluators/low.js`
- pro AI profile の仮設定もある。
  - `src/config/mixed/proAiProfiles.js`
- `D01` / `D02` / `S01` / `S02` の draw engine / controller / unit / e2e / RL observation 基盤は実装済み。
- UI 本格接続、実ブラウザ / 実スマホでの通し確認、catalog status の最終整理は追加確認対象。

### 2.4 方針決定済み事項

- 最初に完了させる対象は Badugi。
- RL 推論の主経路は frontend ONNX。
- バリアント件数の正式表記は 35 variants。
- Badugi のバグは専用 `md` で継続管理する。
- 実ブラウザ / 実スマホで再現した不具合を優先して記録する。

## 3. 作業の前提

この文書では、明示的な指示があるまで以下を暫定前提にする。

- `multiGameList.json` を件数・ID・family の正本とする。
- Draw 系は Board / Stud より先に進める。
- 非 Badugi の最初の実装対象は `D01 2-7 Triple Draw`。
- 次点は `D02 A-5 Triple Draw`。
- `S01/S02` は `D01/D02` の draw 回数違いとして後追いする。
- `D04/D05` は split pot 実装の上に乗せる。
- `S03/S04-S07`、`Hxx`、`STx` は Draw family の共通部完成後に着手する。

## 4. 決定ログ

- `DEC-01`
  - 最初に完了させる対象は Badugi。
- `DEC-02`
  - RL 推論の主経路は frontend ONNX。
  - backend `/api/badugi/rl/decision` は比較検証・将来拡張用に残す。
- `DEC-03`
  - 件数表記は 35 variants で統一する。
- `DEC-04`
  - Badugi の不具合管理は専用 bug tracker `md` で行う。
  - 実ブラウザ / 実スマホで再現した不具合を優先記録する。

## 5. ゴール定義

### 5.1 近距離ゴール

- Badugi を browser / mobile を含めて安定完走できる状態にする。
- Badugi の bug を `md` ベースで継続運用できるようにする。
- Badugi RL を「stub ではなく実モデル接続済み」にする。
- `D01 2-7 Triple Draw` を ring 対戦可能にする。
- `D02 A-5 Triple Draw` を同じ draw family 上で追加する。
- `S01/S02` を同 family の draw count 差分として追加する。

### 5.2 中距離ゴール

- `D04/D05/D06/D07` まで draw family を拡張する。
- Draw 系で logging / replay / AI / Mixed rotation を横断対応させる。

## 6. 実装戦略

### 6.0 最優先

- まず Badugi の完成度を上げる。
- 新バリアント着手より前に、既存 Badugi の browser / mobile バグを継続的に潰す。
- 2-7 系は Badugi の安定化と RL 接続方針の固定後に入る。

### 6.1 先に family を作る

Badugi の複製を variant ごとに増やすのではなく、以下の順で進める。

1. Draw family 共通契約の固定
2. Lowball evaluator の強化
3. `D01`
4. `D02`
5. `S01/S02`
6. split draw variants

### 6.2 先にルールを固定する

特に 2-7 は以下を先に明文化する。

- fixed-limit ベットサイズ
- raise cap
- draw 選択 UI の契約
- pat / 1 / 2 / 3 / 4 / 5 枚交換の扱い
- showdown 表示文言
- replay / RL 用 observation の shape

### 6.3 evaluator と engine を分ける

- evaluator は純関数として先に完成させる。
- engine は evaluator を使うだけにする。
- RL observation は engine が返す。

### 6.4 バグ管理の原則

- Badugi のバグ正本は [docs/bugs/badugi_browser_mobile_bug_tracker.md](/home/mgx/badugi-app/docs/bugs/badugi_browser_mobile_bug_tracker.md) とする。
- `docs/bugs/current_bugs.md` は横断 blocker 一覧として残す。
- Badugi の実ブラウザ / 実スマホ / UI / 操作 / 回帰系は専用 bug tracker に集約する。

### 6.5 Frontend VariantDefinition 基盤 Step 1

目的:

- 30 種類以上のポーカーゲームを追加できるように、Badugi 実装とは独立した Variant Definition / Registry / Board helper の最小基盤を追加する。
- 既存 Badugi 実装、UI、MTT、RL API、`App.jsx` には影響を与えない。

追加対象:

- `src/games/core/variantDefinition.js`
- `src/games/core/variantRegistry.js`
- `src/games/core/boardManager.js`
- `src/games/core/potResolver.js`
- `src/games/core/showdownResolver.js`
- `src/games/core/__tests__/variantRegistry.test.js`
- `src/games/core/__tests__/boardManager.test.js`
- `src/games/core/__tests__/variantDefinition.test.js`

`VariantDefinition` 必須フィールド:

- `id`
- `name`
- `base`: `badugi` / `holdem` / `omaha` / `draw` / `stud`
- `players`: `{ min, max }`
- `deck`: `{ type }`
- `holeCards`: `{ count, mustUse? }`
- `boards`: `{ count, cardsPerBoard, streets }`
- `betting`: `{ structure, streets, hasPreflop }`
- `forcedBets`: `{ type, everyonePosts?, amountBB? }`
- `showdown`: `{ evaluator, splitMode, scoopAllowed? }`
- `modifiers`

初期登録 variant:

- `badugi`
- `nl_holdem`
- `limit_holdem`
- `plo`
- `double_board_bomb_pot_omaha`

実装済み API:

- `validateVariant(variant)`
- `normalizeVariant(variant)`
- `getVariant(id)`
- `listVariants()`
- `hasVariant(id)`
- `registerVariant(variant)`
- `createBoards(variant)`
- `getBoardById(boards, boardId)`
- `isDoubleBoardVariant(variant)`
- `dealToBoards(boards, street, deckOrCards)`
- `resolvePot({ variant, players, boards, evaluations, pot })`
- `resolveShowdown({ variant, players, boards })`

Step 1 完了条件:

- [x] JS 側 Variant 基盤を追加する。
- [x] 5 つの初期 variant を登録する。
- [x] Double Board Bomb Pot Omaha を定義する。
- [x] 単一ボード / ダブルボードを配列で扱えるようにする。
- [x] 既存 Badugi のゲーム進行に接続せず、影響範囲を分離する。
- [x] Vitest で最小テストを追加する。

TODO:

- `dealToBoards` を共通 deck manager / board engine と統合する。
- `resolvePot` に side pot、board 別配分、hi/lo split の実配分ロジックを接続する。
- `resolveShowdown` を evaluator registry と接続し、正規化済み評価結果を返す。

### 6.6 Variant DB 基盤 Step 2

目的:

- Variant Definition を将来的に DB 管理できるように、DB 設計、SQLAlchemy モデル案、Pydantic schema 案を追加する。
- 既存ゲーム進行、Badugi、MTT、RL API には接続しない。

追加対象:

- `docs/variant-db-design.md`
- `backend/app/models/variant.py`
- `backend/app/schemas/variant.py`
- `backend/app/models/__init__.py`

Step 2 完了条件:

- [x] docs に Variant DB の ER 設計を追加する。
- [x] SQLAlchemy モデル案を追加する。
- [x] Pydantic schema 案を追加する。
- [x] `variants` / `variant_rules` / `variant_modifiers` / `variant_evaluators` / `variant_betting_structures` の関係を表現する。
- [x] 手動 `CREATE TABLE` ではなく Alembic 前提の設計にする。
- [x] MySQL 固有設計にしない。
- [x] 既存 backend 起動に悪影響がないことを import / metadata 登録で確認する。
- [x] API route / seed / migration は Step 2 では追加しない。

### 6.7 Variant DB API / Migration / Seed Step 4

目的:

- Step 2 の DB 設計を実際に使えるように、Alembic migration、seed、参照 API を追加する。
- 管理系 POST / PUT / DELETE、frontend 接続、UI 接続、ゲーム進行接続は行わない。

追加対象:

- `backend/alembic/versions/20260429_01_add_variant_tables.py`
- `backend/app/crud/variant.py`
- `backend/app/db/seeds/variants.py`
- `backend/app/api/variants.py`
- `backend/tests/test_variants_api.py`
- `backend/app/main.py` の variants router 登録

Step 4 完了条件:

- [x] Alembic migration を追加する。
- [x] seed で 5 variant を登録できる。
- [x] `GET /api/variants` を追加する。
- [x] `GET /api/variants/{variant_key}` を追加する。
- [x] `double_board_bomb_pot_omaha` を DB から復元できる。
- [x] seed は冪等で重複登録しない。
- [x] 既存 API、Badugi、MTT、RL API を壊していないことを backend test で確認する。
- [x] backend tests が通る。

### 6.8 Frontend Variant Loader Step 3

目的:

- `GET /api/variants` と `GET /api/variants/{variant_key}` を使い、フロント側で DB 由来の VariantDefinition を読めるようにする。
- UI の本格接続、ゲーム起動接続、BadugiEngine 差し替え、RL / MTT 変更は行わない。

追加対象:

- `src/games/core/variantApi.js`
- `src/games/core/variantLoader.js`
- `src/games/core/__tests__/variantLoader.test.js`

Step 3 完了条件:

- [x] フロントから `/api/variants` を読める API util を追加する。
- [x] フロントから `/api/variants/{variant_key}` を読める API util を追加する。
- [x] DB レスポンスを VariantDefinition 形式へ変換できる。
- [x] API 失敗時にローカル定義へ fallback する。
- [x] `double_board_bomb_pot_omaha` を取得 / 復元 / fallback できる。
- [x] 既存 Badugi 進行に接続せず、影響範囲を分離する。
- [x] `App.jsx` を変更しない。
- [x] Vitest で loader / core tests が通る。

## 7. ワークストリーム

## 7.0 WG-BADUGI-00 Badugi 完了優先フェーズ

目的:

- 新規 variant 追加前に、Badugi を主力ゲームとして運用できる状態に引き上げる。

タスク:

- [x] `WG-BADUGI-00-01` Badugi の完了条件を browser / mobile を含めて固定する。
- [x] `WG-BADUGI-00-02` Badugi bug tracker を正本として運用開始する。
- [x] `WG-BADUGI-00-03` 実ブラウザ / 実スマホでの再現確認フローを定義する。
- [x] `WG-BADUGI-00-04` `docs/bugs/current_bugs.md` と専用 bug tracker の役割分担を明記する。

完了条件:

- Badugi を最優先に進めることが本文書上で明示されている。
- バグ記録先と triage ルールが固定されている。

Badugi 完了条件:

- Ring game で 20 hand 連続して action deadlock なく完走する。
- Tournament / MTT で bust、table state、次 hand 遷移が破綻しない。
- Browser desktop で fold / call / raise / draw / pat / showdown / next hand が操作可能。
- Mobile portrait / landscape で主要操作ボタン、card area、result overlay が重ならない。
- Hand history と replay 用 action log に handId、seat、phase、action、amount、result が残る。
- 既存 regression tests、Badugi engine tests、主要 UI tests が通る。
- 未解決 bug は `docs/bugs/badugi_browser_mobile_bug_tracker.md` に ID、再現条件、残リスク付きで記録されている。

実ブラウザ / 実スマホ再現確認フロー:

1. 確認対象 bug または release check に `BG-###` を割り当てる。
2. `npm run dev` または preview build を起動し、build 種別を bug tracker に記録する。
3. Desktop Chrome で ring game を最低 5 hand、tournament を最低 1 table break / bust 相当まで確認する。
4. iPhone Safari または Android Chrome で portrait / landscape を切り替え、主要操作と overlay を確認する。
5. 発生した問題は browser、OS、device、orientation、input、handId、console log、screenshot / video を bug tracker に記録する。
6. 修正後は同じ環境・同じ手順で再確認し、`Fixed Commit`、`Repro Closed Date`、`Residual Risk` を更新する。

## 7.1 WG-00 文書・正本整理

目的:

- 件数・ID・status・UI 表示のズレをなくす。

タスク:

- [x] `WG-00-01` 「30ゲーム」表記を「35 variants」に更新する。
- [x] `WG-00-02` 正本ファイルを本文書に明記し、生成物との関係を固定する。
- [x] `WG-00-03` `multiGameList.json` の `status` 値を棚卸しする。
  - 候補: `live`, `wip`, `prototype`, `planned`
- [x] `WG-00-04` UI enabled 状態と engine 実装状態の差分表を作る。
  - 対象:
    - `src/ui/game/variants.js`
    - `src/games/core/variants.js`
    - `src/games/_core/GameRegistry.js`

UI / engine registry 差分表:

| Variant | `src/ui/game/variants.js` | `src/games/core/variants.js` | `src/games/_core/GameRegistry.js` | 判定 |
| --- | --- | --- | --- | --- |
| `badugi` | enabled | controller registered | definition registered | playable |
| `nlh` / `nl_holdem` | `nlh` enabled | not registered | `NLHGameDefinition` registered | UI と controller registry の ID / 実装状態に差分あり |
| `plo` | disabled | not registered | not registered | catalog / VariantDefinition のみ |
| `27sd` | disabled | not registered | not registered | UI placeholder のみ |
| `double_board_bomb_pot_omaha` | not listed | not registered | not registered | VariantDefinition / DB API / loader fallback のみ |

運用メモ:

- 現時点で実ゲーム起動の正本は既存 Badugi 経路を維持する。
- DB 由来 VariantDefinition は `src/games/core/variantLoader.js` で読めるが、game launcher には未接続。
- UI enabled と engine/controller 実装の差分を解消するまでは、新規 variant を playable 表示にしない。

完了条件:

- 文書上の件数・ID・status が全ファイルで矛盾しない。
- どのファイルが人手編集、どのファイルが生成物か明示されている。

## 7.2 WG-01 Draw family 基盤

目的:

- Badugi 以外の draw ゲームを同じ骨格で実装できるようにする。

主要ファイル:

- `src/games/core/drawEngineBase.js`
- `src/games/core/gameEngine.js`
- `src/games/core/engineRegistry.js`
- `src/games/core/GameController.js`
- `src/games/badugi/engine/BadugiEngine.js`
- `src/games/badugi/controller/BadugiGameController.js`

タスク:

- [x] `WG-01-01` Draw family の state contract を固定する。
  - 必須項目:
    - `drawRoundIndex`
    - `maxDrawRounds`
    - `actingPlayerIndex`
    - `currentBet`
    - `lastAggressorIndex`
    - `pendingDrawSeats`
    - `discardCountBySeat`
- [x] `WG-01-02` Draw family の action contract を固定する。
  - `FOLD`
  - `CHECK`
  - `CALL`
  - `BET`
  - `RAISE`
  - `DRAW`
- [x] `WG-01-03` `DRAW` action の payload 契約を決める。
  - 推奨:
    - discard index array
    - 派生 metadata
    - 置換前後 hand snapshot
- [x] `WG-01-04` Badugi engine から draw family に切り出せる処理を抽出する。
  - forced bets
  - active seat progression
  - betting round completion
  - showdown 前遷移
- [x] `WG-01-05` Draw family 共通テスト雛形を作る。
  - 全員 pat
  - 複数人 draw
  - fold で early finish
  - all-in で draw skip
- [x] `WG-01-06` Draw family 用 controller snapshot 形式を固定する。
- [x] `WG-01-07` Draw family observation schema の v1 を定める。
  - RL / replay / debug 共通

Draw family state contract v1:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `variantId` | string | yes | 例: `badugi`, `27td`, `a5td`。VariantDefinition の `id` と一致させる。 |
| `phase` | string | yes | `BET` / `DRAW` / `SHOWDOWN` / `HAND_OVER`。既存 UI 互換のため大文字を正とする。 |
| `street` | string | recommended | engine 内部の street 名。`phase` と同じでもよい。 |
| `players` | array | yes | seat order を保持した player snapshot。folded / allIn / sittingOut / hand を含む。 |
| `dealerIndex` | number | yes | button seat。draw 開始 seat と blind 計算の基準。 |
| `actingPlayerIndex` | number \| null | yes | 次に action する seat。action 不要なら `null`。 |
| `drawRoundIndex` | number | yes | 0-based。pre-draw betting は `0`、draw1 後 betting は `1`。 |
| `maxDrawRounds` | number | yes | Badugi / triple draw は `3`、single draw は `1`。 |
| `betRoundIndex` | number | recommended | fixed-limit bet size 判定用。未設定時は `drawRoundIndex` から派生可能。 |
| `currentBet` | number | yes | 現 street の call 目標額。metadata に置く場合も top-level へ同期する。 |
| `lastAggressorIndex` | number \| null | yes | bet / raise / blind の最後の aggressor。street completion 判定に使う。 |
| `pendingDrawSeats` | number[] | yes | 現 draw round でまだ draw / pat を宣言していない seat。 |
| `discardCountBySeat` | object | yes | `{ [seatIndex]: number }`。RL / replay / HUD 用の正規化済み discard count。 |
| `pots` | array | recommended | pot / side pot snapshot。未対応 engine でも空配列を返す。 |
| `metadata` | object | recommended | debug / migration 用。正規 field と重複する値は正規 field を優先する。 |

Draw family player snapshot v1:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `seatIndex` | number | yes | 配列 index と一致すること。 |
| `playerId` | string \| null | recommended | replay / logging 用。 |
| `name` | string | recommended | UI 表示用。 |
| `hand` | array | yes | 現在の手札。hidden 表示時も engine snapshot では保持する。 |
| `stack` | number | yes | 残 stack。 |
| `bet` | number | yes | 現 street の投入額。 |
| `folded` | boolean | yes | folded seat は BET / DRAW / showdown eligibility から除外する。 |
| `allIn` | boolean | yes | all-in seat は追加 BET 不可。ただし既存 Badugi 互換で DRAW 完了処理は許可する。 |
| `sittingOut` / `seatOut` | boolean | recommended | どちらかを正規化して扱う。新規実装は `sittingOut` を優先する。 |
| `hasActedThisRound` | boolean | yes | BET / DRAW の round completion 判定に使う。 |
| `lastAction` | string | recommended | UI / hand history 表示用。 |
| `lastDrawCount` | number | recommended | 直近 draw / pat の枚数。 |

Draw family action contract v1:

共通 envelope:

```js
{
  type: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "DRAW",
  seatIndex: number,
  amount?: number,
  metadata?: object
}
```

Action semantics:

| Action | Required payload | Notes |
| --- | --- | --- |
| `FOLD` | `seatIndex` | seat を folded にし、以後の BET / DRAW / showdown eligibility から外す。 |
| `CHECK` | `seatIndex` | `currentBet` に対して追加支払いが不要な場合のみ合法。 |
| `CALL` | `seatIndex` | `currentBet - player.bet` を最大 stack まで支払う。 |
| `BET` | `seatIndex`, `amount` | bet がまだ無い street の open。fixed-limit 系は engine が単位へ正規化する。 |
| `RAISE` | `seatIndex`, `amount` | call + raise increment。既存 Badugi 互換では `RAISE` が bet/raise を兼ねる箇所がある。 |
| `DRAW` | `seatIndex`, `discardIndexes` または `drawCount` | discard と replacement を行う。0 枚は pat。 |

`DRAW` payload contract v1:

```js
{
  type: "DRAW",
  seatIndex: number,
  discardIndexes: number[],
  drawCount?: number,
  beforeHand?: string[],
  discarded?: string[],
  drawn?: string[],
  afterHand?: string[],
  metadata?: {
    drawRoundIndex?: number,
    actionLabel?: string,
    source?: "human" | "cpu" | "replay" | "rl",
    replaceMode?: "byIndex",
    deckSnapshotId?: string
  }
}
```

Rules:

- `discardIndexes` は 0-based hand index の昇順・重複なしを正とする。
- `drawCount` がある場合は `discardIndexes.length` と一致させる。一致しない場合は `discardIndexes.length` を優先する。
- `discardIndexes: []` は pat として扱う。
- `beforeHand` / `discarded` / `drawn` / `afterHand` は replay / audit 用 metadata。engine の正規状態は `players[seatIndex].hand`。
- replacement card の生成は deck manager の責務。UI / RL は `discardIndexes` または `drawCount` だけを送る。
- action log では `DRAW_ACTION` として `discardCount`、`discarded`、`drawRoundIndex` を保存できる形にする。

Badugi から draw family に切り出す処理:

| Concern | Current source | Family boundary | Notes |
| --- | --- | --- | --- |
| forced bets | `DrawEngineBase.applyForcedBets`, `BadugiEngine.applyForcedBets` | `DrawEngineBase` に標準化 | Badugi 固有の all-in / fixed-limit metadata は派生 engine override で補完する。 |
| active seat progression | `src/games/badugi/flow/actionUtils.js`, `roundFlow.jsx` | `findNextActor({ phase, players, startIndex })` 型 helper | folded / allIn / sittingOut の除外規則を family 共通にする。 |
| betting round completion | `DrawEngineBase.shouldAdvanceStreet`, `betRoundUtils.js` | `shouldAdvanceStreet(state)` + variant betting policy | no-limit / pot-limit / fixed-limit の amount policy は別 module にする。 |
| draw actor progression | `findNextDrawActorSeat`, `runDrawRound` | `pendingDrawSeats` と `hasActedThisRound` を正規状態にする | all-in でも draw 完了処理は許可する Badugi 互換を維持する。 |
| showdown 前遷移 | `BadugiEngine.advanceAfterBet`, `roundFlow.jsx` | `advanceAfterBet({ drawRoundIndex, maxDrawRounds })` | `nextDrawRound > maxDrawRounds` で `SHOWDOWN` へ進む。 |
| deck replacement | `DeckManager`, `runDrawRound` | `replaceByDiscardIndexes` style helper | UI / RL は discard intent のみ送る。deck mutation は engine 側で閉じる。 |
| pot settlement | `settleStreetToPots`, `potIntegrity.js` | `settleStreetToPots(state)` | side pot 互換を崩さず board / split 系へ後で拡張する。 |

Draw family 共通テスト雛形:

| Scenario | Required assertion | Current coverage |
| --- | --- | --- |
| forced bets | ante / SB / BB が stack と bet に反映され、元 state を破壊しない | `src/games/core/__tests__/drawEngineBase.test.js` |
| betting matched | active players の bet が揃うと street advance 可能 | `src/games/core/__tests__/drawEngineBase.test.js` |
| all-in completion | active players が全員 all-in なら street advance 可能 | `src/games/core/__tests__/drawEngineBase.test.js` |
| unmatched action | call 可能 seat が残る場合は street advance しない | `src/games/core/__tests__/drawEngineBase.test.js` |
| draw round cap | `maxDrawRounds` を超えない | `src/games/core/__tests__/drawEngineBase.test.js` |
| all pat | 全 seat の `discardIndexes: []` で draw round が完了する | next concrete draw engine test |
| multiple draw | 複数 seat の discard / replacement が seat order 通り記録される | next concrete draw engine test |
| fold early finish | remaining eligible player が 1 人なら showdown / award へ進む | next concrete draw engine test |
| all-in draw skip | no actionable draw seat の場合だけ draw phase を skip する | `roundFlowDrawSkip.test.js` |

Draw family controller snapshot v1:

```js
{
  variantId: string,
  handId: string,
  phase: "BET" | "DRAW" | "SHOWDOWN" | "HAND_OVER",
  street: string,
  drawRound: number,
  maxDrawRounds: number,
  actingPlayerIndex: number | null,
  heroSeatIndex: number | null,
  players: [
    {
      seatIndex: number,
      playerId?: string,
      name?: string,
      stack: number,
      bet: number,
      folded: boolean,
      allIn: boolean,
      sittingOut: boolean,
      hand: string[],
      handSize: number,
      hasActedThisRound: boolean,
      lastAction?: string,
      lastDrawCount?: number
    }
  ],
  pots: array,
  availableActions: array,
  pendingDrawSeats: number[],
  discardCountBySeat: object,
  result?: object,
  metadata?: object
}
```

Snapshot rules:

- UI は controller snapshot のみを読む。engine 内部 state を直接参照しない。
- `drawRound` は controller 互換名、`drawRoundIndex` は engine 互換名として扱い、境界で同期する。
- hidden card 表示が必要な UI では `hand` を masking してもよいが、replay / debug snapshot は実 card を保持する。
- `availableActions` は action contract v1 の `type` を返す。draw phase では `DRAW` を必ず含める。

Draw family observation schema v1:

```js
{
  schemaVersion: 1,
  variantId: string,
  playerId: string,
  seatIndex: number,
  phase: "BET" | "DRAW" | "SHOWDOWN" | "HAND_OVER",
  street: string,
  drawRoundIndex: number,
  maxDrawRounds: number,
  position: {
    dealerIndex: number,
    actingPlayerIndex: number | null,
    lastAggressorIndex: number | null
  },
  hero: {
    stack: number,
    bet: number,
    hand: string[],
    handSize: number,
    lastDrawCount?: number
  },
  table: {
    pot: number,
    currentBet: number,
    minRaise?: number,
    activeCount: number,
    allInCount: number
  },
  draw: {
    pendingDrawSeats: number[],
    discardCountBySeat: object
  },
  legalActions: array,
  actionMask?: object,
  historySummary?: object
}
```

Observation rules:

- RL / replay / debug は同じ top-level key を使う。
- numeric feature vector はこの schema から別 step で生成する。schema 自体は JSON-safe object とする。
- variant 固有 feature は `historySummary` または future `variantFeatures` に追加し、共通 key を壊さない。
- action mask は optional。未実装時は `legalActions` を正とする。

完了条件:

- Badugi 固有ロジックと draw 共通ロジックの境界が明確。
- 新規 draw variant の engine 雛形を 1 ファイルで起こせる。
- snapshot / action / observation が文書化されている。

依存:

- `WG-BADUGI-00`
- `WG-00`

## 7.2A WG-BADUGI-01 Browser / Mobile バグ管理

目的:

- 実ブラウザ / 実スマホで出る Badugi 固有の不具合を、修正タスクに落とせる粒度で管理する。

正本:

- [docs/bugs/badugi_browser_mobile_bug_tracker.md](/home/mgx/badugi-app/docs/bugs/badugi_browser_mobile_bug_tracker.md)

タスク:

- [x] `WG-BADUGI-01-01` bug ID 採番ルールを固定する。
  - 推奨: `BG-###`
- [x] `WG-BADUGI-01-02` 再現環境の記録項目を固定する。
  - browser
  - OS
  - device
  - orientation
  - input mode
- [x] `WG-BADUGI-01-03` 症状分類を固定する。
  - gameplay
  - ui-layout
  - input
  - animation
  - hand-history
  - performance
  - mobile-only
- [x] `WG-BADUGI-01-04` bug から test への逆引き欄を追加する。
  - existing test
  - missing test
- [x] `WG-BADUGI-01-05` 修正後に更新する欄を固定する。
  - fixed commit
  - repro closed date
  - residual risk

完了条件:

- Bug が「再現条件」「影響範囲」「対応タスク」「検証方法」まで一枚で追える。
- 実機起因の再現性の低い不具合でも、次に何を確認すべきか残る。

## 7.3 WG-02 Evaluator 強化

目的:

- 2-7 / A-5 / split 系を engine 実装前に固める。

主要ファイル:

- `src/games/evaluators/low.js`
- `src/games/evaluators/split.js`
- `src/games/evaluators/registry.js`
- `src/games/evaluators/__tests__/evaluator.test.js`

タスク:

- [x] `WG-02-01` 2-7 lowball の edge case テストを追加する。
  - pair が負ける
  - straight が負ける
  - flush が負ける
  - wheel が最強ではない
  - 7-high vs 8-high の順序
  - 同ランク tie
- [x] `WG-02-02` A-5 lowball の edge case テストを追加する。
  - Ace low
  - straight 無視
  - flush 無視
  - wheel 最強
  - pair penalty
- [x] `WG-02-03` 6枚以上入力から最良 5 枚が選ばれることを保証する。
- [x] `WG-02-04` split evaluator の pot 分配前提テストを追加する。
  - Badeucey
  - Badacey
  - Hi-Lo8
- [x] `WG-02-05` evaluator 出力の debug metadata を統一する。
  - `ranks`
  - `cards`
  - `penalty`
  - `qualifies`

完了条件:

- 2-7 / A-5 / split evaluator の比較順がテストで説明可能。
- engine 実装側で evaluator の解釈に迷いがない。

依存:

- なし

## 7.4 WG-03 D01 2-7 Triple Draw

目的:

- Badugi 以外で最初に実戦投入できる draw variant を作る。

対象:

- `D01`
- fixed-limit
- 5 hole cards
- 3 draws
- evaluator: `low-27`

ルール凍結タスク:

- [x] `WG-03-01` `D01` のベット構造を固定する。
  - small bet / big bet
  - draw round ごとの bet size
  - raise cap
- [x] `WG-03-02` draw 交換枚数の上限と UI 表現を固定する。
  - 推奨: 0-5 枚交換
- [x] `WG-03-03` showdown 表記を固定する。
  - 例: `2-7 Low 7-5-4-3-2`

D01 rule freeze:

| Item | Decision |
| --- | --- |
| Variant id | `D01` in catalog, engine key should be `deuce_to_seven_triple_draw` when implemented. |
| Public label | `2-7 Triple Draw` |
| Base family | Draw / lowball |
| Hole cards | 5 |
| Draw rounds | 3 |
| Board | none |
| Evaluator | `low-27` / `evaluateLowHand({ lowType: "27" })` |
| Betting | fixed-limit |
| Forced bets | blinds |
| Players | 2-6 initially, may expand to 7 if table layout supports it |

D01 fixed-limit betting structure:

| Street | Phase | Bet size | Notes |
| --- | --- | --- | --- |
| Pre-draw | `BET`, `drawRoundIndex=0` | small bet = 1 BB | Starts after blinds. BB action closes the opening round when matched. |
| After draw 1 | `BET`, `drawRoundIndex=1` | small bet = 1 BB | First post-draw betting round. |
| After draw 2 | `BET`, `drawRoundIndex=2` | big bet = 2 BB | Big-bet street starts here. |
| After draw 3 | `BET`, `drawRoundIndex=3` | big bet = 2 BB | Final betting round before showdown. |

Raise rules:

- Raise cap is 4 total bets per street by default: bet + 3 raises.
- Heads-up may remain capped for first implementation; uncapped heads-up is deferred until the fixed-limit policy module exists.
- All-in under-raise does not reopen action unless future betting policy explicitly supports it.
- Bet / raise amounts must align to the street unit. Invalid partial raises are rejected or normalized by the fixed-limit policy layer.

D01 draw UI contract:

- Player can discard 0-5 cards.
- `0` cards is displayed as `Pat`.
- `1-5` cards are displayed as `Draw 1` through `Draw 5`.
- UI sends `DRAW` with `discardIndexes` as the primary payload.
- `drawCount` is derived from `discardIndexes.length`; it may be included only as redundant metadata.
- Selected discard cards must be visually marked before submit. Submit is disabled while duplicate / out-of-range indexes exist.
- CPU / replay may send only `drawCount` during early implementation, but controller must normalize to `discardIndexes` before engine mutation when card identity is known.

D01 showdown label:

- Primary format: `2-7 Low {ranks-desc}`.
- Example: `2-7 Low 7-5-4-3-2`.
- Paired / straight / flush penalties should still show the selected five ranks, with penalty detail available in metadata.
- Formatter source: `formatLowHandLabel(evaluation, { lowType: "27" })`.

engine 実装タスク:

- [x] `WG-03-04` `DeuceToSevenTripleDrawEngine` を追加する。
- [x] `WG-03-05` 初期配布 5 枚と blind posting を実装する。
- [x] `WG-03-06` 3 draw flow を実装する。
- [x] `WG-03-07` discard / replacement ロジックを実装する。
- [x] `WG-03-08` fixed-limit betting completion 条件を実装する。
- [x] `WG-03-09` showdown と pot awarding を実装する。
- [x] `WG-03-10` engine registry に登録する。

D01 engine initial implementation:

- Engine file: `src/games/draw/DeuceToSevenTripleDrawEngine.js`.
- Engine id: `deuce_to_seven_triple_draw`.
- Catalog variant id: `D01`.
- `initHand(ctx)` creates draw-family table state with `street: "BET"`, `drawRoundIndex: 0`, and `maxDrawRounds: 3`.
- Active seats receive 5 unique cards. Empty seats receive no cards and are marked folded / sitting out.
- `applyForcedBets(state)` uses the draw-family forced-bet path and annotates `metadata.currentBet`.
- `advanceAfterBet(state)` moves from fixed-limit BET to DRAW round 1-3, settles current street bets into the pot, and marks SHOWDOWN after the third draw cycle.
- `applyDrawAction(state, action)` accepts `discardIndexes`, replaces discarded cards through `DeckManager`, records `discardCountBySeat`, and returns to BET after all active seats have drawn.
- `applyBettingAction(state, action)` supports fixed-limit `FOLD`, `CHECK`, `CALL`, `BET`, and `RAISE`, including street bet unit and raise-cap metadata.
- `resolveShowdown(state)` evaluates 2-7 low hands and pays eligible winners. Fold wins collect the settled pot immediately.
- `evaluateShowdownHand(cards)` uses `evaluateLowHand({ lowType: "27" })` and `formatLowHandLabel`.
- Engine is registered in `engineRegistry` as `deuce_to_seven_triple_draw`.

controller / UI タスク:

- [x] `WG-03-11` `D01` 用 controller を追加する。
- [x] `WG-03-12` hand snapshot を UI 互換形式で返す。
- [x] `WG-03-13` discard UI を 5 枚用に一般化する。
- [x] `WG-03-14` result overlay で 2-7 hand label を表示する。
- [x] `WG-03-15` action log / hand history 表記を variant 対応にする。

D01 controller initial implementation:

- Controller file: `src/games/draw/DeuceToSevenTripleDrawController.js`.
- Wraps `DeuceToSevenTripleDrawEngine` without changing `App.jsx` or existing Badugi controller paths.
- `createInitialState()`, `createNewHandState()`, `getUiSnapshot()`, `getLegalActions()`, `applyAction()`, `isHandFinished()`, and `getWinners()` are implemented.
- UI snapshot exposes Badugi-compatible keys including `phase`, `drawRound`, `players[].hand`, `players[].selected`, `turn`, `nextTurn`, `pot`, `currentBet`, and `lastHandResult`.
- D01-specific snapshot metadata includes `variantId: "D01"`, `maxDiscardCount: 5`, and `handCardCount: 5`.
- Draw selection is generalized through `src/ui/game/drawSelection.js` so Badugi can cap at 4 discards while D01 can select 5.
- Player card layout now derives its grid column count from hand size, so 5-card draw hands fit the existing player panel.
- D01 `lastHandResult` is normalized to overlay-ready `potDetails[].winners[].handLabel`, allowing `2-7 Low 7-5-4-3-2` style labels in `HandResultOverlay`.
- Hand history records now carry optional `variantId` / `variantName`; Badugi remains the default when callers do not pass a variant.
- D01 hand history uses the 2-7 low evaluator for final hand labels and stores final low ranks separately from Badugi evaluation data.

AI / logging / replay タスク:

- [x] `WG-03-16` `recordActionToLog(...)` に `D01` 必須項目を追加する。
  - discard count
  - kept / replaced cards
  - final low ranks
- `appendHandHistoryAction(...)` preserves draw metadata as `drawCount`, `discarded`, `keptCards`, and `replacedCards` when `recordActionToLog(...)` supplies normalized `drawInfo`.
- Final D01 seats and pot winners include `handLabel` and `finalLowRanks`, which are enough for replay / hand history result restoration.
- [x] `WG-03-17` rule-based CPU の暫定戦略を入れる。
  - pat threshold
  - draw count heuristic
  - raise heuristic
- D01 engine exposes `chooseCpuAction(state, seatIndex)` with a temporary rule-based strategy:
  - pat on clean 8-low or better
  - discard duplicate ranks and high cards, with straight / flush escape for made-but-bad lows
  - raise strong pat 7-low or better, call normal draws, and fold weak late 3-card draws facing a bet
- D01 controller exposes `getCpuAction(state, seatIndex)` for future UI / simulation loops without changing the current Badugi CPU path.
- [x] `WG-03-18` replay と hand history 復元に必要な最低項目を定義する。
- D01 replay minimum field contract is defined in `src/ui/utils/handHistoryReplayRequirements.js`.
- Required D01 restoration fields:
  - top level: `handId`, `variantId`, `variantName`, `seats`, `pots`
  - seat: `seat`, `name`, `startStack`, `endStack`, `actions`
  - draw action: `seq`, `street`, `type`, `drawCount`, `discarded`, `keptCards`, `replacedCards`
  - final seat result: `handLabel`, `finalLowRanks` when a final hand is present
  - pot winner: `seat`, `collect`, `handLabel`, `finalLowRanks`
- `validateReplayReadyHandHistory(record, { variantId: "D01" })` reports missing replay fields before a D01 record is used by replay / restoration tooling.

テストタスク:

- [x] `WG-03-19` evaluator regression テストを追加する。
- [x] `WG-03-20` engine unit tests を追加する。
- [x] `WG-03-21` controller tests を追加する。
- [x] `WG-03-22` e2e で 1 hand 完走テストを追加する。
- [x] `WG-03-23` side pot / fold win / pat win / draw-to-better-low をカバーする。

D01 evaluator regression coverage:

- `src/games/evaluators/__tests__/evaluator.test.js` covers 2-7 low ordering for clean 7-low vs worse 8-low.
- A-5 wheel / straight, paired hands, and flush hands are regression-tested as penalties in `lowType: "27"`.
- Best-five selection from a six-card input confirms high-card discard behavior used by draw variants.
- Equal 2-7 rank arrays across suits remain tied, preventing suit-order leakage into showdown comparisons.

D01 engine unit coverage:

- `src/games/draw/__tests__/DeuceToSevenTripleDrawEngine.test.js` covers D01 hand initialization, blind posting, fixed-limit betting, draw transitions, discard replacement, showdown, and fold-win payout.
- Invalid duplicate / out-of-range `discardIndexes` are rejected before the draw hand is mutated.
- All-in seats are skipped when building draw order and cannot be selected as pending draw actors.
- Fixed-limit raise cap enforcement is covered.
- Tied 2-7 showdown pots split deterministically by seat order, including odd-chip remainder handling.
- Side-pot showdown payout is covered with each pot restricted to its eligible D01 seats.

D01 controller coverage:

- `src/games/draw/__tests__/DeuceToSevenTripleDrawController.test.js` covers D01 hand start, UI-compatible snapshots, legal BET / DRAW actions, CPU action exposure, action application, and overlay-ready 2-7 result labels.
- Controller input errors return `invalidAction` events without mutating the supplied state.
- Fold-win completion emits `handComplete`, exposes `SHOWDOWN` snapshot state, and makes winners available through `getWinners(...)`.

D01 e2e hand-flow coverage:

- `src/games/draw/__tests__/DeuceToSevenTripleDrawE2E.test.js` drives the D01 controller from blind-posted hand start through three draw rounds and final showdown.
- The test verifies `handStarted`, betting completion, draw completion, and `handComplete` events are emitted during a full hand.
- The final snapshot is `SHOWDOWN`, preserves 5-card hands, exposes overlay-ready winner data, and keeps total table chips conserved.
- Pat-win full-hand flow and one-card draw-to-better-low full-hand flow are both covered.

完了条件:

- ring game として `D01` を 1 hand 以上安定完走できる。
- hand history に discard と最終評価が残る。
- CPU が最低限破綻せず行動する。
- replay で最終結果を追える。

依存:

- `WG-01`
- `WG-02`

## 7.5 WG-04 D02 A-5 Triple Draw

目的:

- `D01` の draw family を流用し、A-5 差分だけで variant を増やせる状態にする。

差分:

- evaluator: `low-a5`
- straight / flush 無視
- Ace low

タスク:

- [x] `WG-04-01` `D01` と `D02` の差分仕様を 1 表にまとめる。
- [x] `WG-04-02` engine を variant param で切り替えるか、別 engine にするか決める。
  - 推奨: 共通 draw-lowball engine + evaluator param
- [x] `WG-04-03` showdown label と debug metadata を A-5 用に調整する。
- [x] `WG-04-04` CPU draw heuristic を A-5 向けに調整する。
- [x] `WG-04-05` `D02` 用の unit/e2e を追加する。

D01 / D02 diff table:

| Item | D01 2-7 Triple Draw | D02 A-5 Triple Draw |
| --- | --- | --- |
| Engine key | `deuce_to_seven_triple_draw` | `ace_to_five_triple_draw` |
| Variant id | `D01` | `D02` |
| Evaluator tag | `low-27` | `low-a5` |
| Lowball rule | Ace high; straights / flushes are bad | Ace low; straights / flushes ignored |
| Best wheel treatment | `A-2-3-4-5` is penalized as a straight | `A-2-3-4-5` is the best low |
| Label prefix | `2-7 Low ...` | `A-5 Low ...` |
| CPU strategy marker | `ruleBasedD01` | `ruleBasedD02` |

D02 implementation notes:

- `DeuceToSevenTripleDrawEngine` is now the configurable shared triple-draw lowball engine.
- `AceToFiveTripleDrawEngine` is a thin variant wrapper that sets `variantId: "D02"`, `evaluatorTag: "low-a5"`, `lowType: "A5"`, and `gameId: "ace_to_five_triple_draw"`.
- `AceToFiveTripleDrawController` reuses the D01 controller surface and supplies the D02 engine, avoiding `App.jsx` changes.
- A-5 showdown labels use `A-5 Low 5-4-3-2-A` style output and preserve evaluator metadata ranks / penalty.
- The D02 CPU heuristic treats ace as low and ignores straight / flush escape logic, so made wheels pat naturally.
- D02 is registered in `src/games/core/engineRegistry.js` for future engine lookup.

D02 test coverage:

- `src/games/draw/__tests__/AceToFiveTripleDrawEngine.test.js` covers initialization, A-5 label / metadata, wheel-over-six showdown, and A-5 CPU pat decisions.
- `src/games/draw/__tests__/AceToFiveTripleDrawE2E.test.js` covers full-hand completion and one-card draw-to-wheel improvement through the controller.

完了条件:

- `D02` 実装で `D01` のコード複製を最小化できている。
- evaluator 差分だけで結果の違いを説明できる。

依存:

- `WG-03`

## 7.6 WG-05 S01 / S02 Single Draw

目的:

- triple draw family から single draw family を派生させる。

対象:

- `S01 2-7 Single Draw`
- `S02 A-5 Single Draw`

タスク:

- [x] `WG-05-01` single draw 用 street sequence を fixed する。
  - `BET -> DRAW -> BET -> SHOWDOWN`
- [x] `WG-05-02` `maxDrawRounds=1` の family 対応を追加する。
- [x] `WG-05-03` opening round / closing round の bet size と raise cap を定義する。
- [x] `WG-05-04` `S01` を `D01` から派生実装する。
- [x] `WG-05-05` `S02` を `D02` から派生実装する。
- [x] `WG-05-06` UI 表示で triple draw と single draw を誤認しないよう整理する。
- [x] `WG-05-07` Mixed / Dealer's Choice 用 metadata を追加する。

Single draw implementation notes:

- Street sequence is fixed as `BET -> DRAW -> BET -> SHOWDOWN` by using `maxDrawRounds: 1` in the shared lowball draw engine.
- Opening betting uses the small fixed-limit unit; closing betting after the single draw uses the big fixed-limit unit via `bigBetStartsAtDrawRound: 1`.
- Raise cap remains the same fixed-limit cap as D01/D02: `raiseCap: 4`.
- `DeuceToSevenSingleDrawEngine` / `DeuceToSevenSingleDrawController` add `S01` as a thin D01-derived wrapper.
- `AceToFiveSingleDrawEngine` / `AceToFiveSingleDrawController` add `S02` as a thin D02-derived wrapper.
- UI snapshots expose `variantId`, `gameId`, `maxDrawRounds`, `drawRound`, `maxDiscardCount`, and `handCardCount`, so single draw is distinguishable from triple draw without `App.jsx` changes.
- Mixed / Dealer's Choice metadata now includes `engineKey` and `status: "wip"` for `S01` / `S02` in `multiGameList.json`.

Single draw test coverage:

- `src/games/draw/__tests__/SingleDrawEngine.test.js` covers S01/S02 initialization, one-draw street sequence, closing big bet, engine registry, and mixed metadata.
- `src/games/draw/__tests__/SingleDrawE2E.test.js` covers S01/S02 controller full-hand completion through one draw and showdown.

完了条件:

- `D01/D02` の draw count 差分として `S01/S02` を自然に追加できる。

依存:

- `WG-03`
- `WG-04`

## 7.7 WG-06 Split / 特殊 Draw variants

対象:

- `D04` Badeucey TD
- `D05` Badacey TD
- `D06` Hidugi TD
- `D07` Archie TD
- `S05` Badeucey SD
- `S06` Badacey SD
- `S07` Hidugi SD
- `S03` 5-Card Single Draw
- `S04` Badugi SD

タスク:

- [x] `WG-06-01` split pot awarding の engine contract を定義する。
- [x] `WG-06-02` half-pot rounding のルールを決める。
- [x] `WG-06-03` Badeucey / Badacey 用 showdown summary を設計する。
- [x] `WG-06-04` Hidugi の high-badugi 表示を設計する。
- [x] `WG-06-05` Archie の evaluator 仕様を確定する。
- [x] `WG-06-06` 4-card draw variants と 5-card draw variants の discard UI を共通化する。

Split / special draw implementation notes:

- `src/games/core/splitPotContract.js` defines the extension contract used by future split/special draw engines.
- Badeucey uses two ordered components: `badugiLow` and `deuceToSevenLow`.
- Badacey uses two ordered components: `badugiLow` and `aceToFiveLow`.
- Half-pot odd chips use deterministic component-order rounding; for example a 101-chip Badeucey pot becomes 51 / 50.
- Component winners will later split their component amount by normal seat-order odd-chip rules.
- Badeucey / Badacey showdown summaries are normalized as `componentShowdown` with per-component evaluations and winners.
- Hidugi uses `High Badugi` display metadata and a `high-badugi` comparator contract while staying single-pot.
- Archie is fixed as a component split contract: pair-or-better high half plus 8-or-better A-5 low half.
- `resolvePot` and `resolveShowdown` now expose the same contract as TODO-ready integration points without changing active game flow.
- 4-card and 5-card draw discard selection stays on the shared `drawSelection` helper and is covered for both hand sizes.

Split / special draw test coverage:

- `src/games/core/__tests__/splitPotContract.test.js` covers Badeucey, Badacey, Hidugi, Archie, half-pot rounding, component summaries, and resolver stubs.
- `src/ui/game/__tests__/drawSelection.test.js` covers shared discard selection for 4-card and 5-card draw hands.

完了条件:

- split / special variants が同 family 上で拡張できる。

依存:

- `WG-03`
- `WG-04`
- `WG-05`

## 7.8 WG-07 Badugi RL 本番化

目的:

- Badugi RL を「学習用土台」から「実戦に使える接続済み機能」に上げる。

主要ファイル:

- `backend/app/api/badugi_rl.py`
- `backend/tests/test_badugi_rl.py`
- `src/rl/env/badugi_env.py`
- `src/rl/training/train_dqn.py`
- `src/rl/tools/export_dataset.py`
- `src/ai/onnxExecutor.js`
- `src/ai/onnxPolicyAdapter.js`
- `src/config/ai/modelRegistry.json`
- `src/config/ai/tiers.json`
- `src/ui/App.jsx`

タスク:

- [x] `WG-07-01` RL 推論の主経路を確定する。
  - frontend ONNX を正式採用
  - backend inference は比較検証と将来拡張用
- [x] `WG-07-02` observation schema v1 を固定する。
  - hand features
  - betting context
  - draw context
  - position
  - stack / pot
  - opponent summary
- [x] `WG-07-03` `BadugiEngine.getObservation()` と RL schema を一致させる。
- [x] `WG-07-04` `recordActionToLog(...)` の RL 用必須項目を固定する。
- [x] `WG-07-05` `export_dataset.py` を transition 形式に拡張する。
  - observation
  - action
  - reward
  - next_observation
  - done
  - legal_actions
- [x] `WG-07-06` `badugi_env.py` を現行ルールに寄せるか、差分を明記する。
- [x] `WG-07-07` 実 `.onnx` モデル配置の運用を決める。
  - 格納先
  - バージョン命名
  - registry 更新手順
- [x] `WG-07-08` `backend/app/api/badugi_rl.py` の stub を置換する。
- [x] `WG-07-09` `onnxPolicyAdapter.js` の feature builder を schema v1 に揃える。
- [x] `WG-07-10` tier ごとの model 割り当てを整理する。
  - `pro`
  - `iron`
  - `worldmaster`
- [x] `WG-07-11` RL decision の fallback 優先順位を決める。
  - ONNX
  - rule-based
  - deterministic safe fallback
- [x] `WG-07-12` inference integration tests を追加する。
  - model あり
  - model なし
  - invalid shape

Badugi RL implementation notes:

- Primary inference path is frontend ONNX via `src/ai/onnxPolicyAdapter.js`.
- Backend `/api/badugi/rl/decision` is now a schema v1 comparison/fallback endpoint, not the primary production inference path.
- Observation schema v1 lives in `src/rl/badugiObservationSchema.js`.
- Schema v1 vector size is `96`, matching Badugi ONNX model input shape.
- The vector includes hand shape, betting context, draw context, position, stack/pot context, opponent summary, and legal-action mask.
- `BadugiEngine.getObservation()` now returns `schemaVersion`, structured `observation`, and `stateVector`.
- `recordActionToLog(...)` already captures the required RL fields: hand/seat/phase/action/stacks/bets/pot/draw info/metadata/action id; dataset export normalizes missing vectors to schema v1 shape.
- `src/rl/tools/export_dataset.py` now emits transition records: `observation`, `action`, `reward`, `next_observation`, `done`, and `legal_actions`.
- `src/rl/env/badugi_env.py` keeps its lightweight training mechanics, but its observation space now pads the legacy first 22 slots to schema v1 `96`.
- ONNX model files should be placed under `public/models/` and referenced from `src/config/ai/modelRegistry.json` as `models/<variant>_<tier>_vN.onnx`.
- Repo-local production `.onnx` assets are required for Badugi beginner DQN / Pro / Iron / WorldMaster and must pass checksum verification under `QA-03` before release.
- Badugi tier assignment is `model-badugi-beginner-dqn-v1`, `model-badugi-pro-v1`, `model-badugi-iron-v1`, and `model-badugi-worldmaster-v1`; beginner DQN is an experimental low-tier slot, not a promotion candidate.
- Fallback priority is fixed as `ONNX -> rule-based -> deterministic safe`.

Badugi RL test coverage:

- `src/rl/__tests__/badugiObservationSchema.test.js` covers schema v1 vector shape, engine observation alignment, and deterministic fallback.
- `src/ai/__tests__/onnxPolicyAdapter.test.js` covers Badugi ONNX feature shape and tier model assignment.
- `src/ai/__tests__/onnxPolicyAdapterInference.test.js` covers model available, model missing, and invalid input shape paths.
- `backend/tests/test_badugi_rl.py` covers schema v1 request validation and backend deterministic-safe response.
- Dataset transition export was verified with a JSONL smoke command.
  - fallback

完了条件:

- frontend ONNX 主経路で実モデル推論に接続できる adapter / registry / fallback contract が揃う。
- observation / model input / dataset schema の三者が一致する。
- model 不在時も安全に fallback する。

依存:

- `WG-01`

## 7.9 WG-08 Draw系 RL 拡張

目的:

- Badugi RL のあと、2-7 / A-5 系へ観測・行動・報酬設計を広げる。

タスク:

- [x] `WG-08-01` draw family 共通 observation schema を定義する。
- [x] `WG-08-02` variant 固有 feature slot を定義する。
  - badugi
  - 2-7
  - A-5
- [x] `WG-08-03` 2-7 draw heuristic から supervised bootstrap dataset を切り出す。
- [x] `WG-08-04` `D01/D02` の暫定 CPU を RL 置換可能な形で包む。
- [x] `WG-08-05` mixed profile が variant ごとにモデルを切り替えられるようにする。

Draw RL implementation notes:

- `src/rl/drawObservationSchema.js` defines `draw-observation-v1` as a shared 96-slot schema for Badugi, 2-7, and A-5 draw families.
- Variant-specific feature slots are fixed as `badugi`, `low27`, and `lowA5` one-hot channels.
- `D01` / `S01` use the `low-27` family, and `D02` / `S02` use the `low-a5` family.
- `src/rl/drawBootstrapDataset.js` converts the existing rule-based draw heuristic into supervised bootstrap records.
- `wrapRuleBasedDrawDecision(...)` marks D01/D02 CPU choices with `replaceableByRl: true`, so ONNX can replace them later without changing the engine action contract.
- `onnxPolicyAdapter` can now build exact-shape ONNX inputs for D01/D02/S01/S02 as well as Badugi.
- `modelRegistry.json` includes variant-specific draw models for `D01/S01` and `D02/S02`, allowing mixed rotations to resolve models by variant id.

Draw RL test coverage:

- `src/rl/__tests__/drawObservationSchema.test.js` covers D01/D02 vectors, variant feature slots, fallback wrapping, and supervised bootstrap output.
- `src/ai/__tests__/onnxPolicyAdapter.test.js` covers draw ONNX feature building and D01/D02 model selection.

完了条件:

- Draw 系の RL 接続が Badugi 専用実装でなくなる。

依存:

- `WG-03`
- `WG-04`
- `WG-07`

## 7.10 WG-09 Board / Stud は後段

この文書では詳細化しすぎず、着手条件だけ固定する。

着手条件:

- `WG-01` から `WG-08` までで Draw family の再利用構造が安定していること。
- variant status と UI / engine registry の運用が定まっていること。

## 8. D01 / D02 を詰めるときの確認観点

### 8.1 ルール確認

- limit structure は何段階か
- raise cap は何回か
- heads-up 時の blind / button 例外をどうするか
- draw 時に全員 pat/all-in/fold のとき何を skip するか

### 8.2 UI 確認

- 5 枚 draw の discard 選択はモバイルでも成立するか
- pat 表示は独立ボタンにするか
- replaced cards を hand history でどこまで見せるか

### 8.3 Logging / replay 確認

- discard 前 hand と discard 後 hand の両方を保存するか
- hand history には隠すが replay には使う情報をどう持つか
- split pot のときどの evaluator 結果を winners に載せるか

### 8.4 RL 確認

- draw action は「discard index 配列」か「discard count」か
- legal actions は action mask で持つか
- reward は hand 終了時だけか、shape 付きか

## 9. 推奨実装順

### Phase A

- `WG-BADUGI-00`
- `WG-BADUGI-01`
- `WG-00`
- `WG-01`
- `WG-02`

### Phase B

- `WG-07`
- `WG-03`
- `WG-04`

### Phase C

- `WG-05`
- `WG-06`

### Phase D

- `WG-08`

## 10. 1スプリント単位の着手案

### Sprint 1

- `WG-BADUGI-00-01` から `WG-BADUGI-00-04`
- `WG-BADUGI-01-01` から `WG-BADUGI-01-05`
- `WG-00-01` から `WG-00-04`
- `WG-01-01` から `WG-01-03`
- `WG-02-01` から `WG-02-03`

成果物:

- Badugi 優先方針の固定
- Badugi bug tracker 運用開始
- 正本整理
- draw family contract 草案
- 2-7 / A-5 evaluator 強化テスト

### Sprint 2

- `WG-01-04` から `WG-01-07`
- `WG-07-01` から `WG-07-04`
- `WG-03-01` から `WG-03-10`

成果物:

- draw family 共通基盤
- Badugi RL schema 草案
- `D01` engine 初版

### Sprint 3

- `WG-03-11` から `WG-03-23`
- `WG-04-01` から `WG-04-05`

成果物:

- `D01` playable
- `D02` playable

### Sprint 4

- `WG-05`
- `WG-07-05` から `WG-07-12`

成果物:

- single draw family
- Badugi RL 本番接続

## 11. 完了の定義

### variant 完了

以下を満たしたら「実装済み」とする。

- engine が registry に登録されている
- controller が UI snapshot を返せる
- evaluator が対応している
- hand history に必要項目が残る
- CPU が最低限行動できる
- unit test がある
- 1 本以上の e2e / integration テストがある
- `multiGameList.json` の status が `live` または `wip` に更新されている

### RL 完了

以下を満たしたら「本番接続済み」とする。

- stub ではない
- schema が固定されている
- model registry と実 asset が一致する
- fallback が定義されている
- inference integration test が通る

## 12. 次に着手する具体タスク

優先順:

- [x] `WG-BADUGI-00-02` Badugi bug tracker を正本として運用開始
- [x] `WG-BADUGI-01-02` 再現環境の記録項目を固定
- [x] `WG-00-01` 「30ゲーム」表記を 35 variants に更新
- [x] `WG-01-01` Draw family state contract を固定
- [x] `WG-02-01` 2-7 lowball edge case テスト追加
- [x] `WG-07-01` RL 推論の主経路を確定

## 12.1 追加監査で見つかった確認項目

チェックリスト上の WG / Step タスクは完了している。ただし「本番投入前の確認」または「文書と実装の整合性」として、以下を追う。

- [x] `QA-01` `multiGameList.json` の `D01` / `D02` status を実装状況に合わせて `wip` へ更新する。
  - `D01`: `engineKey: "deuce_to_seven_triple_draw"`
  - `D02`: `engineKey: "ace_to_five_triple_draw"`
  - `live` 判定は UI 本格接続と実機 smoke 完了後に行う。
- [x] `QA-02` `src/games/core/variants.js` の controller registry 方針を確認する。
  - Badugi に加え、`D01` / `D02` / `S01` / `S02` 相当の controller factory を登録済み。
  - UI の variant picker への本格接続は別フェーズ。
- [x] `QA-03` model registry と実 `.onnx` asset の一致を確認する。
  - `modelRegistry.json` に Badugi / draw 系モデル定義はあるが、production `.onnx` asset は repo 内に未配置。
  - `public/models/README.md` に fallback 前提と release checklist を明記。
- [x] `QA-04` backend `/api/badugi/rl/decision` の位置付けを確認する。
  - frontend ONNX を主経路とする。
  - backend endpoint は schema v1 validation と deterministic-safe fallback を持つ比較検証 / 将来拡張 endpoint とする。
- [ ] `QA-05` 実ブラウザ / 実スマホで Badugi / D01 / D02 / S01 / S02 の smoke test を実施する。
  - Automated desktop smoke: title screen -> signup -> login -> ring game -> bet action -> card select -> draw is verified with headless Chromium.
  - Playwright entry helpers now use the current `Press Enter` title button and authenticated menu flow.
  - Local API / DB health was verified through `/api/health` via both frontend proxy and backend direct path.
  - Badugi は `badugi-flow` / authenticated smoke / MTT smoke の Playwright 自動確認済み。
  - D01 / D02 / S01 / S02 は engine / controller / Vitest e2e / App URL route / headless desktop browser smoke まで確認済み。
  - D01 / D02 / S01 / S02 用の `DrawLowballUIAdapter` と adapter registry alias を追加し、5-card draw snapshot を table props へ変換できることを確認済み。
  - 2026-04-30 更新: `?variant=D01` / `?variant=D02` の App routing から ring game を起動し、5-card 表示、BET進行、DRAW control、カード選択、Draw Selected 実行まで Playwright smoke 済み。
  - 2026-04-30 更新: `D01` / `D02` / `S01` / `S02` は App route から hand result / next hand まで Playwright smoke 済み。`D01` は Main Menu variant picker からの起動も確認済み。
  - 2026-04-30 更新: mobile emulation smoke を追加。portrait は game 起動時に orientation gate、landscape は Badugi / D01 の card select -> Draw Selected を確認済み。
  - 2026-04-30 更新: orientation gate に `横向き表示を試す` ボタンを追加。対応ブラウザでは fullscreen + `screen.orientation.lock("landscape")` を試行し、iOS Safari など非対応環境では手動回転案内に fallback する。
  - Desktop Chrome: ring game 5 hand 以上。
  - Mobile Safari または Android Chrome: portrait / landscape で discard、pat、overlay、hand result を確認。
  - 結果は `docs/bugs/badugi_browser_mobile_bug_tracker.md` または別 QA 記録へ残す。
- [x] `QA-06` `dealToBoards` / `resolvePot` / `resolveShowdown` の TODO-ready stub を、次フェーズで実ロジックへ接続する範囲を決める。
  - Step 1 の完成条件では入口作成までが対象。
  - Double Board / hi-lo / split pot を実ゲーム接続する前に、evaluator registry、side pot、board-by-board award を同時に接続する。
- [x] `QA-07` production API smoke を確認する。
  - `/api/variants`
  - `/api/variants/double_board_bomb_pot_omaha`
  - `/api/badugi/rl/decision`
  - nginx / backend / frontend の reverse proxy 経路で確認する。
  - local TestClient smoke is verified by `backend/tests/test_variants_api.py` and `backend/tests/test_badugi_rl.py`.
  - 2026-05-01 production reverse proxy smoke:
    - `GET https://mgx-poker.com/api/health` は `200` / `{"status":"ok","env":"prod","db":"ok"}`。
    - `GET https://mgx-poker.com/api/variants` は `200`。`badugi` / `nl_holdem` / `limit_holdem` / `plo` / `double_board_bomb_pot_omaha` を含む。
    - `GET https://mgx-poker.com/api/variants/double_board_bomb_pot_omaha` は `200`。`boards.count=2`、`betting.hasPreflop=false`、`forced_bets.type=bombPot`。
    - `POST https://mgx-poker.com/api/badugi/rl/decision` は未認証では `401`、production smoke 用 E2E user で signup/login 後 Bearer token 付きでは `200`。`action=call`、`source=deterministic-safe`、`vector_size=96`、`fallback_order=["onnx","ruleBased","deterministicSafe"]`。
- [x] `QA-08` Badugi を自動 smoke 上で完了扱いにするための最終テストを実施する。
  - 目的: 自動テスト上は主要導線が通っているため、運用目線の desktop / mobile emulation / 回帰確認で自動 smoke 完了判定する。
  - 完了条件:
    - Desktop Chromium headless で login -> ring game -> Badugi flow regression を連続実行できる。
    - 自動テスト内で bet / call / raise / fold / draw selected / pat / showdown / next hand を確認する。
    - hero fold 後に追加操作ができないこと、folded player が winner にならないことを確認する。
    - fixed-limit raise cap 到達後に追加 raise / bet が出ない、または押しても無効であることを確認する。
    - hand result overlay、hand history、next hand 後の folded / selected / lastAction reset を確認する。
    - Mobile emulation landscape でカードが隠れず、select -> Draw Selected ができる。
    - Mobile emulation portrait では orientation gate が出る。
    - 確認結果を `docs/bugs/badugi_browser_mobile_bug_tracker.md` に記録する。
  - 完了後:
    - Badugi は本文書上で `automated smoke complete` として扱う。
    - 物理端末の iPhone Safari / Android Chrome は `OP-10` / `BG-005` の手動 QA 残件として扱う。
  - 2026-04-30 確認:
    - `npm test -- --run src/ui/__tests__/AppInitialization.test.jsx src/games/__tests__/badugiEngine.test.js src/games/badugi/logic/__tests__/roundFlow.test.js src/games/badugi/engine/__tests__ src/games/badugi/__tests__` は `11 passed / 80 passed`。
    - `npm run lint` は `0 errors / 0 warnings`。
    - `npm run build` は成功。chunk size warning は残るが build 失敗ではない。
    - `npx playwright test tests/e2e/badugi-flow.spec.ts tests/e2e/authenticated-game-smoke.spec.ts tests/e2e/badugi-mtt-flow.spec.ts tests/e2e/mobile-app-smoke.spec.ts --project=badugi-flow` は `22 passed`。
- [x] `QA-09` D01 / D02 / S01 / S02 を Badugi と同等レベルの自動テスト対象に引き上げる。
  - 目的: 2-7 だけでなく A-5 / single draw も、Badugi と同じ観点で壊れていないことを担保する。
  - 対象:
    - `D01` 2-7 Triple Draw
    - `D02` A-5 Triple Draw
    - `S01` 2-7 Single Draw
    - `S02` A-5 Single Draw
  - 必須自動テスト観点:
    - title -> auth -> variant picker -> ring game 起動。
    - URL alias 起動。
    - bet / call / raise / fold の action progression。
    - raise cap 到達後の追加 bet / raise 抑止。
    - hero fold 後の追加操作抑止、folded winner 除外。
    - draw selected / pat / max discard count。
    - D01 / D02 は 3 draw round、S01 / S02 は 1 draw round で showdown へ進む。
    - D01 / S01 は 2-7 low label、D02 / S02 は A-5 low label が result / history に出る。
    - hand result -> next hand 後に selected / folded / lastAction が reset される。
    - mobile landscape で 5-card hand が footer に隠れず、select -> Draw Selected ができる。
  - 必須確認コマンド:
    - `npm test -- --run src/games/draw`
    - `npm test -- --run src/ui/game/draw src/ui/game/__tests__/appVariantRouting.test.js`
    - `npx playwright test tests/e2e/draw-lowball-app-smoke.spec.ts --project=badugi-flow`
    - `npx playwright test tests/e2e/mobile-app-smoke.spec.ts --project=badugi-flow`
  - 完了後:
    - `D01` / `D02` / `S01` / `S02` の catalog status を `wip` から上げるかは、実機 smoke と hand history / replay の完了後に判断する。
  - 2026-04-30 確認:
    - `npm test -- --run src/games/draw` は `7 files / 43 tests passed`。D01/D02/S01/S02 engine/controller、raise cap、fold win、showdown label を確認。
    - `npm test -- --run src/games/draw src/ui/game/draw src/ui/game/__tests__/appVariantRouting.test.js src/ui/utils/__tests__/handHistory.test.js` は `10 files / 56 tests passed`。hand history / replay 用 low metadata まで確認。
    - `npm test -- --run src/ui/game/draw src/ui/game/__tests__/appVariantRouting.test.js` は `2 files / 7 tests passed`。UI adapter と URL alias routing を確認。
    - `npx playwright test tests/e2e/draw-lowball-app-smoke.spec.ts --project=badugi-flow` は `5 passed`。D01/D02/S01/S02 の App routing、hand result、next hand、history low label を確認。
    - `npx playwright test tests/e2e/mobile-app-smoke.spec.ts --project=badugi-flow` は `6 passed`。portrait orientation gate、Badugi/D01/D02/S01/S02 mobile landscape draw 操作を確認。
- [x] `QA-10` CPU 強さ / P2P / CPU対戦後フォローアップの未完成範囲を実装タスクへ分解する。
  - CPU 強さ:
    - tier config / policy routing / model routing / ONNX adapter は実装済み。
    - production `.onnx` asset は Badugi Pro / Iron / WorldMaster が bootstrap。再設計後50k DQN は WorldMaster 相当とは判定せず、Badugi beginner DQN として最弱/実験枠に降格。
    - [x] `AI-01` Badugi の App CPU BET を `policyRouter` に接続し、tier ごとの fold / call / raise 差分を使う。
    - [x] `AI-02` Badugi の App CPU DRAW を `policyRouter` に接続し、deadCards 優先で交換 index を選ぶ。
    - [x] `AI-03` `drawAggression` の符号を整理し、強い tier が不要な overdraw をしないようにする。
    - [x] `AI-04` production `.onnx` asset を配置し、model registry の checksum / version と一致させる。
      - 2026-05-01 更新: `src/config/ai/modelRegistry.json` に `version` / `checksumSha256` / `productionRequired` を追加し、Badugi Beginner DQN / Pro / Iron / WorldMaster を production-required として明示。
      - 2026-05-01 更新: `scripts/verifyAiModelAssets.mjs` と `npm run ai:verify-models` を追加。実 `.onnx` 配置後は SHA-256 と registry checksum が一致しない限り失敗する。
      - 2026-05-01 更新: `scripts/installAiModelAssets.mjs` と `npm run ai:install-models` を追加。`--model model-id=/path/file.onnx` または `--source-dir /path/to/models --required-only` で供給された実 `.onnx` を `public/models/` へコピーし、registry checksum を自動更新できる。
      - 2026-05-01 更新: `src/rl/training/build_badugi_bootstrap_onnx.py` と `npm run ai:build-bootstrap-models` を追加し、Badugi Pro / Iron / WorldMaster の bootstrap ONNX を生成。
      - 2026-05-01 更新: `public/models/badugi_pro_v1.onnx` / `badugi_iron_v1.onnx` / `badugi_worldmaster_v1.onnx` を生成し、registry checksum と一致することを `npm run ai:verify-models` で確認。
      - 2026-05-01 更新: `public/models/badugi_beginner_dqn_v1.onnx` を追加。これは `rl/models/badugi_masked_long_20260501/badugi_dqn_latest.pt` から export した50k DQNだが、評価上は WorldMaster ではないため beginner tier のみに接続。
      - 2026-05-02 更新: evaluator / draw phase 修正後の `badugi_envfix_beginner_probe_3k_20260502` を `public/models/badugi_beginner_dqn_v1.onnx` へ再export。`model-badugi-beginner-dqn-v1` checksum は `c8a3bb...`。
    - [x] `AI-05` ONNX unavailable 時の fallback smoke と、ONNX available 時の推論 smoke を分けて記録する。
      - `src/ai/__tests__/onnxFallbackSmoke.test.js` は missing ONNX session -> `policy-router` -> deterministic-safe の fallback 順を確認。
      - `src/ai/__tests__/onnxPolicyAdapterInference.test.js` は mock ONNX session available 時の推論 decode を確認。
    - [x] `AI-06` tier ごとの実戦 smoke を行い、Beginner / Standard / Pro / WorldMaster で VPIP / PFR / drawCount / showdown 勝率の差を見る。
      - [x] `AI-06a` `src/ai/tierPolicySmoke.js` / `src/ai/__tests__/tierPolicySmoke.test.js` で raiseRate / averageDrawCount / madeBadugiPatRate の tier 差を確認。
      - [x] `AI-06 practice smoke` `runBadugiTierPracticeSmoke()` で短期 heads-up practice hand を回し、VPIP / PFR / averageDrawCount / showdownWinRate の tier 差を確認。
        - Beginner / Standard / Pro / WorldMaster の fallback/rule-based policy で、WorldMaster は Beginner より PFR と showdownWinRate が高く、Pro 以上は drawCount が増えすぎないことを固定。
      - [x] `AI-06b` showdown 勝率は production `.onnx` 配置後に長期 simulation として拡張する。
        - 2026-05-01 更新: `npm run ai:train-badugi` と `npm run ai:export-badugi-onnx` を追加。短時間DQN smokeで checkpoint 作成、ONNX export、`onnx.checker` 検証まで確認。
        - 2026-05-01 確認: `npm run ai:train-badugi -- --episodes 3 --max-steps 20 --warmup-steps 1 --batch-size 2 --log-interval 1 --save-interval 0 --output-dir /tmp/mgx-badugi-rl-smoke --device cpu` は成功。
        - 2026-05-01 確認: `npm run ai:export-badugi-onnx -- --checkpoint /tmp/mgx-badugi-rl-smoke/badugi_dqn_latest.pt --output /tmp/mgx-badugi-rl-smoke/badugi_worldmaster_smoke.onnx --no-update-registry` は成功し、出力ONNXは 96 input / 6 output。
        - 2026-05-01 追加: `npm run ai:evaluate-badugi-onnx` を追加し、実 `.onnx` を ONNX Runtime でロードして Badugi 環境上の avgReward / showdownWinRate / actionCounts を記録できるようにした。
        - 2026-05-01 不具合修正: `BadugiEnv` の fold 終端、`last_result` reset、同枚数Badugiの低ランク比較を修正。旧環境で作った50k checkpointは本番昇格せず、修正後環境で再学習する。
        - 2026-05-01 確認: `PYTHONPATH=src .venv/bin/python -m unittest src.rl.__tests__.test_badugi_env` は `7 tests passed`。
        - 2026-05-01 確認: 旧50k checkpoint を export したONNXは `npm run ai:evaluate-badugi-onnx -- --model public/models/badugi_worldmaster_v1.onnx --episodes 500 --max-steps 200 --seed 20260501` で実ロードできたが、showdownWinRate が低く、修正前環境由来のため採用しない。
        - 2026-05-01 確認: 修正後環境の 300 episodes smoke training / ONNX export / `npm run ai:evaluate-badugi-onnx -- --model /tmp/mgx-badugi-rl-fixed-smoke/badugi_worldmaster_fixed_smoke.onnx --episodes 100 --max-steps 100 --seed 20260501` は成功。
        - 2026-05-01 追加修正: `BadugiEnv` の terminal showdown reward、fold罰、action 5 の limit raise alias 化、player draw の strategic discard、`train_every_steps` を追加。
        - 2026-05-01 確認: `npm run ai:train-badugi -- --episodes 50000 --max-steps 200 --warmup-steps 10000 --batch-size 64 --log-interval 1000 --save-interval 5000 --output-dir rl/models/badugi_strategic_draw_fast_20260501 --train-every-steps 4 --device cpu` は完走。summary は `episodes=50000`, `global_steps=418846`, `avg_reward_last_100=-0.7625`。
        - 2026-05-01 確認: 50k checkpoint export は成功。`npm run ai:evaluate-badugi-onnx -- --model /tmp/mgx-badugi-fast-latest.onnx --episodes 2000 --max-steps 200 --seed 20260502` は `showdownWinRate=0.146`。
        - 2026-05-01 比較: 現行 bootstrap WorldMaster は同条件で `showdownWinRate=0.157`。50k DQN は bootstrap を上回らなかったため、`public/models/badugi_worldmaster_v1.onnx` へは昇格しない。
        - 2026-05-01 再設計: DQN action index を frontend `BADUGI_RL_ACTIONS` に揃え、BET/DRAW の `legal_action_mask()`、mask付きepsilon-greedy、mask付きDouble DQN target、ONNX評価時mask、frontend ONNX decode maskを追加。
        - 2026-05-01 再設計: opponent model をランダム寄りからhand strength連動の call / raise / fold に変更し、showdown勝敗を重く、fold勝ちを軽めにするrewardへ調整。
        - 2026-05-01 確認: `npm run ai:train-badugi -- --episodes 5000 --max-steps 200 --warmup-steps 1000 --batch-size 64 --log-interval 1000 --save-interval 0 --output-dir rl/models/badugi_masked_probe_20260501 --train-every-steps 4 --device cpu` は成功。
        - 2026-05-01 確認: `npm run ai:evaluate-badugi-onnx -- --model /tmp/mgx-badugi-masked-probe.onnx --episodes 500 --max-steps 200 --seed 20260501` は `showdownWinRate=0.186`。前回50k DQNの `0.146` と bootstrap比較値 `0.157` を短期probeでは上回った。
        - 2026-05-01 確認: `npm run ai:train-badugi -- --episodes 50000 --max-steps 200 --warmup-steps 10000 --batch-size 64 --log-interval 1000 --save-interval 5000 --output-dir rl/models/badugi_masked_long_20260501 --train-every-steps 4 --device cpu` は完走。summary は `episodes=50000`, `global_steps=352089`, `avg_reward_last_100=-1.6120`。
        - 2026-05-01 確認: `npm run ai:evaluate-badugi-onnx -- --model /tmp/mgx-badugi-masked-long-latest.onnx --episodes 2000 --max-steps 200 --seed 20260502` は `avgReward=-1.562`, `showdownWinRate=0.246`, `showdowns=1257`, `folds=743`。
        - 2026-05-01 比較: 同条件の bootstrap WorldMaster は `avgReward=-1.750`, `showdownWinRate=0.157`, `showdowns=2000`, `folds=0`。50k DQN は baseline を上回ったが、`avgReward=-1.562` と負け越しで、`folds=743/2000` も多い。WorldMaster / Iron / Pro へは不適切。
        - 2026-05-01 是正: 50k DQN を `public/models/badugi_beginner_dqn_v1.onnx` / `model-badugi-beginner-dqn-v1` へ降格し、`public/models/badugi_worldmaster_v1.onnx` は bootstrap checksum `5be226...` に戻した。
        - 2026-05-01 是正: `resolveTierModelInfo()` は variant+tier 完全一致を generic tier model より優先する。これにより D03 beginner だけ DQN を使い、他variantの beginner は従来どおり `model-generic-v1` を使う。
        - 2026-05-01 確認: `npm run ai:verify-models` は Badugi Beginner DQN / Pro / Iron / WorldMaster required asset 全てOK。
        - 2026-05-01 確認: `npm run ai:evaluate-badugi-onnx -- --model public/models/badugi_beginner_dqn_v1.onnx --episodes 500 --max-steps 200 --seed 20260502` は `avgReward=-1.507`, `showdownWinRate=0.254`, `showdowns=335`, `folds=165`。
        - 2026-05-02 再学習: evaluator / draw phase 修正後、`teacher_warmup=1000`, `imitation_pretrain=500`, `expert_replay_ratio=0.25` で 3k probe を実行。checkpoint評価は `avgReward=0.116`, `showdownWinRate=0.670`, `foldRate=0.190`, `recommendedTier=standard`。ただし段階導入のためまず beginner ONNX に反映。
        - 2026-05-02 確認: 更新後 `public/models/badugi_beginner_dqn_v1.onnx` は balanced 300 episodes で `avgReward=-0.181`, `showdownWinRate=0.600`, `showdowns=250`, `folds=50`。
        - 2026-05-02 修正: `BadugiEnv._cap_shaping_reward()` が正の shaping reward を 0 に潰していたため、良いvalue bet / pat / call の学習信号が消えていた。上限を `[-1.0, 1.0]` に変更し、unit test を更新。
        - 2026-05-02 確認: 修正後の `badugi_positive_shaping_probe_5k_20260502` は学習終盤 `avg_reward=0.661`、ONNX gate は短縮条件で PASS。ただし default gate は `avgRewardDeltaVsBaseline=0.2435` で `0.25` にわずかに届かず昇格保留。
        - 2026-05-02 確認: 修正後の `badugi_positive_shaping_probe_10k_20260502` は学習終盤 `avg_reward=0.874`。default gate は `candidateAvgReward=0.717`, `showdownWinRate=0.612`, `foldRate=0.187`, `avgRewardDeltaVsBaseline=0.3133` で PASS、`recommendedTier=standard`。
        - 2026-05-02 反映: `badugi_positive_shaping_probe_10k_20260502/badugi_dqn_latest.pt` を `/tmp/mgx-badugi-positive-shaping-10k.onnx` へ export し、`model-badugi-standard-dqn-v2` / `public/models/badugi_standard_dqn_v2.onnx` に反映。checksum は `22899fc71e9e48b345fa1ec1ec025bf0e71a7ea6f30d4c31f18e54d9f04b067c`。
        - 2026-05-02 ルーティング修正: 通常 `D03 + standard` が古い `model-badugi-standard-dqn-v1` を選ぶ可能性を排除し、`model-badugi-standard-dqn-v2` を通常Standard経路へ昇格。v1は `legacy` / optional とし、live CPU へはルートしない。
        - 2026-05-02 ルーティング修正: `model-badugi-beginner-dqn-v1` は現行 evaluator/draw 修正後だが positive shaping cap 修正前の学習断面なので `legacy` / optional とし、通常Beginner CPUから外す。Beginnerは current-env beginner-strength model を別途作るまでは generic/rule-based fallback とする。
        - 2026-05-02 方針: 今後は各ONNXに `trainingRun`, `trainingStatus`, `trainingNotes`, checksum を持たせ、どの評価器・報酬・opponent profile・gateで学習したかを追跡できるものだけを live route に入れる。
        - 2026-05-01 確認: `npm run ai:evaluate-badugi-onnx -- --model public/models/badugi_worldmaster_v1.onnx --episodes 500 --max-steps 200 --seed 20260502` は bootstrap として `avgReward=-1.749`, `showdownWinRate=0.156`, `showdowns=500`, `folds=0`。
        - 2026-05-01 確認: AI routing tests / BadugiEnv unittest / `npm run lint` / `npm run build` は成功。
        - 2026-05-01 追加: `npm run ai:gate-badugi-model` を追加し、候補ONNXが `avgReward`, `showdownWinRate`, `foldRate`, baseline差分の昇格ゲートを満たさなければ non-zero exit で止める。
        - 2026-05-01 確認: `npm run ai:gate-badugi-model -- --candidate public/models/badugi_beginner_dqn_v1.onnx --baseline public/models/badugi_worldmaster_v1.onnx --episodes 200 --report-only` は FAIL。現DQNは次tier昇格不可。
        - 残件: Pro / Iron / WorldMaster へ昇格するには、複数 opponent profile で `avgReward >= 0` などの明確な昇格ゲートを満たす再学習済みモデルを用意する。
      - [x] `AI-06c` Badugi gate を複数 opponent profile 対応に拡張し、random / tight-passive / aggressive / pat-heavy / draw-heavy / rule-based baseline を同一CLIで評価する。
        - 2026-05-01 更新: `BadugiEnv` に opponent profile を追加。`random`, `balanced`, `loose_passive`, `loose_aggressive`, `tight_passive`, `tight_aggressive`, `pat_heavy`, `draw_heavy` を切り替えられる。
        - 2026-05-01 更新: `npm run ai:train-badugi` は `--opponent-profiles` で profile round-robin 学習が可能。
        - 2026-05-01 更新: `npm run ai:evaluate-badugi-onnx` / `npm run ai:gate-badugi-model` も opponent profile 指定に対応。gate は複数 profile x 複数 seed で集計する。
        - 2026-05-01 更新: reward をチップEV寄りに調整。showdown / opponent fold は stack delta を加味し、弱手foldは軽罰、強手foldは重罰に分離。強い4-card Badugiのvalue bet/raiseを加点し、弱手raise/callを減点する。
        - 2026-05-01 確認: profile mix 10k probe は `avg_reward_last_100=-1.6143`。ONNX gate は現 beginner DQN比で `avgRewardDelta=+0.0979` だが `showdownWinRate=0.179` と低く、次tierへは昇格しない。
      - [x] `AI-06c-2` profile mix で 50k+ 再学習を回し、showdownWinRate を落とさず avgReward を改善する。候補は gate PASS まで public model へ反映しない。
        - 2026-05-01 実行: `npm run ai:train-badugi -- --episodes 50000 --max-steps 160 --warmup-steps 10000 --batch-size 64 --epsilon-decay-episodes 35000 --epsilon-end 0.05 --log-interval 1000 --save-interval 10000 --output-dir rl/models/badugi_street_profile_50k_20260501 --train-every-steps 4 --opponent-profiles balanced,loose_passive,loose_aggressive,tight_passive,tight_aggressive,pat_heavy,draw_heavy --device cpu` は完走。
        - 2026-05-01 結果: 50k 終盤は 45k 時点で `avg_reward=0.025`、50k 時点で `avg_reward=-0.163`、summary は `avg_reward_last_100=-0.6299`。
        - 2026-05-01 評価: `/tmp/mgx-badugi-street-profile-50k.onnx` は multi-profile gate で `candidateAvgReward=1.633`, `showdownWinRate=0.283`, `foldRate=0.277`。beginner DQN比 `avgRewardDelta=0.7100`、WorldMaster bootstrap比 `0.8475`。
        - 2026-05-01 判定: avgReward は勝ち越しだが showdownWinRate が Pro/Iron/WorldMaster gate の `0.35` 未満。`model-badugi-standard-dqn-v1` / `public/models/badugi_standard_dqn_v1.onnx` として standard tier にのみ昇格し、上位tierには入れない。
      - [x] `AI-06c-3` Badugi RL observation / reward に starting hand、position、fixed-limit pot odds を明示し、降りすぎ・押しすぎを抑える。
        - 2026-05-01 更新: `BadugiEnv._get_obs()` が frontend schema と同じ 22-31 slot に made cards / rank sum / high card / duplicate counts / startingHandStrength / potOdds / position / toCall / oneAway を出す。
        - 2026-05-01 更新: action mask も 32-37 slot に出すため、training env / frontend ONNX feature が揃う。
        - 2026-05-01 更新: fixed-limit の薄い価格では marginal draw をcall寄りにし、強い手のfoldと弱手raiseをより重く減点する。
        - 2026-05-01 更新: bootstrap ONNX generator も starting hand / pot odds / position feature を参照するようにした。既存 public model は gate PASS まで再生成しない。
        - 2026-05-01 確認: feature probe 1500 episodes は `avg_reward_last_100=-1.1723`。ONNX gate は現 beginner DQN比で `avgRewardDelta=+0.0646`, WorldMaster bootstrap比で `+0.1068` まで改善したが、`showdownWinRate=0.158` のため昇格しない。
        - 残件: 長期学習では `avgReward` だけでなく `showdownWinRate` を落とさないよう、showdown value / draw quality の reward を追加検討する。
      - [ ] `AI-06d` current-env Beginner DQN を作り直す。条件: Standardより明確に弱く、ただし破綻しない。古いDQN断面は使わない。
      - [x] `AI-06e` current-env Standard 50k を回し、10k v2を上回るか評価する。条件: default gate PASS、Standard相当の体感強度、過剰fold/過剰bluffなし。
        - 2026-05-02 実行: `badugi_positive_shaping_standard_50k_20260502` を `episodes=50000`, `teacher_warmup=1000`, `imitation_pretrain=500`, profile mix `balanced,loose_passive,loose_aggressive,tight_passive,tight_aggressive,pat_heavy,draw_heavy` で学習。
        - 2026-05-02 結果: 50k学習は完走。学習ログは 30k `avg_reward=0.342`, 35k `0.505`, 47.5k `0.603`, 50k `0.362`。summary は `episodes=50000`, `global_steps=303090`, `avg_reward_last_100=0.7615`。
        - 2026-05-02 checkpoint比較: 現行 `public/models/badugi_standard_dqn_v2.onnx` をbaselineに、10k/20k/30k/40k/50k checkpointをONNX exportして評価。短縮評価では10k checkpointが最良で `avgReward=0.857`, `showdownWinRate=0.570`, `foldRate=0.100`, `avgRewardDeltaVsBaseline=+0.084`。
        - 2026-05-02 default gate: run内最良10k checkpointは `candidateAvgReward=0.787`, `showdownWinRate=0.571`, `foldRate=0.112`, `avgRewardDeltaVsBaseline=+0.0699` で baseline差分ゲート未達。50k checkpointは `candidateAvgReward=0.436`, `showdownWinRate=0.649`, `foldRate=0.306`, `avgRewardDeltaVsBaseline=-0.2808` で未達。
        - 2026-05-02 判定: 50k run は現行 `standard-dqn-v2` を明確に上回らないため、public model へは反映しない。現行10k v2をStandardとして維持する。
        - 2026-05-02 分析: 50k は `showdownWinRate` が上がる一方で `foldRate` も上がり、平均報酬が落ちた。これは「勝てるショーダウンだけ残す」方向へ寄りすぎ、fixed-limit の安い call / draw equity / fold equity をチップEVとして拾えていない可能性が高い。
        - 2026-05-02 分析: 現在のEQは `_street_adjusted_strength`, `one_draw_top_half_probability`, `potOdds`, opponent tendency の proxy であり、hand vs range の明示的な equity / EV 計算ではない。次の改善では `callEV = equity * potAfterCall - callCost`、`raiseEV = foldEquity * pot + callContinueEV - extraCost` のような教師・reward・評価ログを追加する。
        - 2026-05-02 分析: 30k以降は `showdownWinRate` が 0.67-0.69 まで上がったが foldRate も 0.27-0.33 まで悪化。特に tight profile 相手に fold が増えすぎているため、pat pressure / aggression に対する過剰foldを抑える reward と teacher correction が必要。
      - [ ] `AI-06f` Pro以降は 6-max training / evaluation を追加し、position / multiway pot / FT chip pressure を含めて学習する。
        - 2026-05-02 方針: Standard は現行 future value v3 で実装済み扱い。Pro以降は heads-up gate ではなく `--table-size 6` の6-max文脈で学習・評価する。
        - 2026-05-02 更新: `BadugiEnv(table_size=6)` を追加。完全な6人個別showdownではなく、hero vs 主要相手に対して他4 seat の dead money / position pressure / reduced fold equity / tighter semi-bluff incentive を入れる aggregate 6-max 近似として開始する。
        - 2026-05-02 更新: `train_dqn.py`, `evaluate_badugi_onnx.py`, `gate_badugi_model.py` に `--table-size` を追加。Pro候補は `--table-size 6` で学習・gateする。
        - 2026-05-02 smoke: `badugi_sixmax_pro_probe_1k_20260502` は `--table-size 6` で完走し、学習ループ・ONNX入力・position/multiway pressure が動作することを確認。
        - 2026-05-02 評価: `badugi_sixmax_pro_probe_10k_20260502` は6-max gateで現行Pro bootstrap比 `avgRewardDelta=+0.386` と改善。ただしtier promotion上のPro閾値 `+0.5` 未達。Standard v3比は `+0.168` で、Standardとの差も十分ではないためPro本番へ未反映。
        - 2026-05-02 評価: `badugi_sixmax_pro_probe_20k_20260502` はStandard v3比 `avgRewardDelta=+0.060` まで低下。長く回すだけでは改善せず、actionCounts は bet がほぼ出ず call/check に寄る。Pro化には value bet / isolation raise / late-position semi-bluff の教師・reward強化が必要。
        - 2026-05-02 更新: 6-max teacher/reward に「強いmade handのvalue bet」「late positionのsemi-bluff」「複数相手に対するisolation raise」を追加。初回10k評価後、no-call時は action 3 の bet を優先し、to-call時だけ action 4 の raise を使うように追加補正して、評価ログの actionCounts が読める形へ寄せた。
        - 2026-05-02 評価: `badugi_sixmax_pro_value_probe_10k_20260502` を `--table-size 6`, profile mix, teacher warmup / imitation / expert replay 付きで10k学習。Standard v3比は `avgRewardDeltaVsBaseline=+0.180`, `avgReward=2.771`, `showdownWinRate=0.615`, `foldRate=0.178`。前回10kの `+0.168` から微改善したが、Pro昇格基準 `+0.25` 以上には届かないため public model へは未反映。bet/raise alias 補正後の長期probeは次回実行する。
        - 残件: Pro候補は value bet / semi-bluff / isolation の行動頻度を増やせたかを actionCounts で確認し、20k checkpoint評価で Standard v3 に対して安定して `+0.25` 以上を取るまで昇格しない。
        - 2026-05-02 原因対策: 6-maxで first-in の bet 学習サンプルが不足していた。training env が各BET streetを常に `current_bet = betSize` で始め、teacher warmup がほぼ facing-bet の call/fold/raise だけを学習していたため、value bet / semi-bluff を入れても open bet が育ちにくかった。
        - 2026-05-02 更新: 6-max betting round 開始時に、hero position と opponent profile から「相手が先にopen済みの局面」と「heroにcheckで回った局面」を分岐する `_start_betting_round()` を追加。no-call時の legal action から raise alias を外し、check/bet のみにした。
        - 2026-05-02 更新: range equity proxy / isolation pressure / late semibluff spot を observation slot 58-60 に追加。既存 `badugi-observation-v1-ev` モデルには slot 58-60 を渡さず、新feature set `badugi-observation-v1-ev-range` 候補だけが使うよう `onnxPolicyAdapter` / evaluator / gate に feature-set 指定を追加。
        - 2026-05-02 smoke: `badugi_sixmax_open_spot_probe_2k_20260502` を2k学習。短縮6-max gateは Standard v3 比 `avgRewardDeltaVsBaseline=+0.710`, `avgReward=2.335`, `showdownWinRate=0.736`, `foldRate=0.218` で PASS、promotion report は `recommendedTier=pro`。actionCounts は各profileで `action 3` が出るよう改善。ただし2k短縮評価のため public model へはまだ未反映。次は20k checkpoint評価で再現性を確認する。
        - 2026-05-02 学習: `badugi_sixmax_open_spot_20k_20260502` を20k episodesで実行。`save_interval=5000` により 5k / 10k / 15k / 20k checkpoint を保存。
        - 2026-05-02 checkpoint評価: Standard v3 をbaselineに、6-max 7 profile x 2 seeds x 250 episodesで評価。5k `avgReward=2.170`, `showdownWinRate=0.678`, `foldRate=0.197`, delta `+0.773`; 10k `2.275`, `0.668`, `0.155`, delta `+0.879`; 15k `2.307`, `0.674`, `0.159`, delta `+0.911`; 20k `2.269`, `0.704`, `0.205`, delta `+0.873`。全checkpointがpromotion report上 `recommendedTier=iron`。
        - 2026-05-02 判定: 15k checkpoint が avgReward / baseline delta / foldRate のバランスで最良。ただし negativeRaiseEVActions がまだ多く、Iron本番昇格は保留。次は15kをPro候補として長めのgateと実戦smokeにかける。
        - 2026-05-02 Pro反映: 15k checkpointを `public/models/badugi_pro_v1.onnx` / `model-badugi-pro-v1` v2 に反映。featureSet は `badugi-observation-v1-ev-range`。checksum は `4325e670b9b0a4360060fa5285f372b6cb85d4264b49dc5ccd0d5f3ba8211b5d`。
        - Iron / WorldMaster 強化方針: IronはPro 15kを基準に、negativeRaiseEVActionsを半減させつつ `avgRewardDeltaVsBaseline >= +1.0`, `foldRate <= 0.18`, `showdownWinRate >= 0.68` を狙う。WorldMasterは完全6-maxに近づけ、seat別 opponent range / pat pressure / blocker・dead-card aware draw equity / exploit memory を追加し、短期負けは許容しつつ長期で `avgRewardDeltaVsBaseline >= +1.3`, `foldRate <= 0.16`, profile別の最低avgRewardを底上げする。
      - [x] `AI-06f-0` Badugi equity / EV diagnostic を追加する。各decision logに `estimatedEquity`, `potOdds`, `callEV`, `raiseEV`, `foldEV`, `drawEquity`, `opponentProfile` を保存し、勝率ではなくチップEVで失敗箇所を追えるようにする。
        - 2026-05-02 更新: `BadugiEnv` に `BetEVDiagnostic` を追加し、BET action の `info.ev` と ONNX 評価ログへ `profitableFoldMisses`, positive/negative callEV/raiseEV action counts を出す。
        - 2026-05-02 更新: Python学習環境と frontend `badugiObservationSchema.js` の slot 27-31 を再同期。startingHandStrength / potOdds / position / toCall / oneAway がフロントでも埋まるようにした。
        - 2026-05-02 更新: EV特徴量 slot 48-53 を追加。ただし既存public ONNXはEV slotゼロ前提で学習されているため、`onnxPolicyAdapter` は `featureSet: "badugi-observation-v1-ev"` のモデルにだけEV slotを渡し、既存 `badugi-observation-v1` モデルでは 48-53 をゼロ化する。
        - 2026-05-02 評価: EV rewardのみ 10k probe は default gate で `candidateAvgReward=1.068`, `showdownWinRate=0.591`, `foldRate=0.149`, baseline差分 `+0.0707`。改善したが昇格閾値未達。
        - 2026-05-02 評価: EV feature 10k probe は balanced 1000 hand で現行v2より `avgReward=0.744 vs 0.542` と改善したが、default gate は baseline差分 `+0.0481` で未達。EV feature 20k probe は `showdownWinRate=0.682` まで上がる一方 `foldRate=0.312` と悪化し不採用。
        - 2026-05-02 分析: 発展性ドローを降りる原因は一部が診断誤集計だった。action `0` は DRAW では pat なので、BET phase の fold のみ `profitableFoldMisses` に数えるよう修正。それでもEV上のfold漏れは残るため、次はcallEVだけでなく「fold後に失う将来street value」を教師側に入れる。
        - 2026-05-02 更新: `futureStreetValue` / `cheapDrawContinueValue` を追加し、非最終streetの発展ドローで fold すると失う将来価値を callEV / reward / teacher action に反映。frontend schema も slot 54-55 を追加し、既存非EVモデルでは 48-55 をゼロ化する。
        - 2026-05-02 学習: `badugi_future_value_probe_5k_20260502` を 5k episodes で実行。途中20k設定は teacher warmup の初回処理が重く進捗確認しにくかったため停止し、短縮probeで先に方針確認した。
        - 2026-05-02 評価: future value 5k は default gate で `avgRewardDeltaVsBaseline=+0.361`, `candidateAvgReward=1.356`, `showdownWinRate=0.563`, `foldRate=0.182` で PASS。7 profile x 2 seed でも `avgReward=1.757`, `showdownWinRate=0.646`, `foldRate=0.190`, baseline差分 `+0.279` で PASS。
        - 2026-05-02 反映: `public/models/badugi_standard_dqn_v2.onnx` を future value 5k checkpoint から更新し、registry version を `v3`, featureSet を `badugi-observation-v1-ev` に変更。昇格先は Standard までで、Pro/Iron/WorldMaster には未反映。
      - [ ] `AI-06f-1` Badugi range equity table を作る。27万 starting hand 分布に加え、street / draw remaining / opponent draw count / opponent pat pressure を含む heads-up equity proxy を事前計算または高速近似する。
      - [ ] `AI-06g` CPU性格別モデルまたはpolicy headを設計する。候補: loose-aggressive, tight-aggressive, tight-passive, exploit-reader, balanced。
      - [ ] `AI-06h` Badugiプレイガイドを作成する。内容: ルール、基本戦略、position別参加レンジ、pat/draw判断、rough Badugiの扱い、初手Q-low Badugiなどの実戦例。
      - [x] `AI-06c-4` ドロー残り回数・最終bet・相手最終ドロー枚数で押し引き評価を変える。
        - 2026-05-01 更新: 簡易 BadugiEnv に 3rd draw 後の final BET round を追加。final BET 後に showdown へ進む。
        - 2026-05-01 更新: `street_adjusted_strength` を追加し、同じK-high Badugiでも early street では許容、final BETでは弱い値へ落とす。
        - 2026-05-01 更新: opponent last draw pressure を追加。final street で相手が2枚以上交換していれば薄いvalue/protection betを許容し、相手patならK/Q-high Badugiのbet/raiseを減点。
        - 2026-05-01 更新: observation 38-41 slot に street-adjusted strength / opponent draw pressure / final bet flag / weak final Badugi flag を追加。action mask 32-37 は維持。
        - 2026-05-01 更新: frontend `badugiObservationSchema.js` も同じ 38-41 slot を埋めるようにし、training env と本番ONNX入力のズレを防止。
        - 2026-05-01 更新: bootstrap ONNX generator も street context / opponent draw pressure / weak final Badugi feature を参照するようにした。public model は gate PASS まで再生成しない。
      - [x] `AI-06c-5` 中間CPU向けに bluff frequency / 相手のbet-raise頻度 / passivity / pat率 / 平均draw枚数 / foldability を observation と reward に追加し、相手を見る押し引きを学習させる。
        - 2026-05-01 方針: 96次元入力サイズは維持し、42-47 slot に opponent tendency を追加する。既存ONNXは壊さず、新規学習モデルだけが利用する。
        - 2026-05-01 方針: loose-aggressive / tight-passive などの opponent profile に bluff 頻度を持たせ、ブラフに対する call down / value raise と、foldable相手への semi-bluff を reward で分離する。
        - 2026-05-01 更新: `BadugiEnv` が opponent action / draw history を追跡し、observation 42-47 に aggression / passivity / pat pressure / average draw count / foldability / profile bluff frequency を出す。
        - 2026-05-01 更新: frontend `badugiObservationSchema.js` も同じ 42-47 slot を埋める。App state に該当統計がない場合は0に落とし、既存ゲーム進行へ影響させない。
        - 2026-05-01 更新: reward に foldable相手への semi-bluff、sticky相手への弱手bluff減点、bluffy/aggressive相手への強手call/raise加点、tight-pat圧力へのfold許容を追加。
        - 2026-05-01 実行: `npm run ai:train-badugi -- --episodes 50000 --max-steps 180 --warmup-steps 10000 --batch-size 64 --epsilon-decay-episodes 35000 --epsilon-end 0.05 --log-interval 1000 --save-interval 10000 --output-dir rl/models/badugi_opponent_read_50k_20260501 --train-every-steps 4 --opponent-profiles balanced,loose_passive,loose_aggressive,tight_passive,tight_aggressive,pat_heavy,draw_heavy --device cpu` は完走。
        - 2026-05-01 結果: 50k 終盤は 45k 時点で `avg_reward=0.501`、50k 時点で `avg_reward=0.077`、summary は `avg_reward_last_100=-0.0344`。
        - 2026-05-01 評価: `/tmp/mgx-badugi-opponent-read-50k.onnx` は beginner DQN比で `candidateAvgReward=2.092`, `showdownWinRate=0.344`, `foldRate=0.402`, `avgRewardDelta=0.9104`。standard tier gate はPASS。
        - 2026-05-01 評価: 現行 standard DQN比では `avgRewardDelta=0.3139`、showdownWinRate は `0.342 -> 0.344` と微増、foldRate は `0.499 -> 0.402` に改善。ただし Pro gate の `showdownWinRate >= 0.35` にわずかに届かないため、Pro/Iron/WorldMaster へは昇格しない。
        - 2026-05-01 反映: `public/models/badugi_standard_dqn_v2.onnx` / `model-badugi-standard-dqn-v2` を追加し、D03 standard tier は v2 を優先する。
      - [x] `AI-06d` gate PASS 時だけ beginner -> standard/pro/iron/worldmaster のどのtierへ入れるかを決める promotion report を生成する。
        - 2026-05-01 方針: standard / pro / iron / worldmaster の tier threshold を gate report に含め、最高到達tierだけを `recommendedTier` として出す。gate失敗時は `beginner` に留める。
        - 2026-05-01 更新: `npm run ai:gate-badugi-model` が `[BADUGI PROMOTION] recommendedTier=... eligibleTiers=...` を出力し、JSON report には `promotion.tierThresholds` / `failedTierChecks` も含める。
      - [x] `AI-06f` standard v2 は standard全体ではなく、opponent reading 型の別CPUキャラクターへ割り当てる。standard v1 は beginner へ落とさず、standard baseline / fallback として残す。
        - 2026-05-01 方針: `badugi-standard-reader` は `model-badugi-standard-dqn-v2` を使う。通常の D03 standard は `model-badugi-standard-dqn-v1` に戻し、beginner は `model-badugi-beginner-dqn-v1` のままにする。
        - 2026-05-01 理由: standard v1 は「弱い」よりも「fold過多のstandard」であり、beginnerへ付けると初心者CPUとして不自然になる。beginnerは低tier専用DQN、standard v1は比較基準、standard readerはv2と分ける。
        - 2026-05-01 更新: `src/config/ai/cpuCharacters.json` と `src/ai/cpuCharacters.js` を追加し、characterIdからmodel overrideを解決できるようにした。
        - 2026-05-01 更新: `selectModelForVariant()` は character-specific model を characterId 指定時だけ返す。characterIdなしの D03 standard は v1、`badugi-standard-reader` 指定時だけ v2。
      - [x] `AI-06g` 50k一括学習ではなく、20k前後のcheckpointごとに export / gate評価し、方針が悪ければそこで止める学習評価フローを作る。
        - 2026-05-01 方針: `--save-interval 20000` で 20k / 40k / latest を保存し、各checkpointをONNX exportして standard baseline と比較する。
        - 2026-05-01 方針: 判定は avgReward だけでなく showdownWinRate / foldRate / profile別の偏りを見る。Pro昇格は `showdownWinRate >= 0.35` を最低ラインにする。
        - 2026-05-01 更新: `npm run ai:evaluate-badugi-checkpoints` を追加。checkpoint dir と pattern を指定し、各checkpointを一時ONNXへexportして baseline と gate比較し、promotion reportをJSON保存する。
        - 2026-05-01 確認: `badugi_dqn_020000_*.pt` に対する smoke 評価は成功。短い2episode smokeでは `recommendedTier=beginner` を出力し、report JSONを生成した。
        - 2026-05-01 評価: `badugi_opponent_read_50k_20260501` の 10k/20k/30k/40k/50k checkpoint を `episodes=100`, seeds `20260502,20260503`, 7 profilesで比較。40kは `showdownWinRate=0.406` だが `foldRate=0.461` でfold過多、50kは `foldRate=0.404` だが `showdownWinRate=0.330` に低下。次はfold勝ち偏重を抑えてshowdown価値を上げる20k probeで確認する。
      - [x] `AI-06h` Pro昇格候補向けに reward を showdown 重視へ再調整し、20k probeで `showdownWinRate >= 0.35` と `foldRate <= 0.40` を同時に狙う。
        - 2026-05-01 方針: opponent fold の terminal reward を軽くし、showdown win reward を上げる。final street のmade Badugi / 安いone-away draw はfoldしすぎないよう call 側のrewardを強める。
        - 2026-05-01 調査: 20k probe は `showdownWinRate=0.441` まで上がったが `foldRate=0.549` で不合格。profile別ログで `pat_heavy` のaction countが異常に多く、相手pat時に `DRAW` から `BET` へ戻らない学習環境バグを検出。
        - 2026-05-01 修正: `BadugiEnv._opponent_draw_action()` で opponent pat 時も phase / bet state を reset して `BET` へ戻す。修正後に20k probeを再実行する。
        - 2026-05-01 再評価: pat修正後20k probeは `showdownWinRate=0.000`, `foldRate=1.000` で失敗。ログ上、`CALL/DRAW2` 系の非終端shaping rewardを大量に積む抜け道を学習していた。
        - 2026-05-01 修正: `BadugiEnv.step()` で terminal reward と shaping reward を分離し、非終端shaping rewardを `[-1.0, 0.08]` にクリップ。勝敗・showdown結果を主報酬に戻す。
        - 2026-05-01 再評価: capped 10k probe でも `foldRate=1.000`。fold直前まで非終端加点を積む抜け道が残ったため、非終端shapingの正報酬を0上限にし、`player_fold` terminal rewardを明示的に負にする。
        - 2026-05-01 確認: terminal主導に戻した 3k probe は `foldRate=0.345` まで正常化し、fold exploit は解消。ただし `avgReward=-6.163`, `showdownWinRate=0.130` と弱いため、次は長期学習の前に warm start / behavior cloning / rule-based teacher を検討する。
        - 2026-05-02 完了: evaluator / draw phase 修正後の 6-max 20k checkpoint 評価で、15k checkpoint が `avgReward=2.307`, `showdownWinRate=0.674`, `foldRate=0.159` を記録。`badugi_pro_v1.onnx` として Pro に昇格済み。
      - [x] `AI-06i` terminal主導rewardで学習初期が弱くなりすぎる問題に対し、rule-based teacher / behavior cloning / expert replay を入れて、fold exploitなしでshowdownWinRateを立ち上げる。
        - 方針: 現在の terminal主導rewardは安全だが sparse reward 寄りで3k時点が弱い。次は既存 policyRouter / Badugi evaluator から教師actionを作り、初期 replay buffer または imitation pretrain を入れる。
        - 2026-05-01 更新: `npm run ai:train-badugi` に `--teacher-warmup-episodes` を追加。teacher policyの遷移を replay buffer に先に投入し、DQNの初期探索を補助する。
        - 2026-05-01 確認: teacher warmup 1000 + DQN 3k probe は `foldRate=0.120` でfold exploitなし。ただし `showdownWinRate=0.097`, `recommendedTier=beginner` のため、現時点では上位CPUへ昇格しない。
      - [x] `AI-06j` Badugi starting hand / opening range の基本条件を明文化し、teacher / warm start のルールに使う。
        - 2026-05-01 調査: 旧 `rl/badugi_env_train.py` / `rl/train_agent.py` は残っているが、pot / bet / drawCount だけの簡易Q学習で、A27等の具体的な初動レンジ表は未実装。
        - 2026-05-01 調査: 現行で近い実装は `src/rl/training/build_badugi_bootstrap_onnx.py` の starting strength / pot odds / position feature。これを teacher 生成に再利用する。
        - 方針: 例として A-2-7 以上の3-card one-away / 低い3-card Badugi draw は heads-up では原則 open / bet 参加。K-high等の rough made Badugi は early street では参加可、final street では相手draw枚数とbet圧力で抑制。
        - 方針: 全4枚初手の組み合わせを評価し、1回draw後に全初手分布の上位50%より強く進展する確率が50%以上ある hand class を heads-up continue range に入れる。first draw前の teacher action はこの range / position / price で決める。
        - 2026-05-01 更新: `src/rl/training/badugi_starting_ranges.py` を追加。全初手分布の中央値、1ドロー後top-half到達確率、A-2-7-or-better判定、heads-up continue/open rule、teacher action を実装。
        - 2026-05-01 修正: teacher warmup の実行速度を守るため、3-card one-away は exact enumeration、2枚以上drawの弱い形はレンジ表の軽量推定に分離。学習時に全探索で詰まらないようにした。
        - 2026-05-01 確認: A-2-7 one-away は premium/open、弱い重複手は facing bet でfold、draw phase は手役形に応じたdraw countを返す unit test を追加。
      - [x] `AI-06k` teacher warmup 後のDQNが showdown に弱い問題を改善する。次は imitation loss / supervised pretrain / evaluator baseline の replay比率固定を入れ、3k-20k probeで `showdownWinRate >= 0.25` まで立ち上げてから長期学習へ進む。
        - 2026-05-01 更新: DQN agent に `imitation_update()` を追加し、teacher state/action に対する cross entropy pretrain を可能にした。
        - 2026-05-01 更新: `npm run ai:train-badugi` に `--imitation-pretrain-steps`, `--expert-replay-ratio`, `--imitation-loss-weight` を追加。teacher replay を初期投入だけでなく、通常DQN更新中にも一定比率で維持する。
        - 2026-05-01 修正: teacher の final street を street-aware にし、未完成 one-away は facing bet でfold、rough made Badugi は相手2枚替え以上のときだけ薄く打つ方針に変更。
        - 2026-05-01 確認: 3k imitation probe は `bc_acc=1.000` までteacher actionを学習したが、評価は `showdownWinRate=0.099`, `foldRate=0.040`, `recommendedTier=beginner`。配線は機能しているが強さは未達。
        - 2026-05-01 確認: street-aware teacher 後の1k probeも `showdownWinRate=0.075`, `foldRate=0.000` で未達。teacher / imitation だけでは改善せず、training env のbetting/draw進行とteacher品質の再設計が必要。
      - [x] `AI-06l` imitation pretrain + expert replay の 3k/20k probe を評価し、`showdownWinRate >= 0.25`, `foldRate <= 0.40` を満たす checkpoint だけを beginner/standard候補へ進める。
        - 2026-05-02 完了: `--teacher-warmup-episodes`, `--imitation-pretrain-steps`, `--expert-replay-ratio`, `--imitation-loss-weight` を組み合わせた current-env 20k probe を評価し、Pro候補の15k checkpointを採用。古い評価器・draw phase時代のcheckpointは昇格対象外として扱う。
      - [x] `AI-06m` Badugi training env の betting/draw 進行を実ゲームに近づける。現状は player action 後に即DRAWへ進みやすく、opponent のbet応答・street内アクション交換が簡略化されすぎているため、teacherを真似ても実戦的な押し引きが育ちにくい。
        - 2026-05-01 深掘り: `evaluate_badugi()` が低ランク貪欲選択になっており、`A A A 2` を 1-card A と誤判定していた。正しくは枚数最大化優先で 2-card `A2`。全 52C4 brute force 照合を追加し、mismatch 0 を確認。
        - 2026-05-01 深掘り: `BadugiEnv.step()` が player BET action 後に `phase=DRAW` へ進めた直後、同一step内の `_opponent_turn()` で opponent DRAW を消費して `phase=BET` に戻していた。結果として player は学習上ほぼカードチェンジできず、showdownWinRate が極端に低下していた。
        - 2026-05-01 修正: player BET後は `DRAW` phase を次stepへ残し、player DRAW 後に opponent draw を処理して次BETへ進めるようにした。
        - 2026-05-01 確認: 修正後の簡易評価で `call + best draw` は balanced 相手に `showdownWinRate=0.523`, `foldRate=0.000`。teacher は `showdownWinRate=0.750` だが `foldRate=0.800` でタイトすぎるため、次は teacher の参加レンジとfold頻度を調整する。
        - 2026-05-02 監査: 実装済み評価器を確認。対象は Badugi / 2-7 low / A-5 low / split evaluator / NLH high。Omaha/PLO は variant definition と seed/API はあるが、実ゲーム進行・showdown evaluator へは未接続のため「実装済みゲーム評価」としては未検証扱い。
        - 2026-05-02 修正: フロント Badugi shared evaluator の rank key が下位キッカーを過大評価していたため、高カードから辞書順比較できる encoding に修正。例: `Q-T-9-8` が `K-4-3-2` に正しく勝つ。
        - 2026-05-02 修正: Badugi legacy / split 用の 5枚以上入力時、最初に見つけた4-card Badugiで探索を止める可能性を除去。全subsetを評価し、5枚入力でも最良4枚を選ぶようにした。
        - 2026-05-02 確認: Badugi / 2-7 / A-5 / single draw / NLH evaluator regression をまとめて実行し、7 files / 82 tests pass。Python RL Badugi evaluator / starting range / DQN imitation tests は 37 tests pass。
        - 2026-05-02 追加監査: 2-7 / A-5 low evaluator は made low 同士の比較は正しかったが、ペア以上を一律 penalty に寄せており、1ペア / 2ペア / trips / full house / quads のカテゴリ差が不足していた。
        - 2026-05-02 修正: 2-7 は high-card -> one pair -> two pair -> trips -> straight -> flush -> full house -> quads -> straight flush の低い順、A-5 は straight / flush 無視で duplicate category を比較するように修正。2-7 の `A-2-3-4-5` は wheel straight ではなく Ace-high no-pair として扱う。
        - 2026-05-02 確認: Lowball / draw engine / single draw regression は 4 files / 58 tests pass。Badugi / 2-7 / A-5 / NLH を含む関連一式は 7 files / 85 tests pass。`npm run lint`, `npm run build`, Python RL 37 tests も pass。
        - 2026-05-02 TDA照合: TDA 2024 Rule 12/16/20/21 を参照し、cards speak / all-in hand table / odd chip / side pots separate を確認。Badugi side pot で eligible が1人だけの side pot を前potへmergeしてしまう実装を修正し、短い all-in main pot winner が単独eligible side potを取らない回帰テストを追加。
        - 2026-05-02 確認: Badugi roundFlow / BadugiEngine / payout integrity / D01-D02 draw engine regression は 6 files / 78 tests pass。`npm run lint`, `npm run build` も pass。
      - [x] `AI-06n` Badugi evaluator / draw phase 修正後に、既存Badugi DQN checkpoint を無効扱いにし、新しいenvで teacher/imitation 3k -> 20k probe を再実行する。
        - 2026-05-02 完了: current-env `badugi_sixmax_open_spot_20k_20260502` を実行し、5k/10k/15k/20k checkpointを評価。15kを Pro (`public/models/badugi_pro_v1.onnx`) に採用。model registry に `trainingEnvVersion=current-env-20260502` / `featureSet=badugi-observation-v1-ev-range` / checksum を記録済み。
      - [ ] `AI-06o` Proより上位の Iron 候補を作る。6-maxで「悪いto-call raiseを減らす」「発展性のあるdrawを降りすぎない」「value bet / late semi-bluff / isolation raise」を同時に満たし、現行Proに対して再現性ある差を出す。
        - 2026-05-02 修正: `npm run ai:train-badugi` に `--resume-checkpoint` を追加し、tier昇格候補を既存checkpointからfine-tuneできるようにした。
        - 2026-05-02 修正: 6-max isolation raise teacher/reward を、`raiseEV >= callEV + edge` の局面に絞った。negative raise EV の集計を bet と raise で分離し、checkpoint report summary に actionCounts / evDiagnostics を集約するようにした。
        - 2026-05-02 評価: `badugi_sixmax_iron_raise_discipline_10k_20260502` は5k `avgReward=2.250`, `showdownWinRate=0.689`, `foldRate=0.192`, Pro比 `-0.031`、10k `avgReward=2.256`, `showdownWinRate=0.704`, `foldRate=0.209`, Pro比 `-0.025`。悪いraiseは減ったがfold過多になり、昇格不可。
        - 2026-05-02 修正: call EV が fold EV を明確に上回る局面のfoldに追加ペナルティを入れ、teacherも3-card以上または安い発展drawでEVがあるならcallを選ぶようにした。
        - 2026-05-02 評価: `badugi_sixmax_iron_overfold_control_5k_20260502` は `avgReward=2.301`, `showdownWinRate=0.675`, `foldRate=0.158`, Pro比 `+0.021`。fold率は戻ったが差が小さいため昇格保留。
        - 2026-05-02 評価: 追加fine-tune `badugi_sixmax_iron_overfold_control_plus_10k_20260502` は5k Pro比 `-0.037`、10k Pro比 `+0.011`。現行Proを明確に超えないため Iron には未適用。
        - 2026-05-02 追加検証: to-call raise にさらに強いedgeを要求する `badugi_sixmax_iron_call_edge_5k_20260502` を試したが、`showdownWinRate=0.717` まで上がる一方で `foldRate=0.233`, Pro比 `-0.099`。降り過ぎが悪化したため採用しない。
        - 2026-05-02 追加検証: raise edge強化は戻し、call EV が fold EV を明確に上回る局面のcall rewardだけを厚くした `badugi_sixmax_iron_call_value_5k_20260502` を評価。`avgReward=2.665`, `showdownWinRate=0.700`, `foldRate=0.197`, Pro比 `+0.006`。negativeRaiseEVActions は `221 -> 103` に改善したが、profitableFoldMisses が `264 -> 349` に悪化したため昇格保留。
        - 次の打ち手: negative raise EV をさらに減らしつつ、profitableFoldMisses をPro以下に抑える。評価は Pro baseline 比 `avgRewardDelta >= +0.25`、`foldRate <= 0.17`、`showdownWinRate >= 0.69` を最低ラインにしてから registry 反映する。
        - 次の具体策: fold miss 悪化はaction maskではなくpolicy選好の問題。次は teacher / reward の `profitable_continue` を「call」だけでなく、fold actionへの明確な教師損失として維持する。また draw-heavy / passive profile 別に profile-aware continue threshold を入れ、全profile平均だけでなく worst-profile avgReward を gate に入れる。
        - 2026-05-02 実装: `profitable_continue` teacher を profile-aware 化。`draw_heavy` / passive系では cheap draw と profitable continue の閾値を緩め、EVがある低コスト継続をfoldしにくくした。
        - 2026-05-02 実装: gate / checkpoint summary に `profileSummaries`, `worstProfile`, `worstProfileAvgReward` を追加し、promotion tier と明示gateで worst-profile を評価対象にした。
        - 2026-05-02 20k評価: `badugi_sixmax_iron_profile_continue_20k_20260502` を 5k/10k/15k/20k checkpoint で評価。最良10kは `avgReward=2.682`, `showdownWinRate=0.696`, `foldRate=0.194`, Pro比 `+0.023`, worstProfile=`loose_passive`, worstProfileAvgReward=`1.490`。negativeRaiseEVActions は `221 -> 13` まで改善したが、profitableFoldMisses は `264 -> 344`、foldRate は `0.159 -> 0.194` に悪化したため Iron 昇格は保留。
        - 次の具体策: fold miss の主因は facing bet で action 0 を選ぶ頻度がまだ高いこと。次は teacher replay 内の `profitable_continue` サンプルを oversample し、DQN loss 側で fold action に対する margin loss を追加する。単純なreward追加だけではshowdown勝率は上がるがfoldRateが悪化する。
        - 2026-05-02 強さ評価の現状: Pro v2 は synthetic 6-max gate で Standard v3 を大きく上回ったが、人間プレイヤー相手に勝率6割以上を保証する評価はまだない。現時点で言えるのは「scripted 7 profile x 2 seed の近似6-max環境で `avgReward=2.307`, `showdownWinRate=0.674`, `foldRate=0.159`」まで。
        - 2026-05-02 注意: Iron / WorldMaster の production ONNX は現状 bootstrap heuristic。フロントONNX経路の動作確認用としては有効だが、「明らかに人より強い」ことは未検証。上位tierへ実装するには trained checkpoint への置換が必須。
        - [ ] `AI-06p` human/practice benchmark gate を追加する。最低限、手動または記録済み人間プレイログに対して Pro は実戦体感で少し勝ち越す、Iron は明確に勝ち越す、WorldMaster は短期以外ほぼ勝てない、という基準を別評価として記録する。現 synthetic gate だけで「人に6割勝つ」とは宣言しない。
      - [ ] `AI-06e` 2-7 / A-5 用の実ONNXを生成・配置する。現状は `model-27draw-iron-v1` (`D01/S01`) と `model-a5draw-iron-v1` (`D02/S02`) の registry / feature builder / routing test はあるが、実 `.onnx` は optional 未配置で、App draw CPU は rule-based fallback が主経路。
    - [x] `AI-07` CPU decision log に `source`, `tierId`, `reason`, `discardIndexes` を集計表示し、手動検証で追えるようにする。
  - P2P:
    - data capture / export / sync / security test の部品はある。
    - player-facing lobby / match session / realtime turn sync / reconnect / result sync は未完成。
    - [x] `P2P-01` MVP 仕様を固定する: private room / public room / invite / reconnect / timeout / result sync。
      - MVP は Friend Match から private room を作成し、host を join 済みにして room code / WebSocket URL を表示する。
      - public room / invite link / reconnect / timeout / result sync は後続の P2P-03 以降で段階実装する。
    - [x] `P2P-02` server session model と persistence 方針を設計する。
      - `docs/p2p-session-model.md` に runtime state / DB-backed target tables / conflict rules / current implementation status を固定。
    - [x] `P2P-03` client state sync と conflict resolution を実装する。
      - [x] `P2P-03a` frontend room API util と Friend Match create/join 導線を `/api/rooms` へ接続する。
      - [x] `P2P-03b` join by room code と WebSocket receive loop を UI state に接続する。
      - [x] `P2P-03c` sequenceId による stale event discard / reconnect replay を実装する。
        - Friend Match preview は最新 `sequenceId` より古いイベントを破棄し、`history` event を replay entry として展開する。
      - [x] `P2P-03d` WebSocket event を実ゲーム table state へ接続する。
        - 2026-05-01 更新: Friend Match 画面で `room_state` / `updated_state` / `secure_deal` / `showdown` を live table state に反映し、phase / pot / handId / player stack / bet / ready / folded / showdown winner を表示する。
        - `Ready` / `Call` / `Draw` / `Fold` を WebSocket `reaction` / `action` として送信できるようにし、P2P専用画面内で同期状態を操作できる。
        - server 側は duplicate reconnect join を安全に扱い、room metadata の `startingStack` を初期 stack に反映する。
    - [x] `P2P-04` Badugi 2人対戦 smoke: login -> room -> ready -> hand -> draw -> showdown -> next hand。
      - 2026-05-01 部分完了: `src/server/tests/test_p2p_sync.py` で room -> ready -> hand -> draw -> showdown -> next hand の WebSocket server smoke を追加。認証付きブラウザ2画面 smoke は未実施。
      - 2026-05-01 更新: `tests/e2e/p2p-friend-match-smoke.spec.ts` で authenticated menu -> Friend Match -> create room -> Ready -> Draw -> showdown -> next hand をブラウザ smoke 化。guest は mock WebSocket event で再現し、UI の live table state 表示を確認する。
      - Vite dev server に `/ws` proxy を追加し、実 backend WebSocket へ接続する次段階の土台を用意。
    - [x] `P2P-05` disconnect / reconnect / browser refresh の復帰 smoke を追加する。
      - 2026-05-01 部分完了: WebSocket reconnect 後に recent history が replay され、直前 action を復元できる server smoke を追加。browser refresh で UI が復帰する実ブラウザ smoke は未実施。
      - 2026-05-01 更新: Friend Match の active room を `sessionStorage` に保存し、browser refresh 後に同じ room へ reconnect して history replay を表示できることを Playwright で確認。
  - CPU 対戦後フォローアップ:
    - history / replay / EV estimator / feature extraction の基盤はある。
    - CPU 戦終了後にミスプレイ候補を自動抽出し、振り返り画面へ誘導する UX は未完成。
    - [x] `FOLLOW-01` post-match summary の表示位置と導線を決める。
      - summary は hand 終了後の review entry point と ReplayScreen link の間に置き、実表示接続は `FOLLOW-05` で行う。
    - [x] `FOLLOW-02` EV delta threshold と mistake severity を定義する。
      - `src/games/badugi/analysis/followUpAnalyzer.js` の `FOLLOW_UP_THRESHOLDS` で low / medium / high を固定。
    - [x] `FOLLOW-03` Badugi draw mistake detection: dead card を残した / made hand を崩した / overdraw / underdraw。
      - `analyzeBadugiDrawMistakes(...)` と `buildPostMatchFollowUpSummary(...)` を追加。
    - [x] `FOLLOW-04` BET mistake detection: weak call / missed value raise / unnecessary bluff / cap 到達時の誤操作。
      - `analyzeBadugiBetMistakes()` で `metadata.betInfo` の hand / toCall / canRaise / cap 情報から weak call、missed value raise、unnecessary bluff、cap 到達後の攻撃を検出する。
    - [x] `FOLLOW-05` ReplayScreen へ該当 hand / street / action に直接戻る link を追加する。
      - hand history action の `seq` を canonical replay event の `actionSeq` として保持し、Hand Result の Follow-up から該当フレームへジャンプできる。

## 12.2 Playwright / Auth / Operational QA

2026-04-30 時点の実運用目線チェック。

- [x] `OP-01` frontend proxy と backend direct の `/api/health` が `db: ok` を返すことを確認。
- [x] `OP-02` 実 DB に Playwright 用メールアドレスを signup し、login と `/auth/me` の認証 round trip が成立することを確認。
  - `EmailStr` は `example.test` などの予約ドメインを拒否するため、E2E 用メールは `@mgx-e2e.com` 形式へ変更。
- [x] `OP-03` Auth UI の validation error が `[object Object]` にならず、Pydantic detail を読めるメッセージとして表示される。
- [x] `OP-04` 現行 UI の Title `Press Enter` -> Auth -> Menu -> Ring game 導線で Playwright が停止しない。
- [x] `OP-05` player として ring game に入り、BET action button をクリックできる。
- [x] `OP-06` DRAW phase でヒーローカードを選択し、選択状態が table card の visual / `aria-pressed` に反映され、`Draw Selected` を実行できる。
- [x] `OP-07` desktop 1280x720 相当で、ヒーローカードが右下席や fixed footer に覆われてクリック不能にならない。
- [x] `OP-08` 既存 Badugi / MTT / gallery Playwright の game entry helper を、旧 `/start/i` 前提から authenticated flow へ更新。
- [x] `OP-09` Badugi regression Playwright の残失敗を個別修正する。
  - `npx playwright test tests/e2e --project=badugi-flow` は entry/auth では止まらない。
  - 2026-04-30 更新: MTT bust/result overlay の props 配線不整合を修正し、MTT 2 tests は通過。
  - 2026-04-30 更新: canonical hand history へ legacy `seats` / `pots` / `uiSummary` を反映し、fold-only `finalAction` 欠落を改善。
  - 2026-04-30 更新: ヒーローのターン外でも操作ボタンが表示される問題を修正。UI の `heroCanAct` は action handler と同じ `turn` / session turn を正本にする。
  - 2026-04-30 更新: E2E forced action の `call` amount を controller と同じ現在 bet 基準で算出し、to-call がある場面の `check` 強制を排除。
  - 2026-04-30 更新: `setPlayerHands` が session controller / legacy controller snapshot にも反映されるようにし、showdown / side-pot / hand history 検証で注入手札が上書きされないようにした。
  - 2026-04-30 更新: 新ハンド seed は `buildNextHandState` の `newPlayers` を正本にし、前ハンドの folded / lastAction が残るケースを修正。
  - 2026-04-30 更新: Playwright helper をボタン可視性待ちから phase / turn / handId 状態待ちへ寄せ、人工的な複数 seat 同時 fold 待ちを削減。
  - 2026-04-30 確認: `npx playwright test tests/e2e/badugi-flow.spec.ts --project=badugi-flow` は `16 passed`。
  - 2026-04-30 確認: `npx playwright test tests/e2e/authenticated-game-smoke.spec.ts --project=badugi-flow` は `1 passed`。
  - 2026-04-30 確認: `npx playwright test tests/e2e/badugi-mtt-flow.spec.ts --project=badugi-flow` は `2 passed`。
  - 2026-04-30 確認: `npm run build` は成功。chunk size warning は残るが build 失敗ではない。
- [ ] `OP-10` 実ブラウザ手動 smoke を実施する。
  - Desktop Chrome: login、ring game 5 hands、bet/call/raise/fold、draw/pat、hand result、history。
  - Mobile Safari または Android Chrome: portrait / landscape でカード選択、Draw Selected、overlay、footer overlap を確認。
  - 2026-04-30 自動確認:
    - `tests/e2e/mobile-app-smoke.spec.ts` を追加。
    - mobile portrait: Title -> Menu -> Ring start 後に orientation gate が表示されることを確認。
    - mobile landscape: Badugi / D01 で hero card が viewport 内にあり、card select -> Draw Selected が実行できることを確認。
    - orientation gate の landscape lock は best-effort。Android Chrome / installed PWA では効く可能性があるが、iOS Safari はブラウザ制約で手動回転が必要。
  - 残件:
    - 実機 Safari / Android Chrome の手動確認。
    - mobile landscape で hand result / next hand / history までの長時間操作確認。
  - 2026-04-30 自動 smoke 完了:
    - Badugi desktop / authenticated / MTT / mobile emulation は `QA-08` で完了。
    - 物理端末での touch / Safari orientation / Android Chrome hitbox はこの実行環境から確認できないため、手動 QA として残す。
- [x] `OP-11` repository-wide lint の既存エラーを整理する。
  - `npm run lint` は 2026-04-30 時点で既存の `process` / unused / duplicate member / App.jsx 未整理などにより fail していた。
  - 2026-04-30 再採取: `npm run lint` は `132 problems (106 errors, 26 warnings)` で fail。
  - 主な分類:
    - 環境定義不足: `process` / `global` / `__dirname` の `no-undef`。
    - parser / import assertion: `difficultyAdjuster.js` / `variantCatalog.js` の `Unexpected token assert`。
    - App.jsx 既存負債: unused、`phaseSnapshot` undefined、`logE2EError` redeclare、hook deps warning。
    - shared component lint: Fast Refresh rule、unused props。
    - test lint: unused vars、test globals。
  - 方針:
    - lint は App 実装と別章で、設定系、テスト系、App.jsx 実バグ候補の順に分割して直す。
    - `phaseSnapshot` undefined / `logE2EError` redeclare は runtime risk があるため優先候補。
  - 2026-04-30 対応:
    - ESLint globals を browser + node + vitest に拡張し、`process` / `global` / Node config の環境差分を吸収。
    - JSON import assertion を通常 JSON import へ変更し、Espree parser error を解消。
    - `vite.config.js` の `__dirname` を ESM 互換の `fileURLToPath(import.meta.url)` に変更。
    - `DeckManager.shuffle` の重複 class member を解消。
    - App.jsx の runtime risk だった `phaseSnapshot` undefined と `logE2EError` redeclare を修正。
    - 既存の unused / Fast Refresh / hook deps は warning として残し、今後の安全な小分け整理対象にする。
  - 2026-04-30 確認: `npm run lint` は `0 errors / 89 warnings` で exit 0。
  - 2026-04-30 追加整理:
    - App.jsx の未参照 state / ref / helper を削除し、`npx eslint src/ui/App.jsx` は `42 warnings` から `23 warnings` へ減少。
    - repository-wide lint は `0 errors / 70 warnings` で exit 0。
    - 残る App.jsx hook deps は、依存追加で game progression / E2E driver / console capture の実行タイミングが変わる可能性があるため、個別の挙動テストを添えて段階整理する。
  - 2026-04-30 小 warning 整理:
    - unused props / imports / helper / catch binding を GameLayoutBase、NLH adapter、draw / badugi tests、evaluator registry、dealer choice / dev overrides から削除。
    - Provider と hook の同居による Fast Refresh warning を `AuthProvider` / `GameEngineProvider` / `MixedGameProvider` で分離し、ChipStack の utility export も別ファイルへ移動。
    - App.jsx から hand history getter export を `src/ui/state/handHistoryStore.js` へ移動し、Fast Refresh warning を削減。
    - MixedGameContext の provider API 関数を `useCallback` 化し、hook deps warning を解消。
    - repository-wide lint は `0 errors / 20 warnings` で exit 0。残りは App.jsx の hook deps のみ。
    - 確認: 関連 Vitest 7 files / 72 tests、`npm run build`、`tests/e2e/authenticated-game-smoke.spec.ts --project=badugi-flow` は通過。
  - 残り 20 warning の分割対応計画:
    - [x] `LINT-A01` controller snapshot memo: 不要 deps を削除し、controller ref 由来 snapshot を毎 render 安全に読む形へ寄せる。
    - [x] `LINT-A02` seat label memo: `positionName` 依存を純粋 helper 化して seatViews / seatLabels の deps を安定させる。
    - [x] `LINT-A03` console capture: `formatConsole` 依存を ref 化し、console hook を再登録せず最新 phase context を記録する。
    - [x] `LINT-B01` safe reset callback: `buildPlayersFromSeatTypes` 依存を追加または stable helper 化する。
    - [x] `LINT-B02` acting-seat guard: `findNextDrawActorSeat` 依存を stable 化する。
    - [x] `LINT-C01` auto CPU draw callback: draw / deck / logging / sync helper deps を整理し、DRAW 進行の regression を付ける。
    - [x] `LINT-C02` forced bet callback: bet action log / controller sync deps を整理し、BET action smoke を付ける。
    - [x] `LINT-C03` custom hand injection: `applyDeckSnapshot` 依存を整理し、showdown / hand-history 注入テストを付ける。
    - [x] `LINT-C04` showdown callback: `goShowdownNow` の最新参照を ref 化し、`resolveHandImmediately` との deps を整理する。
    - [x] `LINT-C05` tournament start / hydration: `buildTournamentEntrants` / deck / HUD hydration deps を整理し、MTT smoke を付ける。
    - [x] `LINT-D01` debug-only effects: `debugLog` / `phaseTagLocal` を ref または guarded helper に寄せ、挙動差分を出さない。
    - [x] `LINT-D02` E2E driver helper: `drawSelected` / tournament HUD deps を整理し、authenticated Playwright smoke を付ける。
    - [x] `LINT-D03` NPC action timer: turn progression deps を整理し、Badugi flow Playwright を付ける。
    - 2026-04-30 確認: `LINT-A01` - `LINT-A03` 対応後、repository-wide lint は `0 errors / 16 warnings`。
    - 2026-04-30 確認: Vitest 4 files / 57 tests、`npm run build`、`tests/e2e/authenticated-game-smoke.spec.ts --project=badugi-flow` は通過。
    - 2026-04-30 確認: `LINT-B01` / `LINT-B02` 対応後、App hook warning は `16` から `14` へ減少。
    - 2026-04-30 確認: `npm run lint` は `0 errors / 14 warnings`、Vitest 5 files / 61 tests、`npm run build`、Badugi Playwright 17 tests は通過。
    - 2026-04-30 確認: `LINT-C01` 対応後、App hook warning は `14` から `13` へ減少。Vitest 4 files / 55 tests、`npm run build`、Badugi Playwright 17 tests は通過。
    - 2026-04-30 確認: `LINT-C02` 対応後、App hook warning は `13` から `12` へ減少。Vitest 3 files / 51 tests、`npm run build`、authenticated Playwright 1 test、Badugi Playwright 16 tests は通過。
    - 2026-04-30 確認: `LINT-C03` 対応後、App hook warning は `12` から `11` へ減少。Vitest 3 files / 51 tests、`npm run build`、Badugi Playwright 16 tests は通過。
    - 2026-04-30 確認: `LINT-C04` 対応後、App hook warning は `11` から `10` へ減少。Vitest 3 files / 51 tests、`npm run build`、Badugi Playwright 16 tests は通過。全体実行時に競合していた E2E forced fold log は `__forceInstant` 経路に限定して安定化。
    - 2026-04-30 確認: `LINT-C05` 対応後、App hook warning は `10` から `8` へ減少。Vitest 2 files / 24 tests、`npm run build`、MTT Playwright 2 tests、Badugi fold Playwright 4 tests は通過。Badugi / D01 の fixed-limit raise cap と、hero fold 後の追加行動防止 / folded winner 除外を確認。
    - 2026-04-30 確認: `LINT-D01` 対応後、App hook warning は `8` から `3` へ減少。Vitest 2 files / 6 tests、`npm run build`、authenticated Playwright 1 test は通過。debug-only log と controller sync phaseTag は ref 経由にし、effect の実行条件は変更しない。
    - 2026-04-30 確認: `LINT-D02` 対応後、App hook warning は `3` から `2` へ減少。Vitest 1 file / 1 test、`npm run build`、authenticated Playwright 1 test、MTT Playwright 2 tests は通過。E2E driver の draw / tournament HUD getter は ref 経由で最新実装を読む。
    - 2026-04-30 確認: `LINT-D03` 対応後、App hook warning は `2` から `1` へ減少。Vitest 3 files / 51 tests、`npm run build`、Badugi Playwright 16 tests は通過。NPC timer は players / action helpers を ref 経由にし、BET / DRAW turn progression の timer 条件は維持。
    - 2026-04-30 確認: 最後の `startNextHand` warning を解消し、App hook warning は `1` から `0` へ減少。repository-wide `npm run lint` は `0 errors / 0 warnings`。Vitest 3 files / 51 tests、`npm run build`、Badugi Playwright 16 tests は通過。
- [x] `OP-12` D01 / D02 / S01 / S02 を Badugi と同等の browser smoke 対象に引き上げる。
  - [x] engine / controller / controller e2e が各 draw variant で通ることを確認。
  - [x] 5-card draw snapshot を UI table props に変換する `DrawLowballUIAdapter` を追加。
  - [x] D01 / D02 / S01 / S02 と engine key alias を `GameUIAdapterRegistry` に登録できる helper を追加。
  - [x] `DrawLowballUIAdapter` が D01 / D02 / S01 / S02 snapshot の phase、seat、pot、HUD、controls を構築できることを Vitest で確認。
  - [x] App URL variant detection に draw family alias を追加する。
    - `D01` / `27td` -> `deuce_to_seven_triple_draw`
    - `D02` / `a5td` -> `ace_to_five_triple_draw`
    - `S01` / `27sd` -> `deuce_to_seven_single_draw`
    - `S02` / `a5sd` -> `ace_to_five_single_draw`
  - [x] App の controller session path に D01 / D02 の最小接続を追加する。
    - draw controller snapshot を session / table props 正本にする。
    - draw controller 管理 variant では Badugi deck integrity check を誤適用しない。
  - [x] 2026-04-30: D01 / D02 / S01 / S02 の headless browser smoke を `draw-lowball-app-smoke.spec.ts` で完了。
  - [x] 2026-04-30: mobile emulation は portrait gate と Badugi / D01 / D02 / S01 / S02 landscape draw 操作を `mobile-app-smoke.spec.ts` で確認。
    - NPC BET / DRAW は draw controller の `getCpuAction` / `applyAction` を通す。
  - [x] D01 / D02 の Playwright smoke を追加する。
    - title -> auth -> URL alias -> menu -> ring game
    - bet / call / raise の進行
    - 5-card selection -> Draw Selected / pat
    - hand result / next hand は確認済み。hand history は継続確認対象。
  - [x] S01 / S02 の Playwright smoke を追加する。
    - title/auth 済みの App URL entry から ring game、BET進行、draw/pat、hand result、next hand を確認。
  - [x] `src/ui/game/variants.js` の enabled variant と Main Menu variant selection に draw family を安全に追加する。
    - `menu-ring` は既存 Badugi 即開始導線として維持。
    - `menu-variant-select` を追加し、variant picker から D01 / D02 / S01 / S02 を選べるようにした。
  - [x] automated mobile viewport で 5-card hand と footer overlap の代表確認を追加する。
    - D01 / D02 / S01 / S02 mobile landscape で `player-0-card-4` が viewport 内に収まり、card select / Draw Selected が通る。
    - portrait は game 開始後に orientation gate を表示する現仕様を確認。
  - 注意: 2026-04-30 時点で headless desktop / mobile emulation smoke は通過。実スマホ / 実機ブラウザ手動確認は OP-10 / QA-05 の残件。
  - 完了確認:
    - fold / folded winner 除外 / raise cap は draw engine/controller Vitest で固定済み。
    - D01 / S01 は 2-7 low label、D02 / S02 は A-5 low label と final low ranks を App result / RL history 経由で確認済み。
    - D01 / D02 / S01 / S02 の mobile landscape smoke は全 variant に拡張済み。
    - hand history / replay の variantId / final low ranks / pot winner 復元は `src/ui/utils/__tests__/handHistory.test.js` と App smoke の latest RL record で確認済み。
- [x] `OP-13` draw family の App 接続を段階実装する。
  - 目的:
    - D01 / D02 / S01 / S02 を Badugi と同じ「Title -> Auth -> Menu -> Ring game -> action -> draw -> result」導線で検証できる状態にする。
    - Badugi / MTT / RL API の既存挙動を壊さず、App.jsx の変更は最小単位に分ける。
  - 実装順:
    1. [x] App variant routing helper を追加する。
       - `badugi` / `nlh` / `deuce_to_seven_triple_draw` / `ace_to_five_triple_draw` / `deuce_to_seven_single_draw` / `ace_to_five_single_draw` を正規 ID とする。
       - `D01` / `D02` / `S01` / `S02` / `27td` / `a5td` / `27sd` / `a5sd` の alias を正規 ID に変換する。
       - URL query、menu selection、Playwright helper が同じ normalize 関数を使えるようにする。
    2. [x] App の controller 生成を variant catalog へ寄せる。
       - `badugi` は既存 Badugi session controller のまま。
       - `nlh` は既存 NLH controller のまま。
       - draw family は `src/games/core/variants.js` の `controllerFactory` を使う。
       - controller snapshot は `getSnapshot()` または `getUiSnapshot()` のどちらでも読めるようにする。
    3. [x] draw family の新ハンド開始を controller snapshot 正本にする。
       - 5枚手札、blind、pot、turn、currentBet は draw controller snapshot から App session へ反映する。
       - App deck manager と draw engine deck manager の二重管理を避ける。接続初期は draw controller 側を正本にし、Badugi の deck integrity check を draw family に誤適用しない。
    4. [x] hero BET / CHECK / CALL / RAISE / FOLD / DRAW を draw controller に通す。
       - draw action は `discardIndexes` を渡す。
       - Badugi 既存の `afterBetActionWithSnapshot` fallback を draw family に誤適用しない。
       - controller snapshot から App state、session state、engine snapshot を同期する。
    5. [x] NPC action loop を draw controller に通す。
       - `getCpuAction(state, seatIndex)` が返す action を使う。
       - action deadlock を避けるため、turn と phase の待機条件を Playwright で確認する。
    6. [x] variant modal で D01 / D02 を enabled にする。
       - S01 / S02 も controller path / Playwright smoke と同じ範囲で enabled 化する。
       - `menu-ring` の既存即開始は維持し、`menu-variant-select` で picker を開く。
    7. [x] Playwright smoke を追加する。
       - D01: login -> URL alias -> ring -> call/check -> draw/pat -> result -> next hand。
       - D02: login -> URL alias -> ring -> call/check -> draw/pat -> result -> next hand。
       - S01/S02: login -> URL alias -> ring -> call/check -> draw/pat -> result -> next hand。
       - D01: login -> Main Menu variant picker -> ring -> 5-card hand 表示。
       - 失敗時は phase、turn、variant、handId、console log を取得する。
       - hand history は OP-12 残件として継続。
  - 受け入れ条件:
    - Badugi Playwright `badugi-flow` / authenticated smoke / MTT smoke が継続して通る。
    - D01 / D02 / S01 / S02 の controller Vitest と App接続テストが通る。
    - D01 / D02 / S01 / S02 Playwright smoke が headless Chromium で通る。
    - `npm run build` が通る。
  - 2026-04-30 確認:
    - `npm test -- --run src/ui/components/__tests__/VariantSelectModal.test.jsx src/ui/screens/__tests__/MainMenuScreen.test.jsx src/ui/game/__tests__/appVariantRouting.test.js src/ui/game/draw/__tests__/DrawLowballUIAdapter.test.js` は `4 passed / 18 passed`。
    - `npx playwright test tests/e2e/draw-lowball-app-smoke.spec.ts --project=badugi-flow` は `5 passed`。
    - `npx playwright test tests/e2e/mobile-app-smoke.spec.ts --project=badugi-flow` は `3 passed`。
    - `npx playwright test tests/e2e/authenticated-game-smoke.spec.ts --project=badugi-flow` は `1 passed`。
    - `npm run build` は成功。chunk size warning は残るが build 失敗ではない。
    - App URL / menu selection の normalize 適用。
    - draw controller snapshot を UI adapter に渡せる入口の整備。

## 13. ひとことで言うと

- 最優先は Badugi 完了と bug 管理の定着。
- RL は frontend ONNX 主体で固める。
- 35 variants を正式採用し、その後に `D01 -> D02 -> S01/S02` と進める。
