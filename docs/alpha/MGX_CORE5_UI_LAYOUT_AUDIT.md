# MGX Core 5 UI Layout Audit

Date: 2026-05-16

Scope:

- Badugi
- 2-7 Triple Draw
- A-5 Triple Draw
- 2-7 Single Draw
- A-5 Single Draw

This audit covers UI/layout/mobile usability only. No game progression, evaluator, routing, promotion, live RL, or model registry behavior was changed.

## Summary

| Gate | Result | Evidence |
| --- | --- | --- |
| Desktop 1440x900 / 1280x720 | PASS | `reports/alpha/core5-desktop-layout-audit.json` |
| Mobile portrait 390x844 / 430x932 | FAIL for Badugi, PASS for D01/D02/S01/S02 | `reports/alpha/core5-mobile-portrait-layout-audit.json` |
| Mobile landscape 844x390 | PASS | `reports/alpha/core5-mobile-landscape-layout-audit.json` |
| Mobile interaction/tap/result path | FAIL for Badugi portrait, PASS for D01/D02/S01/S02 and Badugi landscape | `reports/alpha/core5-mobile-interaction-audit.json` |

## Findings

| Game | Viewport | Issue | Priority | Evidence | Suggested Fix |
| ---- | -------- | ----- | -------- | -------- | ------------- |
| All Core 5 | 1280x720 desktop | Initial audit found horizontal overflow and clipped hero/action zone from fixed desktop spacing. Fixed in this sprint. | MONITOR | `reports/screenshots/core5-desktop-*.png` | Keep compact desktop spacing in visual gate. |
| 2-7 Triple Draw | 390x844 portrait | Initial audit found center pot overlapping the hero seat. Fixed in this sprint by reducing portrait hero-seat lift. | MONITOR | `reports/screenshots/core5-mobile-portrait-d01-390x844.png` | Keep pot/hero overlap assertion in portrait gate. |
| Badugi | 390x844 portrait | Game launch does not become ready within the mobile portrait audit window. | P1 | `reports/screenshots/core5-mobile-portrait-badugi-390x844-failure.png` | Keep Badugi `preview_only`; fix portrait launch/readiness before friend-alpha exposure. |
| Badugi | 430x932 portrait | Game launch does not become ready within the mobile portrait audit window. | P1 | `reports/screenshots/core5-mobile-portrait-badugi-430x932-failure.png` | Keep Badugi `preview_only`; verify after Badugi restore blocker work. |

## Per-Game Result

| Game | Desktop | Portrait | Landscape | Interaction | Friend-Alpha UI Status |
| --- | --- | --- | --- | --- | --- |
| Badugi | PASS | FAIL | PASS | FAIL portrait / PASS landscape | BLOCKED by portrait mobile readiness |
| 2-7 Triple Draw | PASS | PASS | PASS | PASS | UI PASS, rule/progression blockers still tracked separately |
| A-5 Triple Draw | PASS | PASS | PASS | PASS | UI PASS, rule/progression blockers still tracked separately |
| 2-7 Single Draw | PASS | PASS | PASS | PASS | UI PASS, rule/progression blockers still tracked separately |
| A-5 Single Draw | PASS | PASS | PASS | PASS | UI PASS, rule/progression blockers still tracked separately |

## Fixes Applied

| Area | Change | Scope |
| --- | --- | --- |
| Desktop layout | Compact desktop spacing below 1360px width: smaller side-panel gutter, grid minimum, padding, and table min-height. | UI only |
| Desktop right panel | Hide the redundant hero-hand summary on compact desktop widths where table cards are already visible. | UI only |
| Mobile portrait table | Reduce portrait hero-seat upward lift to prevent pot/hero overlap. | UI only |
| Mobile landscape table | Preserve the previous larger hero-seat lift at landscape widths to avoid bottom clipping. | UI only |

## Evidence Paths

| Artifact | Path |
| --- | --- |
| Fixture list | `reports/alpha/core5-layout-fixtures.json` |
| Desktop report | `reports/alpha/core5-desktop-layout-audit.json` |
| Portrait report | `reports/alpha/core5-mobile-portrait-layout-audit.json` |
| Landscape report | `reports/alpha/core5-mobile-landscape-layout-audit.json` |
| Interaction report | `reports/alpha/core5-mobile-interaction-audit.json` |
| Screenshots | `reports/screenshots/core5-*.png` |

Generated reports and screenshots are audit evidence and are not intended for commit.

