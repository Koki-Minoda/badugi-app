import tiers from "../config/ai/tiers.json";
import { buildAiContext, computeBetDecision, computeDrawDecision } from "./policyRouter.js";
import {
  compareBadugiEvaluations,
  evaluateBadugi,
} from "../games/badugi/utils/badugiEvaluator.js";

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

const PRACTICE_SCENARIOS = [
  {
    name: "made-seven",
    cpuHand: ["AC", "2D", "3H", "7S"],
    heroHand: ["2C", "4D", "5H", "8S"],
    toCall: 20,
    improvedHand: ["AC", "2D", "3H", "7S"],
    missedHand: ["AC", "2D", "3H", "7S"],
  },
  {
    name: "one-card-to-wheel",
    cpuHand: ["AC", "2D", "3H", "KS"],
    heroHand: ["2C", "4D", "7H", "9S"],
    toCall: 0,
    improvedHand: ["AC", "2D", "3H", "4S"],
    missedHand: ["AC", "2D", "3H", "KS"],
  },
  {
    name: "rough-made-facing-bet",
    cpuHand: ["5C", "8D", "10H", "QS"],
    heroHand: ["2C", "6D", "8H", "JS"],
    toCall: 20,
    improvedHand: ["5C", "8D", "10H", "QS"],
    missedHand: ["5C", "8D", "10H", "QS"],
  },
  {
    name: "two-card-draw",
    cpuHand: ["AC", "2C", "9H", "KS"],
    heroHand: ["3C", "5D", "8H", "10S"],
    toCall: 20,
    improvedHand: ["AC", "2D", "5H", "8S"],
    missedHand: ["AC", "2C", "9H", "KS"],
  },
  {
    name: "three-card-pressure",
    cpuHand: ["2C", "5D", "7H", "7S"],
    heroHand: ["3C", "6D", "9H", "JS"],
    toCall: 0,
    improvedHand: ["2C", "5D", "7H", "8S"],
    missedHand: ["2C", "5D", "7H", "7S"],
  },
];

function resolvePracticeHand({ scenario, drawCount, tier }) {
  if (drawCount <= 0) return scenario.cpuHand;
  const accuracy = tier?.discardAccuracy ?? 0.5;
  return Math.random() < accuracy ? scenario.improvedHand : scenario.missedHand;
}

export function runBadugiTierPracticeSmoke({
  tierIds = ["beginner", "standard", "pro", "worldmaster"],
  handsPerTier = 240,
  seed = 20260501,
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
        hands: 0,
        voluntaryHands: 0,
        raises: 0,
        folds: 0,
        totalDrawCount: 0,
        showdowns: 0,
        showdownWins: 0,
      };

      for (let i = 0; i < handsPerTier; i += 1) {
        const scenario = PRACTICE_SCENARIOS[i % PRACTICE_SCENARIOS.length];
        const evaluation = evaluateBadugi(scenario.cpuHand);
        const betDecision = computeBetDecision({
          context,
          toCall: scenario.toCall,
          canRaise: true,
          madeCards: evaluation.count,
          betSize: 20,
          actor: { stack: 500, betThisRound: scenario.toCall ? 0 : 20 },
          evaluation,
        });
        const drawDecision = computeDrawDecision({
          context,
          hand: scenario.cpuHand,
          evaluation,
        });
        const drawCount = drawDecision.drawCount ?? 0;
        const finalHand = resolvePracticeHand({ scenario, drawCount, tier });

        metrics.hands += 1;
        if (betDecision.action !== "FOLD") {
          metrics.voluntaryHands += 1;
        } else {
          metrics.folds += 1;
        }
        if (betDecision.action === "RAISE") metrics.raises += 1;
        metrics.totalDrawCount += drawCount;

        if (betDecision.action !== "FOLD") {
          metrics.showdowns += 1;
          const result = compareBadugiEvaluations(
            evaluateBadugi(finalHand),
            evaluateBadugi(scenario.heroHand),
          );
          if (result <= 0) metrics.showdownWins += 1;
        }
      }

      return {
        tierId: tier.id,
        hands: metrics.hands,
        vpipRate: metrics.voluntaryHands / Math.max(1, metrics.hands),
        pfrRate: metrics.raises / Math.max(1, metrics.hands),
        foldRate: metrics.folds / Math.max(1, metrics.hands),
        averageDrawCount: metrics.totalDrawCount / Math.max(1, metrics.hands),
        showdowns: metrics.showdowns,
        showdownWinRate: metrics.showdownWins / Math.max(1, metrics.showdowns),
      };
    }),
  );
}

export function resolveFallbackDecision({ onnxDecision, ruleDecision, deterministicDecision }) {
  return onnxDecision ?? ruleDecision ?? deterministicDecision ?? null;
}
