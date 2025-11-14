// src/games/badugi/logic/roundFlow.js

import { debugLog } from "../../../utils/debugLog";



// --- sanitizeStacks:  all-in---

function sanitizeStacks(snap, setPlayers) {

  const corrected = snap.map(p => {

    if (p.stack <= 0 && !p.allIn) {

      console.warn(`[SANITIZE] ${p.name} stack=${p.stack} allIn`);

      return { ...p, stack: 0, allIn: true, hasDrawn: true, isBusted: true };

    }

    if (p.stack <= 0 && p.isBusted !== true) {

      return { ...p, isBusted: true };

    }

    if (p.stack > 0 && p.isBusted) {

      return { ...p, isBusted: false };

    }

    return p;

  });

  if (setPlayers) setPlayers(corrected);



  // 

  console.table(corrected.map((p, i) => ({

    i,

    name: p.name,

    allIn: p.allIn,

    hasDrawn: p.hasDrawn,

    stack: p.stack,

    folded: p.folded,

  })));

  return corrected;

}





// ===  ===

// --- BETll-in--

export const aliveBetPlayers = arr =>

  Array.isArray(arr) ? arr.filter(p => !p.folded && !p.allIn) : [];



// --- DRAWll-in--

export const aliveDrawPlayers = arr =>

  Array.isArray(arr) ? arr.filter(p => !p.folded) : [];



// pp.jsx alivePlayers import 

export const alivePlayers = aliveBetPlayers;



export const nextAliveFrom = (arr, idx) => {

  const n = arr.length;

  let next = (idx + 1) % n;

  let loop = 0;

  while (arr[next]?.folded || arr[next]?.allIn) {

    next = (next + 1) % n;

    if (++loop > n) return null;

  }

  return next;

};



export const maxBetThisRound = arr => {

  if (!Array.isArray(arr)) return 0;

  const eligible = arr.filter(p => !p.folded);

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

  debugLog(" [SETTLE] start");

  const contrib = playersSnap.map(p => (p.folded ? 0 : Math.max(0, p.betThisRound || 0)));

  const pots = [...prevPots];



  while (true) {

    const pos = contrib.map((v, i) => ({ v, i })).filter(o => o.v > 0 && !playersSnap[o.i].folded);

    if (!pos.length) break;

    const min = Math.min(...pos.map(p => p.v));

    const part = pos.map(p => p.i);

    const amount = min * part.length;

    pots.push({ amount, eligible: part });

    part.forEach(i => (contrib[i] -= min));

  }



  const cleared = playersSnap.map(p => ({ ...p, betThisRound: 0 }));

  return { pots, clearedPlayers: cleared };

}



// === BET===

export const isBetRoundComplete = players => {

  if (!Array.isArray(players)) return false;

  const active = players.filter(p => !p.folded);

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

  if (!agg || agg.folded) return null;

  if (agg.allIn) {

    const next = nextAliveFrom(players, lastAggressorIdx);

    return next ?? lastAggressorIdx;

  }

  return lastAggressorIdx;

};



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

  dealerIdx,

  NUM_PLAYERS,

  MAX_DRAWS,

  runShowdown,

  dealNewHand,

  setShowNextButton,

  setTransitioning,

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



  // 1 BET

  const { pots: newPots, clearedPlayers } = settleStreetToPots(players, pots);

  setPots(newPots);

  setPlayers(clearedPlayers);



  // 2 DRAWETHOWDOWN

  const nextRound = drawRound + 1;



  if (nextRound > MAX_DRAWS) {

    debugLog(" Final betting complete SHOWDOWN");

    setPhase("SHOWDOWN");

    runShowdown?.({

      players: clearedPlayers,

      setPlayers,

      pots: newPots,

      setPots,

      dealerIdx,

      dealNewHand,

      setShowNextButton,

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



    if (!p.folded) {



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

  const resetPlayers = clearedPlayers.map(p => ({

    ...p,

    hasDrawn: p.folded ? true : false,  // foldeddraw

    canDraw: !p.folded,

    lastAction: "",

  }));

  setPlayers(resetPlayers);



  debugLog(`[FLOW] DRAW #${nextRound} (SB=${firstToDraw})`);



  // ---   ---

  if (setTransitioning) {

    setTransitioning(true);

    // DRAW

    setTimeout(() => setTransitioning(false), 500);

  }



  setTurn(firstToDraw);

  setPhase("DRAW");

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

  const reset = players.map(p => ({

    ...p,

    hasDrawn: false,

    lastAction: "",

    betThisRound: 0,

  }));

  setPlayers(reset);

  const next = (dealerIdx + 1) % NUM_PLAYERS; // SB

  setDrawRound(r => r + 1);

  setPhase("DRAW");

  setTurn(next);

  debugLog(`[FLOW] startDrawRound turn=${next}`);

  if (onAfter) onAfter();

}



