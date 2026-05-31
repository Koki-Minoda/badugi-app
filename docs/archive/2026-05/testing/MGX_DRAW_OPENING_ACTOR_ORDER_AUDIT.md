# MGX Draw Opening Actor Order Audit

Date: 2026-05-18

## Scope

Variants:

- D01 / 2-7 Triple Draw
- D02 / A-5 Triple Draw
- S01 / 2-7 Single Draw
- S02 / A-5 Single Draw

## Expected Rule

For 3 or more active seats, the opening pre-draw betting actor is the first live betting-eligible seat left of the big blind.

For 6-max with no empty seats:

```txt
BTN -> SB -> BB -> UTG -> MP -> CO
Opening action: UTG -> MP -> CO -> BTN -> SB -> BB
```

For heads-up:

```txt
BTN = SB
Opening action: BTN/SB
```

Folded, out, busted, and all-in seats are not eligible for betting action. All-in seats can remain draw/showdown/pot eligible, but must not be selected as BET actors.

## Source Of Truth

| Item | Canonical Source |
| --- | --- |
| button/dealer seat | controller snapshot `dealerIndex` |
| SB/BB seats | controller snapshot `metadata.lastBlinds` |
| opening actor | controller/engine `actingPlayerIndex`, mirrored to snapshot `turn` / `nextTurn` |
| position badges | UI adapter derived from controller `dealerIndex` and current hand seat map |
| displayed blind bets | controller snapshot player `betThisRound` / `bet` |

The UI must not derive opening action order from visual seat position. Position labels are display-only and must match the controller hand-start button/blind seat map.

## Physical Screenshot Scenario

Observed screenshot:

```txt
Variant: D01
Hero display: UTG
MP display: BET 20
Hero toCall: 20
```

If Hero is truly UTG in an unopened 6-max pot, Hero must be the first opening actor and MP cannot already have `BET 20`. That screenshot can only be valid if one of these classifications is true:

| Classification | Meaning | Release Priority |
| --- | --- | --- |
| `REAL_ACTOR_CORRUPTION` | Engine selected MP or another later seat before UTG in unopened pre-draw BET. | P0 |
| `POSITION_BADGE_DIVERGENCE` | Engine order is correct, but UI labels Hero as UTG while Hero is another position. | P1 |
| `STALE_UI_MERGE` | Controller source is correct, but stale UI/session state shows an old badge, actor, or bet. | P1/P0 depending on whether controls are interactable |
| `ACTOR_PROGRESSION_RACE` | Browser snapshot was taken after UTG acted, but UI still looked like the opening state. | P1 if confusing; P0 only if it produces illegal action controls |
| `FALSE_ALARM_CONFIRMED_BY_HISTORY` | Action history proves UTG acted or folded before MP, and badges match controller seats. | Monitor |

## Added Regression Coverage

| Test | Coverage |
| --- | --- |
| `src/games/draw/__tests__/drawOpeningActorOrderInvariant.test.js` | Verifies D01/D02/S01/S02 opening actor for every 6-max button seat, HU BTN/SB opening, D01 Hero-as-UTG setup, and MP out-of-turn rejection before UTG. |
| `src/ui/__tests__/drawOpeningActorBadgeConsistency.test.jsx` | Verifies Draw Lowball UI badges use controller `dealerIndex`, Hero-as-UTG implies Hero turn before MP, and after Hero acts MP becomes actor while Hero remains labeled UTG. |
| `tests/e2e/draw-opening-actor-regression.spec.ts` | Browser audit for D01/D02/S01/S02 opening actor and UTG badge source consistency. |
| `tests/e2e/d01-utg-skip-regression.spec.ts` | Focused D01 mobile audit that records expected actor, actual actor, blind seats, seat labels, and classification. |

## Current Classification

The added controller, UI adapter, and browser regressions pass locally. Current classification:

```txt
REAL_ACTOR_CORRUPTION: not reproduced
POSITION_BADGE_DIVERGENCE: not reproduced in local controller/UI/browser audit
STALE_UI_MERGE: not reproduced in local controller/UI/browser audit
ACTOR_PROGRESSION_RACE: not reproduced in focused D01 mobile audit
```

Evidence:

- `src/games/draw/__tests__/drawOpeningActorOrderInvariant.test.js`: PASS. D01/D02/S01/S02 opening actor is the first betting-eligible seat left of BB for every 6-max button seat, and HU opens from BTN/SB.
- `src/ui/__tests__/drawOpeningActorBadgeConsistency.test.jsx`: PASS. Hero displayed as UTG is also the controller actor before MP, and after Hero acts MP becomes the actor while labels remain stable.
- `tests/e2e/draw-opening-actor-regression.spec.ts`: PASS. D01/D02/S01/S02 browser audit reports UTG badge matching the expected opening actor.
- `tests/e2e/d01-utg-skip-regression.spec.ts`: PASS. Focused D01 mobile audit reports expected actor seat 3 and actual actor seat 3.

Physical mobile remains the deciding evidence for the originally observed screenshot because the local/browser audit did not reproduce an illegal source-of-truth state. If it reproduces, export the `?mgxQa=mobile` report and compare controller `dealerIndex`, `metadata.lastBlinds`, `turn` / `nextTurn`, displayed badge, displayed bet, and the action-history row immediately before MP shows `BET 20`.
