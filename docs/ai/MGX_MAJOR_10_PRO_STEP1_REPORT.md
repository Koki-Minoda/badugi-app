# MGX Major 10 Pro Step1 Report

Last updated: 2026-05-07

## Major 10 Status

| Variant | Family | Pro Strategy | Routing | Tests | Status | Notes |
| ------- | ------ | ------------ | ------- | ----- | ------ | ----- |
| D03 | Draw / Badugi | Implemented | Pro overlay + standard fallback | PASS | READY | pat / redraw / no-spew guards live |
| D01 | Draw / 2-7 | Implemented | Pro overlay + standard fallback | PASS | READY | discard cap / strong pat / final-round restraint |
| D02 | Draw / A-5 | Implemented | Pro overlay + standard fallback | PASS | READY | wheel pat / pair discard / A-low contract |
| S01 | Draw / 2-7 SD | Implemented | Pro overlay + standard fallback | PASS | READY | single-draw contract enforced |
| S02 | Draw / A-5 SD | Implemented | Pro overlay + standard fallback | PASS | READY | single-draw + A-5 contract enforced |
| B01 | Holdem | Skeleton | Existing router, no live Pro overlay use yet | Contract only | PARTIAL | Step2 needs preflop/postflop heuristics |
| B05 | Omaha | Skeleton | Existing router, no live Pro overlay use yet | Contract only | PARTIAL | Step2 needs nut-draw logic |
| B06 | Omaha / Split | Skeleton | Existing router, no live Pro overlay use yet | Contract only | PARTIAL | Step2 needs low eligibility / quartering checks |
| ST1 | Stud | Skeleton | Existing router, no live Pro overlay use yet | Contract only | PARTIAL | Step2 needs up-card and dead-card heuristics |
| ST3 | Razz | Skeleton | Existing router, no live Pro overlay use yet | Contract only | PARTIAL | Step2 needs live-card and board-pressure heuristics |

## Pro Rules Implemented

| Family | Rule | Implemented | Test | Notes |
| ------ | ---- | ----------- | ---- | ----- |
| Draw / Badugi | legal action filter | Yes | PRO-001 | illegal candidate is blocked |
| Draw / Badugi | made Badugi pat | Yes | PRO-002 | `D03` draw phase |
| Draw / Badugi | weak duplicate discard | Yes | PRO-003 | legal discard indexes only |
| Draw / Lowball | discard cap respected | Yes | PRO-004 | `D01` max 5 discard |
| Draw / Lowball | A-5 wheel pat | Yes | PRO-005 | `D02` wheel |
| Single Draw | no second-draw request | Yes | PRO-006 | `S01/S02` contract |
| Routing safety | model/candidate missing safe fallback | Yes | PRO-007 | safe fallback path |
| Routing safety | illegal candidate blocked | Yes | PRO-008 | blockedAction recorded |
| Safety | all-in no betting action | Yes | PRO-009 | no bet/raise for all-in actor |
| Logging | reason/source/confidence attached | Yes | PRO-010 | structured result contract |

## Remaining Gaps

| Gap | Severity | Target Step | Notes |
| --- | -------- | ----------- | ----- |
| Holdem/Omaha/Stud live Pro overlay not wired into runtime CPU path | Medium | Step2 | Contract and skeleton exist only |
| Pro tier still lacks ONNX-vs-overlay arbitration in board/stud families | Medium | Step2 | Existing router stays intact |
| Major 10 board/stud evaluators need explicit Pro family tests | Medium | Step2 | Current EV report is partial outside draw family |
| Mixed-game / opponent-model / ICM adjustments are not part of Step1 | Low | Step3+ | Out of scope by design |

