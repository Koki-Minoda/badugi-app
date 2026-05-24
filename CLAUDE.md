# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev          # Vite dev server at http://localhost:3000/dev/
```
The dev server proxies `/api` → `http://127.0.0.1:8000` and `/ws` → `ws://127.0.0.1:8000`.

### Build & Lint
```bash
npm run build        # Production build (base path: /)
npm run lint         # ESLint
```

### Unit Tests (Vitest)
```bash
npm test                          # All unit tests (excludes heavy AI eval suites)
npm run test:unit                 # Same as above
npm run test:ai-evaluation        # Heavy AI eval tests — run serially, forks pool
npm run test:all:serial           # Unit + AI eval back to back

# Focused game test groups
npm run test:game:progress        # Progress/regression/scenario tests
npm run test:game:known-bugs      # Known regression gate
npm run test:game:family          # All family scenario tests
npm run test:game:draw-family     # Draw family only
npm run test:mgx:safety           # Safety gate: known-bugs + one-hand + EV + RL safety
npm run test:rl:safety            # RL pipeline + ONNX adapter smoke
npm run test:ai:pro               # Pro AI strategy tests
npm run test:ai:iron              # Iron AI tests
```

Run a single test file:
```bash
npx vitest run src/path/to/file.test.js
```

### E2E Tests (Playwright)
```bash
# Playwright project names: legacy-e2e (./e2e/), badugi-flow (./tests/e2e/), badugi-regression
npm run test:e2e:progress         # mgx-game-progress.spec.js
npm run test:e2e:progression      # mgx-game-progression.spec.js
npm run test:soak:fast            # Fast DB telemetry soak
npm run test:soak:core5           # Core-5 cash + tournament soak (standard tier)
npm run test:soak:mobile          # Mobile portrait soak
npm run test:soak:exhaustive      # Exhaustive soak (3 seeds, 30-80 events)

# Run a single spec with a specific project:
npx playwright test tests/e2e/badugi-flow.spec.ts --project=badugi-flow
```
The Playwright web server reuses an existing server on port 3000 if running.

### AI Evaluation Scripts
```bash
npm run eval:ai:pro               # Pro policy evaluation
npm run eval:ai:divergence        # Divergence analysis
npm run eval:ai:counterfactual    # Counterfactual replay
npm run eval:ai:replay-determinism
npm run eval:ai:export-action-value
npm run eval:ai:validate-action-value
```

### RL / Model Training (Python via Node wrapper)
```bash
npm run ai:verify-models          # Verify ONNX model assets present
npm run ai:install-models         # Install model assets
npm run ai:train-badugi           # DQN training for Badugi
npm run ai:export-badugi-onnx     # Export to ONNX
npm run train:ai:iron:warmstart   # Iron warm-start training
npm run train:ai:iron:supervised  # Iron supervised policy training
```

### Backend (Python/FastAPI)
```bash
cd backend
uvicorn app.main:app --reload     # Development server on port 8000
pytest tests/                     # Backend unit tests
```

## Path Aliases (Vite + Vitest)
| Alias | Resolves to |
|---|---|
| `@core` | `src/core` |
| `@games` | `src/games` |
| `@ui` | `src/ui` |
| `@utils` | `src/utils` |
| `@audio` | `src/audio` |

## Architecture

### Overview
Multi-variant poker app: React/Vite frontend (TypeScript + JS), FastAPI Python backend, in-browser ONNX inference for CPU AI.

### Game Engine Layer (`src/games/`)

**Variant registry** (`src/games/_core/GameRegistry.js`): All `GameDefinition` objects are registered here at startup. Each definition carries metadata (id, name, variant, etc.) and is looked up by ID throughout the app.

**Engine registry** (`src/games/core/engineRegistry.js`): Maps game IDs to factory functions that instantiate `GameEngine` subclasses. Use `getEngine(gameId)` to get a live engine.

**GameEngine** (`src/games/core/gameEngine.js`): Abstract base with lifecycle hooks — `initHand`, `applyForcedBets`, `applyPlayerAction`, `resolveShowdown`, `getObservation`. Each variant family has concrete engines:
- Badugi: `src/games/badugi/engine/BadugiEngine.js`
- Draw variants (2-7 TD, A-5 TD/SD, 5-card SD, special draw hybrids): `src/games/draw/`
- Stud (Razz, Stud-8, Razzdugi, Razzducey): `src/games/stud/`
- NLH / Limit Hold'em: `src/games/nlh/`
- PLO / PLO-8 / BigO: `src/games/plo/`
- Chinese Poker: `src/games/chinese/`
- Dramaha: `src/games/dramaha/`

**GameController** (`src/games/core/GameController.js`): Variant-agnostic interface the UI calls — `createInitialState`, `createNewHandState`, `getUiSnapshot`, `getLegalActions`, `applyAction`. `BadugiGameController` is the most mature concrete implementation; draw/stud variants have their own.

**Phase machine** (`src/games/_core/phaseMachineGraph.js`): Canonical hand phases are `HAND_START → POST_BLINDS → BET ↔ DRAW → SHOWDOWN → COLLECT → RESULT → NEXT_HAND → TABLE_FINISHED`. The `CORE5_PHASE_GRAPH` defines legal transitions. `isLegalPhaseTransition` / `normalizePhaseName` are the guard functions used across controllers and tests. Terminal phases: SHOWDOWN, COLLECT, RESULT, HAND_RESULT, NEXT_HAND, WAITING_NEXT_HAND, TABLE_FINISHED.

**Variant definitions** (`src/games/core/variantRegistry.js` and `src/games/config/variantCatalog.js`): Low-level canonical variant shapes (base type, deck, betting structure, hole card count, board streets, forced bets, showdown evaluator). Validated by `normalizeVariant` / `validateVariant` in `variantDefinition.js`.

### UI Layer (`src/ui/`)

**Routing** (`src/RootApp.jsx`): React Router top-level. Route `/` and `/dev/*` wrap `<App>` inside `<GameEngineProvider gameId="badugi">`. Other routes: `/menu`, `/games`, `/multigame`, `/mixed`, `/dealers-choice`, `/friend-match`, `/tournament`, `/game`, `/replay`, `/history`, etc.

**GameEngineContext** (`src/ui/engine/`): Provides `{ engineId, setEngineId, engine }`. `setEngineId` switches the active game engine at runtime.

**GameUIAdapter** (`src/ui/game/GameUIAdapter.js` + registry): Per-variant adapter that converts a controller snapshot into React-consumable props (`tablePhase`, `seatViews`, `potView`, `controlsConfig`, `hudInfo`). Registered via `GameUIAdapterRegistry`. Each variant folder under `src/ui/game/` provides its concrete adapter.

**App.jsx** (`src/ui/App.jsx`): Main game screen orchestrator. Owns hand history tracking, CPU decision telemetry, cross-variant state leak assertions, and the action dispatch loop.

**State** (`src/ui/state/`): Auth context/store, hand history store, auth hooks.

### AI / CPU Layer (`src/ai/`)

**Model routing** (`src/ai/modelRouter.js`): Selects an ONNX model entry from `src/config/ai/modelRegistry.json` based on `{ variantId, tierId, characterId, modelId }`. Two tiers:
- **Iron** (`src/ai/iron/`): Lightweight trained policy; used as default CPU for most variants.
- **Pro** (`src/ai/pro/`): Stronger policy with decision overlay, used for tougher opponents.

**Policy routing** (`src/ai/policyRouter.js`): Routes CPU decision requests to the correct policy (iron/pro/heuristic fallback). Calls `onnxPolicyAdapter.js` which wraps `onnxruntime-web` ONNX inference.

**CPU characters** (`src/ai/cpuCharacters.js`, `cpuRoster.js`): Named CPU opponents with assigned tiers/personalities. `tierManager.js` manages tier selection logic.

**RL infrastructure** (`src/rl/`): Python training scripts in `src/rl/training/` (DQN, export to ONNX, evaluation, gating). JS observation schemas (`badugiObservationSchema.js`, `drawObservationSchema.js`) define the feature vectors fed to ONNX models.

### Backend (`backend/`)

FastAPI + SQLAlchemy service. Structure:
- `app/main.py` — FastAPI app entry point
- `app/api/` — route handlers
- `app/models/` — SQLAlchemy ORM models
- `app/schemas/` — Pydantic schemas
- `app/crud/` — database operations
- `app/db/` — DB connection/session
- `alembic/` — migrations

Play feedback analysis (`POST /api/analysis/play-feedback`) sends compressed session summaries to OpenAI and stores results. OpenAI key must be in `MGX_OPENAI_API_KEY` env var (never in frontend code).

### Testing Conventions

- **Unit tests** live alongside source in `__tests__/` subdirectories or as `*.test.js` siblings.
- **Game progression tests** in `src/games/testing/` are organized as `progress/`, `regression/`, `scenario/`, and `ev/`. The `gameProgressKnownBugs.test.js` regression gate must always pass.
- **E2E specs** in `tests/e2e/` use the `badugi-flow` Playwright project; legacy specs in `e2e/` use `legacy-e2e`.
- Heavy AI evaluation tests (counterfactual replay, divergence scoring) are excluded from `npm test` and must be run explicitly with `npm run test:ai-evaluation` — they are CPU-intensive and run single-threaded.

### Key Conventions

- **Dev base path is `/dev/`**: The Vite dev server serves at `/dev/`, so the app URL is `http://localhost:3000/dev/`. Production builds use `/`.
- **ONNX models**: Loaded from `public/` or installed via `npm run ai:install-models`. Always run `npm run ai:verify-models` before AI-dependent tests.
- **Variant IDs**: Snake-case strings (`badugi`, `nl_holdem`, `deuce_to_seven_triple_draw`, etc.). Internal shorthand IDs (`D01`, `D02`, `S01`, `S02`) map to draw/stud variants in the phase machine.
- **Phase naming**: Always use `normalizePhaseName()` when comparing phases — legacy values like `"COMPLETE"` and `"TERMINAL"` are normalized to `"RESULT"`.
- **AI model governance**: The `src/ai/iron/verify*.js` scripts are step-numbered governance checkpoints for safe RL dataset expansion. Do not modify `verifyStep*GovernanceFreeze.js` files without going through the governance pipeline.

---

## MGX Engineering Safety Rules

### Regression-First Mindset

**Every bug fix must be paired with at least one regression test before the fix is merged.** The preferred location depends on the bug type:

| Bug type | Test location |
|---|---|
| Actor selection / turn order | `src/games/testing/regression/gameProgressKnownBugs.test.js` |
| Phase transition / engine logic | `src/games/badugi/__tests__/` or equivalent variant `__tests__/` |
| UI/React rendering or control visibility | `src/ui/__tests__/` |
| E2E browser freeze, actor mismatch, pot integrity | `tests/e2e/` (new Playwright spec or extend existing regression spec) |
| RL / observation schema | `src/rl/__tests__/` |

The file `src/games/testing/regression/gameProgressKnownBugs.test.js` is the primary regression gate for turn-order and progression bugs. It is run as part of `npm run test:game:known-bugs` and must pass at all times. When adding a regression here, follow the existing `TURN-NNN` / `POT-NNN` naming convention.

### Small Diff Policy

**Prefer surgical changes over rewrites.** When fixing a bug:

1. Change only the lines that are wrong. Do not refactor surrounding code in the same commit.
2. Do not rename, reorder, or restructure functions unless they are directly part of the bug.
3. Do not convert `.js` → `.ts`, change indentation, or reorganize imports as part of a bug fix.
4. If a file genuinely needs cleanup, do it in a separate isolated commit or PR clearly marked as refactor-only.
5. UI/layout work and engine logic work must be in separate changes. A PR that edits both `App.jsx` render paths and `BadugiEngine.js` / `roundFlow.*` at the same time is a red flag.

Wholesale rewrites of engine files, controller files, or `App.jsx` sections are almost always wrong. The codebase has many interlocking invariants that are only surfaced by the full test suite — a rewrite that passes unit tests may silently break soak or E2E.

### Dangerous Architecture Hotspots

These files and modules have historically caused the most regressions. Extra caution is required:

| File / Module | Risk |
|---|---|
| `src/ui/App.jsx` | 4000+ line game orchestrator; see constraints below |
| `src/games/badugi/flow/actionUtils.js` | Core seat-eligibility predicates — all actor/blind/showdown selection depends on these; duplication is the root cause of most turn-order bugs |
| `src/games/badugi/flow/nextActorUtils.js` | Phase-dispatched actor search; must stay in sync with `actionUtils.js` predicates |
| `src/games/badugi/flow/betRoundUtils.js` | Bet-round closure logic; raising cap, re-open rules |
| `src/games/badugi/engine/roundFlow.jsx` / `.js` | Legacy betting/draw round driver still used by the engine; two files with same base name coexist |
| `src/games/_core/phaseMachineGraph.js` | Canonical phase graph; changes here break phase-transition assertions across all variants |
| `src/ui/utils/actorSourceOfTruth.js` | Actor resolution during the D-04 "next-actor-unify" migration; see actor flow rules below |
| `src/games/core/turn/actorEligibility.js` | Canonical eligibility rules; do not duplicate predicates — always call these helpers |
| `src/ai/iron/verifyStep*.js` | RL governance checkpoints; frozen by design |

### App.jsx Safety Constraints

`src/ui/App.jsx` is the main game screen orchestrator. It owns:
- Action dispatch loop (human and CPU turns)
- Hand history recording
- CPU decision telemetry pipeline
- Cross-variant state leak assertions
- Tournament phase tracking

**Rules for editing App.jsx:**

1. **Do not add `console.log` calls.** The soak telemetry policy explicitly prohibits new `console.log`-based diagnostics. Use the existing structured telemetry helpers (`buildCpuDecisionTelemetry`, `appendHandHistoryAction`, etc.) instead.
2. **Do not change the actor resolution dispatch** (`resolveCanonicalActionSeat` / `resolveSessionPreferredActor`) without a corresponding change to `actorSourceOfTruth.js` and a regression test in `gameProgressKnownBugs.test.js`. The D-04 branch is actively unifying legacy `nextTurn` with controller-authoritative `actingPlayerIndex`; partial edits to either side of this logic cause freeze bugs.
3. **Do not add new root-level `useState` hooks** for game state. Route new state through the controller or engine snapshot, not through separate React state that can diverge.
4. **Do not split App.jsx** into smaller components without a dedicated refactor branch and full soak validation — the component boundary decisions have subtle timing dependencies.

### Actor / Turn Flow Rules

The `nextTurn` / `actingPlayerIndex` dual-source resolution is the most fragile part of the codebase (active D-04 migration):

- **`controllerTurn`** (from `BadugiGameController` / `resolveCanonicalActionSeat`) is the authoritative actor during active BET and DRAW phases.
- **`legacyTurn`** (from `nextTurn` on the raw state snapshot) is a fallback used when the controller has not yet been fully wired for a variant.
- **`resolveCanonicalActionSeat`** applies `isSeatActionEligibleForPhase` to validate that the resolved seat is actually allowed to act in the current phase before committing to it.
- **Never derive the next actor by manually incrementing a seat index.** Always call `findNextActorSeatForPhase` (`nextActorUtils.js`) or `findNextEligibleActor` (`actorEligibility.js`). Duplicating this logic is the root cause of freeze bugs.
- **All-in seats are excluded from BET but included in DRAW.** This asymmetry is intentional and documented in `actionUtils.js` NOTE (H-01-2). Do not "simplify" the eligibility predicates.

### Tournament Engine Safety Constraints

`src/games/badugi/engine/tournamentMTT.js` provides **pure, immutable helper functions** for MTT state. The following rules apply:

1. **Never mutate the tournament state object in place.** All helpers return new state. Callers must replace their state reference.
2. **Do not change payout or blind-level progression logic** without updating both `tournamentBlindSheets.js` and the corresponding soak tests (`tests/e2e/gameplay-soak-core5-tournament.spec.ts`).
3. **Busted players** must use the `busted: true` / `bustHandIndex` / `finishPlace` pattern — do not mark them as `seatOut` on the base player object until after payout is calculated.
4. **`TABLE_FINISHED` is terminal.** Once the engine reaches this phase, do not attempt to advance it. Any post-`TABLE_FINISHED` state manipulation is a bug.
5. **Cash Review and Tournament Review must remain separate.** Cash Review uses the `/api/analysis/play-feedback` pipeline with a 30-hand minimum. Tournament Review shows a local summary first and goes through `TournamentReviewContract`. Do not merge their entry points, eligibility gates, or API payloads.

### Variant Isolation Rules

**Cross-variant state contamination is a P0 bug.** When switching variants the engine, controller, session state, and UI adapter must all change together atomically.

- `assertNoCrossVariantStateLeak` (`src/ui/qa/assertNoCrossVariantStateLeak.js`) is called on every snapshot during soak. Any violation is a P0 invariant failure.
- `controllerVariant`, `sessionVariant`, and `snapshotVariant` must all equal the active `variantId` after a variant switch. The normalised alias map (`badugi`/`d03`, `d01`/`deuce_to_seven_triple_draw`, etc.) is in `assertNoCrossVariantStateLeak.js` — keep it in sync when adding new variant IDs.
- Do not store variant-specific state fields (e.g., Badugi `drawRound`, stud `streetCards`) on a shared state object that persists across variant changes. Clear or re-initialise them in `createNewHandState`.
- When registering a new variant, add it to all four registries: `GameRegistry` (`src/games/_core/GameRegistry.js`), `engineRegistry` (`src/games/core/engineRegistry.js`), `variantCatalog.js` (`src/games/config/variantCatalog.js`), and `GameUIAdapterRegistry`. A variant missing from any one of these will silently fall back or throw at runtime.

### Test Classification Strategy

Choose the right test tier for every new test:

| Tier | Tool | When to use | Location |
|---|---|---|---|
| **Unit** | Vitest | Pure function correctness, single-module invariants, actor/turn/eligibility logic, hand evaluation | `__tests__/` next to the source file |
| **Game progression** | Vitest | Multi-action hand scenarios, phase transitions, known regressions across a full hand | `src/games/testing/` (`progress/`, `regression/`, `scenario/`) |
| **EV / correctness** | Vitest | Expected-value correctness across hands (e.g., correct winner, correct pot distribution) | `src/games/testing/ev/` |
| **RL safety** | Vitest | ONNX schema, pipeline audit, model adapter smoke | `src/rl/testing/`, `src/rl/__tests__/`, `src/ai/__tests__/` |
| **AI evaluation** | Vitest (heavy) | Counterfactual divergence, pro vs iron arena, replay determinism | `src/ai/evaluation/__tests__/` — excluded from `npm test` |
| **E2E / soak** | Playwright | Full browser hand progressions, freeze detection, mobile layout, multi-hand soak | `tests/e2e/` |

**Do not write Playwright tests for logic that can be exercised in Vitest.** Playwright tests are slow, require a running dev server, and fail non-deterministically in CI under load.

**Do not write game progression tests as E2E tests.** If a bug can be reproduced by constructing a snapshot and calling `findNextEligibleActor` or `assertGameProgressInvariants`, put it in `gameProgressKnownBugs.test.js`, not in a Playwright spec.

### AI Evaluation Test Execution Policy

The tests in `src/ai/evaluation/__tests__/` are **explicitly excluded from `npm test`** for good reason:

- They replay hundreds of hands, run ONNX inference, and take minutes to complete.
- They must run single-threaded (`--pool=forks --maxWorkers=1 --no-file-parallelism`) or they corrupt shared state.
- They produce evaluation artifacts in `reports/ai-eval/` that must be reviewed by a human before acting on them.

**Rules:**
1. Do not add `src/ai/evaluation/__tests__/` tests to `npm test` or `npm run test:unit`.
2. Run them explicitly with `npm run test:ai-evaluation` or `npm run test:all:serial`.
3. Do not run AI evaluation tests in a standard feature-branch CI pipeline. They are for scheduled evaluation runs and manual governance decisions.
4. When the evaluation output changes significantly, create a diff using `npm run eval:ai:compare-corpus` before concluding that a model changed or regressed.
5. `npm run test:mgx:safety` is the appropriate pre-merge gate for AI-related changes — it covers RL schema, ONNX adapter smoke, and pipeline audit without invoking the heavy evaluation suite.

### Rules for AI-Generated Changes (Codex / Claude)

When applying AI-generated code to this repository:

1. **Never accept a wholesale rewrite of an engine file, controller, or `App.jsx`.** If the generated diff touches more than ~50 lines of a hotspot file, ask for a targeted patch instead.
2. **Always run `npm run test:game:known-bugs` and `npm run test:rl:safety` after AI-generated changes** before considering a change safe — these are the fastest gates that cover the most dangerous regression surfaces.
3. **Do not accept AI-generated changes to `verifyStep*GovernanceFreeze.js` files.** These are intentionally frozen.
4. **Actor-resolution code (`actorSourceOfTruth.js`, `nextActorUtils.js`, `actorEligibility.js`) must be reviewed line by line** — AI models frequently "simplify" the eligibility predicates in ways that silently break all-in or folded-player handling.
5. **New console.log / console.warn calls added by AI generation should be removed** unless they are behind an existing debug flag (`debugFlags.js`) or tagged with an explicit structured prefix (`[DECK]`, `[BET]`, etc.) consistent with the soak telemetry retention policy.
6. **UI and engine changes generated together must be split** — apply them in separate commits and run the full game-progression test suite between them.
