# MGX Game Progress Bugfix Ledger

Last updated: 2026-05-06

This ledger consolidates scattered bug notes from `docs/bugs`, `docs/testing`, `docs/badugi_rl_and_variant_status.md`, regression tests, skip reasons, and recent test results. Priority follows the current progress-test policy: P0 freeze/terminal blockers, P1 action/all-in/busted-turn errors, P2 draw/reseat/hand-size gaps, P3 logging/coverage/QA gaps.

## Bugfix Ledger

| Bug ID | Source | Symptom | Repro Test | Suspected Area | Priority | Status | Fix Commit/Files | Verification |
|---|---|---|---|---|---|---|---|---|
| BG-001 / ACTION-001 | `docs/bugs/badugi_browser_mobile_bug_tracker.md`, QA matrix | SB fold後にBB/次seatへturnが渡らず停止する | `tests/e2e/badugi-flow.spec.ts`, `ACTION-001` | Badugi action progression / next actor | P1 | Verified earlier; coverage strengthened | Existing flow fix; `src/games/testing/regression/gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| ACTION-002 | QA matrix | Limp/call後にBB optionが消える | `ACTION-002` | Fixed-limit betting actor selection | P1 | Covered, needs deeper UI cap E2E | `src/games/testing/regression/gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| ACTION-003 | QA matrix / audit | Hero turnでaction UIが消える | `ACTION-003`, `tests/e2e/mgx-game-progress.spec.js` | UI decision panel / controller turn sync | P1 | Covered | `tests/e2e/mgx-game-progress.spec.js` | `npm run test:e2e:progress` PASS |
| ACTION-004 | QA matrix / audit | stale `metadata.actingPlayerIndex` が正しいturnを壊す | `ACTION-004` | snapshot merge / turn priority | P1 | Covered | `src/games/testing/regression/gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| ACTION-005 | Search/audit follow-up | folded seatにturnが戻るとfreezeする | `ACTION-005` | actor eligibility invariant | P1 | Fixed in tests | `src/games/testing/regression/gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| ACTION-006 | Search/audit follow-up | eligible playerがいるのにactor nullで無音freezeする | `ACTION-006` | actor eligibility invariant | P0 | Fixed in tests | `src/games/testing/regression/gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| ACTION-007 | Search/audit follow-up | UI上の複数seatがturn表示になり操作先が曖昧になる | `ACTION-007` | UI turn reconstruction / invariant | P1 | Fixed in tests | `src/games/testing/regression/gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| BG-008 / ALLIN-001 | `docs/bugs/badugi_browser_mobile_bug_tracker.md`, QA matrix | all-in playerにbetting actionが要求される | `ALLIN-001` | all-in betting eligibility | P0 | Fixed/covered | Existing gameplay fix; `gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| ALLIN-002 | QA matrix | HU all-in後にshowdown/terminalへ進まない | `ALLIN-002` | all-in terminal transition | P0 | Covered; deeper path test pending | `gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| ALLIN-003 | QA matrix | multiway all-in後にfreezeする | `ALLIN-003` | side-pot/showdown transition | P0 | Covered | `runProgressScenario.js`, `gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| BG-002 / DRAW-001 | `docs/bugs/current_bugs.md`, QA matrix | draw count巻き戻り / draw round数不一致 | `DRAW-001` | draw round state / snapshot merge | P2 | Verified earlier; covered | Existing draw fix; `gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| DRAW-002 | QA matrix | CPU drawが自動進行せず止まる | `DRAW-002` | CPU draw auto resolve | P0 | Covered | `runProgressScenario.js` | `npm run test:game:known-bugs` PASS |
| DRAW-003 | QA matrix | draw済みplayerに再度draw turnが回る | `DRAW-003` | draw actor eligibility | P2 | Covered | `gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| DRAW-004 | QA matrix | draw後hand sizeが壊れる | `DRAW-004` | draw/deck/discard invariant | P2 | Covered | `gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| BG-003 | `docs/bugs/current_bugs.md`, browser tracker | single potなのに余分なside-pot blockが出る | Badugi flow side-pot tests | Hand result overlay | P2 | Verified earlier | Existing overlay fix | `npm test` PASS |
| BG-004 | `docs/bugs/current_bugs.md`, browser tracker | result overlay後に次handのbuttonが戻らない | Badugi flow fold-only / next-hand tests | hand result overlay / hero action ready | P1 | Verified earlier | Existing overlay/next-hand fix | `npm test` PASS |
| MTT-001 | QA matrix | busted playerにturnが回る | `MTT-001` | tournament actor eligibility | P1 | Covered | `gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| MTT-002 | QA matrix | CPU bust後にactive tableが空のまま非terminalになる | `MTT-002` | MTT terminal/table state | P0 | Covered by invariant; full E2E pending | `gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| MTT-003 | QA matrix | reseat/table merge後にplayerId/stack/seatが壊れる | `MTT-003` | MTT reseat/table merge | P2 | Covered by invariant; deterministic E2E pending | `gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| MTT-004 | QA matrix | tournamentがvalid terminal stateに到達しない | `MTT-004` | tournament terminal state | P0 | Covered by terminal fixture; full MTT long-run pending | `gameProgressKnownBugs.test.js` | `npm run test:game:known-bugs` PASS |
| BG-005 | browser tracker | 実スマホでBadugi touch/orientation/next-hand操作が未棚卸し | Mobile Playwright smoke only | mobile browser/manual QA | P3 | Open | Not code-fixed this pass | `npm run test:e2e:progress` covers landscape button only |
| PV90-16 | `docs/badugi_rl_and_variant_status.md` | Badugi full 3-draw E2Eがshort-stack/all-in進行と固定期待で不安定 | Existing Badugi flow note | E2E fixture design | P3 | Open | Not fixed this pass | Needs fixed no-all-in fixture |
| HIST-REG-05 | `docs/badugi_rl_and_variant_status.md` | Replay UI frame再生を全variantで押下確認できていない | `cross-variant-history-replay-smoke.spec.ts` | replay UI | P3 | Fixed | `src/ui/screens/ReplayScreen.jsx`, `src/ui/screens/HandHistoryScreen.jsx`, `tests/e2e/cross-variant-history-replay-smoke.spec.ts` | 35 playable variantsでhandId/action/result/Replay-ready + next/last/first/event-row frame jumpを検証 |
| FB-REG-06 | `docs/badugi_rl_and_variant_status.md` | PLO/Badugiなどの混在履歴でfeedback対象variantが混線し得る / 30hand gateが全体件数だけで誤解され得る | `playFeedbackPayload.test.js`, `HandHistoryScreen.test.jsx` | play feedback variant scope | P3 | Fixed for payload/UI; manual OpenAI quality pending | `src/ui/feedback/playFeedbackPayload.js`, `src/ui/screens/HandHistoryScreen.jsx`, `src/ui/feedback/__tests__/playFeedbackPayload.test.js`, `src/ui/screens/__tests__/HandHistoryScreen.test.jsx` | variant未選択拒否、variant filter後30hand gate、payload/replayLinksのvariant一致を検証 |
| FB-REG-07 | `docs/badugi_rl_and_variant_status.md` | Feedback key handのReplay buttonがactionSeqStartへ直接ジャンプできない | `ReplayScreen.test.jsx`, `HandHistoryScreen.test.jsx` | feedback replay links | P3 | Fixed | `src/ui/screens/replayFrameUtils.js`, `src/ui/screens/HandHistoryScreen.jsx`, `src/ui/screens/__tests__/ReplayScreen.test.jsx`, `src/ui/screens/__tests__/HandHistoryScreen.test.jsx` | `(handId, replayTarget)` 呼び出しと `actionSeqStart` / `actionSeqRange.start` 解決を検証 |
| MIX-PROG-05 | `docs/badugi_rl_and_variant_status.md` | 8/10Game rotation境界のseat/button/stack引き継ぎ5周確認が未完 | `mixed-rotation-core-progression.spec.ts --grep MIX-PROG-05` | mixed rotation boundary | P2 | Fixed | `src/ui/App.jsx`, `tests/e2e/mixed-rotation-core-progression.spec.ts` | 8Game 40境界 / 10Game 50境界で variantId・seat・dealerIdx・stack+pot total を検証 |
| CAP-REG-05 | `docs/badugi_rl_and_variant_status.md` | cap到達時のUI button/raise不可/history確認が未完 | `tests/e2e/fixed-limit-cap-ui.spec.ts` | fixed-limit cap UI | P2 | Fixed | `src/ui/App.jsx`, `src/ui/components/Controls.jsx`, `src/ui/screens/layouts/GameLayoutBase.jsx`, `src/ui/utils/getAvailableActions.js`, `tests/e2e/fixed-limit-cap-ui.spec.ts` | FLH/FLO8/StudでRaise非表示、Call/Check進行、canonical history `betInfo` を検証 |
| BUG-55 | `docs/badugi_rl_and_variant_status.md` | Stud/Razzの実button操作だけで3rd-7th複数hand完走するE2Eが未完 | `stud-street-progression.spec.ts` partial | Stud/Razz E2E | P1 | Fixed | `src/ui/App.jsx`, `src/games/stud/StudGameController.js`, `src/ui/components/Player.jsx`, `tests/e2e/stud-street-progression.spec.ts` | `npx playwright test tests/e2e/stud-street-progression.spec.ts --project=badugi-flow` 6 passed; 2026-05-06に7th down/visible summary UIも同specで確認 |
| CP1-PROGRESS | add-on report / QA matrix | Chinese/OFC progress runnerが未対応 | `npm run test:game:chinese` | Chinese/OFC controller harness | P3 | Fixed for CP1; OFC-specific gaps remain | `src/games/testing/scenario/chineseFamilyProgress.test.js`, `runVariantFamilyScenario.js` | CP1 set/result/next-hand PASS; OFC street-by-street/fantasyland remains separate |

## Prioritized Open Work

| Priority | Bug IDs | Why Next | Suggested Fix Scope |
|---|---|---|---|
| P1 | `BUG-55` | Fixed。Stud/Razzは手動報告でも進行誤認が目立つため、helper依存を減らす必要があった。 | UI-click-only 3rd-7th street 2hand E2Eを追加済み。 |
| P2 | `MIX-PROG-05` | Mixed rotation境界でstack/button継承が壊れるとRL/履歴も信用できない。 | Fixed: 8Game/10Gameのvariant切替5周E2Eを追加。 |
| P2 | `CAP-REG-05` | fixed-limit cap後のraise不可/履歴は運用上重要。 | Fixed。今後はCPU自然発生capの長時間smokeを追加。 |
| P3 | `PV90-16` | 現行テスト前提が実進行と競合し、将来の回帰判断を曖昧にする。 | all-inしない固定スタック/固定action fixtureに変更。 |
| P3 | `BG-005` | 実スマホ品質はPlaywrightだけでは保証できない。 | 実機QAチェックリストとログ取得手順を追加。 |

## Verification Log

| Command | Result | Notes |
|---|---|---|
| `npm run test:game:known-bugs` | PASS | 18 tests passed after adding ACTION-005/006/007 |
| `npm run test:game:progress` | PASS | 2 files, 44 tests passed, 12 skipped with explicit reasons |
| `npm run test:e2e:progress` | PASS | 5 Playwright tests passed |
| `npm test` | PASS | 132 files passed; 886 tests passed, 12 skipped |
| `npm run test:game:chinese` | PASS | 1 file, 2 tests passed |
| `npm run test:game:family` | PASS | 5 files, 28 tests passed after adding CP1 family coverage |
