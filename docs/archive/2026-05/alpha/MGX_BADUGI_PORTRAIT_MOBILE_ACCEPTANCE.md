# MGX Badugi Portrait Mobile Acceptance

Date: 2026-05-16

Scope: Badugi portrait mobile only, 390x844 and 430x932.

This is a UI/readability gate only. Passing this document does not restore Badugi to `alpha_playable`; progression and long-run readiness remain separate gates.

## Acceptance Criteria

| Item | Required Result |
| --- | --- |
| preview launch | Badugi launches with explicit preview flag enabled. |
| horizontal overflow | No horizontal document overflow. |
| pot | Total Pot is visible and does not block action controls. |
| phase/draw round | Phase and draw round are visible. |
| hero cards | Hero cards are visible. |
| CPU cards | CPU cards are not fully hidden. |
| action buttons | Betting buttons are visible and tappable. |
| draw controls | Draw confirm control is visible and tappable during draw action. |
| result overlay | Hand Result is reachable and usable. |
| next hand | Next Hand control is reachable and returns to active gameplay. |
| safe area | Table and controls are not clipped by mobile browser chrome/safe area. |
| coaching/dashboard | Coaching and dashboard surfaces are unaffected by the portrait layout change. |

## Passing Evidence

The passing evidence is:

- `reports/alpha/badugi-portrait-mobile-layout-audit.json`
- `reports/screenshots/badugi-portrait-mobile-390x844.png`
- `reports/screenshots/badugi-portrait-mobile-430x932.png`

