# MGX Single Draw Pot Semantics

Scope: S01 and S02.

Single Draw uses an effective active-hand pot for UI/release snapshots:

```txt
snapshot.pot = settled pots + current street commitments
```

This means blind-posted commitments are visible immediately after hand start, even before the first betting round has been settled into an internal pot object.

Required behavior:

- After blinds are posted, `snapshot.pot` is nonzero.
- In the default HU structure `{ sb: 10, bb: 20 }`, initial `snapshot.pot` is `30`.
- `snapshot.players[*].betThisRound` reflects blind commitments during the active betting street.
- Draw/bet transitions preserve the effective active-hand pot.
- Terminal/result snapshots may clear active street commitments while `lastHandResult.pot` carries the awarded amount.
- Starting the next hand must not leak the prior hand's terminal pot; it starts with a fresh blind-posted effective pot.

Regression coverage:

- `src/games/draw/__tests__/singleDrawPotContinuitySpec.test.js`
- `src/games/draw/__tests__/singleDrawShowdownNextHandSpec.test.js`
- `src/ui/__tests__/singleDrawPotSnapshotRegression.test.jsx`
