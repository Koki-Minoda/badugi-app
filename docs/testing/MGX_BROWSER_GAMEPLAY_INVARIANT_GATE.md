# MGX Browser Gameplay Invariant Gate

Date: 2026-05-17

## Scope

The Browser Gameplay Invariant gate compares browser-visible controller state with UI state for Core5 gameplay:

| Dimension | Scope |
|---|---|
| Variants | Badugi, D01, D02, S01, S02 |
| Modes | Cash, Tournament |
| Viewports | 1280x720 desktop, 390x844 portrait, 844x390 landscape |
| Required evidence | per-action trace, invariant summary, failure JSON, failure screenshots |

## Required Invariants

| Invariant | Release Requirement |
|---|---|
| Actor order | `controller.actorSeat` equals expected actor for the current street, folded/all-in seats skipped |
| Action reopen | a player cannot act twice in the same betting round unless another player re-raised |
| Betting closure | if no player needs action, actor is cleared and the street transitions |
| Pot | browser controller pot and displayed pot stay aligned; active-hand pot is not zero after investment |
| Phase | displayed phase matches controller phase/draw round |
| Terminal | result state clears actor, hides controls, shows result/next hand |
| UI/controller divergence | no stale actor, stale pot, stale phase, or stale Hero controls |

## Commands

```bash
node scripts/run-browser-gameplay-invariant-soak.js --hands=10 --variants=badugi,D01,D02,S01,S02 --modes=cash,tournament --viewports=desktop,portrait,landscape
npx playwright test tests/e2e/badugi-browser-raise-call-reopen-regression.spec.ts --project=badugi-flow
```

## Release Rule

Friend alpha remains HOLD if any P0 browser gameplay invariant violation exists. A local fixture/lifecycle pass is not enough to override this gate.

## Fix Ladder Status

| Stage | Requirement | Current Status |
|---|---|---|
| Badugi cash desktop 1 hand | P0 = 0 | PASS |
| Badugi cash desktop 10 hands | invariant violations = 0, no freeze | PASS |
| Badugi cash desktop 100 hands | invariant violations = 0, no freeze | FAIL/HALT at hand 16 |
| Badugi full browser matrix | cash/tournament x desktop/portrait/landscape | BLOCKED until 100-hand cash desktop passes |
| Core5 browser smoke matrix | Core5 x cash/tournament x desktop | BLOCKED until Badugi 100-hand passes |
| Core5 full browser matrix | Core5 x cash/tournament x desktop/portrait/landscape | BLOCKED |
