# Audit Findings

Last updated: 2026-05-21

This file contains spec mismatches, evidence gaps, expected-fail style findings, semantic gaps, and non-user-visible correctness work. These are not the active P0/P1 friend-alpha blockers unless explicitly promoted into `ACTIVE_BLOCKERS.md`.

Summary:
- Audit finding rows: 14
- Release-blocking findings in this file: 0
- Non-blocking findings: 14

## Release-Blocking Findings

None. Release blockers are tracked in `ACTIVE_BLOCKERS.md`; physical real-device blockers are tracked in `PHYSICAL_QA_PENDING.md`.

## Non-Blocking Findings

| ID | Spec expectation | Current behavior | User-visible impact | Recommended decision | Blocking or non-blocking |
|---|---|---|---|---|---|
| `RL-SAFE-03` | Backend full pytest should be green before using RL/backend readiness as a release signal. | 32 passed / 4 failed in non-RL Badugi stats and variants API areas. | Low direct UI impact, but weakens backend confidence. | Fix stats/variant API failures and rerun full backend pytest. | Non-blocking for Core5 friend alpha UI; blocks RL/backend readiness. |
| `MIX-PROG-06` | PLO/Stud/Razz real hand-history EV, position, and showdown gates should exist before board/stud RL promotion. | Gate not yet built. | No immediate Core5 user-visible impact. | Add real-log EV gate before board/stud RL tier promotion. | Non-blocking for Core5 friend alpha. |
| `EV-GUARD-06` | Board/Omaha/Stud terminal evaluator replay should be checked against real hand history. | Replay comparison still open. | RL/evaluator confidence gap. | Replay terminal hands and compare evaluator winner/result. | Non-blocking for Core5 alpha. |
| `EV-GUARD-07` | Strict chip conservation should be enabled for every controller. | Terminal pot echo differs by controller, so strict mode is not universal. | Potential EV/reward contamination outside covered Core5 paths. | Normalize terminal snapshots and enable strict conservation. | Non-blocking for current friend alpha; important integrity gap. |
| `EV-GUARD-08` | Odd-chip policy should align to TDA/variant-specific position rules. | Deterministic policy exists but is not aligned to every variant. | Rare split-pot semantic mismatch. | Define per-variant odd-chip policy and fixtures. | Non-blocking for current Core5 release gate. |
| `27TD-PROG-002` | D01 should have a multi-hand all-in side-pot browser release gate. | Focused rule/evaluator/pot/snapshot/browser progression exist, but that specific browser gate is missing. | Side-pot edge coverage gap. | Add D01 all-in/side-pot browser gate. | Non-blocking until side-pot heavy release confidence is required. |
| `A5TD-PROG-002` | D02 should have a multi-hand all-in side-pot browser release gate. | Focused coverage exists, but D02-specific browser side-pot gate is missing. | Side-pot edge coverage gap. | Add D02 all-in/side-pot browser gate. | Non-blocking for immediate physical mobile blockers. |
| `SD-PROG-002` | S01/S02 should have Single Draw-specific all-in side-pot browser release gate. | Focused coverage exists, but browser side-pot gate is missing. | Side-pot edge coverage gap. | Add S01/S02 all-in/side-pot browser gate. | Non-blocking for immediate friend-alpha HOLD reason. |
| `HIST-REG-06` | Chinese/OFC history/replay smoke should match coverage of the 35 betting/draw variants. | Chinese/OFC history/replay remains incomplete. | No Core5 impact; affects Chinese/OFC readiness. | Add CP1/OFC handId/action/result/replay frame smoke. | Non-blocking for Core5 friend alpha. |
| `FB-REG-06-MANUAL` | Feedback quality should be manually checked with real OpenAI key and production-like hand sets. | Variant separation/replay links are unit-tested, but real-key quality check is pending. | Feedback quality risk, not gameplay progression risk. | Run production-like 30+ hand checks per variant. | Non-blocking for game progression. |
| `CHINESE-03` | OFC should support street-by-street progression and fantasyland before marked playable. | CP1 controller smoke passes; OFC progression/fantasyland incomplete. | Chinese/OFC not alpha-ready. | Implement/verify OFC street progression and fantasyland. | Non-blocking for Core5. |
| `CORE5-CPU-TELEMETRY-001` | Live rows should persist explicit CPU decision metadata for source attribution. | Deployed metadata path exists; historical rows lack fields and targeted sessionId QA is pending. | Limits diagnosis of CPU fold/nit reports. | Perform targeted D01/D02/Badugi cash QA with visible sessionId and DB audit. | Non-blocking by itself; supports active CPU blockers. |
| `UI-MOBILE-ERGONOMICS-001` | Mobile table should connect action controls with compact actor/history context. | Automation is playable, but context remains dense and controls are separated from history context. | Usability/polish issue after P0 physical blockers. | Add compact mobile actor/action context bar after Badugi physical P0 recheck. | Non-blocking while no offscreen action-control P0 exists. |
| `CAP-NAT-01` | Legacy fixed-limit cap should have natural CPU long-run smoke separate from Core5. | Legacy FLH/FLO8/Stud cap UI E2E is not part of Core5 alpha gate. | No current Core5 impact. | Add preview-enabled legacy fixed-limit cap gate. | Non-blocking for Core5 friend alpha. |
