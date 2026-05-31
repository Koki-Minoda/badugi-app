# MGX Pro Step4-X Stable Bucket Fixes

| Bucket | Before Action | After Action | Replay Result | Aggregate Impact | Safety |
| ------ | ------------- | ------------ | ------------- | ---------------- | ------ |
| `D02 strongA5 second-pressure` | `FOLD` in safe second-pressure spots | allow `RAISE`, else `CALL`, only when `drawRound > 0`, `drawRound <= 2`, `small/medium`, `toCall <= 20`, no `facingRaise`, not `4way+`, not expensive | `meanDelta` stays `-267.50` on the stable `FOLD` vs `RAISE` corpus | targeted gap moves from `-6.80` to `-7.89`; full-suite stays `-11.53` | PASS |
| `S01 strongSD27 top-end pressure` | `FOLD` on some safe medium-pressure early spots | retain `CALL` for `upperStrongSD27` under safe medium pressure, still no new `RAISE` | `meanDelta` stays `-57.91` on the stable `FOLD` vs `CALL` corpus | targeted gap improves from `-11.09` to `-10.17`; full-suite stays `-14.00` | PASS |

## Safety Locks Preserved

- `trash/weak/lower-medium` guards remain active
- `S02` unchanged
- `fallback = 0.0000`
- `illegal / freeze / EV fail = 0`

## Interpretation

These fixes were worth testing because Step4-W marked them as stable replay-backed buckets. They were safe to ship, but Step4-X shows that the remaining EV gap is no longer responsive to tiny rule edits alone.
