# MGX Major 10 Pro Targets

Last updated: 2026-05-07

Major 10 は `multiGameList.json` の live/wip 実装、controller/UI 接続、既存 RL/ONNX の有無を優先して確定した。

| Slot | Variant ID | Game Name | Family | Engine Status | Controller Status | UI Status | RL/AI Status | Pro Target Status | Notes |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | D03 | Badugi | Draw / Badugi | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | Standard/Pro/Iron/WM ONNX + fallback | READY_FOR_PRO | Step1 primary target |
| 2 | D01 | 2-7 Triple Draw | Draw / Lowball | IMPLEMENTED (`catalog=wip`) | IMPLEMENTED | IMPLEMENTED | Beginner/Standard/Pro/Iron draw ONNX | READY_FOR_PRO | 96-dim schema / EV guard covered |
| 3 | D02 | A-5 Triple Draw | Draw / Lowball | IMPLEMENTED (`catalog=wip`) | IMPLEMENTED | IMPLEMENTED | Beginner/Standard/Pro/Iron draw ONNX | READY_FOR_PRO | 96-dim schema / EV guard covered |
| 4 | S01 | 2-7 Single Draw | Draw / Lowball | IMPLEMENTED (`catalog=wip`) | IMPLEMENTED | IMPLEMENTED | Standard/Pro via D01 family model | READY_FOR_PRO | maxDrawRounds=1 verified |
| 5 | S02 | A-5 Single Draw | Draw / Lowball | IMPLEMENTED (`catalog=wip`) | IMPLEMENTED | IMPLEMENTED | Standard/Pro via D02 family model | READY_FOR_PRO | maxDrawRounds=1 verified |
| 6 | B01 | NL Hold'em | Flop / Holdem | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | Beginner/Standard ONNX + fallback | READY_FOR_PRO | Pro overlay skeleton only in Step1 |
| 7 | B05 | Pot-Limit Omaha | Omaha | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | Beginner/Standard ONNX + fallback | READY_FOR_PRO | Must-use-two already modeled |
| 8 | B06 | PLO8 | Omaha / Split | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | Beginner/Standard ONNX + fallback | READY_FOR_PRO | Hi-Lo8 evaluator exists; Big O deferred |
| 9 | ST1 | Stud | Stud | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | Beginner/Standard Stud ONNX + fallback | READY_FOR_PRO | Bring-in / stud controller live |
| 10 | ST3 | Razz | Stud / Low | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | Beginner/Standard Stud ONNX + fallback | READY_FOR_PRO | Better Pro seed than Stud8 for lowball mix |

Selection notes:

- `B06 PLO8` was chosen over `B07 Big-O` for Step1 because Hi-Lo split logic, existing ONNX routing, and evaluator coverage are already in place.
- `ST3 Razz` was chosen over `ST2 Stud 8` because the initial Pro rule contract explicitly needs a low-focused Stud family target and current bootstrap routing already exists.
- `D01/D02/S01/S02` remain `wip` in catalog, but controller/UI/progression/RL safety evidence makes them Step1-ready for Pro overlay insertion.

Status legend used in this Step1 pass:

- `READY_FOR_PRO`
- `NEEDS_ENGINE`
- `NEEDS_CONTROLLER`
- `NEEDS_UI`
- `NEEDS_OBSERVATION`
- `NEEDS_EVALUATOR`
- `NOT_READY`

