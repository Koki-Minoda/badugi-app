# MGX Alpha Remote Sync Status

Date: 2026-05-17

## Snapshot

| Item | Result |
| --- | --- |
| Local branch | `feature/d-04-next-actor-unify` |
| Local HEAD after live release blocker docs update | `3e0dd0bfff3c8c5862393f7570f57c36e3d8db67` |
| Remote | `origin https://github.com/Koki-Minoda/badugi-app.git` |
| Branch state after live release blocker docs update | local branch is ahead of `origin/feature/d-04-next-actor-unify` by 61 commits |
| Preview URL | `https://mgx-poker.com/` |
| Deployed snapshot | `3e0dd0bfff3c8c5862393f7570f57c36e3d8db67` |

## Push Readiness

| Check | Result |
| --- | --- |
| `git status --short` | only generated `reports/alpha/`, `reports/invariant/`, and `reports/tournament/` untracked |
| `git branch -vv` | local branch ahead 61 before final deploy |
| `gh --version` | unavailable, `gh` is not installed |
| HTTPS push | blocked by missing credentials |
| Token exposure | false |
| Remote synced | false |
| Deploy source risk | preview is deployed from local branch head `3e0dd0b`, but remote has not been updated |

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
