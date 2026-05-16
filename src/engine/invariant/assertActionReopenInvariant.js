import { streetKeyFromSnapshot } from "./invariantUtils.js";

function normalizeAction(action) {
  return String(action ?? "").trim().toUpperCase();
}

export function assertActionReopenInvariant(actionRows = [], context = {}) {
  const violations = [];
  const streets = new Map();
  for (const row of actionRows) {
    const key =
      row.streetKey ??
      [row.handId ?? "unknown", row.phase ?? "BET", row.drawRound ?? 0, row.betRound ?? ""].join(":");
    if (!streets.has(key)) streets.set(key, []);
    streets.get(key).push(row);
  }

  for (const [streetKey, rows] of streets.entries()) {
    let lastAggressor = null;
    let raiseSerial = 0;
    const actorRaiseSerial = new Map();
    for (const row of rows) {
      const actor = row.actorSeat;
      const action = normalizeAction(row.action);
      if (actor == null) continue;
      if (lastAggressor === actor && actorRaiseSerial.get(actor) === raiseSerial && action !== "RAISE") {
        violations.push({
          type: "ILLEGAL_RAISER_REACTION",
          message: "raiser acted again in the same betting round without an intervening re-raise",
          severity: "P0",
          variantId: context.variantId ?? row.variantId ?? null,
          mode: context.mode ?? row.mode ?? null,
          handId: row.handId ?? null,
          streetKey,
          actor,
          action,
        });
      }
      if (action === "RAISE" || action === "BET") {
        lastAggressor = actor;
        raiseSerial += 1;
        actorRaiseSerial.set(actor, raiseSerial);
      }
    }
  }
  return violations;
}

export function actionRowFromSnapshot({ before = {}, after = {}, actorSeat, action, mode, variantId } = {}) {
  return {
    handId: before.handId ?? after.handId ?? null,
    variantId,
    mode,
    streetKey: streetKeyFromSnapshot(before),
    phase: before.phase ?? after.phase ?? null,
    drawRound: before.drawRoundIndex ?? before.drawRound ?? after.drawRoundIndex ?? after.drawRound ?? 0,
    betRound: before.betRound ?? before.betRoundIndex ?? after.betRound ?? after.betRoundIndex ?? null,
    actorSeat,
    action,
  };
}

