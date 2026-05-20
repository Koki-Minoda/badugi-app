# MGX Alpha Live Deploy Verification

Date: 2026-05-21

## Live Source Of Truth

| Item | Value |
| --- | --- |
| Live URL | `https://mgx-poker.com/` |
| Health endpoint | `https://mgx-poker.com/api/health` |
| Verification report | `reports/alpha/live-deploy-verification-after-badugi-pro-overlay-normalization.json` |
| Live layout evidence | `reports/alpha/live-core5-layout-evidence-v2.json` |
| Live tournament fatal report | `reports/alpha/live-core5-tournament-runtime-fatal.json` |
| Live Badugi betting closure report | `reports/alpha/live-badugi-betting-closure.json` |
| Live browser gameplay smoke | `reports/browser-gameplay/live-core5-smoke-summary.json` |
| Live browser desktop matrix | `reports/browser-gameplay/live-core5-desktop-20hand-summary.json` |
| Live browser mobile matrix | `reports/browser-gameplay/live-core5-mobile-10hand-summary.json` |
| Badugi pro-overlay live observation | `reports/ai/badugi-value-bet-live-observation.json` |
| Badugi pro-overlay DB audit | `reports/ai/live-db-badugi-pro-overlay-normalization-audit.json` |

## Latest Verified Snapshot

| Field | Result |
| --- | --- |
| localHead | `c36bc37035dc29d2f98925139199ab99031efc2e` |
| deployedCommit | `c36bc37035dc29d2f98925139199ab99031efc2e` |
| deployedBundle | `assets/index-DIVDOspv.js` |
| matched | `true` |
| health | `PASS` |
| buildTime | `2026-05-20T23:06:32.950Z` |

## Live Blocker Evidence

The live deploy snapshot matches the local head recorded in `reports/alpha/live-deploy-verification-after-badugi-pro-overlay-normalization.json`. The deployed build includes the cross-variant session reset commits (`17c6d16`, `e2a3f96`), CPU telemetry commits (`b75e424`, `b0b1a2e`, `8638c79`), the Badugi tournament DRAW1 CPU action fix, tournament structure presets/gate, long-run soak gate, table action readability quick wins, and the Badugi pro-overlay action normalization commits (`bd1f4e4`, `845161e`, `c36bc37`). `/api/health` returns `{"status":"ok","env":"prod","db":"ok"}`.

```txt
npx playwright test tests/e2e/live-core5-tournament-runtime-fatal.spec.ts --project=badugi-flow
# 5 passed
```

Classification:

| ID | Priority | Status | Evidence |
| --- | --- | --- | --- |
| `CORE5-UI-LIVE-001` | P2 | FIXED_LIVE / MONITOR | `tests/e2e/live-core5-tournament-runtime-fatal.spec.ts`; `reports/alpha/live-core5-tournament-runtime-fatal.json` |
| `CORE5-TOUR-LIVE-001` | P2 | FIXED_LIVE / MONITOR | `tests/e2e/live-browser-gameplay-invariant.spec.ts`; `reports/browser-gameplay/live-core5-smoke-summary.json`; `reports/browser-gameplay/live-core5-desktop-20hand-summary.json`; `reports/browser-gameplay/live-core5-mobile-10hand-summary.json` |

The post-deploy focused Badugi re-raise-positive proof passed live. The post-deploy Core5 live smoke after the structure/soak/UX deploy completed 25/30 variant/mode/viewport cases; every case that reached gameplay passed, while 5 Triple Draw cases were blocked before launch by live `/auth/signup` 504 responses. Treat those 5 rows as `LIVE_AUTH_GATEWAY_TIMEOUT`, not as gameplay invariant failures, and rerun once the live auth path is stable. The post-deploy live readability smoke passed 10/10.

The cross-variant contamination recheck now passes live:

```txt
LIVE_PREVIEW=1 npx playwright test tests/e2e/cross-variant-session-contamination.spec.ts --project=badugi-flow
# 4 passed
```

The remaining live Badugi tournament mobile blocker was not stale D01/D02 controller reuse. The 20-hand live mobile Badugi tournament matrix had failed in both portrait and landscape at DRAW1 CPU action application with `controller action returned no snapshot`; this is tracked as `BADUGI-DRAW1-CPU-ACTION-001`. After deploying `3e597c515f8e3874cf3685db9d9fa45dc2c4ea14`, the focused live DRAW1 CPU regression passes, Badugi tournament portrait live emulation completes 20/20 hands with 0 invariant failures, and the landscape live recheck completes 20/20 hands with 0 invariant failures. The combined two-viewport run still intermittently hits live `/auth/signup` 504 before gameplay on the second leg; classify that as live auth infrastructure, not a gameplay invariant failure.

Live layout evidence now passes:

```txt
npx playwright test tests/e2e/live-core5-layout-evidence.spec.ts --project=badugi-flow
# 30 passed
```

## Badugi Pro-overlay Normalization Gate

Pre-deploy checks passed before running the preview deploy:

```txt
npm run build
npm run test:ai:iron
npm run test:ai:pro
npm run test:rl:safety
npm run test:game:ev
npx vitest run src/ai/__tests__/normalizeCpuAction.test.js
npx vitest run src/ai/__tests__/badugiValuePressureRegression.test.js
npx playwright test tests/e2e/badugi-value-bet-observation.spec.ts --project=badugi-flow
node scripts/run-badugi-value-bet-audit.js
```

Local audit result after normalization:

| Path | Value bet frequency | HU pressure | Meaningful density |
| --- | ---: | ---: | ---: |
| heuristic | 100.00% | 100.00% | 66.67% |
| pro-overlay runtime | 100.00% | 100.00% | 66.67% |
| fallback | 0.00% | 0.00% | 16.67% |

Live confirmation status:

- `LIVE_PREVIEW=1 BROWSER_RUNTIME_TELEMETRY=1 tests/e2e/live-browser-gameplay-invariant.spec.ts` reached gameplay for Badugi cash landscape, Badugi tournament desktop, and Badugi tournament portrait. Those gameplay rows completed 150/150 hands with no actor P0, terminal P0, or action-application failure. Two additional startup rows failed before gameplay on live `/auth/signup` 504 and are classified as auth infrastructure.
- `LIVE_PREVIEW=1 tests/e2e/badugi-value-bet-observation.spec.ts` passed, classified runtime as `pro-overlay`, and reported `passiveConfirmed=false`, `adapterMismatchRows=0`, `typeAliasRows=0`, and `illegalNormalizationRows=0`.
- DB audit for session `qa-1779319175402-7247efc3` persisted `decisionSource=pro-overlay` rows and no fallback reasons, but the pro-overlay rows were DRAW actions. The natural sample did not capture a legal pro-overlay BET pressure row with `rawActionSource=type` and canonical `finalAction=raise/bet`.

Classification: the fix is deployed and the live path is active, but `BADUGI-CPU-VALUE-BET-001` remains `NEEDS_TARGETED_LIVE_PRESSURE_CONFIRMATION` until a live/physical session captures the pressure/type-alias case.

## Required Follow-up

Remote sync, physical mobile QA, and targeted Badugi pro-overlay pressure telemetry remain required before friend alpha GO. After any new fix, verify `window.__MGX_BUILD_INFO__` and rerun:

```bash
npx playwright test tests/e2e/live-deploy-verification.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-core5-tournament-runtime-fatal.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-browser-gameplay-invariant.spec.ts --project=badugi-flow
npx playwright test tests/e2e/badugi-value-bet-observation.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-badugi-betting-closure.spec.ts --project=badugi-flow
npx playwright test tests/e2e/live-core5-layout-evidence.spec.ts --project=badugi-flow
```
