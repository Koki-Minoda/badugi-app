const SPLIT_EVALUATORS = new Set([
  "hi-lo-8-split",
  "split-badugi-27",
  "split-badugi-a5",
]);

const BADUGI_EVALUATORS = new Set([
  "badugi-low",
  "badugi-high",
  "split-badugi-27",
  "split-badugi-a5",
]);

export function deriveRequirementsForVariant(variant) {
  if (!variant) return null;
  const holeCards = Number.isFinite(variant.holeCards) ? variant.holeCards : null;
  const drawRounds = Number.isFinite(variant.drawRounds) ? variant.drawRounds : 0;
  const hasBoard = Boolean(variant.board && variant.board.type);
  const hasStudStreets = Boolean(variant.stud);
  const evaluators = Array.isArray(variant.evaluators) ? variant.evaluators : [];
  const needsSplitPot = evaluators.some((tag) => SPLIT_EVALUATORS.has(tag));
  const needsBadugiEvaluator = evaluators.some((tag) => BADUGI_EVALUATORS.has(tag));
  const needsHiLoEvaluator = evaluators.includes("hi-lo-8-split");
  const needsArchieEvaluator = evaluators.includes("archie");
  const needsZeroEvaluator = evaluators.includes("zero");

  return {
    holeCards,
    drawRounds,
    needsBoardRenderer: hasBoard,
    needsDrawEngine: drawRounds > 0 && !hasStudStreets,
    needsStudEngine: hasStudStreets,
    needsSplitPot,
    needsBadugiEvaluator,
    needsHiLoEvaluator,
    needsArchieEvaluator,
    needsZeroEvaluator,
    boardType: hasBoard ? variant.board.type : null,
    bettingStructure: variant.betting ?? null,
    studSummary: hasStudStreets ? summarizeStudStructure(variant.stud) : null,
  };
}

function summarizeStudStructure(stud = {}) {
  const third = stud.thirdStreet ?? {};
  const middle = stud.middleStreets ?? 0;
  const river = stud.river ?? {};
  return {
    thirdStreet: {
      down: third.down ?? 0,
      up: third.up ?? 0,
    },
    middleStreets: middle,
    river: {
      down: river.down ?? 0,
    },
  };
}
