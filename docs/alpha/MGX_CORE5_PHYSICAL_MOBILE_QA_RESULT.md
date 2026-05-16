# MGX Core5 Physical Mobile QA Result

Date: 2026-05-16

Preview URL: `https://mgx-poker.com/`

Deployed commit: `d91d7e0cdcbf24a0260a78c7c6083eaaaf1b0bf9`

## Decision

`HOLD`

Physical mobile QA was not executed in this shell because no real Android or iPhone device is available to the agent. Automated mobile browser/emulation and post-deploy preview smoke pass, but the friend alpha GO condition still requires at least one real mobile device PASS or PASS_WITH_NOTES.

## Android Chrome Checklist

| Check | Result |
| --- | --- |
| portrait tournament D01 | PENDING_PHYSICAL_DEVICE |
| portrait tournament D02 | PENDING_PHYSICAL_DEVICE |
| portrait tournament S01 | PENDING_PHYSICAL_DEVICE |
| portrait tournament S02 | PENDING_PHYSICAL_DEVICE |
| landscape tournament one Core5 game | PENDING_PHYSICAL_DEVICE |
| action buttons tappable | PENDING_PHYSICAL_DEVICE |
| Fold visible | PENDING_PHYSICAL_DEVICE |
| pot visible | PENDING_PHYSICAL_DEVICE |
| table/cards visible | PENDING_PHYSICAL_DEVICE |
| result overlay usable | PENDING_PHYSICAL_DEVICE |
| no horizontal overflow | PENDING_PHYSICAL_DEVICE |

## iPhone Safari / Chrome Checklist

| Check | Result |
| --- | --- |
| initial load | PENDING_PHYSICAL_DEVICE |
| portrait tournament Core5 | PENDING_PHYSICAL_DEVICE |
| landscape tournament Core5 | PENDING_PHYSICAL_DEVICE |
| action controls visible/tappable | PENDING_PHYSICAL_DEVICE |
| pot/table/cards readable | PENDING_PHYSICAL_DEVICE |
| result overlay usable | PENDING_PHYSICAL_DEVICE |

## Automation Evidence

| Gate | Result |
| --- | --- |
| Core5 mobile tournament regression | PASS, 20/20 |
| Core5 tournament portrait | PASS, 10/10 after rerun |
| Core5 tournament landscape | PASS, 10/10 |
| Core5 mobile portrait visual | PASS, 10/10 |
| Core5 mobile interaction | PASS, 10/10 |
| post-deploy preview smoke | PASS |

## Next Action

Run the checklist on at least one physical Android Chrome or iPhone Safari/Chrome device. If no P0 is found and controls/table/pot remain usable, update this result to PASS or PASS_WITH_NOTES and re-evaluate Friend Alpha GO/HOLD.
