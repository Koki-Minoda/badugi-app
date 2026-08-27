// src/games/badugi/flow/handReplay.js
import { applyChips } from "./actionUtils.js";

function finiteNumber(...values) {
  return values.find((value) => Number.isFinite(value));
}

function cloneCards(cards) {
  return Array.isArray(cards) ? [...cards] : [];
}

function historyActionsBySequence(history) {
  const actions = new Map();
  (history?.seats ?? []).forEach((seat) => {
    (seat?.actions ?? []).forEach((action) => {
      if (Number.isInteger(action?.seq)) actions.set(action.seq, action);
    });
  });
  return actions;
}

function firstRecordedHand(seat = {}) {
  if (Array.isArray(seat.initialHand)) return cloneCards(seat.initialHand);
  if (Array.isArray(seat.startHand)) return cloneCards(seat.startHand);
  for (const action of seat.actions ?? []) {
    const before = action?.metadata?.drawInfo?.before ?? action?.metadata?.betInfo?.before;
    if (Array.isArray(before)) return cloneCards(before);
  }
  return [];
}

function legacyForcedContribution(seat = {}) {
  return (seat?.actions ?? []).reduce((sum, action) => {
    const type = String(action?.type ?? "").toLowerCase();
    if (type !== "blind" && type !== "ante") return sum;
    return sum + Math.max(0, Number(action?.amount) || 0);
  }, 0);
}

function clonePlayers(seats = [], replaySchemaVersion = 1) {
  return seats.map((seat, index) => {
    const seatNumber = Number.isInteger(seat?.seat) ? seat.seat : index;
    const recordedStart = finiteNumber(seat?.startStack, seat?.initialStack, seat?.stack, 0);
    const adjustedStart =
      replaySchemaVersion >= 2 || !Number.isFinite(seat?.startStack)
        ? recordedStart
        : recordedStart + legacyForcedContribution(seat);
    return {
      seat: seatNumber,
      name: seat?.name ?? `Seat ${seatNumber}`,
      isHero: Boolean(seat?.isHero) || seatNumber === 0,
      stack: Math.max(
        0,
        Number(adjustedStart),
      ),
      totalInvested: 0,
      betThisRound: 0,
      folded: false,
      allIn: false,
      hasDrawn: false,
      hand: firstRecordedHand(seat),
    };
  });
}

function resolveHandEndWinners(history, event) {
  if (Array.isArray(event?.winners) && event.winners.length > 0) return event.winners;
  const potWinners = (history?.pots ?? []).flatMap((pot) =>
    (pot?.winners ?? []).map((winner) => ({
      seat: winner?.seat ?? winner?.seatIndex,
      amount: winner?.amount ?? winner?.collect ?? winner?.payout,
    })),
  );
  if (potWinners.length > 0) return potWinners;
  const summaryWinners = Array.isArray(history?.uiSummary?.winners)
    ? history.uiSummary.winners
    : (history?.uiSummary?.potDetails ?? []).flatMap((pot) => pot?.winners ?? []);
  return summaryWinners.map((winner) => ({
    seat: winner?.seat ?? winner?.seatIndex,
    amount: winner?.amount ?? winner?.collect ?? winner?.payout,
  }));
}

function findPlayer(players, seat) {
  if (!Number.isInteger(seat)) return null;
  return players.find((player) => player.seat === seat) ?? null;
}

function applyPayment(player, amount) {
  if (!player) return 0;
  const paid = applyChips(player, Math.max(0, Number(amount) || 0));
  player.betThisRound += paid;
  player.totalInvested += paid;
  player.allIn = player.stack === 0;
  return paid;
}

function resetRoundBets(players) {
  players.forEach((player) => {
    player.betThisRound = 0;
  });
}

function applyPlayersAfter(players, snapshots) {
  if (!Array.isArray(snapshots)) return;
  snapshots.forEach((snapshot) => {
    const target = findPlayer(players, snapshot?.seat);
    if (!target) return;
    if (Number.isFinite(snapshot.stack)) target.stack = Math.max(0, snapshot.stack);
    if (Number.isFinite(snapshot.betThisRound)) {
      target.betThisRound = Math.max(0, snapshot.betThisRound);
    }
    if (Number.isFinite(snapshot.totalInvested)) {
      target.totalInvested = Math.max(0, snapshot.totalInvested);
    }
    if (typeof snapshot.folded === "boolean") target.folded = snapshot.folded;
    if (typeof snapshot.allIn === "boolean") target.allIn = snapshot.allIn;
    if (Array.isArray(snapshot.hand)) target.hand = cloneCards(snapshot.hand);
  });
}

function applyRecordedCards(player, event, detail) {
  if (!player) return;
  const drawInfo = event?.drawInfo ?? detail?.metadata?.drawInfo ?? {};
  const before = event?.before ?? drawInfo.before;
  const after = event?.after ?? drawInfo.after ?? drawInfo.handAfter;
  const replacements = event?.replacedCards ?? drawInfo.replacedCards;

  if (!player.hand.length && Array.isArray(before)) player.hand = cloneCards(before);
  if (Array.isArray(after)) {
    player.hand = cloneCards(after);
    return;
  }
  if (Array.isArray(replacements)) {
    const next = cloneCards(player.hand);
    replacements.forEach((replacement) => {
      if (Number.isInteger(replacement?.index) && replacement.index >= 0) {
        next[replacement.index] = replacement.newCard;
      }
    });
    player.hand = next;
  }
}

function expectedEndStack(history, seat) {
  const entry = (history?.seats ?? []).find((candidate, index) => {
    const candidateSeat = Number.isInteger(candidate?.seat) ? candidate.seat : index;
    return candidateSeat === seat;
  });
  return Number.isFinite(entry?.endStack) ? entry.endStack : null;
}

/**
 * Rebuild immutable table frames from the canonical hand ledger.
 *
 * This is deliberately ledger replay, not a second RNG/game-engine run. New
 * records carry authoritative before/after chip and draw-card state; older
 * records fall back to their action deltas and legacy per-seat action detail.
 */
export function replayHandFromHistory(history) {
  if (!history || !Array.isArray(history.events)) return [];
  const players = clonePlayers(history.seats, history.replaySchemaVersion ?? 1);
  const actionDetails = historyActionsBySequence(history);
  let pot = 0;
  let phase = "HAND_START";
  let actingPlayerIndex = null;
  let awardedPot = null;
  let handEndReconciliation = [];
  const frames = [];

  const pushFrame = (event, index) => {
    frames.push({
      phase,
      actingPlayerIndex,
      pot,
      awardedPot,
      event,
      index,
      players: players.map((player) => ({ ...player, hand: cloneCards(player.hand) })),
      integrity: null,
    });
  };

  history.events.forEach((event, idx) => {
    awardedPot = null;
    const detail = Number.isInteger(event?.actionSeq)
      ? actionDetails.get(event.actionSeq) ?? null
      : null;
    switch (event?.type) {
      case "HAND_START":
        phase = "HAND_START";
        actingPlayerIndex = null;
        break;
      case "BLINDS_POSTED":
        pot += applyPayment(findPlayer(players, event.sbSeat), event.sbAmount);
        pot += applyPayment(findPlayer(players, event.bbSeat), event.bbAmount);
        break;
      case "ANTE_POSTED":
        pot += applyPayment(findPlayer(players, event.seat), event.amount);
        break;
      case "BET_ACTION": {
        actingPlayerIndex = Number.isInteger(event.seat) && event.seat >= 0 ? event.seat : null;
        const target = findPlayer(players, actingPlayerIndex);
        if (target) {
          const action = String(event.action ?? detail?.type ?? "").toLowerCase();
          if (action.startsWith("fold")) target.folded = true;
          applyPayment(target, finiteNumber(event.amount, detail?.amount, 0));
          if (Number.isFinite(event.stackAfter)) target.stack = Math.max(0, event.stackAfter);
          if (Number.isFinite(event.betAfter)) target.betThisRound = Math.max(0, event.betAfter);
          if (Number.isFinite(detail?.totalInvested)) {
            target.totalInvested = Math.max(target.totalInvested, detail.totalInvested);
          }
          target.allIn = target.stack === 0;
          if (Number.isFinite(event.potAfter)) pot = Math.max(0, event.potAfter);
          const before = event?.metadata?.betInfo?.before ?? detail?.metadata?.betInfo?.before;
          if (!target.hand.length && Array.isArray(before)) target.hand = cloneCards(before);
        }
        applyPlayersAfter(players, event.playersAfter);
        break;
      }
      case "DRAW_ACTION": {
        actingPlayerIndex = Number.isInteger(event.seat) && event.seat >= 0 ? event.seat : null;
        const target = findPlayer(players, actingPlayerIndex);
        if (target) {
          target.hasDrawn = true;
          target.drawCount = finiteNumber(event.drawCount, detail?.drawCount, 0);
          target.discarded = cloneCards(event.discarded ?? detail?.discarded);
          applyRecordedCards(target, event, detail);
          if (Number.isFinite(event.stackAfter)) target.stack = Math.max(0, event.stackAfter);
        }
        if (Number.isFinite(event.potAfter)) pot = Math.max(0, event.potAfter);
        applyPlayersAfter(players, event.playersAfter);
        break;
      }
      case "FOLLOW_UP_TARGET":
        actingPlayerIndex = Number.isInteger(event.seat) && event.seat >= 0 ? event.seat : null;
        phase = event.street ?? phase;
        break;
      case "PHASE_TRANSITION":
        phase = event?.to ?? phase;
        actingPlayerIndex = null;
        resetRoundBets(players);
        break;
      case "SHOWDOWN":
        phase = "SHOWDOWN";
        actingPlayerIndex = null;
        break;
      case "HAND_END": {
        phase = "HAND_END";
        actingPlayerIndex = null;
        const recordedPot = Math.max(0, Number(event.totalPot) || 0);
        awardedPot = recordedPot || pot;
        pot = awardedPot;
        const recordedFinalStacks = new Map(
          (event?.finalStacks ?? [])
            .filter(
              (snapshot) =>
                Number.isInteger(snapshot?.seat) &&
                Number.isFinite(snapshot?.stack),
            )
            .map((snapshot) => [snapshot.seat, snapshot.stack]),
        );
        resolveHandEndWinners(history, event).forEach((winner) => {
          const target = findPlayer(players, winner?.seat);
          if (!target) return;
          const payout = Math.max(0, Number(winner?.amount) || 0);
          // Some controller paths record a final COLLECT action with an
          // authoritative playersAfter snapshot before HAND_END. In that case
          // the award is already in the winner's stack and must not be applied
          // a second time by the replay ledger.
          const recordedFinalStack = recordedFinalStacks.get(target.seat);
          const payoutAlreadyApplied =
            Number.isFinite(recordedFinalStack) &&
            target.stack === recordedFinalStack;
          if (!payoutAlreadyApplied) target.stack += payout;
          pot = Math.max(0, pot - payout);
        });
        handEndReconciliation = (event?.finalStacks ?? [])
          .map((snapshot) => ({
            seat: snapshot?.seat,
            expected: snapshot?.stack,
            actual: findPlayer(players, snapshot?.seat)?.stack,
          }))
          .filter(
            (entry) =>
              Number.isFinite(entry.expected) &&
              Number.isFinite(entry.actual) &&
              entry.expected !== entry.actual,
          );
        applyPlayersAfter(players, event.finalStacks);
        break;
      }
      default:
        break;
    }
    pushFrame(event, idx);
  });

  const finalFrame = frames.at(-1);
  if (finalFrame?.event?.type === "HAND_END") {
    const stackMismatches = finalFrame.players
      .map((player) => ({
        seat: player.seat,
        expected: expectedEndStack(history, player.seat),
        actual: player.stack,
      }))
      .filter((entry) => entry.expected !== null && entry.expected !== entry.actual);
    finalFrame.integrity = {
      valid:
        stackMismatches.length === 0 &&
        handEndReconciliation.length === 0 &&
        finalFrame.pot === 0,
      stackMismatches,
      reconciliationMismatches: handEndReconciliation,
      remainingPot: finalFrame.pot,
    };
  }

  return frames;
}
