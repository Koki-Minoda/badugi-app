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
| `MIX-PROG-06` | PLO/Stud/Razz real hand-history EV, position, and showdown gates should exist before board/stud RL promotion. | Board and Stud controller snapshots now have strict evaluator/settlement gates, and the Stud result contract survives JSON round-trip; persisted real-log promotion input remains to be connected. | No immediate Core5 user-visible impact. | Connect the strict result verifier to persisted real-hand promotion input. | Non-blocking for Core5 friend alpha. |
| `EV-GUARD-06` | Board/Omaha/Stud terminal evaluator replay should be checked against real hand history. | Board B01-B09 and Stud ST1-ST6 now independently recompute terminal winners; browser history/replay covers all six Stud routes, but a persisted-record-to-evaluator gate is still open. | RL/evaluator confidence gap is reduced but not closed for real logs. | Feed persisted terminal records through the same strict evaluator verifier. | Non-blocking for Core5 alpha. |
| `EV-GUARD-07` | Strict chip conservation should be enabled for every controller. | Closed for all chip games: Board B01-B09, Draw D01-D07/S01-S07, Dramaha H01-H06 and Stud ST1-ST6 now enforce exact settlement and chip conservation. CP1 uses a dedicated zero-sum points gate because it has no chip pot. | No remaining family-level settlement allowlist. | Keep the 36-variant strict gate mandatory in CI. | Closed. |
| `EV-GUARD-08` | Odd-chip policy should align to TDA/variant-specific position rules. | Deterministic policy exists but is not aligned to every variant. | Rare split-pot semantic mismatch. | Define per-variant odd-chip policy and fixtures. | Non-blocking for current Core5 release gate. |
| `27TD-PROG-002` | D01 should have a multi-hand all-in side-pot browser release gate. | Focused rule/evaluator/pot/snapshot/browser progression exist, but that specific browser gate is missing. | Side-pot edge coverage gap. | Add D01 all-in/side-pot browser gate. | Non-blocking until side-pot heavy release confidence is required. |
| `A5TD-PROG-002` | D02 should have a multi-hand all-in side-pot browser release gate. | Focused coverage exists, but D02-specific browser side-pot gate is missing. | Side-pot edge coverage gap. | Add D02 all-in/side-pot browser gate. | Non-blocking for immediate physical mobile blockers. |
| `SD-PROG-002` | S01/S02 should have Single Draw-specific all-in side-pot browser release gate. | Focused coverage exists, but browser side-pot gate is missing. | Side-pot edge coverage gap. | Add S01/S02 all-in/side-pot browser gate. | Non-blocking for immediate friend-alpha HOLD reason. |
| `HIST-REG-06` | Chinese/OFC history/replay smoke should match coverage of the 35 betting/draw variants. | CP1 deterministic history replay covers initial cards, row placement and exact showdown scoring; OFC remains a separate unimplemented mode. | No CP1 replay gap remains; OFC is still not represented. | Keep CP1 replay and strict points gates mandatory; implement OFC separately. | Closed for CP1; open for OFC. |
| `FB-REG-06-MANUAL` | Feedback quality should be manually checked with real OpenAI key and production-like hand sets. | Variant separation/replay links are unit-tested, but real-key quality check is pending. | Feedback quality risk, not gameplay progression risk. | Run production-like 30+ hand checks per variant. | Non-blocking for game progression. |
| `CHINESE-03` | OFC should support street-by-street progression and fantasyland before marked playable. | CP1 controller smoke passes; OFC progression/fantasyland incomplete. | Chinese/OFC not alpha-ready. | Implement/verify OFC street progression and fantasyland. | Non-blocking for Core5. |
| `CORE5-CPU-TELEMETRY-001` | Live rows should persist explicit CPU decision metadata for source attribution. | Deployed metadata path exists; historical rows lack fields and targeted sessionId QA is pending. | Limits diagnosis of CPU fold/nit reports. | Perform targeted D01/D02/Badugi cash QA with visible sessionId and DB audit. | Non-blocking by itself; supports active CPU blockers. |
| `UI-MOBILE-ERGONOMICS-001` | Mobile table should connect action controls with compact actor/history context. | Automation is playable, but context remains dense and controls are separated from history context. | Usability/polish issue after P0 physical blockers. | Add compact mobile actor/action context bar after Badugi physical P0 recheck. | Non-blocking while no offscreen action-control P0 exists. |
| `CAP-NAT-01` | Legacy fixed-limit cap should have natural CPU long-run smoke separate from Core5. | Legacy FLH/FLO8/Stud cap UI E2E is not part of Core5 alpha gate. | No current Core5 impact. | Add preview-enabled legacy fixed-limit cap gate. | Non-blocking for Core5 friend alpha. |
