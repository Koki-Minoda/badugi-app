# MGX Alpha Post-deploy Browser Smoke

Date: 2026-05-16

## Snapshot

| Item | Result |
| --- | --- |
| URL | `https://mgx-poker.com/` |
| Commit | `f121d732dd0a1debf699eb43699484e06d0a5c1d` |
| Health | PASS |
| Browser smoke | PASS |

## Checks

| Check | Result |
| --- | --- |
| Main menu loads | PASS |
| Variant selector opens | PASS |
| D02 launches | PASS |
| S01 launches | PASS |
| S02 launches | PASS |
| D02/S01/S02 mobile viewport no horizontal overflow | PASS |
| Pot visible | PASS |
| Phase visible | PASS |
| Badugi disabled without preview variant flag | PASS |
| Learning Dashboard preview route | PASS |

## Notes

The browser smoke used a preview-only local auth state and intercepted `/api/auth/me` for the smoke run to keep the check focused on the deployed frontend path. A later direct curl check confirmed the real `/api/auth/signup` and `/api/auth/login` routes respond through `/api` as expected. Gameplay, variant gating, and dashboard rendering were exercised against the deployed frontend at `https://mgx-poker.com/`.
