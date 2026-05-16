# MGX Triple Draw Variant Rule Mapping Audit

Date: 2026-05-16

## Result

No A-5 / 2-7 rule mapping mix was found. No Single Draw / Triple Draw mapping mix was found.

The important correction from the mobile QA suspicion is:

```txt
S02 = A-5 Single Draw
D02 = A-5 Triple Draw
```

So an issue observed in S02 should be treated as an A-5 Single Draw issue, not an A-5 Triple Draw issue.

## Mapping Table

| variantId | displayName | drawCount | lowballRule | firstBettingActorRule | status |
| --------- | ----------- | --------: | ----------- | --------------------- | ------ |
| `D01` | 2-7 Triple Draw | 3 | 2-7 | 3+ pre-draw left of BB; HU pre-draw BTN/SB; post-draw first active left of BTN | Preview / D01 excluded from RL teacher paths |
| `D02` | A-5 Triple Draw | 3 | A-5 | 3+ pre-draw left of BB; HU pre-draw BTN/SB; post-draw first active left of BTN | Alpha candidate |
| `S01` | 2-7 Single Draw | 1 | 2-7 | 3+ pre-draw left of BB; HU pre-draw BTN/SB; post-draw first active left of BTN | Alpha candidate |
| `S02` | A-5 Single Draw | 1 | A-5 | 3+ pre-draw left of BB; HU pre-draw BTN/SB; post-draw first active left of BTN | Alpha candidate |

## Audit Notes

- `D02`, `S01`, and `S02` remain the friend-alpha candidate draw variants.
- `D01` remains excluded from Iron teacher / RL signal counts and is not part of friend-alpha exposure.
- The six-max / five-max / three-way pre-draw actor rule is covered in `src/games/draw/__tests__/tripleDrawFirstActorRegression.test.js`.
- Browser E2E may auto-advance CPU actors before the initial first actor can be observed. The browser audit therefore records exact matches when the initial state is still visible and `PASS_WITH_AUTO_ADVANCE` when CPU action has already advanced without pot / turn contradictions.
