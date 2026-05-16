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
| Mobile portrait 390x844 / 430x932 | PASS | `reports/alpha/core5-mobile-portrait-layout-audit.json`; `reports/alpha/badugi-portrait-mobile-layout-audit.json` |
| Mobile landscape 844x390 | PASS | `reports/alpha/core5-mobile-landscape-layout-audit.json` |
| Mobile interaction/tap/result path | PASS | `reports/alpha/core5-mobile-interaction-audit.json`; `reports/alpha/badugi-portrait-mobile-layout-audit.json` |
| Mobile tournament portrait 390x844 / 430x932 | PASS | `reports/alpha/core5-mobile-tournament-portrait-layout.json`; `reports/alpha/core5-mobile-tournament-layout-regression.json` |
| Mobile tournament landscape 844x390 / 932x430 | PASS | `reports/alpha/core5-mobile-tournament-landscape-layout.json`; `reports/alpha/core5-mobile-tournament-layout-regression.json` |

## Findings

| Game | Viewport | Issue | Priority | Evidence | Suggested Fix |
| ---- | -------- | ----- | -------- | -------- | ------------- |
| All Core 5 | 1280x720 desktop | Initial audit found horizontal overflow and clipped hero/action zone from fixed desktop spacing. Fixed in this sprint. | MONITOR | `reports/screenshots/core5-desktop-*.png` | Keep compact desktop spacing in visual gate. |
| 2-7 Triple Draw | 390x844 portrait | Initial audit found center pot overlapping the hero seat. Fixed in this sprint by reducing portrait hero-seat lift. | MONITOR | `reports/screenshots/core5-mobile-portrait-d01-390x844.png` | Keep pot/hero overlap assertion in portrait gate. |
| Badugi | 390x844 portrait | Initial audit was blocked by the mobile orientation gate. Step6 permits single-table Badugi portrait launch and the visual/result-flow regression now passes. | MONITOR | before: `reports/screenshots/core5-mobile-portrait-badugi-390x844-failure.png`; after: `reports/screenshots/badugi-portrait-mobile-390x844.png` | Badugi is now in alpha scope; monitor physical mobile behavior. |
| Badugi | 430x932 portrait | Initial audit was blocked by the mobile orientation gate. Step6 permits single-table Badugi portrait launch and the visual/result-flow regression now passes. | MONITOR | before: `reports/screenshots/core5-mobile-portrait-badugi-430x932-failure.png`; after: `reports/screenshots/badugi-portrait-mobile-430x932.png` | Badugi is now in alpha scope; monitor physical mobile behavior. |
| All Core 5 | tournament mobile portrait | Real-device/browser audit showed tournament HUD consuming the screen, collapsed table area, pot mispositioning, and clipped action controls. Fixed by adding a mobile tournament compact HUD and density mode. | MONITOR | before: `reports/screenshots/core5-mobile-tournament-before-*.png`; after: `reports/screenshots/core5-mobile-tournament-portrait-*.png` | Keep mobile tournament regression gate in alpha validation. |
| All Core 5 | tournament mobile landscape | Real-device/browser audit showed oversized player panels/cards, hero clipping, pot/table collisions, and a tall right-side HUD. Fixed with compact tournament side HUD, smaller mobile tournament cards/panels, and preserved table width. | MONITOR | before: `reports/screenshots/core5-mobile-tournament-before-*.png`; after: `reports/screenshots/core5-mobile-tournament-landscape-*.png` | Keep 844x390 and 932x430 landscape tournament gates. |

## Per-Game Result

| Game | Desktop | Portrait | Landscape | Interaction | Friend-Alpha UI Status |
| --- | --- | --- | --- | --- | --- |
| Badugi | PASS | PASS | PASS | PASS | UI PASS; alpha scope with physical mobile monitoring |
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
| Badugi portrait orientation | Allow single-table Badugi to bypass the mobile landscape-only orientation gate, matching draw-lowball portrait behavior. | UI only |
| Mobile tournament HUD | Add compact mobile HUD rendering that hides the large payout block and keeps level, blinds, players, hands, prize, and variant summary visible. | UI only |
| Mobile tournament table density | Reduce card, avatar, player panel, and spacing variables only under the mobile tournament wrapper. | UI only |
| Mobile tournament controls | Compact phase/action context panels so action buttons and Fold remain inside portrait and landscape viewports. | UI only |

## Evidence Paths

| Artifact | Path |
| --- | --- |
| Fixture list | `reports/alpha/core5-layout-fixtures.json` |
| Desktop report | `reports/alpha/core5-desktop-layout-audit.json` |
| Portrait report | `reports/alpha/core5-mobile-portrait-layout-audit.json` |
| Badugi portrait report | `reports/alpha/badugi-portrait-mobile-layout-audit.json` |
| Landscape report | `reports/alpha/core5-mobile-landscape-layout-audit.json` |
| Interaction report | `reports/alpha/core5-mobile-interaction-audit.json` |
| Tournament regression report | `reports/alpha/core5-mobile-tournament-layout-regression.json` |
| Tournament portrait report | `reports/alpha/core5-mobile-tournament-portrait-layout.json` |
| Tournament landscape report | `reports/alpha/core5-mobile-tournament-landscape-layout.json` |
| Screenshots | `reports/screenshots/core5-*.png` |

Generated reports and screenshots are audit evidence and are not intended for commit.
