# MGX Alpha Deploy Snapshot Verification

Date: 2026-05-16

## Snapshot

| Item | Value |
| --- | --- |
| localLatestCommit | `c72fe2a50a49690fb966eeef1c4aec085eb11e98` |
| deployedPreviewCommitBeforeThisStep | `f121d732dd0a1debf699eb43699484e06d0a5c1d` |
| preview URL | `https://mgx-poker.com/` |
| `/api/health` | PASS: `{"status":"ok","env":"prod","db":"ok"}` |
| build info surface | PASS locally via `window.__MGX_BUILD_INFO__` and optional `mgx.showBuildInfo=true` badge |

## Commit Inclusion

| Commit | Included In Local | Included In Current Preview Before Redeploy | Notes |
| --- | --- | --- | --- |
| `fdb2597` | true | unknown/stale | Step6 Badugi portrait layout test |
| `3c05176` | true | unknown/stale | Step6 Badugi portrait layout fix |
| `91505eb` | true | unknown/stale | Step6 readiness docs |
| `b6603c5` | true | false | Step7 long-run pot/terminal tests |
| `e2c6be6` | true | false | Step7 long-run pot/terminal fix |
| `c72fe2a` | true | false | Step7 readiness docs |

## Result

`DEPLOY_STALE_BEFORE_THIS_STEP`

The deployed preview recorded in the prior deploy check still points to `f121d732dd0a1debf699eb43699484e06d0a5c1d`, while local latest is `c72fe2a50a49690fb966eeef1c4aec085eb11e98`.

## Required Action

After this verification/fix commit set is complete and tests pass, run the preview deploy from the latest local branch and verify `window.__MGX_BUILD_INFO__.commit` on `https://mgx-poker.com/?buildInfo=1`.
