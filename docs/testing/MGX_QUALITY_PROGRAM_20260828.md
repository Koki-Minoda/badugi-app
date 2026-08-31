# MGX quality program — 2026-08-28

## Release decision

QA/QM result: **PASS for the 1–10 implementation scope**. Tasks 1–4 were integrated, reviewed, merged and deployed first. Tasks 5–10 passed locally and are protected by PR and nightly gates before their production promotion.

## Acceptance matrix

| # | Scope | Result | Evidence |
|---|---|---|---|
| 1 | Integration baseline | PASS | Canonical production line integrated through PRs; unrelated worktrees and existing changes preserved |
| 2 | Release gates | PASS | Lint, build, ONNX asset, Tier1/Tier2, backend, tournament, P2P, progression, EV and dependency gates pass |
| 3 | Main integration | PASS | PR review and required CI completed before merge; no direct unreviewed main update |
| 4 | Production deployment | PASS | Manual deployment completed; health reports prod/db ok; Core5 cash+tournament and standard/pro telemetry smokes passed with test-account deletion |
| 5 | World Championship | PASS | Real production configuration starts with 275 players / 46 tables and runs through FT, top three and heads-up to one verified champion |
| 6 | Re-entry contract | PASS | World explicitly disables re-entry; no re-entry/new-event CTA appears before or after FT bust while the event is live; only a separate new tournament is offered after completion |
| 7 | Hand history and replay | PASS | Cash and tournament ledger replay preserve ordered actions, draw cards, pot and final stacks; UI groups streets and shows action order, player name and position |
| 8 | P2P production usability | PASS | Two real production accounts create/join, preserve eight-card privacy, reconnect, act, leave and are deleted. When WSS is unavailable, bounded REST polling completes the flow |
| 9 | Unfinished-game quality | PASS for CP1 scope | Chinese Poker now records initial cards, row placements and showdown scoring; deterministic replay recomputes the same rows/results; up to 50 unique histories persist |
| 10 | Permanent QA/QM | PASS | History replay is a required deploy gate; tournament completion remains a PR gate; nightly production Core5/P2P and standard/pro telemetry jobs retain artifacts; GitHub actions use Node 24-compatible major versions |

## Final automated evidence

- ESLint: PASS.
- Production build: PASS; ONNX WASM asset 23,824,254 bytes.
- Dependency audit: 0 vulnerabilities.
- Tier1: 303 files / 2,073 tests PASS.
- Tier2: 78 files / 165 tests PASS.
- Backend: 69 tests PASS, including deletion, P2P persistence, migration and tournament state.
- Game progression: 170 tests PASS; game EV: 25 tests PASS.
- P2P: 17 UI tests, canonical WebSocket E2E and forced REST-fallback E2E PASS.
- Production P2P: create/join/privacy/reload/action/leave/delete PASS in 13.8 seconds.
- Cash exact history replay: PASS.
- Tournament exact history replay: PASS.
- Store completion: 37 real Hero hands + 57 background hands; level 12 and champion verified.
- Local completion: 15 real Hero hands + 150 background hands; level 11, ante and champion verified.
- World completion: 32 real Hero hands + 807 background hands; 275-player field, FT/top three/heads-up, level 17 and champion verified.
- Store/local Hero-champion paths produce grounded post-tournament reviews.
- Chinese Poker controller/history/UI: 10 tests PASS; replay integrity is surfaced in the result screen.

## Quality-management controls added

1. PRs cannot deploy unless quality, backend, tournament, P2P and exact-history jobs all pass.
2. The history job starts a real backend and verifies cash replay plus all supported cross-variant replay paths.
3. The deploy script verifies `/friend-match` resolves to the same current hashed SPA assets as `/`.
4. Nightly production QA runs Core5 cash/tournament and P2P lifecycle checks with screenshots/artifacts retained for 14 days.
5. Nightly AI QA runs standard and pro telemetry separately; test users are deleted and stale tokens must return 401.
6. Test failures record screenshots and browser artifacts; production P2P cleanup is independent of the page lifecycle so timeout does not skip deletion.
7. Tournament QA advances only when the visible result hand ID is replaced by a new physical hand ID. Re-reading one result can no longer masquerade as hundreds of completed hands.
8. Tournament blind displays use the MTT engine's completed-hand counter as the authority. Store/local fifth-hand boundary tests prevent the ring controller from advancing a level one hand early.
9. Tournament completion is idempotent by table and hand ID, and a Next Hand request made during the short deal lock is queued once instead of being discarded or double-dealt.
10. CPU decision telemetry preserves policy source and AI tier through controller-backed actions. Live standard/pro checks require at least one attributed policy decision in both cash and tournament modes; unknown row counts alone cannot pass.
11. Browser progression waits compare the exact same canonical state shape used by freeze detection. A UI click can no longer pass merely because the wait-side key omitted or reordered player fields.
12. The scheduled-break progression path is repeated under the corrected state gate; unchanged DRAW state now fails instead of being counted as successful action progress.
13. `dependency-security` is protected on `main`; npm runtime/full and clean resolved Python audits must remain at zero known findings before deployment.

## 2026-08-31 verification addendum

- Scheduled tournament break, real DRAW action, level transition, and resume: 20/20 consecutive browser runs PASS after correcting the progression-key contract.
- npm runtime audit: 0 vulnerabilities.
- npm full audit: 0 vulnerabilities.
- clean Python 3.11 resolved-environment audit: 0 known vulnerabilities.
- MGX-SEC-001 is eligible for closure; its obsolete draft PR against the retired production branch is superseded by canonical `main`.
- Core5 weekly long-soak coverage is 400 completed hands per browser target (Desktop Chromium, Android Chromium, and iPhone WebKit), 1,200 hands total, with SHA-256 evidence.
- Store and Local tournament QM each complete seven real Hero hands, Level 2, reload/resume, six-player final table, championship, exact replay, grounded review, and result return.
- The pre-deploy production baseline still remains at Level 1 after five Store/Local hands; deployment and post-deploy QM are required before this defect is closed.

## Explicit boundaries

- Production P2P supports durable multi-worker rooms, cross-worker state refresh, shared rate limits, command deduplication, restart recovery, and authenticated REST fallback when WSS is unavailable. The current design remains database-backed polling rather than an external pub/sub service.
- Chinese Poker classic placement/scoring/history is covered. OFC street-by-street dealing and Fantasyland are separate product features and are not falsely marked complete.
- The Badugi `pro-overlay` production path is heuristic overlay logic. The Windows-trained ONNX checkpoint is not yet directly wired as the live Badugi action candidate and must not be described as deployed model inference.
