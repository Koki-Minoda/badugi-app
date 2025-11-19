# Spec 10 – Multi-Game List & Variant Requirements  
*(Single Draw variants included / Badugi annotated as implemented)*

## Motivation

With the GameEngine abstraction (Spec 09) complete, the system must now
support a large set of poker variants (~20–30 games), covering:

- Hold’em / Omaha style board games  
- Draw games (Triple Draw + Single Draw)  
- Stud games  
- Hybrid games (Dramaha / Badugi-split variants)  
- Badugi & Badeucey / Badacey family  
- Mixed Game rotations (Spec 11)

This spec defines:

1. The unified list of target games  
2. Their minimal mechanical requirements  
3. Required evaluator behavior  
4. Required street/draw structures  
5. Tags for MixedGame selection UI  
6. Implementation priority order for Codex

Badugi is **already implemented (v1)**, but its full specification is
included for consistency and Mixed Game integration.

---

# 1. Unified Variant List (Total 30 games)

This section lists all variants supported by the architecture including
Triple Draw / Single Draw and hybrid family variants.

Game IDs are stable and will be referenced by:
- engine registry  
- Mixed Game rotation  
- UI selector  
- Codex auto-task generation  


---

## 1.1 Hold’em / Omaha / Board Games (9)

| GID | Name               | Cards | Streets                      | Notes |
|-----|--------------------|--------|------------------------------|--------|
| B01 | NL Hold’em (NLH)   | 2      | 4-board (F/T/R)              | NL betting |
| B02 | FL Hold’em (FLH)   | 2      | 4-board                      | FL betting |
| B03 | NL Super Hold’em   | 3      | 4-board                      | NL, hole=3 |
| B04 | FL Super Hold’em   | 3      | 4-board                      | FL |
| B05 | PLO                | 4      | 4-board                      | PL, use-exactly-2 |
| B06 | PLO8               | 4      | 4-board                      | PL, Hi-Lo split |
| B07 | Big-O              | 5      | 4-board                      | PL, use-exactly-2 |
| B08 | 5-Card PLO         | 5      | 4-board                      | PL |
| B09 | FLO8               | 2      | 4-board                      | FL, Hi-Lo split |

---

## 1.2 Draw Games – Triple Draw (7)

| GID | Name              | Cards | Draws | Evaluator       | Notes |
|-----|-------------------|--------|--------|------------------|--------|
| D01 | 2-7 Triple Draw   | 5      | 3      | 2-7 lowball      | triple draw |
| D02 | A-5 Triple Draw   | 5      | 3      | A-5 lowball      | triple draw |
| D03 | Badugi (v1 impl.) | 4      | 3      | Badugi (low)     | implemented in app |
| D04 | Badeucey TD       | 4      | 3      | Badugi + 2-7 low | split 50/50 |
| D05 | Badacey TD        | 4      | 3      | Badugi + A-5 low | split 50/50 |
| D06 | Hidugi TD         | 4      | 3      | Badugi-high      | reverse Badugi |
| D07 | ARCHIE TD         | 5      | 3      | Archie rules     | custom eval |

---

## 1.3 Draw Games – Single Draw (7) ※新規追加

| GID | Name               | Cards | Draws | Evaluator         | Notes |
|-----|--------------------|--------|--------|--------------------|--------|
| S01 | 2-7 Single Draw    | 5      | 1      | 2-7 lowball        | 1draw |
| S02 | A-5 Single Draw    | 5      | 1      | A-5 lowball        | 1draw |
| S03 | 5-Card Single Draw | 5      | 1      | High-hand          | classic 5CD |
| S04 | Badugi SD          | 4      | 1      | Badugi low         | 1draw |
| S05 | Badeucey SD        | 4      | 1      | Badugi + 2-7 low   | 1draw |
| S06 | Badacey SD         | 4      | 1      | Badugi + A-5 low   | 1draw |
| S07 | Hidugi SD          | 4      | 1      | Badugi-high        | 1draw |

---

## 1.4 Dramaha (Hybrid Board + Draw) – 6 variants

| GID | Name              | Cards | Board   | Draws | Eval              | Notes |
|-----|-------------------|--------|---------|---------|--------------------|--------|
| H01 | Dramaha Hi        | 5      | Flop    | 1       | High-hand          | no T/R |
| H02 | Dramaha 2-7       | 5      | Flop    | 1       | 2-7 low            | hybrid |
| H03 | Dramaha A-5       | 5      | Flop    | 1       | A-5 low            | variant |
| H04 | Dramaha 0         | 5      | Flop    | 1       | Zero-hand ranking  | custom |
| H05 | Dramaha Hidugi    | 5      | Flop    | 1       | Badugi-high        | hybrid |
| H06 | Dramaha Badugi    | 5      | Flop    | 1       | Badugi-low         | hybrid |

---

## 1.5 Stud Family (6)

| GID | Name        | Up/Down | Streets        | Eval           | Notes |
|-----|-------------|----------|-----------------|----------------|--------|
| ST1 | Stud        | 3 up/4dn | 3–7 streets     | High-hand      | bring-in |
| ST2 | Stud 8      | 3 up/4dn | 3–7 streets     | Hi-Lo split    | 8 or better |
| ST3 | Razz        | 3 up/4dn | 3–7 streets     | A-5 lowball    | lowest-up brings-in |
| ST4 | Razzdugi    | 3 up/4dn | 3–7 streets     | Razz + Badugi  | split |
| ST5 | Razzducey   | 3 up/4dn | 3–7 streets     | Razz + 2-7 low | split |
| ST6 | 2-7 Razz    | 3 up/4dn | 3–7 streets     | 2-7 lowball    | highest-up brings-in |

---

# 2. Requirements per Family

This section defines what **each engine family** must implement.

---

## 2.1 Hold’em / Omaha Family – Requirements

### Shared
- Hole cards: 2–5  
- Streets: preflop → flop → turn → river  
- Board: 5 cards  
- Betting: NL / PL / FL  
- Showdown: best 5-card hand  
- Board engine logic must support:
  - Dealing board cards per street  
  - PL pot-size calculations  
  - Hi-Lo split (Omaha8)  
  - **Must-use-2 rule** for Omaha style games  

### Evaluators required
- High-hand (standard)  
- Hi-Lo (8-or-better)  

---

## 2.2 Draw Games – Requirements

### Shared (Triple / Single 共通)
- Hole cards:  
  - 5 cards (2-7, A-5, Archie, 5CD)  
  - 4 cards（Badugi-family）  
- Draw sequence:  
  - Single: BET → DRAW → BET → SHOW  
  - Triple: BET → DRAW → BET → DRAW → BET → DRAW → BET → SHOW  
- Each player chooses discards (0〜3)  
- Engine must support:
  - `drawRoundIndex`  
  - dynamic street transitions  
  - evaluator switching  

### Evaluators required
- 2-7 low  
- A-5 low  
- High-hand  
- Badugi low  
- Badugi high  
- Split (Badugi + lowball)  
- Archie evaluator  

---

## 2.3 Dramaha – Requirements

### Shared
- Hole: 5  
- Board: Flop only  
- Draw: 1 round  
- Streets:
  - Preflop (deal 5)  
  - Flop (3 cards)  
  - Draw (discard & replace)  
  - Final betting  
  - Showdown  

Evaluation differences per variant:
- High-hand  
- 2-7  
- A-5  
- Zero  
- Badugi-high  
- Badugi-low  

---

## 2.4 Stud Family – Requirements

### Shared
- 3rd Street: 2 down + 1 up  
- 4th–6th Street: 1 up  
- 7th Street: 1 down  
- Bring-in:
  - Lowest up-card (Razz)
  - Highest up-card (2-7 Razz)
  - Standard high rules (Stud)  
- Evaluators:
  - High  
  - A-5 low  
  - 8-or-better split  
  - Razz/Badugi/27 split variants  

---

# 3. Engine Priority Order (Codex Implementation Roadmap)

Codex should implement in the following order for stability and reuse:

### **Phase 1 — Draw engines (easy reuse from Badugi)**
1. 2-7 Triple Draw  
2. A-5 Triple Draw  
3. 5-Card Draw  
4. 2-7 Single Draw  
5. A-5 Single Draw  
6. 5-Card Single Draw  
7. Badeucey / Badacey / Hidugi / Archie (Triple + Single)

### **Phase 2 — Board Games**
8. NLH / FLH  
9. PLO / PLO8  
10. Big-O / 5-Card PLO  
11. Super Hold’em (NL/FL)

### **Phase 3 — Dramaha**
12. Hi / 2-7 / A-5  
13. 0 / 49 / Badugi / Hidugi

### **Phase 4 — Stud**
14. Stud / Stud8  
15. Razz  
16. Razzdugi  
17. Razzducey  
18. 2-7 Razz  

---

# 4. Acceptance Criteria

Spec 10 is considered complete when:

1. All game variants are listed (Triple Draw / Single Draw / Board / Stud / Hybrid)  
2. Each game includes:
   - Hole card count  
   - Draw count / street structure  
   - Board usage  
   - Evaluator behavior  
3. Evaluator requirements are fully defined  
4. Codex can:
   - Generate engine scaffolding  
   - Generate evaluator templates  
   - Integrate with Mixed Game (Spec 11)  
5. Badugi is annotated as already implemented and excluded from automatic re-gen tasks

---

# Appendix A — Quick Reference Table

### Board Games Quick Table
| Game | Cards | Streets | Eval | Notes |
|------|-------|----------|-------|--------|
| NLH | 2 | 4-board | High | NL |
| PLO | 4 | 4-board | High | PL, must-use-2 |

### Draw Quick Table
| Game | Cards | Draws | Eval |
|------|--------|--------|--------|
| 2-7TD | 5 | 3 | 2-7 low |
| 2-7SD | 5 | 1 | 2-7 low |
| Badugi TD | 4 | 3 | Badugi low |
| Badugi SD | 4 | 1 | Badugi low |

### Dramaha Quick Table
| Game | Cards | Board | Draw | Eval |
|------|--------|----------|--------|--------|
| Hi | 5 | flop | 1 | High |
| 2-7 | 5 | flop | 1 | 2-7 low |

### Stud Quick Table
| Game | Up/Down | Streets | Eval |
|------|----------|-----------|--------|
| Stud | 3 up/4dn | 3–7 | High |
| Razz | 3 up/4dn | 3–7 | A-5 low |
