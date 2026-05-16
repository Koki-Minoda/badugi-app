# MGX Alpha Product Hardening Readiness

Date: 2026-05-16

## Decision

`READY_FOR_UI_HARDENING`

Badugi P0 browser progression and active-hand pot continuity regressions remain fixed in focused automation. Step6 cleared the Badugi portrait mobile UI blocker, Step7 cleared the automated long-run active-pot / terminal-transition restore gate, and the Core 5 verification pass confirms Badugi/D01/D02/S01/S02 availability plus Core 5 actor-order/orientation support. Badugi is now intentionally promoted into friend-alpha scope because it is a core MGX game. The Core 5 mobile tournament layout fix is deployed at `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9`; the Badugi availability promotion still needs a deploy update after tests pass.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| preview deploy | PASS | preview refreshed and served frontend build info reports `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9` |
| build | PASS | `npm run build` succeeds |
| Badugi playable | AUTOMATED PASS / alpha scope | focused full 3-draw regression reaches `Hand Result`; long-run restore smoke passes 5 hands / 180 checkpoints; physical mobile QA remains required |
| pot continuity | PASS | focused browser, UI snapshot, and long-run restore tests pass with 0 active-hand `Total Pot 0` occurrences |
| mobile playable | PASS in emulation for Core 5 / physical QA pending | Core 5 UI audit now passes Badugi/D01/D02/S01/S02 on cash portrait, cash landscape, tournament portrait, tournament landscape, interaction, and desktop |
| Core 5 UI layout | PASS | desktop, cash mobile, tournament mobile, and interaction gates pass for all five core games in automation |
| Core 5 active status | PENDING recheck after config change | Badugi/D01/D02/S01/S02 should be alpha-playable and launchable |
| Core 5 actor order | PASS | no fixed-opposite-seat actor bug reproduced; BB does not act first in 3+ pre-draw without prior action |
| Core 5 orientation | PASS | cash and tournament support portrait and landscape for Badugi/D01/D02/S01/S02 |
| Triple Draw actor order | PASS | D01/D02/S01/S02 mapping audited; 6max/5max/3way pre-draw actor starts left of BB; heads-up blind/button actor semantics fixed |
| test coverage sufficiency | PASS for P0 | browser pot, snapshot pot merge, stale turn merge, no-next-alive actor tests added |
| routing/promotion/live RL | PASS | no production routing, promotion, live RL, or model registry change |

## Next Bugfix Priorities

| Priority | Item | Why |
| --- | --- | --- |
| P1 | Push deployed local commits | preview deploy used a local branch ahead of origin by 37 commits |
| P1 | Run physical mobile QA | emulation passed, but real device touch/orientation is still unchecked |
| P1 | Recheck mobile tournament layout on real Safari/Chrome | automation passes, but this was originally found on real-device/browser tournament views |
| P2 | Keep Badugi long-run restore gate in CI/release checks | Step7 cleared the blocker, but this should stay protected against regression |
| P1 | Run Badugi physical mobile full-hand QA | Step6/Step7 automation passes, but real mobile pot/action/draw controls are still unchecked |
| P1 | Monitor Badugi pot/terminal/actor behavior in closed alpha | Badugi is core MGX scope, but remaining real-device risk must stay visible |

## Deploy Recommendation

Continue with Core5 friend-alpha preview QA after deploy verification, but hold wider friend sharing until physical mobile QA is complete and remote sync is resolved or explicitly accepted as an operational P1.

The latest Core 5 UI audit does not add a Core5 UI blocker, clears the Badugi portrait UI blocker, and clears the mobile tournament portrait/landscape layout blocker in automation. Step7 clears the Badugi automated long-run restore blocker; the remaining Badugi release risk is physical mobile QA.
