# MGX Alpha Remote Sync Status

Date: 2026-05-18

## Snapshot

| Item | Result |
| --- | --- |
| Local branch | `feature/d-04-next-actor-unify` |
| Local HEAD | `a2a271e4b426581fcdb7c156d1aa90b1ed607a00` |
| Remote | `origin https://github.com/Koki-Minoda/badugi-app.git` |
| Branch state | local branch is ahead of `origin/feature/d-04-next-actor-unify` by 87 commits |
| Preview URL | `https://mgx-poker.com/` |
| Deployed snapshot | live commit matches local HEAD in `reports/alpha/live-deploy-verification.json` |

## Push Readiness

| Check | Result |
| --- | --- |
| `git status --short` | source/docs/tests are expected clean after the live-matrix docs commit; generated `reports/` remain untracked |
| `git branch -vv` | local branch ahead 87 before remote push |
| `gh --version` | unavailable, `gh` is not installed |
| HTTPS push | blocked by missing credentials |
| Token exposure | false |
| Remote synced | false |
| Deploy source risk | preview is deployed from the local branch head, but remote has not been updated |

Push result:

```txt
fatal: could not read Username for 'https://github.com': No such device or address
```

## Required Follow-up

Push from a credentialed environment without logging secrets:

```bash
git push origin feature/d-04-next-actor-unify
```

Acceptable credential paths:

1. GitHub CLI auth (`gh auth login`) if `gh` is available.
2. SSH remote with a configured user/deploy key.
3. HTTPS credential helper or PAT entered interactively, never embedded in the remote URL or shell history.
