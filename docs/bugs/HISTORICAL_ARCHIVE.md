# Historical Archive

Last updated: 2026-05-21

This is a readable high-level archive of permanently resolved historical regressions that used to make `current_bugs.md` hard to scan.

Do not delete or replace `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md`; that ledger remains the detailed source of tests, files, and verification history. This archive is only the release-facing summary.

Summary:
- Historical archive groups: 6
- Primary `current_bugs.md` table rows moved here: 0
- Detailed ledger retained: `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md`

| Historical group | Root cause summary | Regression tests / evidence | Current status |
|---|---|---|---|
| SB fold / next actor freeze | Betting actor election did not always advance from folded SB to the next eligible seat. | `ACTION-001`, `TURN-001`, `gameProgressKnownBugs.test.js`; Badugi flow specs. | Resolved; monitored through known-bugs and actor gates. |
| Stale metadata actor override | Stale `metadata.actingPlayerIndex` could override canonical controller turn. | `ACTION-004`, `TURN-006`, Badugi turn snapshot merge tests. | Resolved; stale actor checks remain in release gates. |
| All-in illegal actor election | All-in seats could be selected for betting action or block terminal progression. | `TURN-004`, `ALLIN-001/002/003`, EV and progress regression suites. | Resolved; all-in actor eligibility remains monitored. |
| Draw rollback / hand rollback after exchange | Older draw snapshots could restore previous draw round or hand cards after an exchange. | `DRAW-SOT-001` through `DRAW-SOT-014`; draw source-of-truth docs. | Resolved; draw SOT tests remain in known-bugs gate. |
| Single-pot side-pot duplication and pot display regressions | Single-pot terminal/result views could render fake side-pot blocks or active-hand pot zero. | `BG-003`, Badugi pot snapshot merge, pot continuity tests. | Resolved; pot continuity remains a release gate. |
| Result overlay / next-hand recovery | Result overlay could hide next-hand recovery or leave stale turn after terminal. | `BG-004`, terminal snapshot merge, browser lifecycle gates. | Resolved; next-hand and terminal stale-turn checks remain in release gates. |

## Ledger Cross-Reference

The full detailed ledger still contains:
- `ACTION-*`
- `TURN-*`
- `ALLIN-*`
- `DRAW-*`
- `DRAW-SOT-*`
- `BG-*`
- `MTT-*`
- `E2E-GUARD-*`
- `EV-GUARD-*`
- replay/feedback/mixed-rotation/cap/stud/Chinese family items

Use `docs/testing/MGX_GAME_PROGRESS_BUGFIX_LEDGER.md` for exact source files, commands, and verification logs.
