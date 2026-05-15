function actionAggression(action = "") {
  switch (String(action).toUpperCase()) {
    case "RAISE":
      return 4;
    case "BET":
      return 3;
    case "CALL":
      return 2;
    case "CHECK":
      return 1;
    case "FOLD":
      return 0;
    default:
      return -1;
  }
}

function classifyDivergenceCategory(record = {}) {
  const proAction = String(record.proAction ?? "").toUpperCase();
  const standardAction = String(record.standardAction ?? "").toUpperCase();
  const handClass = String(record.handClass ?? "").toLowerCase();
  const playerCount = Number(record.playerCount ?? 0);
  const facingAction = String(record.facingAction ?? "none");
  const proAggression = actionAggression(proAction);
  const standardAggression = actionAggression(standardAction);

  if (proAction === standardAction) return "same-action";
  if (proAction === "FOLD" && ["BET", "CALL", "RAISE"].includes(standardAction)) return "overfold";
  if (["CALL", "BET"].includes(proAction) && standardAction === "RAISE") return "underraise";
  if (proAction === "RAISE" && ["CALL", "BET", "CHECK"].includes(standardAction)) return "overraise";
  if (proAction === "CALL" && standardAction === "FOLD") {
    if (handClass.includes("weak") || handClass.includes("trash") || handClass.includes("medium")) {
      return "weak-defense";
    }
    return "overcall";
  }
  if (["CHECK", "CALL"].includes(proAction) && ["BET", "RAISE"].includes(standardAction)) {
    if (
      handClass.includes("premium") ||
      handClass.includes("strong") ||
      handClass.includes("uppermedium") ||
      handClass.includes("upper-medium")
    ) {
      return "missed-value";
    }
    return "insufficient-aggression";
  }
  if (playerCount >= 4) return "multiway-leak";
  if (playerCount <= 2) return "heads-up-leak";
  if (facingAction !== "none" && proAggression < standardAggression) return "pressure-leak";
  if (facingAction === "none" && proAggression < standardAggression) return "showdown-leak";
  return "insufficient-aggression";
}

function summarizeSpot(record = {}) {
  return [
    record.variantId,
    record.handClass,
    record.playerCount >= 4 ? "4way+" : record.playerCount === 3 ? "3way" : "heads-up",
    record.drawRound,
    record.bettingRound,
    record.position,
    record.facingAction,
  ].join("|");
}

function createAggregate(record = {}) {
  return {
    variantId: record.variantId,
    handClass: record.handClass,
    playerCountClass: record.playerCount >= 4 ? "4way+" : record.playerCount === 3 ? "3way" : "heads-up",
    drawRound: record.drawRound,
    bettingRound: record.bettingRound,
    position: record.position,
    facingAction: record.facingAction,
    proAction: record.proAction,
    standardAction: record.standardAction,
    category: classifyDivergenceCategory(record),
    frequency: 0,
    proSamples: 0,
    standardSamples: 0,
    proEvTotal: 0,
    standardEvTotal: 0,
  };
}

export function analyzeActionDivergence(report = {}) {
  const divergences = [];
  const variants = report?.variants ?? {};
  Object.values(variants).forEach((variantResult) => {
    const records = variantResult?.analysis?.divergenceRecords ?? [];
    records.forEach((record) => {
      if (record?.proAction && record?.standardAction && record.proAction !== record.standardAction) {
        divergences.push(record);
      }
    });
  });

  const aggregates = new Map();
  divergences.forEach((record) => {
    const key = `${summarizeSpot(record)}|${record.proAction}|${record.standardAction}`;
    if (!aggregates.has(key)) aggregates.set(key, createAggregate(record));
    const aggregate = aggregates.get(key);
    aggregate.frequency += 1;
    if (typeof record.proEvDelta === "number") {
      aggregate.proSamples += 1;
      aggregate.proEvTotal += record.proEvDelta;
    }
    if (typeof record.standardEvDelta === "number") {
      aggregate.standardSamples += 1;
      aggregate.standardEvTotal += record.standardEvDelta;
    }
  });

  const ranked = [...aggregates.values()]
    .map((aggregate) => {
      const proEvDelta = aggregate.proSamples ? aggregate.proEvTotal / aggregate.proSamples : null;
      const standardEvDelta = aggregate.standardSamples
        ? aggregate.standardEvTotal / aggregate.standardSamples
        : null;
      const evGap =
        typeof proEvDelta === "number" && typeof standardEvDelta === "number"
          ? proEvDelta - standardEvDelta
          : null;
      return {
        ...aggregate,
        proEvDelta,
        standardEvDelta,
        evGap,
      };
    })
    .sort((left, right) => {
      const leftScore = Math.abs((left.evGap ?? 0) * left.frequency);
      const rightScore = Math.abs((right.evGap ?? 0) * right.frequency);
      return rightScore - leftScore;
    });

  const topByVariant = {};
  const topByHandClass = {};
  const topByCategory = {};
  const topByStreet = {};

  ranked.forEach((entry) => {
    if (!topByVariant[entry.variantId]) topByVariant[entry.variantId] = entry;
    if (!topByHandClass[entry.handClass]) topByHandClass[entry.handClass] = entry;
    if (!topByCategory[entry.category]) topByCategory[entry.category] = entry;
    const streetKey = `draw-${entry.drawRound}|bet-${entry.bettingRound}`;
    if (!topByStreet[streetKey]) topByStreet[streetKey] = entry;
  });

  return {
    divergenceCount: divergences.length,
    ranked,
    topByVariant,
    topByHandClass,
    topByCategory,
    topByStreet,
  };
}
