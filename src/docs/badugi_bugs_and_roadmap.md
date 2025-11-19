# Badugi App - Bug List & Roadmap

Internal tracker for known issues, fixes, and upcoming work across gameplay, UI, logging, AI, and infrastructure.

---

## 1. Bugs & Fix Plans

### 1-1. Stack / Betting Flow

#### Bug-01: Busted player stack becomes negative
- Status: DONE
- Cause: Blind payments were not clamped to 0 and `isBusted` stayed false after all-in.
- Fix: Clamp via `Math.max(0, stack - pay)` and persist `isBusted` between streets.

#### Bug-02: Multi-player all-in never closes the BET round
- Status: REGRESSION
- Cause: SB/BB がフォールドした際に `closingSeatForAggressor` が再計算されず、`lastAggressor` が退席者を指したままになっていたため、ベットラウンドが終了しなかった。
- Next fix: SB/BB が降りた瞬間に `lastAggressor` と `betHead` を即座に更新し、残存プレイヤーだけで `closingSeatForAggressor` を組み直す。Vitest に「SB がフォールドするマルチウェイ」のケースを追加する。

#### Bug-09: All-in players skip DRAW
- Status: DONE
- Cause: `runDrawRound()` が `allIn` フラグを持つ座席を丸ごとスキップしていたため、オールインしてもドローへ参加できなかった。
- Fix: DRAW ラウンドでは `folded / seatOut / hasDrawn` だけを除外判定に使い、`allIn` 席も `aliveDrawPlayers` へ残すように修正。Vitest で「All-in でもドロー継続」テストを追加済み。

### 1-2. Round Transitions / Turn Order

#### Bug-03: DRAW start seat is wrong
- Status: DONE
- Fix: Single source of truth via `calcDrawStartIndex(dealer, streetIndex)` and feeding it to `runDrawRound`.

#### Bug-04: BET termination ambiguous
- Status: DONE
- Fix: Added `lastAggressor` plus `closingSeatForAggressor` to detect when the raiser is reached again, together with `hasActedThisRound` to close streets deterministically.

### 1-3. Showdown / Evaluator

#### Bug-05: UI display vs Badugi evaluator mismatch
- Status: DONE
- Cause: UI still referenced the deprecated `ev.score` / `uniqueCount` fields although `evaluateBadugi` now returns `{ rankType, ranks, kicker, isBadugi }`.
- Fix: `ui/App.jsx` now logs hands via `rankType` + `ranks` and NPC draws rely on the new `npcAutoDrawCount()` helper that reads `kicker`. `score` was fully removed.
- Tests: Run `npm test` (Vitest) focusing on `games/badugi/logic/__tests__/roundFlow.test.js`, then manual sanity-check NPC draws (4-card pat, 3-card draws).

### 1-4. UI / Layout

#### Bug-06: CPU stack/bet info is hard to read
- Status: DONE
- Fix: Added the `PlayerStatusBoard` HUD (`ui/components/PlayerStatusBoard.jsx`) that lists every seat's name, position label, stack, current bet, and badges (YOU / ALL-IN / FOLDED / BUSTED / ACTING). The board references `specs/06_player_status_board.md` and keeps CPU stacks visible even when their cards are face down.

#### Bug-07: Seat layout breaks on resize
- Status: DONE
- Fix: `ui/App.jsx` now renders seats via a responsive grid (mobile) and Tailwind `lg:absolute` anchors (desktop). `Player.jsx` gained BTN badges and ASCII-only status chips so resizing no longer corrupts layout.

### 1-5. History Log

#### Bug-08: Action history misses intermediate steps
- Status: DONE
- Fix: `recordActionToLog` now writes a normalized entry (`phase`, `round`, `seatName`, `stackBefore/After`, `betBefore/After`, `potAfter`, `metadata`) for every BET/DRAW/SHOWDOWN action, including NPC moves and pot distribution. Draw metadata includes `drawInfo` snapshots, and the JSONL exported via `utils/history_rl.js` now contains every intermediate step.

---

## 2. Upcoming Work (short list)

- [x] Test automation: extend `npm test` with UI snapshots / scraping diff checks (Playwright harness lives under `tests/scraping/`).
- [x] Core game:
  - [x] Tournament structure: blind/ante/starting stack schedule now drives every deal (level tracker + hand counter in `ui/App.jsx`).
  - [x] Seat states: Seat Manager overlay controls Human / CPU / Empty per seat, optional auto-rotation, and per-seat redeal/reset helpers.
  - [x] Side pots: `settleStreetToPots` carries folded contributions and eligibility fixes so multi-pot payouts are accurate.
- [ ] AI / Learning: HandRecord & TournamentRecord export、4段階のAI難易度、Python RL（Q-table / ONNX）連携を仕上げる。
- [ ] UI / Effects: Tailwind + Framer Motion でアニメーションを整理し、チップ移動・勝者演出・カードの「しならせ」演出を入れる。
- [ ] Tournament mode (CPU専用マルチテーブル MTT):
  - [x] ステージ＆賞金テーブル: `config/tournamentStages.js` / `config/tournamentOpponents.js` に参加費・人数レンジ・プライズジャンプ・ネームド CPU を定義。
  - [x] エントリーと進行: `TournamentScreen` でバンクロール確認 → エントリー → `createTournamentSession()` → `/game?tournament=...` に遷移。進行中セッション再開も可。
  - [x] セッション管理: `ui/utils/tournamentState.js` と `ui/tournament/tournamentManager.js` で bankroll / wins / history を localStorage 保存。結果確定時に賞金を自動清算。
  - [x] リタイアとフェアプレー: リタイアボタンで任意終了、盤面更新ごとにセッションへ即同期し、リロードによる巻き戻しを不可にした。
  - [x] フィードバック: トーナメント終了時に最大 EV ロスのアクションを抽出し、助言コメントと共に履歴へ保存。
  - [x] マルチテーブル再シート: `tableAssignments` + `waitingQueue` で他卓から CPU を再配置して常に 6-max を維持。
  - [x] ハンド振り返り: 1 ハンドごとのスタック / ベット / ドロー枚数 / 勝者を `history.tournamentHands` に保存し、履歴画面で参照可能にした。
  - [ ] 決勝演出と賞金 UI: 最終卓 / 優勝時の演出、賞金ダイアログ、History 画面のリザルトカードを作成する。
  - [ ] EV アドバイス強化: 行動ログとハンド履歴を突き合わせ、期待値差を可視化する詳細レポートを History 画面へ追加する。
- [x] Seat layout: 6-max が常に楕円上に並ぶよう絶対座標を固定し（BTN=左上、SB=BTN左隣、BB=右下…）、プレイヤー名/アイコン/スタックが互いに干渉しないレイアウトを維持。
- [x] Chip HUD: アバター横にスタック / 現在ベット / バッジを表示する HUD を整備し、配色を統一。
- [ ] Settings / Themes: `/settings` 画面でテーマ・配色・音量を切り替えられるようにし、タイトル画面とトレーニング画面から遷移できるようにする。
- [ ] Platform: PWA + FastAPI 構成を整理し、バックエンド API / WebSocket / スクレイピング runner の環境要件を README / docs にまとめる。

---

## 3. Reinforcement Learning (Badugi)

Goal: train self-play agents for 6-max Badugi and use them as CPU opponents (including “iron-strong” boss characters).

### Current status

- [x] Implemented `rl/env/badugi_env.py` as a Gym-style environment for Badugi.
- [x] Added `rl/agents/dqn_agent.py` (DQN) and `rl/utils/replay_buffer.py`.
- [x] Implemented `rl/training/train_dqn.py` and verified end-to-end episodes.
- [x] Moved `badugi_env.py` under `rl/env/`, normalized observations, and converted comments to ASCII.
- [x] Added `rl/requirements.txt` and `rl/README.md` so numpy/torch/gymnasium installs are one command away.
- [ ] Connect in-app hand history / JSONL logging so that played hands can feed offline RL data.
- [ ] Train a baseline DQN model on CPU and save checkpoints under `rl/models/`.
- [ ] Export a compact model (ONNX or similar) so the React frontend can load it for AI difficulty tiers.
- [ ] Tune rewards and observation/action spaces to keep agents strong but human-like.

---

## 4. Operating Rules & UI Guidelines

1. **Bug fix checklist**: `docs/bug_fixes*.md` / `docs/known_bugs.md` / `specs/.vscode/badugi-bugs.code-snippets` を更新 → `npm test` → `git add -p` → `git commit -m "fix: Bug-XX ..."` → `git push`（プッシュはユーザー実施）。修正ごとに必ず push。
2. **Recording discipline**: 新規バグは必ずセクション 1 に追記し、修正完了後に Status を DONE へ。再発したら REGRESSION に戻す。
3. **Spec hygiene**: 新機能はセクション 2 へ箇条書きで登録し、仕様メモは `docs/*.md` へまとめる。運用ルールは本セクションで管理。
4. **Roadmap discipline**: すべてのタスクをチェックボックス付きで記録し、コード + ドキュメント + テスト + push が揃った時点で [x] にする。
5. **Table HUD layout**: PlayerStatusBoard / Seat Manager / Table Status は黄色いテーブル枠の外に置き、枠内にはカード・ポット・勝者演出だけを描画する。ボタンやトグルはテーブル下部へ集約。
6. **Layout memory**: 楕円座標（CPU2 左下・CPU3 左上・CPU5 右上・CPU6 右下 etc.）を忘れないこと。プレイヤー幅を十分に取り、カード 4 枚を横並びで重ならないようにする。
7. **Tournament fairness**: トーナメント進行は常に localStorage へ即同期し、リロードで結果が巻き戻らないようにする。テーブル移動時はスタック・手番を維持し、FT 突入時に演出とプライズ案内を表示する。

---

## 5. Spec 09+ Implementation Backlog

各 md（Spec 09 以降）について、仕様をタスク粒度へ分解した。現状ソースには未実装なので、すべて未着手 `[]`。進捗に応じて `[x]` へ切り替える。

### Spec 09: Game Engine Abstraction / Multi-Game Architecture
- [ ] Player/Pot/TableState モデルを `games/core/models.ts` として切り出し、Badugi 実装と整合させる。
- [ ] `GameEngine` インターフェースを `games/core/gameEngine.ts` に実装（initHand / applyForcedBets / applyPlayerAction / resolveShowdown ほか）。
- [ ] Draw/Board/Stud などファミリー別のベースクラスを scaffold（`DrawEngineBase` 等）。
- [ ] `GameEngineContext`（UI⇔エンジンの仲介フック）を作成し、App から直接 Badugi 関数を呼ばない構造にする。
- [ ] 既存の `roundFlow.js` / `drawRound.js` / `showdown.js` を BadugiEngine クラスへ移行する。
- [ ] `engineRegistry.ts` を作成し、BadugiEngine を登録。新ゲーム追加 API を提供。
- [ ] UI（`ui/App.jsx`）を GameEngine API で状態更新するよう全面改修。
- [ ] Spec08 のログ schema に準拠した `ActionLogAdapter` を追加し、エンジン結果からログを書き出す。
- [ ] RL/Gym 用の `getObservation(state, playerId)` 実装を BadugiEngine に追加。
- [ ] GameEngine 単体テスト（1 ハンド通過 / エラー処理）を `games/__tests__/badugiEngine.test.ts` に追加。
- [ ] 例外クラス（IllegalActionError 等）を定義し、UI 側でハンドリングする。
- [ ] Migration ガイドを `docs/engine_migration.md` にまとめる。

### Spec 10: Multi-Game List & Requirements
- [ ] 35 変種（Holdem/Omaha/Draw/Stud/Dramaha）を `config/games/multiGameList.json` に登録。
- [ ] ファミリーごとの詳細要件（デッキサイズ / Street / Evaluator）を `games/core/variantProfiles.ts` に定義。
- [ ] GameSelector UI にゲームファミリータブと詳細リストを実装。
- [ ] Variant 選択時に GameProfile（blind/ante/初期スタック/Evaluator）を返す仕組みを作成。
- [ ] Engine 要件チェック（board game なら boardRenderer が必要など）を `games/core/requirements.ts` で実装。
- [ ] Mixed Game Rotation（Spec11）で variant リストを読み込めるよう統合。
- [ ] RL/AI が参照する Variant メタデータ JSON をエクスポート。
- [ ] `i18n/games.json` を追加し、Variant 名や説明を多言語化。
- [ ] `docs/game_catalog.md` を生成して Variant 一覧 / 要件を整理。
- [ ] Variant 構成のサニティチェックテストを追加。

### Spec 11: Mixed Game Spec
- [ ] Rotation 設定ファイル `config/mixed/mixedProfiles.json` を追加（ゲーム順・ハンド数・制限時間など）。
- [ ] Mixed Game Editor UI を GameSelector 内に作成（ドラッグ＆ドロップ / ハンド数指定）。
- [ ] ハンド終了ごとに次の gameId を engineRegistry から取得してエンジンを差し替える `MixedGameController` を実装。
- [ ] HUD に現在/次ゲーム・残りハンドを表示。
- [ ] Mixed セッションを tournamentManager と統合し、席移動や再着席でも rotation を維持。
- [ ] Mixed ring / tournament で blind/ante のルール切替を実装。
- [ ] Mixed ハンド履歴を `history.mixedHands` に保存し、History 画面でフィルタ可能にする。
- [ ] Mixed 専用ログ（Spec08 拡張）を出力。
- [ ] Rotation 進行と UI 表示を検証するテストを追加。

### Spec 12: World Championship Unlock
- [ ] `playerProgress.worldChampionship` 状態とアンロック日時を localStorage に保存。
- [ ] Clear 条件計算（店舗→地方→全国→世界2回など）を `computeUnlockState()` で実装。
- [ ] 解放アニメーション用コンポーネント `WorldUnlockModal` を追加。
- [ ] GameSelector に Locked/Unlockable/Unlocked の表示を追加。
- [ ] Unlock 後の効果（世界大会メニュー解放、Mixed/Tournament での選択）を制御。
- [ ] Unlock イベントを `history.unlockEvents` と Spec08 ログへ記録。
- [ ] Unlock e2e テスト（条件達成→解放→再起動で維持）を Playwright で作成。

### Spec 13: Codex Automated Development Pipeline
- [ ] `.devtools/auto_tasks.yaml` を作成し、5 つ以上のサンプルタスクを登録。
- [ ] `.devtools/codex_prompt_template.txt` にトークン（{{TASK_ID}} 等）を定義。
- [ ] `.devtools/codex_worker.js` を実装し、タスク処理→Codex 呼び出し→ファイル更新→git commit→PR 作成を自動化。
- [ ] worker のユニットテスト（YAML パース / 失敗時の挙動）を追加。
- [ ] `.github/workflows/codex_nightly.yml` で毎日 03:00 に worker を実行。
- [ ] worker 実行ログを Actions artifact として保存。
- [ ] AutoPR の命名/コミットメッセージ規約を実装。
- [ ] 手動実行用の `workflow_dispatch` エントリを追加。
- [ ] 失敗時にタスク status を `skipped` に更新し、重複実行を防止。
- [ ] Pipeline 運用手順を `docs/codex_pipeline.md` にまとめる。

### Spec 14: Evaluator Architecture
- [ ] `games/evaluators/core.ts` に統一 Evaluator API（`evaluateHand`, `compareHands` 等）を実装。
- [ ] High-hand evaluator（Holdem/Omaha）を実装し、ビットテーブル生成スクリプトを追加。
- [ ] Lowball evaluator（2-7 TD, A-5, Badugi low）を追加。
- [ ] Split-pot evaluator（High/Low, Dramaha）向けの複合結果オブジェクトを定義。
- [ ] Stud evaluator（upcard を含む）を実装。
- [ ] Dramaha evaluator（board + draw）を実装。
- [ ] evaluator registry を作成し、GameEngine が gameId→evaluator を解決できるようにする。
- [ ] evaluator 専用テストスイートを追加し、CI で 1,000 ケースを検証。
- [ ] evaluator パフォーマンス計測スクリプトを用意。
- [ ] 現行 Badugi evaluator を新 API へ移植し、UI/RL/History 側の参照を更新。

### Spec 15: UI / UX Flow
- [ ] デザイン token（色 / 余白 / タイポ）を `styles/designTokens.ts` に定義して全画面で共有。
- [ ] Title Screen を Spec15 デザインへ刷新し、CTA ボタン/背景演出を実装。
- [ ] Main Menu / GameSelector の画面遷移を再構成し、ゲーム種別別のカード UI を実装。
- [ ] Mixed Game Setup 画面（Spec11）を作成し、rotation/weight 編集を可能にする。
- [ ] Tournament Setup 画面を Spec17 の blind sheet と同期。
- [ ] Table Screen コンポーネントを再分割し（ステータス・プレイヤー・コントロール）、再利用性を高める。
- [ ] Result Screen（リング・トーナメント・Mixed・Replay）を実装。
- [ ] History 画面にフィルタ/検索/詳細サマリを追加。
- [ ] Settings 画面にテーマ / サウンド / コントローラ設定を実装。
- [ ] 共通モーダル/通知コンポーネントを整備し、演出仕様を満たす。
- [ ] Responsive ルール（モバイル縦横 / タブレット / デスクトップ）を Tailwind カスタムブレークポイントに定義。
- [ ] UX パフォーマンス要件（初回ロード3秒以内, インタラクション遅延100ms未満）をモニタリングする計測を追加。

### Spec 16: Mixed Game Pro
- [ ] プロ向けミックスプリセット（HORSE, 8-Game, Dealer's Choice 等）を `mixedGamePro.json` に追加。
- [ ] Weighted rotation / Dealer's Choice を UI から設定できるようにする。
- [ ] プロルール（宣言制、Bring-in、Kill blind）を GameEngine / Controller に実装。
- [ ] プロ専用 HUD（残りハンド / kill 状態 / 宣言ラベル）を追加。
- [ ] Rule enforcement（宣言ミス / 行動順違反）を自動警告するロジックを追加。
- [ ] 混合用 AI プロファイルを Spec18 の AI 層に追加。
- [ ] Mixed Pro 用ログ / リーダーボード（Spec17, 20 と連携）を実装。
- [ ] プロ用 Playwright シナリオ（rotation / kill blind / 宣言）を作成。

### Spec 17: Pro Tournament System
- [ ] Pro blind sheet を `config/tournament/proBlindSheets.json` に実装。
- [ ] Multi-table balancing（他卓からの再シート）を強化し、ログを表示。
- [ ] Break system（時間計測 / 残り表示）を tournamentManager に追加。
- [ ] Final Table 演出（アニメーション / バナー / カメラズーム）を実装。
- [ ] Prize structure を UI + payout ロジックに適用。
- [ ] Player progression / elimination タイムラインを実装。
- [ ] Pro tournament HUD（平均スタック, BB 数, 残りプレイヤー）を追加。
- [ ] Pro AI（Spec18）を適用し、CPU tier を自動調整。
- [ ] ログと History（Spec08 拡張）で ITM / Finish / ハンド数を記録。
- [ ] 受入テスト（blind sheet 再現, balancing 動作）を追加。

### Spec 18: AI / RL Pro
- [ ] AI アーキテクチャを 3 層に分割し、`ai/core/` に配置。
- [ ] CPU tier（Spec19）に応じたポリシーを適用する ModelRouter を実装。
- [ ] RL データパイプライン（観測→JSONL→学習→ONNX）を自動化。
- [ ] モデル切替（ゲーム/モード別）を実装。
- [ ] Dynamic opponent modeling（リアルタイムでプレイヤー傾向を学習）を追加。
- [ ] Mixed ゲーム用の AI プロファイルを `mixed_ai_profiles.json` に定義。
- [ ] WorldMaster AI（ボス）専用の設定/演出を実装。
- [ ] AI デバッグログ（入力ベクトル / 推論結果）を Spec08 拡張で出力。
- [ ] AI/RL 用のテスト（モデル選択 / 推論結果）を追加。

### Spec 19: CPU Difficulty Tier System
- [ ] Tier 定義ファイル `config/cpu/tiers.json` を作成。
- [ ] KPI 指標（VPIP, PFR, AF, BluffFreq, SDWin%）を NPC 状態に保持。
- [ ] Tier ごとの挙動（range, raise サイズ, draw 枚数）を NPC ロジックに接続。
- [ ] Tournament ステージに応じた tier 自動割当ロジックを tournamentManager に追加。
- [ ] Dynamic Difficulty（Spec19.7）を `adjustCpuTier()` として実装。
- [ ] Tier→モデル mapping を Spec18 の ModelRouter に登録。
- [ ] HUD に tier バッジ／ツールチップを追加。
- [ ] Tier 変更ログを Spec08 schema に追加。
- [ ] Tier 調整用 Dev パネルを作成し、テスト時に可視化。

### Spec 20: User Rank / P2P Global Rating
- [ ] User rating state（Skill / Style / Mixed）を `progress/ratingState.ts` に実装。
- [ ] Elo/Glicko ベースのレーティング更新を `ratingEngine.ts` に追加。
- [ ] Style rating（アグレッション / ブラフ率 / ショーダウン率）解析ロジックを実装。
- [ ] Mixed rating を rotation ログと連携して算出。
- [ ] P2P 対戦結果を RL パイプライン（Spec18）にフィード。
- [ ] Global leaderboard UI（検索・フィルタ・ソート）を追加。
- [ ] Anti-cheat（急激なレート上昇、マルチアカウント）検出ロジックを実装。
- [ ] Profile 画面に rating 履歴グラフと tier 表示を追加。
- [ ] Rating 更新ログを Spec08 schema に統合。

### Spec 21: Backend API / Server Sync
- [ ] FastAPI もしくは Node で `server/` ディレクトリを作成し、基本構造を整備。
- [ ] 認証（JWT/OAuth）を実装し、クライアント SDK を `utils/apiClient.ts` に追加。
- [ ] 主要 API（/profile /history /tournament /tasks /ai-models 等）を stub。
- [ ] クライアント同期マネージャー（delta sync / snapshot）を `utils/syncManager.ts` で実装。
- [ ] DB schema（Players / Sessions / Ratings / Models / Unlocks）を定義。
- [ ] AI モデル配布 API を追加し、Spec18 と連携。
- [ ] Tournament resume API を作成し、クラッシュ時に復旧できるようにする。
- [ ] セキュリティ対策（Rate limit / Input validation / Audit log）を middleware で実装。
- [ ] Codex pipeline（Spec13）が API を叩いてステータスを取得できる CLI を追加。
- [ ] CI で API コントラクトテストを実行。

### Spec 22: P2P Online Play Pre-design
- [ ] ルーム/マッチメイク管理 `p2p/roomManager.ts` を実装。
- [ ] WebSocket ベースのリアルタイム sync を構築し、メッセージ schema を定義。
- [ ] カードセキュリティ（暗号化・ハッシュ検証）を実装。
- [ ] P2P ゲーム同期フロー（deal→action→showdown）を状態マシン化。
- [ ] オンライン対局でも Spec08 ログを生成。
- [ ] Rating / Spec20 とオンライン結果を連動。
- [ ] Connection loss handling（リコネクト / bot 代打）を実装。
- [ ] Cross-platform 入力処理（PC/モバイル）を設計。
- [ ] 将来の Spectator mode / WebRTC Direct mode のプレースホルダーを用意。
- [ ] REST + WebSocket API の OpenAPI/AsyncAPI ドキュメントを作成。
- [ ] Anti-cheat / Fairness モジュールを P2P に適用。

（現状、上記機能はいずれも未実装のため全項目 `[]`）

