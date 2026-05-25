// src/games/badugi/logic/roundFlow.jsx

import { debugLog } from "../../../utils/debugLog.js";
import {
  isFoldedOrOut,
  maxBetThisRound,
  isSeatEligibleForBet,
  isSeatEligibleForDraw,
} from "../flow/actionUtils.js";
import {
  needsActionForBet,
} from "../flow/betRoundUtils.js";
import { findNextActorSeatForPhase } from "../flow/nextActorUtils.js";

export {
  isFoldedOrOut,
  aliveBetPlayers,
  aliveDrawPlayers,
  nextAliveFrom,
  maxBetThisRound,
  isSeatEligibleForBet,
} from "../flow/actionUtils.js";
export {
  isBetRoundComplete,
  closingSeatForAggressor,
  analyzeBetSnapshot,
  needsActionForBet,
} from "../flow/betRoundUtils.js";

export function resetBetRoundFlags(players = []) {
  if (!Array.isArray(players)) return [];
  let changed = false;
  const normalized = players.map((player) => {
    if (!player) return player;
    if (!isSeatEligibleForBet(player)) return player;
    if (player.hasActedThisRound === false) {
      return player;
    }
    changed = true;
    return {
      ...player,
      hasActedThisRound: false,
    };
  });
  return changed ? normalized : players;
}

export function resetDrawRoundFlags(players = []) {
  if (!Array.isArray(players)) return [];
  return players.map((player) => {
    if (!player) return player;
    const out =
      isFoldedOrOut(player) ||
      player?.isBusted ||
      player?.isActiveInGame === false;
    return {
      ...player,
      lastAction: out ? player.lastAction ?? "" : "",
      hasDrawn: out ? true : false,
      canDraw: !out,
      hasActedThisRound: out ? true : false,
    };
  });
}

export function resetBetStreetForNextRound(players = []) {
  if (!Array.isArray(players)) return [];
  return players.map((player) => {
    if (!player) return player;
    const out =
      isFoldedOrOut(player) ||
      player?.seatOut ||
      player?.isBusted ||
      player?.isActiveInGame === false;
    return {
      ...player,
      betThisRound: 0,
      bet: 0,
      lastAction: out ? player.lastAction ?? "" : "",
      hasActedThisRound: Boolean(out || player?.allIn),
    };
  });
}

export function shouldSkipDrawRound(state = {}) {
  if (state?.meta?.forceDrawRound) return false;
  const players = Array.isArray(state?.players) ? state.players : [];
  return !players.some(
    (player) =>
      isSeatEligibleForDraw(player) && !player?.hasDrawn && !player?.hasActedThisRound,
  );
}

// NOTE (G-08):
// Phase transitions must go through the helpers below so every BET/DRAW/SHOWDOWN
// entry point shares the same side effects (flag resets, seat selection,
// showdown wiring). Do not call setPhase("BET"/"DRAW"/"SHOWDOWN") directly
// when advancing a hand; use these helpers instead.
export function transitionToShowdownPhase({
  players = [],
  pots = [],
  setPlayers,
  setPots,
  setPhase,
  dealerIdx = 0,
  drawRound = 0,
  runShowdown,
  dealNewHand,
  setShowNextButton,
  onShowdownComplete,
  engineResolveShowdown,
  recordActionToLog,
  onHandFinished,
  precomputedResult = null,
  fromPhase = null,
  onPhaseTransition,
  onShowdownEntered,
} = {}) {
  if (typeof setPlayers === "function" && players) {
    setPlayers(players);
  }
  if (typeof setPots === "function" && pots) {
    setPots(pots);
  }
  if (typeof setPhase === "function") {
    setPhase("SHOWDOWN");
  }
  onPhaseTransition?.(fromPhase, "SHOWDOWN");
  onShowdownEntered?.();
  runShowdown?.({
    players,
    setPlayers,
    pots,
    setPots,
    dealerIdx,
    dealNewHand,
    setShowNextButton,
    onShowdownComplete,
    engineResolveShowdown,
    precomputedResult,
    recordActionToLog,
    drawRound,
    onHandFinished,
  });
}

export function transitionToDrawPhase({
  players = [],
  pots = [],
  setPlayers,
  setPots,
  setPhase,
  setDrawRound,
  setTurn,
  dealerIdx = 0,
  nextRound = 0,
  actingPlayerIndex = null,
  NUM_PLAYERS = players.length || 6,
  setTransitioning,
  fromPhase = null,
  onPhaseTransition,
  meta = null,
  onSkipDrawRound,
  forceDrawRound = false,
} = {}) {
  if (!forceDrawRound && shouldSkipDrawRound({ players, meta })) {
    debugLog(`[FLOW] skip DRAW round ${nextRound} (no actionable draw seats)`);
    onPhaseTransition?.(fromPhase, "DRAW_SKIPPED");
    onSkipDrawRound?.({
      players,
      pots,
      nextRound,
      actingPlayerIndex,
      dealerIdx,
      NUM_PLAYERS,
    });
    return false;
  }
  if (typeof setDrawRound === "function") {
    setDrawRound(nextRound);
  }
  if (typeof setPlayers === "function" && players) {
    setPlayers(players);
  }
  if (typeof setPots === "function" && pots) {
    setPots(pots);
  }
  const fallbackSeat = calcDrawStartIndex(dealerIdx, nextRound, NUM_PLAYERS);
  const resolvedTurn =
    typeof actingPlayerIndex === "number" ? actingPlayerIndex : fallbackSeat;
  setTurn?.(resolvedTurn);
  setPhase?.("DRAW");
  onPhaseTransition?.(fromPhase, "DRAW");
  if (typeof setTransitioning === "function") {
    setTransitioning(true);
    setTimeout(() => setTransitioning(false), 500);
  }
  return true;
}

export function transitionToBetPhase({
  players = [],
  setPlayers,
  setPhase,
  setTurn,
  turnSeat = null,
  setBetHead,
  betHeadSeat = null,
  fromPhase = null,
  onPhaseTransition,
} = {}) {
  const nextPlayers =
    fromPhase === "DRAW" ? resetBetStreetForNextRound(players) : players;
  if (typeof setPlayers === "function" && players) {
    setPlayers(nextPlayers);
  }
  setPhase?.("BET");
  onPhaseTransition?.(fromPhase, "BET");
  if (typeof turnSeat === "number") {
    setTurn?.(turnSeat);
  }
  if (typeof setBetHead === "function") {
    const resolvedHead =
      typeof betHeadSeat === "number" ? betHeadSeat : turnSeat ?? null;
    setBetHead(resolvedHead);
  }
}

// --- sanitizeStacks:  all-in---

function sanitizeStacks(snap, setPlayers) {
  const corrected = snap.map(p => {
    if (p.stack <= 0 && !p.allIn) {
      console.warn(`[SANITIZE] ${p.name} stack=${p.stack} -> mark all-in`);
      return { ...p, stack: 0, allIn: true };
    }
    return p;
  });

  if (setPlayers) setPlayers(corrected);

  console.table(
    corrected.map((p, i) => ({
      i,
      name: p.name,
      allIn: p.allIn,
      hasDrawn: p.hasDrawn,
      stack: p.stack,
      folded: p.folded,
      isBusted: p.isBusted,
    }))
  );
  return corrected;
}





// ===  ===

// --- BETll-in--

export const calcDrawStartIndex = (dealerIdx = 0, streetIndex = 0, numPlayers = 6) => {

  // DRAWSBtreetIndex

  void streetIndex;

  return (dealerIdx + 1) % numPlayers;

};



// === ===

export function settleStreetToPots(playersSnap = [], prevPots = []) {
  debugLog("[SETTLE] start");
  const cleared = playersSnap.map((p) => ({
    ...p,
    betThisRound: 0,
  }));
  const pots = buildSidePots(cleared);
  return {
    pots: pots.length ? pots : prevPots,
    clearedPlayers: cleared,
  };
}

export function buildSidePots(playersSnap = []) {
  const working = playersSnap.map((player, seat) => ({
    seat,
    committed: Math.max(
      0,
      typeof player?.totalInvested === "number"
        ? player.totalInvested
        : player?.betThisRound ?? 0
    ),
    folded: isFoldedOrOut(player),
  }));

  const rawPots = [];

  while (true) {
    const active = working.filter((entry) => entry.committed > 0);
    if (!active.length) break;
    const minContribution = Math.min(...active.map((entry) => entry.committed));
    if (!Number.isFinite(minContribution) || minContribution <= 0) break;

    const amount = minContribution * active.length;
    const eligible = active
      .filter((entry) => !entry.folded)
      .map((entry) => entry.seat);

    rawPots.push({
      amount,
      eligible,
    });

    active.forEach((entry) => {
      entry.committed = Math.max(0, entry.committed - minContribution);
    });
  }

  return mergeEquivalentPots(rawPots);
}

function mergeEquivalentPots(pots = []) {
  const merged = [];
  pots.forEach((pot) => {
    if (!pot || pot.amount <= 0) return;
    const eligibleSorted = Array.from(new Set(pot.eligible ?? [])).sort(
      (a, b) => a - b
    );
    if (!eligibleSorted.length) {
      merged.push({ amount: pot.amount, eligible: eligibleSorted });
      return;
    }
    const last = merged[merged.length - 1];
    if (
      last &&
      last.eligible.length === eligibleSorted.length &&
      last.eligible.every((seat, idx) => seat === eligibleSorted[idx])
    ) {
      last.amount += pot.amount;
    } else {
      merged.push({ amount: pot.amount, eligible: eligibleSorted });
    }
  });
  return merged;
}



// === BET DRAW/SHOWDOWN ===

// ANALYSIS: (A)(B) BETの決着は shouldAdvance / maxDraws 判定から到達し、
//           needsActionForBet() が false になれば DRAW へ進む。
//           全員 all-in や残存プレイヤー1名の場合でも
//           activeNonAllIn/nextRound > MAX_DRAWS の条件で SHOWDOWN にフォールバックし、
//           DRAW を勝手にスキップする分岐は存在しない。
export function finishBetRoundFrom({

  players,

  pots,

  setPlayers,

  setPots,

  drawRound,

  setDrawRound,

  setPhase,

  setTurn,

  setBetHead,

  dealerIdx,

  NUM_PLAYERS,

  MAX_DRAWS,

  runShowdown,

  dealNewHand,

  setShowNextButton,

  setTransitioning,

  onShowdownComplete,

  onEngineSync,

  engineAdvance,

  engineResolveShowdown,

  recordActionToLog,

  onHandFinished,

  onPhaseTransition,

  onShowdownEntered,

}) {

  debugLog(`[BET] finishBetRoundFrom args dealerIdx=${dealerIdx} drawRound=${drawRound} MAX_DRAWS=${MAX_DRAWS}`);



  if (typeof drawRound === "undefined" || isNaN(drawRound)) {

    console.warn("[finishBetRoundFrom] drawRound undefined, defaulting to 0");

    drawRound = 0;



  }

  debugLog(`[ BET] finishBetRoundFrom start drawRound=${drawRound}`);

  const handleDrawRoundSkipped = ({
    players: skipPlayers = [],
    pots: skipPots = [],
    nextRoundIndex = drawRound + 1,
    actingPlayerIndex = null,
  } = {}) => {
    const betReady = resetBetStreetForNextRound(skipPlayers);
    const playerCount = NUM_PLAYERS || betReady.length || 1;
    const startSeat = ((dealerIdx + 1) % playerCount + playerCount) % playerCount;
    const resolvedTurn =
      typeof actingPlayerIndex === "number"
        ? actingPlayerIndex
        :
          findNextActorSeatForPhase({
            phase: "DRAW",
            players: betReady,
            startIdx: startSeat,
          }) ?? startSeat;
    if (typeof setDrawRound === "function") {
      setDrawRound(nextRoundIndex);
    }
    transitionToBetPhase({
      players: betReady,
      setPlayers,
      setPhase,
      setTurn,
      setBetHead,
      turnSeat: resolvedTurn,
      betHeadSeat: startSeat,
      fromPhase: "DRAW",
      onPhaseTransition,
    });
    debugLog(`[FLOW] DRAW round ${nextRoundIndex} skipped (no actionable draw seats)`);
    recordActionToLog?.({
      type: "SKIP_DRAW_ROUND",
      round: nextRoundIndex,
      phase: "DRAW",
      at: Date.now(),
    });
    onEngineSync?.({
      reason: "roundFlow:draw-skipped",
      playersSnapshot: betReady,
      potsSnapshot: skipPots ?? [],
      street: "BET",
      drawRoundIndex: nextRoundIndex,
      actingIndex: resolvedTurn,
    });
  };

  if (typeof engineAdvance === "function") {
    try {
      const outcome = engineAdvance({
        drawRound,
        dealerIndex: dealerIdx,
        maxDraws: MAX_DRAWS,
        numPlayers: NUM_PLAYERS,
      });
      if (outcome?.state) {
        const nextPlayers = outcome.players ?? outcome.state.players ?? players;
        const nextPots = outcome.pots ?? outcome.state.pots ?? pots;

        const drawReadyPlayers = resetDrawRoundFlags(nextPlayers);
        const hasNonAllInEligibleDrawer = drawReadyPlayers.some(
          (p) => p && !p.allIn && isSeatEligibleForDraw(p)
        );
        const earlyShowdown =
          (outcome.showdown || outcome.street === "SHOWDOWN") &&
          hasNonAllInEligibleDrawer &&
          drawRound < MAX_DRAWS;

        if (!earlyShowdown && (outcome.showdown || outcome.street === "SHOWDOWN")) {
          let showdownResult = null;
          if (typeof engineResolveShowdown === "function") {
            showdownResult = engineResolveShowdown(nextPlayers, nextPots);
          }
          const showdownPlayers = showdownResult?.players ?? nextPlayers;
          const showdownPots = showdownResult?.pots ?? nextPots;
          transitionToShowdownPhase({
            players: showdownPlayers,
            pots: showdownPots ?? [],
            setPlayers,
            setPots,
            setPhase,
            dealerIdx,
            dealNewHand,
            setShowNextButton,
            onShowdownComplete,
            engineResolveShowdown,
            runShowdown,
            precomputedResult: showdownResult,
            recordActionToLog,
            drawRound,
            onHandFinished,
            fromPhase: "BET",
            onPhaseTransition,
            onShowdownEntered,
          });
          return;
        }

        const nextRound = outcome.drawRoundIndex ?? drawRound + 1;
        const enteredDraw = transitionToDrawPhase({
          players: drawReadyPlayers,
          pots: nextPots,
          setPlayers,
          setPots,
          setPhase,
          setDrawRound,
          setTurn,
          dealerIdx,
          nextRound,
          actingPlayerIndex: outcome.actingPlayerIndex,
          NUM_PLAYERS,
          setTransitioning,
          fromPhase: "BET",
          onPhaseTransition,
          meta: outcome?.state?.metadata ?? outcome?.metadata ?? null,
          onSkipDrawRound: ({ players: skipPlayers, pots: skipPots }) =>
            handleDrawRoundSkipped({
              players: skipPlayers ?? drawReadyPlayers,
              pots: skipPots ?? nextPots,
              nextRoundIndex: nextRound,
              actingPlayerIndex: outcome.actingPlayerIndex,
            }),
        });
        if (enteredDraw === false) {
          return;
        }
        return;
      }
    } catch (err) {
      console.error("[ENGINE] advanceAfterBet failed, using legacy round flow", err);
    }
  }

  // 1 BET

  const { pots: newPots, clearedPlayers } = settleStreetToPots(players, pots);

  setPots(newPots);

  setPlayers(clearedPlayers);
  const actionablePlayers = clearedPlayers.filter(
    (p) => p && !p.folded && !p.allIn && !p.seatOut
  );
  const maxOutstandingBet = maxBetThisRound(clearedPlayers);
  const incomplete = actionablePlayers.filter((p) =>
    needsActionForBet(p, maxOutstandingBet)
  );
  if (incomplete.length > 0) {
    console.warn(
      "[finishBetRoundFrom] action list incomplete, forcing continuation:",
      incomplete.map((p) => ({
        seat: p.seat ?? null,
        name: p.name,
      }))
    );
    const nextSeat = incomplete[0].seat ?? 0;
    setTurn(nextSeat);
    if (typeof setBetHead === "function") {
      setBetHead(nextSeat);
    }
    return;
  }
  onEngineSync?.({
    reason: "roundFlow:settle",
    playersSnapshot: clearedPlayers,
    potsSnapshot: newPots,
    street: "BET",
    drawRoundIndex: drawRound,
    actingIndex: dealerIdx,
  });



  // 2 DRAWETHOWDOWN

  const nextRound = drawRound + 1;



  if (nextRound > MAX_DRAWS) {
    debugLog(" Final betting complete SHOWDOWN");
    onEngineSync?.({
      reason: "roundFlow:showdown",
      playersSnapshot: clearedPlayers,
      potsSnapshot: newPots,
      street: "SHOWDOWN",
      drawRoundIndex: drawRound,
      actingIndex: dealerIdx,
    });

    transitionToShowdownPhase({
      players: clearedPlayers,
      pots: newPots,
      setPlayers,
      setPots,
      setPhase,
      dealerIdx,
      dealNewHand,
      setShowNextButton,
      onShowdownComplete,
      engineResolveShowdown,
      runShowdown,
      recordActionToLog,
      drawRound,
      onHandFinished,
      fromPhase: "BET",
      onPhaseTransition,
      onShowdownEntered,
    });

    return;
  }



  // 3 DRAWalcDrawStartIndex



  const baseDrawStart = calcDrawStartIndex(dealerIdx, nextRound, NUM_PLAYERS);



  let firstToDraw = baseDrawStart;



  let found = false;



  for (let i = 0; i < NUM_PLAYERS; i++) {



    const idx = (baseDrawStart + i) % NUM_PLAYERS;



    const p = clearedPlayers[idx];



    if (!isFoldedOrOut(p)) {



      firstToDraw = idx;



      found = true;



      break;



    }



  }



  if (!found) {



    console.error("[finishBetRoundFrom] No non-folded players found abort");



    return;



  }







  // ---  hasDrawnfalseRAW#1--

  const resetPlayers = resetDrawRoundFlags(clearedPlayers);

  const enteredDraw = transitionToDrawPhase({
    players: resetPlayers,
    pots: newPots,
    setPlayers,
    setPots,
    setPhase,
    setDrawRound,
    setTurn,
    dealerIdx,
    nextRound,
    actingPlayerIndex: firstToDraw,
    NUM_PLAYERS,
    setTransitioning,
    fromPhase: "BET",
    onPhaseTransition,
    onSkipDrawRound: ({ players: skipPlayers, pots: skipPots }) =>
      handleDrawRoundSkipped({
        players: skipPlayers ?? resetPlayers,
        pots: skipPots ?? newPots,
        nextRoundIndex: nextRound,
        actingPlayerIndex: firstToDraw,
      }),
  });

  if (enteredDraw === false) {
    return;
  }

  debugLog(`[FLOW] DRAW #${nextRound} (SB=${firstToDraw})`);

  if (typeof setBetHead === "function") {
    setBetHead(firstToDraw);
  }
  onEngineSync?.({
    reason: "roundFlow:draw-transition",
    playersSnapshot: resetPlayers,
    potsSnapshot: newPots,
    street: "DRAW",
    drawRoundIndex: nextRound,
    actingIndex: firstToDraw,
  });

  debugLog(`[SYNC] Phase=DRAW, round=${nextRound}, start=${firstToDraw}`);

  console.table(
    resetPlayers.map((p, i) => ({
      seat: i,
      name: p.name,
      folded: p.folded ? "Y" : "",
      drawn: p.hasDrawn ? "Y" : "",
    })),
  );

  debugLog(`[BET] finishBetRoundFrom END nextPhase=DRAW round=${nextRound}`);



  // finishBetRoundFrom anitizeStacks 

  console.groupCollapsed("[DEBUG][AFTER ROUND TRANSITION]");

  console.table(resetPlayers.map((p, i) => ({

    seat: i,

    name: p.name,

    folded: p.folded,

    allIn: p.allIn,

    hasDrawn: p.hasDrawn,

    canDraw: p.canDraw,

    stack: p.stack,

    lastAction: p.lastAction,

  })));

  console.groupEnd();



  //  

  sanitizeStacks(resetPlayers, setPlayers);

}





// === DRAWpp.jsx===

export function startDrawRound({
  players,
  dealerIdx,
  NUM_PLAYERS,
  setPlayers,
  setPhase,
  setDrawRound,
  setTurn,
  onAfter,
  drawRoundIndex = 0,
}) {
  const reset = players.map((p) => {
    const out = isFoldedOrOut(p) || p?.isBusted || p?.isActiveInGame === false;
    return {
      ...p,
      betThisRound: 0,
      lastAction: "",
      hasDrawn: out ? true : false,
      canDraw: !out,
      hasActedThisRound: out ? true : false,
    };
  });

  const actingSeat = (dealerIdx + 1) % NUM_PLAYERS;
  transitionToDrawPhase({
    players: reset,
    setPlayers,
    setPhase,
    setDrawRound: () =>
      setDrawRound((value) =>
        typeof value === "number" ? value + 1 : drawRoundIndex + 1
      ),
    setTurn,
    dealerIdx,
    nextRound: drawRoundIndex + 1,
    actingPlayerIndex: actingSeat,
    NUM_PLAYERS,
    forceDrawRound: true,
  });

  debugLog(`[FLOW] startDrawRound turn=${actingSeat}`);

  if (onAfter) onAfter();
}
