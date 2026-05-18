# MGX Core5 Physical Mobile QA Result

Date: 2026-05-17

Preview URL: `https://mgx-poker.com/`

Deployed commit: see `reports/alpha/live-deploy-verification.json`

## Decision

`HOLD`

Physical mobile QA has now produced a P0 report outside this shell: live iPhone Badugi tournament can remain on `Waiting for other players...` at hand 5/5, phase BET, Draw 2, Bet Round 2, Hero SB, To Call 0, Pot 66, with folded players visible. Automated mobile browser/emulation and live layout evidence are not sufficient to clear this physical-device blocker.

The same QA stream also flagged D01 blind display risk: Hero appeared labeled `BB` with `BET 0`, Pot 30, and To Call 20. Local engine/UI/browser audit classifies this as a fixed-local display/position mismatch risk, not confirmed BB non-payment; physical recheck must export the `blindPosting` report after deploy.

Last-mile check: 2026-05-17.

Physical device tested: iPhone live preview screenshot supplied by QA.

## P0 Findings

| ID | Device | Game | Mode | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| `PHYSICAL-MOBILE-BADUGI-WAITING-001` | iPhone | Badugi | Tournament | OPEN | Waiting freeze at BET Draw2 / Bet Round 2 / hand 5/5. Needs freeze export JSON and post-fix physical recheck. |
| `BADUGI-DRAW-BET-MIX-001` | iPhone | Badugi | Tournament | OPEN | DRAW/BET label/control divergence observed separately; defer focused fix until waiting freeze is closed. |
| `D01-BLIND-POSTING-001` | iPhone | D01 | Cash/Tournament | FIXED_LOCAL / NEEDS_PHYSICAL_RECHECK | Local D01 trace shows SB/BB actual and displayed posts align after dealer-index position fix. Escalate to P0 if exported `blindPosting` JSON shows BB actual/displayed post is 0. |

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
| live layout evidence | PASS, 30/30 |
| live tournament runtime fatal guard | PASS, 5/5 |
| live Core5 alpha smoke | FAIL, tournament result/next-hand path not reached |

## Next Action

Fix and deploy `PHYSICAL-MOBILE-BADUGI-WAITING-001`, collect a `?mgxQa=mobile` freeze report if it reproduces, and rerun Badugi tournament on the same physical mobile path. Friend alpha remains HOLD while this P0 is open.
