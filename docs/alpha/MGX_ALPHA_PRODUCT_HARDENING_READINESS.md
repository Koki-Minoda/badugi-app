# MGX Alpha Product Hardening Readiness

Date: 2026-05-16

## Decision

`HOLD_FOR_BADUGI_BETTING_CLOSURE_LIVE_VERIFY_AND_LIVE_TOURNAMENT_RUNTIME`

Badugi P0 browser progression and active-hand pot continuity regressions remain fixed in focused automation. Step6 cleared the Badugi portrait mobile UI blocker, Step7 cleared the automated long-run active-pot / terminal-transition restore gate, and live action-history audit confirms no Core5 actor-order violation. A new user-reported live Badugi raise/call betting-closure issue is now fixed locally with action-history regression evidence, but it is not deployed or live-verified yet. Friend alpha is also still blocked because `https://mgx-poker.com/` reports deployed commit `f2c36e7ec833153b8428da07918bf7c8fb3ee234`, which does not match the current local branch, and D01/D02/S01/S02 tournament mode throws live browser fatal `applyPlayerAction is not a function`.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| live deploy snapshot | FAIL | live build info reports `f2c36e7ec833153b8428da07918bf7c8fb3ee234` and `/assets/index-Dt7nwlgG.js`; the current local branch includes newer fixes, including Badugi betting closure |
| live health | PASS | `/api/health` returns `{"status":"ok","env":"prod","db":"ok"}` |
| build | PASS | `npm run build` succeeds |
| Badugi playable | FIXED_LOCAL / HOLD_FOR_LIVE_VERIFY | focused full 3-draw regression reaches `Hand Result`; long-run restore smoke passes 5 hands / 180 checkpoints; raise/call betting closure regression now passes locally; deploy and live action-history verification remain required |
| pot continuity | PASS | focused browser, UI snapshot, and long-run restore tests pass with 0 active-hand `Total Pot 0` occurrences |
| mobile playable | PASS in emulation for Core 5 / physical QA pending | Core 5 UI audit now passes Badugi/D01/D02/S01/S02 on cash portrait, cash landscape, tournament portrait, tournament landscape, interaction, and desktop |
| Core 5 live layout evidence | FAIL | 13/25 live cases pass. Badugi cash/tournament and D01/D02/S01/S02 cash pass; D01/D02/S01/S02 tournament portrait/landscape fail with browser fatal `applyPlayerAction is not a function` |
| Core 5 active status | PENDING recheck after config change | Badugi/D01/D02/S01/S02 should be alpha-playable and launchable |
| Core 5 actor order | PASS | live action-history audit across Badugi/D01/D02/S01/S02 recorded expected vs actual actor samples and found 0 invalid actor rows / 0 hero-control mismatches |
| Core 5 orientation | PASS | cash and tournament support portrait and landscape for Badugi/D01/D02/S01/S02 |
| Triple Draw actor order | PASS | D01/D02/S01/S02 mapping audited; 6max/5max/3way pre-draw actor starts left of BB; heads-up blind/button actor semantics fixed |
| test coverage sufficiency | PASS for P0 | browser pot, snapshot pot merge, stale turn merge, no-next-alive actor tests added |
| Badugi raise/call betting closure | FIXED_LOCAL | `badugiRaiseCallClosureRegression`, `badugiRaiseCallClosureSnapshot`, and `badugi-raise-call-round-closure` prove raise-call closes without reselecting Hero, while re-raise legitimately reopens action |
| routing/promotion/live RL | PASS | no production routing, promotion, live RL, or model registry change |

## Next Bugfix Priorities

| Priority | Item | Why |
| --- | --- | --- |
| P0 | Deploy and live-verify Badugi raise/call betting closure | user-reported live Badugi path showed Hero controls after all opponents called/folded; local fix passes action-history regression but is not live-verified |
| P0 | Fix live D01/D02/S01/S02 tournament fatal | live tournament mode throws `applyPlayerAction is not a function` and must not be exposed to friend alpha |
| P1 | Refresh live deploy snapshot | live build info is stale relative to local HEAD |
| P1 | Push deployed local commits | preview deploy used a local branch ahead of origin by many commits |
| P1 | Run physical mobile QA | emulation passed, but real device touch/orientation is still unchecked |
| P1 | Recheck mobile tournament layout on real Safari/Chrome | automation passes, but this was originally found on real-device/browser tournament views |
| P2 | Keep Badugi long-run restore gate in CI/release checks | Step7 cleared the blocker, but this should stay protected against regression |
| P1 | Run Badugi physical mobile full-hand QA | Step6/Step7 automation passes, but real mobile pot/action/draw controls are still unchecked |
| P1 | Monitor Badugi pot/terminal/actor behavior in closed alpha | Badugi is core MGX scope, but remaining real-device risk must stay visible |

## Deploy Recommendation

Hold friend alpha. Continue only after the Badugi betting-closure fix is deployed and live-verified, live D01/D02/S01/S02 tournament fatal is fixed, the live deploy snapshot matches the intended commit, physical mobile QA is complete, and remote sync is resolved or explicitly accepted as an operational P1.

The latest local Core5 UI audits remain useful, but they are not sufficient for release. The live URL evidence is the current source of truth and adds `CORE5-UI-LIVE-001` as a P0 tournament runtime blocker.

The Core 5 action-order reality audit adds per-action history evidence beyond first-actor checks. It classifies the reported BB case as `FALSE_ALARM_CONFIRMED_BY_HISTORY`: BB acted only after earlier active obligations were resolved, or as the first active post-draw actor when seats left of the button were folded/ineligible.
