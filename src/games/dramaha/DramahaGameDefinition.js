import { createGameDefinition } from "../_core/GameDefinition.js";
import { DeckManager } from "../badugi/utils/deck.js";
import {
  compareDramahaBoard,
  compareDramahaDraw,
  evaluateDramahaHand,
  getDramahaVariantConfig,
} from "./utils/dramahaEvaluator.js";

export function createDramahaGameDefinition({
  id,
  label,
  variant,
} = {}) {
  const resolvedVariant = variant ?? "dramaha_hi";
  const config = getDramahaVariantConfig(resolvedVariant);
  return createGameDefinition({
    id: id ?? `game-${resolvedVariant}`,
    label: label ?? config.label,
    variant: resolvedVariant,
    maxPlayers: 9,
    streets: ["preflop", "flop", "draw", "final", "showdown"],
    hasCommunityCards: true,
    handStructure: { hole: 5, community: 3, mustUseHole: 2, mustUseBoard: 3 },
    defaultBlinds: { sb: 1, bb: 2 },
    betting: { structure: "fixedLimit" },
    splitMode: "boardAndDraw",
    buildInitialState() {
      return {
        deck: new DeckManager(),
      };
    },
    createDeck() {
      return new DeckManager();
    },
    evaluateHand(input = {}) {
      return evaluateDramahaHand({ ...input, variant: resolvedVariant });
    },
    compareBoard: compareDramahaBoard,
    compareDraw: compareDramahaDraw,
    runShowdown() {
      return { summary: [], winners: [] };
    },
  });
}

const DramahaHiGameDefinition = createDramahaGameDefinition({
  id: "game-dramaha-hi",
  label: "Dramaha Hi",
  variant: "dramaha_hi",
});

export default DramahaHiGameDefinition;
