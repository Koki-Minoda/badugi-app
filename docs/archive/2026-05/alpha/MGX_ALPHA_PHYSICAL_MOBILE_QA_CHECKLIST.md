# MGX Alpha Physical Mobile QA Checklist

Status: `PENDING_PHYSICAL_DEVICE`

Date: 2026-05-16

## Devices

| Device | Browser | Status |
| --- | --- | --- |
| Android phone | Chrome | PENDING |
| iPhone | Safari or Chrome | PENDING |

## Required Checks

Run these on the deployed preview URL: `https://mgx-poker.com/`.

| Check | D02 | S01 | S02 | Notes |
| --- | --- | --- | --- | --- |
| Initial load | PENDING | PENDING | PENDING |  |
| Login/session reuse | PENDING | PENDING | PENDING |  |
| Variant launch | PENDING | PENDING | PENDING |  |
| Table fits portrait | PENDING | PENDING | PENDING | 390px-class width is the risk area |
| Table fits landscape | PENDING | PENDING | PENDING |  |
| Action button tap | PENDING | PENDING | PENDING | Must be reachable without horizontal scroll |
| Pot visible | PENDING | PENDING | PENDING |  |
| Phase visible | PENDING | PENDING | PENDING |  |
| Result overlay usable | PENDING | PENDING | PENDING |  |
| Next hand usable | PENDING | PENDING | PENDING |  |
| Coaching card readable | PENDING | PENDING | PENDING |  |
| Replay link opens | PENDING | PENDING | PENDING |  |
| Learning Dashboard graph readable | PENDING | PENDING | PENDING |  |

## Known Risk Before Physical QA

Mobile emulation now passes for D02/S01/S02 gameplay controls, pot, phase, no horizontal overflow, and one-hand result reachability on 390px-class portrait. Treat physical device QA as the remaining P1 gate because real browser chrome, touch behavior, and orientation handling can still differ from Playwright emulation.

Automated mobile coverage:

```bash
npx playwright test tests/e2e/alpha-playable-variants-smoke.spec.ts --project=badugi-flow
npx playwright test tests/e2e/alpha-mobile-gameplay-layout.spec.ts --project=badugi-flow
```
