function normalizeType(action) {
  return String(action?.type ?? action?.action ?? action ?? "").toUpperCase();
}

function findAction(legalActions = [], types = []) {
  const wanted = new Set(types.map((type) => String(type).toUpperCase()));
  return legalActions.find((action) => wanted.has(normalizeType(action))) ?? null;
}

function getActor(snapshot = {}) {
  if (typeof snapshot.currentActor === "number") return snapshot.currentActor;
  if (typeof snapshot.turn === "number") return snapshot.turn;
  if (typeof snapshot.nextTurn === "number") return snapshot.nextTurn;
  if (typeof snapshot.actingPlayerIndex === "number") return snapshot.actingPlayerIndex;
  if (typeof snapshot.metadata?.actingPlayerIndex === "number") return snapshot.metadata.actingPlayerIndex;
  return null;
}

function getPlayerBet(player = {}) {
  return Number(player.betThisStreet ?? player.betThisRound ?? player.bet ?? 0) || 0;
}

function getHandSize(player = {}) {
  const hand = player.hand ?? player.holeCards ?? player.cards ?? [];
  return Array.isArray(hand) ? hand.length : 0;
}

function buildDrawIndexes(player = {}, action = {}) {
  const handSize = getHandSize(player);
  const maxDiscard = Math.max(
    0,
    Math.min(
      handSize,
      Number(action.maxDiscard ?? action.maxDraw ?? action.max ?? handSize) || 0,
    ),
  );
  const minDiscard = Math.max(0, Number(action.minDiscard ?? action.minDraw ?? action.min ?? 0) || 0);
  const drawCount = Math.min(maxDiscard, minDiscard);
  return Array.from({ length: drawCount }, (_, idx) => idx);
}

export function chooseSafeAction({ snapshot = {}, legalActions = [], family = "unknown" } = {}) {
  const actor = getActor(snapshot);
  const player = snapshot.players?.[actor] ?? {};
  const phase = String(snapshot.phase ?? snapshot.street ?? "").toUpperCase();
  const currentBet = Number(snapshot.currentBet ?? snapshot.metadata?.currentBet ?? 0) || 0;
  const toCall = Math.max(0, currentBet - getPlayerBet(player));

  if (phase === "DRAW") {
    const draw = findAction(legalActions, ["DRAW", "PAT"]);
    return {
      type: "DRAW",
      action: "draw",
      discardIndexes: draw ? buildDrawIndexes(player, draw) : [],
      metadata: { discardIndexes: draw ? buildDrawIndexes(player, draw) : [] },
    };
  }

  const check = findAction(legalActions, ["CHECK"]);
  if (check || toCall <= 0) {
    return { type: "CHECK", action: "check", amount: 0, metadata: {} };
  }

  const call = findAction(legalActions, ["CALL"]);
  if (call || toCall > 0) {
    return { type: "CALL", action: "call", amount: toCall, metadata: {} };
  }

  const bet = findAction(legalActions, ["BET"]);
  if (bet) {
    return { type: "BET", action: "bet", amount: Number(bet.amount ?? bet.minAmount ?? 1) || 1, metadata: {} };
  }

  const raise = findAction(legalActions, family === "stud" ? ["COMPLETE", "RAISE"] : ["RAISE"]);
  if (raise) {
    return {
      type: normalizeType(raise) === "COMPLETE" ? "COMPLETE" : "RAISE",
      action: normalizeType(raise) === "COMPLETE" ? "complete" : "raise",
      amount: Number(raise.amount ?? raise.minAmount ?? 1) || 1,
      metadata: {},
    };
  }

  return { type: "FOLD", action: "fold", amount: 0, metadata: {} };
}
