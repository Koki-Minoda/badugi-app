# Bug Fixes / Progress Log

> Legend: DONE / IN_PROGRESS / NOT_STARTED

## Bug-01 - Negative stacks after all-in
- Status: DONE
- Notes: SB/BB payments are clamped, `isBusted` flag added (`ui/App.jsx`, `roundFlow.js`, `showdown.js`).

## Bug-02 - Bet round never finishes when multiple players are all-in
- Status: DONE
- Changes:
  - `ui/App.jsx`: introduced `hasActedThisRound` state for every player, set/reset across fold/call/raise/NPC actions, and short-circuited BET flow using the new `isBetRoundComplete` result.
  - `games/badugi/logic/roundFlow.js`: `isBetRoundComplete` now checks both matched bet sizes and `hasActedThisRound` (or all-in).
  - `games/badugi/logic/drawRound.js`: optional `onActionLog` callback keeps the history in sync with the revised BET flow.

## Bug-03 - Wrong DRAW start seat
- Status: DONE (`calcDrawStartIndex`).

## Bug-04 - Ambiguous BET termination
- Status: DONE
- Fix: Added `lastAggressor` + `closingSeatForAggressor` and combined them with `hasActedThisRound` so the street closes exactly when action returns to the aggressor.

## Bug-05 - UI vs evaluator mismatch
- Status: DONE
- Fix: Removed every `ev.score` usage. `ui/App.jsx` now logs showdown hands with `{ rankType, ranks }` and NPC draws route through the new `npcAutoDrawCount()` helper that reads `kicker`. CPU draw heuristics no longer rely on the removed `score` field.

## Bug-06 - CPU stack/bet hard to read
- Status: DONE
- Fix: Added the persistent `PlayerStatusBoard` HUD (top-left overlay) that shows every seat's name, position, stack, current bet, and badges (YOU / ALL-IN / FOLDED / BUSTED / ACTING). The UX spec lives in `specs/06_player_status_board.md`. This keeps CPU information visible without hovering over their cards.

## Bug-07 - Seats break on resize
- Status: DONE
- Fix: The table view now uses a responsive dual-mode layout. Small screens render the players in a grid, while large screens anchor each seat via Tailwind’s `lg:absolute` helpers so BTN / SB / BB positioning survives window resizing. `ui/components/Player.jsx` also exposes BTN badges and ASCII-only status text to avoid glyph corruption that previously broke layout calculations.

## Bug-08 - Hand history misses intermediate actions
- Status: DONE
- Fix: `recordActionToLog` now captures every BET/DRAW/SHOWDOWN event with `{ phase, round, seatName, stackBefore/After, betBefore/After, potAfter, metadata }`. Draw events include `drawInfo` snapshots (before/after hands, replaced cards), and showdown payouts record pot splits per seat. `games/badugi/logic/drawRound.js` forwards its `onActionLog` payload in the same format so JSONL exports consistently contain all intermediate actions.

## Core Game - Tournament structure / seats / side pots
- Status: DONE
- Notes:
  - `ui/App.jsx`: blind/ante schedule now advances per hand (level counter + HUD), blinds/antes post directly into `betThisRound`, and the new Seat Manager overlay (starting stack input, seat-type selectors, auto-rotation toggle) feeds `dealNewHand`. Initial pots are no longer double-counted and a live hand/level badge is shown beside the phase info.
  - `games/badugi/logic/roundFlow.js`: `settleStreetToPots` records folded contributions and cleans up eligibility lists so side pots remain correct even when players bust or fold mid-street.
- Tests: `npm test`

## Table HUD / Card layout spacing
- Status: DONE
- Notes:
  - `ui/App.jsx`: PlayerStatusBoard と Seat Manager をテーブル枠外の専用レイアウトに移動し、座席の絶対位置/幅をポーカー卓ライクに再配置して CPU 5/6 などが干渉しないよう間隔を拡張。テーブル自体も 16:9・最大 1400px まで広げ、BET(緑)/DRAW(赤)でフェルト色を切り替え、アクション/ドローボタンはテーブル下の専用レーンへ移動した。
  - `ui/components/Player.jsx`: カード一覧を余裕のある 4 枚横並びグリッド（広めのギャップ付き）に変更し、クリックミスを防止。
- Tests: `npm test`

## Title / Settings Screen
- Status: DONE
- Notes:
  - 新しい `/` ランディング画面（`ui/screens/TitleScreen.jsx`）と `/settings` 画面（`ui/screens/TitleSettingsScreen.jsx` + `TitleForm`）を追加。プレイヤー名・タイトル・アバターをローカル保存し、`App.jsx` のヒーロー座席に自動反映する。
  - ルーティングを `RootApp.jsx` へ移し、`main.jsx` から共通タイトル/ゲーム/履歴/プロフィールを切り替え可能にした。
- Tests: `npm test`

## Bet flow - all-check after folds/all-ins
- Status: DONE
- Notes:
  - `ui/App.jsx`: BETラウンドで誰もベットしておらず、折りたたみ済み/オールイン席が含まれる場合に、全員が「チェック済み」と判断されずラウンドが進まないバグを修正。`allChecked` 判定は `folded`/`allIn` 座席を満たしたものとして扱う。
- Tests: `npm test`

## Bet flow - folded SB after all-in aggressor
- Status: DONE
- Notes:
  - `games/badugi/logic/roundFlow.js`: `closingSeatForAggressor` が最後のアグレッサーがフォールドした時に `null` を返していたため、SB がフォールドするとラウンドが進まないケースがあった。アグレッサーがフォールド/オールインでも次の生存者を closing seat として扱うように修正。
  - `ui/App.jsx`: draw 順序はオールイン済みでも継続できるよう `firstUndrawnFromSB` を戻しつつ BET 判定側で補正。
- Tests: `npm test`

## All-in players incorrectly marked BUSTED during hand
- Status: DONE
- Notes:
  - `games/badugi/logic/roundFlow.js`: `sanitizeStacks` previously forced `hasDrawn=true` と `isBusted=true` when stack reached 0, causing all-in players to be treated as folded/busted before showdown。スタックが 0 になった時点では `allIn` フラグのみに留めるよう修正し、バースト判定はショーダウン時 (`showdown.js`) のみに限定。
- Tests: `npm test`

## Bet flow - folding seat still tracked as aggressor
- Status: DONE
- Notes:
  - ui/App.jsx: added shiftAggressorsAfterFold so when SB（含む他席）がフォールドした場合でも lastAggressor / etHead が次の生存席に渡り、BET ラウンド停止を防止。
- Tests: 
pm test



---

## Changed Files / Status
| File | Summary | Status |
| --- | --- | --- |
| `ui/App.jsx` | Bust handling (Bug-01) + BET flow (`hasActedThisRound`, forced round completion) + Bug-05 evaluator sync | DONE |
| `gameLogic/betRound.js` | Legacy NPC logic updated to new evaluator | DONE |
| `games/badugi/logic/drawRound.js` | Added `onActionLog` hook | DONE |
| `games/badugi/logic/roundFlow.js` | BET/DRAW orchestration, `calcDrawStartIndex`, improved `isBetRoundComplete` | IN_PROGRESS |
| `games/badugi/logic/showdown.js` | Logs + bust flag refresh | DONE |
| `games/badugi/utils/badugiEvaluator.js` | Canonical Badugi evaluator | DONE |
| `games/badugi/utils/handRankings.js` | Default return format updated | DONE |
| `ui/components/Player.jsx` | Player panel redesign + BTN/status badges | DONE |
| `ui/components/PlayerStatusBoard.jsx` | New HUD for Bug-06 stack/bet visibility | DONE |
| `utils/badugi.js` | Legacy wrapper -> canonical evaluator | DONE |
| `utils/history_rl.js` | JSONL append/save/export | DONE |

---

## Pending / Follow-up Tasks
1. Add automated tests that verify the action-log schema (JSON round-trip + required fields).
2. Capture responsive layout screenshots (desktop/mobile) for the PlayerStatusBoard / seat grid and archive them under `specs/`.


