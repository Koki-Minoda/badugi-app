import { evaluateBadugi, getWinnersByBadugi } from "../utils/badugiEvaluator.js";
import { saveTournamentHistory, saveHandHistory } from "../../../utils/history.js";

export function runShowdown({
  players = [],
  setPlayers,
  pots = [],
  setPots,
  dealerIdx = 0,
  dealNewHand,
  setShowNextButton,
  setPhase,
  setDrawRound,
  setTurn,
  setTransitioning,
  setCurrentBet,
  onShowdownComplete,
  engineResolveShowdown,
  precomputedResult,
  recordActionToLog,
  drawRound = 0,
  onHandFinished,
}) {
  const resolution =
    precomputedResult ??
    (typeof engineResolveShowdown === "function"
      ? engineResolveShowdown(players, pots)
      : null) ??
    resolveShowdownLegacy(players, pots);

  const updatedPlayers = (resolution?.players ?? players).map((p) => ({
    ...p,
    showHand: !p.folded,
    betThisRound: 0,
  }));

  console.log(
    "[SHOWDOWN] Players entering showdown:",
    updatedPlayers.map((player, seat) => ({
      seat,
      name: player.name,
      folded: Boolean(player.folded),
      seatOut: Boolean(player.seatOut),
      stack: player.stack,
      hand: (player.hand ?? []).join(" "),
      evaluation: evaluateBadugi(player.hand ?? []).rankType,
    }))
  );

  console.log(
    "[SHOWDOWN] Pots snapshot:",
    (pots ?? []).map((pot, index) => ({
      potIndex: index,
      amount: pot?.amount ?? 0,
      eligible: pot?.eligible ?? pot?.eligibleSeats ?? [],
    }))
  );

  const totalPot =
    resolution?.totalPot ?? computeTotalPot(pots ?? resolution?.pots ?? []);
  const summary = resolution?.summary ?? [];

  if (typeof recordActionToLog === "function" && summary.length > 0) {
    logPayoutSummary(recordActionToLog, summary, drawRound, updatedPlayers);
  }

  setPlayers?.(updatedPlayers);
  setPots?.([]);
  setShowNextButton?.(true);
  if (typeof onHandFinished === "function") {
    try {
      onHandFinished();
    } catch (err) {
      console.warn("[SHOWDOWN] onHandFinished callback failed", err);
    }
  }
  setPhase?.("SHOWDOWN");
  setTurn?.(null);
  setCurrentBet?.(0);
  setTransitioning?.(false);

  if (typeof setDrawRound === "function") {
    setDrawRound((prev = drawRound) => Math.min((prev ?? drawRound) + 1, 4));
  }

  try {
    saveHandHistory({
      ts: Date.now(),
      dealerIdx,
      players: updatedPlayers.map((p, i) => ({
        name: p.name,
        seat: i,
        stack: p.stack,
        folded: p.folded,
      })),
      pot: totalPot,
    });
  } catch (err) {
    console.warn("[SHOWDOWN] Failed to save hand history", err);
  }

  try {
    saveTournamentHistory({
      tsStart: Date.now() - 300000,
      tsEnd: Date.now(),
      tier: "store",
      buyIn: 1000,
      entries: players.length,
      finish: 1,
      prize: totalPot,
    });
  } catch (err) {
    console.warn("[SHOWDOWN] Failed to save tournament history", err);
  }

  if (typeof onShowdownComplete === "function") {
    try {
      onShowdownComplete(updatedPlayers, totalPot, summary);
    } catch (err) {
      console.warn("[SHOWDOWN] onShowdownComplete failed", err);
    }
  }

  const nextDealer = (dealerIdx + 1) % Math.max(players.length, 1);
  window.nextHandTrigger = () => {
    setPhase?.("INIT");
    setDrawRound?.(0);
    setTransitioning?.(false);
    setTurn?.(null);
    setPots?.([]);
    setCurrentBet?.(0);
    setPlayers?.(
      updatedPlayers.map((p) => ({
        ...p,
        betThisRound: 0,
        folded: false,
        hasDrawn: false,
        allIn: false,
        showHand: false,
      }))
    );
    dealNewHand?.(nextDealer, updatedPlayers.map((p) => ({ ...p })));
    setShowNextButton?.(false);
    delete window.nextHandTrigger;
  };
}

function resolveShowdownLegacy(players = [], pots = []) {
  const workingPlayers = players.map((p) => ({ ...p }));
  const applicablePots =
    Array.isArray(pots) && pots.length > 0 ? pots : buildFallbackPots(players);
  const summary = [];
  let totalPot = 0;

  applicablePots.forEach((pot, potIndex) => {
    const amount = Math.max(0, pot?.amount ?? 0);
    totalPot += amount;
    const eligibleSeats = Array.isArray(pot?.eligible)
      ? pot.eligible
      : Array.isArray(pot?.eligibleSeats)
      ? pot.eligibleSeats
      : [];
    let contenders = eligibleSeats
      .map((seatIndex) => ({
        seatIndex,
        player: workingPlayers[seatIndex],
      }))
      .filter(
        (entry) =>
          entry.player && !entry.player.folded && !entry.player.seatOut
      );

    if (!contenders.length) {
      const fallback = workingPlayers
        .map((player, idx) => ({ seatIndex: idx, player }))
        .filter(({ player }) => player && !player.folded && !player.seatOut);
      if (fallback.length) {
        contenders = fallback;
        console.warn(
          `[SHOWDOWN] pot ${potIndex} eligible list empty — falling back to active seats [${fallback
            .map((entry) => entry.seatIndex)
            .join(", ")}]`
        );
      }
    }

    if (!contenders.length) {
      summary.push({ potIndex, potAmount: amount, payouts: [] });
      return;
    }

    const winners = getWinnersByBadugi(
      contenders.map(({ seatIndex, player }) => ({
        seat: seatIndex,
        name: player.name,
        hand: player.hand ?? [],
      }))
    );

    if (!winners.length) {
      summary.push({ potIndex, potAmount: amount, payouts: [] });
      return;
    }

    const baseShare = Math.floor(amount / winners.length);
    let remainder = amount % winners.length;
    const payouts = [];

    winners.forEach((winner) => {
      const seatIndex = winner.seat;
      const target = workingPlayers[seatIndex];
      if (!target) return;
      const stackBefore = target.stack ?? 0;
      const payout = baseShare + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      target.stack = stackBefore + payout;
      target.betThisRound = 0;
      target.lastAction = `Collect ${payout}`;
      target.hasActedThisRound = false;
      target.isBusted = target.stack <= 0;
      payouts.push({
        seatIndex,
        name: target.name,
        payout,
        stackBefore,
        stackAfter: target.stack,
      });
    });

    summary.push({
      potIndex,
      potAmount: amount,
      payouts,
    });
  });

  return {
    players: workingPlayers,
    summary,
    totalPot,
  };
}

function buildFallbackPots(players = []) {
  const total = players.reduce(
    (sum, player) => sum + Math.max(0, player.betThisRound ?? 0),
    0
  );
  if (total <= 0) {
    return [
      {
        amount: 0,
        eligible: players
          .map((_, idx) => idx)
          .filter((seatIndex) => !players[seatIndex]?.folded),
      },
    ];
  }
  return [
    {
      amount: total,
      eligible: players
        .map((_, idx) => idx)
        .filter((seatIndex) => !players[seatIndex]?.folded),
    },
  ];
}

function computeTotalPot(pots = []) {
  return pots.reduce((sum, pot) => sum + Math.max(0, pot?.amount ?? 0), 0);
}

function logPayoutSummary(logger, summary, drawRound, players) {
  summary.forEach((potSummary) => {
    potSummary.payouts?.forEach((entry) => {
      logger({
        phase: "SHOWDOWN",
        round: drawRound + 1,
        seat: entry.seatIndex,
        seatName: entry.name,
        type: `Collect ${entry.payout}`,
        stackBefore: entry.stackBefore,
        stackAfter: entry.stackAfter,
        betBefore: 0,
        betAfter: 0,
        potAfter: 0,
        playerState: players?.[entry.seatIndex],
        metadata: {
          potIndex: potSummary.potIndex,
          potAmount: potSummary.potAmount,
          payout: entry.payout,
        },
      });
    });
  });
}
