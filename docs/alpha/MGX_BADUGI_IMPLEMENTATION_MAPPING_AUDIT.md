# MGX Badugi Implementation Mapping Audit

Status: Step1 progression audit

Scope: `badugi` game progression only. UI layout and alpha availability promotion are out of scope.

## Source Map

| Spec Item | Source File | Function | Covered? | Notes |
| --- | --- | --- | --- | --- |
| Button assignment | `src/games/badugi/BadugiGameController.js` | `startNewHand` | Partial | Delegates dealer/button index from caller into `buildNextHandState`; next-hand dealer advance is handled by wrapper controller. |
| Button advance | `src/games/badugi/controller/BadugiGameController.js` | `_resolveDealerIndex`, `createNewHandState` | Yes | Advances from previous dealer unless explicitly overridden. |
| Blind seat assignment | `src/games/badugi/flow/handLifecycle.js` | `assignBlinds` | Yes | Uses `getBlindSeatsForPlayers`. |
| HU BTN=SB blind rule | `src/games/badugi/flow/actionUtils.js` | `getBlindSeatsForPlayers` | Yes | Two eligible players use dealer/button as SB. |
| Blinds payment | `src/games/badugi/flow/handLifecycle.js` | `applyBlindPayment` | Yes | Applies chips, updates `betThisRound`, all-in state. |
| Pre-draw first actor | `src/games/badugi/flow/actionUtils.js` | `firstBetterAfterBlinds` | Yes | Starts left of BB for 3+ players; with HU BB+1 resolves to BTN/SB. |
| Next betting actor | `src/games/badugi/flow/betRoundUtils.js` | `findNextBetActorSeat`, `analyzeBetSnapshot` | Yes | Uses core actor eligibility and betting completion state. |
| Betting close | `src/games/badugi/flow/betRoundUtils.js` | `isBetRoundComplete`, `analyzeBetSnapshot` | Yes | Requires every eligible bettor acted and matched current bet, or is folded/all-in. |
| Fixed-limit validation | `src/games/badugi/engine/BadugiEngine.js`, `src/games/badugi/logic/actionAmount.js`, `src/games/badugi/logic/bettingRules.js` | `validateAction`, `normalizeBetActionAmount`, `getFixedLimitBetSize` | Yes | Existing tests cover raise cap and betting rules. |
| Draw transition | `src/games/badugi/controller/BadugiGameController.js` | `_finishBetRound` | Yes | BET closes into DRAW until final betting round. |
| Draw order | `src/games/badugi/controller/BadugiGameController.js`, `src/games/badugi/flow/actionUtils.js` | `_finishBetRound`, `findNextDrawActorSeat` | Yes | Starts left of button and skips ineligible draw actors. |
| Draw action normalization | `src/games/badugi/controller/BadugiGameController.js`, `src/games/core/draw/normalizeDrawAction.js` | `_applyDrawAction`, `normalizeDrawAction` | Yes | Enforces 0-4 discards through generic draw normalization. |
| Draw round close | `src/games/badugi/controller/BadugiGameController.js` | `_applyDrawAction`, `_finishDrawRound` | Yes | When no drawable seat remains, starts next betting round or showdown. |
| Showdown transition | `src/games/badugi/controller/BadugiGameController.js` | `_finishBetRound`, `_finishDrawRound`, `_resolveShowdownAndApplyPayouts` | Partial | Focused tests pass; long-run browser smoke still marks terminal transition mismatch as a known blocker. |
| Badugi hand ranking | `src/games/badugi/utils/badugiEvaluator.js`, `src/games/badugi/engine/showdown.js` | `getWinnersByBadugi`, showdown helpers | Yes | Evaluator and comparison tests exist. |
| Pot calculation | `src/games/badugi/controller/BadugiGameController.js`, `src/ui/game/badugi/BadugiUIAdapter.js` | `_resolveShowdownAndApplyPayouts`, `sumPotAmounts` | Partial | Unit pot fallback tests pass; long-run browser can still surface active `Total Pot 0`. |
| Side pot / payouts | `src/games/badugi/engine/potIntegrity.js`, `src/games/badugi/engine/__tests__/potAccounting.test.js` | pot accounting helpers | Partial | Engine-side pot accounting exists; strict cross-controller EV conservation remains a broader P2 gap. |
| UI snapshot merge | `src/ui/utils/engineSnapshotUtils.js` | `mergeEngineSnapshot` | Yes | Canonical `turn/nextTurn` overrides stale `metadata.actingPlayerIndex`; dedicated tests exist. |
| Badugi view pot fallback | `src/ui/game/badugi/BadugiUIAdapter.js` | `buildViewProps`, `sumPotAmounts` | Yes | Uses explicit pots first, then `totalInvested`, then street bets. |
| Next hand reset | `src/games/badugi/controller/BadugiGameController.js` | `createNewHandState` | Partial | Focused next-hand browser flow passes; long-run restore smoke is still expected-fail. |

## Current Release-Risk Summary

| Area | Status | Evidence |
| --- | --- | --- |
| Core betting order | Covered | Existing focused tests plus new Step1 spec tests. |
| Draw progression | Covered for focused paths | Unit and focused E2E cover Draw #1-#3. |
| Active pot continuity | Partially blocked | Focused pot tests pass; long-run browser smoke remains expected-fail. |
| Terminal / next hand | Partially blocked | Focused E2E reaches `Hand Result`; long-run restore gate remains blocked. |
| UI stale actor metadata | Covered | Snapshot merge tests ensure canonical actor wins. |

Badugi remains `preview_only` until the long-run active-pot / terminal-transition blocker is fixed.
