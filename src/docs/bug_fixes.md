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
- Fix: The table view now uses a responsive dual-mode layout. Small screens render the players in a grid, while large screens anchor each seat via Tailwind窶冱 `lg:absolute` helpers so BTN / SB / BB positioning survives window resizing. `ui/components/Player.jsx` also exposes BTN badges and ASCII-only status text to avoid glyph corruption that previously broke layout calculations.

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
  - `ui/App.jsx`: PlayerStatusBoard 縺ｨ Seat Manager 繧偵ユ繝ｼ繝悶Ν譫螟悶・蟆ら畑繝ｬ繧､繧｢繧ｦ繝医↓遘ｻ蜍輔＠縲∝ｺｧ蟶ｭ縺ｮ邨ｶ蟇ｾ菴咲ｽｮ/蟷・ｒ繝昴・繧ｫ繝ｼ蜊薙Λ繧､繧ｯ縺ｫ蜀埼・鄂ｮ縺励※ CPU 5/6 縺ｪ縺ｩ縺悟ｹｲ貂峨＠縺ｪ縺・ｈ縺・俣髫斐ｒ諡｡蠑ｵ縲ゅユ繝ｼ繝悶Ν閾ｪ菴薙ｂ 16:9繝ｻ譛螟ｧ 1400px 縺ｾ縺ｧ蠎・￡縲。ET(邱・/DRAW(襍､)縺ｧ繝輔ぉ繝ｫ繝郁牡繧貞・繧頑崛縺医√い繧ｯ繧ｷ繝ｧ繝ｳ/繝峨Ο繝ｼ繝懊ち繝ｳ縺ｯ繝・・繝悶Ν荳九・蟆ら畑繝ｬ繝ｼ繝ｳ縺ｸ遘ｻ蜍輔＠縺溘・
  - `ui/components/Player.jsx`: 繧ｫ繝ｼ繝我ｸ隕ｧ繧剃ｽ呵｣輔・縺ゅｋ 4 譫壽ｨｪ荳ｦ縺ｳ繧ｰ繝ｪ繝・ラ・亥ｺ・ａ縺ｮ繧ｮ繝｣繝・・莉倥″・峨↓螟画峩縺励√け繝ｪ繝・け繝溘せ繧帝亟豁｢縲・
- Tests: `npm test`

## Title / Settings Screen
- Status: DONE
- Notes:
  - 譁ｰ縺励＞ `/` 繝ｩ繝ｳ繝・ぅ繝ｳ繧ｰ逕ｻ髱｢・・ui/screens/TitleScreen.jsx`・峨→ `/settings` 逕ｻ髱｢・・ui/screens/TitleSettingsScreen.jsx` + `TitleForm`・峨ｒ霑ｽ蜉縲ゅ・繝ｬ繧､繝､繝ｼ蜷阪・繧ｿ繧､繝医Ν繝ｻ繧｢繝舌ち繝ｼ繧偵Ο繝ｼ繧ｫ繝ｫ菫晏ｭ倥＠縲～App.jsx` 縺ｮ繝偵・繝ｭ繝ｼ蠎ｧ蟶ｭ縺ｫ閾ｪ蜍募渚譏縺吶ｋ縲・
  - 繝ｫ繝ｼ繝・ぅ繝ｳ繧ｰ繧・`RootApp.jsx` 縺ｸ遘ｻ縺励～main.jsx` 縺九ｉ蜈ｱ騾壹ち繧､繝医Ν/繧ｲ繝ｼ繝/螻･豁ｴ/繝励Ο繝輔ぅ繝ｼ繝ｫ繧貞・繧頑崛縺亥庄閭ｽ縺ｫ縺励◆縲・
- Tests: `npm test`

## Bet flow - all-check after folds/all-ins
- Status: DONE
- Notes:
  - `ui/App.jsx`: BET繝ｩ繧ｦ繝ｳ繝峨〒隱ｰ繧ゅ・繝・ヨ縺励※縺翫ｉ縺壹∵釜繧翫◆縺溘∩貂医∩/繧ｪ繝ｼ繝ｫ繧､繝ｳ蟶ｭ縺悟性縺ｾ繧後ｋ蝣ｴ蜷医↓縲∝・蜩｡縺後後メ繧ｧ繝・け貂医∩縲阪→蛻､譁ｭ縺輔ｌ縺壹Λ繧ｦ繝ｳ繝峨′騾ｲ縺ｾ縺ｪ縺・ヰ繧ｰ繧剃ｿｮ豁｣縲ＡallChecked` 蛻､螳壹・ `folded`/`allIn` 蠎ｧ蟶ｭ繧呈ｺ縺溘＠縺溘ｂ縺ｮ縺ｨ縺励※謇ｱ縺・・
- Tests: `npm test`

## Bug-09 - All-in players skip DRAW
- Status: DONE
- Notes:
  - `games/badugi/logic/drawRound.js`: `actor.allIn` 縺ｧ縺ｯ DRAW 繧偵せ繧ｭ繝・・縺励↑縺・ｈ縺・↓縺励∝ｺｧ蟶ｭ縺後が繝ｼ繝ｫ繧､繝ｳ縺ｧ繧・`lastAction: DRAW(n)` 縺梧ｮ九ｋ繧医≧縺ｫ縺励◆縲・  - `games/badugi/logic/roundFlow.js`: `aliveDrawPlayers` 縺・seatOut 縺縺代ｒ髯､螟悶＠縲∥ll-in 蟶ｭ繧・DRAW 鬆・分縺ｸ谿九☆繧医≧縺ｫ隱ｿ謨ｴ縲・  - `games/badugi/logic/__tests__/drawRound.test.js`: 譁ｰ隕上ユ繧ｹ繝医〒 all-in 蟶ｭ縺・DRAW 繧｢繧ｯ繧ｷ繝ｧ繝ｳ繧貞ｮ溯｡後☆繧九％縺ｨ繧剃ｿ晁ｨｼ縲・- Tests: `npm test`

## Bet flow - folded SB after all-in aggressor
- Status: DONE
- Notes:
  - `games/badugi/logic/roundFlow.js`: `closingSeatForAggressor` 縺梧怙蠕後・繧｢繧ｰ繝ｬ繝・し繝ｼ縺後ヵ繧ｩ繝ｼ繝ｫ繝峨＠縺滓凾縺ｫ `null` 繧定ｿ斐＠縺ｦ縺・◆縺溘ａ縲ヾB 縺後ヵ繧ｩ繝ｼ繝ｫ繝峨☆繧九→繝ｩ繧ｦ繝ｳ繝峨′騾ｲ縺ｾ縺ｪ縺・こ繝ｼ繧ｹ縺後≠縺｣縺溘ゅい繧ｰ繝ｬ繝・し繝ｼ縺後ヵ繧ｩ繝ｼ繝ｫ繝・繧ｪ繝ｼ繝ｫ繧､繝ｳ縺ｧ繧よｬ｡縺ｮ逕溷ｭ倩・ｒ closing seat 縺ｨ縺励※謇ｱ縺・ｈ縺・↓菫ｮ豁｣縲・
  - `ui/App.jsx`: draw 鬆・ｺ上・繧ｪ繝ｼ繝ｫ繧､繝ｳ貂医∩縺ｧ繧らｶ咏ｶ壹〒縺阪ｋ繧医≧ `firstUndrawnFromSB` 繧呈綾縺励▽縺､ BET 蛻､螳壼・縺ｧ陬懈ｭ｣縲・
- Tests: `npm test`

## All-in players incorrectly marked BUSTED during hand
- Status: DONE
- Notes:
  - `games/badugi/logic/roundFlow.js`: `sanitizeStacks` previously forced `hasDrawn=true` 縺ｨ `isBusted=true` when stack reached 0, causing all-in players to be treated as folded/busted before showdown縲ゅせ繧ｿ繝・け縺・0 縺ｫ縺ｪ縺｣縺滓凾轤ｹ縺ｧ縺ｯ `allIn` 繝輔Λ繧ｰ縺ｮ縺ｿ縺ｫ逡吶ａ繧九ｈ縺・ｿｮ豁｣縺励√ヰ繝ｼ繧ｹ繝亥愛螳壹・繧ｷ繝ｧ繝ｼ繝繧ｦ繝ｳ譎・(`showdown.js`) 縺ｮ縺ｿ縺ｫ髯仙ｮ壹・
- Tests: `npm test`

## Bet flow - folding seat still tracked as aggressor
- Status: DONE
- Notes:
  - ui/App.jsx: added shiftAggressorsAfterFold so when SB・亥性繧莉門ｸｭ・峨′繝輔か繝ｼ繝ｫ繝峨＠縺溷ｴ蜷医〒繧・lastAggressor / etHead 縺梧ｬ｡縺ｮ逕溷ｭ伜ｸｭ縺ｫ貂｡繧翫。ET 繝ｩ繧ｦ繝ｳ繝牙●豁｢繧帝亟豁｢縲・
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


## Tournament hand review logging
- Status: DONE
- Notes:
  - `ui/App.jsx`: �V���[�_�E�����Ƃ� `history.tournamentHands` �փ|�b�g�E���ҁE�e�v���C���[�̃x�b�g/�h���[����ۑ����A�g�[�i�����g������ʂ���U��Ԃ�\�ɂ����B
  - `components/TournamentHistory.jsx`: �g�[�i�����g�ꗗ�ɉ����ăn���h�P�ʂ̏ڍ׃e�[�u���ƃA�N�V�������O��\���B
- Tests: `npm test`
