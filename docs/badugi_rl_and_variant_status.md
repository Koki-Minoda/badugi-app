# Badugi RL / Multi-Game 実行計画

更新日: 2026-04-29  
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
- evaluator は以下が実装済み。
  - High
  - 2-7 Low
  - A-5 Low
  - Badugi Low
  - Badugi High
  - Hi-Lo8
  - Badeucey / Badacey
- draw family の共通土台として `src/games/core/drawEngineBase.js` がある。
- 実 engine registry は `badugi` のみ。
  - `src/games/core/engineRegistry.js`
- 実 controller registry 相当もほぼ Badugi 中心。
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
- ただし backend の RL API は stub。
  - `backend/app/api/badugi_rl.py`
- 実 `.onnx` モデルはリポジトリ内で未確認。
- 学習入力が不整合。
  - backend API: schema v1 / 96-dim
  - model registry: Badugi Pro / Iron / WorldMaster は `[96]`

### 2.3 2-7 / A-5 系の現状

- 仕様書と variant 定義はある。
- evaluator はある。
  - `src/games/evaluators/low.js`
- pro AI profile の仮設定もある。
  - `src/config/mixed/proAiProfiles.js`
- しかし draw engine / controller / UI / logging / replay / RL は未実装。

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
- Badugi tier assignment is fixed as `model-badugi-pro-v1`, `model-badugi-iron-v1`, and `model-badugi-worldmaster-v1`.
- Fallback priority is fixed as `ONNX -> rule-based -> deterministic safe`.

Badugi RL test coverage:

- `src/rl/__tests__/badugiObservationSchema.test.js` covers schema v1 vector shape, engine observation alignment, and deterministic fallback.
- `src/ai/__tests__/onnxPolicyAdapter.test.js` covers Badugi ONNX feature shape and tier model assignment.
- `src/ai/__tests__/onnxPolicyAdapterInference.test.js` covers model available, model missing, and invalid input shape paths.
- `backend/tests/test_badugi_rl.py` covers schema v1 request validation and backend deterministic-safe response.
- Dataset transition export was verified with a JSONL smoke command.
  - fallback

完了条件:

- stub ではなく実モデル推論が通る。
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
- [ ] `WG-01-01` Draw family state contract を固定
- [ ] `WG-02-01` 2-7 lowball edge case テスト追加
- [x] `WG-07-01` RL 推論の主経路を確定

## 13. ひとことで言うと

- 最優先は Badugi 完了と bug 管理の定着。
- RL は frontend ONNX 主体で固める。
- 35 variants を正式採用し、その後に `D01 -> D02 -> S01/S02` と進める。
