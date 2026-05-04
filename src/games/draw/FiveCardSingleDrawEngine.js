import { evaluateHighHand } from "../evaluators/high.js";
import { parseCards } from "../evaluators/core.js";
import { DeuceToSevenTripleDrawEngine } from "./DeuceToSevenTripleDrawEngine.js";

function classifyHighDraw(cards = []) {
  const parsed = parseCards(cards);
  const counts = new Map();
  parsed.forEach((card, idx) => {
    const bucket = counts.get(card.value) ?? [];
    bucket.push(idx);
    counts.set(card.value, bucket);
  });
  const groups = [...counts.values()].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const aValue = parsed[a[0]]?.value ?? 0;
    const bValue = parsed[b[0]]?.value ?? 0;
    return bValue - aValue;
  });
  const madeGroupSize = groups[0]?.length ?? 1;
  const keep = new Set();
  if (madeGroupSize >= 2) {
    groups
      .filter((group) => group.length >= 2)
      .flat()
      .forEach((idx) => keep.add(idx));
  } else {
    parsed
      .map((card, idx) => ({ idx, value: card.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 2)
      .forEach((entry) => keep.add(entry.idx));
  }
  return {
    madeGroupSize,
    discardIndexes: parsed.map((_, idx) => idx).filter((idx) => !keep.has(idx)),
  };
}

export class FiveCardSingleDrawEngine extends DeuceToSevenTripleDrawEngine {
  constructor({ deckManager = null } = {}) {
    super({
      deckManager,
      gameId: "five_card_single_draw",
      displayName: "5-Card Single Draw",
      variantId: "S03",
      evaluatorTag: "high",
      lowType: "high",
      cpuStrategy: "ruleBasedS03",
      maxDrawRounds: 1,
      bigBetStartsAtDrawRound: 1,
      handCardCount: 5,
    });
  }

  evaluateShowdownHand(cards = []) {
    return evaluateHighHand({ cards });
  }

  chooseCpuAction(state, seatIndex = state?.actingPlayerIndex) {
    const player = state?.players?.[seatIndex];
    if (!state || typeof seatIndex !== "number" || !player || player.folded || player.sittingOut) {
      return null;
    }
    if (state.actingPlayerIndex !== null && state.actingPlayerIndex !== seatIndex) {
      return null;
    }
    const drawPlan = classifyHighDraw(player.hand ?? []);
    if (state.street === "DRAW") {
      return {
        seatIndex,
        type: "DRAW",
        discardIndexes: drawPlan.discardIndexes,
        metadata: {
          strategy: this.cpuStrategy,
          drawCount: drawPlan.discardIndexes.length,
          pat: drawPlan.discardIndexes.length === 0,
        },
      };
    }
    if (state.street !== "BET") return null;
    const currentBet = Number(state.metadata?.currentBet ?? state.currentBet ?? 0) || 0;
    const playerBet = Number(player.bet ?? 0) || 0;
    const facingBet = currentBet > playerBet;
    const strongMade = drawPlan.madeGroupSize >= 2;
    if (!facingBet && strongMade) {
      return { seatIndex, type: "BET", metadata: { strategy: this.cpuStrategy } };
    }
    if (facingBet && !strongMade && (state.drawRoundIndex ?? 0) >= 1) {
      return { seatIndex, type: "FOLD", metadata: { strategy: this.cpuStrategy } };
    }
    return {
      seatIndex,
      type: facingBet ? "CALL" : "CHECK",
      metadata: { strategy: this.cpuStrategy },
    };
  }
}

export default FiveCardSingleDrawEngine;
