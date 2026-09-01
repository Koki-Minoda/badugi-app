# MGX Stud / Razz 20-hand QA/QM — 2026-08-31

## Scope

- Six-max Stud 8 or Better (`ST2` / `stud8`)
- Six-max Razz (`ST3` / `razz`)
- Desktop Chromium: 1440 x 900, then 1280 x 720
- Android Chromium: 412 x 915, then 915 x 412
- iPhone WebKit: 390 x 844, then 844 x 390
- Integration branches: `codex/stud-razz-ui`, `codex/mgx-weekly-1-6`

## Acceptance gates

1. Twenty consecutive hands complete for each variant without a frozen state.
2. Every browser hand visits Third, Fourth, Fifth, Sixth, Seventh, and Showdown.
3. Every deterministic hand reaches Showdown and passes enforced strict settlement.
4. Pot payout and total-chip conservation remain valid.
5. Third-street and seventh-street cards remain inside all six player panels.
6. Hero down-cards are rendered fully face-up without a partial card-back overlay.
7. Every device completes Hero turns through visible, enabled production action buttons.
8. Portrait-to-landscape changes produce no horizontal document overflow.

## Results

| Gate | Stud 8 or Better | Razz | Result |
|---|---:|---:|---|
| Deterministic six-max progression | 20 / 20 | 20 / 20 | PASS |
| Strict settlement | 20 / 20 | 20 / 20 | PASS |
| Desktop Chromium browser hands | 20 / 20 | 20 / 20 | PASS |
| Android Chromium browser hands | 20 / 20 | 20 / 20 | PASS |
| iPhone WebKit browser hands | 20 / 20 | 20 / 20 | PASS |
| Complete Third-to-Showdown street path | 20 / 20 | 20 / 20 | PASS |
| Mobile card containment (Third and Seventh) | PASS | PASS | PASS |
| Hero face-up card rendering | PASS | PASS | PASS |
| Real Hero action buttons and Next Hand | PASS | PASS | PASS |
| Portrait/landscape horizontal overflow | 0 | 0 | PASS |

Total exercised: 40 deterministic hands plus 120 device-browser hands.

Focused Stud-family regression suite: 49 / 49 tests passed.
Focused browser suite: 12 / 12 tests passed across Desktop Chromium, Android
Chromium, and iPhone WebKit.

## Verdict

Local QA/QM gate: **PASS**.

This run validates the local engine and browser UI with isolated local
authentication. Live deployment verification remains required; physical-device
coverage is tracked separately from the required browser-engine/device-emulation
gate.
