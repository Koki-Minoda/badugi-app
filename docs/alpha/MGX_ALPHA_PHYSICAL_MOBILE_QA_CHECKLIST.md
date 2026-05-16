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

Mobile emulation found gameplay action controls overflowing narrow viewports. Treat this as a P1 friend-alpha blocker until verified and fixed.
