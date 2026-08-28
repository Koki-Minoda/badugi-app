import { positionLabelForSeat } from "../../games/_core/audit/expectedBettingActor.js";

function normalizedPhase(frame) {
  return String(frame?.phase ?? frame?.event?.to ?? "EVENT").toUpperCase();
}

function seatForEvent(event = {}) {
  const candidates = [event.seat, event.actorSeat, event.playerSeat, event.fromSeat];
  const seat = candidates.find((value) => Number.isInteger(value) && value >= 0);
  return Number.isInteger(seat) ? seat : null;
}

function resolvePositions(handHistory) {
  const blindEvent = (handHistory?.events ?? []).find((event) => event?.type === "BLINDS_POSTED") ?? {};
  return {
    buttonSeat:
      handHistory?.buttonSeat ?? handHistory?.dealerSeat ?? blindEvent?.buttonSeat ?? null,
    sbSeat: handHistory?.sbSeat ?? blindEvent?.sbSeat ?? null,
    bbSeat: handHistory?.bbSeat ?? blindEvent?.bbSeat ?? null,
  };
}

function actionDescription(event = {}) {
  if (event.type === "BET_ACTION") {
    const action = String(event.action ?? "action").toUpperCase();
    const amount = Number(event.amount);
    return `${action}${Number.isFinite(amount) && amount > 0 ? ` ${amount.toLocaleString()}` : ""}`;
  }
  if (event.type === "DRAW_ACTION") {
    const count = Number.isFinite(event.drawCount)
      ? event.drawCount
      : Array.isArray(event.discarded)
        ? event.discarded.length
        : 0;
    return count === 0 ? "STAND PAT" : `DRAW ${count}`;
  }
  if (event.type === "ANTE_POSTED") return `ANTE ${Number(event.amount ?? 0).toLocaleString()}`;
  if (event.type === "BLINDS_POSTED") return "BLINDS POSTED";
  if (event.type === "PHASE_TRANSITION") return `${event.from ?? "?"} → ${event.to ?? "?"}`;
  if (event.type === "HAND_START") return "HAND START";
  if (event.type === "SHOWDOWN") return "SHOWDOWN";
  if (event.type === "HAND_END") return `HAND END · POT ${Number(event.totalPot ?? 0).toLocaleString()}`;
  return String(event.type ?? "EVENT").replaceAll("_", " ");
}

export function buildReplayTimeline(frames = [], handHistory = null) {
  const seats = handHistory?.seats ?? [];
  const names = new Map(
    seats.map((entry, index) => [
      Number.isInteger(entry?.seat) ? entry.seat : index,
      String(entry?.name ?? `Seat ${index}`),
    ]),
  );
  const positions = resolvePositions(handHistory);
  const playerCount = seats.length;
  const phaseCounts = new Map();
  const groups = [];
  let priorPhase = null;
  let actionOrder = 0;

  frames.forEach((frame, frameIndex) => {
    const phase = normalizedPhase(frame);
    if (phase !== priorPhase) {
      const occurrence = (phaseCounts.get(phase) ?? 0) + 1;
      phaseCounts.set(phase, occurrence);
      groups.push({ id: `${phase}-${occurrence}`, phase, occurrence, rows: [] });
      priorPhase = phase;
    }
    const event = frame?.event ?? {};
    const seat = seatForEvent(event);
    const isPlayerAction = ["BET_ACTION", "DRAW_ACTION", "ANTE_POSTED"].includes(event.type);
    if (isPlayerAction) actionOrder += 1;
    const resolvedPosition = seat === null
      ? null
      : positionLabelForSeat({ seat, playerCount, ...positions });
    const position = resolvedPosition && resolvedPosition !== "UNKNOWN"
      ? resolvedPosition
      : seat === null
        ? null
        : `Seat ${seat + 1}`;
    const playerName = seat === null ? null : names.get(seat) ?? `Seat ${seat + 1}`;
    groups.at(-1).rows.push({
      frame,
      frameIndex,
      actionOrder: isPlayerAction ? actionOrder : null,
      seat,
      playerName,
      position,
      description: actionDescription(event),
    });
  });

  return groups;
}
