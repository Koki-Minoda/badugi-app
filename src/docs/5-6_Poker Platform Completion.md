Goal: Finish the multi-game architecture and unify all variants.

Tasks:

1. Finalize GameFactory:
   - CreateGameState(variant)
   - CreateGameUIAdapter(variant)
   - CreateEvaluator(variant)
   - CreateGameFlowController(variant)

2. Standardize all game interfaces:
   GameDefinition MUST export:
     id, label, variant
     streets[]
     evaluateHand()
     compareHands()
     getWinners()
     runBetRound()
     runStreet()
     render hooks from UIAdapter

3. UI Normalization:
   - Table layout accepts a GameUIAdapter
   - Action buttons decided by game rules
   - Board/Hole rendering polymorphic

4. Mixed-game MTT demo mode:
   - Rotation: ["badugi","nlh","single","triple","plo","stud"]
   - Switch every 1 level

5. Full E2E:
   - Launch mixed MTT
   - Force level-ups
   - Verify variant switch, HUD update, payouts intact

6. Documentation:
   - /docs/multi-game.md
   - Describe how to create a new variant
   - How to plug into MTT
