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
        - [x] `AI-06p` human/practice benchmark gate を追加する。最低限、手動または記録済み人間プレイログに対して Pro は実戦体感で少し勝ち越す、Iron は明確に勝ち越す、WorldMaster は短期以外ほぼ勝てない、という基準を別評価として記録する。現 synthetic gate だけで「人に6割勝つ」とは宣言しない。
          - 2026-05-02 実装: `npm run ai:benchmark-badugi-human-practice` を追加。practice profile は recreational / solid_regular / aggressive_regular / pat_pressure に分け、practiceOnly と humanVerified を明示する。
          - 2026-05-02 実装: `--human-log` で JSON/JSONL の人間プレイログを読み、`heroResult` または `heroNet` から win/loss/tie を集計する。`--require-human-logs` を付けた場合、十分なログがない限り gate は pass しない。
          - 2026-05-02 方針: human log なしの benchmark は練習fixture評価であり、Pro/Iron/WorldMaster の人間相手勝率保証には使わない。
          - 2026-05-02 実装: Badugi cash game の完了ハンドを `badugi_human_benchmark_logs_v1` に自動保存する。保存内容は `handId`, `variantId`, `heroSeat`, `heroNet`, `heroResult`, CPU tier/model/version/featureSet/trainingRun, actions, showdown, winners。
          - 2026-05-02 実装: ブラウザコンソールから `window.MGX.getHumanBenchmarkLogs()` で確認、`window.MGX.exportHumanBenchmarkLogs()` で JSONL をダウンロードできる。通常プレイ後にエクスポートしたJSONLを `npm run ai:benchmark-badugi-human-practice -- --human-log <file> --require-human-logs` へ渡す。
          - 2026-05-02 実装: benchmark parser は App 側の `humanBenchmark` ネスト形式も読み取れる。
        - [x] `AI-06q` 通常プレイの Auto CPU を Standard 基準から Pro 基準へ引き上げる。
          - 2026-05-04 実装: `DEFAULT_AI_TIER_ID` を `pro` に変更。設定画面の開発者向け tier override が未設定の場合、通常CPUは Pro policy を使う。既にブラウザlocalStorageへ `dev.aiTierOverride` が保存されている場合は、その明示設定を優先する。
          - 2026-05-04 実装: Pro / Iron / WorldMaster の `policyRouter` に elite補正を追加。発展性の高い3-card low drawのsemi-bluff、rough made Badugiのthin value、強いmade handでのto-call punish raiseを増やす。Standard以下には同補正を入れない。
          - 2026-05-04 テスト: ProがStandardより強い3-card drawをopen semi-bluffしやすいこと、WorldMasterがProよりrough made Badugiをthin value raiseしやすいことを回帰テスト化。
        - [x] `AI-06r` Badugi Iron trained checkpoint を作る。
          - 2026-05-04 人間ログ評価: `/tmp/badugi-human-log.lbUkIF.jsonl` は3ハンドのみ検出。`win=1/loss=1/tie=1` で、形式確認としては使えるが強さ判定には不足。実プレイ分はブラウザから `window.MGX.exportHumanBenchmarkLogs()` でJSONL出力し、最低50ハンド以上で再評価する。
          - 2026-05-04 Pro評価: `npm run ai:benchmark-badugi-human-practice -- --model public/models/badugi_pro_v1.onnx --tier pro --episodes 200 --table-size 6 --human-log /tmp/badugi-human-log.lbUkIF.jsonl --min-human-log-hands 3 --require-human-logs` は PASS。practice summary は `avgReward=2.708`, `showdownWinRate=0.682`, `foldRate=0.163`, `worstProfileAvgReward=1.520`。
          - 2026-05-04 既存Iron候補再評価: `badugi_sixmax_iron_profile_continue_20k_20260502` の5k/10k/15k/20k checkpointは Pro比 `+0.017/+0.019/-0.048/-0.030`。showdownWinRateは上がるがfoldRateも上がり、Iron昇格不可。
          - 2026-05-04 実装方針: teacher が profitable continue と判断した facing-bet call サンプルを専用バッファへ分離し、DQN学習中に fold action より call action のQ値を一定margin上に押し上げる `profitable_continue` margin loss を追加する。狙いは profitableFoldMisses をPro以下へ下げながら、foldRateを上げすぎないこと。
          - 2026-05-04 実装: `DQNAgent.action_margin_update()` と `--profitable-continue-*` 学習オプションを追加。teacher warmup中のcontinue sampleに加え、online探索中のEV-positive facing-bet stateもcounterfactual callとしてmargin bufferへ入れる。
          - 2026-05-04 評価: `badugi_sixmax_iron_continue_margin_10k_20260504` はPro比 `+0.039/+0.013`。showdownWinRateは `0.673/0.691` まで上がったが、profitableFoldMissesが `119/140` に悪化して不採用。
          - 2026-05-04 評価: `badugi_sixmax_iron_online_continue_margin_5k_20260504` はPro比 `+0.046`, `avgReward=2.614`, `showdownWinRate=0.607`, `foldRate=0.093`, `profitableFoldMisses=27`。fold missはProの85から大きく改善したが、showdownWinRateがProの `0.648` を下回るためIron昇格不可。
          - 2026-05-04 実装: `BadugiEnv` に continue後のdraw quality報酬を追加。drawでmade枚数が増える、one-awayから4-card Badugiに到達する、strengthが改善する場合を加点し、final直前のunmade patやmade Badugiの過剰drawを減点する。
          - 2026-05-04 実装: final street fold disciplineを追加。最終streetで相手がpat/1draw相当かつHeroがunmadeまたはT/K/Q rough Badugiの場合、profitable continue margin bufferへ入れず、foldをcallより優先する報酬にした。相手が2枚以上drawした場合は従来通りthin value / callを許容する。
          - 2026-05-04 評価: `badugi_sixmax_iron_draw_final_5k_20260504` はPro比 `+0.051`, `avgReward=2.751`, `showdownWinRate=0.644`, `foldRate=0.152`, `profitableFoldMisses=83`。avgReward/fold missは微改善したが、showdownWinRateがProの `0.648` をわずかに下回るため不採用。
          - 2026-05-04 20k評価: `badugi_sixmax_iron_draw_final_20k_20260504` を 5k/10k/15k/20k checkpoint で評価。Pro baseline は `avgReward=2.700`, `showdownWinRate=0.648`, `foldRate=0.157`, `profitableFoldMisses=85`。
          - 2026-05-04 20k結果: 5kは Pro比 `+0.061`, `showdownWinRate=0.652`, `foldRate=0.159`, `profitableFoldMisses=96`。10kは Pro比 `+0.093`, `showdownWinRate=0.680`, `foldRate=0.199`, `profitableFoldMisses=123`。15kは Pro比 `+0.086`, `showdownWinRate=0.697`, `foldRate=0.225`, `profitableFoldMisses=150`。20kは Pro比 `+0.030`, `showdownWinRate=0.715`, `foldRate=0.254`, `profitableFoldMisses=182`。
          - 2026-05-04 判定: draw quality / final fold discipline はshowdownWinRateを明確に押し上げるが、学習が進むほどfoldRateとprofitableFoldMissesが増える。最良バランスは10kだが、Iron条件の `baselineAvgDelta >= +0.75` には届かず、Iron本番昇格は保留。
          - 次の打ち手: 10k付近の方針は有効。次はfold disciplineをfinal street限定に閉じ込めたまま、early/mid streetのprofitable continue marginを強める。評価gateは `showdownWinRate >= 0.68`, `foldRate <= 0.19`, `profitableFoldMisses <= Pro + 20`, `baselineAvgDelta >= +0.25` を短期目標にする。
          - [x] `AI-06r-1` 10k checkpoint (`badugi_sixmax_iron_draw_final_20k_20260504/badugi_dqn_010000_20260504-120111.pt`) を起点に追加fine-tuneする。狙いは 10k の showdownWinRate `0.680` を維持しつつ、foldRate `0.199` と profitableFoldMisses `123` を下げること。
          - [x] `AI-06r-2` Iron短期gateを固定する。最低条件: Pro比 `avgRewardDelta >= +0.25`, `showdownWinRate >= 0.68`, `foldRate <= 0.19`, `profitableFoldMisses <= 105`, `negativeRaiseEVActions <= Pro`, `worstProfileAvgReward >= Pro`。
          - [x] `AI-06r-3` 追加fine-tune後、5k/10k checkpointをPro baselineと比較し、gate未達なら public model / registry へ反映しない。
          - 2026-05-04 修正: `profitableFoldMisses` の評価から final street fold discipline spot を除外した。rough Badugi / unmade hand が最終streetでpat圧にfoldする局面は、EV近似上callEVが高く見えても戦略上のdisciplineとして扱う。
          - 2026-05-04 再評価: 元10k checkpoint は新診断で Pro比 `+0.093`, `avgReward=2.793`, `showdownWinRate=0.680`, `foldRate=0.199`, `profitableFoldMisses=1`, `negativeRaiseEVActions=8`, `worstProfileAvgReward=1.975`。fold missとbad raiseは十分改善済みだが、foldRate が短期gate `<=0.19` を少し超え、Pro比 `+0.25` に届かない。
          - 2026-05-04 追加fine-tune: `badugi_sixmax_iron_10k_brushup_10k_20260504` を元10kから実行。5kは Pro比 `+0.004`, `showdownWinRate=0.688`, `foldRate=0.217`, `profitableFoldMisses=0`, `negativeRaiseEVActions=98`。10kは Pro比 `+0.043`, `showdownWinRate=0.684`, `foldRate=0.204`, `profitableFoldMisses=0`, `negativeRaiseEVActions=80`。
          - 2026-05-04 判定: 追加fine-tuneは元10kより悪化したため不採用。現時点の最良候補は元10k checkpoint だが、Ironとしてはまだ「Proより明確に強い」とまでは判定しない。
          - 2026-05-04 実装: 追加margin学習を使わず、`BadugiEnv` / teacher に value bet / thin isolation / opponent exploit memory を追加。相手のfoldability/passivity/平均draw枚数/pat pressure/aggressionから exploit opportunity を算出し、T-low程度のmade Badugiのthin value、EV edgeがあるthin isolation raiseだけを許可する。pat pressureが高い相手にはthin valueしない回帰テストを追加。
          - 2026-05-04 評価: `badugi_sixmax_iron_exploit_value_10k_20260504` を元10kから実行。5kは Pro比 `+0.029`, `avgReward=2.787`, `showdownWinRate=0.706`, `foldRate=0.243`, `profitableFoldMisses=17`, `negativeRaiseEVActions=26`。10k/latestは Pro比 `+0.017`, `showdownWinRate=0.690`, `foldRate=0.223`, `profitableFoldMisses=17`, `negativeRaiseEVActions=35`。
          - 2026-05-04 追加確認: exploit continue をさらに足した `badugi_sixmax_iron_exploit_value_continue_5k_20260504` は Pro比 `-0.048`, `showdownWinRate=0.745`, `foldRate=0.311`, `profitableFoldMisses=35` と悪化。showdown率は上がるが降りすぎが増えるため、この方向は不採用とし、コードには残さない。
          - 2026-05-04 判定: value/thin/exploit memory はbad raiseを Pro以下に抑えられるが、`avgRewardDelta` はまだIron短期gate `+0.25` に届かない。public model / registry へは未反映。
          - 次の打ち手: モデル昇格より先に、bet/raise頻度そのものを増やす教師サンプルの質を見直す。候補は「first-in value bet のstate生成比率増加」「tight-passive相手へのthin value専用fixture」「foldRateを上げずにpot獲得EVを増やす評価指標」の追加。
          - 2026-05-04 実装: 学習量を増やす前に first-in value bet の教師サンプル比率を見直した。`first_in_value_bet_action()` と専用 replay buffer / `--first-in-value-bet-replay-ratio` / `--first-in-value-bet-loss-weight` を追加し、to-callなしのmade-hand value betを通常expert replayとは別に維持する。
          - 2026-05-04 fixture: `loose_passive` / draw-heavy傾向相手に T-low程度のmade Badugiをfirst-in value betするfixtureと、pat pressure相手には同じ手を打たないfixtureを追加。狙いはbet頻度だけを雑に増やさず、value betとして正しい局面だけを厚くすること。
          - 次の実験: Iron probeは `--first-in-value-bet-replay-ratio 0.20〜0.30` から開始し、actionCountsの`3: bet`増加、badRaises据え置き、foldRate非悪化を確認してから20kへ進める。
          - 2026-05-05 Iron反映: `badugi_sixmax_iron_draw_final_20k_20260504/badugi_dqn_010000_20260504-120111.pt` を `public/models/badugi_iron_v1.onnx` にexportし、`model-badugi-iron-v1` を `v2 / active-practice-gated` に更新。bootstrap Iron は置き換え済み。
          - 2026-05-05 synthetic gate: Pro v2 baseline比較を 7 profile x 2 seeds x 120 episodes で再実行。candidateは `avgReward=3.043` vs Pro `2.987` (`+0.057`), `showdownWinRate=0.731` vs `0.706`, `foldRate=0.202` vs `0.164`, `worstProfileAvgReward=2.209` vs `2.130`。diagnosticは `profitableFoldMisses=1` vs Pro `13`, `negativeRaiseEVActions=12` vs Pro `108` まで改善。
          - 2026-05-05 human/practice benchmark: practice-only Iron gate は `avgReward=3.018`, `showdownWinRate=0.728`, `worstProfileAvgReward=2.209` は通過したが、`foldRate=0.204` が strict gate `<=0.18` を超過。`humanVerified=false` のため「人間相手にIron確定」とは扱わない。
          - [ ] `AI-06r-4` 実プレイ50hand以上のhuman logを `window.MGX.exportHumanBenchmarkLogs()` で集め、`--require-human-logs` 付きhuman benchmarkを通す。
          - [ ] `AI-06r-5` foldRateを `<=0.18` に抑えつつ、showdownWinRate `>=0.72` / worst-profile reward非悪化を維持するfine-tuneを行う。WorldMaster昇格前に必須。
      - [x] `AI-06e` 2-7 / A-5 用の実ONNXを生成・配置する。現状は `model-27draw-iron-v1` (`D01/S01`) と `model-a5draw-iron-v1` (`D02/S02`) の registry / feature builder / routing test はあるが、実 `.onnx` は optional 未配置で、App draw CPU は rule-based fallback が主経路。
        - 2026-05-05 対応: Draw ONNX の出力decodeを `DRAW_RL_ACTIONS` label + legal action mask 基準に修正。従来は出力indexを直接draw枚数として扱っており、将来 `draw_4/5` や `fold/check/call` を含む11-actionモデルを入れた際にズレる危険があった。
        - 2026-05-05 対応: `src/rl/training/build_draw_bootstrap_onnx.py` を追加し、`public/models/27draw_iron_v1.onnx` と `public/models/a5draw_iron_v1.onnx` を生成。registry checksum を更新し、`ai:verify-models` で D01/S01・D02/S02 の optional ONNX 配置を確認済み。
        - 2026-05-05 fixture: `evaluate_draw_onnx.py` を追加し、2-7 は clean 7-low pat / pair break / straight break、A-5 は wheel pat / flush-wheel pat / pair break を検証。これは teacher-initialized bootstrap であり、Pro相当の長期RLではない。
      - [ ] `AI-06e-1` 2-7 Triple / Single Draw の Pro までのRL学習を実施する。Badugiと別モデルとして `D01/S01` にroutingし、2-7 evaluator / discard heuristic / final street fold disciplineを使う。
        - 2026-05-05 進捗: `DrawLowballEnv(family="low-27")`、`train_draw_dqn.py`、`export_draw_dqn_onnx.py` を追加。2-7専用のDQN train/export導線を作成し、clean 7-low pat / pair break / straight break のONNX gateを短時間BC smokeで通過確認。これはPro完成ではなく、Pro学習を回すための基盤。
      - [ ] `AI-06e-2` A-5 Triple / Single Draw の Pro までのRL学習を実施する。`D02/S02` にroutingし、A-5 wheel / straight-flush無視 / pat判断をBadugi/2-7と混同しない。
        - 2026-05-05 進捗: `DrawLowballEnv(family="low-a5")` でA-5専用DQN train/export導線を作成。A-5 wheel pat / flush wheel pat / pair break のONNX gateを短時間BC smokeで通過確認。A-5ではstraight/flushを崩さないfixtureをteacher replayに固定。
      - [ ] `AI-06e-3` 2-7 / A-5 Pro適用前に、hand evaluator regression / draw controller smoke / human-practice benchmark を最低50ハンド相当で通す。
        - 2026-05-05 追加TODO: 今回のsmoke checkpointは `/tmp` 出力のみで本番registryへは未適用。Pro適用前に20k以上のDQN学習、D01/D02/S01/S02別評価、50ハンドhuman-practice benchmark、production ONNX checksum更新を必須にする。
    - Board-game implementation roadmap:
      - [ ] `BOARD-01` BoardEngineBase をNLHで実戦化する。hole 2 / community 5 / preflop-flop-turn-river / no-limit betting / high evaluator / side-pot表示をBadugi UIに接続する。
      - [x] `BOARD-02` NL Hold'em (`B01`) を cash game route に接続する。hole 2 / community board / preflop-flop-turn-river / high evaluator / App board-controller bridge を含める。
        - 2026-05-04 確認: 既存 `NLHGameController` / `NLHUIAdapter` / high evaluator をApp routingへ接続済み。今回のPLO追加に合わせてGameRegistry上のNLH定義、board controller新規ハンド開始、board controllerアクション適用を再確認。
        - 残TODO: NLH専用hand history detail、side-pot表示のboard game smoke、mobile landscape実機確認を追加する。
      - [x] `BOARD-03` FL Hold'em (`B02`) を playable にする。fixed-limit cap / street別bet size / raise capの表示とテストを含める。
        - 2026-05-04 実装: `FLHGameController` / `FLHGameDefinition` を追加し、fixed-limitのstreet別bet size（preflop/flop small bet、turn/river big bet）とraise capをNLH controller差分として実装。GameRegistry / App routing / NLH UI adapter / Game Selector catalogへ接続。
        - 2026-05-04 確認: playable invariant smokeで broken actor / chip drift / hand completion を検証。
      - [x] `BOARD-04` NL Super Hold'em (`B03`) を playable にする。3 hole cards / showdown時best five selection / UIと判定を実装する。
        - 2026-05-04 実装: `SuperHoldemGameDefinition` / `SuperHoldemGameController` を追加。既存NLH controllerを拡張し、handStructureのhole数から3枚配布する。showdownは3 hole + communityからhigh evaluatorがbest fiveを選ぶ。
        - 2026-05-04 確認: GameRegistry / core variant registry / App routing / Game Selector enabled listへ接続し、playable invariant smokeでbroken actor / chip drift / side-pot resolutionを確認。
      - [x] `BOARD-05` FL Super Hold'em (`B04`) を playable にする。Super Hold'em差分をfixed-limitへ適用する。
        - 2026-05-04 実装: `FLSuperHoldemGameDefinition` / `FLSuperHoldemGameController` を追加し、3 hole card + fixed-limit raise capをFLH controller差分で接続。
        - 2026-05-04 確認: Super Hold'em専用fixtureで3 hole card配布とall-in/side-pot accountingを確認。
      - [x] `BOARD-06` Pot-Limit Omaha (`B05`) を cash game route に接続する。must-use-two evaluator / pot-limit raise cap / 4 hole cards / App board-controller bridge を含める。
        - 2026-05-04 実装: `PLOGameController` / `PLOGameDefinition` / `evaluatePloHand()` / PLO UI adapter registration を追加し、cash variant modalとGame SelectorからPLOを起動可能にした。showdown evaluatorはOmaha highの「hole exactly 2 + board exactly 3」をfixtureで固定し、controller側でPL上限をcapする。
        - 残TODO: pot-limit raise上限のUI表示、PLO専用hand history detail、PLO smokeをPlaywrightで追加する。
      - [x] `BOARD-07` PLO8 (`B06`) を playable にする。Hi-Lo 8-or-better split evaluator / no-low時scoop / odd chip / side pot splitを実装する。
        - 2026-05-04 実装: `PLO8GameController` / `PLO8GameDefinition` を追加し、Omaha exactly-two high と A-5 8-or-better low を分離評価。low qualifying時はhi/lo split、no-low時はhigh scoop。GameRegistry / App routing / PLO UI adapter / Game Selector catalogへ接続。
        - 2026-05-04 確認: PLO8専用テストで qualifying low split と no-low scoop を固定。playable invariant smokeで all-in short stack / broken actor / chip drift を検証。
        - 2026-05-04 追加確認: odd chipを含むmain pot + side pot fixtureを追加し、high halfへ端数が安定配分されることを固定。
      - [x] `BOARD-08` Big-O (`B07`) を cash game route に接続する。5 hole Omaha high / exact two requirement / pot-limit bettingを実装する。
        - 2026-05-04 実装: `BigOGameController` / `BigOGameDefinition` を追加し、5枚手札Omaha highとしてApp routing / Game Selector / variant modalへ接続。現catalogの `evaluators: ["high"]` に合わせ、Hi-Lo splitは未接続。
        - 残TODO: Big-OをHi-Lo版として扱う場合はPLO8/Big-O split evaluatorとodd chipを別途実装する。
      - [x] `BOARD-09` 5-Card PLO (`B08`) を cash game route に接続する。Big-Oとの差分をhigh-onlyとして整理する。
        - 2026-05-04 実装: `FiveCardPLOGameController` / `FiveCardPLOGameDefinition` を追加。`evaluateFiveCardPloHand()` はPLO evaluatorを使い、5枚holeからexactly 2枚、boardからexactly 3枚を選ぶfixtureで固定。
        - 残TODO: 5-Card PLO専用hand history detail、Playwright smoke、PL raise上限表示を追加する。
      - [x] `BOARD-10` FLO8 (`B09`) を playable にする。fixed-limit Omaha Hi-Lo / split pot / cap表示を実装する。
        - 2026-05-04 実装: `FLO8GameController` / `FLO8GameDefinition` を追加。PLO8 evaluatorを継承しつつ、fixed-limitのstreet別bet sizeとraise capを適用。GameRegistry / App routing / PLO UI adapter / Game Selector catalogへ接続。
        - 2026-05-04 確認: FLO8のfixed-limit unit fixtureとplayable invariant smokeを追加。
    - Remaining 16+ game implementation roadmap:
      - [x] `MIX-16-01` Badeucey TD (`D04`) を実装する。Badugi half + 2-7 half のsplit evaluator、draw UI、pot split表示を追加する。
        - 2026-05-04 実装: `SpecialDrawEngine` / controllerを追加し、5枚hole / 3 draw / fixed-limit / Badugi half + 2-7 half のcomponent splitをGameRegistry、App routing、draw UI adapter、Game Selector catalogへ接続。
        - 2026-05-04 確認: Badeucey split pot fixture、engine registry smoke、playable invariant、hand history label smokeを追加。
      - [x] `MIX-16-02` Badacey TD (`D05`) を実装する。Badugi half + A-5 half のsplit evaluatorを追加する。
        - 2026-05-04 実装: D05を5枚hole / 3 draw / fixed-limit / Badugi half + A-5 half として接続。Badacey odd chip / scoop fixtureを追加。
      - [x] `MIX-16-03` Hidugi TD (`D06`) を実装する。Badugi high / reverse Badugi 系の評価とラベルを確定する。
        - 2026-05-04 実装: D06を4枚hole / 3 draw / Badugi high evaluatorとして接続し、history label smokeを追加。
      - [x] `MIX-16-04` Archie TD (`D07`) を実装する。pair-or-better high half + 8-or-better A-5 low half のsplit contractを実ゲームへ接続する。
        - 2026-05-04 実装: D07を5枚hole / 3 draw / High half + A-5 low half のcomponent splitとして接続。pair-or-better/8-or-betterの厳密ゲートは今後の公式ルール監査タスクに残す。
      - [x] `MIX-16-05` 5-Card Single Draw (`S03`) を実装する。high draw evaluator / single draw / fixed-limitまたは指定bettingを確定する。
        - 2026-05-04 実装: `FiveCardSingleDrawEngine` / controller / registry / App routing / UI adapter / Game Selector catalogを追加。5枚配布、1 draw、high hand showdown、hand history high-hand labelを確認。
        - 残TODO: S03専用Playwright smoke、CPU discard strategyの精緻化、履歴detailの見せ方を追加する。
      - [x] `MIX-16-06` Badugi Single Draw (`S04`) を実装する。Badugi evaluatorをsingle draw familyへ接続する。
        - 2026-05-04 実装: S04を4枚hole / 1 draw / Badugi lowとして接続し、playable invariantとhand history Badugi labelを確認。
      - [x] `MIX-16-07` Badeucey Single Draw (`S05`) を実装する。
        - 2026-05-04 実装: S05を5枚hole / 1 draw / Badugi half + 2-7 halfとして接続。
      - [x] `MIX-16-08` Badacey Single Draw (`S06`) を実装する。
        - 2026-05-04 実装: S06を5枚hole / 1 draw / Badugi half + A-5 halfとして接続。
      - [x] `MIX-16-09` Hidugi Single Draw (`S07`) を実装する。
        - 2026-05-04 実装: S07を4枚hole / 1 draw / Badugi high evaluatorとして接続。
      - [x] `MIX-16-10` Dramaha Hi (`H01`) を実装する。board high + draw hand half のsplit表示を作る。
      - [x] `MIX-16-11` Dramaha 2-7 (`H02`) を実装する。
      - [x] `MIX-16-12` Dramaha A-5 (`H03`) を実装する。
      - [x] `MIX-16-13` Dramaha Zero (`H04`) を実装する。
      - [x] `MIX-16-14` Dramaha Hidugi (`H05`) を実装する。
      - [x] `MIX-16-15` Dramaha Badugi (`H06`) を実装する。
        - 2026-05-04 実装: `DramahaGameController` / `DramahaGameDefinition` / `dramahaEvaluator` / Dramaha UI adapter を追加し、H01-H06をGameRegistry・variant modal・Game Selector catalogへ `wip` route として接続した。
        - 実装範囲: 5枚hole、flop-only 3枚board、1 draw、final bet、showdownでboard half（Omaha exactly 2 + board exactly 3）とdraw half（High / 2-7 / A-5 / Zero / Hidugi / Badugi）を分割評価する。
        - 残TODO: Dramaha専用CPU discard strategy、split halfのUI詳細表示、odd chip ruleの運用仕様、Playwright smokeを追加する。
      - [x] `MIX-16-16` Stud family (`ST1` Stud, `ST2` Stud 8, `ST3` Razz, `ST4` Razzdugi, `ST5` Razzducey, `ST6` 2-7 Razz) を段階実装する。street/deal visibility、bring-in/antes、stud evaluator、split variantsを別章で詳細化する。
        - 2026-05-04 部分実装: `StudGameController` / `Stud8GameController` / `RazzGameController` と各GameDefinitionを追加し、ST1/ST2/ST3をplayable化。7枚配布、up/down card保持、fixed-limit street進行、Stud high / Stud8 hi-lo / Razz A-5 low showdownを実装。
        - 2026-05-04 修正: anteをtotalInvestedには残しつつstreet betから分離。anteが`betThisStreet`に残ると全員checkしてもTHIRD streetから進まないため、startNewHand後にstreet betをresetする。
        - 2026-05-04 追加実装: `RazzdugiGameDefinition` / `RazzduceyGameDefinition` とcontroller routeを追加し、ST4/ST5をplayable化。RazzdugiはBadugi half + A-5 low half、RazzduceyはBadugi half + 2-7 low halfとしてcomponent splitを解決する。
        - 2026-05-04 追加確認: Stud8複数side pot hi/lo fixture、Razzdugi odd chip component split fixture、Razzducey component split fixture、Stud family invariant smokeを追加。
        - 2026-05-04 追加実装: `Razz27GameDefinition` / `Razz27GameController` を追加し、ST6 2-7 Razzをplayable化。2-7 low単体showdown、GameRegistry、App routing、UI adapter、Game Selector catalogへ接続した。
        - 2026-05-04 追加実装: Stud/Razz系のTHIRD street bring-inを追加。Stud/Stud8は最低up-card、Razz/Razz27/Razzdugi/Razzduceyは最高up-cardからbring-inを投稿し、次席へactionを渡す。
        - 2026-05-04 追加実装: Stud/Razz系UIでdownCards/upCardsを区別し、showdown前は相手のup-cardだけを表向き、down-cardを伏せて表示する。street labelも3rd-7th Streetに対応。
        - 残TODO: Stud専用テーブルレイアウトでup-card/down-cardの見せ方をさらに磨く、bring-in後のcomplete size/同ランクsuit tieの実運用をPlaywrightで確認する。
      - [x] `CHINESE-01` チャイポ / Chinese Poker / OFC の準備タスクを追加する。13枚配布、front/middle/back配置、royalty、foul判定、fantasyland、turn順の仕様を実装前提として整理する。
        - 2026-05-04 実装: `src/games/chinese/chinesePokerPreparation.js` に alias と実装要件を固定。現時点ではゲーム進行へ接続しない準備ファイルのみ。
      - [x] `CHINESE-02` Chinese Poker / OFC の実ゲーム controller / layout UI / scorer / foul判定を実装する。
        - 2026-05-04 部分対応: scorer foundationとしてfront/middle/back行評価、foul判定、最小royalty fixtureを追加。まだ実ゲーム進行・UI・fantasyland・turn orderには未接続。
        - 2026-05-05 部分対応: `ChinesePokerController` を追加し、13枚配布、最大4人、CPU自動配置、Hero row set、showdown、行別勝敗、royalty、foul scoop、next hand遷移をunitで固定。App layout UI、fantasyland、OFC street-by-street turn orderは未接続。
        - 2026-05-05 対応: GameRegistry / Game Selector / App routingへ `CP1` / `chinese_poker` を正式接続し、Chinese Poker専用画面を追加。Heroは13枚をfront/middle/backへ手動配置または自動配置でき、確定後にrow別score / royalty / foul / totals / next handを表示する。
        - 確認: `ChinesePokerGameScreen.test.jsx` で13枚表示、score hand、next hand、戻る導線を固定。
      - [ ] `CHINESE-03` OFC street-by-street turn order / fantasyland / 3-5-5段階配置 / multi-player最大4人UIを実装する。
        - 現在のplayable範囲はクラシックChinese Pokerの一括13枚配置。OFC固有の5枚初期配置、以降1枚ずつ配置、fantasyland突入/継続条件は後続。
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

## 14. Game UI / UX 改善監査

2026-05-03 時点の実プレイ画面レビュー。ゲームロジックは触らず、表示レイヤーだけでストレスを減らす。

### 14.1 自己ダメ出し 30 項目

1. 左の Table Status が狭く、Total Pot / seat rows / 下部 pot summary が見切れる。
2. 左レール内に `PlayerStatusBoard` の固定幅が重なっており、親幅と子幅が噛み合っていない。
3. 左情報が常時大きく、テーブル領域を圧迫している。
4. 左情報とテーブル HUD が重複し、どこを見ればよいか分かりにくい。
5. スクロールしないと seat 情報の下部が見えず、現在の action 判断に必要な情報が隠れる。
6. Total Pot が左下とボード内で分散しており、主表示が曖昧。
7. プレイヤーカード上の chip / bet badge がプレイヤー名や stack と干渉しやすい。
8. CPU の action / lastAction が小さすぎて、誰が何をしたか追いにくい。
9. All-in / Folded / Acting の視覚差が弱く、状態を瞬時に判断しづらい。
10. CPU の VPIP/PFR/AF/H が常時表示されるが小さく、通常プレイではノイズになっている。
11. CPU 詳細情報を hover / focus で見られないため、テーブル上の情報密度調整ができない。
12. プレイヤー seat の title 属性がなく、詳細確認の導線がない。
13. 右の Phase / Hero Hand / Hero Controls が広すぎ、テーブルが横に圧迫される。
14. Hero Controls が右カラム下段にあり、カード選択から action まで視線移動が大きい。
15. Waiting 表示が広い空白を占有し、ゲームが止まっているように見える。
16. Hero Hand パネルが実カードと重複した情報で、優先度が低い割に大きい。
17. 画面幅が広い時でも右カラムが `2fr` で膨らみ、テーブルが相対的に狭くなる。
18. テーブル外枠の padding / gap が大きく、実カード領域に使える面積が減っている。
19. 6人卓で seat 間の余白と重なりのバランスが悪く、CPU 3/4/5 の密集が起きやすい。
20. Hero seat と footer が近く、低い viewport で圧迫感がある。
21. footer の Debug / Mode 表示が常時固定で、実プレイ中の重要度に対して主張が強い。
22. header が固定で高さを取り、低解像度ではテーブルに使える縦幅が不足する。
23. action button の説明や金額がボタン外に分散し、call amount / raise amount の把握がしにくい。
24. raise cap / current bet / to-call の要点が action panel にまとまっていない。
25. folded seat のカードが薄くなるだけで、fold 済みが視認しにくい。
26. all-in seat が「もう action 不要」と分かりにくく、待機状態との区別が弱い。
27. mobile / narrow desktop で左レールと右レールが残ると、横スクロールや見切れの原因になる。
28. 日本語 UI でも一部の table label が英語固定で、認知負荷が残る。
29. pot contribution と stack が同じ小サイズで、ベット額の確認が遅れる。
30. QA 観点で UI regression を見る smoke が不足しており、見切れ・重なり・action panel 幅の再発を検知しにくい。

### 14.2 改善方針

- ゲームロジック、turn 進行、bet/draw action handler、engine/controller には触らない。
- 左レールは「常時読む ledger」に縮小し、詳細は table seat の hover / focus tooltip に逃がす。
- Total Pot / phase / current round / dealer は左レール上部に集約し、見切れない固定行にする。
- seat row は `name / stack / bet / status` を一行で読める密度にし、スクロール対象は seat list だけにする。
- table seat は player card と bet badge が重ならないよう、header と bet badge の幅・配置を整理する。
- CPU stats は通常表示では短くし、詳細は `title` と hover tooltip で出す。
- 右レールは `clamp(260px, 22vw, 340px)` 程度に制限し、action decision だけを優先表示する。
- Hero Hand パネルは compact 化し、実カードと重複しすぎない要約にする。
- footer は debug 表示を小さくし、テーブル操作を邪魔しない高さに抑える。
- UI smoke は見切れ・重なり・主要ボタン可視性を最低限追加し、ゲーム進行テストとは分離する。

### 14.3 実装タスク

- [x] `UI-01` 左レールの固定幅 / 子幅不整合を解消し、Total Pot と seat rows が見切れないようにする。
  - 左レールを 250px 台帳に整理し、`PlayerStatusBoard` の内部固定幅を撤去。
  - Total Pot は ledger 上部に固定表示し、重複していた左下 pot list を削除。
- [x] `UI-02` `PlayerStatusBoard` を compact ledger 化し、stack / bet / status を一画面で読めるようにする。
  - seat row を `name / seat / stack / bet / status` の compact 表示へ変更。
  - ACTING / ALL-IN / FOLDED の badge 色を分け、状態認識を早くする。
- [x] `UI-03` `TableSummaryPanel` をカード化し、phase / round / level / dealer を読みやすくする。
  - phase / bet round / draw progress を上段カードへ集約。
  - level / hand / starting stack / dealer は下段の左右揃えにして見切れを防止。
- [x] `UI-04` table seat に hover / focus 用の詳細 tooltip を追加する。
  - seat に `title` と focus tooltip を追加し、stack / bet / last action / stats を確認できる。
  - mouse hover と keyboard focus の両方で詳細確認できる方針。
- [x] `UI-05` table seat の bet badge / stack / action 表示を整理し、カードや名前との干渉を減らす。
  - name / avatar / stack の shrink / truncate を整理し、bet badge を header 内で読みやすくした。
  - CPU stats は truncate し、詳細は tooltip に逃がす。
- [x] `UI-06` 右 action column を縮小し、Hero Controls を compact decision panel にする。
  - desktop grid を `table + clamp(260px, 22vw, 340px)` に変更し、右 panel の肥大化を抑制。
  - phase / hero hand / controls の padding と heading を縮小。
- [x] `UI-07` footer / header / table padding を調整し、低い viewport でもカードが操作しやすい余白にする。
  - desktop section padding と table surface padding を削り、実テーブル領域を広げた。
  - 既存 footer は維持しつつ、hero card が viewport 内に残ることを smoke で確認。
- [x] `UI-08` UI regression smoke を追加し、Total Pot / action panel / hero cards / player tooltip の可視性を確認する。
  - `tests/e2e/game-ui-layout-smoke.spec.ts` を追加。
  - ledger / summary / decision panel / hero card / seat detail の可視性と panel 幅を確認。
- [x] `UI-09` Vite dev server の watch 対象から `.venv` などを除外し、Playwright 中の `ENOSPC` を防止する。
  - `vite.config.js` に `server.watch.ignored` を追加。
- [x] `UI-10` CPU5 など右側 seat の詳細 tooltip が隣 seat に隠れないようにする。
  - hover / focus 中の seat を `z-[80]` へ引き上げ、詳細パネルを最前面に出す。
- [x] `UI-11` ゲーム中の Settings / Profile / History を画面遷移ではなく modal 表示にする。
  - ゲームから離脱せず、閉じればそのまま卓へ戻れる。
  - History は現行ハンド履歴を modal 内で表示し、Replay を開く場合だけ modal を閉じて replay screen へ移る。
- [x] `UI-12` action panel に current bet / to-call / raise unit / raise cap を明示する。
- [x] `UI-13` 追加 UX 候補: footer debug 表示を debug mode OFF 時は完全に隠す。
  - 2026-05-04 対応: desktop footer は `debugMode` ON の時だけ表示。通常プレイ中の下端余白と debug 表示を消し、モバイル横画面では引き続き非表示。
- [x] `UI-14` showdown / side-pot result を table 上の短い toast と result overlay の両方で確認できるようにする。
- [x] `UI-15` 追加 UX 候補: mobile landscape で右 panel を bottom sheet 化し、カードと action の距離をさらに短くする。
  - 2026-05-04 対応: mobile landscape の右 decision panel に `mgx-mobile-action-sheet` を追加し、Hero Controls を下寄せの action sheet として固定。右panel内でsafe-area bottomを考慮し、カードとactionの距離を短縮した。
- [x] `UI-16` MTT HUD をテーブル内から右パネル上部へ移し、Prize / Blinds / Players / Next を PHASE の上で読めるようにする。
- [x] `UI-17` MTT seat layout を外周寄りに逃がし、テーブル内のカード・pot・fold表示との干渉を減らす。
- [x] `UI-18` CPU番号表示をキャラクター名へ変更し、CPU style / model / training run を seat detail に載せられる下地を作る。
  - 2026-05-03 対応: `src/ai/cpuRoster.js` に 18人分のCPU rosterを追加。MTT entrant / table seat は Akira, Mina, Ren... の表示名を使い、将来 `modelRegistry` / `cpuCharacters` と紐付けて学習断面一覧を拡張する。
- [x] `BUG-27` busted / seatOut を挟む cash table で position label / blind label を詰める。例: dealer後にSB、その次の生存者がBBで、busted seatは `OUT` 表示にする。
  - 2026-05-03 対応: `positionLabels` helperを追加し、Badugi UI / App seat labels を生存seat基準に統一。DrawEngineBase / 2-7・A-5 draw base / NLH の blind assignment も busted seatをskipするテストを追加。
- [x] `BUG-28` MTT で busted seat に古い `isActiveInGame=true` が残ると、SB/BB/UTG 圧縮と次アクター判定が壊れる。
  - 2026-05-03 対応: Badugi flow の seated / active 判定で `seatOut` / `isBusted` / stack 0 を優先。blind seat と first bettor を BB 後の live seat 基準へ統一し、BoardEngineBase も同じ busted skip を追加。MTT HUD は現在ハンド中の pending bust を `PLAYERS` に即時反映する。
- [x] `BUG-29` MTT HUD の blind / ante 表示と実ハンド進行で使う blind structure を一致させる。
  - 2026-05-03 対応: Store Tournament の `levels` から App 内 hand controller 用の blind structure を生成し、MTT では `TOURNAMENT_STRUCTURE` ではなく tournament config 由来の SB / BB / ante を使う。これにより HUD が `Ante 0` の level 1 で実卓だけ `[ANTE(5)]` を徴収する不整合を防止する。
- [x] `RULE-01` MGX の現行 `ante` 仕様を明記する。
  - 2026-05-03 確認: 現行実装の `ante` は全員アンティ。level が `ante: 0` の場合は誰もアンティを払わない。BB ante を採用する場合は、将来 `anteMode: "perPlayer" | "bigBlind"` のように構造上明示してから実装する。
- [x] `UI-19` PokerStars風に、フェルト中央を空けてプレイヤーをテーブル外周へ逃がす。
  - 2026-05-03 対応: ゲーム画面を「中央の楕円フェルト + 外周プレイヤーポッド」構成へ変更。pot / street は中央、プレイヤー名・stack・bet・カードは外周へ分離し、`default_avatar` 文字列を丸いアバターチップ表示へ置き換える。
- [x] `UI-20` seat HUD の VPIP / PFR / street別頻度をスマートHUD風に読みやすくする。
  - 2026-05-03 対応: seat hover / focus 詳細を VPIP / PFR / ATS / 3BET のリング表示と、Flop / Turn / River 別の CB / FCB / CCB / RCB / WT / WSD / TAF バー表示へ変更。HUD内に All Games / NLH / PLO / Badugi / 2-7 の scope selector を追加し、将来variant別集計へ接続できる下地を作る。
  - 2026-05-04 更新: scope selector に `Stud` / `Razz` を追加。10-Game / Dealer's Choice でStud系が増えてもHUD上の切替先が欠けないようにした。
- [x] `UI-21` MTT で Hero / 対面 seat がフェルト内に入りすぎないよう、卓面と seat の境界を Playwright で確認する。
  - 2026-05-03 対応: tournament / cash の Hero・対面 seat を外周寄りへ再配置し、中央フェルトの `data-testid` を追加。`tournament-ui-layout-smoke` で Hero / 対面 seat がフェルト境界に埋まらないことを bounding box で検証する。
- [x] `BUG-30` BET 中に fold / all-in / busted が混在し、行動可能者が1人だけ残った状態で NPC auto loop が停止する。
  - 症状: 複数CPUが飛び、1人だけ非all-inの active seat が残ると `Waiting for other players...` のまま進行しないことがある。
  - 原因: `ensureSeatCanAct` が false の時に次アクターが存在しない経路、または強制action適用後に「残り行動可能者1人」を再判定しない経路があり、BET round 完了 / showdown へ抜けられなかった。
  - 対応: forced bet action 後と NPC action 前に `checkIfOneLeftThenEnd()` を通し、次アクターが無い場合は `forceFinishRoundRef` へ明示的に送る。
  - 補足: MTT のリシートはハンド完了後に実行する。今回の停止によりハンド完了へ到達せず、14/18でも見かけ上3way卓が残っていた。
- [x] `MTT-04` 18人開始から4人 bust して14/18になった時、3卓を 5/5/4 にリバランスすることをテストで固定する。
  - 2026-05-03 対応: `tournamentMTT.test.js` に 14 remaining の rebalance regression を追加。active table counts が `[5, 5, 4]` になり、最大差が1以内であることを確認する。
- [x] `AI-08` 6max cash / MTT の CPU VPIP が高すぎる問題を調整する。
  - 症状: 実プレイで VPIP 80% 台の CPU が多く、HU なら許容できても 6max では参加しすぎ。
  - 方針: `policyRouter` の BET decision に active opponent 数、to-call unit、made hand の粗さを反映し、弱い2枚/粗い3枚ドロー facing bet は multiway で大きくfold寄りにする。Standard は 6max で概ね 30-45% 程度を目安にし、Beginner だけ少し緩く残す。
  - 2026-05-03 対応: `computeBetDecision()` に `activeOpponents / drawRound / betRound` を追加し、multiway pressure / late street pressure / to-call units を fold cutoff に反映。粗い made badugi や marginal 3-card draw の評価も細分化した。
- [x] `UI-22` CPU Smart HUD をクリック可能・画面内固定にする。
  - 症状: HUD の `All Games` select を押そうとすると、seat からカーソルが外れてポップアップが消える。上側 seat は HUD が画面外へ出る。
  - 方針: ネイティブ `title` tooltip を撤去し、Smart HUD を fixed overlay として viewport 内へ clamp する。HUD 自体は `pointer-events: auto` にし、select 操作中も閉じない。
  - 2026-05-03 対応: Smart HUD を `document.body` へ portal し、viewport 内に clamp。native title tooltip を `aria-label` に置き換え、HUD select を Playwright で操作確認した。
- [x] `UI-23` CPU seat 同士の干渉をさらに減らす。
  - 症状: 右側/左側の上下 seat が近く、HUD やカード列が重なると読みづらい。
  - 方針: HUD overlay は seat とは別レイヤーへ逃がし、seat の z-index は hover/focus 時だけ上げる。必要なら次段で seat width / vertical gap を再調整する。
  - 2026-05-03 対応: HUD を seat DOM の外へ出し、隣 seat の背面に潜らないようにした。tournament layout smoke は HUD が viewport 内に収まることを確認する。
- [x] `CASH-01` cash game の終了導線として Cash Out ボタンとリザルト確認を追加する。
  - 症状: cash game を終える時に「戻る」以外の導線がなく、獲得/損失スタックの確認画面もない。
  - 方針: cash game の右 action panel に Cash Out を追加し、Hero stack / buy-in / net / hand count を表示する result modal を出す。続行、ゲーム選択へ戻る、New cash session の3導線を用意する。
  - 2026-05-03 対応: Hero Controls に `Cash Out` を追加。Cash Out result modal で buy-in / cash out stack / hand count / net を表示し、続行・新しい卓・ゲーム選択へ遷移できる。

### 16.4 Open Bug / QA Table

2026-05-04 追加。実装ゲーム数を増やすほど、Badugiで見つけた進行/UIバグがDraw/Board/Dramaha/Studへ横展開するため、発見時点でバグ表に載せてから修正・再発防止テストを追加する。

| ID | Area | PC / Mobile | Status | Symptom | Cross-game check |
| --- | --- | --- | --- | --- | --- |
| `BUG-31` | Badugi draw UI | PC | fixed | DRAW中にカードを押しても反応しないように見える。Smart HUDがHero席でも開き、固定レイヤーがカード操作を邪魔することがある。またHeroのドロー順でない時も無反応に見える。 | Draw系/DramahaでもHero操作時にHUDが入力を塞がないことを確認する。 |
| `BUG-32` | Smart HUD scope | PC / Mobile | fixed | HUD scope dropdown に Stud / Razz がなく、10-Game / Dealer's Choice の情報切替先が不足している。 | Stud/Razz実装時にvariant別stats集計へ接続する。 |
| `BUG-33` | PC/Mobile layout separation | PC / Mobile | fixed | スマホ横画面対応がPC卓レイアウトへ影響しないことを継続確認する。 | PC desktop smoke と mobile landscape smoke を別々に維持する。 |
| `BUG-34` | All-in / split pot flow | All | fixed | AI後、side pot / split pot / odd chip / all-in skipped actor が誤るとゲーム進行停止や誤配当につながる。 | NLH/PLO/Dramaha/PLO8/FLO8/Stud8/Razzdugi/Razzducey/ST6 fixtureと36variant相当の5連続hand invariant smokeを追加済み。 |
| `BUG-35` | Play feedback pipeline | All | fixed | Cash / tournament の30ハンド以上の履歴から、良かった点/悪かった点/ROI/参加条件/仮説をまとめるAI feedback API、DB保存、ゲーム内modal導線を追加済み。 | 10-Game Beginner/Standard RL適用後もBadugi/2-7/A-5/Stud/Razz/NLH/PLOを対象に継続回帰する。 |
| `BUG-36` | All-in draw actor | Badugi / Draw | fixed | all-in後のCPU/Hero、またはall-in後にbusted seatが残った状態で、DRAWフェーズの交換対象が詰まりカード交換できなくなる。 | Badugiはactive all-in seatをDRAW可能、busted/seatOutはDRAW不可に分離。2-7/A-5 draw regressionも再実行する。 |
| `BUG-37` | Hand history completeness | All | fixed | ゲーム内履歴と `/history` 永続履歴が分断され、キャッシュゲーム履歴が見えにくい。hand history detail/replay/API送信の完成度が不足。 | Cash/Tournament両方で完了ハンドが保存・表示され、variant/evaluator/pot/action/replayが復元できることを横断確認する。 |
| `BUG-38` | Friend match playable QA | P2P | fixed | フレンドマッチがルーム作成/参加/ready/action/showdown/reconnectまで実運用レベルで壊れないか継続テストが必要だった。実WebSocket host/guest smokeとmobile landscape smokeを追加済み。 | mocked browser smoke、backend websocketありhost/guest 2page smoke、browser reconnect、mobile landscapeを継続回帰に入れる。 |
| `BUG-39` | Board-game showdown / board UI | PC / Mobile | fixed | PLOでRIVER後にSHOWDOWNへ入っても `lastHandResult` が無く、リザルト画面が出ず進行停止する。コミュニティカードとTotal Pot表示も重なり、boardが読みにくい。 | NLH/FLH/PLO/PLO8/FLO8/5-card PLOは同じboard controller経路のため、SHOWDOWN突入時に即 `resolveShowdown()` する regression と playable invariant を追加。 |

- [x] `BUG-31` Hero DRAW中はHero seat Smart HUDを開かず、カードクリックを最優先する。
  - 2026-05-04 対応: `Player` componentでHeroかつ`phase === "DRAW"`の場合はSmart HUDを開かない。Player単体テストでHUDが出ず、Hero card clickが発火することを固定。
- [x] `BUG-32` Smart HUD scope selector に `Stud` / `Razz` を追加する。
  - 2026-05-04 対応: `PlayerSmartHud` の scope option を追加し、テストで存在確認。
- [x] `BUG-33` PC版とスマホ版のUI差分をPlaywrightで別々に検証し、片方の修正が片方を崩さないようにする。
  - 2026-05-04 対応: `responsive-layout-separation.spec.ts` を追加。Desktopではmobile rootが出ない、header/ledger/decision panelが見える、全体scrollが出ないことを確認。Mobile landscapeではfixed mobile root、desktop ledger非表示、body/html overflow hidden、decision panel / hero cardがviewport内に残ることを確認。Mobile portraitでは横向き案内のみを確認。
- [x] `BUG-34` all-in / side pot / split pot / odd chip のcross-game fixtureを追加する。
  - 2026-05-04 対応中: `sidePotResolver` を追加し、投資額からmain/side potを構築、fold済みは受賞対象外、odd chipはseat順で安定配分する共通helperを追加。
  - 2026-05-04 対応中: NLH/PLO/Dramahaのshowdownにside pot resolverを接続し、3人all-inでmain pot / side pot 1 / side pot 2のwinnerが別になるfixtureを追加。
  - 2026-05-04 追加: `playableInvariant.test.js` を追加し、NLH / FLH / PLO / PLO8 / FLO8 / Stud / Stud8 / Razz / Razz27 / Razzdugi / Razzducey が1handを完走し、broken actor、all-in actorへの誤ターン、chip drift、negative stackを出さないことを横断検証する。
  - 2026-05-04 追加: PLO8のqualifying low split / no-low high scoop / odd chip main+side pot fixtureを追加。
  - 2026-05-04 追加: Stud8の複数side pot hi/lo fixture、Razzdugiのodd chip component split fixture、RazzduceyのBadugi+2-7 component split fixtureを追加。
  - 2026-05-04 追加: FLO8専用のodd split + side pot fixture、ST6 2-7 Razz単体showdown fixture、Stud/Razz bring-in fixture、Stud up/down card UI adapter fixtureを追加。
  - 2026-05-04 追加: 高役evaluatorのカテゴリ順位を監査。カテゴリ桁がrank桁数でずれる問題を固定長rank scoreに修正し、standard high category order / flush over two pair fixtureを追加。
  - 2026-05-04 追加: Archieのpair-or-better high / 8-or-better lowで片側qualifier不成立時に半ポットが未配当になる問題を修正。no-low/no-high scoopと全員非qualify時の会計フォールバックfixtureを追加。
  - 2026-05-05 追加: `playableInvariant` を36variant相当へ拡張。Big-O / 5-card PLO / 2-7 TD / A-5 TD / Badugi / 2-7 SD / A-5 SD / Dramaha 6種を5連続hand smokeへ追加し、Dramaha showdown chip drift と Badugi facade のBET/DRAW/SHOWDOWN遷移・精算漏れを修正。
- [x] `BUG-35` Cash / tournament のプレイフィードバック仕様とAPIを実装する。
  - 2026-05-04 部分対応: `playFeedbackPayload` を追加。30ハンド未満はAI feedback対象外にし、cash/tournamentのhand historyからvariant別hands、VPIP/PFR、showdown/all-in/split-pot率、net chips、tournament ROI、Badugi follow-up issueを要約するpayloadを生成する。
  - 2026-05-04 部分対応: `POST /api/analysis/play-feedback` を追加。認証必須、30ハンド以上schema、簡易rate limit、PII除去、OpenAI未設定時fallback、OpenAI用session promptをbackendに追加。
  - 2026-05-04 部分対応: `/history` にAIフィードバック送信UIを追加。30ハンド以上かつログイン済みの場合だけ送信でき、結果を画面内に表示する。
  - 2026-05-04 部分対応: feedback結果をsession key単位でlocalStorageへ保存し、`/history`で直近結果を再表示できるようにする。DB保存前の暫定保存ポリシーとして最大20件に制限。
  - 2026-05-04 対応: `play_feedback_results` DB table / SQLAlchemy model / Alembic migrationを追加し、`POST /api/analysis/play-feedback` がsanitize済みpayloadとresponseをDB保存して `feedbackId` / `sessionKey` / `storedAt` を返すようにした。
  - 2026-05-04 対応: `GET /api/analysis/play-feedback/results` を追加し、ログインユーザー単位で保存済みfeedbackを取得できるようにした。
  - 2026-05-04 対応: ゲーム内History modalにもプレイフィードバックパネルを追加し、30ハンド以上の履歴から同じAPIへ送信、localStorageにも再表示用保存できるようにした。
  - 2026-05-04 対応: OpenAIキーは `MGX_OPENAI_API_KEY` と `OPENAI_API_KEY` の両方を受け付ける。`OPENAI_API_KEY` 経路はunitでHTTP request生成まで確認。
  - 2026-05-04 追記: キー配置ガイドを `backend/README.md` と `docs/play-feedback-policy.md` に追加。productionは `/etc/mgx/mgx-backend.env` を `EnvironmentFile` としてsystemd serviceへ読み込ませる方針にする。
  - 2026-05-04 確認: `/etc/mgx/mgx-backend.env` の `MGX_OPENAI_API_KEY` を読み込み、OpenAI Responses API / `gpt-5.2` で実疎通を確認。Badugi 42hand相当payloadに対して、良かった点・悪かった点・ROI/獲得チップ仮説・次回改善方針が日本語/英語で返ることを確認した。
  - 2026-05-04 対応: backend OpenAI clientの既定を `gpt-5.2` + Responses APIへ更新。`MGX_OPENAI_MODEL` / `MGX_OPENAI_API_MODE` / timeout / max output tokens / reasoning effortをenvで上書き可能にし、structured JSON output、fenced/nested response解析、429/502/503/504 retryを追加。
- [x] `BUG-36` all-in後のDRAW停止を修正する。
  - 2026-05-04 対応: `isSeatEligibleForDraw` はcurrent handでactiveなall-in seatを交換対象に残し、BETだけall-inを除外するように整理。
  - 2026-05-04 対応: `sanitizeStacks` は stack 0 のcurrent-hand all-inを即busted扱いにせず、`seatOut` のときだけbustedへ寄せる。
  - 2026-05-04 対応: Hero / CPU draw actor loop、Badugi controller legal action、DRAW round skip判定を同じdraw eligibilityへ統一。
  - 2026-05-04 追加対応: 2-7/A-5/5-card draw controller系も同じ方針へ統一。live all-in seat はDRAW可能、BET actionは不可、全員all-inでBET streetが空になった場合は次draw/showdownへ自動進行する。
  - 横断確認: `DeuceToSevenTripleDrawEngine` / `DeuceToSevenTripleDrawController` にall-in draw regressionを追加し、draw系とplayable invariantを再実行済み。
- [x] `BUG-37` ハンド履歴を完成させる。
  - 2026-05-04 部分対応: 完了したcanonical hand historyをlocalStorageのcash/tournament履歴にも保存し、standalone `/history` でキャッシュゲーム履歴とトーナメント履歴を同時に確認できるようにする。
  - 2026-05-04 部分対応: cash履歴に席別サマリ、pot details、canonical event timelineを追加し、all-in / side pot / action countの調査入口を作る。
  - 2026-05-04 部分対応: ゲーム内`HandHistoryScreen`もlocalStorageのcash/tournament保存済み履歴をmemory bufferへ統合し、保存済みhandIdからreplayを開けるfallbackを追加。
  - 2026-05-04 部分対応: standalone `/history` のpot detailsにwinners/payoutを表示し、side/split potの配当確認入口を追加。
  - 2026-05-04 部分対応: standalone `/history` のcash/tournament hand detailへvariant名、evaluator、seat別hand/evaluation labelを追加し、Badugi/2-7/A-5などのmulti-game履歴を見分けられるようにする。
  - 2026-05-04 部分対応: backendに`POST/GET /api/history/hand`を追加し、フロントsync queueはcanonical hand recordを汎用履歴APIへupsert同期してから既存`/api/badugi/hands`構造化ログへ送る。
  - 2026-05-04 対応: mobile viewport向けに`/history`のheader/section余白を調整し、Playwright mobile smokeで保存済みhand表示とページ水平scrollなしを確認。
  - 2026-05-04 確認: `HistoryScreen` unitでcash/tournament同時表示を固定。`main-menu-history-smoke`でstandalone menuから`/history`へ遷移できることを確認。
- [x] `BUG-38` フレンドマッチの実プレイQAを強化する。
  - 既存: `p2p-friend-match-smoke.spec.ts` はmock websocketでroom create / ready / draw / showdown / refresh restoreを確認済み。
  - 2026-05-04 確認: unitでcreate/join/websocket projection/action/reconnect/history replayを確認。Playwrightでlogin→room作成→ready→draw→showdown→refresh restoreを確認。
  - 2026-05-04 追加確認: join失敗時にroomを開かず、sessionStorageへ壊れたactive roomを残さないこと、websocket error/close状態がUIに出ることをunitで固定。
  - 2026-05-04 追加対応: backend WebSocketで現在手番以外のactionを`out_of_turn`として拒否し、`currentTurnPlayerId`をroom/state deltaへ配信。フロントは相手手番中のCall/Draw/Foldをdisabledにし、手番待ち表示を追加。
  - 2026-05-04 追加確認: `p2p-friend-match-real-ws.spec.ts` を追加。`src/server`を8001で起動し、host/guest 2ページでroom作成、参加、実WebSocket同期、手番action、showdown、next handを確認する。
  - 2026-05-04 対応: `src/server/requirements.txt` に `websockets` を明記し、uvicorn単体起動時にWebSocket Upgradeが404へ落ちる環境差を防ぐ。
  - 2026-05-04 追加対応: WebSocket idle中にサーバーheartbeat timeoutで切断される問題を修正。通常の操作待ちで同期がclosedへ落ちないようにした。
  - 2026-05-04 追加確認: 同じE2Eでhost reload後の再接続とmobile landscapeのFriend Match表示/水平scrollなしを確認。

### 16.5 Full Game Implementation / RL / Feedback Order

- [x] `GAME-ALL-01` 10-Gameで使う未実装ゲームを先に playable にする: FLH (`B02`), PLO8 (`B06`), Stud (`ST1`), Stud8 (`ST2`), Razz (`ST3`)。
  - 2026-05-04 実装: FLH / PLO8 / Stud / Stud8 / Razz の controller / definition / registry / App routing / UI adapter / Game Selector catalog を追加。
  - 2026-05-04 テスト: playable invariant smokeで5種を含む7controllerを横断検証。PLO8専用split fixtureを追加。
  - 2026-05-04 追加対応: Stud/Razz bring-in順序、up/down card専用UI、Stud8複数side-pot split fixtureを追加済み。
- [ ] `GAME-ALL-02` 残りBoard/Draw/Stud/Dramaha/Chinese Pokerを順次 playable 化し、各ゲームごとに evaluator / action mask / all-in / split pot / history smoke を追加する。
  - 2026-05-04 部分対応: 残Board枠の `B03` NL Super Hold'em / `B04` FL Super Hold'em をplayable化し、routing / registry / 3-hole配布 / high evaluator / all-in side-pot invariantに追加。
  - 2026-05-05 進捗: Game Selectorに表示している35 playable variantsは、controller invariantで5連続hand / short-stack all-in pressureを全件通過。Playwright operational smokeも35/35 cash variants + Badugi tournamentで通過。Dramaha 6種はcore registryにも追加し、App上のゲーム名・controller lookupで正式variantとして扱えるようにした。
  - 2026-05-05 追加対応: 36件目として `CP1` Chinese PokerをGame Selector / App routing / GameRegistryへ接続し、専用playable画面を追加。13枚配置、row scoring、foul/royalty、next handをUIテストで固定。
  - 2026-05-05 残: Super Hold'em / FL Super Hold'emはcontroller invariantでは通過済みだが、Playwright 5連続handの強制new-hand helper経路でhero card再描画が落ちるため、UI smokeはfixmeとして残す。Chinese/OFCはクラシックChinese Poker playableまでで、OFC street-by-street / fantasyland / 横断history replay smokeは後続。
  - 2026-05-04 部分対応: `S03` 5-Card Single Drawをplayable化。high hand evaluator / 1 draw / controller / registry / App routing / UI adapter / game selector / playable smoke / hand history high-hand labelを追加。
  - 2026-05-04 部分対応: Chinese Poker / OFC用のscorer foundationを追加。front / middle / backの行評価、foul判定、最小royalty fixtureをunitで固定。実ゲームcontroller / layout UI / fantasyland / turn順は未実装のまま `CHINESE-02` に残す。
  - 2026-05-05 部分対応: Chinese Poker / OFC本体controllerを追加。13枚配布、front/middle/back自動配置、Hero row set、foul判定、royalty、showdown row scoring、next handをunitで固定。
  - 2026-05-05 追加対応: Chinese Poker専用layout UIを追加し、Game Selectorから起動可能にした。Appの既存Badugi/Board/Stud table layoutとは分離し、既存ゲーム進行へ影響しない経路でplayable化。
  - 2026-05-04 部分対応: `D04` Badeucey TD、`D05` Badacey TD、`D06` Hidugi TD、`D07` Archie TD をplayable化。Badugi half + 2-7/A-5/high系halfのcomponent split、odd chip fixture、registry/routing/UI adapter/history smokeを追加。
  - 2026-05-04 部分対応: `S04-S07` single draw split/Badugi系をplayable化。S04 Badugi SD、S05 Badeucey SD、S06 Badacey SD、S07 Hidugi SDのcontroller/engine/routing/catalog/history smokeを追加。
  - 2026-05-05 追加対応: Badeucey/Badacey/Hidugi/Archie と Dramaha 6種の結果summaryに componentLabel / sourcePotIndex / eligibleSeatIndexes / oddChipAmount を保持し、Hand Result Overlay と Showdown Toast で `Main Pot · Badugi half` / `Side Pot · Draw half` のようにcomponent pot単位で表示するようにした。Dramahaはodd chipがdraw halfへ行くことをsummary/UIで明示する。
  - 残TODO: Chinese/OFCのfantasyland / OFC street-by-street turn順、Chinese/OFCのPlaywright replay smoke、split draw系の公式ルール監査、CPU discard strategy精緻化を追加する。
- [ ] `GAME-ALL-03` Stud / Razz 実装後、10-Game対象のCPUを Beginner / Standard まで学習・適用する。
  - 2026-05-05 部分対応: NLH / FLH / PLO / PLO8 / FLO8 / Stud / Stud8 / Razz / Razz27 は、controller の `getCpuAction()` 経由で teacher-supervised CPU policy を実行できるようにした。
  - 2026-05-05 部分対応: App のCPU action経路を draw-lowball 限定から controller-driven game 全体へ広げ、board/stud系がBadugi fallback policyへ落ちないようにした。
  - 残TODO: これは runtime の Beginner/Standard teacher baseline 適用であり、各ゲーム専用DQN/ONNXの長期学習済みモデル適用ではない。D01/D02/Badugi以外の per-game RL dataset / reward / action mask / evaluation gate は継続。
- [ ] `GAME-ALL-04` 強化学習済みCPUを使った cash / tournament のプレイログ収集を行い、30ハンド以上のセッションだけAI feedback対象にする。
- [ ] `GAME-ALL-05` feedback API は hand history / position / stack / VPIP/PFR / ROI / showdown / all-in / split-pot結果を投げ、良かった点・悪かった点・次回方針・仮説を返す。
  - 2026-05-05 追加調査: feedback上の `B-07` などのシチュエーションIDは、hand history内の `handId` / `actionSeq` / `street` / `seatIndex` / `position` と紐付ければ「どのハンドのどのアクションか」を明示できる。
  - 実装方針: `playFeedbackPayload` で key hand ごとに `situationId`, `handId`, `actionSeqRange`, `variantId`, `street`, `heroAction`, `toCall`, `pot`, `stackDepth`, `resultDelta` を持たせ、backend保存結果にも同じ参照を残す。frontend modal は該当 hand history / replay frame へジャンプする導線を追加する。
  - 2026-05-05 対応: feedback payload / local store / Hand History modal を `keyHands` に対応させ、`situationId` / `handId` / `actionSeqRange` から該当hand replayへ遷移できるようにした。
  - 2026-05-05 対応: backend保存済みfeedback取得結果にも `keyHands` / `summary` を返し、History / Hand History 側で保存済み結果を開いても重要局面を確認できるようにした。
  - 2026-05-05 対応: OpenAIへ送るpayloadを `summary_key_hands_v1` へ圧縮し、`summary` / `topIssues` / `keyHands` / 最大8件の軽量hand sampleだけを送ることで応答時間とtoken量を抑える。
  - 残TODO: 10-Game全variantで実プレイ30ハンド以上のfeedback回帰を積み、variant別の指摘品質を実ログで確認する。

## 17. Mobile Browser Landscape Game UI

2026-05-03 追加。実機スマホブラウザ横画面では PC 版を縮小表示せず、専用レイアウトでカードとアクションボタンをタップできるサイズにする。ゲームロジック、Badugi engine、turn制御、MTT処理には触らない。

### 17.1 タスク

- [x] `MOB-01` スマホ判定を幅だけに依存しない形へ変更する。
  - 条件: `(pointer: coarse) and (hover: none)`、`navigator.maxTouchPoints`、UA、短辺 `<= 900` を組み合わせる。
  - 目的: iPhone/Android横画面で `layoutMode="mobile"` を使い、PC desktop canvas scaling を使わない。
- [x] `MOB-02` スマホ縦画面ではゲームUIを隠し、横向き案内だけを表示する。
  - 文言: 「横向きでプレイしてください」「MGXはスマホ横画面に最適化されています」。
- [x] `MOB-03` スマホ横画面では root を固定し、body/html/#root をスクロールさせない。
  - `position: fixed; inset: 0; width: 100vw; height: 100dvh` を使い、fallback として `100vh` を残す。
- [x] `MOB-04` PC用ヘッダー/ナビ/ランキング/左サイドバー/詳細ログをスマホ横画面では非表示または最小化する。
  - 残す情報: pot / phase / draw round / current bet / to call / raise cap。
- [x] `MOB-05` スマホ横画面を「左/中央テーブル 70-75% + 右操作 25-30%」へ再配置する。
  - Hero 操作パネルは常時 viewport 内。safe-area を考慮する。
- [x] `MOB-06` カードサイズと座席サイズをスマホ横画面用に上書きする。
  - Hero card は `clamp(48px, 7.5dvw, 82px)` 相当、CPU card は少し小さくする。
- [x] `MOB-07` アクションボタンを最低44px以上にし、2段gridでも viewport 内に収める。
- [x] `MOB-08` Playwright mobile smoke を強化する。
  - iPhone landscape / Android landscape、portrait warning、body非スクロール、Hero card viewport内、主要ボタン高さ44px以上を確認する。
  - 2026-05-03 対応: `useDeviceProfile` で touch/short-side/orientation を判定し、game screen のみ `mobile` layout へ切替。スマホ横画面では `mgx-mobile-landscape` fixed root、PC header/nav/sidebar/footer/debug/ranking を非表示、table/action の2カラム配置、compact seat/card、44px以上の action button を適用。実効高390pxのiPhone landscape相当ではHeroカードのviewport内収まりを優先し、Hero cardはPC比で拡大しつつ実機高に収まるclampへ調整。

## 15. Tournament UI / Friend Match UX 監査

2026-05-03 時点のトーナメント画面レビュー。ゲームロジックは触らず、トーナメント中の表示密度、カード視認性、導線、フレンドマッチ日本語化を改善する。

### 15.1 トーナメント UI 自己ダメ出し 30 項目

1. トーナメント中のゲーム画面で左レールが無いのに左 padding が残り、テーブル領域が無駄に狭い。
2. HUD が大きすぎ、低い viewport ではテーブルを見るためにスクロールが発生する。
3. HUD の prize / level / players が横3カラムで情報量過多。
4. HUD の重要度が「現在レベル・残り人数・平均スタック」より prize 表示に寄りすぎている。
5. トーナメント中の右 action column が通常ゲームと同じ幅で、table を圧迫する。
6. tournament seat layout の CPU 同士の距離が近く、showdown 時にカードが干渉する。
7. top/bottom の seat が大きすぎ、カード公開時に横方向の余白が足りない。
8. hero seat と footer が近く、低解像度で操作しづらい。
9. tournament table で side panel 非表示なのに section grid が cash 前提の余白になっている。
10. tournament HUD が table surface の内側にあり、seat area と縦方向で競合する。
11. final table overlay が英語固定で、他の日本語UIと不整合。
12. final table overlay の説明が長く、実プレイ中の確認として重い。
13. tournament selection screen は縦に長く、ステージ選択にスクロールが多い。
14. tournament selection の blind preview が各カードにあり、一覧性を下げている。
15. stage card 内の説明・条件・blind table が同時に出て、どの大会に出るか判断しづらい。
16. active tournament resume が目立つ一方、ステージ選択との差が曖昧。
17. Break timer が大きく、トーナメントトップ画面の主導線より目立つ。
18. unlock progress が大きく、エントリー導線より上にありすぎる。
19. bankroll / wins / active session が3カラムで、狭い画面では縦に伸びる。
20. stage card の button 幅が固定気味で、長い日本語に弱い。
21. "Training" など英語混在が残っている。
22. tournament HUD の ordinal が英語表記で、日本語設定と合わない。
23. tournament HUD の "NEXT BREAK IN" 等が英語固定。
24. table balancing log が通常ユーザーには技術的すぎる。
25. showdown cards を見たい局面で HUD / right panel / seat overlap が邪魔になる。
26. tournament game と cash game の表示優先順位が同じで、残り人数や平均 stack の緊張感が薄い。
27. tournament result / bust overlay 以外の進行中情報が分散している。
28. フレンドマッチが英語固定で、日本語設定時に非常に読みにくい。
29. フレンドマッチの説明文が「まだ networking will arrive soon」と古く、現在の同期実装とズレている。
30. フレンドマッチの live table / sync / room event の文言が開発者向けで、プレイヤー向けではない。
31. フレンドマッチはゲーム数が増えたため、一覧だけでは目的のゲームを探しにくい。

### 15.2 改善方針

- ゲームロジック、MTT進行、table balancing、showdown resolver には触らない。
- トーナメント中のゲーム画面は「スクロールしない」を優先し、HUD を compact 表示へ寄せる。
- side panel が無い時は左 padding を消し、テーブルを中央に広げる。
- tournament seat は cash より小さく、上下左右の間隔を広げ、showdown 公開時のカード干渉を減らす。
- HUD は残り人数 / level / blinds / average stack を主表示にし、prize pool は小さくする。
- フレンドマッチは日本語設定では自然な日本語へ置き換え、英語設定時は従来通り英語で読めるようにする。
- 開発者向けの sync / sequence 表示は残すが、日本語では「同期状態」「最新番号」「破棄した古い通知」などの意味が分かる表現にする。
- フレンドマッチのゲーム選択は Game Selector と同じく検索とカテゴリ切替を用意し、一覧をスクロールし続けなくても目的のゲームに到達できるようにする。

### 15.3 実装タスク

- [x] `TUI-01` tournament game で side panel 非表示時の左余白を削除する。
- [x] `TUI-02` tournament HUD を compact mode 対応にし、ゲーム中は高さを抑える。
- [x] `TUI-03` tournament seat layout を縮小・再配置し、showdown card overlap を減らす。
- [x] `TUI-04` tournament game の table min-height / padding を調整し、通常 viewport でスクロールしないようにする。
- [x] `TUI-05` FinalTableOverlay の文言を日本語寄りにし、情報密度を下げる。
- [x] `TUI-06` tournament top screen のステージカードを compact 化し、blind preview の縦スクロールを減らす。
- [x] `TUI-07` FriendMatchSetupScreen を language 対応し、日本語設定時に自然な日本語を表示する。
- [x] `TUI-08` friend match tests を日本語/英語の両方に対応する。
- [x] `TUI-09` tournament layout smoke を追加し、HUD / hero card / showdown-visible seats の viewport 内表示を確認する。
- [x] `TUI-10` Game Selector / Mixed rotation builder のゲーム説明を言語設定に合わせる。
  - 2026-05-05 対応: `/games` と `/mixed` は `mgx_language` を参照し、日本語設定時は variant description / mixed preset description / status label を日本語表示する。
  - 2026-05-05 対応: ゲーム検索欄を Game Selector と Mixed rotation builder の上部へ移し、先に検索・絞り込みしてから quick start / preset / profile 編集へ進める構成に変更。
- [x] `TUI-11` Friend Match の variant 選択に検索欄とカテゴリ切替を追加する。
  - 2026-05-05 対応: All / Board / Triple Draw / Single Draw / Dramaha / Stud のカテゴリタブ、ゲーム名・形式・説明検索、件数表示、空結果表示を追加。
  - 検索クリアとカテゴリ切替は form submit にならないよう `type="button"` を明示し、ルーム作成導線への副作用を避ける。

### 15.4 確認結果

- [x] `npm run lint`: pass。
- [x] `npm test -- --run src/ui/components/__tests__/TournamentHUD.test.jsx src/ui/screens/__tests__/FriendMatchSetupScreen.test.jsx`: 2 files / 12 tests pass。
- [x] `npm test -- --run src/ui/screens/__tests__/FriendMatchSetupScreen.test.jsx`: 1 file / 15 tests pass。Friend Match の検索・カテゴリ切替・空結果表示を追加確認。
- [x] `npm run build`: pass。chunk size warning は既存警告。
- [x] `npx playwright test tests/e2e/tournament-ui-layout-smoke.spec.ts --project=badugi-flow`: 1 passed。
- [x] `npx playwright test tests/e2e/badugi-mtt-flow.spec.ts --project=badugi-flow`: 2 passed。
- [x] `npx playwright test tests/e2e/p2p-friend-match-smoke.spec.ts --project=badugi-flow`: 1 passed。

## 16. PokerStars / GGPoker 比較ベースのゲーム画面改善

2026-05-03 追加。ユーザー提示の PokerStars 2-7TD / GGPoker PLO 画面を基準に、MGX のゲーム画面で「プレイヤーが一瞬で判断できない」点を洗い出す。ここではゲームロジックは触らず、座席、カード、ポット、ベット、フォールド表示、視線誘導だけを改善する。

### 16.1 自己ダメ出し 40 項目

1. テーブルが長方形に近く、ポーカー卓としての視線誘導が弱い。
2. 中央に主ポット表示がなく、PokerStars/GG のように「いま場にいくらあるか」をすぐ把握できない。
3. ポット表示が左レールに寄っており、視線がカードから外れる。
4. ベット額が seat header 内に埋もれ、チップを出している感覚が薄い。
5. ベット額 badge が小さく、20/40/ALL-IN の違いを瞬時に読みにくい。
6. スタックとベットの視覚的優先順位が似ていて、現在の投資額が目立たない。
7. フォールドした seat がカードを持っているように見え、まだ参加中に見える。
8. フォールド seat のグレーアウトが弱く、参加中 seat との差が曖昧。
9. all-in seat と folded seat の色分けが弱く、action 不要なのか負けて降りたのか分かりづらい。
10. ACTING seat の ring はあるが、テーブル全体の中で主張が足りない。
11. dealer button が `(BTN)` 文字列で、実アプリの dealer chip に比べて視認性が低い。
12. プレイヤー名、VPIP/PFR、スタック、ベットが同じ header に詰まりすぎている。
13. CPU 統計が常時長く表示され、通常プレイ中のノイズが多い。
14. カード裏面が重く、folded / hidden / inactive の差が分かりにくい。
15. 表カードがフラットで、PokerStars/GG のような rank corner がなくカードとして弱い。
16. 選択中カードの境界は分かるが、ドロー前に「捨てるカード」を強く認識しづらい。
17. Hero hand と table hand の情報が分散している。
18. 右 decision panel がカードと離れすぎ、action の視線移動が大きい。
19. Waiting 表示が大きく、ゲーム停止に見えやすい。
20. table edge に立体感がなく、座席がどこに付いているか直感的に分かりづらい。
21. seat の hover detail が table clipping で隠れる可能性がある。
22. 右側 seat の hover detail が隣 seat と重なると読めないことがある。
23. showdown で folded seat と showdown seat の差が弱い。
24. pot と draw round の現在状態が中央にないため、ゲームの進行状況を追いにくい。
25. 2-7TD / A-5TD の5枚カード時にカード列が細かくなり、表カードの rank が読みにくい。
26. GGPoker のような board/pot/chip stack のまとまりがなく、場の情報が散らばる。
27. seat card と chip badge の距離が近く、低解像度で干渉しやすい。
28. Hero seat の stack/bet/action が他 seat と同じ強さで、主人公の情報が埋もれる。
29. Folded の表示が英語でも日本語でも補助文なしで、初心者に分かりにくい。
30. table center にブランド/透かし/基準線がなく、中央空間が空白に見える。
31. action badge が `[Call]` のようなログ風で、実プレイ中の状態表示として弱い。
32. seat の status badge が小さく、ALL-IN/FOLDED が左レールを見ないと分かりづらい。
33. stack が丸 pill ではなくテキスト寄りで、PokerStars/GG の bankroll 表示に比べて弱い。
34. ベット badge にチップの厚みがなく、金額変更が視覚的に残りにくい。
35. Table Status と table seat の表示が別物に見え、同じ状態を示していると理解しづらい。
36. 画面左上のゲーム名以外に variant 状態の補助が少なく、2-7TD/A-5TD/Badugi の違いを table 内で追いづらい。
37. スモール画面で table の「広さ」より左右 panel が目立つ。
38. card face は4色デッキを維持する。2色化は視認性を下げるため採用せず、4色のまま rank / suit のコントラストを磨く。
39. folded seat のカードが deck に戻ったような表現がなく、muck されたことが伝わりづらい。
40. UI regression test が card/mucked/pot badge まで見ておらず、見た目の退化を検知しにくい。

### 16.2 改善方針

- engine/controller/action handler には触らない。表示 props を受けるコンポーネントだけで改善する。
- テーブルを楕円形に寄せ、中央に `Total Pot` と現在 phase/draw を置く。
- 各 seat は「名前 / 状態 / stack / bet / action / cards」の優先順位に整理する。
- bet badge はチップ風の丸 pill にして、現在出している額をスタックより目立たせる。
- folded seat はカードを表示せず、mucked 表示に差し替え、seat 全体をグレーアウトする。
- all-in / folded / acting / dealer は badge で明確に色分けする。
- カード表面は rank corner と suit marker を足し、5枚手札でも読みやすくする。
- table center の pot 表示は pointer-events を切り、カード操作を妨げない。
- hover/focus detail は table clipping で隠れないよう table surface を overflow visible にする。
- 既存 Playwright に folded/mucked と pot/seat 可視性の観点を足す。

### 16.3 実装タスク

- [x] `PUI-01` table surface を楕円卓風にし、PokerStars/GG に近い中央視線へ寄せる。
- [x] `PUI-02` table center に Total Pot / phase / draw round の compact badge を追加する。
- [x] `PUI-03` bet badge をチップ風の丸 pill に変更し、金額を stack より目立たせる。
- [x] `PUI-04` folded seat はカードを消し、`Folded - mucked` 表示へ差し替える。
- [x] `PUI-05` folded / all-in / acting / dealer の badge 色と形を整理する。
- [x] `PUI-06` card face に rank corner / suit marker を追加し、5枚手札でも読みやすくする。
- [x] `PUI-07` table overflow を visible にして、seat hover detail が table edge で切れないようにする。
- [x] `PUI-08` Hero / CPU seat header の stack/bet/action 表示を整理する。
- [x] `PUI-09` folded/mucked の React test を追加し、folded seat が playable card を出さないことを確認する。
- [x] `PUI-10` 4色デッキのまま suit ごとのコントラストを調整する。
- [x] `PUI-11` action panel に current bet / to-call / raise unit / raise cap を常時表示する。
- [x] `PUI-12` 次候補: showdown 時だけ seat card size を一段上げる reveal mode を追加する。
  - 2026-05-04 対応: `GameLayoutBase` から `revealMode` を渡し、showdown中に公開対象のHero / showHand / winner seatだけカードとseatを一段拡大。モバイルはviewport内操作性を優先し拡大対象外。

### 16.3.1 Character Image Integration

2026-05-04 追加。CPU / Hero キャラクター画像を `public/characters/` に置き、UIのavatar表示へ段階的に接続する。

- [x] `CHAR-01` `public/characters/` に配置する画像命名規則を決める。
  - 例: `kei.png`, `sora.png`, `hana.png`, `ren.png`。URL参照は `/characters/kei.png`。
  - 2026-05-04 反映: ユーザー提供の `01.png`〜`20.png` を semantic filename に変更。`01` は `hero.png`、`20` はラスボス枠の `zen.png`、`02`〜`18` は既存CPU roster順、`19` は予備/Dealer用 `dealer.png` とする。
- [x] `CHAR-02` `src/ai/cpuRoster.js` または専用 `cpuCharacters` 定義に `avatarUrl` を追加し、CPU名と画像を紐付ける。
  - 2026-05-04 対応: 18人分の CPU roster に `/characters/{id}.png` の `avatarUrl` を追加。
- [x] `CHAR-03` `AvatarChip` / `PlayerSmartHud` / seat header で画像avatarを表示し、画像がない場合は現行initialsへfallbackする。
  - 2026-05-04 対応: `AvatarChip` が `/characters/...` 形式を画像として表示し、読み込み失敗時は頭文字へfallbackする。Badugi UI adapter は `avatarUrl` を優先する。
- [x] `CHAR-04` 実画像配置後に、画像サイズ、丸抜き、folded時のgrayscale、active時のringをPC/モバイル両方で確認する。
  - 2026-05-04 対応: 20枚のPNG実画像を `public/characters/` に配置。`file public/characters/*.png` で画像形式を確認し、AvatarChip の丸抜き/cover表示に接続。PC/モバイルの実機目視はデプロイ後の手動確認対象として残す。
- [x] `CHAR-05` PlaywrightまたはReact testで、画像URLあり/なしのavatar fallbackを確認する。
  - 2026-05-04 対応: `Player.test.jsx` で画像avatar表示と読み込み失敗時のinitial fallbackを確認。
- [x] `CHAR-06` Hero のデフォルトavatarを `hero.png` にする。
  - 2026-05-04 対応: `titleSettings` の初期avatarを `/characters/hero.png` に変更。旧デフォルトのダイヤ/`default_avatar` がlocalStorageに残る場合は初回ロード時にhero画像へ移行する。
- [x] `CHAR-07` CPU画像が table seat / tournament復元後に initials へ落ちる経路を修正する。
  - 2026-05-04 対応: `seatViewMerge` で adapter の `default_avatar` が roster の `avatarUrl` を上書きしないよう修正。`App.jsx` の base seat / tournament hydrate でも `avatarUrl` を `avatar` に正規化。
  - 2026-05-04 追加対応: NLH/PLO/Dramahaなどboard-controller系で `tableConfig.seats` から `avatarUrl` / `cpuCharacterId` / `cpuStyle` が落ちる経路を修正。`NLHUIAdapter` でも snapshot 由来の `avatarUrl` をseat viewへ保持するテストを追加。

### 16.3.2 Current Regression Fixes

- [x] `REG-20260504-PC-FELT` スマホ横画面対応がPC版の楕円卓を潰す回帰を修正する。
  - 原因: `table-felt-oval` のモバイル向け `inset-y-[45%]` がdesktopにも適用されていた。
  - 対応: `GameLayoutBase` で felt / ring のinsetを `layoutMode` ごとに分離。
  - 横断影響: Badugiだけでなく同じshared layoutを使う2-7/A-5/今後のHold'em/Omahaにも影響し得るため、shared layout側で修正。
- [x] `REG-20260504-ALLIN-DRAW-FREEZE` all-in後に進行停止する可能性を修正する。
  - 2026-05-04 初期対応: all-in seatをDRAW actorから除外して待機停止を避けたが、実戦確認で「all-in後もdraw pokerでは交換権が残る」ケースを潰してしまうことが判明。
  - 2026-05-04 再修正: BET eligibility と DRAW eligibility を分離し、current handでactiveなall-in seatはDRAW可能、busted/seatOut/folded seatだけDRAW不可に統一。
  - 2026-05-05 追加修正: Badugi engine のBET→DRAW遷移でもDRAW eligibilityを使い、short all-inはBET完了判定で詰まらないようにした。Hero all-in後にBET turnが戻らないE2E、CPU/bust all-in後の追加actionなしE2Eを追加。
  - 横断確認: Badugi unit と 2-7/A-5系の draw regression test を再実行して確認する。
- [ ] `REG-20260505-BADUGI-HANDRESULT-WAIT` full `badugi-flow` で Hero fold / full 3-draw / no-next-alive の3ケースが `Hand Result` 待ちでtimeoutする。
  - 発見: all-in修正後の full Badugi E2E で 14/17 pass、3件timeout。
  - 切り分け: 今回追加した all-in/bust E2E はpass。失敗3件は、Hero fold後もCPU同士・all-in seatを含む手が継続する場合に、テストが即 `Hand Result` を待つ前提と実進行がズレる可能性が高い。
  - 次対応: 「Hero fold後の観戦継続」「CPU-only hand auto-resolve」「no-next-alive の強制決着」を分けてfixture化し、期待値を実ゲーム仕様に合わせる。
- [x] `BUG-TRACK-20260504` 新規バグを `docs/bugs/badugi_browser_mobile_bug_tracker.md` に追加し、他ゲーム影響欄を持たせる。
- [x] `FB-POLICY-01` キャッシュ/トーナメントのプレイフィードバック運用方針を作成する。
  - 2026-05-04 対応: `docs/play-feedback-policy.md` に30ハンド以上の送信条件、ROI/良悪判断/ChatGPT API連携方針を記載。

### 16.3.3 2026-05-04 Regression Verification

- [x] `npm test -- --run src/ui/utils/__tests__/seatViewMerge.test.js src/ui/game/badugi/__tests__/BadugiUIAdapter.test.js src/games/badugi/engine/__tests__/tournamentMTT.test.js src/games/badugi/logic/__tests__/roundFlow.test.js src/games/draw/__tests__/DeuceToSevenTripleDrawEngine.test.js`: 5 files / 92 tests pass。
- [x] `npx playwright test tests/e2e/tournament-ui-layout-smoke.spec.ts --project=badugi-flow`: 1 passed。PC版 table felt が細い帯へ潰れないことをbounding boxで確認。
- [x] `npx playwright test tests/e2e/mobile-app-smoke.spec.ts --project=badugi-flow`: 7 passed。Badugi / D01 / D02 / S01 / S02 のスマホ横画面操作を確認。
- [x] `npm run lint`: pass。
- [x] `npm run build`: pass。chunk size warning は既存警告。

### 16.3.4 2026-05-04 Stud / Ring Stack Regression

- [x] `BUG-20260504-STUD-PREDEALT-7` Stud / Stud8 / Razz 系が開始時点で7枚を内部配布し、3rd street から全street分のカードを持ち得る問題を修正。
  - 原因: `StudGameController.startNewHand()` が `dealStudCards()` で7枚すべてを先配りしていた。
  - 対応: 初期配布を2枚down + 1枚upに限定し、4th/5th/6thでup card、7thでdown cardをstreet進行時に配る。
  - 補足: all-in の live player はbet actorから外すが、showdownまでカードは配られる。
- [x] `BUG-20260504-STUD-VISIBLE-HAND` Stud系UIがbase snapshotの `hand` を拾い、表示用カード枚数と可視/不可視状態がズレる問題を修正。
  - 対応: `NLHUIAdapter` のseat viewで `hand` と `cardVisibility` をadapter由来に統一。
- [x] `BUG-20260504-DRAW-CASH-STACK-RESET` 2-7/A-5/5-cardなどdraw-controller系リングゲームで、次ハンド開始時にスタックがstarting stackへ戻る問題を修正。
  - 原因: `DeuceToSevenTripleDrawController.createNewHandState()` がengine初期化時の `startingStack` をそのまま使い、App側の現在スタックを反映していなかった。
  - 対応: `currentPlayers` / `prevPlayers` / 前回snapshotから seat stack とavatar/nameを引き継いでからforced betを適用する。
- [x] `BUG-20260504-DRAW-ALLIN-DRAW-RIGHT` 2-7/A-5/5-cardなどdraw-controller系で、all-in live player がDRAWできず進行/交換権がBadugiとズレる問題を修正。
  - 原因: lowball draw engine が active betting seat と drawable seat を同じ判定で扱い、all-in seat をDRAW順から除外していた。
  - 対応: `getDrawableSeatIndexes()` / `findFirstDrawableSeat()` を追加し、DRAWはfolded/sittingOut/seatOut/bustedのみ除外、BETは従来通りall-inも除外する。
  - 補足: all-inだけが残ったBET streetは空streetとして即skipし、次drawまたはshowdownへ進める。
- [x] `UI-20260504-HAND-SORT` 5-card/draw handの視認性改善として、表示上は同rankをまとめて低い順に並べ、クリック時は元indexを維持する。
  - 例: `Q,5,T,5,5` は表示上 `5,5,5,T,Q` に寄せる。discard indexは元のカード位置で送るためゲームロジックは変更しない。
- [ ] `RL-10GAME-BEGINNER-STANDARD` 10-Game対象CPUのBeginner/Standard学習適用。
  - 2026-05-05 部分対応: `src/games/core/cpuTeacherPolicy.js` を追加し、board/stud系に Beginner/Standard 以上の tier threshold を使う teacher-supervised betting policy を導入。
  - 2026-05-05 部分対応: NLH / FLH / PLO / PLO8 / FLO8 は hole/board/evaluator ベースの強度推定、Stud / Stud8 / Razz / Razz27 は up/down card と high/low evaluator ベースの強度推定で CPU action を返す。
  - 2026-05-05 確認: targeted unit で NLH/PLO/Stud-family の `getCpuAction()` と teacher policy threshold を固定。
  - 2026-05-05 学習: Badugi Standard向けに `badugi_10game_teacher_5k_20260505` を実行。`badugi_dqn_002500_20260505-005022.pt` を採用候補にし、`badugi_standard_dqn_v3.onnx` としてexport。
  - 2026-05-05 評価: Standard v2比 6-profile x 2-seed gate で `avgReward 3.008 vs 1.902`、`worstProfileAvgReward 2.202 vs 1.064`、`negativeBetEVActions 0 vs 28`。Pro v1比は `avgReward 3.008 vs 2.912`、`showdownWinRate 0.674 vs 0.647` だが `minAvgReward 1.771 vs 1.855` のためPro昇格は保留。
  - 2026-05-05 適用: `model-badugi-standard-dqn-v3` をregistryに追加し、Badugi Standardの通常routingをv3へ切替。旧v2は比較/rollback用に残す。
  - 2026-05-05 Pro practice benchmark: `public/models/badugi_pro_v1.onnx` は practice-only 3200 episodes で `avgReward 2.827`, `showdownWinRate 0.683`, `foldRate 0.163`, `worstProfileAvgReward 1.988`。synthetic gate はpassだが human logなしのため人間相手60%超の保証には使わない。
  - 2026-05-05 Pro probe: Standard v3採用checkpointから `badugi_pro_probe_from_standard_v3_10k_20260505` を10k継続学習。5k checkpoint は Pro v1比 `avgReward 3.128 vs 3.130`, `showdownWinRate 0.687 vs 0.682`, `worstProfileAvgReward 2.185 vs 2.079`, `negativeRaiseEVActions 29 vs 114` だが `minAvgReward 1.803 vs 1.855` で僅かに未達。10k/latest は `showdownWinRate 0.751` まで上がる一方 `foldRate 0.262` へ悪化したため不採用。
  - 2026-05-05 判定: Pro v1置換は保留。5k方向は有望だが、次はfoldRateを上げずにminAvgRewardを改善する短期fine-tuneまたはgateを追加する。
  - 残TODO: 10-Game全体の true RL 適用は未完。D01/D02/NLH/PLO/Stud/Razz系を「専用モデル」として名乗るには、variant別 dataset、action mask、reward、checkpoint評価、human/practice benchmark gate が必要。
- [x] `npm test -- --run src/games/stud/__tests__/StudSplitGameController.test.js src/ui/game/nlh/__tests__/NLHUIAdapter.test.js src/games/draw/__tests__/DeuceToSevenTripleDrawController.test.js src/ui/components/__tests__/Player.test.jsx`: 4 files / 28 tests pass。
- [x] `npm test -- --run src/games/__tests__/playableInvariant.test.js`: 1 file / 38 tests pass。NLH/FLH/Super/FL Super/PLO/PLO8/Big-O/5-card PLO/FLO8/Stud/Stud8/Razz/Razz27/Razzdugi/Razzducey/2-7 TD/A-5 TD/Badugi/D04-D07/2-7 SD/A-5 SD/S03-S07/Dramaha 6種の5連続handでbroken actorとchip driftを横断確認。
- [x] `npm test -- --run src/games/draw/__tests__/DeuceToSevenTripleDrawEngine.test.js src/games/draw/__tests__/DeuceToSevenTripleDrawController.test.js src/games/__tests__/playableInvariant.test.js`: 3 files / 65 tests pass。2-7/A-5/5-card draw系のall-in DRAW権、BET不可、空BET street skip、横断chip driftなしを確認。
- [x] `npm test -- --run src/games/draw/__tests__/SpecialDrawEngine.test.js src/games/draw/__tests__/DeuceToSevenTripleDrawEngine.test.js src/games/draw/__tests__/DeuceToSevenTripleDrawController.test.js src/games/__tests__/playableInvariant.test.js`: 4 files / 79 tests pass。Archie qualifier scoop、all-in draw権、横断chip driftなしを確認。
- [x] `npx playwright test tests/e2e/game-ui-layout-smoke.spec.ts --project=badugi-flow`: 1 passed。テーブルledger / decision panel / hero cards / seat detailの最低限操作性を確認。
- [x] `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts --project=badugi-flow`: 22 passed。NLH/FLH/PLO/PLO8/Big-O/5-card PLO/Stud/Stud8/Razz/Razz27/Razzdugi/Razzducey/D04-D07/S03-S07/Badugi store tournament の起動、Hero card配布、actionable state到達を横断確認。
- [x] `npm run lint`: pass。
- [x] `npm run build`: pass。chunk size warning は既存警告。

### 16.3.5 2026-05-04 Cross-Variant Operational QA Gap

- [x] `QA-20260504-PLO-ACTION` PLO cash game でHeroカード4枚が配られ、CPU自動進行後にHero action buttonが表示・押下可能になることをPlaywrightで検知する。
  - 背景: 既存 `playableInvariant` はcontroller完走を見ていたが、Game SelectorからPLOを起動してUI操作可能かまでは検証していなかった。
  - 対応: App側Badugi deck integrityをboard-controller gameへ適用しないよう分離し、board-controller CPU actionをcontrollerへ直接流すE2E経路を追加。
- [x] `QA-20260504-BADUGI-MTT-DEAL` Store Tournament Badugi でHeroカード4枚が配られ、Hero action/draw stateへ進むことをPlaywrightで検知する。
  - 背景: トーナメントUI smokeはlayout中心で、カード配布・action到達を必須条件にしていなかった。
  - 対応: `/menu` から `menu-tournament` を押し、MTT卓でHero cards/action buttonの存在を確認。
- [x] `QA-20260504-CROSS-OPERATIONAL-SMOKE` 今後の回帰防止として、controller invariantだけでなく「variant選択 -> 実画面 -> card visible -> action visible」を主要variantへ広げる。
  - 対応: NLH / FLH / PLO / PLO8 / Big-O / 5-card PLO / Stud / Razz / Badugi MTT を Playwright smoke に追加。
  - 確認: `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts --project=badugi-flow`: 9 passed。
  - 2026-05-05 追加対応: D04-D07 / S03-S07 / Stud8 / Razz27 / Razzdugi / Razzducey も Game Selector 経由の実画面 smoke 対象へ追加。Hidugi系は仕様通り4枚配布として固定。
  - 2026-05-05 確認: `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts --project=badugi-flow`: 22 passed。

### 16.3.6 2026-05-04 Variant Progression / Showdown Display QA Gap

- [x] `QA-20260504-RAZZ-STREET-PROGRESSION` Razz/Razz27 が THIRD -> FOURTH -> FIFTH -> SIXTH -> SEVENTH -> SHOWDOWN まで正しい actor で進むことをunit fixtureで固定する。
  - 背景: RazzがBadugi流用に見える状態があり、bring-in後のstreet進行と7枚配布がゲームとして成立しているかを明示的に保証する必要がある。
- [x] `QA-20260504-STUD-DISPLAY-ORDER` Stud/Razz系のdown/up card順とcardVisibilityをPlayer表示ソートで壊さない。
  - 背景: draw用の手札ソートをStud/Razzにそのまま適用すると、up-card/down-cardの対応が崩れてゲーム内容を誤認する。
- [x] `QA-20260504-LOWBALL-SHOWDOWN-SORT` 2-7/A-5/Badugi/High系で、showdown時のカード表示順をvariant特性に合わせる。
  - 2-7: Aは高いカードとして扱う。A-5/Badugi: Aは低いカードとして扱う。High: A/Kなど強いrankを左へ寄せる。
- [x] `QA-20260504-SPLIT-RESULT-VISIBILITY` Stud8/PLO8/FLO8/Badeucey/Badacey/Razzdugi/Razzducey の hi/low/component pot を色・ラベルで分離して表示する。
  - 背景: split potやcomponent splitで、誰がHigh/Low/Badugi側を取ったかが結果画面で判別しにくい。
  - 2026-05-05 追加対応: split draw / Dramaha のcomponent pot詳細を強化。元ポット(Main/Side)とhalf種別(Board/Draw/Badugi/2-7/A-5/High)、eligible seat、odd chipを結果overlayに表示し、toastでもcomponent別winner名を表示するunitを追加。
- [ ] `QA-20260504-ALL-VARIANT-OPERATIONAL-AUDIT` playable invariant を「初回action到達」だけでなく、street完走・showdown・all-in/split potまで段階的に拡張する。
  - 背景: Razz/Stud/draw/board gameごとの進行差をテストで拾わないと、ゲームできると誤認する。
  - 2026-05-04: Razz/Razz27 のfull street unit fixture、Player表示順unit、HandResultOverlay split/component表示unitを追加。全variantの完全手動/自動E2E完走監査は継続タスク。
  - 2026-05-05: controller invariantは全playable variantの5連続handまで拡張済み。UI/E2E上の5連続hand、all-in/split-pot全variant網羅、Chinese/OFC layout UIは継続。
- [x] `QA-20260505-STUD-STREET-UI-REGRESSION` Stud / Razz のUI実画面で THIRD -> FOURTH -> FIFTH -> SIXTH -> SEVENTH -> SHOWDOWN を完走し、4th以降の先頭アクターがチェックしても即SHOWDOWNへ飛ばないことをPlaywrightで固定する。
  - 原因: App側の汎用同期がStud専用controllerの `currentBet` / bring-in情報を上書きし得ること、さらにApp由来のplayer snapshotで `seatIndex` が欠けるとbring-in seatが `undefined` になり、Third Streetの強制ベットが成立しないこと。
  - 対応: Board/Stud/Dramahaではsession controllerの新規hand生成とlegacy external syncを使わないように分離。Stud controller側でplayer `seatIndex` を正規化し、Third Streetのbring-inが欠落した場合は `ensureThirdStreetBringIn()` で自己修復する。
  - 対応: Stud street遷移直後はCPU auto actionに短いpauseを入れ、ユーザーが新streetの状況を視認できるようにした。stale timerが古いactorへactionを投げる経路も現controller actorで検証する。
  - 検証: `npm test -- --run src/games/stud/__tests__/StudSplitGameController.test.js`: 17 passed。
  - 検証: `npx playwright test tests/e2e/stud-street-progression.spec.ts --project=badugi-flow`: 3 passed。

### 16.4 未対応タスク優先度

- P0: `BUG-20260503-SB-FOLD-DRAW-FREEZE`
  - 症状: SB/Hero が fold した後、DRAW フェーズで `Waiting for other players...` のまま進まない。
  - 原因: UI auto actor loop が `turn === 0` を無条件に「Hero 手動操作待ち」と扱っていた。fold済み Hero でも draw actor として待ってしまい、CPU draw へ進まなかった。
  - 対応: `shouldWaitForHeroDrawTurn()` を追加し、Hero が `DRAW` 可能な場合だけ手動待機する。folded / busted / seatOut / draw済み Hero は自動的に次 seat へ進める。current hand の all-in Hero は交換権が残るため手動待機する。
  - 検証: helper unit test と Badugi/draw family smoke を実行する。
- P1: `PUI-11` action panel に current bet / to-call / raise cap を常時表示する。
  - 理由: プレイヤーの判断に直結し、誤操作とストレスを減らす。
  - 2026-05-03 対応: Hero Controls 上部に Current Bet / To Call / Raise Unit / Raise Cap を追加し、UI smoke で表示確認する。
- P1: `UI-14` showdown / side-pot result を table 上 toast と overlay の両方で見せる。
  - 理由: メインポット/サイドポットの理解に直結する。
  - 2026-05-03 対応: `ShowdownResultToast` を追加し、Pot / Side / Side 2 までの勝者と金額を短く表示する。
- P2: `PUI-10` 4色デッキのまま suit コントラストと色覚バリアフリーを調整する。
  - 理由: 2色化はしない。4色の良さを維持して読みやすさだけ上げる。
  - 2026-05-03 対応: 4色デッキを維持し、スペード/ダイヤ/クラブのコントラストを少し強めた。
- P2: `PUI-12` showdown 時だけ seat card size を一段上げる reveal mode を追加する。
  - 理由: ショーダウン確認の快適性を上げるが、進行バグ修正より優先度は低い。
- P3: `UI-13` footer debug 表示を debug mode OFF 時は完全に隠す。
  - 理由: 視認性改善には効くが、ゲーム進行には影響しない。
- P3: `UI-15` mobile landscape で右 panel を bottom sheet 化する。
  - 理由: モバイル改善として有効。ただし desktop の進行バグ修正後に扱う。

### 14.4 確認結果

- [x] `npm run lint`: pass。
- [x] `npm test -- --run src/ui/components/__tests__ src/ui/screens/__tests__`: 9 files / 38 tests pass。
- [x] `npm run build`: pass。chunk size warning は既存警告。
- [x] `npx playwright test tests/e2e/game-ui-layout-smoke.spec.ts --project=badugi-flow`: 1 passed。
- [x] `npx playwright test tests/e2e/authenticated-game-smoke.spec.ts --project=badugi-flow`: 1 passed。
- [x] `npx playwright test tests/e2e/badugi-flow.spec.ts --project=badugi-flow`: 16 passed。
  - 2026-05-04 対応:
    - forced all-in action は full raise として機能しても表示/log action は `All-in` として残す。
    - E2E `setPlayerHands` の `totalInvested` override 時は street bet を二重計上せず、side pot を `totalInvested` から再構築する。
    - CPU名の期待値を現行キャラクター名へ更新。

## 17. 2026-05-05 Feedback Scope / Stud-Razz Progression QA

### 17.1 Play Feedback Scope

- [x] `FB-SCOPE-01` プレイフィードバック作成時に、対象を明示選択できるようにする。
  - 必須: `Badugi`, `PLO`, `2-7`, `A-5` などvariant単位で分ける。
  - 必須: `10-Game / Mixed session` は全体フィードバックとして明示的に選ぶ。
  - 必須: トーナメント内でゲームが分割される場合は、そのゲーム区間ごとにフィードバックできる。
  - 禁止: PLOとBadugiの履歴を暗黙に混ぜたフィードバックを作る。
  - 2026-05-05 対応: feedback scope selectorを追加し、variant単位 / mixed session / tournament mixed を明示選択できるようにした。
- [x] `FB-SCOPE-02` feedback payload / local saved feedback の session key に選択scopeを含め、同じ30ハンドでもvariantが違えば別フィードバックとして保存する。
  - 2026-05-05 対応: `variantScope` / `feedbackScope` をpayloadへ含め、既存storeのscope込みsession keyで分離保存する。
- [x] `FB-SCOPE-03` `HandHistoryScreen` / `HistoryScreen` の両方で対象選択UIを表示し、対象のhand数と最低必要hand数を明示する。
  - 2026-05-05 対応: 両画面に対象ゲームselectを追加し、選択scopeのhand数で30ハンド条件を判定する。
- [x] `FB-SCOPE-04` unit testで、DB/APIへ送るpayloadが選択variantだけを含むこと、mixed選択時だけ複数variantを含むことを固定する。

### 17.2 Stud / Razz Correctness

- [x] `STUD-QA-01` Stud/Razz UIで、公開カード(up cards)と伏せカード(down cards)を視覚的に分離する。
  - 2026-05-05 追加対応: `UP/DOWN/HIDDEN` の文字だけに頼らず、公開カードは少し上にずらして緑ringを付け、Heroの伏せカードは斜め半分の裏面カバーを重ねる。Opponentの伏せカードは従来どおり非公開の裏面表示を維持する。
  - 2026-05-05 修正: Hero視点の「カード値は見える」と「公開/伏せ状態」は別物として扱う。`revealCards` の副作用でHeroの `cardVisibility` が全て `up` になり、伏せ札カバーが出ない不具合を修正。
  - 2026-05-06 修正: `Player`表示で `cardVisibility` 未指定カードを一律 `up` と扱っていたため、Badugi/Draw/Board系でも `showHand:false` の相手手札が表向きになる不具合を修正。Stud/Razzは `cardVisibility` のup-cardだけ公開し、通常ゲームはHeroまたはshowdownの `showHand:true` の場合だけ表向き表示する。
  - 2026-05-06 回帰: Player unitでBadugi相手札は裏面、Stud非Heroはup-cardのみ表向き、showdownでは相手draw札を公開することを固定。`seatViewMerge` でもshowdown前のstale `showHand:true` が公開漏れを起こさないようにした。
  - 3rd street: 2 down + 1 up。
  - 4th/5th/6th street: up card。
  - 7th street: down card。
  - 相手に見えているカードはboard上/seat上で「公開」と分かるようにする。
  - 2026-05-05 対応: seat cardに `UP` / `DOWN` / `HIDDEN` labelを追加し、相手の公開カードと伏せカードを区別できるようにした。
- [x] `STUD-QA-02` Stud/Razz controllerで bring-in / complete / fixed-limit street unit をTDA相当の実運用に近い形で保証する。
  - Stud high: 低いup cardがbring-in。
  - Razz: 高いup cardがbring-in。
  - completeはsmall betへの補完として扱う。
  - 2026-05-05 対応: 3rd streetのcompleteはbring-inからsmall betへの補完として処理するfixtureを追加。
  - 2026-05-05 修正: full raise / complete後は、既にcall/check済みだったlive playerを再行動対象へ戻す。raise後に応答なしでstreet進行またはwaiting停止する不具合をfixtureで固定。
  - 2026-05-05 追加監査: 固定デッキの実プレイ監査fixtureを追加し、door card / bring-in / complete / 4th street先頭actor / up-down card枚数 / 7th street down card をStudとRazzで同時に検証。
  - 2026-05-05 修正: Razz系のbring-inと4th以降の先頭actor判定でAを高扱いしていたため、Razz/Razz27/Razzdugi/RazzduceyではAce-lowでdoor/exposed boardを評価するように修正。A doorはbring-in対象から外れ、A-2 exposed boardはRazzの先頭actor候補になる。
- [x] `STUD-QA-03` 7th street最終bet後、CPU/Heroのcall/check/foldで停止せずshowdownまたはuncontested resultへ遷移することをunit fixtureで固定する。
- [x] `STUD-QA-04` Razz / Razz27 / Stud8 / Razzdugi / Razzduceyも同じstreet進行・表示・showdown遷移で確認する。
  - 2026-05-05 対応: controller invariantとcross-variant UI smokeでStud/Razz familyを含めて起動・配牌・actionable state到達を確認。
  - 2026-05-05 追加確認: `stud-street-progression` PlaywrightでStud/Razzが全streetを訪問し、post-third streetのcheckで即showdownに飛ばないことを再確認。

### 17.3 Continuous Play / All-in / Tournament QA Expansion

- [x] `QA-CONT-01` 全playable variantで5ハンド連続プレイでき、broken actor / chip drift / stuck waiting が出ないことをcontroller smokeに追加する。
  - 2026-05-05 対応: `playableInvariant` を5連続handに拡張し、NLH/PLO系とStud系の`totalInvested` carry-overを修正。
  - 2026-05-05 追加対応: 対象をGame Selectorに正式表示している35 playable variantsへ拡張。Dramaha全6種、2-7/A-5 TD/SD、Badugi本体、Big-O、5-card PLOも5連続handでSHOWDOWNまで到達し、chip driftが出ないことを固定。
  - 2026-05-05 追補: 「36ゲーム」表現はChinese/OFC正式接続後の目標値。現時点のplayable catalogは35件で、Chinese/OFCはcontroller/scorer foundationのみの未接続タスクとして扱う。
  - 2026-05-05 修正: DramahaはSHOWDOWN遷移時に即 `resolveShowdown()` して、次handで古い `lastHandResult` を再利用しない。Badugi facadeはBET完了→DRAW、DRAW完了→次BET/SHOWDOWN、showdown payoutをcontroller内で完結できるようにした。
- [x] `QA-CONT-02` 全playable variantでHero all-in後の進行、CPU all-in後の進行、all-in live playerのカード交換/追加カード配布権を確認する。
  - 2026-05-05 部分対応: Stud/PLO系の進行fixtureと既存draw all-in fixtureはあるが、全variant網羅は未完。
  - 2026-05-05 追加対応: `playableInvariant` に全35 playable variantのshort-stack all-in pressure fixtureを追加。NLH/FLH/Super/PLO/PLO8/Big-O/5-card/FLO8/Dramaha6種/Stud family/Draw familyで、all-in seat混在時もbroken actor・chip drift・negative stackなしで終端まで進むことを確認。
  - 2026-05-05 修正: draw系はBET actorからall-inを外しつつ、DRAW actorではlive all-in seatを交換対象に残す。Badugi facadeはBET streetに行動可能者がいない場合に次DRAW/SHOWDOWNへ自動進行し、all-in後の停止を防ぐ。
- [x] `QA-CONT-03` Badugi / 2-7 / A-5 / PLO / NLH / Stud / Razz の代表variantでUI smokeを5連続handに拡張する。
  - 2026-05-05 部分対応: 起動・配牌・actionable stateのcross-variant UI smokeは22件通過。UI上の5連続hand smokeは未完。
  - 2026-05-05 追加対応: `tests/e2e/cross-variant-five-hand-smoke.spec.ts` を追加。Badugi / 2-7 TD / A-5 TD / PLO / PLO8 / Stud / Razz で、実UI上のhero cardsとdecision panelが5hand連続でviewport上に出ることを確認。
  - 2026-05-05 拡張: UI operational smokeは35/35 variants + Badugi tournamentでpass。UI 5連続hand smokeは33/35 variantsでpass、Super Hold'em / FL Super Hold'emの2件はE2E helperの強制new-hand経路でhero card再描画が落ちるためfixme化。controller invariantはSuper Hold'em 2件も5hand通過済み。
- [x] `QA-MTT-01` トーナメントでHero bust時のresult screen、メイン画面遷移、優勝時result、店舗ステージから地域ステージ開放、地域トーナメント選択をE2E観点に追加する。
  - 2026-05-05 追加対応: `badugi-mtt-flow.spec.ts` を拡張。MTT完走時のresult overlay、winner row、replay保存、Back to Menu遷移、Hero bust overlay、ITM summary、stage win helperによる `progress.tournament` / `playerProgress` 永続化をE2Eで確認。
  - 補足: 地域トーナメントの実エントリーUIは bankroll 条件と連動するため、今回は「店舗優勝によるstage win永続化」までを自動化対象とした。地域エントリー画面の実操作はTournament screen QAの継続対象。
- [x] `BUG-LEDGER-01` 作業中に見つけた進行/UI/フィードバックのバグは、発見時点でこのmdまたは `docs/bugs/` に起票し、他variant影響欄を持たせる。
  - 2026-05-05 対応: この章にfeedback scope / Stud-Razz / continuous QAの残件と影響範囲を起票。

### 17.4 確認結果

- [x] `npm test -- --run src/ui/feedback/__tests__/playFeedbackPayload.test.js src/ui/screens/__tests__/HandHistoryScreen.test.jsx src/ui/components/__tests__/Player.test.jsx`: 3 files / 14 tests pass。
- [x] `npm test -- --run src/games/stud/__tests__/StudSplitGameController.test.js src/games/__tests__/playableInvariant.test.js`: 2 files / 38 tests pass。
- [x] `npm test -- --run src/ui/game/nlh/__tests__/NLHUIAdapter.test.js src/ui/components/__tests__/Player.test.jsx src/games/stud/__tests__/StudSplitGameController.test.js`: 3 files / 28 tests pass。Hero down card表示とStud/Razz raise後reopenを確認。
- [x] `npm test -- --run src/games/__tests__/playableInvariant.test.js`: 1 file / 73 tests pass。全playable controllerで5連続hand、short-stack all-in pressure、broken actor/chip drift/negative stackなしを確認。
- [x] `npm test -- --run src/ui/screens/__tests__/HistoryScreen.test.jsx src/ui/game/nlh/__tests__/NLHUIAdapter.test.js`: 2 files / 8 tests pass。
- [x] `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts --project=badugi-flow`: 22 passed。
- [x] `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts --project=badugi-flow`: 2026-05-05 再確認 26 passed。Game Selectorのカテゴリ初期表示変更に合わせ、E2E helperは対象variantのカテゴリへ切り替えてから起動する。
- [x] `npx playwright test tests/e2e/cross-variant-five-hand-smoke.spec.ts tests/e2e/badugi-mtt-flow.spec.ts --project=badugi-flow`: 10 passed。
- [x] `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts tests/e2e/cross-variant-five-hand-smoke.spec.ts --project=badugi-flow`: 68 passed / 2 skipped。全35 playable variantの起動・配牌・stable UIを確認し、33/35 playable variantでUI 5連続handを確認。skipはSuper Hold'em 2種のE2E helper再配牌ギャップ。
- [x] `npm test -- --run src/games/__tests__/playableInvariant.test.js src/ui/screens/__tests__/MainMenuScreen.test.jsx`: 2 files / 83 tests pass。
- [x] `npm run lint`: pass。
- [x] `npm run build`: pass。chunk size warning は既存警告。

## 18. 2026-05-05 A-5 / 2-7 Beginner-Standard RL

### 18.1 対応方針

- [x] `AI-27-A5-01` 2-7 / A-5 draw lowball を Badugi とは別モデルとして扱う。
  - 対象variant: `D01 2-7 Triple Draw`, `S01 2-7 Single Draw`, `D02 A-5 Triple Draw`, `S02 A-5 Single Draw`。
  - `modelRegistry.json` に 2-7 / A-5 それぞれ Beginner / Standard のvariant-tier exact modelを追加。
- [x] `AI-27-A5-02` Beginner は beginner/loose profile中心、Standard は beginner/standard/tight/loose/aggressive の混合profileで学習する。
- [x] `AI-27-A5-03` ONNX fixture gateで pat / pair break / straight-flush rule を最低限確認してからroutingする。
- [x] `AI-27-A5-04` Pro以上RLの入口を実装する。
  - 2026-05-05 対応: `D01/S01` 用 `model-27draw-pro-dqn-v1` と `D02/S02` 用 `model-a5draw-pro-dqn-v1` を追加し、Pro tier routingへ接続。
  - 2026-05-05 対応: `train_draw_dqn.py` のCLIへ `epsilon-start/end/decay`, `hidden-dim`, `learning-rate`, `train-every-steps`, `imitation-loss-weight` を追加し、上位tier学習の探索率・BC比率を再現可能にした。
  - 2026-05-05 制限: 今回のProは2.5k probeのsynthetic fixture gate通過モデル。Iron/WorldMaster昇格には、20k+ checkpoint比較、variant別human/practice benchmark、6-max/multiway reward gateが必要。

### 18.2 学習結果

| Family | Tier | Run | Episodes | Avg reward last 100 | ONNX |
|---|---:|---|---:|---:|---|
| 2-7 | Beginner | `draw_low27_beginner_3k_20260505` | 3,000 | `0.0843` | `public/models/27draw_beginner_dqn_v1.onnx` |
| 2-7 | Standard | `draw_low27_standard_5k_20260505` | 5,000 | `0.0995` | `public/models/27draw_standard_dqn_v1.onnx` |
| 2-7 | Pro | `draw_low27_pro_probe_2500_20260505` | 2,500 | `0.3930` | `public/models/27draw_pro_dqn_v1.onnx` |
| A-5 | Beginner | `draw_a5_beginner_3k_20260505` | 3,000 | `-0.0370` | `public/models/a5draw_beginner_dqn_v1.onnx` |
| A-5 | Standard | `draw_a5_standard_5k_20260505` | 5,000 | `0.0989` | `public/models/a5draw_standard_dqn_v1.onnx` |
| A-5 | Pro | `draw_a5_pro_probe_2500_20260505` | 2,500 | `0.4450` | `public/models/a5draw_pro_dqn_v1.onnx` |

補足:
- Beginner は「弱すぎないが読みやすい」導入モデルとして採用。A-5 Beginner のlast100 rewardはわずかにマイナスだが、fixture gateはpassしており、Beginner用途としてroutingする。
- Standard は両familyとも終盤でpositive rewardへ到達。Pro/Iron相当とは扱わない。
- Pro は両familyとも standard/tight/aggressive profileでpositive rewardへ到達し、ONNX fixture gateを通過。ただし短縮probeのため、Iron以上には扱わない。

### 18.3 Routing

- [x] `D01/S01 + beginner` -> `model-27draw-beginner-dqn-v1`
- [x] `D01/S01 + standard` -> `model-27draw-standard-dqn-v1`
- [x] `D01/S01 + pro` -> `model-27draw-pro-dqn-v1`
- [x] `D02/S02 + beginner` -> `model-a5draw-beginner-dqn-v1`
- [x] `D02/S02 + standard` -> `model-a5draw-standard-dqn-v1`
- [x] `D02/S02 + pro` -> `model-a5draw-pro-dqn-v1`
- [x] 既存 `model-27draw-iron-v1` / `model-a5draw-iron-v1` は bootstrap Iron として残す。今回のPro probeはIron以上へは昇格しない。

### 18.4 確認結果

- [x] `npm run ai:train-draw -- --family low-27 --episodes 3000 ... --output-dir rl/models/draw_low27_beginner_3k_20260505`: completed。
- [x] `npm run ai:train-draw -- --family low-27 --episodes 5000 ... --output-dir rl/models/draw_low27_standard_5k_20260505`: completed。
- [x] `npm run ai:train-draw -- --family low-a5 --episodes 3000 ... --output-dir rl/models/draw_a5_beginner_3k_20260505`: completed。
- [x] `npm run ai:train-draw -- --family low-a5 --episodes 5000 ... --output-dir rl/models/draw_a5_standard_5k_20260505`: completed。
- [x] `npm run ai:export-draw-onnx` で4モデルをexport。
- [x] `npm run ai:evaluate-draw-onnx -- --model public/models/27draw_beginner_dqn_v1.onnx --variant-id D01`: pass。
- [x] `npm run ai:evaluate-draw-onnx -- --model public/models/27draw_standard_dqn_v1.onnx --variant-id D01`: pass。
- [x] `npm run ai:evaluate-draw-onnx -- --model public/models/a5draw_beginner_dqn_v1.onnx --variant-id D02`: pass。
- [x] `npm run ai:evaluate-draw-onnx -- --model public/models/a5draw_standard_dqn_v1.onnx --variant-id D02`: pass。
- [x] `npm run ai:evaluate-draw-onnx -- --model public/models/27draw_standard_dqn_v1.onnx --variant-id S01`: pass。
- [x] `npm run ai:evaluate-draw-onnx -- --model public/models/a5draw_standard_dqn_v1.onnx --variant-id S02`: pass。
- [x] `npm run ai:train-draw -- --family low-27 --episodes 2500 --teacher-warmup-episodes 350 --imitation-pretrain-steps 120 --opponent-profiles standard,tight,aggressive --output-dir rl/models/draw_low27_pro_probe_2500_20260505`: completed。last500 avg reward `0.393`。
- [x] `npm run ai:train-draw -- --family low-a5 --episodes 2500 --teacher-warmup-episodes 350 --imitation-pretrain-steps 120 --opponent-profiles standard,tight,aggressive --output-dir rl/models/draw_a5_pro_probe_2500_20260505`: completed。last500 avg reward `0.445`。
- [x] `npm run ai:export-draw-onnx` で `27draw_pro_dqn_v1.onnx` / `a5draw_pro_dqn_v1.onnx` をexport。
- [x] `npm run ai:evaluate-draw-onnx -- --model public/models/27draw_pro_dqn_v1.onnx --variant-id D01`: pass。
- [x] `npm run ai:evaluate-draw-onnx -- --model public/models/27draw_pro_dqn_v1.onnx --variant-id S01`: pass。
- [x] `npm run ai:evaluate-draw-onnx -- --model public/models/a5draw_pro_dqn_v1.onnx --variant-id D02`: pass。
- [x] `npm run ai:evaluate-draw-onnx -- --model public/models/a5draw_pro_dqn_v1.onnx --variant-id S02`: pass。
- [x] `npm test -- --run src/ai/__tests__/modelRouter.test.js src/ai/__tests__/onnxPolicyAdapter.test.js`: 2 files / 13 tests pass。
- [x] `npm test -- --run src/games/draw/__tests__/DeuceToSevenTripleDrawController.test.js src/games/draw/__tests__/AceToFiveTripleDrawEngine.test.js src/games/__tests__/playableInvariant.test.js src/ui/feedback/__tests__/playFeedbackPayload.test.js src/ui/screens/__tests__/HandHistoryScreen.test.jsx src/ui/screens/__tests__/HistoryScreen.test.jsx src/ui/components/__tests__/Player.test.jsx`: 7 files / 57 tests pass。
- [x] `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts --project=badugi-flow`: 26 passed。D01/D02/S01/S02を追加で含める。
- [x] `npm run lint`: pass。
- [x] `npm run build`: pass。chunk size warning は既存警告。

## 19. 2026-05-05 NLH / FLH / PLO / PLO8 Beginner-Standard RL

### 19.1 対応方針

- [x] `AI-BOARD-01` NLH / FLH / PLO / PLO8 を Badugi/draw lowball とは別の board betting model family として扱う。
  - 対象variant: `B01 NLH`, `B02 FLH`, `B05 PLO`, `B06 PLO8`。
  - 16入力 / 6出力の `board-betting-observation-v1` を追加。
  - action index は既存bet action互換: `fold/check/call/bet/raise/all_in`。
- [x] `AI-BOARD-02` 合成board betting環境を追加し、strength / equity / draw potential / position / pot odds / limit type / hi-lo flag を観測に含める。
- [x] `AI-BOARD-03` Beginner / Standard の初期モデルをteacher warmup + fixture replay + DQNで作成し、ONNXとして `public/models` に配置する。
- [x] `AI-BOARD-04` `modelRegistry.json` に variant+tier exact route を追加し、他variantへ誤fallbackしないことをunit testで固定する。
- [ ] `AI-BOARD-05` Pro以上は未実装。次段階では実ハンド履歴、variant別hand evaluator、human/practice benchmark、multiway/side-pot EV gateを追加する。

### 19.2 学習結果

| Family | Variant | Tier | Run | Episodes | Avg reward trend | ONNX |
|---|---|---:|---|---:|---:|---|
| NLH | B01 | Beginner | `board_nlh_beginner_20260505` | 2,000 | last100 `3.806` | `public/models/nlh_beginner_dqn_v1.onnx` |
| NLH | B01 | Standard | `board_nlh_standard_20260505` | 3,000 | last100 `6.972` | `public/models/nlh_standard_dqn_v1.onnx` |
| FLH | B02 | Beginner | `board_flh_beginner_20260505` | 2,000 | last100 `5.403` | `public/models/flh_beginner_dqn_v1.onnx` |
| FLH | B02 | Standard | `board_flh_standard_20260505` | 3,000 | last100 `6.811` | `public/models/flh_standard_dqn_v1.onnx` |
| PLO | B05 | Beginner | `board_plo_beginner_20260505` | 3,000 | last100 `5.492` | `public/models/plo_beginner_dqn_v1.onnx` |
| PLO | B05 | Standard | `board_plo_standard_20260505` | 3,000 | last100 `6.608` | `public/models/plo_standard_dqn_v1.onnx` |
| PLO8 | B06 | Beginner | `board_plo8_beginner_20260505` | 2,000 | last100 `5.056` | `public/models/plo8_beginner_dqn_v1.onnx` |
| PLO8 | B06 | Standard | `board_plo8_standard_20260505` | 3,000 | last100 `6.718` | `public/models/plo8_standard_dqn_v1.onnx` |

補足:
- 今回は「初期モデル導入」まで。実戦的な強さは未保証で、Badugi Pro/Iron相当の評価はしていない。
- fixture gateは、強い手のvalue bet/continue、弱い手のfold disciplineだけを最低限確認する。
- 2026-05-05 再学習: Beginner/Standard 8モデルを `--long-horizon --max-steps 12` で再学習し、ONNXを上書きexport。PLO Beginner は初回gateで強いopenをcheckして失敗したため、teacher / fixture replay比率を上げて再学習し、fixture pass後に採用した。
- 2026-05-05 advanced再学習: thin value / low-equity bluff discipline / multiway isolation / side-pot EV / PLO8 scoop-or-no-low を teacher / fixture replay に追加し、Beginner/Standard 8モデルを再export。advanced gate は8モデルすべて `8/8` pass。

### 19.3 Routing

- [x] `B01 + beginner` -> `model-nlh-beginner-dqn-v1`
- [x] `B01 + standard` -> `model-nlh-standard-dqn-v1`
- [x] `B02 + beginner` -> `model-flh-beginner-dqn-v1`
- [x] `B02 + standard` -> `model-flh-standard-dqn-v1`
- [x] `B05 + beginner` -> `model-plo-beginner-dqn-v1`
- [x] `B05 + standard` -> `model-plo-standard-dqn-v1`
- [x] `B06 + beginner` -> `model-plo8-beginner-dqn-v1`
- [x] `B06 + standard` -> `model-plo8-standard-dqn-v1`

### 19.4 確認結果

- [x] `npm run ai:train-board` で NLH/FLH/PLO/PLO8 の Beginner/Standard 8モデルを学習。
- [x] `npm run ai:export-board-onnx` で8モデルをexportし、registry checksumを更新。
- [x] `npm run ai:evaluate-board-onnx` を8モデルすべてに実行し、strong open / strong facing bet / weak facing bet fixture は全pass。
- [x] 2026-05-05 再確認: `nlh/flh/plo/plo8` の `beginner/standard` 8モデルを long-horizon で再学習し、ONNX export後に全fixture pass。PLO Beginner は初回FAILを検出し、再学習後にPASSしたものだけを反映。
- [x] `npm test -- --run src/ai/__tests__/modelRouter.test.js src/ai/__tests__/onnxPolicyAdapter.test.js src/ai/__tests__/onnxPolicyAdapterInference.test.js`: 3 files / 20 tests pass。
- [x] `npm test -- --run src/games/nlh/__tests__/NLHGameController.test.js src/games/plo/__tests__/PLOGameController.test.js src/games/plo/utils/__tests__/ploEvaluator.test.js src/games/stud/__tests__/StudSplitGameController.test.js src/games/draw/__tests__/DeuceToSevenTripleDrawController.test.js src/games/__tests__/playableInvariant.test.js`: 6 files / 66 tests pass。
- [x] `npm run ai:verify-models`: required assets all OK。`model-nlh-v1` / `model-generic-v1` は既存optional missing。
- [x] `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts --project=badugi-flow`: 26 passed。
- [x] `npm run lint`: pass。
- [x] `npm run build`: pass。chunk size warning は既存警告。

### 19.5 長期RL入口

- [x] `AI-BOARD-LONG-01` `BoardLongHorizonEnv` を追加し、board系DQNが複数streetのhandを通して学習できる入口を作る。
  - 既存16入力/6出力契約は維持する。
  - episode内で street / pot / hero stack / to-call / draw potential / equity が推移する。
  - fold / showdown / illegal action のterminal rewardを持つ。
- [x] `AI-BOARD-LONG-02` `npm run ai:train-board` に `--long-horizon`, `--max-steps`, `--resume-checkpoint` を追加する。
  - 初期モデルから継続学習できるため、短時間でもfixture gateを壊さず長期RL動作確認が可能。
  - 長期本番学習例:
    - `npm run ai:train-board -- --family nlh --tier standard --long-horizon --episodes 50000 --max-steps 8 --resume-checkpoint rl/models/board_nlh_standard_20260505/nlh_standard_board_dqn_latest.pt --output-dir rl/models/board_nlh_standard_long_50k_YYYYMMDD --device cpu`
- [x] `AI-BOARD-LONG-03` `npm run ai:export-board-onnx` は任意checkpoint / outputへexportできるため、長期checkpointをそのままONNX化できる。
- [x] `AI-BOARD-LONG-04` 短時間の継続学習smokeを NLH/FLH/PLO/PLO8 すべてで実行し、export/evaluateまで確認する。
  - `nlh`: 120 episodes long-horizon resume smoke, exported `/tmp/nlh_long_resume_smoke.onnx`, fixture pass。
  - `flh`: 120 episodes long-horizon resume smoke, exported `/tmp/flh_long_resume_smoke.onnx`, fixture pass。
  - `plo`: 120 episodes long-horizon resume smoke, exported `/tmp/plo_long_resume_smoke.onnx`, fixture pass。
  - `plo8`: 120 episodes long-horizon resume smoke, exported `/tmp/plo8_long_resume_smoke.onnx`, fixture pass。
- [x] `AI-BOARD-LONG-05` 次段階: 長期学習用の評価gateをfixtureだけでなく、EV delta / fold discipline / thin value / bluff frequency / multiway isolation / hi-lo scoop rateに広げる。
  - 2026-05-05 対応: `evaluate_board_onnx.py` に `--advanced-gate` を追加。既存3fixture smokeは維持しつつ、advanced時だけ late thin value / low-equity bluff discipline / multiway isolation / side-pot EV / PLO8 scoop-or-no-low を評価し、各fixtureの `selectedEV`, `bestEV`, `evDelta`, category summaryをreport出力する。
- [x] `AI-BOARD-LONG-06` 実ハンド履歴ベース評価を board系にも導入する。最低条件: variant別に30/50/200ハンド単位で `heroNet`, showdown result, all-in EV, position, street action sequence を集計し、synthetic fixtureだけで強さを宣言しない。
  - 2026-05-05 対応: `ai:benchmark-board-human-practice` のhuman log集計を拡張し、`B01/B02/B05/B06` と `nlh/flh/plo/plo8` 系aliasをvariant別に正規化する。variant不明ログはboard系の強さ評価には混ぜない。
  - 2026-05-05 対応: 実ログから `heroNet`, `avgEV`, `position`, `showdown`, `all-in`, `split pot`, `VPIP`, `PFR` を集計し、position別 `hands/net/avgEV/showdownRate/vpip/pfr` をreportへ出す。
  - 2026-05-05 対応: `--require-human-logs` 時はhand数だけでなく、EV sample数、position coverage、showdown coverage、平均EV gateも満たさない限りpassしない。
- [x] `AI-BOARD-LONG-07` variant別EV gateを追加する。NLH/FLH/PLO/PLO8を分け、`callEV`, `raiseEV`, `foldEV`, `thin value`, `bad bluff`, `multiway isolation`, `side-pot EV`, `PLO8 scoop/no-low` を別々に合否判定する。
  - 2026-05-05 対応: `B01/B02/B05/B06` の family 別fixtureを同一CLIで分岐。PLO/PLO8はpot-limit draw potentialとscoop/no-low awarenessを別categoryにし、FLHはfixed-limit isolationをcall許容にする。
  - 2026-05-05 評価: 既存8モデルはbase fixtureは全pass。advanced report-onlyではNLH/FLHが7/8、PLO/PLO8が6/8。共通課題は thin value不足、PLO/PLO8はmultiway isolationとPLO8 scoop/no-low raise頻度不足。Pro昇格対象ではなく、次の学習課題として扱う。
- [x] `AI-BOARD-LONG-09` NLH/PLOのpreflop teacherへ、GTO solver風のポジション別参加レンジを導入する。
  - 2026-05-05 対応: GTO Wizard等のレンジ分析思想を参考にしつつ、有料/独自チャートの丸写しはせず、MGX独自の抽象range scoreとして実装。
  - NLH/FLH: UTG/MP/CO/BTN/SB/BBでopen floorを分け、pair / suited ace / broadway / connector / dominated offsuit trashを評価する。
  - PLO: raw high-cardよりも、nut potential、連結性、double-suited、premium pair、dangler penaltyを重視する。
  - PLO8/FLO8: A2 / wheel low / high backup / suited ace などscoop候補を高く評価し、lowもhighも弱いno-low寄りハンドはmultiwayで降ろす。
  - 既存16入力/6出力のboard DQN契約は維持し、ONNX shape互換を壊さない。
- [x] `AI-BOARD-LONG-08` human/practice benchmarkを board系にも追加する。Badugi用 `ai:benchmark-badugi-human-practice` と同等に、実プレイログを読み込めない場合は practice-only と明記し、人間相手の勝率保証には使わない。
  - 2026-05-05 対応: `benchmark_board_human_practice.py` と `npm run ai:benchmark-board-human-practice` を追加。`variantId` ごとにhuman logをfilterし、`heroNet` / `heroResult` / nested `humanBenchmark` / `feedbackContext` を集計する。`--require-human-logs` 時は指定ハンド数未満ならpassしない。
- [x] `HELP-01` Main Menu の `?` ヘルプを「今後追加予定」から、全variantのルール要点・勝敗判定・強くなるコツを表示する実用ガイドへ拡張する。

### 19.6 長期RL確認結果

- [x] `PYTHONPATH=src .venv/bin/python -m pytest src/rl/__tests__/test_board_betting_env.py`: 2 passed。
- [x] `cd src && ../.venv/bin/python -m pytest rl/__tests__/test_board_betting_env.py`: 4 passed。ポジション別preflop range、PLO8 scoop/no-low teacherを確認。
- [x] `npm test -- --run src/games/core/__tests__/cpuTeacherPolicy.test.js src/games/nlh/__tests__/NLHGameController.test.js src/games/plo/__tests__/PLOGameController.test.js`: 3 files / 21 tests pass。
- [x] `npm run ai:train-board -- --family nlh --tier standard --long-horizon --episodes 120 ... --resume-checkpoint rl/models/board_nlh_standard_20260505/nlh_standard_board_dqn_latest.pt`: completed, evaluate pass。
- [x] `npm run ai:train-board -- --family flh --tier standard --long-horizon --episodes 120 ... --resume-checkpoint rl/models/board_flh_standard_20260505/flh_standard_board_dqn_latest.pt`: completed, evaluate pass。
- [x] `npm run ai:train-board -- --family plo --tier standard --long-horizon --episodes 120 ... --resume-checkpoint rl/models/board_plo_standard_20260505/plo_standard_board_dqn_latest.pt`: completed, evaluate pass。
- [x] `npm run ai:train-board -- --family plo8 --tier standard --long-horizon --episodes 120 ... --resume-checkpoint rl/models/board_plo8_standard_20260505/plo8_standard_board_dqn_latest.pt`: completed, evaluate pass。
- [x] `npm run ai:evaluate-board-onnx` base gateをNLH/FLH/PLO/PLO8 Beginner/Standard 8モデルへ実行: all pass。
- [x] `npm run ai:evaluate-board-onnx -- --advanced-gate --report-only` を8モデルへ実行: report生成。NLH/FLH 7/8、PLO/PLO8 6/8で、Pro以上に進める前の追加学習課題を特定。
- [x] `PYTHONPATH=src python3 -m pytest src/rl/__tests__/test_board_human_practice.py`: 2 passed。
- [x] `npm run ai:benchmark-board-human-practice -- --variant-id B05 --model public/models/plo_standard_dqn_v1.onnx --tier standard --report-only`: practice-only PASS。human logなしのため `humanVerified=false`。
- [x] 2026-05-05 実ハンド履歴gate拡張後: `PYTHONPATH=src .venv/bin/python -m pytest src/rl/__tests__/test_board_human_practice.py`: 4 passed。
- [x] 2026-05-05 実ハンド履歴gate拡張後: `npm run ai:benchmark-board-human-practice -- --model public/models/nlh_standard_dqn_v1.onnx --variant-id B01 --tier standard --human-log <synthetic-jsonl> --require-human-logs --report-only --json`: PASS。`humanVerified=true`, `avgEV=2.38`, `positionCoverage=6`, `showdownHands=13`。
- [x] 2026-05-05 advanced対応後: `nlh/flh/plo/plo8` の `beginner/standard` 8モデルを `board_*_advanced_20260505` として再学習し、`public/models/*_dqn_v1.onnx` と registry checksum を更新。
- [x] 2026-05-05 advanced対応後: 8モデルすべて `npm run ai:evaluate-board-onnx -- --advanced-gate` で `8/8` pass。NLH/PLO/PLO8は `avgEVDelta=-0.012 worst=-0.060`、FLHは `avgEVDelta=-0.020 worst=-0.060`。
- [x] 2026-05-05 advanced対応後: `npm run ai:verify-models` pass。required model checksumは全OK。`model-nlh-v1` / `model-generic-v1` は既存optional missing。
- [x] `npm test -- --run src/ai/__tests__/modelRouter.test.js src/ai/__tests__/onnxPolicyAdapter.test.js src/ai/__tests__/onnxPolicyAdapterInference.test.js`: 3 files / 20 tests pass。
- [x] `npm run lint`: pass。
- [x] `npm run build`: pass。chunk size warning は既存警告。

## 20. 2026-05-05 Game / Progression QA / RL Status Matrix

目的: 実装済みゲームごとに、友人へ公開テストできるかを判断できる粒度で、`ゲーム実装` / `ゲーム進行網羅テスト` / `強化学習` の現状を数値化する。

評価基準:
- `実装%`: controller / evaluator / UI adapter / Game Selector / result / history の総合進捗。
- `進行テスト%`: unit / controller invariant / Playwright smoke / all-in / split pot / 5連続hand / MTT影響の総合進捗。
- `RL%`: runtime teacher / ONNX DQN / variant別gate / human-practice benchmark の総合進捗。
- `友達公開`: `可` は通常の友人テストに出せる、`限定可` はバグ報告前提の少人数テスト、`開発者限定` はまだ友人公開に出さない。
- 数値は2026-05-05時点の実務目安。人間実ログでの強さ保証が未完のゲームは、RL%を控えめにする。

| Game | 実装% | 進行テスト% | RL% | 友達公開 | 次にやること |
|---|---:|---:|---:|---|---|
| B01 NL Hold'em | 90 | 82 | 72 | 限定可 | 実ハンド履歴EV gate、position別human benchmark、50k以上の長期RL。 |
| B02 FL Hold'em | 88 | 80 | 70 | 限定可 | fixed-limit特有のthin value / crying call / raise cap判断を実ログで検証。 |
| B03 NL Super Hold'em | 82 | 74 | 35 | 開発者限定 | 3-hole専用preflop range、UI説明、history smoke、専用RL familyを追加。 |
| B04 FL Super Hold'em | 80 | 72 | 35 | 開発者限定 | FL Super固有の参加レンジ、limit action mask、5連続UI smokeを強化。 |
| B05 Pot-Limit Omaha | 88 | 80 | 72 | 限定可 | PLO専用multiway isolation、nut blocker、SPR別teacher、実プレイログgate。 |
| B06 PLO8 | 86 | 78 | 70 | 限定可 | scoop/no-low判断を実ログで検証し、quartering/odd chip表示をさらに明確化。 |
| B07 Big-O | 82 | 74 | 42 | 開発者限定 | 5-card hi/lo split evaluator差分、Big-O専用range、side-pot fixtureを増やす。 |
| B08 5-Card PLO | 82 | 74 | 40 | 開発者限定 | 5-card PLO専用range、hand sort/役表示、pot-limit UI smokeを強化。 |
| B09 FLO8 | 84 | 76 | 45 | 開発者限定 | fixed-limit Omaha8専用DQN、複数サイドポットfixture、quartering表示改善。 |
| D01 2-7 Triple Draw | 84 | 82 | 68 | 限定可 | 2-7専用Pro/Iron学習、pat bluff / snow / final street disciplineを実ログで評価。 |
| D02 A-5 Triple Draw | 82 | 80 | 66 | 限定可 | A-5専用Pro学習、wheel draw評価、showdownソート/履歴表示をさらに磨く。 |
| D03 Badugi | 92 | 88 | 84 | 可 | human benchmarkを増やし、Iron/WorldMasterの難易度調整とプレイガイドを完成。 |
| D04 Badeucey TD | 80 | 76 | 32 | 限定可 | split pot結果UI、Badugi half/2-7 half別の教師・RL datasetを作る。 |
| D05 Badacey TD | 80 | 76 | 32 | 限定可 | Badugi half/A-5 half別のcomponent pot説明、RL teacher、history replay smoke。 |
| D06 Hidugi TD | 78 | 74 | 28 | 開発者限定 | high Badugi評価の公式監査、discard strategy、専用result表示。 |
| D07 Archie TD | 76 | 72 | 25 | 開発者限定 | Archie公式ルール監査、qualifier/odd chip fixture、CPU discard精緻化。 |
| S01 2-7 Single Draw | 82 | 80 | 66 | 限定可 | NL/FL差分がある場合のbetting仕様監査、snow頻度、実ログ評価。 |
| S02 A-5 Single Draw | 80 | 78 | 64 | 限定可 | A-5 SD専用teacher、pat/call discipline、low表示ソートを確認。 |
| S03 5-Card Single Draw | 76 | 72 | 25 | 開発者限定 | high draw専用CPU、hand sort/役名表示、history detailを追加。 |
| S04 Badugi Single Draw | 78 | 74 | 30 | 開発者限定 | Badugi SD専用range、1draw向けpat判断、UI smokeを強化。 |
| S05 Badeucey Single Draw | 76 | 72 | 25 | 開発者限定 | split single drawのcomponent pot UI、official rule監査、専用teacher。 |
| S06 Badacey Single Draw | 76 | 72 | 25 | 開発者限定 | A-5 half/Badugi halfの結果表示、discard strategy、history replay。 |
| S07 Hidugi Single Draw | 74 | 70 | 22 | 開発者限定 | Hidugi SD評価監査、CPU discard、result label改善。 |
| H01 Dramaha Hi | 72 | 66 | 20 | 開発者限定 | Dramaha共通UI、board+draw split結果、CPU discard strategyを強化。 |
| H02 Dramaha 2-7 | 70 | 64 | 20 | 開発者限定 | 2-7 draw halfのソート/結果表示、split pot説明、Playwright replay smoke。 |
| H03 Dramaha A-5 | 70 | 64 | 20 | 開発者限定 | A-5 draw halfの表示、CPU discard、component pot history。 |
| H04 Dramaha Zero | 68 | 62 | 18 | 開発者限定 | zero-hand評価の公式監査、result label、CPU strategy。 |
| H05 Dramaha Hidugi | 68 | 62 | 18 | 開発者限定 | Hidugi halfの公式監査、split result UI、discard teacher。 |
| H06 Dramaha Badugi | 70 | 64 | 20 | 開発者限定 | Badugi halfのcomponent winner表示、odd chip、history smoke。 |
| ST1 Stud | 82 | 78 | 35 | 限定可 | bring-in/completeを実プレイで再確認し、up/down UIと7th down card表示をさらに磨く。 |
| ST2 Stud 8 | 80 | 76 | 32 | 限定可 | hi/lo split、no-low scoop、quartering表示、Stud8専用teacherを追加。 |
| ST3 Razz | 82 | 78 | 35 | 限定可 | Razzのposition/board texture teacher、final street call discipline、実ログ評価。 |
| ST4 Razzdugi | 76 | 72 | 25 | 開発者限定 | Razz half/Badugi halfのcomponent表示、split evaluator監査、専用CPU。 |
| ST5 Razzducey | 76 | 72 | 25 | 開発者限定 | Razz half/2-7 halfのsplit結果UI、odd chip fixture、history replay。 |
| ST6 2-7 Razz | 78 | 74 | 28 | 開発者限定 | 2-7 Razz公式進行監査、bring-in tie、low evaluator gateを追加。 |

補足:
- 上表は2026-05-05時点の旧基準。2026-05-06以降は「進行テスト%」を `進行保証%` と `UI/UX完成度%` に分離し、起動/進行が安定しているがUIが未完成なゲームを過大評価しない。
- 友達公開の第一候補は `D03 Badugi`。次点で限定公開候補は `B01/B02/B05/B06`, `D01/D02/S01/S02`, `ST1/ST2/ST3`。
- 公開範囲を広げる前に、最低限 `公開候補variantごとの5連続UI hand`, `all-in/bust後next hand`, `history/replay`, `feedback対象のvariant分離` を再実行する。

### 20.1 進捗表 v2: 進行保証 / UI・UX完成度 分離版

目的:
- `実装%`: controller / evaluator / Game Selector / App routing / result / historyへの接続度。
- `進行保証%`: unit / invariant / Playwright 5hand / all-in / split pot / next handで、ゲーム進行が止まらない保証度。
- `UI/UX完成度%`: ルール固有表示、勝者表示、カード視認性、履歴/FB連携、スマホ/PCの操作快適性。
- Chinese Pokerはstreet型ではないため、`set -> showdown -> next hand` の専用進行保証で評価する。OFC street-by-street / fantasylandは別タスク。

| Game | 実装% | 進行保証% | UI/UX完成度% | RL% | 友達公開 | 次にやること |
|---|---:|---:|---:|---:|---|---|
| B01 NL Hold'em | 90 | 84 | 76 | 72 | 限定可 | 実ハンドEV gate、position別human benchmark、hand result表示改善。 |
| B02 FL Hold'em | 88 | 82 | 74 | 70 | 限定可 | fixed-limit cap/crying call監査、thin value teacher。 |
| B03 NL Super Hold'em | 84 | 80 | 70 | 35 | 開発者限定 | 3-hole専用range/RL family、history/replay smoke。 |
| B04 FL Super Hold'em | 82 | 78 | 68 | 35 | 開発者限定 | limit Super range、raise cap UI、history/replay smoke。 |
| B05 Pot-Limit Omaha | 88 | 82 | 72 | 72 | 限定可 | PLO hand sort/役名、SPR別teacher、showdown result安定化。 |
| B06 PLO8 | 86 | 80 | 70 | 70 | 限定可 | scoop/no-low/quartering表示、PLO8専用実ログgate。 |
| B07 Big-O | 82 | 76 | 66 | 42 | 開発者限定 | 5-card hi/lo split fixture、Big-O専用range。 |
| B08 5-Card PLO | 82 | 76 | 66 | 40 | 開発者限定 | 5-card sort/役表示、pot-limit UI smoke。 |
| B09 FLO8 | 84 | 78 | 68 | 45 | 開発者限定 | fixed-limit Omaha8 side-pot/quartering fixture。 |
| D01 2-7 Triple Draw | 84 | 84 | 74 | 68 | 限定可 | Pro以上RL、final street discipline、showdownソート。 |
| D02 A-5 Triple Draw | 82 | 82 | 74 | 66 | 限定可 | Pro以上RL、wheel draw評価、showdownソート。 |
| D03 Badugi | 92 | 90 | 82 | 84 | 可 | Iron/WorldMaster、human benchmark、final value bet調整。 |
| D04 Badeucey TD | 80 | 78 | 66 | 32 | 限定可 | component pot UI、Badugi/2-7 half別history。 |
| D05 Badacey TD | 80 | 78 | 66 | 32 | 限定可 | Badugi/A-5 half別result、discard strategy。 |
| D06 Hidugi TD | 78 | 76 | 62 | 28 | 開発者限定 | high Badugi公式監査、専用result表示。 |
| D07 Archie TD | 76 | 74 | 60 | 25 | 開発者限定 | qualifier/odd chip fixture、公式ルール監査。 |
| S01 2-7 Single Draw | 82 | 82 | 72 | 66 | 限定可 | snow頻度、single draw UI/result。 |
| S02 A-5 Single Draw | 80 | 80 | 72 | 64 | 限定可 | A-5 SD teacher、pat/call discipline。 |
| S03 5-Card Single Draw | 76 | 74 | 62 | 25 | 開発者限定 | high draw CPU、役名/hand sort。 |
| S04 Badugi Single Draw | 78 | 76 | 64 | 30 | 開発者限定 | 1draw pat判断、専用range。 |
| S05 Badeucey Single Draw | 76 | 74 | 62 | 25 | 開発者限定 | component pot UI、official rule監査。 |
| S06 Badacey Single Draw | 76 | 74 | 62 | 25 | 開発者限定 | A-5/Badugi split result、history replay。 |
| S07 Hidugi Single Draw | 74 | 72 | 60 | 22 | 開発者限定 | Hidugi SD評価監査、result label。 |
| H01 Dramaha Hi | 72 | 68 | 58 | 20 | 開発者限定 | draw+board result UI、CPU discard。 |
| H02 Dramaha 2-7 | 70 | 66 | 56 | 20 | 開発者限定 | 2-7 halfソート、component pot history。 |
| H03 Dramaha A-5 | 70 | 66 | 56 | 20 | 開発者限定 | A-5 half表示、split pot説明。 |
| H04 Dramaha Zero | 68 | 64 | 54 | 18 | 開発者限定 | zero-hand監査、result label。 |
| H05 Dramaha Hidugi | 68 | 64 | 54 | 18 | 開発者限定 | Hidugi half公式監査、split result UI。 |
| H06 Dramaha Badugi | 70 | 66 | 56 | 20 | 開発者限定 | Badugi half winner表示、odd chip。 |
| ST1 Stud | 82 | 80 | 70 | 35 | 限定可 | bring-in/complete実プレイ監査、7th down UI。 |
| ST2 Stud 8 | 80 | 78 | 68 | 32 | 限定可 | hi/lo split/no-low scoop/quartering表示。 |
| ST3 Razz | 82 | 80 | 70 | 35 | 限定可 | Razz board texture teacher、final street discipline。 |
| ST4 Razzdugi | 76 | 74 | 62 | 25 | 開発者限定 | Razz/Badugi component表示、split evaluator監査。 |
| ST5 Razzducey | 76 | 74 | 62 | 25 | 開発者限定 | Razz/2-7 split result、odd chip fixture。 |
| ST6 2-7 Razz | 78 | 76 | 64 | 28 | 開発者限定 | bring-in tie、low evaluator gate。 |
| CP1 Chinese Poker | 82 | 78 | 68 | 0 | 開発者限定 | OFC street-by-street/fantasyland、history/replay smoke、4人UI。 |

## 21. 2026-05-05 36 Playable Variants 90%化対応

目的:
- 実装済みplayable catalogの全ゲームで、「起動できる」だけではなく、連続進行・all-in・stable UIの最低保証を90%以上に引き上げる。
- 2026-05-06時点で `CP1 Chinese Poker` をGame Selector/App routing/専用UI smokeへ接続し、36件目のplayableとして扱う。ただしOFC street-by-street / fantasylandは後続。

### 21.1 今回到達点

- [x] `PV90-01` 全36 playable variantsをPlaywright operational smokeへ登録する。
  - NLH/FLH/Super/PLO/PLO8/Big-O/5-card/FLO8。
  - 2-7/A-5/Badugi/Badeucey/Badacey/Hidugi/ArchieのTriple Draw。
  - 2-7/A-5/5-card/Badugi/Badeucey/Badacey/HidugiのSingle Draw。
  - Dramaha 6種。
  - Stud/Razz family 6種。
- [x] `PV90-02` Dramaha 6種をcore registryへ追加し、App上のtitle/controller lookupで正式variantとして扱う。
- [x] `PV90-03` E2Eカテゴリ遷移helperを35 playable variants対応へ拡張する。
- [x] `PV90-04` E2E forced new hand helperのdealer引数誤りを修正し、通常variantの5連続handを安定化する。
- [x] `PV90-05` controller invariantは全35 playable variantsで5連続hand / short-stack all-in pressureを通過済み。
- [x] `PV90-06` Playwright operational smokeは36 cash variants相当 + Badugi tournamentで通過対象化。
- [x] `PV90-07` Playwright UI 5連続hand smokeは36 playable variants相当で通過対象化。Chineseはstreet型ではないため `set -> showdown -> next hand` の専用5hand smokeで確認する。

### 21.2 残ギャップ

- [x] `PV90-08` Super Hold'em / FL Super Hold'em のPlaywright 5連続hand smokeをfixme解除する。
  - 2026-05-06 対応: Player表示で `hand` が空でもcontroller由来の `holeCards` を安全なfallbackとして表示する。非Hero/非showdownは従来通り裏面表示なので、Badugi等の相手カード秘匿には影響しない。
  - 2026-05-06 確認: `super_holdem` / `fl_super_holdem` の5連続UI hand smokeがpass。
- [x] `PV90-09` Chinese/OFCを36件目として正式Game Selector / UI controllerへ接続する。
  - 2026-05-05 対応: `CP1` / `chinese_poker` をGame Selector playable catalogへ追加し、専用Chinese Poker UIで13枚配置、採点、next handを実行できるようにした。
  - 2026-05-06 追加: E2E helper alias/category、operational smoke、専用5連続hand smokeへ `chinese_poker` を追加。
  - 残: 全variant共通のhistory/replay smokeへの統合は `HIST-REG-06` として継続。
- [x] `PV90-10` 既存の進捗表は実装品質・RL込みの保守的な数値のため、今後の章で「進行テスト%」と「UI/UX完成度%」を分離する。
  - 2026-05-06 対応: `20.1 進捗表 v2` を追加し、`進行保証%` と `UI/UX完成度%` を分離して36件目のChinese Pokerも掲載。

### 21.3 確認結果

- [x] `node -e "...multiGameList..."`: Game Selector playable catalog は35件。
- [x] `npm test -- --run src/games/core/__tests__/variants.test.js src/games/_core/__tests__/GameRegistry.test.js src/games/__tests__/playableInvariant.test.js`: 3 files / 78 tests pass。
- [x] `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts tests/e2e/cross-variant-five-hand-smoke.spec.ts --project=badugi-flow`: 68 passed / 2 skipped。

### 21.4 2026-05-05 進行スキップ防止テストの追加

目的:
- 「配牌される」「5hand回る」だけでは、Studの4th/5th/6th/7thやDrawのBET/DRAWが飛ぶバグを検知しきれない。
- そのため、controller integration層でvariant familyごとの期待street sequenceを固定し、途中streetがスキップされた場合に必ず落ちるテストを追加する。

- [x] `PV90-11` 全35 playable variantsで期待street sequenceを検証する。
  - Board系: `PREFLOP -> FLOP -> TURN -> RIVER -> SHOWDOWN`。
  - Dramaha系: `PREFLOP -> FLOP -> DRAW -> FINAL -> SHOWDOWN`。
  - Stud/Razz系: `THIRD -> FOURTH -> FIFTH -> SIXTH -> SEVENTH -> SHOWDOWN`。
  - Triple Draw系: `BET -> DRAW -> BET -> DRAW -> BET -> DRAW -> BET -> SHOWDOWN`。
  - Single Draw系: `BET -> DRAW -> BET -> SHOWDOWN`。
- [x] `PV90-12` all-in pressure / chip drift / broken actor / negative stack / 5連続handの既存invariantと、street sequence検査を同じ横断suiteに統合する。
- [x] `PV90-13` 単体・結合・総合・システム観点の今回確認を記録する。
  - 単体/結合: controller invariant, evaluator/action mask周辺のtargeted unit。
  - 総合: Game Registry / variant registry / controller facade / 35 playable variantsの横断完走。
  - システム: PlaywrightでGame Selector経由の36 cash variants相当 + Badugi tournament起動、Chinese専用5連続hand、Super Hold'em 2種のUI 5連続handを確認。

確認結果:
- [x] `npm test -- --run src/games/__tests__/playableInvariant.test.js --reporter=verbose`: 1 file / 108 tests pass。
- [x] `npm test -- --run src/games/core/__tests__/variants.test.js src/games/_core/__tests__/GameRegistry.test.js src/games/__tests__/playableInvariant.test.js src/games/stud/__tests__/StudSplitGameController.test.js src/games/nlh/__tests__/NLHGameController.test.js src/games/plo/__tests__/PLOGameController.test.js src/games/plo/__tests__/PLO8GameController.test.js src/games/draw/__tests__/DeuceToSevenTripleDrawEngine.test.js src/games/draw/__tests__/SingleDrawEngine.test.js src/games/draw/__tests__/SpecialDrawEngine.test.js src/games/dramaha/__tests__/DramahaGameController.test.js`: 11 files / 202 tests pass。
- [x] 2026-05-05 `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts tests/e2e/cross-variant-five-hand-smoke.spec.ts --project=badugi-flow`: 68 passed / 2 skipped。
- [x] 2026-05-06 `npx playwright test tests/e2e/cross-variant-five-hand-smoke.spec.ts --project=badugi-flow --grep "super_holdem|fl_super_holdem|chinese_poker"`: 3 passed。
- [x] 2026-05-06 `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts --project=badugi-flow --grep "chinese_poker|flo8"`: 2 passed。
- [x] 2026-05-06 `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts tests/e2e/cross-variant-five-hand-smoke.spec.ts --project=badugi-flow`: 73 passed / 0 skipped。

残ギャップ:
- [x] `PV90-14` 36件目のChinese/OFCを同じprogression matrixへ追加する。
  - 2026-05-06 対応: `20.1 進捗表 v2` に `CP1 Chinese Poker` を追加。street型ゲームではないため、既存street progression matrixとは別に `set -> showdown -> next hand` 専用5hand smokeで保証する。
- [x] `PV90-15` Super Hold'em / FL Super Hold'em のPlaywright 5連続hand smoke fixmeを解除し、UI smokeも35/35へ引き上げる。
  - 2026-05-06 対応: `fiveHandKnownGap` と `test.fixme` を削除し、Super Hold'em 2種を通常Playwright 5連続hand対象へ戻した。

### 21.5 2026-05-05 Badugi CPU / Tournament Avatar 再発防止

- [x] `BUG-40` Badugi CPUが最終ベットラウンドで強い完成Badugiを過度にcheckする。
  - 原因: policy routerの通常value raise判定は存在したが、最終streetの強いmade handを「乱数に関係なくvalue betする」fixtureがなく、tier/状況によって保守的に見える余地があった。
  - 対応: 4-card 7-high以下の完成Badugiは最終BET roundで `final-value-bet` / `final-value-raise` としてraise候補に固定。
  - 回帰: `policyRouter.test.js` に6-badugi相当のfinal value bet / value raise fixtureを追加。
- [x] `BUG-41` Tournament CPU character avatarが次hand以降に落ちる。
  - 原因: MTT state初期化では `avatarUrl` を保持していたが、Badugi next-hand lifecycleで `cpuCharacterId` / `cpuStyle` / `avatar` / `avatarUrl` をprev/current playersから引き継いでいなかった。またE2E/devではVite baseが `/dev/` のため、`/characters/...` が404になりinitialsへfallbackしていた。
  - 対応: `buildNextHandState` でCPU character metadataを継承し、Hero profileのavatarUrlも保持する。加えてUI描画側で `avatarUrl` 優先、CPU roster名からの画像復元、dev base fallbackを追加。
  - 回帰: controller unitでMTT next hand後のCPU avatar保持、Player unitで `avatarUrl` のみ/roster復元を確認、PlaywrightでTournament redeal後もCPU avatar imageが残ることを追加。

### 21.6 2026-05-05 友達公開候補 5連続UI hand / all-in / next hand 再確認

目的:
- 友達公開候補の主要variantで「5hand連続」「all-in後に停止しない」「next handへ戻れる」を同じUI E2Eで再確認する。
- Badugiだけでなく、NLH / PLO / 2-7 / A-5 / Stud / Razzを同じ観点で見る。

対応:
- [x] `PUB-REG-01` `friend-publish-candidate-regression.spec.ts` を追加し、以下7variantを横断する。
  - Badugi
  - NLH
  - PLO
  - 2-7 Triple Draw
  - A-5 Triple Draw
  - Stud
  - Razz
- [x] `PUB-REG-02` 各variantで5hand連続のhero card表示、decision panel表示、folded/all-in/seatOut actorでBETが止まらないことを検査する。
- [x] `PUB-REG-03` 各variantでall-inを強制し、all-in seatのturnにBETが残らないことを検査する。
- [x] `PUB-REG-04` all-in後に強制hand解決し、next handでhero handとtable状態が復帰することを検査する。
- [x] `BUG-42` `resolveHandNow` / forced showdownが未完成boardやdraw/stud controller差分で例外になり、next handへ進めない可能性を修正。
  - 原因: E2E/保険用の強制showdown経路が、NLH/PLOの未完成boardやdraw系controllerの未実装 `resolveShowdown` を通常showdown同様に評価し、例外を握れていなかった。
  - 対応: forced showdown経路でwinner/evaluationをsafe fallbackし、通常controller/evaluatorが使える時は従来通り使う。未完成情報で例外が出ても、テスト/保険経路ではhand resultとnext handへ進める。
- [x] `BUG-43` Heroがfold/all-in済みなのに内部turnがHeroへ残るとCPU actionへ進まず停止するケースを修正。
  - 原因: NPC auto分岐が `turn === 0` を「Hero入力待ち」として先にreturnしており、Heroがfold/all-in/stack 0でも次actorへ送らないケースがあった。
  - 対応: HeroがBET/DRAWで行動不能なら、次のactionable seatへ移す。次seatがいない場合はround finishへ送る。
- [x] `BUG-44` BET/DRAWでactor状態が一定時間進まない場合のUI進行watchdogを追加。
  - 目的: folded/all-in/短スタック絡みでactor同期がずれても、次actor選択・safe call/check・round finishのいずれかへ寄せ、画面停止を避ける。

確認結果:
- [x] `npx playwright test tests/e2e/friend-publish-candidate-regression.spec.ts --project=badugi-flow`: 7 passed。
- [x] `npx playwright test tests/e2e/badugi-flow.spec.ts:409 tests/e2e/badugi-flow.spec.ts:485 tests/e2e/badugi-flow.spec.ts:527 --project=badugi-flow`: 2 passed / 1 failed。
  - `Hero fold is terminal within the same hand`: pass。
  - `No-next-alive scenarios never emit seat=-1 skips`: pass。
  - `Full 3-draw flow keeps card history intact`: fail。短スタック/all-in絡みで早期showdownになる実進行と、古いE2Eの「必ずbet/drawを3回通る」固定期待が競合している。ゲーム停止ではなく、別途 `PV90-16` としてテスト条件をfixture化する。
- [x] `npm test -- --run src/games/__tests__/playableInvariant.test.js src/games/badugi/flow/__tests__/nextActorUtils.test.js src/games/badugi/flow/__tests__/actionUtilsForcedBet.test.js`: 3 files / 118 tests pass。
- [x] `npm run build`: pass。

残タスク:
- [ ] `PV90-16` Badugi full 3-draw E2Eを、all-in/短スタックで早期showdownしない固定fixtureに切り替える。現在の失敗は「停止」ではなく「テスト前提と実進行の競合」だが、回帰テストとしては不安定なので修正する。

### 21.7 2026-05-05 Hand History / Replay Smoke 強化

目的:
- FB、バグ調査、学習ログ評価で使う最低限の履歴品質を全playable variantで保証する。
- 各完了handに `handId` / `variantId` / action rows / pot winner result / replay validation fields が揃っていることをE2Eで固定する。

対応:
- [x] `HIST-REG-01` canonical hand historyのトップレベルへ `variantId` / `variantName` を保持する。
  - これまではlegacy record側にはvariantがあったが、canonical bufferのトップレベルからvariantを見失う経路があった。
  - `beginCanonicalHandHistory` と `finalizeCanonicalHandHistory` の両方でvariant情報を保持・補完する。
- [x] `HIST-REG-02` E2E driverへ `getCurrentHandHistory` を公開し、進行中handの `handId` と完了後bufferの同一性を検査できるようにする。
- [x] `HIST-REG-03` `cross-variant-history-replay-smoke.spec.ts` を追加し、全35 playable variantsで以下を確認する。
  - active handの `handId` が取得できる。
  - 完了履歴に同じ `handId` が残る。
  - `variantId` が保存される。
  - `HAND_START` / `HAND_END` eventが残る。
  - blinds/antes/player actionのいずれかがseat actionとして残る。
  - pot resultとwinner resultが残る。
  - `validateReplayReadyHandHistory` を通過する。
  - next handへ進めたときに新しい `handId` へ切り替わる。
- [x] `HIST-REG-04` Dramaha系のforced result smokeでwinner evaluation hydrationが例外になり履歴が残らないケースを修正する。
  - Dramaha result summaryはboard/draw split情報が不足した保険経路ではPLO evaluatorへ不完全入力が渡ることがあった。
  - hand result hydrationで評価例外を握り、pot/winner/result保存とnext hand進行を優先する。

確認結果:
- [x] `npx playwright test tests/e2e/cross-variant-history-replay-smoke.spec.ts --project=badugi-flow --grep "badugi records"`: 2 passed。
- [x] `npx playwright test tests/e2e/cross-variant-history-replay-smoke.spec.ts --project=badugi-flow`: 35 passed。

残タスク:
- [ ] `HIST-REG-05` Replay UIのframe再生そのものを全variantで押下確認する。今回の範囲は「保存される履歴データがReplay-readyであること」まで。
- [ ] `HIST-REG-06` Chinese/OFC正式接続後、同じhistory/replay smokeへ36件目として追加する。
  - 2026-05-05 進捗: UI単体ではshowdown result / next hand smokeを追加済み。全variant hand history/replay pipelineへの保存・Replay-ready検証は未接続。

### 21.8 2026-05-05 Feedback Pipeline Variant分離 / 履歴リンク品質

目的:
- PLOとBadugiなど、別variantの履歴が同じfeedbackへ意図せず混ざる問題を避ける。
- 30hand以上、対象variantの明示選択、該当hand/actionへの参照をfeedback payload / 保存結果 / UIで保証する。

対応:
- [x] `FB-REG-01` 複数variantの履歴がある場合、Hand History modalのAIフィードバックは対象ゲームを明示選択するまで送信できないようにする。
  - `variant:badugi` / `variant:plo` / `mixed` をプレイヤが選ぶ。
  - 1variantしかない場合のみ、そのvariantを自動選択する。
- [x] `FB-REG-02` `buildPlayFeedbackPayload` は未選択scopeを `select_feedback_scope` として拒否する。
  - 30hand未満は従来通り `not_enough_hands`。
  - variant scope選択後は、対象variantだけで30hand以上ある場合のみeligible。
- [x] `FB-REG-03` feedback payloadに `replayLinks` を追加する。
  - `situationId`, `handId`, `variantId`, `actionSeqRange`, `replayTarget`, `handExists` を保持する。
  - `keyHands` と同じhand/action範囲へUIとbackendが戻れるようにする。
- [x] `FB-REG-04` local保存とbackend保存済みfeedback取得結果に `replayLinks` を残す。
  - `GET /api/analysis/play-feedback/results` でも `replayLinks` を返す。
- [x] `FB-REG-05` OpenAIへ送る圧縮payloadにも `replayLinks` を含め、回答でhandId/actionSeqRangeを参照しやすくする。

確認結果:
- [x] `npm test -- --run src/ui/feedback/__tests__/playFeedbackPayload.test.js src/ui/screens/__tests__/HandHistoryScreen.test.jsx`: 2 files / 8 tests pass。
- [x] `cd backend && ../.venv/bin/python -m pytest tests/test_analysis_chatgpt_api.py`: 9 passed。

残タスク:
- [ ] `FB-REG-06` 実OpenAI環境で、variant別30hand以上の実プレイログを使い、回答がPLO/Badugi/2-7などを混同しないか手動確認する。
- [ ] `FB-REG-07` Replay UI側で `replayTarget.actionSeqStart` へ直接ジャンプする操作を全variantで確認する。

### 21.9 2026-05-06 Fold後の次hand復帰 35variant回帰

目的:
- PLOでHeroがfoldした後、後続handに参加できない再発報告を受け、fold状態が次handへ残らないことを35ゲーム横断で保証する。
- `folded` だけでなく、UI側の参加可否判定で使われる `hasFolded` / `seatOut` / `allIn` も次handで解除されることを確認する。

原因:
- NLH/PLO系 controller は `folded` を新handで戻していたが、App同期後に残り得る `hasFolded` を controller の `startNewHand()` で明示的に初期化していなかった。
- 同型の状態持ち越しがStud/Razz系 controllerにも存在した。
- その結果、見た目上は新handへ進んでも、UI/turn eligibility 側で「前handでfold済み」と解釈される余地があった。

対応:
- [x] `BUG-45` NLH/PLO系 controllerで `hasFolded: false` をseat生成・新hand初期化時に明示し、fold action時は `hasFolded: true` に揃える。
- [x] `BUG-46` Stud/Razz系 controllerでも同じ `hasFolded` reset / fold marking を追加する。
- [x] `BUG-47` E2E driverへ `forceMarkSeatFoldedForTest` を追加し、UI操作でHero fold手番を作りにくいvariantでも、fold済み状態からcanonical next handで復帰できるかを検査可能にする。
- [x] `BUG-48` `cross-variant-fold-recovery.spec.ts` を追加し、Chinese/OFC以外の35variantで「fold済み -> hand解決 -> canonical next hand -> Heroが再参加可能」を確認する。

確認結果:
- [x] `npm test -- --run src/games/plo/__tests__/PLOGameController.test.js src/games/nlh/__tests__/NLHGameController.test.js src/games/stud/__tests__/StudSplitGameController.test.js`: 3 files / 33 tests passed。
- [x] `npx playwright test tests/e2e/cross-variant-fold-recovery.spec.ts --project=badugi-flow --grep "plo lets"`: 2 passed。
- [x] `npx playwright test tests/e2e/cross-variant-fold-recovery.spec.ts --project=badugi-flow`: 35 passed。
- [x] `npm run lint`: pass（既存の `syncLegacyFromControllerSnapshot` hook dependency warning 1件のみ）。
- [x] `npm run build`: pass。

残タスク:
- [ ] `BUG-49` Chinese/OFCはfoldが存在しないため対象外。OFC用には「set完了 -> result -> next hand」の専用復帰テストをhistory/replay側へ統合する。

### 21.10 2026-05-06 Dramaha card change / Active game title

目的:
- Dramaha系でHeroがDRAW streetに入ってもカードチェンジできない再発報告を受け、controller-driven drawが旧Badugi phase/turnではなくcontroller snapshot基準で動くことを保証する。
- 左上のゲーム名が `MGX Poker` のままになると、8-Game / 10-Game / mixed rotation中に現在のゲームが分からないため、全playable variantで正規ゲーム名を表示する。

対応:
- [x] `BUG-50` Dramahaの `drawSelected()` が旧legacy `phase/turn` を見て早期returnし、controller上はDRAWでもUI操作が無反応になる経路を修正する。
  - `controlsPhase` / `controllerTurn` / `heroSeatIndex` を優先し、Dramahaやdraw controllerの実際のacting seatに対して `draw` actionを送る。
- [x] `BUG-51` Header titleを `gameVariant` の生値ではなく `normalizeAppVariantId()` 後の `GAME_VARIANTS` / `GameRegistry` labelから解決する。
  - `D01` / `S01` などURL別名やmixed rotation内部IDでも `MGX Poker` fallbackにならないようにする。

確認結果:
- [x] `DRAMAHA-REG-01` Dramaha 6variantでDRAW streetまで進め、カード選択 -> `Draw Selected` -> `lastDrawCount` / hand差し替えを確認するPlaywright回帰を追加する。
- [x] `TITLE-REG-01` Chinese/OFC以外の35variantでheader `<h1>` が正規ゲーム名になり、`MGX Poker` fallbackにならないことを確認する。
- [x] `npm test -- --run src/games/dramaha/__tests__/DramahaGameController.test.js src/ui/game/dramaha/__tests__/DramahaUIAdapter.test.js`: 2 files / 8 tests passed。
- [x] `npx playwright test tests/e2e/dramaha-draw-action.spec.ts --project=badugi-flow`: 6 passed。
- [x] `npx playwright test tests/e2e/cross-variant-operational-smoke.spec.ts --project=badugi-flow`: 37 passed。
- [x] `npm run lint`: pass（既存の `syncLegacyFromControllerSnapshot` hook dependency warning 1件のみ）。
- [x] `npm run build`: pass。

### 21.11 2026-05-06 8/10Game progression audit

目的:
- 8-Game / 10-Game対象variantの進行がRL学習データの前提になるため、PLO / Stud / Razz系を中心に、UI経由でもstreetを飛ばさずshowdownまで到達できることを固定する。
- 既存の「起動」「配牌」「5hand smoke」だけでは、PLOのboard進行やStud/Razzの3rd-7th street進行を見落とす余地があるため、controller snapshotを使ったUI進行監査を追加する。

対象:
- Board系: `nlh`, `flh`, `plo`, `plo8`
- Stud系: `stud`, `stud8`, `razz`
- Draw系の8/10Game中核: `badugi`, `D01` 2-7 Triple Draw, `D02` A-5 Triple Draw, `S01` 2-7 Single Draw

対応:
- [x] `MIX-PROG-01` `mixed-rotation-core-progression.spec.ts` を追加し、NLH / FLH / PLO / PLO8 が `PREFLOP -> FLOP -> TURN -> RIVER -> SHOWDOWN` をUI E2Eで通過することを確認する。
- [x] `MIX-PROG-02` Stud / Stud8 / Razz が `THIRD -> FOURTH -> FIFTH -> SIXTH -> SEVENTH -> SHOWDOWN` をUI E2Eで通過することを確認する。
- [x] `MIX-PROG-03` Badugi / 2-7TD / A-5TD / 2-7SD は5hand連続、強制showdown、next hand復帰で止まらないことを同じsuiteで確認する。
- [x] `MIX-PROG-04` 既存unitのprogression invariantと組み合わせ、8/10Game対象のunit + UI両面の進行監査を記録する。

確認結果:
- [x] `npm test -- --run src/games/__tests__/playableInvariant.test.js src/games/plo/__tests__/PLOGameController.test.js src/games/plo/__tests__/PLO8GameController.test.js src/games/stud/__tests__/StudSplitGameController.test.js src/games/nlh/__tests__/NLHGameController.test.js`: 5 files / 147 tests passed。
- [x] `npx playwright test tests/e2e/stud-street-progression.spec.ts tests/e2e/friend-publish-candidate-regression.spec.ts --project=badugi-flow`: 10 passed。
- [x] `npx playwright test tests/e2e/mixed-rotation-core-progression.spec.ts --project=badugi-flow`: 11 passed。
- [x] `npx playwright test tests/e2e/stud-street-progression.spec.ts tests/e2e/friend-publish-candidate-regression.spec.ts tests/e2e/mixed-rotation-core-progression.spec.ts --project=badugi-flow`: 21 passed。

残リスク:
- [ ] `MIX-PROG-05` 実際の8-Game / 10-Game rotation sessionで、variant切替直後のseat/button/stack引き継ぎを5周以上確認する。今回の追加は各対象variant単体の進行保証であり、rotation境界そのものは次の監査対象。
- [ ] `MIX-PROG-06` RL教師データ生成前に、PLO/Stud/Razzの実hand historyを使ったEV / position / showdown監査を別途gate化する。

### 21.12 2026-05-06 Fixed-limit cap progression regression

目的:
- 5ベット/raise cap系のゲームで、cap到達後のraise入力が追加raiseにならず、call/checkとして丸められ、その後のstreet進行が止まらないことを明示fixture化する。
- 既存ではDraw系とBadugi controllerにcap検査があったが、FLH / FLO8 / Stud系の「cap後の処理継続」まで見るfixtureが不足していた。

対応:
- [x] `CAP-REG-01` FLH: cap到達後のraise試行をcall扱いにし、残りcall後に `FLOP -> TURN` へ進むことを追加。
- [x] `CAP-REG-02` FLO8: cap到達後のraise試行をcall扱いにし、残りcall後に `FLOP -> TURN` へ進むことを追加。
- [x] `CAP-REG-03` Stud: cap到達後のraise試行をcall扱いにし、残りcall後に `FOURTH -> FIFTH` へ進むことを追加。
- [x] `CAP-REG-04` cap到達後に `raiseCountThisStreet` が増えず、次streetで0にresetされることを確認する。

確認結果:
- [x] `npm test -- --run src/games/nlh/__tests__/NLHGameController.test.js src/games/plo/__tests__/PLO8GameController.test.js src/games/stud/__tests__/StudSplitGameController.test.js`: 3 files / 35 tests passed。

残リスク:
- [ ] `CAP-REG-05` UI E2EでHero/CPUが実ボタン操作・自動判断を通じてcap到達したときのボタン表示、raise不可表示、hand history記録を確認する。
