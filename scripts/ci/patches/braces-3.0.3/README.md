# Temporary braces depth protection

Date: 2026-10-05. Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

`braces@3.0.3` is a development dependency of Tailwind 3 (through chokidar,
micromatch and fast-glob). No patched npm release is available as of this date.
Deeply nested patterns below the input length limit can overflow the recursive
AST walkers. Removing development dependencies from the audit would hide the
finding, and a Tailwind 4 migration would unnecessarily change application CSS.

`depth-limit.patch` backports only the five `lib/` diffs from
[upstream PR #72](https://github.com/micromatch/braces/pull/72), head
`28d440b5dd449dbf1fe6f3506cf94ecca4d02660`, onto the exact published 3.0.3
source. Unrelated unreleased quote/range parsing changes are excluded. The MIT
license is retained here. This patch is not represented as an upstream release.

The parser caps brace and parenthesis nesting at 100, including when callers
request a higher maximum. Compile, expand and stringify also check depth for
caller-supplied ASTs. Expansion rejects cyclic parent chains.

`npm ci` applies the patch through the root postinstall script. Installation
verifies all original JavaScript source hashes before applying it and all
patched hashes afterward. Reapplying is idempotent; partial or unexpected
sources fail closed. The lockfile still truthfully records version 3.0.3.

The OSV gate still reports this advisory. It accepts this exact remediation
only after verifying every installed 3.0.3 copy and running the adversarial
tests. Missing install scripts, changed files, another version, or any other
advisory fail the gate. Plain `npm audit` still reports the registry finding
because it cannot inspect local source patches; do not claim a clean registry
audit. Production dependency scanning remains unchanged.

Verification on 2026-10-05:

- Regression tests fail against unpatched 3.0.3 and pass with the patch.
- Depth 100 succeeds; 101/3500/4000 are rejected for all public entry points,
  including excessive/Infinity options and caller-supplied deep ASTs.
- Source tampering and unpatched copies are rejected; application is idempotent.
- Original 3.0.3 test suite plus the retained stringify regression: 766 pass.
- MGX production build passes, emitting the same `index-uPAQFqnq.css` as before.

Remove this patch, postinstall hook, special remediation check and associated
tests when a fixed upstream version is available, then run both dependency
audits and normal build/browser gates. Do not extend this mechanism to unrelated
advisories without a separately reviewed source remediation.
