# MGX Alpha Preview Deploy Check

Date: 2026-05-16

Deploy time: 2026-05-16T01:54:12Z

## Snapshot

| Item | Value |
| --- | --- |
| commit | `90a830b7e1d2e9cb1a0683e59088874fd6f2972f` |
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

The deploy script initially failed when `APP_DIR` defaulted to `/root/badugi-app`; rerun succeeded with `APP_DIR=/home/mgx/badugi-app`.

The local branch is ahead of `origin/feature/d-04-next-actor-unify`; this preview deploy used the local committed snapshot on the VPS.
