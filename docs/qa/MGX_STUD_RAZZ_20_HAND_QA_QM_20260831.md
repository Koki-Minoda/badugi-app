# MGX Stud / Razz 20-hand QA/QM — 2026-08-31

## Scope

- Six-max Stud 8 or Better (`ST2` / `stud8`)
- Six-max Razz (`ST3` / `razz`)
- Mobile portrait: 390 x 844 (Stud 8 or Better)
- Mobile landscape: 844 x 390 (Razz)
- Local branch: `codex/stud-razz-ui`

## Acceptance gates

1. Twenty consecutive hands complete for each variant without a frozen state.
2. Every browser hand visits Third, Fourth, Fifth, Sixth, Seventh, and Showdown.
3. Every deterministic hand reaches Showdown and passes enforced strict settlement.
4. Pot payout and total-chip conservation remain valid.
5. Third-street and seventh-street cards remain inside all six player panels.
6. Hero down-cards are rendered fully face-up without a partial card-back overlay.

## Results

| Gate | Stud 8 or Better | Razz | Result |
|---|---:|---:|---|
| Deterministic six-max progression | 20 / 20 | 20 / 20 | PASS |
| Strict settlement | 20 / 20 | 20 / 20 | PASS |
| Browser hand completion | 20 / 20 | 20 / 20 | PASS |
| Complete Third-to-Showdown street path | 20 / 20 | 20 / 20 | PASS |
| Mobile card containment (Third and Seventh) | PASS | PASS | PASS |
| Hero face-up card rendering | PASS | PASS | PASS |

Total exercised: 40 deterministic hands plus 40 browser hands.

Focused Stud-family regression suite: 49 / 49 tests passed.
Focused browser suite: 4 / 4 tests passed in 1.9 minutes.

## Verdict

Local QA/QM gate: **PASS**.

This run validates the local engine and browser UI with isolated local authentication. It does not replace live deployment verification or physical iPhone/Android QA.
