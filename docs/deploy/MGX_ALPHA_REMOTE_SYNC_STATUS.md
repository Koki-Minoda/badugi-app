# MGX Alpha Remote Sync Status

Date: 2026-05-16

## Snapshot

| Item | Result |
| --- | --- |
| Local branch | `feature/d-04-next-actor-unify` |
| Local HEAD | `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9` |
| Remote | `origin https://github.com/Koki-Minoda/badugi-app.git` |
| Branch state | local branch is ahead of `origin/feature/d-04-next-actor-unify` by 37 commits |
| Preview URL | `https://mgx-poker.com/` |
| Deployed snapshot | `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9` |

## Push Readiness

| Check | Result |
| --- | --- |
| `git status --short` before deploy | only generated `reports/alpha/` untracked |
| `git branch -vv` | local branch ahead 37 |
| HTTPS dry-run push | blocked by missing credentials |
| Token exposure | false |
| Remote synced | false |
| Deploy source risk | preview was deployed from local branch head, but remote has not been updated |

Dry-run push result:

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
