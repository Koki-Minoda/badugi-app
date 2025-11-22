# Planned Game Library (all 30 variants)

The UI eventually supports 30 distinct variants spread across the Hold'em/Board, Draw (triple + single), Dramaha, and Stud families. The table below matches the existing `games/config/multiGameList.json` catalog and keeps triple draw / single draw separate exactly as requested.

Each entry cites the current ID used in `docs/game_catalog.md` and `config/ai/modelRegistry.json` so we can later attach tier-specific ONNX policies.

## Hold'em / Board Games

| ID | Name | Status | Betting | Notes |
| --- | --- | --- | --- | --- |
| B01 | NL Hold'em | planned | no-limit | 2 cards; flop-turn-river; default ring |
| B02 | FL Hold'em | planned | fixed-limit | 2 cards; flop-turn-river |
| B03 | NL Super Hold'em | planned | no-limit | 3 pocket cards; flop-turn-river |
| B04 | FL Super Hold'em | planned | fixed-limit | 3 pocket cards; flop-turn-river |
| B05 | Pot-Limit Omaha (PLO) | planned | pot-limit | 4 cards; flop-turn-river; Pot-Limit |
| B06 | PLO8 | planned | pot-limit | 4 cards; flop-turn-river; hi-lo split |
| B07 | Big O | planned | pot-limit | 5 cards; flop-turn-river; hi-lo |
| B08 | 5-Card PLO | planned | pot-limit | 5 cards; flop-turn-river |
| B09 | FLO8 | planned | fixed-limit | fixed-limit hi-lo variant |

## Draw Games (Triple Draw family)

| ID | Name | Status | Betting | Notes |
| --- | --- | --- | --- | --- |
| D01 | 2-7 Triple Draw | planned | fixed-limit | 5 cards; 3 draws |
| D02 | A-5 Triple Draw | planned | fixed-limit | 5 cards; 3 draws |
| D03 | Badugi Triple Draw | live | fixed-limit | 4 cards; 3 draws |
| D04 | Badeucey Triple Draw | planned | fixed-limit | split pot |
| D05 | Badacey Triple Draw | planned | fixed-limit | split pot |
| D06 | Hidugi Triple Draw | planned | fixed-limit | badugi-style |
| D07 | Archie Triple Draw | planned | fixed-limit | 5 cards; 3 draws |

## Draw Games (Single Draw family)

| ID | Name | Status | Betting | Notes |
| --- | --- | --- | --- | --- |
| S01 | 2-7 Single Draw | planned | fixed-limit | 5 cards; single draw |
| S02 | A-5 Single Draw | planned | fixed-limit | 5 cards; single draw |
| S03 | 5-Card Single Draw | planned | fixed-limit | 5 cards; single draw |
| S04 | Badugi Single Draw | planned | fixed-limit | 4 cards; single draw |
| S05 | Badeucey Single Draw | planned | fixed-limit | split pot |
| S06 | Badacey Single Draw | planned | fixed-limit | split pot |
| S07 | Hidugi Single Draw | planned | fixed-limit | badugi-style |

## Dramaha

| ID | Name | Status | Betting | Notes |
| --- | --- | --- | --- | --- |
| H01 | Dramaha Hi | planned | fixed-limit | 5 cards; fixed draw |
| H02 | Dramaha 2-7 | planned | fixed-limit | deuce-to-seven rules |
| H03 | Dramaha A-5 | planned | fixed-limit | ace-to-five rules |
| H04 | Dramaha Zero | planned | fixed-limit | zero-based |
| H05 | Dramaha Hidugi | planned | fixed-limit | mix of hidugi/badugi |
| H06 | Dramaha Badugi | planned | fixed-limit | uses badugi-style evaluation |

## Stud

| ID | Name | Status | Betting | Notes |
| --- | --- | --- | --- | --- |
| ST1 | Stud | planned | fixed-limit | 7 cards; stud streets |
| ST2 | Stud 8 | planned | fixed-limit | hi-lo stud |
| ST3 | Razz | planned | fixed-limit | low-only stud |
| ST4 | Razzdugi | planned | fixed-limit | raaz + badugi mix |
| ST5 | Razzducey | planned | fixed-limit | raaz + deuces mix |
| ST6 | 2-7 Razz | planned | fixed-limit | 2-7 low |

## Notes

- Each variant already has an ID (Bxx/Dxx/Sxx/Hxx/STx) that can be used by the model registry when we deploy ONNX policies.
- Triple draw (`Dxx`) and single draw (`Sxx`) are intentionally treated separately: the same evaluation family but with different draw counts/processes.
- As we add new models we should update `config/ai/modelRegistry.json` and `config/ai/tiers.json` so each CPU tier can declare which variant-specific ONNX binary it uses (the tier helpers in `ai/tierManager.js` already support variant/tier lookups).
