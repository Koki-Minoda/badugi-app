# MGX quality program — 2026-08-28

## Release decision

QA/QM result: **PASS for PR review**. No known P0/P1 product blocker remains in the ten-item scope. Production promotion still requires the normal PR, CI, manual deployment, and post-deploy health checks.

## Ten-item acceptance matrix

| # | Scope | Result | Quality evidence |
|---|---|---|---|
| 1 | NLH side pots | PASS | Contribution-tier settlement, folded-player eligibility, multi-all-in and odd-chip tests |
| 2 | Shared PLO/PLO8/FLH settlement | PASS | High-only and hi/lo contribution-pot resolvers shared by B01-B09; chip-conservation and payout tests |
| 3 | Core5 real-action tournaments | PASS | Badugi, 2-7 TD, A-5 TD, 2-7 SD and A-5 SD use visible UI actions before a verified champion and grounded review |
| 4 | World tournament scale | PASS | Production field starts, advances blind level and reaches one champion with complete finish order |
| 5 | Re-entry rules | PASS | Store/local/national/world explicitly declare no re-entry; no bust/final-table re-entry CTA exists; a new tournament is offered only after completion |
| 6 | Hand history and replay | PASS | Exact final-state replay plus 35 playable variants preserving hand id, ordered actions, results, pots and frame navigation |
| 7 | P2P durability | PASS | Room snapshots persist in the database, survive process restart, reject stale sequence writes, prune expired database-only rooms, and preserve viewer privacy; WebSocket and REST fallback flows pass |
| 8 | 36-game quality gates | PASS | All 36 catalog variants run deterministic ten-hand progression with no skip; one-hand, progression and EV suites are CI gates |
| 9 | App/controller consolidation | PASS with controlled P2 debt | Badugi uses one public controller path; snapshot selection is extracted and unit-tested; tournament state is synchronized before betting actions. Continued App.jsx decomposition remains maintainability work, not a release blocker |
| 10 | CI and operations | PASS | CI runs lint, build, Tier1, backend, tournament QA, game progression and EV; production build is chunked without size warnings; dependency audit is clean; migration and deploy static checks pass |

## Final QA evidence

- ESLint: PASS.
- Production build: PASS, with no chunk-size warning.
- Dependency audit: 0 vulnerabilities.
- Tier1: 301 files / 2,066 tests PASS.
- Tier2: 78 files / 165 tests PASS.
- Backend: 64 tests PASS, including account deletion and P2P persistence.
- Game progression: 170 tests PASS; game EV: 25 tests PASS; one-hand gate: 53 tests PASS.
- Core5 standard soak: cash 10/10 and tournament 10/10 PASS across two seeds per variant.
- Tournament PR browser gate: 15/15 PASS. Store completed after 33 real Hero hands plus 57 background hands; local completed after 25 real Hero hands plus 140 background hands.
- Store completion stability: repeated twice after the all-in DRAW fix, both reached a champion.
- Android Chromium and iPhone WebKit tournament device gate: 2/2 PASS across Core5 layout/action audits.
- Cross-variant history/replay: 35/35 PASS.
- P2P: 17 UI tests plus WebSocket and REST-fallback browser flows PASS; backend P2P persistence is included in the full backend suite.
- Deployment static safety and Alembic upgrade-to-head: PASS.

## Defects found and closed during QA

1. Mobile tournament HUD was clipped above the visual viewport on Android/iPhone landscape. The compact HUD is now passed to the actual HUD child rather than its fragment wrapper.
2. Tournament Badugi raised using a stale pre-tournament fixed-limit unit. The active blind is now authoritative in controller configuration and action payloads.
3. A controller could return a successful but non-progressing Hero draw when remaining opponents were all-in. Non-progressing snapshots are rejected and the already-committed table draw is used.
4. The desktop player status board covered the table by default. It is now collapsed initially.
5. Chinese Poker's real ten-hand gate exceeded the generic five-second test budget. It retains all ten hands with a variant-specific bounded timeout.

## Controlled follow-up debt

- P2P room state is durable and multi-worker safe through database snapshots and sequence conflicts, but real-time socket fanout remains process-local with polling convergence; cross-node pub/sub is a future scale optimization.
- B01-B09 have strict shared settlement assertions. The other families have deterministic multi-hand/replay gates, while family-specific payout-oracle expansion remains P2 quality work.
- App.jsx is still large. Controller snapshot resolution is extracted and the duplicate Badugi public path is removed; further feature-slice extraction should continue in small, regression-gated changes.
