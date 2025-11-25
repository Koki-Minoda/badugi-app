Goal: Introduce a unified multi-game architecture so Badugi logic/UI can coexist with NLH/PLO/Stud/etc.  
This step MUST NOT break Badugi’s current behavior or MTT functionality.

Create a new folder:
  src/games/_core/

Add these core interfaces:

1. GameDefinition
   {
     id: string;
     label: string;
     variant: string; // "badugi", "nlh", etc.
     maxPlayers: number;
     streets: string[]; // e.g. ["pre","draw1","draw2","showdown"] or ["pre","flop","turn","river"]
     hasCommunityCards: boolean;
     handStructure: { hole: number; community: number };
     defaultBlinds: { sb: number; bb: number };
     buildInitialState(): GameState;
     evaluateHand(hand): EvaluationResult;
     compareHands(a,b): number;
     getWinners(players): Player[];
     runBetRound(...): BetRoundResult;
     runStreet(...): StreetResult;
   }

2. GameFlowController
   - Defines the procedural flow:
     createNewHand()
     dealHoleCards()
     dealCommunityCards()
     runBetting()
     runDraw()
     runShowdown()

3. GameUIAdapter
   - Provides UI hooks:
     renderTableLayout()
     renderPlayerHand()
     renderBoard()
     renderActionControls()
     renderShowdown()

4. GameRegistry
   - A registry that maps variant => GameDefinition
   - Automatically loads BadugiDefinition during this step
   - Later steps will add NLHDefinition, PLODefinition, etc.

Refactor (minimal):
- Move Badugi-specific utilities (deck, evaluator, flow) into:
    src/games/badugi/
- Create BadugiGameDefinition inside:
    src/games/badugi/BadugiGameDefinition.js
- Register it in GameRegistry

App.jsx integration:
- Replace "badugi" hardcoded logic with:
    const game = GameRegistry.get(currentVariant)
- Do NOT change the existing Badugi MTT behavior.
- All existing UI must continue working with BadugiGameDefinition.

Testing:
- Add a simple unit test:
    verify GameRegistry.get("badugi") returns correct definition
    verify evaluateHand still matches existing Badugi evaluator

Non-goals for Step5-1:
- No NLH/PLO/Stud logic yet
- No UI redesign
- No MTT change
