# MGX Alpha Product Hardening Readiness

Date: 2026-05-16

## Decision

`READY_FOR_UI_HARDENING`

Badugi P0 browser progression and active-hand pot continuity regressions are fixed in local targeted automation. Preview deploy is still intentionally deferred until the worktree is cleaned of unrelated Step59-65 files and a manual preview/mobile QA pass is scheduled.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| preview deploy | HOLD | deploy skipped by policy; unrelated untracked Step59-65 artifacts remain |
| build | PASS | `npm run build` succeeds |
| Badugi playable | PASS / preview-only | full 3-draw browser regression reaches `Hand Result`; Badugi remains hidden from friend alpha |
| pot continuity | PASS | active hand no longer renders `Total Pot 0`; browser and UI snapshot tests cover this |
| mobile playable | UNKNOWN | real device/manual mobile QA has not been rerun after the fix |
| test coverage sufficiency | PASS for P0 | browser pot, snapshot pot merge, stale turn merge, no-next-alive actor tests added |
| routing/promotion/live RL | PASS | no production routing, promotion, live RL, or model registry change |

## Next 5 Bugfix Priorities

| Priority | Item | Why |
| --- | --- | --- |
| P1 | Clean unrelated Step59-65 worktree files before deploy | preview deploy should happen from a clean, auditable commit set |
| P1 | Run manual Badugi preview QA on desktop and mobile | automation is green, but user-facing touch/layout still needs confirmation |
| P1 | Keep Badugi `preview_only` until preview URL QA passes | friend alpha must only expose stable variants |
| P1 | Add mobile pot/action visibility assertions for the fixed path | prevents regression on small viewports |
| P2 | Broaden long-run natural Badugi browser smoke | catches rare CPU progression and transition edge cases |

## Deploy Recommendation

Do not deploy directly from the current dirty worktree. The Badugi P0 code path is green locally, so the next deploy candidate should be created after committing the Badugi fix/docs and either committing, stashing, or intentionally ignoring unrelated Step59-65 alpha research files.
