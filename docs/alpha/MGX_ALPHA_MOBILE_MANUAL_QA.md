# MGX Alpha Mobile Manual QA

Date: 2026-05-16

Environment: `https://mgx-poker.com/`

Method: Chrome/Playwright mobile emulation. Physical Android/iOS manual QA is still pending.

## Viewports

| Viewport | Result | Notes |
| --- | --- | --- |
| 390x844 portrait | PASS | D02 visible, Badugi disabled state visible, no horizontal overflow |
| 844x390 landscape | PASS | D02 visible, Badugi disabled state visible, no horizontal overflow |
| 430x932 portrait | PASS | D02 visible, Badugi disabled state visible, no horizontal overflow |

## Checked Items

| Item | Result |
| --- | --- |
| main menu loads | PASS |
| variant selection opens | PASS |
| alpha-playable D02 is visible | PASS |
| Badugi preview-only disabled state visible | PASS |
| status label readable | PASS |
| horizontal overflow | PASS, none observed in checked viewports |
| Learning Dashboard preview route | PASS in desktop/mobile emulation |
| replay revisit queue text | PASS |
| physical real-device QA | PENDING |
| Badugi mobile full-hand gameplay | PENDING |

## Decision

Mobile gate is acceptable for D02/S01/S02 alpha navigation. Badugi remains `preview_only` because mobile full-hand gameplay with pot/action visibility was not manually executed on a physical device.
