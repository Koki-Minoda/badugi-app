# MGX Alpha Preview Deploy Check

Date: 2026-05-16

Deploy time: 2026-05-16T03:21:13Z

## Snapshot

| Item | Value |
| --- | --- |
| commit | `f121d732dd0a1debf699eb43699484e06d0a5c1d` |
| branch | `feature/d-04-next-actor-unify` |
| frontend URL | `https://mgx-poker.com/` |
| backend health | `https://mgx-poker.com/api/health` |
| rollback dist backup | `/var/backups/mgx/dist/mgx-dist-20260516-105342-pre-alpha-preview.tar.gz` |
| deploy command | `APP_DIR=/home/mgx/badugi-app GIT_BRANCH=feature/d-04-next-actor-unify ./scripts/deploy/mgx-prod-01.sh` |

## Deploy Result

| Check | Result |
| --- | --- |
| worktree clean before deploy | PASS |
| frontend build during deploy | PASS |
| backend dependency install | PASS |
| frontend dist rsync | PASS |
| backend service restart | PASS |
| nginx config test | PASS |
| nginx reload | PASS |
| SPA hard refresh | PASS |
| `/api/health` | PASS, `{\"status\":\"ok\",\"env\":\"prod\",\"db\":\"ok\"}` |
| deploy health helper | PASS via `/healthz` + frontend HTML |
| mobile fix included | true |

## Preview Flag / Availability

| Item | Result |
| --- | --- |
| D02 launch | PASS |
| S01 launch | PASS |
| S02 launch | PASS |
| Badugi without preview flag | disabled / `preview_only` |
| Chinese/OFC | disabled / `coming_soon` |
| production routing | unchanged |
| Iron promotion | false |
| live RL mutation | false |

## Notes

The deploy script does not create a fresh backup. The latest available frontend dist rollback archive remains `/var/backups/mgx/dist/mgx-dist-20260516-105342-pre-alpha-preview.tar.gz`.

Rollback frontend dist manually with the backup archive if needed, then redeploy the known-good commit `90a830b7e1d2e9cb1a0683e59088874fd6f2972f`.
