# MGX Badugi Release Readiness

Status: `BADUGI_BLOCKED_BY_POT_BUG`

Date: 2026-05-16

Scope: Badugi gameplay progression and rule correctness. Mobile layout is not used as a decision reason in this Step1 audit.

## Decision

| Gate | Result |
| --- | --- |
| Rule spec documented | PASS |
| Implementation mapping documented | PASS |
| Existing coverage audited | PASS |
| Focused betting-order tests | PASS |
| Focused draw progression tests | PASS |
| Focused pot continuity tests | PASS |
| Focused showdown / next hand tests | PASS |
| Focused browser progression | PASS |
| Full Badugi browser suite | BLOCKED |
| Long-run browser restore | BLOCKED |
| Release decision | `BADUGI_BLOCKED_BY_POT_BUG` |

## Why Badugi Is Not Release-Ready Yet

The focused rule/progression path is covered, but Badugi still has a known long-run browser restore blocker:

- Active-hand `Total Pot 0` can still surface in the long-run restore smoke.
- Terminal transition / next-hand sequencing can mismatch in the broader five-hand browser path.
- The long-run gate is intentionally marked expected-fail until this is fixed.
- The full `badugi-flow.spec.ts` suite also has three remaining fold-event logging assertions. Focused progression/pot gates pass, but release readiness still requires this browser evidence to be green.

Badugi must remain `preview_only`; this audit does not restore it to `alpha_playable`.

## Evidence

| Area | Evidence |
| --- | --- |
| Spec | `docs/rules/MGX_BADUGI_GAME_PROGRESSION_SPEC.md` |
| Mapping | `docs/alpha/MGX_BADUGI_IMPLEMENTATION_MAPPING_AUDIT.md` |
| Coverage | `docs/testing/MGX_BADUGI_TEST_COVERAGE_AUDIT.md` |
| Audit script | `src/games/badugi/auditBadugiProgressionRules.js` |
| Unit tests | `src/games/badugi/__tests__/badugi*Spec.test.js` |
| UI merge test | `src/ui/__tests__/badugiSnapshotMergeSpec.test.jsx` |
| Browser focused spec | `tests/e2e/badugi-progression-spec.spec.ts` |
| Full browser suite blocker | `tests/e2e/badugi-flow.spec.ts` |
| Known blocker | `tests/e2e/badugi-alpha-long-run-smoke.spec.ts` |

## Next Recommendation

Fix the long-run active-pot / terminal-transition mismatch before any alpha-playable Badugi decision. The next investigation should log controller snapshot pot, UI rendered pot, `lastHandResult`, `phase`, `turn`, `nextTurn`, and next-hand reset timing across at least five consecutive Badugi hands.
