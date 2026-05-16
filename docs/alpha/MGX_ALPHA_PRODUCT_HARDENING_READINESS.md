# MGX Alpha Product Hardening Readiness

Date: 2026-05-16

## Decision

`READY_FOR_UI_HARDENING`

Badugi P0 browser progression and active-hand pot continuity regressions remain fixed in focused automation. Step6 cleared the Badugi portrait mobile UI blocker, and Step7 cleared the automated long-run active-pot / terminal-transition restore gate. Badugi remains `preview_only` until physical mobile QA confirms real-device pot/action/phase usability. The D02/S01/S02 alpha scope remains the deployable friend-alpha candidate set.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| preview deploy | PASS | deployed `f121d732dd0a1debf699eb43699484e06d0a5c1d` to `https://mgx-poker.com/` with the mobile action overflow fix |
| build | PASS | `npm run build` succeeds |
| Badugi playable | AUTOMATED PASS / preview-only | focused full 3-draw regression reaches `Hand Result`; long-run restore smoke passes 5 hands / 180 checkpoints; physical mobile QA remains required |
| pot continuity | PASS | focused browser, UI snapshot, and long-run restore tests pass with 0 active-hand `Total Pot 0` occurrences |
| mobile playable | PASS in emulation for Core 5 / physical QA pending | Core 5 UI audit now passes D01/D02/S01/S02 and Badugi on portrait, landscape, interaction, and desktop; Badugi remains preview-only for physical mobile QA |
| Core 5 UI layout | PASS | desktop, portrait, landscape, and interaction gates pass for all five core games in automation |
| Triple Draw actor order | PASS | D02/S01/S02/D01 mapping audited; 6max/5max/3way pre-draw actor starts left of BB; heads-up blind/button actor semantics fixed |
| test coverage sufficiency | PASS for P0 | browser pot, snapshot pot merge, stale turn merge, no-next-alive actor tests added |
| routing/promotion/live RL | PASS | no production routing, promotion, live RL, or model registry change |

## Next 5 Bugfix Priorities

| Priority | Item | Why |
| --- | --- | --- |
| P1 | Push or preserve deployed local commits | preview deploy used a local branch ahead of origin |
| P1 | Run physical mobile QA | emulation passed, but real device touch/orientation is still unchecked |
| P2 | Keep Badugi long-run restore gate in CI/release checks | Step7 cleared the blocker, but this should stay protected against regression |
| P1 | Run Badugi physical mobile full-hand QA | Step6/Step7 automation passes, but real mobile pot/action/draw controls are still unchecked |
| P1 | Keep Badugi `preview_only` until physical mobile full-hand QA passes | friend alpha must only expose stable variants |

## Deploy Recommendation

Continue with D02/S01/S02 friend-alpha preview QA on `https://mgx-poker.com/`, but hold wider friend sharing until physical mobile QA is complete. Do not reclassify Badugi to `alpha_playable` until physical mobile full-hand QA passes.

The latest Core 5 UI audit does not add a D01/D02/S01/S02 UI blocker and clears the Badugi portrait UI blocker. Step7 clears the Badugi automated long-run restore blocker; the remaining Badugi release gate is physical mobile QA.
