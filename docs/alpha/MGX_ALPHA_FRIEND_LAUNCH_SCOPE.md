# MGX Alpha Friend Launch Scope

Date: 2026-05-16

## Playable In Friend Alpha

| Variant | Why |
| ------- | --- |
| 2-7 Triple Draw | Core 5 gameplay target with mapping, actor-order, UI, and orientation audits passing. |
| A-5 Triple Draw | Conservative draw-game alpha target with core tests green. |
| 2-7 Single Draw | Conservative single-draw alpha target with core tests green. |
| A-5 Single Draw | Best current coaching/RL verified signal path. |

## Preview Only

These are hidden behind explicit preview/dev flags and are not friend-alpha selectable by default:

- Badugi
- Badeucey / Badacey / Hidugi / Archie draw variants
- Board/Omaha variants
- Stud/Razz variants
- Dramaha variants

Badugi is the most important future alpha target, but it remains preview-only until physical mobile full-hand QA passes.

## Coming Soon

| Variant | Reason |
| ------- | ------ |
| Chinese Poker / OFC | OFC street progression and fantasyland are incomplete. |

## Not Shown

No audited variant is hard-hidden yet. Unknown or unaudited variants are treated as unavailable and should not be launched in alpha.

## Release Rule

Friend alpha should prefer:

```txt
small playable list > broad broken catalog
```

Unlocking a variant requires:

1. one-hand test pass
2. no known P0 progression bug
3. no critical pot display bug
4. basic replay available
5. no mobile critical layout blocker
6. illegal/freeze zero in smoke
7. `current_bugs.md` blocker cleared

## Next Variants To Re-evaluate

1. Badugi after physical mobile full-hand QA
2. D01/D02/S01/S02 mobile manual QA
3. Stud/Razz after replay/result smoke
4. PLO/PLO8 after terminal EV and split-pot gates
