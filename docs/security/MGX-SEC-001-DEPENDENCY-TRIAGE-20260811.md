# MGX-SEC-001 Dependency Vulnerability Closure

Status: **remediated and continuously gated**

Closure audit: 2026-08-31 JST

Canonical ref: `main` at `1d965f9a234038a20acbe680928d8ca704056905`

Evidence: `docs/security/mgx-sec-001-audit-evidence.json`

## Closure result

The historical 2026-07-23 deployment reported 36 package-level findings. The
original classification at `feature/d-04-next-actor-unify` reproduced 20
findings, including four runtime findings. The canonical `main` dependency
graphs now report:

| Audit | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| npm runtime (`--omit=dev`) | 0 | 0 | 0 | 0 | 0 |
| npm full graph | 0 | 0 | 0 | 0 | 0 |
| resolved backend Python environment | 0 | 0 | 0 | 0 | 0 |

The former `protobufjs`, `@protobufjs/utf8`, `react-router`,
`react-router-dom`, and build-tool findings are no longer present. Backend
dependency remediation also replaced `python-jose` with the supported HS256
PyJWT path and upgraded the FastAPI/Starlette line.

## Permanent control

The required `dependency-security` job creates a clean backend environment and
runs both npm audits plus `pip-audit --local`. It is a required `main` branch
protection context and blocks deployment when it fails. Forced audit upgrades
remain prohibited; dependency changes must continue through scoped PRs with
the normal build, test, browser, and deployment gates.

## Residual risk

There are no known dependency advisories in the resolved graphs at closure.
This is a point-in-time result, not a claim that future advisories cannot
appear. The editable local package `badugi-backend` is not published on PyPI
and is reported by `pip-audit` as skipped; all of its resolved third-party
dependencies are audited.

## Historical record

The old draft PR against `feature/d-04-next-actor-unify` is superseded by the
remediation already present on canonical `main`. Historical counts are retained
in the machine-readable evidence for traceability.
