# MGX Stud-family public readiness (2026-09-01)

## Scope

This gate covers every Stud-family variant offered by MGX:

- Seven Card Stud (`stud`)
- Seven Card Stud Hi-Lo (`stud-hilo`)
- Razz (`razz`)
- Badugi Stud (`badugi-stud`)
- A-5 Triple Draw Stud (`a5-triple-draw-stud`)
- 2-7 Triple Draw Stud (`27-triple-draw-stud`)

## Product fixes made during the gate

- Seven-card hands are constrained by the seat width, preventing the last card from overflowing the table on compact screens.
- Cash results now remain visible until the player presses **Next Hand**; the five-second automatic transition is tournament-only.
- Hand history records the authoritative post-action controller snapshot. Replay therefore preserves every player's cards, chips, pot, action order, and street even when React rendering state is one update behind.
- Sparse legacy history events no longer erase cards that were already dealt.

## Dedicated three-device gate

Command: `npm run test:qm:stud-razz-devices`

Result: **PASS, 36/36 scenarios**.

| Target | Stud8 hands | Razz hands | Other four variants | Total |
|---|---:|---:|---:|---:|
| Desktop Chromium | 20 | 20 | 10 each | 80 |
| Android Chromium | 20 | 20 | 10 each | 80 |
| iPhone WebKit | 20 | 20 | 10 each | 80 |
| **Total** | **60** | **60** | **120** | **240** |

Every hand checks the real Hero action controls, bring-in, Third through Seventh Street and showdown, card containment, horizontal overflow, settlement, history, and deterministic replay. Stud8 and Razz receive the longer 20-hand run requested for the release gate.

## Settlement and regression gates

- All six variants pass independent multi-way all-in and side-pot settlement checks.
- Stud8 split-pot eligibility, payout totals, and chip conservation are enforced.
- `test:game:progress`: 172/172 PASS.
- `test:game:ev`: 65/65 PASS.
- Tier 1: 309 files / 2,187 tests PASS.
- Tier 2: 78 files / 165 tests PASS.
- Production build and lint PASS.

## Common public-cash gate

The complete public manifest was then exercised through the ordinary signed-in game-selection path on Desktop Chromium and Android Chromium. All 12 public variants completed 10 real-button hands per device: **24/24 cases and 240/240 hands PASS** in one uninterrupted 26.7-minute run. The generated summary reports `Core5 cash QM PASS: 24/24 cases`.

For the six Stud-family variants this adds 120 hands to the dedicated 240-hand device gate. Total Stud-family evidence before merge is therefore **360 completed hands**, while the full release run covers **480 completed hands** including the existing public games.

## Release rule

The six variants may appear in the public game list only while the dedicated three-device gate and the common public-cash gate remain green. The post-deploy run must repeat the device gate against `https://mgx-poker.com` before the release is considered complete.
