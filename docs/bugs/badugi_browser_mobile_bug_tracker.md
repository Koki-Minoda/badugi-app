# Badugi Browser / Mobile Bug Tracker

更新日: 2026-05-04
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
- Fixed Commit:
- Repro Closed Date:
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

- Status: `verified`
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
  - 2026-04-30: fold 後の action progression と seat order は Playwright Badugi flow で回帰確認済み。
- Fixed Commit:
  - prior implementation commits; verified in `190f76f` 以降の smoke run.
- Repro Closed Date: `2026-04-30`
- Residual Risk:
  - 物理端末ブラウザでは未確認。`BG-005` で継続する。

## BG-002

- Status: `verified`
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
  - 2026-04-30: 3-draw flow と card history の巻き戻りなしを Playwright Badugi flow で回帰確認済み。
- Fixed Commit:
  - prior implementation commits; verified in `190f76f` 以降の smoke run.
- Repro Closed Date: `2026-04-30`
- Residual Risk:
  - 物理端末長時間操作では未確認。`BG-005` で継続する。

## BG-003

- Status: `verified`
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
  - 2026-04-30: single pot と side pot の overlay 表示は Playwright Badugi flow で回帰確認済み。
- Fixed Commit:
  - prior implementation commits; verified in `190f76f` 以降の smoke run.
- Repro Closed Date: `2026-04-30`
- Residual Risk:
  - 物理端末の overlay 表示は未確認。`BG-005` で継続する。

## BG-004

- Status: `verified`
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
  - 2026-04-30: hand result 後の next hand と folded flag reset は Playwright Badugi flow で回帰確認済み。
- Fixed Commit:
  - prior implementation commits; verified in `190f76f` 以降の smoke run.
- Repro Closed Date: `2026-04-30`
- Residual Risk:
  - 物理端末での next hand / history 長時間操作は未確認。`BG-005` で継続する。

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

## BG-006

- Status: `fixed`
- Severity: `high`
- Area: `ui-layout`
- First Seen: `2026-05-04`
- Repro Rate: `always`
- Environment:
  - Browser: Chrome / desktop
  - OS: Windows / Linux
  - Device: desktop
  - Orientation: landscape
  - Input: mouse
- Summary:
  - スマホ横画面対応後、PC版の table felt が細い横帯に潰れ、seat / cards が卓の外に浮いて見える。
- Expected:
  - PC版は従来通り大きな楕円卓を表示し、モバイル専用レイアウトの圧縮値を受けない。
- Actual:
  - `table-felt-oval` の `inset-y-[45%]` がPCにも適用され、卓の高さが約10%になった。
- Suspected Scope:
  - Files:
    - `src/ui/screens/layouts/GameLayoutBase.jsx`
  - Cross-game:
    - Badugi: affected
    - 2-7 / A-5 draw: affected if same shared layout is used
    - Hold'em / Omaha: affected if same shared layout is used
- Fix Plan:
  - `layoutMode === "mobile"` の時だけ圧縮insetを使い、desktopは大きな楕円卓insetへ戻す。
- Verification Plan:
  - `tests/e2e/tournament-ui-layout-smoke.spec.ts` で desktop felt の width / height 下限を検証する。
- Resolution:
  - 2026-05-04: `GameLayoutBase` の felt / ring class を mobile と desktop で分離。
- Residual Risk:
  - 実PCブラウザでの目視はデプロイ後に継続確認する。

## BG-007

- Status: `fixed`
- Severity: `medium`
- Area: `ui-layout`
- First Seen: `2026-05-04`
- Repro Rate: `often`
- Environment:
  - Browser: Chrome / desktop
  - OS: Windows / Linux
  - Device: desktop
  - Orientation: landscape
  - Input: mouse
- Summary:
  - `public/characters/` に画像を配置しても、CPU seat が画像ではなくinitial表示になることがある。
- Expected:
  - CPU roster の `avatarUrl` が table seat / HUD / tournament復元後の seat でも画像avatarとして表示される。
- Actual:
  - adapter の `default_avatar` が roster由来の `avatarUrl` を上書きする経路があった。
- Suspected Scope:
  - Files:
    - `src/ui/App.jsx`
    - `src/ui/utils/seatViewMerge.js`
    - `src/ui/game/badugi/BadugiUIAdapter.js`
  - Cross-game:
    - Badugi: affected
    - 2-7 / A-5 draw: possible if adapter merge path uses default avatar
    - Hold'em / Omaha: possible if adapter merge path uses default avatar
- Fix Plan:
  - base seat の `avatarUrl` を `avatar` に正規化し、adapterの `default_avatar` では実画像URLを上書きしない。
- Verification Plan:
  - `seatViewMerge` unit test と Badugi UI adapter test で画像URL保持を確認する。
- Resolution:
  - 2026-05-04: base seat/tournament hydrate/seat merge を修正。
- Residual Risk:
  - draw系 adapter の専用avatar testは今後追加する。

## BG-008

- Status: `fixed`
- Severity: `critical`
- Area: `gameplay`
- First Seen: `2026-05-04`
- Repro Rate: `sometimes`
- Environment:
  - Browser: Chrome / desktop
  - OS: Windows
  - Device: desktop
  - Orientation: landscape
  - Input: mouse
- Summary:
  - Hero またはCPUが all-in した後、BET/DRAW進行が `Waiting for other players...` で止まることがある。
- Expected:
  - all-in seat は以後のBET actorから除外される。ただしdraw pokerではlive handの交換権を保持し、DRAW actorとしては進行できる。
- Actual:
  - Badugiとdraw lowball系でBET eligibilityとDRAW eligibilityの扱いが揺れ、all-in seatを待ち続ける/逆に交換権を消す回帰が起き得た。
- Suspected Scope:
  - Files:
    - `src/games/badugi/flow/actionUtils.js`
    - `src/games/badugi/logic/__tests__/roundFlow.test.js`
    - `src/games/draw/__tests__/DeuceToSevenTripleDrawEngine.test.js`
  - Cross-game:
    - Badugi: affected
    - 2-7 Triple / A-5 Triple / 2-7 Single / A-5 Single: independent engine/controller all-in draw regression added and re-run
    - Hold'em / Omaha: separate controller path, not covered by this Badugi fix
- Fix Plan:
  - BET eligibility と DRAW eligibility を分離する。
  - live all-in seat はDRAW可能、folded/sittingOut/seatOut/busted seatだけDRAW不可にする。
  - all-inだが `hasActedThisRound=false` のseatがBETで詰まらず、DRAW権は残る回帰testを追加する。
- Verification Plan:
  - Badugi roundFlow unit test。
  - draw lowball family all-in regression test。
- Resolution:
  - 2026-05-04: `isSeatEligibleForDraw` 修正と回帰test追加。
  - 2026-05-04: draw lowball engine/controllerも同じ方針へ統一。all-in live seatはDRAW可能、BET不可、空BET streetはskipする。
  - 2026-05-05: Badugi engine のBET→DRAW遷移でも `isSeatEligibleForDraw` を使うよう修正し、live all-in seatのDRAW権を保持。
  - 2026-05-05: short all-in seatはBET完了判定で未達bet扱いにせず、残りlive seatが行動済みならstreet advance可能に修正。
  - 2026-05-05: Hero all-in後にHeroへBET turnが戻らないE2E、CPU/bust all-in後に追加actionが出ないE2Eを追加。
- Residual Risk:
  - 実ブラウザで hero / CPU all-in が複数回起きる長時間プレイを継続確認する。

## 5. 修正済み Bugs

- `BG-001` SB fold 後の action carousel 停止: `verified`
- `BG-002` draw snapshot rollback: `verified`
- `BG-003` single pot overlay の余分な pot block: `verified`
- `BG-004` result overlay 後の next hand 操作停止: `verified`
- `BG-006` PC table felt collapse after mobile layout: `fixed`
- `BG-007` character avatarUrl not applied consistently: `fixed`
- `BG-008` all-in seat retained as draw actor: `fixed`

## 6. 次に埋めるべき項目

- `BG-005` の実機再現ログ
- iPhone Safari の orientation 切替時の表示
- Android Chrome の touch hitbox と discard 操作
- 実ブラウザでの hand result overlay と next hand 遷移
