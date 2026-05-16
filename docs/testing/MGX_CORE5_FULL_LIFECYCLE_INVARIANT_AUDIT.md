# MGX Core5 Full Lifecycle Invariant Audit

Date: 2026-05-17

## Decision

`LOCAL_AUTOMATED_PASS_LIVE_AND_PHYSICAL_PENDING`

The Core5 lifecycle invariant harness passes locally for both Cash and Tournament modes. The release gate is still not a friend-alpha GO because live deploy evidence, live tournament runtime, remote sync, and physical mobile QA remain separate blockers.

## Gate Matrix

| Gate | Status | Evidence |
|---|---|---|
| Shared hand invariant framework | PASS | actor, betting, action-reopen, pot, draw, terminal, and snapshot assertions installed and unit-tested |
| Cash lifecycle synthetic sweep | PASS | 6,000 hands / 60 sessions / 0 violations |
| Tournament lifecycle synthetic sweep | PASS | 1,200 tournaments / 0 violations |
| Cash browser lifecycle gate | PASS | `core5-cash-full-lifecycle-gate.spec.ts`: 5/5 variants PASS |
| Tournament browser lifecycle gate | PASS | `core5-tournament-full-lifecycle-gate.spec.ts`: 5/5 variants PASS |
| Individual Cash lifecycle E2E | PASS | 25/25 checks PASS |
| Individual Tournament lifecycle E2E | PASS | 30/30 checks PASS |
| Build/game/AI/RL baseline | PASS | build, one-hand, EV, iron/pro AI, and RL safety tests pass |

## Release Rule

If either Cash or Tournament is unverified, Core5 release gate is FAIL.

For this local automated gate, Cash and Tournament are both verified and pass. For friend alpha, this result is necessary but not sufficient: live URL evidence and physical mobile QA remain required.

## Remaining Non-Local Gates

| Blocker | Status |
|---|---|
| Live deploy snapshot | HOLD, live build differs from local branch |
| Live D01/D02/S01/S02 tournament runtime | HOLD, previous live evidence recorded `applyPlayerAction is not a function` |
| Badugi raise/call closure live verification | HOLD, local regression passes but deployed live proof is still required |
| Physical mobile QA | HOLD, no real Android/iPhone run in this environment |
| Remote push/sync | HOLD, branch is still local-ahead until pushed from credentialed environment |
