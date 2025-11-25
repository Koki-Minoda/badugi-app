Goal: Add 3–5 more variants to demonstrate the power of the multi-game engine.

Recommended order:
1. Single Draw (最簡単)
2. Triple Draw
3. PLO (Omaha)
4. Stud (7-card)

For each:
- Create <variant>/GameDefinition.js
- evaluator.js
- UIAdapter.js
- register in GameRegistry

At this stage:
- UI does NOT need fancy assets.
- Minimal E2E 1 test per game (“deal → force showdown → overlay”).

Ensure NO changes to existing Badugi MTT logic.
