import tiers from "../config/ai/tiers.json";
import { buildAiContext, computeBetDecision, computeDrawDecision } from "./policyRouter.js";

function createSeededRandom(seed = 1) {
  let value = Math.max(1, Math.floor(seed) % 2147483647);
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function withRandomSequence(randomFn, callback) {
  const original = Math.random;
  Math.random = randomFn;
  try {
    return callback();
  } finally {
    Math.random = original;
  }
}

function getTierList(tierIds = []) {
  const wanted = new Set(tierIds);
  return tiers.filter((tier) => wanted.size === 0 || wanted.has(tier.id));
}

export function runBadugiTierPolicySmoke({
  tierIds = ["beginner", "standard", "pro", "worldmaster"],
  iterations = 120,
  seed = 20260430,
} = {}) {
  const random = createSeededRandom(seed);
  return withRandomSequence(random, () =>
    getTierList(tierIds).map((tier) => {
      const context = buildAiContext({
        variantId: "D03",
        tierConfig: tier,
        opponentStats: {},
      });
      const metrics = {
        tierId: tier.id,
        decisions: 0,
        voluntaryActions: 0,
        raises: 0,
        folds: 0,
        totalDrawCount: 0,
        patMadeBadugi: 0,
      };

      for (let i = 0; i < iterations; i += 1) {
        const strongMade = i % 4 === 0;
        const weakDraw = i % 4 === 1;
        const mediumDraw = i % 4 === 2;
        const evaluation = strongMade
          ? { ranks: [1, 3, 5, 7], deadCards: [] }
          : weakDraw
          ? { ranks: [1, 9], deadCards: ["KC", "QD"] }
          : mediumDraw
          ? { ranks: [2, 5, 11], deadCards: ["KS"] }
          : { ranks: [2, 4, 7, 12], deadCards: [] };
        const madeCards = evaluation.ranks.length;
        const toCall = i % 3 === 0 ? 20 : 0;
        const betDecision = computeBetDecision({
          context,
          toCall,
          canRaise: true,
          madeCards,
          betSize: 20,
          actor: { stack: 500, betThisRound: toCall ? 0 : 20 },
          evaluation,
        });
        const drawDecision = computeDrawDecision({
          context,
          hand: ["AC", "2D", "KC", "QH"],
          evaluation,
        });

        metrics.decisions += 1;
        if (betDecision.action !== "FOLD" && toCall > 0) {
          metrics.voluntaryActions += 1;
        }
        if (betDecision.action === "RAISE") metrics.raises += 1;
        if (betDecision.action === "FOLD") metrics.folds += 1;
        metrics.totalDrawCount += drawDecision.drawCount ?? 0;
        if (strongMade && drawDecision.drawCount === 0) metrics.patMadeBadugi += 1;
      }

      return {
        tierId: tier.id,
        vpipRate: metrics.voluntaryActions / Math.max(1, Math.ceil(iterations / 3)),
        raiseRate: metrics.raises / metrics.decisions,
        foldRate: metrics.folds / metrics.decisions,
        averageDrawCount: metrics.totalDrawCount / metrics.decisions,
        madeBadugiPatRate: metrics.patMadeBadugi / Math.max(1, Math.ceil(iterations / 4)),
      };
    }),
  );
}

export function resolveFallbackDecision({ onnxDecision, ruleDecision, deterministicDecision }) {
  return onnxDecision ?? ruleDecision ?? deterministicDecision ?? null;
}
