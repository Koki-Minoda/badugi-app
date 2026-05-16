# MGX Alpha Remote Sync Status

Date: 2026-05-16

## Snapshot

| Item | Result |
| --- | --- |
| Local branch | `feature/d-04-next-actor-unify` |
| Local HEAD before last-mile docs update | `3fb5dbb` |
| Remote | `origin https://github.com/Koki-Minoda/badugi-app.git` |
| Branch state before last-mile docs update | local branch is ahead of `origin/feature/d-04-next-actor-unify` by 38 commits |
| Preview URL | `https://mgx-poker.com/` |
| Deployed snapshot | `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9` |

## Push Readiness

| Check | Result |
| --- | --- |
| `git status --short` | only generated `reports/alpha/` untracked |
| `git branch -vv` | local branch ahead 38 before this docs update |
| `gh --version` | unavailable, `gh` is not installed |
| HTTPS push | blocked by missing credentials |
| Token exposure | false |
| Remote synced | false |
| Deploy source risk | preview was deployed from local branch head, but remote has not been updated |

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
