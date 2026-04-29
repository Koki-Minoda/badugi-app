# Badugi Browser / Mobile Bug Tracker

更新日: 2026-04-26  
正本: Badugi の実ブラウザ / 実スマホ / UI / 操作 / 回帰系不具合はこの文書で管理する。

## 1. 運用ルール

- bug ID は `BG-###` 形式で採番する。
- 1 bug = 1 症状で管理する。
- まず再現を書く。推測は後ろに書く。
- `docs/bugs/current_bugs.md` は横断 blocker 管理。
- Badugi 固有の browser / mobile 問題はこの文書を正本とする。
- 修正したら、テスト追加有無と残リスクを必ず更新する。

## 2. 記録テンプレート

```md
## BG-###

- Status: `open|triaged|in_progress|blocked|fixed|verified`
- Severity: `critical|high|medium|low`
- Area: `gameplay|ui-layout|input|animation|hand-history|performance|mobile-only`
- First Seen: `YYYY-MM-DD`
- Repro Rate: `always|often|sometimes|rare`
- Environment:
  - Browser:
  - OS:
  - Device:
  - Orientation:
  - Input:
- Summary:
- Steps to Reproduce:
  1.
  2.
  3.
- Expected:
- Actual:
- Evidence:
  - Screenshot:
  - Video:
  - Console / Log:
  - Hand ID:
- Suspected Scope:
  - Files:
  - Related tests:
- Fix Plan:
- Verification Plan:
- Resolution:
- Residual Risk:
```

## 3. 確認マトリクス

最低限ここは埋める。

| Surface | Values |
| --- | --- |
| Browser | Chrome / Safari / iPhone Safari / Android Chrome |
| OS | Windows / macOS / iOS / Android |
| Orientation | portrait / landscape |
| Input | mouse / touch |
| Mode | ring / tournament-mtt |
| Build | local dev / preview / production-like |

## 4. Active Bugs

## BG-001

- Status: `open`
- Severity: `high`
- Area: `gameplay`
- First Seen: `2026-04-26`
- Repro Rate: `often`
- Environment:
  - Browser: Chromium / Playwright
  - OS: dev environment
  - Device: desktop simulation
  - Orientation: landscape
  - Input: mouse / test driver
- Summary:
  - SB fold 後に action carousel が止まり、次 seat に正しく移らないことがある。
- Steps to Reproduce:
  1. Badugi を開始する。
  2. SB が fold する状況を作る。
  3. 次 seat の action buttons / turn highlight を確認する。
- Expected:
  - BB または次の alive seat へ turn が進む。
- Actual:
  - UTG が highlight のまま操作不能、または同じ seat が再出現することがある。
- Evidence:
  - Console / Log: `docs/bugs/current_bugs.md` の SB fold 系ログ
  - Related tests: `tests/e2e/badugi-flow.spec.ts`, `e2e/sb-fold-bug.spec.js`
- Suspected Scope:
  - Files:
    - `src/games/badugi/engine/roundFlow.jsx`
    - `src/ui/App.jsx`
- Fix Plan:
  - fold 後の next alive seat 決定と `turn` / `betHead` 更新の順序を固定する。
- Verification Plan:
  - existing E2E を通す。
  - 実ブラウザでも 5 回連続再現確認。
- Resolution:
- Residual Risk:

## BG-002

- Status: `open`
- Severity: `high`
- Area: `gameplay`
- First Seen: `2026-04-26`
- Repro Rate: `often`
- Environment:
  - Browser: Chromium / Playwright
  - OS: dev environment
  - Device: desktop simulation
  - Orientation: landscape
  - Input: mouse / test driver
- Summary:
  - Draw 完了後に古い hand snapshot が戻り、draw count が巻き戻ることがある。
- Steps to Reproduce:
  1. Badugi で draw を複数回行う。
  2. Draw#2 以降で hand と drawRound を観察する。
- Expected:
  - 最新 hand が保持され、drawRound は単調増加する。
- Actual:
  - 以前の hand に戻る、または drawRound が巻き戻ることがある。
- Evidence:
  - Console / Log: `[TRACE] finishDrawRound`, `[DRAW][NEXT_TO_DRAW]`
  - Related tests: `e2e/draw-rollback.spec.js`, `tests/e2e/badugi-flow.spec.ts`
- Suspected Scope:
  - Files:
    - `src/games/badugi/engine/roundFlow.jsx`
    - `src/ui/App.jsx`
- Fix Plan:
  - `setPlayers` に入る snapshot の新旧競合を特定し、最新 hand を上書きしない merge にする。
- Verification Plan:
  - draw rollback 系テストを通す。
  - 実ブラウザで連続 draw を 10 hand 確認。
- Resolution:
- Residual Risk:

## BG-003

- Status: `open`
- Severity: `medium`
- Area: `ui-layout`
- First Seen: `2026-04-26`
- Repro Rate: `often`
- Environment:
  - Browser: Chromium
  - OS: dev environment
  - Device: desktop simulation
  - Orientation: landscape
  - Input: mouse
- Summary:
  - pot が 1 つしかないのに result overlay に余分な pot block が出ることがある。
- Steps to Reproduce:
  1. single pot hand を作る。
  2. showdown overlay を開く。
- Expected:
  - Main pot のみ表示される。
- Actual:
  - `Pot #2` など余分な pot 表示が出ることがある。
- Evidence:
  - Related tests: `tests/e2e/badugi-flow.spec.ts`
- Suspected Scope:
  - Files:
    - `src/ui/components/HandResultOverlay.jsx`
    - `src/ui/App.jsx`
- Fix Plan:
  - positive amount の pot のみ描画する。
- Verification Plan:
  - single pot / side pot 両ケースを比較確認。
- Resolution:
- Residual Risk:

## BG-004

- Status: `open`
- Severity: `medium`
- Area: `input`
- First Seen: `2026-04-26`
- Repro Rate: `often`
- Environment:
  - Browser: Chromium / Playwright
  - OS: dev environment
  - Device: desktop simulation
  - Orientation: landscape
  - Input: mouse / test driver
- Summary:
  - hand result overlay 後に Fold button が再表示されず、次 hand の操作に入れないことがある。
- Steps to Reproduce:
  1. fold-only のループを実行する。
  2. 次 hand 開始後に hero action area を確認する。
- Expected:
  - overlay が閉じ、hero action buttons が出る。
- Actual:
  - overlay が残るか、button が見えないまま timeout する。
- Evidence:
  - Related tests: fold-only / badugi flow regression
- Suspected Scope:
  - Files:
    - `src/ui/App.jsx`
    - `src/ui/components/Controls.jsx`
- Fix Plan:
  - `handResultVisible` の解除タイミングと `heroActionReadyRef` の同期を見直す。
- Verification Plan:
  - 連続 fold シナリオで 10 hand 通し確認。
- Resolution:
- Residual Risk:

## BG-005

- Status: `open`
- Severity: `medium`
- Area: `mobile-only`
- First Seen: `2026-04-26`
- Repro Rate: `unknown`
- Environment:
  - Browser: iPhone Safari / Android Chrome
  - OS: iOS / Android
  - Device: physical phone
  - Orientation: portrait / landscape
  - Input: touch
- Summary:
  - 実スマホでの Badugi 操作系バグは未棚卸し。まず再現観測を始める必要がある。
- Steps to Reproduce:
  1. 実スマホで ring hand を開始する。
  2. draw selection / action buttons / result overlay / next hand を確認する。
- Expected:
  - touch 操作で 1 hand を完走できる。
- Actual:
  - 未確認。
- Evidence:
  - Screenshot:
  - Video:
  - Console / Log:
- Suspected Scope:
  - Files:
    - `src/ui/components/MobileOrientationGate.jsx`
    - `src/ui/components/Controls.jsx`
    - `src/ui/screens/layouts/MobileGameLayout.jsx`
    - `src/ui/hooks/useGameSessionState.js`
- Fix Plan:
  - まず実機 smoke checklist を作り、touch / orientation / overlay / scroll を確認する。
- Verification Plan:
  - iPhone Safari と Android Chrome で最低 1 hand ずつ確認。
- Resolution:
- Residual Risk:

## 5. 修正済み Bugs

- まだ記録なし。

## 6. 次に埋めるべき項目

- `BG-005` の実機再現ログ
- iPhone Safari の orientation 切替時の表示
- Android Chrome の touch hitbox と discard 操作
- 実ブラウザでの hand result overlay と next hand 遷移
