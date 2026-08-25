# MGX Alpha Test Coverage Gap Audit

Date: 2026-05-16

## Summary

The immediate Badugi alpha P0 coverage gap is closed. The suite now covers:

- browser full 3-draw progression to `Hand Result`
- active-hand pot continuity through bet/draw transitions
- Badugi-specific snapshot pot merge behavior
- stale turn metadata losing to canonical controller turn
- no-next-alive actor election after checked/folded/all-in seats

Badugi remains `preview_only` because preview URL manual QA and real mobile QA are still pending.

## Coverage Matrix

| Bug/Risk | Existing Test | Covered? | Gap | New Test Needed |
| --- | --- | --- | --- | --- |
| full 3 draw path naturally reaches showdown | `tests/e2e/badugi-flow.spec.ts` full 3-draw | yes | keep preview flag setup explicit because Badugi is not alpha-playable | keep this Playwright test in every alpha deploy gate |
| pot remains visible through bet/draw/showdown | `tests/e2e/badugi-full-round-pot-regression.spec.ts` | yes | no real-device visual confirmation yet | mobile/manual preview replay of the same scenario |
| UI snapshot merge must not drop pot | `src/ui/__tests__/badugiPotSnapshotMerge.test.jsx` | yes | broader split/side-pot live browser case still open | add side-pot browser smoke later |
| action bar / actingPlayerIndex cannot stale override controller turn | `src/ui/__tests__/badugiTurnSnapshotMerge.test.jsx` | yes | only focused fixture coverage | keep browser flow plus targeted unit test together |
| no-next-alive actor election | `src/games/badugi/__tests__/badugiNoNextAliveRegression.test.js` | yes | broader all-in/fold mixes are covered elsewhere but should stay monitored | add long-run CPU naturalness after preview deploy |
| next hand pot reset | existing consecutive-hand E2E + pot regression | partial | reset is covered, but not in the new pot regression spec | add explicit next-hand reset assertion if this reappears |
| mobile pot/action visibility | mobile landscape smoke | partial | mobile tests check controls visibility, not this specific fixed pot/phase path | add mobile viewport pot/action/sidebar assertion |
| CPU natural progression reaches Draw#1-#3 | Badugi full-flow Playwright | yes for targeted path | not a long-run statistical browser smoke | add long-run no-hook smoke after deploy candidate is clean |
| all-in transition | Badugi E2E all-in tests | mostly covered | not the current primary suspect | keep in gate |

## Why Existing Tests Missed It

1. Controller/unit tests validate engine state transitions without the full App snapshot merge path.
2. EV/pot tests validate settlement and chip conservation, not browser-visible pot during each active street.
3. UI adapter tests had static snapshots but lacked a transition case where street bets reset while `totalInvested` still carried the active-hand pot.
4. The browser full-flow test existed but was not part of the earlier minimum alpha deploy test list.
5. Mobile smoke tests focus on control availability, not pot/phase continuity.

## Added Alpha Gate Tests

| Priority | Test |
| --- | --- |
| P0 | `tests/e2e/badugi-flow.spec.ts` full 3-draw flow with preview variant flag |
| P0 | `tests/e2e/badugi-full-round-pot-regression.spec.ts` active-hand pot continuity |
| P0 | `src/ui/__tests__/badugiPotSnapshotMerge.test.jsx` non-zero active pot merge |
| P0 | `src/ui/__tests__/badugiTurnSnapshotMerge.test.jsx` canonical turn priority |
| P1 | `src/games/badugi/__tests__/badugiNoNextAliveRegression.test.js` no-next-alive progression |

## Remaining Gaps

| Gap | Priority | Next Action |
| --- | --- | --- |
| real mobile touch/orientation QA | P1 | run preview URL on physical mobile before opening Badugi to friends |
| clean deploy snapshot | P1 | remove or commit unrelated Step59-65 files before preview deploy |
| side-pot browser pot continuity | P2 | add after core alpha deploy path is stable |
| long-run natural browser smoke | P2 | run once preview infra is clean |
