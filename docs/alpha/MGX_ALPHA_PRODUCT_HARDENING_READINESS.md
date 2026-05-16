# MGX Alpha Product Hardening Readiness

Date: 2026-05-16

## Decision

`READY_FOR_UI_HARDENING`

Badugi P0 browser progression and active-hand pot continuity regressions remain fixed in focused automation, but the new Badugi alpha-restore gates found broader long-run and portrait-mobile blockers. Badugi remains `preview_only`. The D02/S01/S02 alpha scope remains the deployable friend-alpha candidate set.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| preview deploy | PASS | deployed `f121d732dd0a1debf699eb43699484e06d0a5c1d` to `https://mgx-poker.com/` with the mobile action overflow fix |
| build | PASS | `npm run build` succeeds |
| Badugi playable | BLOCKED / preview-only | focused full 3-draw regression reaches `Hand Result`, but long-run restore smoke is expected-fail due active-pot/terminal mismatch |
| pot continuity | PASS focused / FAIL long-run restore | focused browser and UI snapshot tests pass; long-run restore gate can still surface active-hand `Total Pot 0` symptoms |
| mobile playable | PASS for D02/S01/S02 / BLOCKED for Badugi restore | D02/S01/S02 mobile emulation passes; Badugi portrait restore launch is expected-fail at 390px/430px |
| test coverage sufficiency | PASS for P0 | browser pot, snapshot pot merge, stale turn merge, no-next-alive actor tests added |
| routing/promotion/live RL | PASS | no production routing, promotion, live RL, or model registry change |

## Next 5 Bugfix Priorities

| Priority | Item | Why |
| --- | --- | --- |
| P1 | Push or preserve deployed local commits | preview deploy used a local branch ahead of origin |
| P1 | Run physical mobile QA | emulation passed, but real device touch/orientation is still unchecked |
| P1 | Fix Badugi long-run active-pot / terminal-transition restore gate | Badugi cannot return to alpha while long-run smoke is expected-fail |
| P1 | Fix Badugi portrait mobile restore launch readiness | 390px/430px portrait cases are expected-fail |
| P1 | Keep Badugi `preview_only` until mobile full-hand QA passes | friend alpha must only expose stable variants |

## Deploy Recommendation

Continue with D02/S01/S02 friend-alpha preview QA on `https://mgx-poker.com/`, but hold wider friend sharing until physical mobile QA is complete. Do not reclassify Badugi to `alpha_playable` until the long-run restore smoke, portrait mobile restore gate, and physical mobile full-hand QA pass.
