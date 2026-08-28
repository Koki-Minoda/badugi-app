// src/games/badugi/flow/handReplay.js
import { applyChips } from "./actionUtils.js";

function finiteNumber(...values) {
  return values.find((value) => Number.isFinite(value));
}

function cloneCards(cards) {
  return Array.isArray(cards) ? [...cards] : [];
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
        phase = "POST_BLINDS";
        pot += applyPayment(findPlayer(players, event.sbSeat), event.sbAmount);
        pot += applyPayment(findPlayer(players, event.bbSeat), event.bbAmount);
        break;
      case "ANTE_POSTED":
        phase = "POST_BLINDS";
        pot += applyPayment(findPlayer(players, event.seat), event.amount);
        break;
      case "BET_ACTION": {
        phase = event?.street ?? detail?.street ?? "BET";
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
        phase = event?.street ?? detail?.street ?? "DRAW";
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

function pushIssue(issues, code, details = {}) {
  issues.push({ code, ...details });
}

function comparablePlayerSnapshot(player = {}) {
  return {
    stack: Math.max(0, Number(player.stack) || 0),
    betThisRound: Math.max(0, Number(player.betThisRound) || 0),
    totalInvested: Math.max(0, Number(player.totalInvested) || 0),
    folded: Boolean(player.folded),
    allIn: Boolean(player.allIn),
    hand: cloneCards(player.hand),
  };
}

/**
 * Verify that a canonical v2 hand record is sufficient to reproduce the hand,
 * rather than merely render a plausible timeline. The audit cross-checks the
 * per-seat action ledger against the ordered event ledger and checks every
 * authoritative card/chip snapshot plus the final settlement.
 */
export function auditHandReplayFidelity(history, replayFrames = null) {
  const frames = replayFrames ?? replayHandFromHistory(history);
  const issues = [];
  const events = Array.isArray(history?.events) ? history.events : [];
  const seats = Array.isArray(history?.seats) ? history.seats : [];

  if ((history?.replaySchemaVersion ?? 0) < 2) {
    pushIssue(issues, "NON_CANONICAL_SCHEMA", {
      expectedMinimum: 2,
      actual: history?.replaySchemaVersion ?? null,
    });
  }
  if (!events.length) pushIssue(issues, "EVENT_LEDGER_MISSING");
  if (events[0]?.type !== "HAND_START") {
    pushIssue(issues, "HAND_START_MISSING", { actual: events[0]?.type ?? null });
  }
  if (events.at(-1)?.type !== "HAND_END") {
    pushIssue(issues, "HAND_END_MISSING", { actual: events.at(-1)?.type ?? null });
  }
  if (frames.length !== events.length) {
    pushIssue(issues, "FRAME_COUNT_MISMATCH", {
      expected: events.length,
      actual: frames.length,
    });
  }

  const seatNumbers = seats.map((seat, index) =>
    Number.isInteger(seat?.seat) ? seat.seat : index,
  );
  if (new Set(seatNumbers).size !== seatNumbers.length) {
    pushIssue(issues, "DUPLICATE_SEAT");
  }
  seats.forEach((seat, seatIndex) => {
    const seatNumber = seatNumbers[seatIndex];
    if (!Number.isFinite(seat?.startStack) || !Number.isFinite(seat?.endStack)) {
      pushIssue(issues, "SEAT_STACK_SNAPSHOT_MISSING", { seat: seatNumber });
    }
    if (!Array.isArray(seat?.initialHand)) {
      pushIssue(issues, "INITIAL_CARDS_MISSING", { seat: seatNumber });
    }
  });

  const actionLedger = new Map();
  seats.forEach((seat, seatIndex) => {
    const seatNumber = Number.isInteger(seat?.seat) ? seat.seat : seatIndex;
    (seat?.actions ?? []).forEach((action) => {
      if (!Number.isInteger(action?.seq)) {
        pushIssue(issues, "ACTION_SEQUENCE_MISSING", { seat: seatNumber });
        return;
      }
      if (actionLedger.has(action.seq)) {
        pushIssue(issues, "DUPLICATE_ACTION_SEQUENCE", { actionSeq: action.seq });
        return;
      }
      actionLedger.set(action.seq, { ...action, seat: seatNumber });
    });
  });

  const replayedActionSequences = new Set();
  let priorActionSequence = -Infinity;
  let priorTimestamp = -Infinity;

  events.forEach((event, eventIndex) => {
    const frame = frames[eventIndex];
    const priorFrame = eventIndex > 0 ? frames[eventIndex - 1] : null;
    const expectedEventPhase = {
      HAND_START: "HAND_START",
      BLINDS_POSTED: "POST_BLINDS",
      ANTE_POSTED: "POST_BLINDS",
      PHASE_TRANSITION: event?.to,
      SHOWDOWN: "SHOWDOWN",
      HAND_END: "HAND_END",
    }[event?.type];
    if (expectedEventPhase && frame?.phase !== expectedEventPhase) {
      pushIssue(issues, "EVENT_PHASE_MISMATCH", {
        eventIndex,
        expected: expectedEventPhase,
        actual: frame?.phase ?? null,
      });
    }
    if (Number.isFinite(event?.timestamp)) {
      if (event.timestamp < priorTimestamp) {
        pushIssue(issues, "EVENT_TIMESTAMP_REGRESSION", {
          eventIndex,
          previous: priorTimestamp,
          actual: event.timestamp,
        });
      }
      priorTimestamp = event.timestamp;
    }

    if (event?.type === "BET_ACTION" || event?.type === "DRAW_ACTION") {
      if (!Number.isFinite(event?.potAfter)) {
        pushIssue(issues, "POT_SNAPSHOT_MISSING", { eventIndex });
      }
      if (!Array.isArray(event?.playersAfter) || event.playersAfter.length !== seats.length) {
        pushIssue(issues, "PLAYER_SNAPSHOT_MISSING", { eventIndex });
      }
      if (!Number.isInteger(event.actionSeq)) {
        pushIssue(issues, "EVENT_ACTION_SEQUENCE_MISSING", { eventIndex });
      } else {
        if (replayedActionSequences.has(event.actionSeq)) {
          pushIssue(issues, "DUPLICATE_REPLAYED_ACTION", {
            eventIndex,
            actionSeq: event.actionSeq,
          });
        }
        if (event.actionSeq <= priorActionSequence) {
          pushIssue(issues, "ACTION_ORDER_MISMATCH", {
            eventIndex,
            previous: priorActionSequence,
            actual: event.actionSeq,
          });
        }
        priorActionSequence = event.actionSeq;
        replayedActionSequences.add(event.actionSeq);
        const source = actionLedger.get(event.actionSeq);
        if (!source) {
          pushIssue(issues, "ACTION_LEDGER_ENTRY_MISSING", {
            eventIndex,
            actionSeq: event.actionSeq,
          });
        } else {
          if (source.seat !== event.seat) {
            pushIssue(issues, "ACTION_SEAT_MISMATCH", {
              eventIndex,
              actionSeq: event.actionSeq,
              expected: source.seat,
              actual: event.seat,
            });
          }
          const sourceType = String(source.type ?? "").toLowerCase();
          const expectedType = event.type === "DRAW_ACTION"
            ? (Number(event.drawCount) === 0 ? ["draw", "pat"] : ["draw"])
            : [String(event.action ?? "").toLowerCase()];
          if (!expectedType.includes(sourceType)) {
            pushIssue(issues, "ACTION_TYPE_MISMATCH", {
              eventIndex,
              actionSeq: event.actionSeq,
              expected: source.type,
              actual: event.type === "DRAW_ACTION" ? "draw" : event.action,
            });
          }
          if (
            event.type === "DRAW_ACTION" &&
            Number.isFinite(source.drawCount) &&
            Number(source.drawCount) !== Number(event.drawCount)
          ) {
            pushIssue(issues, "DRAW_COUNT_MISMATCH", {
              eventIndex,
              actionSeq: event.actionSeq,
              expected: source.drawCount,
              actual: event.drawCount,
            });
          }
          if (
            event.type === "BET_ACTION" &&
            Math.max(0, Number(source.amount) || 0) !== Math.max(0, Number(event.amount) || 0)
          ) {
            pushIssue(issues, "ACTION_AMOUNT_MISMATCH", {
              eventIndex,
              actionSeq: event.actionSeq,
              expected: source.amount,
              actual: event.amount,
            });
          }
        }
      }
    }

    if (event?.type === "BET_ACTION" && frame?.phase !== (event?.street ?? actionLedger.get(event.actionSeq)?.street ?? "BET")) {
      pushIssue(issues, "BET_PHASE_MISMATCH", { eventIndex, actual: frame?.phase ?? null });
    }
    if (event?.type === "DRAW_ACTION") {
      const expectedPhase = event?.street ?? actionLedger.get(event.actionSeq)?.street ?? "DRAW";
      if (frame?.phase !== expectedPhase) {
        pushIssue(issues, "DRAW_PHASE_MISMATCH", { eventIndex, actual: frame?.phase ?? null });
      }
      const beforePlayer = priorFrame?.players?.find((player) => player.seat === event.seat);
      const afterPlayer = frame?.players?.find((player) => player.seat === event.seat);
      const recordedAfter = event?.playersAfter?.find(
        (player) => player?.seat === event.seat,
      );
      const hasBeforeCards = Array.isArray(event.before) || Array.isArray(beforePlayer?.hand);
      const hasAfterCards = Array.isArray(event.after) || Array.isArray(recordedAfter?.hand);
      if (!hasBeforeCards || !hasAfterCards) {
        pushIssue(issues, "DRAW_CARD_SNAPSHOT_MISSING", { eventIndex, seat: event.seat });
      }
      if (Array.isArray(event.before) && !sameValue(beforePlayer?.hand ?? [], event.before)) {
        pushIssue(issues, "DRAW_BEFORE_CARDS_MISMATCH", { eventIndex, seat: event.seat });
      }
      if (Array.isArray(event.after) && !sameValue(afterPlayer?.hand ?? [], event.after)) {
        pushIssue(issues, "DRAW_AFTER_CARDS_MISMATCH", { eventIndex, seat: event.seat });
      }
    }

    if (Array.isArray(event?.playersAfter)) {
      event.playersAfter.forEach((snapshot) => {
        const replayed = frame?.players?.find((player) => player.seat === snapshot?.seat);
        if (!replayed || !sameValue(comparablePlayerSnapshot(replayed), comparablePlayerSnapshot(snapshot))) {
          pushIssue(issues, "PLAYER_SNAPSHOT_MISMATCH", {
            eventIndex,
            seat: snapshot?.seat ?? null,
          });
        }
      });
    }
    if (Number.isFinite(event?.potAfter) && frame?.pot !== Math.max(0, event.potAfter)) {
      pushIssue(issues, "POT_SNAPSHOT_MISMATCH", {
        eventIndex,
        expected: event.potAfter,
        actual: frame?.pot ?? null,
      });
    }
  });

  actionLedger.forEach((action, actionSeq) => {
    const type = String(action?.type ?? "").toLowerCase();
    if (!["blind", "ante"].includes(type) && !replayedActionSequences.has(actionSeq)) {
      pushIssue(issues, "ACTION_EVENT_MISSING", { actionSeq, seat: action.seat });
    }
  });

  const finalFrame = frames.at(-1);
  if (finalFrame?.event?.type === "HAND_END") {
    if (
      !Array.isArray(finalFrame.event.finalStacks) ||
      finalFrame.event.finalStacks.length !== seats.length
    ) {
      pushIssue(issues, "FINAL_STACK_SNAPSHOT_MISSING");
    }
    if (!finalFrame.integrity?.valid) {
      pushIssue(issues, "FINAL_RECONCILIATION_FAILED", {
        integrity: finalFrame.integrity ?? null,
      });
    }
    const startTotal = seats.reduce(
      (sum, seat) => sum + Math.max(0, Number(finiteNumber(seat?.startStack, seat?.initialStack, seat?.stack, 0)) || 0),
      0,
    );
    const endTotal = finalFrame.players.reduce(
      (sum, player) => sum + Math.max(0, Number(player?.stack) || 0),
      0,
    );
    if (startTotal !== endTotal) {
      pushIssue(issues, "CHIP_CONSERVATION_FAILED", {
        expected: startTotal,
        actual: endTotal,
      });
    }
  }

  return {
    valid: issues.length === 0,
    schemaVersion: history?.replaySchemaVersion ?? null,
    historySource: history?.tournamentId || history?.historySource === "tournament"
      ? "tournament"
      : "cash",
    eventCount: events.length,
    actionCount: replayedActionSequences.size,
    issues,
  };
}
