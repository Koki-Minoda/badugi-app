// src/games/badugi/logic/roundFlow.js

import { debugLog } from "../../../utils/debugLog";

// Canonical folded indicator: once set, the player is excluded from any future action/draw this hand.
export function isFoldedOrOut(player) {
  return Boolean(player?.folded || player?.hasFolded || player?.seatOut);
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

export const aliveBetPlayers = arr =>

  Array.isArray(arr)
    ? arr.filter((p) => !isFoldedOrOut(p) && !p.allIn)
    : [];



// --- DRAWll-in--

export const aliveDrawPlayers = arr =>

  Array.isArray(arr)
    ? arr.filter((p) => !isFoldedOrOut(p))
    : [];



// pp.jsx alivePlayers import 

export const alivePlayers = aliveBetPlayers;



export const nextAliveFrom = (arr, idx) => {

  const n = arr.length;

  let next = (idx + 1) % n;

  let loop = 0;

  while (isFoldedOrOut(arr[next]) || arr[next]?.allIn) {

    next = (next + 1) % n;

    if (++loop > n) return null;

  }

  return next;

};



export const maxBetThisRound = arr => {

  if (!Array.isArray(arr)) return 0;

  const eligible = arr.filter((p) => !isFoldedOrOut(p));

  if (!eligible.length) return 0;

  return Math.max(...eligible.map(p => p.betThisRound || 0));

};



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
    if (eligibleSorted.length <= 1 && merged.length) {
      merged[merged.length - 1].amount += pot.amount;
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



// === BET===

export const isBetRoundComplete = players => {

  if (!Array.isArray(players)) return false;

  const active = players.filter((p) => !isFoldedOrOut(p));

  if (active.length <= 1) return true;

  const maxNow = Math.max(...active.map(p => p.betThisRound || 0));

  return active.every(p => {

    const matched = p.allIn || (p.betThisRound || 0) === maxNow;

    const acted = p.allIn || p.hasActedThisRound === true;

    return matched && acted;

  });

};



export const closingSeatForAggressor = (players, lastAggressorIdx) => {

  if (!Array.isArray(players)) return null;

  if (lastAggressorIdx === null || typeof lastAggressorIdx === "undefined") {

    return null;

  }

    const agg = players[lastAggressorIdx];

  if (!agg) return null;

  if (isFoldedOrOut(agg) || agg.allIn) {
    const next = nextAliveFrom(players, lastAggressorIdx);
    if (next === null) return null;
    return next;
  }

  return lastAggressorIdx;

};

export function analyzeBetSnapshot({
  players = [],
  actedIndex = 0,
  dealerIdx = 0,
  drawRound = 0,
  numPlayers = players.length || 6,
  betHead = null,
  lastAggressorIdx = null,
}) {
  const snap = players.map((p) => ({ ...p }));
  const maxNow = maxBetThisRound(snap);
  const active = snap.filter((p) => !isFoldedOrOut(p));
  const everyoneMatched = active.every(
    (p) => p.allIn || (p.betThisRound || 0) === maxNow
  );
  const allChecked =
    maxNow === 0 &&
    active.every(
      (p) => isFoldedOrOut(p) || p.allIn || p.lastAction === "Check"
    );
  const betRoundSatisfied = isBetRoundComplete(snap);
  const nextAlive = typeof actedIndex === "number" ? nextAliveFrom(snap, actedIndex) : null;
  const closingSeatCandidate = closingSeatForAggressor(snap, lastAggressorIdx);
  const fallbackSeat = typeof betHead === "number" ? betHead : null;
  const closingSeat = closingSeatCandidate ?? fallbackSeat;
  const returnedToAggressor =
    typeof closingSeat === "number" && nextAlive === closingSeat;

  const bbIndex = (dealerIdx + 2) % (numPlayers || snap.length || 1);
  const bbSeat = snap[bbIndex];
  let isBBActed = true;
  if (drawRound === 0 && bbSeat) {
    const acted = ["Bet", "Call", "Raise", "Check"].includes(bbSeat.lastAction);
    isBBActed = bbSeat.folded || bbSeat.allIn || acted;
  }

  const isHeadsUp = active.length <= 2;
  let shouldAdvance = betRoundSatisfied && returnedToAggressor;

  if (!shouldAdvance) {
    if (maxNow > 0) {
      shouldAdvance = everyoneMatched && isBBActed;
    } else if (isHeadsUp) {
      const bothActed = active.every((p) => !!p.lastAction);
      shouldAdvance = bothActed;
    } else {
      shouldAdvance = allChecked;
    }
  }

  return {
    playersSnapshot: snap,
    nextTurn: nextAlive,
    maxBet: maxNow,
    everyoneMatched,
    allChecked,
    betRoundSatisfied,
    closingSeat,
    returnedToAggressor,
    shouldAdvance,
    isHeadsUp,
    isBBActed,
  };
}



// === BET DRAW/SHOWDOWN ===

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

}) {

  console.log("[DEBUG][finishBetRoundFrom args]", {

    phaseBefore: "BET",

    dealerIdx,

    drawRound,

    typeofDrawRound: typeof drawRound,

    MAX_DRAWS,

    playerStates: players.map((p, i) => ({

      i,

      name: p.name,

      folded: p.folded,

      allIn: p.allIn,

      betThisRound: p.betThisRound,

    })),

  });



  if (typeof drawRound === "undefined" || isNaN(drawRound)) {

    console.warn("[finishBetRoundFrom] drawRound undefined, defaulting to 0");

    drawRound = 0;



  }

  console.log(`[TRACE ${new Date().toISOString()}]  finishBetRoundFrom START`, { drawRound });
  debugLog(`[ BET] finishBetRoundFrom start drawRound=${drawRound}`);

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

        const activeNonAllIn = (nextPlayers || []).filter(
          (p) => p && !p.folded && !p.allIn
        );
        const earlyShowdown =
          (outcome.showdown || outcome.street === "SHOWDOWN") &&
          activeNonAllIn.length > 0 &&
          drawRound < MAX_DRAWS;

        if (!earlyShowdown && (outcome.showdown || outcome.street === "SHOWDOWN")) {
          let showdownResult = null;
          if (typeof engineResolveShowdown === "function") {
            showdownResult = engineResolveShowdown(nextPlayers, nextPots);
          }
          const showdownPlayers = showdownResult?.players ?? nextPlayers;
          const showdownPots = showdownResult?.pots ?? nextPots;
          if (showdownResult?.players) {
            setPlayers(showdownResult.players);
          } else {
            setPlayers(nextPlayers);
          }
          setPots(showdownPots ?? []);
          setPhase("SHOWDOWN");
          runShowdown?.({
            players: showdownPlayers,
            setPlayers,
            pots: showdownPots,
            setPots,
            dealerIdx,
            dealNewHand,
            setShowNextButton,
            onShowdownComplete,
            engineResolveShowdown,
            precomputedResult: showdownResult,
            recordActionToLog,
            drawRound,
            onHandFinished,
          });
          return;
        }

        setPlayers(nextPlayers);
        setPots(nextPots);

        const nextRound = outcome.drawRoundIndex ?? drawRound + 1;
        setDrawRound(nextRound);
        setPhase("DRAW");
        const nextTurn =
          typeof outcome.actingPlayerIndex === "number"
            ? outcome.actingPlayerIndex
            : calcDrawStartIndex(dealerIdx, nextRound, NUM_PLAYERS);
        setTurn(nextTurn);
        if (setTransitioning) {
          setTransitioning(true);
          setTimeout(() => setTransitioning(false), 500);
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
  const incomplete = actionablePlayers.filter((p) => !p.hasActedThisRound);
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

    setPhase("SHOWDOWN");
    onEngineSync?.({
      reason: "roundFlow:showdown",
      playersSnapshot: clearedPlayers,
      potsSnapshot: newPots,
      street: "SHOWDOWN",
      drawRoundIndex: drawRound,
      actingIndex: dealerIdx,
    });

    runShowdown?.({
      players: clearedPlayers,
      setPlayers,
      pots: newPots,
      setPots,
      dealerIdx,
      dealNewHand,
      setShowNextButton,
      onShowdownComplete,
      engineResolveShowdown,
      recordActionToLog,
      drawRound,
      onHandFinished,
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

  const resetPlayers = clearedPlayers.map((p) => ({
    ...p,
    lastAction: "",
    hasDrawn: isFoldedOrOut(p) ? true : false,
    canDraw: !isFoldedOrOut(p),
  }));

  if (typeof setDrawRound === "function") {
    setDrawRound(nextRound);
  }
  setPlayers(resetPlayers);



  debugLog(`[FLOW] DRAW #${nextRound} (SB=${firstToDraw})`);



  // ---   ---

  if (setTransitioning) {

    setTransitioning(true);

    // DRAW

    setTimeout(() => setTransitioning(false), 500);

  }



  setTurn(firstToDraw);
  if (typeof setBetHead === "function") {
    setBetHead(firstToDraw);
  }

  setPhase("DRAW");
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

    resetPlayers.map((p,i)=>({

      seat:i, name:p.name, folded:p.folded?'Y':'', drawn:p.hasDrawn?'Y':''

    }))

  );

  console.log(`[TRACE ${new Date().toISOString()}] finishBetRoundFrom END nextPhase=DRAW`);



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

}) {

  const reset = players.map((p) => {
    const out = isFoldedOrOut(p);
    return {
      ...p,
      betThisRound: 0,
      lastAction: "",
      hasDrawn: out ? true : false,
      canDraw: !out,
    };
  });

  setPlayers(reset);

  const next = (dealerIdx + 1) % NUM_PLAYERS; // SB

  setDrawRound(r => r + 1);

  setPhase("DRAW");

  setTurn(next);

  debugLog(`[FLOW] startDrawRound turn=${next}`);

  if (onAfter) onAfter();

}






