import crypto from "node:crypto";

function stableNormalize(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stableNormalize(entry));
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((normalized, key) => {
        const nextValue = value[key];
        if (typeof nextValue === "undefined" || typeof nextValue === "function") {
          return normalized;
        }
        normalized[key] = stableNormalize(nextValue);
        return normalized;
      }, {});
  }
  return value;
}

function createHash(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(stableNormalize(payload))).digest("hex");
}

function normalizeLegalActions(legalActions = []) {
  return (Array.isArray(legalActions) ? legalActions : []).map((action) => {
    if (typeof action === "string") return { type: action.toUpperCase() };
    return {
      type: String(action?.type ?? "").toUpperCase(),
      amount: Number(action?.amount ?? action?.betAmount ?? 0) || 0,
      toCall: Number(action?.toCall ?? 0) || 0,
    };
  });
}

export function createReplayStateHash(state = {}) {
  const snapshot = state?.snapshot ?? state ?? {};
  const players = Array.isArray(snapshot.players)
    ? snapshot.players.map((player, seatIndex) => ({
        seatIndex,
        stack: Number(player?.stack ?? 0) || 0,
        folded: Boolean(player?.folded),
        allIn: Boolean(player?.allIn),
        cards: Array.isArray(player?.cards)
          ? player.cards.map((card) => String(card?.code ?? card ?? ""))
          : Array.isArray(player?.hand)
            ? player.hand.map((card) => String(card?.code ?? card ?? ""))
            : [],
      }))
    : [];
  return createHash({
    variantId: snapshot.variantId ?? state?.variantId ?? null,
    actorSeat:
      snapshot.currentActor ??
      snapshot.actingPlayerIndex ??
      snapshot.nextTurn ??
      snapshot.turn ??
      null,
    drawRound: snapshot.drawRound ?? snapshot.currentDrawRound ?? null,
    bettingRound: snapshot.bettingRound ?? snapshot.currentBettingRound ?? null,
    step: snapshot.step ?? state?.step ?? null,
    pot: Number(snapshot.pot ?? 0) || 0,
    stacks: players.map((player) => player.stack),
    players,
    legalActions: normalizeLegalActions(snapshot.legalActions),
    seed: snapshot.seed ?? state?.seed ?? null,
  });
}

export function createActionHash(action = null) {
  return createHash({
    type: String(action?.type ?? action?.action ?? action ?? "").toUpperCase(),
    amount: Number(action?.amount ?? action?.betAmount ?? 0) || 0,
    toCall: Number(action?.toCall ?? 0) || 0,
  });
}

export function createReplayTraceHash(trace = []) {
  return createHash(
    (Array.isArray(trace) ? trace : []).map((entry) => ({
      step: entry?.step ?? null,
      actor: entry?.actor ?? null,
      actionType: String(entry?.actionType ?? "").toUpperCase(),
      stateHash: entry?.stateHash ?? null,
    })),
  );
}
