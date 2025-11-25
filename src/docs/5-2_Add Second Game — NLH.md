Goal: Implement NLH as the second fully playable game, using the abstraction layer from Step5-1.

Tasks:

1. Create folder:
   src/games/nlh/

2. Implement:
   - NLHGameDefinition.js
   - utils/deck.js (reuse Badugi’s 52-card deck)
   - utils/evaluator.js (standard 7-card evaluator → best 5)
     * recommended structure:
         evaluate7(cards) → rank tuple
         compareHands(a,b)
         getWinners(players)

3. Streets:
   ["pre", "flop", "turn", "river", "showdown"]

4. Hole/Board:
   hole: 2  
   community: 5

5. Betting rules:
   - No-limit
   - Preflop SB/BB forced
   - runBetRound() must support:
       fold, call, check, bet(any), raise(any), all-in

6. UI:
   Provide NLHGameUIAdapter:
     - renderHoleCards()
     - renderBoard()
     - renderPlayer()
     - renderCommunity()
     - renderShowdown()

7. GameRegistry:
   Register NLHDefinition:
     GameRegistry.register("nlh", NLHGameDefinition)

8. MainMenuScreen:
   Add “NLH (Hold’em)” entry that:
     startGame("nlh")

9. Minimal E2E:
   tests/e2e/nlh-basic-flow.spec.ts
   Simulate:
     - simple hero auto-fold path
     - one showdown
     - verify overlay has correct winner

10. Do NOT change Badugi MTT.
