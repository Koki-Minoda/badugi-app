# MGX Friend Alpha Release Candidate — 2026-08-25

## Decision

Status: **HOLD**

The roadmap 0–6 integration branch is a release candidate, but it is not approved for Friend Alpha production deployment.

## Completed evidence

- Production-line history, remote deploy hardening, lint cleanup, E2E closure, and security triage are integrated.
- Frontend lint and production build pass.
- Tier1: 282 files pass; 1,965 tests pass and 11 are skipped.
- MGX safety gate: 55 tests pass.
- Required AI model asset verification passes; only explicitly optional assets are absent.
- Runtime and full npm audits report zero vulnerabilities.
- Core5 action-order and cash lifecycle browser gates pass.
- Core5 tournament lifecycle passes after custom tournament capacity is normalized.
- Standard CPU policy passes the local strategy sanity threshold. Friend Alpha cash now defaults to Standard; Pro remains opt-in pending tuning.

## Release blockers

- Browser invariant gate still reproduces 12 P0 failures across D01, D02, S01, and S02 tournament paths: hand-completion timeouts on desktop and duplicate-card detection on portrait/landscape.
- Physical iPhone Safari/PWA and Android Chrome evidence is not available for the mandatory matrix.
- The intended release branch/head has not been pushed and verified against the live build.
- Badugi decision-source/value-pressure confirmation still requires targeted live or physical telemetry.

## GO requirements

1. Resolve the draw-game tournament state/deck synchronization failures and rerun the complete Core5 browser matrix.
2. Capture the required physical-device evidence with the exact release commit.
3. Push the reviewed integration to `main`; allow CI to pass before deployment.
4. Verify the live build head, API health, gameplay smoke, and decision-source telemetry.

Do not bypass these conditions with a manual workflow dispatch.
