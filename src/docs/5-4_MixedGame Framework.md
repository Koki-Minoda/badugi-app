Goal: Enable a tournament (or cash) to sequence multiple games (Badugi → NLH → Stud …)

Tasks:

1. Extend TournamentConfig:
   {
     gameRotation: ["badugi", "nlh"],
     rotationPolicy: "per-level" | "per-hand" | "fixed",
   }

2. Add mixed-game switch hook:
   In onLevelAdvanced() or onHandCompleted():
       currentVariant = nextVariantFromRotation()

3. App.jsx:
   - When variant changes:
       - Dispose current GameDefinition state
       - Load next GameDefinition
       - Hydrate table & UI seamlessly

4. HUD:
   - Add label:
       “Current Game: Badugi”
       “Next: NLH”

5. No UI animations required yet.

6. Testing:
   - Unit test for rotation logic
   - Minimal E2E:
       Start Mixed (Badugi→NLH)
       Force level-advance
       Ensure variant changes
