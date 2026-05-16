# MGX Alpha Remote Sync Status

Date: 2026-05-16

## Snapshot

| Item | Result |
| --- | --- |
| Local branch | `feature/d-04-next-actor-unify` |
| Local HEAD before this sprint | `694594f docs(alpha): freeze friend alpha scope and QA checklist` |
| Remote | `origin https://github.com/Koki-Minoda/badugi-app.git` |
| Branch state | ahead of origin by 12 commits after the mobile overflow fix commits |
| Preview URL | `https://mgx-poker.com/` |
| Deployed snapshot | `90a830b7e1d2e9cb1a0683e59088874fd6f2972f` |

## Push Readiness

| Check | Result |
| --- | --- |
| `git status --short` | clean before adding this sprint's QA artifacts |
| `git branch -vv` | local branch ahead of origin |
| `gh` CLI | not installed in this environment |
| HTTPS dry-run push | blocked by missing credentials |
| SSH push readiness | blocked by host-key verification / SSH setup |
| Latest post-commit dry-run push | blocked by missing HTTPS credentials |
| Token exposure | none |
| Remote synced | false |

Dry-run push result:

```txt
fatal: could not read Username for 'https://github.com': No such device or address
```

SSH readiness check:

```txt
Host key verification failed.
```

## Required Follow-up

Remote sync is blocked until one of these is configured outside command logs:

1. GitHub CLI auth (`gh auth login`) after installing `gh`.
2. SSH remote with a configured deploy/user key.
3. HTTPS credential helper or PAT entered interactively without logging the token.

Do not widen friend alpha sharing until the deployed commits are pushed or otherwise backed up.
