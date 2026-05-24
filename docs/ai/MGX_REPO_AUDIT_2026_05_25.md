# MGX Repository Audit — 2026-05-25

**Scope:** Read-only. No code changes made.
**Focus files:** `App.jsx`, `actorSourceOfTruth.js`, `nextActorUtils.js`, `actorEligibility.js`, `roundFlow.jsx`, `tournamentMTT.js`, `src/ai/evaluation/*`, `tests/e2e/*`, `src/games/testing/*`

---

## 1. Top Regression Hotspots

Ranked by probability of introducing a silent regression.

---

### H-01 · `finishBetRoundFrom` in `roundFlow.jsx` — untested 447-line critical path

**Evidence:** `src/games/badugi/engine/roundFlow.jsx:363–810`

`finishBetRoundFrom` is the central bet-round advancement function. It:
- Decides whether the next phase is BET (re-open), DRAW, or SHOWDOWN
- Calls `engineAdvance` (engine path) or falls back to legacy round flow on error (line 589)
- Contains `transitionToDrawPhase`, `transitionToShowdownPhase`, `handleDrawRoundSkipped` inline

**It has zero unit tests.** `src/games/badugi/logic/__tests__/roundFlow.test.js` tests `transitionToDrawPhase` and `transitionToBetPhase` — but not `finishBetRoundFrom`. The engine `__tests__/roundFlowDrawSkip.test.js` tests only `shouldSkipDrawRound`.

**It also emits 4 unconditional console calls on every invocation:**
- Line 415: `console.log("[DEBUG][finishBetRoundFrom args]", {...})` — fires for every player on every bet round
- Line 455: `console.log("[TRACE ...]  finishBetRoundFrom START", ...)` — timestamped, fires unconditionally
- Line 589: `console.error("[ENGINE] advanceAfterBet failed, ...")` — swallowed error, falls back silently
- Line 804: `console.log("[TRACE ...] finishBetRoundFrom END nextPhase=DRAW")` — fires unconditionally

The silent fallback at line 589 is particularly dangerous: if `engineAdvance` throws, the error is caught, logged, and the legacy path takes over. There is no unit test that exercises the fallback scenario.

**Risk:** HIGH. Any change to `finishBetRoundFrom`'s phase-decision logic is invisible to the test suite. Only E2E soak can catch regressions.

---

### H-02 · Dual `BadugiGameController` — App.jsx uses legacy; tests use new wrapper

**Evidence:**
- `src/ui/App.jsx:83` — `import BadugiGameController from "../games/badugi/BadugiGameController.js"`
- `src/games/badugi/controller/BadugiGameController.js:7` — `import LegacyBadugiController from "../BadugiGameController.js"`
- `src/games/core/variants.js:11`, `src/games/testing/scenario/runProgressScenario.js:2`, `src/ai/evaluation/runAiEvaluationBatch.js:13` — all use `controller/BadugiGameController.js`

Two controllers coexist:
1. **Legacy** (`BadugiGameController.js` at root) — mutable `.state`, used by App.jsx directly
2. **New** (`controller/BadugiGameController.js`) — extends `GameController`, wraps legacy via `this.legacy`, used by tests and AI eval

The new controller reads `this.legacy.state.drawRound`, `this.legacy.state.players`, `this.legacy.state.dealerIdx` etc. directly (lines 179, 240–244). The legacy controller's `state` is mutable and can be modified by engine calls mid-dispatch.

**Consequence:** AI evaluation results (counterfactual divergence scores, pro vs iron arena) are measured against the new controller, but actual browser gameplay runs through the legacy controller. Policy quality metrics may not reflect real gameplay.

**Risk:** HIGH (silent divergence between test/eval and production).

---

### H-03 · Triple actor derivation chain in `App.jsx` — three independent resolution blocks

**Evidence:** `src/ui/App.jsx:1373–1414`

Three separate priority chains compute `controllerTurn` inside a single render path:
1. `engineSnapshotActor` (lines 1373–1408): resolves from `metadata.actingPlayerIndex` → `currentActor` → `nextTurn` → `turn`
2. `liveControllerTurn` (lines 1388–1410): branches on `isSingleTableControllerDrawGame` with `controllerActor` vs `engineSnapshotActor`
3. `snapshotTurn` / `controllerTurn` (lines 1393–1414): another fallback chain through 6 fields

`resolveActorFromSnapshot` in `actorSourceOfTruth.js` also resolves independently from a 6-field priority chain (`currentActor` → `actingPlayerIndex` → `turnSeat` → `turn` → `nextTurn` → `metadata.actingPlayerIndex`).

There are also 30+ additional call sites for `findNextDrawActorSeat`, `findNextBetActorSeat`, `nextAliveFrom` scattered across App.jsx (lines 2879, 2921, 2934, 3259, 3388–3425, 7218, 8657, 8733, 8910, 10692, 10766, 10778, 10809, 10841, 10878, 10885, 10949, 10987, 11371, 11396, 11416, 11447).

**Risk:** HIGH. The D-04 "next-actor-unify" branch (current branch `feature/d-04-next-actor-unify`) is actively migrating this. Any partial edit to one resolution block without updating the others creates a freeze.

---

### H-04 · `isSeatEligibleForBet` (local) vs `isSeatEligibleForBetting` (canonical) — two predicates for the same purpose

**Evidence:**
- `src/games/badugi/flow/actionUtils.js:196` — `isSeatEligibleForBet(player)` — thin wrapper, no `currentBet` context
- `src/games/core/turn/actorEligibility.js:100` — `isSeatEligibleForBetting(player, state, options)` — canonical, context-aware

Both are in active use:

| Caller | Uses which predicate |
|---|---|
| `roundFlow.jsx:35` (resetBetRoundFlags) | `isSeatEligibleForBet` (local) |
| `BadugiEngine.js:137, 844, 892` | `isSeatEligibleForBet` (local) |
| `betRoundUtils.js:needsActionForBet` | `isSeatEligibleForBetting` (canonical) |
| `betRoundUtils.js:findNextBetActorSeat` | `isSeatEligibleForBetting` via `findNextEligibleActor` |
| `drawEligibility.js` (draw variants) | `isSeatEligibleForBetting` (canonical) |
| `DeuceToSevenTripleDrawController.js:333` | `isSeatEligibleForBetting` (canonical) |

The local predicate does not receive `currentBet` — so it cannot detect "player has already matched the bet and acted". The canonical predicate does. When a caller uses the local one for round-closure logic, it may under-advance (keep a seat active that should be settled) or fail to re-open correctly after a raise.

**Risk:** MEDIUM-HIGH. The local predicate is used in `resetBetRoundFlags` which runs on every bet round reset — a subtle mismatch here causes incorrect `hasActedThisRound` resets.

---

### H-05 · `resolveOpeningBetActor` emits `console.info` unconditionally in production

**Evidence:** `src/games/badugi/flow/actionUtils.js:114–123`

```js
console.info("[BET][OPENING_ACTOR]", {
  buttonSeat, sbSeat, bbSeat, resolvedOpeningActor, activeEligibleSeats, round, phase
});
```

This fires every time a new betting round opens — which is 4 times per Badugi hand. Combined with:
- `betRoundUtils.js:85` — `console.log("[BET][PLAYERS]", {...})` — fires every `analyzeBetSnapshot` call
- `roundFlow.jsx:415` — `console.log("[DEBUG][finishBetRoundFrom args]", {...})` — fires every `finishBetRoundFrom`
- `roundFlow.jsx:455` — `console.log("[TRACE ...]", ...)` — fires every `finishBetRoundFrom`

That is **≥6 console calls per betting round** in production gameplay, none gated behind `debugFlags.js`. The soak telemetry retention policy explicitly prohibits adding new `console.log` diagnostics, but these pre-existing ones are in violation and slow down test output.

**Risk:** MEDIUM (noise, soak telemetry policy violation, no direct gameplay regression — but masks real errors in console output).

---

### H-06 · `computePayouts` mutates its argument but is exported as a standalone function

**Evidence:** `src/games/badugi/engine/tournamentMTT.js:305–321`

JSDoc says: "Mutates state.players payout fields." It is called internally from `maybeFinalizeTournament` which already works on `cloneState(state)` — safe. But it is also exported and called from:
- `src/ui/App.jsx:5227` — `computePayouts(nextState)`
- `src/ui/App.jsx:7124` — `computePayouts(nextState)`

Both App.jsx call sites pass `nextState` which is a local variable, not necessarily a deep clone. If the caller ever passes a reference that is also held elsewhere, payout values will be silently mutated in place.

The prize pool formula uses `config.startingStack * totalPlayers` — but this treats `startingStack` as a buy-in amount, not a chip count. A real-money tournament would need a separate buy-in field; the formula is a semantic bug waiting for scope expansion.

`bustPlacementPayout.test.js` tests `computePayouts` for payout sum correctness but does not test that calling it twice on the same state is idempotent or that it operates on a copy.

**Risk:** MEDIUM (silent mutation, no current regression — but a footgun for any caller that reuses state).

---

### H-07 · `nextActorUtils.js` — phase guard is incomplete

**Evidence:** `src/games/badugi/flow/nextActorUtils.js:16`

```js
console.warn("[findNextActorSeatForPhase] unexpected phase", phase);
return null;
```

`findNextActorSeatForPhase` is called from `drawRound.js:25,148` and `roundFlow.jsx:471`. If the phase is something other than `"BET"` or `"DRAW"` (e.g., `"POST_BLINDS"`, `"SHOWDOWN"`, or a variant shorthand), it returns `null` and logs a warning. The callers in `drawRound.js` do not guard for `null` return.

**Risk:** LOW-MEDIUM (only triggered by unexpected phase value, but causes a silent null-actor state which leads to a freeze).

---

## 2. Coupling Map

### C-01 · `roundFlow.jsx` ↔ React state setters — framework coupling inside game logic

**Evidence:** `src/games/badugi/engine/roundFlow.jsx:99–200` (`transitionToShowdownPhase`, `transitionToDrawPhase`, `transitionToBetPhase`)

Each transition helper accepts `setPlayers`, `setPots`, `setPhase`, `setTurn`, `setDrawRound`, `setTransitioning` as callback parameters. These are React `useState` setters injected from App.jsx. This means game logic files in `src/games/` have a runtime dependency on React state management. It is impossible to unit-test these functions in isolation without mocking every setter.

**Downstream effect:** Any refactor that changes how App.jsx manages these state slices requires corresponding changes to `roundFlow.jsx`'s parameter contracts.

---

### C-02 · New `BadugiGameController` reads legacy `.state` directly

**Evidence:** `src/games/badugi/controller/BadugiGameController.js:178–244`

```js
blindLevelIndex: this.legacy.state.blindLevelIndex ?? 0,
handsInLevel: this.legacy.state.handsInLevel ?? 0,
// ... and on lines 240-244:
players: this.legacy.state.players,
drawRound: this.legacy.state.drawRound,
dealerIdx: this.legacy.state.dealerIdx,
```

The new controller wraps but does not isolate the legacy one. Any mutation of `this.legacy.state` inside an engine call is immediately visible to the new controller. The encapsulation boundary is purely nominal.

---

### C-03 · `actorSourceOfTruth.js:resolveSessionPreferredActor` calls `gameController.getSnapshot()` — method not on `GameController` base

**Evidence:** `src/games/core/GameController.js` — `getSnapshot` is not defined.
`src/games/badugi/BadugiGameController.js:86` — defines `getSnapshot`.

`resolveSessionPreferredActor` silently returns `null` for any controller that does not define `getSnapshot`. This is not a TypeScript-enforced contract, so passing a non-Badugi controller (e.g., a draw controller) will silently fail and fall back to `legacyTurn` without any error. The caller in `ensureSeatCanAct` (App.jsx:3858) then uses the incorrect fallback.

**Direct implication for D-04:** The D-04 actor unification branch adds `preferSession` logic whose correctness depends entirely on this soft contract. If a draw variant's controller does not implement `getSnapshot`, the session path returns `null` and the fallback chain may elect the wrong seat.

---

### C-04 · `App.jsx` holds both a `gameControllerRef` (legacy) and a `sessionControllerRef` (new) for the same game

**Evidence:** `src/ui/App.jsx:1060–1061` (reads `controller.getSnapshot()`) and `:3858` (reads `resolveSessionPreferredActor`)

Two controller instances are active simultaneously for Badugi. The legacy one drives most of `App.jsx`; the new one is consulted for actor resolution via `resolveSessionPreferredActor`. Their state can diverge: legacy state is mutated in-place by engine calls while the new controller builds its view via `this.legacy.getSnapshot()`. There is no synchronization gate.

---

### C-05 · `computePayouts` is called on live `nextState` in App.jsx (mutation leaks into React state tree)

**Evidence:** `src/ui/App.jsx:5227, 7124`

`computePayouts` mutates `state.players[*].payout`. In App.jsx these are called after `cloneState` — but if the clone is shallow and `config.payouts` is referenced by identity, payout mutation propagates into the original config object. The test coverage does not exercise this path.

---

## 3. Test Suite Cost Map

| Test command | Tool | Approx wall time | Value | Cost |
|---|---|---|---|---|
| `npm run test:game:known-bugs` | Vitest | <3s | **HIGH** — 42 regression gates covering turn-order and progression | Very low |
| `npm run test:rl:safety` | Vitest | ~15s | **HIGH** — ONNX pipeline + schema audit | Low |
| `npm run test:game:one-hand` | Vitest | ~5s | HIGH — all-variant smoke | Very low |
| `npm run test:game:ev` | Vitest | ~5s | HIGH — EV integrity | Very low |
| `npm run test:game:family` | Vitest | ~20s | HIGH — family scenarios | Low |
| `npm run test:game:progress` | Vitest | ~30s | HIGH — full progress suite | Low |
| `npm run test:unit` | Vitest | ~60–90s | HIGH — entire unit suite | Medium |
| `npm run test:ai:iron` | Vitest | ~30s | MEDIUM — iron policy tests | Low |
| `npm run test:ai:pro` | Vitest | ~30s | MEDIUM | Low |
| `npm run test:ai-evaluation` | Vitest (forks) | 5–20 min | **LOW for CI** — governance signal, not regression gate | Very high |
| `browser-gameplay-invariant-harness.spec.ts` | Playwright | 10–30 min (all combos) | HIGH — cross-variant freeze detection | Very high |
| `badugi-alpha-long-run-smoke.spec.ts` (205 lines) | Playwright | ~60s | MEDIUM — overlaps with soak | Medium |
| `core5-long-run-soak.spec.ts` | Playwright | ~120s+ | MEDIUM — overlaps with `test:soak:core5` | High |
| `core5-cash-multi-hand-soak.spec.ts` | Playwright | ~90s | MEDIUM — subset of soak | High |
| `badugi-flow.spec.ts` (1115 lines) | Playwright | ~100s | HIGH — primary Badugi E2E gate | High |
| `tests/e2e/gameplay-soak-core5-*.spec.ts` | Playwright | ~3 min (standard tier) | HIGH — canonical soak gate | High |

**Highest-cost / lowest-marginal-value E2E candidates:**

1. **`badugi-alpha-long-run-smoke.spec.ts`** — exercises the same Badugi cash progression as `badugi-flow.spec.ts` with a longer horizon. Its specific value over the focused regression specs is unclear.
2. **`core5-long-run-soak.spec.ts`** — duplicates `test:soak:core5` at a higher hand count. There is no documented scenario it covers that `test:soak:exhaustive` does not.
3. **`core5-cash-multi-hand-soak.spec.ts`** — overlaps with `gameplay-soak-core5-cash.spec.ts`.
4. **`live-core5-action-order-audit.spec.ts` (302 lines)** — tests the same action order property as `core5-action-order-audit.spec.ts` (391 lines) against the live server. Running both in CI doubles the cost with minimal additional signal.

---

## 4. Missing Regression Coverage

Items not covered by any unit test or documented E2E spec.

### M-01 · `resolveActorFromSnapshot` and `isSeatActionEligibleForPhase` — zero dedicated unit tests

**Evidence:** `src/ui/utils/actorSourceOfTruth.js:3–68`; grep of `src/ui/__tests__/` confirms no test file imports or calls either function directly.

`resolveActorFromSnapshot` resolves from a 6-field priority chain (`currentActor` → `actingPlayerIndex` → `turnSeat` → `turn` → `nextTurn` → `metadata.actingPlayerIndex`). The priority order is the key invariant for the D-04 migration. There is no test asserting what happens when only `nextTurn` is set but `actingPlayerIndex` is absent, or when `metadata.actingPlayerIndex` is stale.

`isSeatActionEligibleForPhase` has the all-in draw exemption asymmetry baked in but there is no unit test for the all-in DRAW case (only the BET-excluded-all-in case).

**Fix:** Add `actorSourceOfTruth.test.js` in `src/ui/__tests__/` covering: each field priority, the all-in+BET exclusion, the all-in+DRAW inclusion, the `hasDrawn` exclusion, and the `SHOWDOWN` phase short-circuit.

---

### M-02 · `finishBetRoundFrom` — no unit test for the phase-decision logic

**Evidence:** `src/games/badugi/engine/roundFlow.jsx:363–810`; no test file imports `finishBetRoundFrom`.

The function decides: BET re-open vs DRAW advancement vs SHOWDOWN. The `advanceAfterBet` engine path (called at ~line 572) has a silent catch that falls back to legacy logic. Neither path is tested in isolation.

**Fix:** A unit test harness that constructs player arrays with known `betThisRound` / `hasActedThisRound` values and asserts which phase callback was invoked (via jest/vitest mocks for `setPhase`), without a running browser.

---

### M-03 · All-in side-pot browser gate missing for D01, D02, S01, S02

**Evidence:** `docs/bugs/AUDIT_FINDINGS.md:27TD-PROG-002, A5TD-PROG-002, SD-PROG-002`

Unit-level side-pot logic (`potAccounting.test.js`, `evIntegrityChecker.test.js`) exists. But there is no E2E spec that drives a D01/D02/S01/S02 game to an all-in side-pot scenario, verifies the pot is split correctly, and checks the UI shows the right result.

**Risk elevated because:** `isSeatEligibleForDraw` passes `allowAllInDraw: true` — so all-in players can draw. A side pot where the all-in player draws but does not win the main pot is a compound scenario that no browser spec exercises.

---

### M-04 · `normalizeTurnState` for draw variants — used in D-01/D-02 controller with no dedicated test

**Evidence:** `src/games/draw/DeuceToSevenTripleDrawController.js:538`; grep of `src/games/draw/__tests__/` shows no test importing `normalizeTurnState`.

`normalizeTurnState` is called at the end of `getUiSnapshot` in the 2-7 TD controller. Its behavior in DRAW phase with all-in players depends on `isSeatEligibleForDrawing` receiving the correct `allowAllInDraw` option — but the call in `actorEligibility.js:181` does not pass that option.

---

### M-05 · `raiseCountThisRound` reset across streets — tracked in legacy controller but not tested

**Evidence:** `src/games/badugi/BadugiGameController.js:134` (reset to 0), lines 181–182 (passed into engine metadata).

The raise cap (default 4) relies on `raiseCountThisRound` being reset to 0 at each street boundary. There is no unit test asserting that after a street advances, `raiseCountThisRound` is 0 and `raiseCap` is preserved. The raise-cap enforcement in `BadugiEngine.js:522–530` reads from 4 different field paths (`metadata.raiseCountThisRound`, `metadata.raiseCap`, `table.raiseCap`, `table.level.raiseCap`) — their priority is undocumented and untested.

---

### M-06 · `computePayouts` idempotency and mutation isolation — not tested

**Evidence:** `src/tournament/__tests__/bustPlacementPayout.test.js` tests payout sum correctness but does not assert:
1. That calling `computePayouts(state)` twice produces the same result (idempotency)
2. That the `state` argument before the call and after the call have the same reference for `config.payouts`
3. That passing the original (non-cloned) state to `computePayouts` does not corrupt the pre-call state

---

### M-07 · `getSnapshot()` contract on non-Badugi controllers — not enforced or tested

**Evidence:** `src/games/core/GameController.js` — `getSnapshot` not defined.

`resolveSessionPreferredActor` calls `gameController.getSnapshot()`. For D01/D02 games in the D-04 branch, `gameController` may be a draw controller instance. None of the draw controllers (`DeuceToSevenTripleDrawController`, etc.) are checked to define `getSnapshot`. There is no test that passes a draw controller to `resolveSessionPreferredActor` and asserts the correct actor is returned.

---

## 5. Recommended CI Tiers

### Tier 1 — Per-commit gate (<15s total)

```bash
npm run test:game:known-bugs      # 42 regression tests, <3s
npx vitest run src/rl/__tests__/badugiObservationSchema.test.js \
               src/rl/__tests__/drawObservationSchema.test.js    # ONNX schema only, ~5s
```

These are the minimum safety net. If either fails, the commit is broken. No E2E.

---

### Tier 2 — Pre-merge gate (<90s total)

```bash
npm run test:game:one-hand        # all-variant one-hand smoke
npm run test:game:ev              # EV integrity
npm run test:game:family          # draw/stud/flop family scenarios
```

This catches variant-wide progression regressions before merge. Still no E2E.

---

### Tier 3 — Full unit suite (pre-deploy, ~2 min)

```bash
npm run test:unit                 # all Vitest tests excluding AI eval
```

---

### Tier 4 — E2E smoke (daily / pre-release, ~10–15 min)

```bash
npx playwright test tests/e2e/badugi-flow.spec.ts --project=badugi-flow
npm run test:soak:core5           # standard tier, 2 seeds
npx playwright test tests/e2e/core5-action-order-audit.spec.ts --project=badugi-flow
```

---

### Tier 5 — Full soak + invariant matrix (pre-friend-alpha only, ~30–60 min)

```bash
npm run test:soak:exhaustive
BROWSER_GAMEPLAY_VARIANTS=badugi,D01,D02,S01,S02 \
  npx playwright test tests/e2e/browser-gameplay-invariant-harness.spec.ts --project=badugi-flow
```

---

### Out-of-CI — Governance / manual only

```bash
npm run test:ai-evaluation        # counterfactual replay, divergence scoring
npm run eval:ai:pro               # pro evaluation batch
npm run eval:ai:replay-determinism
```

These must never run in a standard feature-branch pipeline. They produce evaluation artifacts for human review.

---

**E2E candidates to remove from default CI run:**

| Spec | Reason |
|---|---|
| `badugi-alpha-long-run-smoke.spec.ts` | Subsumes `badugi-flow.spec.ts` functionality; use soak instead |
| `core5-long-run-soak.spec.ts` | Duplicates `test:soak:core5` with higher hand count |
| `core5-cash-multi-hand-soak.spec.ts` | Covered by `gameplay-soak-core5-cash.spec.ts` |
| `live-core5-action-order-audit.spec.ts` | Duplicates `core5-action-order-audit.spec.ts` against live server; use as post-deploy check only |

---

## 6. Recommended First 10 Codex Tasks

Tasks are ordered from safest to most impactful. Each is a **small, self-contained, verifiable** diff that can be reviewed line-by-line.

---

### TASK-01 · Add unit tests for `resolveActorFromSnapshot` and `isSeatActionEligibleForPhase`

**File to create:** `src/ui/__tests__/actorSourceOfTruth.test.js`
**Scope:** New test file only. Zero production changes.
**Test cases to add:**
1. `resolveActorFromSnapshot` returns `currentActor` when set
2. `resolveActorFromSnapshot` falls back to `actingPlayerIndex` when `currentActor` absent
3. `resolveActorFromSnapshot` falls back to `nextTurn` when both above absent
4. `resolveActorFromSnapshot` falls back to `metadata.actingPlayerIndex` as last resort
5. `resolveActorFromSnapshot` returns `null` when all fields absent
6. `isSeatActionEligibleForPhase` returns `false` for all-in player in BET phase
7. `isSeatActionEligibleForPhase` returns `true` for all-in player in DRAW phase (has NOT drawn)
8. `isSeatActionEligibleForPhase` returns `false` for all-in player in DRAW phase (hasDrawn=true)
9. `isSeatActionEligibleForPhase` returns `false` for SHOWDOWN phase (not in ACTION_PHASES)
**Evidence path:** `src/ui/utils/actorSourceOfTruth.js:1–96`
**Risk:** None (new test file).

---

### TASK-02 · Remove unconditional `console.log` calls from `finishBetRoundFrom` in `roundFlow.jsx`

**Files:** `src/games/badugi/engine/roundFlow.jsx:415, 455, 804`
**Scope:** Delete or gate three `console.log`/`console.warn` calls inside `finishBetRoundFrom`. Replace with `debugLog(...)` (already imported on line 3).
**Specifically:**
- Line 415: `console.log("[DEBUG][finishBetRoundFrom args]", ...)` → replace with `debugLog(...)`
- Line 455: `console.log("[TRACE ...]  finishBetRoundFrom START", ...)` → replace with `debugLog(...)`
- Line 804: `console.log("[TRACE ...] finishBetRoundFrom END ...")` → replace with `debugLog(...)`
- Line 447: `console.warn("[finishBetRoundFrom] drawRound undefined ...")` → acceptable to keep as `console.warn` (this is an error path)
**Verification:** `npm run test:game:known-bugs` must pass; `npm run test:game:one-hand` must pass.
**Evidence path:** `src/games/badugi/engine/roundFlow.jsx:363–810`
**Risk:** Very low (pure logging change; no logic).

---

### TASK-03 · Gate `console.info` in `resolveOpeningBetActor` behind `debugLog`

**File:** `src/games/badugi/flow/actionUtils.js:114–123`
**Scope:** Replace the unconditional `console.info("[BET][OPENING_ACTOR]", {...})` call with `debugLog("[BET][OPENING_ACTOR]", {...})`. The `debugLog` helper is already used throughout the file.
**Verification:** `npm run test:game:known-bugs`, `npm run test:game:ev`.
**Evidence path:** `src/games/badugi/flow/actionUtils.js:114`
**Risk:** None.

---

### TASK-04 · Gate `console.log("[BET][PLAYERS]")` in `betRoundUtils.js` behind `debugLog`

**File:** `src/games/badugi/flow/betRoundUtils.js:85–98`
**Scope:** Wrap the `console.log("[BET][PLAYERS]", {...})` block in `debugLog(...)`. This fires on every `analyzeBetSnapshot` call.
**Verification:** `npm run test:game:known-bugs`.
**Evidence path:** `src/games/badugi/flow/betRoundUtils.js:85`
**Risk:** None.

---

### TASK-05 · Add `getSnapshot()` to `GameController` base class with a sensible default

**File:** `src/games/core/GameController.js`
**Scope:** Add a default `getSnapshot()` method that returns `null` (or throws with a helpful message) to the `GameController` base. This makes the `resolveSessionPreferredActor` call contract explicit and prevents silent null returns for draw variant controllers.
**Specifically:**
```js
getSnapshot() {
  return null; // concrete controllers should override
}
```
**Follow-up check:** Grep `src/games/draw/` for controllers that need to implement `getSnapshot` for D-04 compatibility.
**Verification:** `npm run test:unit` must pass without changes.
**Evidence path:** `src/games/core/GameController.js`, `src/ui/utils/actorSourceOfTruth.js:44`
**Risk:** Very low (additive default method; no callers break).

---

### TASK-06 · Add unit tests for `computePayouts` idempotency and mutation isolation

**File to modify:** `src/tournament/__tests__/bustPlacementPayout.test.js`
**Scope:** Add 3 test cases to the existing file:
1. Calling `computePayouts(state)` twice does not change the payout values on the second call
2. `computePayouts` does not modify the `config.payouts` array reference
3. The returned state is the same reference as the input state (verify mutation is intentional)
**Evidence path:** `src/games/badugi/engine/tournamentMTT.js:305–321`, `src/tournament/__tests__/bustPlacementPayout.test.js`
**Risk:** None (new test cases only).

---

### TASK-07 · Add `findNextActorSeatForPhase` guard for non-BET/DRAW phases

**File:** `src/games/badugi/flow/nextActorUtils.js`
**Scope:** The `console.warn` on unexpected phase (line 16) should also return a safe value. Document which phases are intentionally unsupported. Add a unit test asserting that `POST_BLINDS`, `SHOWDOWN`, `COLLECT` return `null` and do not throw.
**Test file to create:** `src/games/badugi/flow/__tests__/nextActorUtils.test.js` (small, 5–8 tests)
**Evidence path:** `src/games/badugi/flow/nextActorUtils.js:16`
**Risk:** None.

---

### TASK-08 · Add `TURN-NNN` regression test for all-in player excluded from BET but included in DRAW

**File to modify:** `src/games/testing/regression/gameProgressKnownBugs.test.js`
**Scope:** Add two test cases:
1. `TURN-043` (or next available): All-in player at seat X is skipped when searching for next BET actor
2. `TURN-044`: All-in player at seat X IS returned when searching for next DRAW actor (via `findNextDrawActorSeat`)

This directly tests the asymmetry documented in NOTE (H-01-2) which has no dedicated regression test.
**Evidence path:** `src/games/badugi/flow/actionUtils.js:15–22`; `src/games/core/turn/actorEligibility.js:117–127`
**Risk:** None (new test cases only).

---

### TASK-09 · Add D01 all-in side-pot Vitest scenario test

**File to create:** `src/games/testing/scenario/d01SidePotProgression.test.js`
**Scope:** Using the `runProgressScenario` harness (already in `src/games/testing/scenario/runProgressScenario.js`), construct a 3-player D01 (2-7 Triple Draw) hand where player at seat 0 goes all-in pre-draw. Assert:
1. The side pot is created with correct amounts
2. All-in player draws (because `allowAllInDraw=true`)
3. Non-all-in players continue betting into main/side pots
4. Winner of the side pot is correct
**Evidence path:** `docs/bugs/AUDIT_FINDINGS.md:27TD-PROG-002`; `src/games/core/sidePotResolver.js`
**Risk:** Low (new test; exercises existing code).

---

### TASK-10 · Document and unit-test `raiseCountThisRound` reset across streets

**Files:**
- Test to create: `src/games/badugi/__tests__/badugiRaiseCapResetSpec.test.js`
- Read but do not modify: `src/games/badugi/BadugiGameController.js:134, 181–182`, `src/games/badugi/engine/BadugiEngine.js:522–530`

**Scope:** Add 3 unit tests using the `BadugiGameController` (legacy) directly:
1. After `syncExternalState` with a `raiseCountThisRound=3` payload, the controller state reflects that value
2. After advancing to a new street (call `setHandContext` or the equivalent reset), `raiseCountThisRound` is 0
3. When `raiseCap` is hit in a round (`raiseCountThisRound >= raiseCap`), calling `getLegalActions` does not include `RAISE`

**Evidence path:** `src/games/badugi/BadugiGameController.js:48–76, 134`
**Risk:** Low (new test file; exercises existing controller logic).

---

## Summary Table

| Finding | File | Risk | Task |
|---|---|---|---|
| `finishBetRoundFrom` untested 447-line path | `roundFlow.jsx:363` | HIGH | TASK-02 (logging), TASK-02 follow-up unit test |
| Dual controller divergence | `BadugiGameController.js` (both) | HIGH | — (track for D-04 migration) |
| Triple actor derivation in App.jsx | `App.jsx:1373–1414` | HIGH | — (D-04 scope) |
| `isSeatEligibleForBet` vs `isSeatEligibleForBetting` | `actionUtils.js:196`, `actorEligibility.js:100` | MEDIUM-HIGH | — (audit callers before changing) |
| `computePayouts` mutates arg | `tournamentMTT.js:305` | MEDIUM | TASK-06 |
| 6+ console calls per bet round | `roundFlow.jsx`, `betRoundUtils.js`, `actionUtils.js` | MEDIUM | TASK-02, TASK-03, TASK-04 |
| `findNextActorSeatForPhase` incomplete guard | `nextActorUtils.js:16` | LOW-MEDIUM | TASK-07 |
| `resolveActorFromSnapshot` untested | `actorSourceOfTruth.js:3` | HIGH | TASK-01 |
| All-in BET/DRAW asymmetry untested | `actorEligibility.js:117–127` | MEDIUM | TASK-08 |
| D01/D02/S01/S02 side-pot browser gate missing | `AUDIT_FINDINGS.md` | MEDIUM | TASK-09 |
| `getSnapshot()` not on base class | `GameController.js` | MEDIUM | TASK-05 |
| `raiseCountThisRound` reset untested | `BadugiGameController.js:134` | LOW-MEDIUM | TASK-10 |
