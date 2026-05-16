# MGX Alpha Product Hardening Readiness

Date: 2026-05-16

## Decision

`READY_FOR_UI_HARDENING`

Badugi P0 browser progression and active-hand pot continuity regressions are fixed in local targeted automation and verified on the deployed preview URL for desktop. Badugi remains `preview_only` until physical mobile/full-hand QA passes.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| preview deploy | PASS | deployed `f121d732dd0a1debf699eb43699484e06d0a5c1d` to `https://mgx-poker.com/` with the mobile action overflow fix |
| build | PASS | `npm run build` succeeds |
| Badugi playable | PASS / preview-only | full 3-draw browser regression reaches `Hand Result`; Badugi remains hidden from friend alpha |
| pot continuity | PASS | active hand no longer renders `Total Pot 0`; browser and UI snapshot tests cover this |
| mobile playable | PASS / physical pending | D02/S01/S02 mobile emulation passes for 390px/430px portrait and 844px landscape; physical device and Badugi full-hand mobile QA pending |
| test coverage sufficiency | PASS for P0 | browser pot, snapshot pot merge, stale turn merge, no-next-alive actor tests added |
| routing/promotion/live RL | PASS | no production routing, promotion, live RL, or model registry change |

## Next 5 Bugfix Priorities

| Priority | Item | Why |
| --- | --- | --- |
| P1 | Push or preserve deployed local commits | preview deploy used a local branch ahead of origin |
| P1 | Run physical mobile QA | emulation passed, but real device touch/orientation is still unchecked |
| P1 | Keep Badugi `preview_only` until mobile full-hand QA passes | friend alpha must only expose stable variants |
| P2 | Add mobile Badugi pot/action visibility assertions | prevents regression on small viewports |
| P2 | Broaden long-run natural Badugi browser smoke | catches rare CPU progression and transition edge cases |

## Deploy Recommendation

Continue with D02/S01/S02 friend-alpha preview QA on `https://mgx-poker.com/`, but hold wider friend sharing until physical mobile QA is complete. Do not reclassify Badugi to `alpha_playable` until mobile full-hand QA passes.
