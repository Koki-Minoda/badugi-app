# MGX-SEC-001 Dependency Vulnerability Triage

Status: classified; remediation not applied

Audit target: `feature/d-04-next-actor-unify` at `6a0cd89`

Evidence: `docs/security/mgx-sec-001-audit-evidence.json`

## Result

The historical deployment log reported 36 vulnerabilities on 2026-07-23 JST. That log retained only aggregate severity counts, not advisory identities. A reproducible audit of the current production branch now reports 20 vulnerable packages:

| Classification | Packages | Current severity |
|---|---:|---|
| Runtime | 4 | 1 critical, 2 high, 1 moderate |
| Build-only | 16 | 1 critical, 12 high, 2 moderate, 1 low |
| Not applicable | 0 | — |

The change from 36 to 20 is an audit-database/baseline reconciliation, not evidence that 16 named findings were fixed: the historical run did not preserve the machine-readable identities required to prove a one-to-one closure.

## Runtime findings

| Package | Path | Production relevance | Decision |
|---|---|---|---|
| `protobufjs` | `onnxruntime-web → protobufjs` | Browser ONNX model loading; current lock is 7.5.4 and includes critical code-generation advisories | Open a scoped lockfile upgrade PR first |
| `@protobufjs/utf8` | `protobufjs → @protobufjs/utf8` | Same runtime chain | Remediate with `protobufjs` chain |
| `react-router-dom` | direct dependency | Production SPA navigation | Upgrade in a scoped PR with navigation regression tests |
| `react-router` | `react-router-dom → react-router` | Production SPA routing | Remediate with `react-router-dom` |

Some React Router advisories are SSR/RSC-specific and are not exercised by this Vite SPA, but the package remains runtime-relevant because the same affected version also carries client-side redirect and route-matching advisories. It is therefore not classified as wholly non-applicable.

## Build-only findings

`@babel/core`, `ajv`, `brace-expansion`, `flatted`, `form-data`, `glob`, `js-yaml`, `minimatch`, `nanoid`, `picomatch`, `postcss`, `rollup`, `vite`, `vitest`, `ws`, and `yaml` occur only in the development, lint, test, or build graph under the current lockfile.

These packages are not shipped as browser runtime dependencies. They still matter to developer and CI integrity, but they must not be presented as direct production-browser exposure. The critical `vitest` advisory requires the Vitest UI server to be listening; the repository uses `vitest run`, so it is build/test exposure rather than deployed runtime exposure.

## Remediation order

1. Upgrade the `onnxruntime-web`/`protobufjs` chain without changing model behavior.
2. Upgrade `react-router-dom` and run route, navigation, deep-link, and redirect regression tests.
3. Upgrade direct build tools (`vite`, `vitest`, `postcss`) in a separate PR.
4. Refresh transitive build-only packages through their direct parents; do not use `npm audit fix --force`.
5. Require build, Tier 1 tests, MGX safety tests, and production-branch deploy checks before promotion.

## Residual risk

Until the scoped runtime PRs land, the runtime graph retains one critical package-level finding in `protobufjs` and two high package-level findings in React Router. No dependency or deployed branch was modified during this classification.
