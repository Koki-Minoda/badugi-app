// src/games/badugi/flow/handReplay.js
import { applyChips } from "./actionUtils.js";

function clonePlayers(players = []) {
  return players.map((player) => ({
    seat: player?.seat ?? null,
    name: player?.name ?? `Seat ${player?.seat ?? 0}`,
    stack: Math.max(0, Number(player?.stack) || 0),
    totalInvested: 0,
    betThisRound: 0,
    folded: false,
    hasDrawn: false,
  }));
}

function applyBlindPayment(players, seat, amount) {
  if (!Number.isInteger(seat)) return 0;
  const target = players[seat];
  if (!target) return 0;
  const resolved = Math.max(0, Number(amount) || 0);
  return applyChips(target, resolved);
}

export function replayHandFromHistory(history) {
  if (!history || !Array.isArray(history.events)) return [];
  const players = clonePlayers(history.seats);
  let pot = 0;
  let phase = "HAND_START";
  let actingPlayerIndex = null;
  const frames = [];
  const pushFrame = (event, index) => {
    frames.push({
      phase,
      actingPlayerIndex,
      pot,
      event,
      index,
      players: players.map((player) => ({ ...player })),
    });
  };

  history.events.forEach((event, idx) => {
    switch (event?.type) {
      case "HAND_START":
        phase = "HAND_START";
        actingPlayerIndex = null;
        break;
      case "BLINDS_POSTED":
        pot += applyBlindPayment(players, event.sbSeat, event.sbAmount);
        pot += applyBlindPayment(players, event.bbSeat, event.bbAmount);
        break;
      case "BET_ACTION": {
        actingPlayerIndex =
          Number.isInteger(event.seat) && event.seat >= 0 ? event.seat : null;
        if (actingPlayerIndex !== null) {
          const target = players[actingPlayerIndex];
          if (target) {
            if (typeof event.action === "string" && event.action.startsWith("fold")) {
              target.folded = true;
            }
            const pay = Math.max(0, Number(event.amount) || 0);
            const applied = applyChips(target, pay);
            pot += applied;
          }
        }
        break;
      }
      case "DRAW_ACTION":
        actingPlayerIndex =
          Number.isInteger(event.seat) && event.seat >= 0 ? event.seat : null;
        if (actingPlayerIndex !== null) {
          const target = players[actingPlayerIndex];
          if (target) {
            target.hasDrawn = true;
            target.discarded = Array.isArray(event.discarded)
              ? [...event.discarded]
              : [];
          }
        }
        break;
      case "FOLLOW_UP_TARGET":
        actingPlayerIndex =
          Number.isInteger(event.seat) && event.seat >= 0 ? event.seat : null;
        phase = event.street ?? phase;
        break;
      case "PHASE_TRANSITION":
        phase = event?.to ?? phase;
        actingPlayerIndex = null;
        break;
      case "SHOWDOWN":
        phase = "SHOWDOWN";
        actingPlayerIndex = null;
        break;
      case "HAND_END":
        phase = "HAND_END";
        actingPlayerIndex = null;
        (event?.winners ?? []).forEach((winner) => {
          if (!Number.isInteger(winner?.seat)) return;
          const target = players[winner.seat];
          if (!target) return;
          const payout = Math.max(0, Number(winner?.amount) || 0);
          target.stack += payout;
          pot = Math.max(0, pot - payout);
        });
        break;
      default:
        break;
    }
    pushFrame(event, idx);
  });

  return frames;
}
