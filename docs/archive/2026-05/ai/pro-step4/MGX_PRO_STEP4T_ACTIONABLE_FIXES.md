# MGX Pro Step4-T Actionable Fixes

| Variant | Leak Type | Candidate Fix | Expected Risk | Expected EV Gain |
| --- | --- | --- | --- | --- |
| `S02` | `premiumSDA5` underraise on safe post-draw pressure | Add a very narrow `CALL -> RAISE` upgrade for `premiumSDA5` in `3way` small/medium pressure spots only | low to medium; can overdo value if expanded beyond safe pressure | small but real; this is directly aligned with the remaining S02 value gap |
| `S02` | `strongSDA5` overfold / underraise in sparse good-hand spots | Allow a tiny thin-value raise bucket for `strongSDA5` only in heads-up / `3way` safe pressure, not `4way+` | medium; easy to reintroduce Step4-M style overreach | small; candidate only because weak/trash leaks are already solved |
| `S02` | `upperMediumSDA5` thin value boundary | Only revisit if a concrete repeated `CHECK/CALL` vs Standard `BET` bucket appears in longer-sample mining | low if left alone, medium if guessed | currently uncertain |
| `S01` | `strongSD27` sparse overfold on top-end post-draw pressure | Add a narrow top-end `CALL` retention rule for `strongSD27` late street pressure, but only after longer-sample confirmation | medium; 2-7 penalty logic is easier to destabilize | small to medium |
| `D02` | residual `strongA5` repeated-pressure defense | Do not guess again from 100-hand aggregate. Revisit only with longer-sample repeated-pressure traces or explicit bucket replay tooling | low if deferred | currently uncertain |

## Heuristic-Friendly

- `S02 premiumSDA5` and `strongSDA5` safe-pressure raise spots are still the cleanest heuristic candidates.
- `S01 strongSD27` top-end post-draw pressure is the next clean candidate.

## Heuristic-Unfriendly

| Variant | Leak Type | Why Heuristics Are Weak Here |
| --- | --- | --- |
| `S02` | `trashSDA5` / `weakSDA5` multiway `FOLD` vs Standard `CALL` | extremely frequent but high-variance, and it directly conflicts with the guard that fixed the structural leak |
| `S01` | `trashSD27` / `weakSD27` multiway `FOLD` vs Standard `CALL` | same issue as S02; likely seat/noise dominated rather than a clean policy edge |
| `D02` | `trashA5` multiway `FOLD` vs Standard `CALL` | sign flips by seed and position; not a safe deterministic rule candidate |

## Next Infrastructure Work

- add longer-sample divergence runs for a single target variant without changing heuristics
- add replay tooling for one divergence row so the same snapshot can be re-scored under both actions
- promote sparse good-hand divergence rows into explicit candidate fixtures before changing strategy logic
