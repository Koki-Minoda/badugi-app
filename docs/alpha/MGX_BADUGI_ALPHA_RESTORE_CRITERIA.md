# MGX Badugi Alpha Restore Criteria

Date: 2026-05-16

## Decision Gate

Badugi can return to `alpha_playable` only when every restore criterion below is green. If any P0 appears, Badugi remains `preview_only`.

| Criterion | Result | Evidence |
| --- | --- | --- |
| full 3-draw browser flow | PASS | `tests/e2e/badugi-flow.spec.ts` focused regression |
| pot continuity focused regression | PASS | `tests/e2e/badugi-full-round-pot-regression.spec.ts` |
| Hand Result reached | PASS | focused full 3-draw regression |
| next hand | PASS | focused full 3-draw regression |
| no active-hand Total Pot 0 | FAIL in long-run restore gate | `tests/e2e/badugi-alpha-long-run-smoke.spec.ts` expected-fail blocker |
| no stale ACTING after hero action | PASS in focused turn merge tests; monitor in long-run | `src/ui/__tests__/badugiTurnSnapshotMerge.test.jsx` |
| no phase label mismatch | WARN | long-run restore gate still exposes terminal/phase mismatch symptoms |
| mobile emulation portrait | FAIL | 390x844 and 430x932 Badugi preview launch readiness expected-fail |
| mobile emulation landscape | PASS | 844x390 Badugi mobile restore gate |
| physical mobile checklist ready | READY / not executed | `docs/alpha/MGX_BADUGI_MANUAL_QA_CHECKLIST.md` |
| known P0 none | FAIL for Badugi restore | long-run active-pot/terminal mismatch and portrait launch readiness remain open |

## Required Before Reclassification

1. Make `tests/e2e/badugi-alpha-long-run-smoke.spec.ts` pass without `test.fail`.
2. Make 390x844 and 430x932 portrait cases in `tests/e2e/badugi-mobile-gameplay-layout.spec.ts` pass without `test.fail`.
3. Confirm one physical mobile device can complete a Badugi full hand with pot/action/phase visible.
4. Keep D02/S01/S02 alpha availability unchanged while Badugi remains gated.
