# MGX Alpha Preview Deploy Check

Date: 2026-05-16

Deploy time: 2026-05-16T13:39:18Z

## Snapshot

| Item | Value |
| --- | --- |
| deployed commit | `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9` |
| branch | `feature/d-04-next-actor-unify` |
| frontend URL | `https://mgx-poker.com/` |
| backend health | `https://mgx-poker.com/api/health` |
| build time | `2026-05-16T13:39:11.420Z` |
| app version | `0.0.0` |
| JS bundle | `/assets/index-DeXIeZVa.js` |
| CSS bundle | `/assets/index-Bh3wPeCa.css` |
| bundle path | `/var/www/mgx-poker/assets/index-DeXIeZVa.js` |
| deploy command | `APP_DIR=/home/mgx/badugi-app GIT_BRANCH=feature/d-04-next-actor-unify ./scripts/deploy/mgx-prod-01.sh` |
| rollback dist backup | `/var/backups/mgx/dist/mgx-dist-20260516-105342-pre-alpha-preview.tar.gz` |

## Deploy Result

| Check | Result |
| --- | --- |
| source/docs/tests before deploy | clean except generated `reports/alpha/`; pre-deploy baseline doc was created after tests |
| frontend dependency install | PASS |
| frontend build during deploy | PASS |
| backend dependency install | PASS |
| frontend dist rsync | PASS |
| backend service restart | PASS |
| nginx config test | PASS |
| nginx reload | PASS |
| `curl -I https://mgx-poker.com/` | PASS, HTTP 200 |
| `curl https://mgx-poker.com/api/health` | PASS, `{"status":"ok","env":"prod","db":"ok"}` |
| build info | PASS, `window.__MGX_BUILD_INFO__.commit` is `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9` |
| mobile tournament layout fix included | true |

## Preview Flag / Availability

| Item | Result |
| --- | --- |
| D01 launch | PASS in post-deploy smoke |
| D02 launch | PASS in post-deploy smoke |
| S01 launch | PASS in post-deploy smoke |
| S02 launch | PASS in post-deploy smoke |
| Badugi without preview flag | disabled / `preview_only` |
| production routing | unchanged |
| Iron promotion | false |
| live RL mutation | false |

## Notes

The deploy script does not create a fresh backup archive. The latest known frontend dist rollback archive remains `/var/backups/mgx/dist/mgx-dist-20260516-105342-pre-alpha-preview.tar.gz`.

Rollback if needed:

1. Restore the known-good frontend dist archive from `/var/backups/mgx/dist/mgx-dist-20260516-105342-pre-alpha-preview.tar.gz`, or redeploy the previous known-good commit from a clean checkout.
2. Restart `mgx-backend.service`.
3. Run `sudo nginx -t && sudo systemctl reload nginx`.
4. Confirm `https://mgx-poker.com/api/health` returns `{"status":"ok","env":"prod","db":"ok"}`.
