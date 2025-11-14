// src/ui/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Player from "./components/Player";
import Controls from "./components/Controls";
import PlayerStatusBoard from "./components/PlayerStatusBoard";
import { DeckManager   } from "../games/badugi/utils/deck";
import { debugLog } from "../utils/debugLog";
import { runDrawRound } from "../games/badugi/logic/drawRound";
import { runShowdown } from "../games/badugi/logic/showdown";
import { evaluateBadugi, compareBadugi, getWinnersByBadugi } from "../games/badugi/utils/badugiEvaluator";

import {
   aliveBetPlayers,
   aliveDrawPlayers,
   nextAliveFrom,
   maxBetThisRound,
   settleStreetToPots,
   isBetRoundComplete,
   finishBetRoundFrom,
   closingSeatForAggressor,
} from "../games/badugi/logic/roundFlow.js"; 

// History persistence helpers
import {
  saveRLHandHistory,
  getAllRLHandHistories,
  exportRLHistoryAsJSONL,
} from "../utils/history_rl";
import { useNavigate } from "react-router-dom";

// === TRACE HELPER (debug only) ===
function trace(tag, extra = {}) {
  const now = new Date().toISOString().split("T")[1].split(".")[0];
  const hand = typeof handIdRef !== "undefined" && handIdRef?.current
    ? handIdRef.current
    : "-";
  console.log(`[TRACE ${now}] [HAND ${hand}] [${typeof phase !== "undefined" ? phase : "-"}] ${tag}`, extra);
}

function npcAutoDrawCount(evalResult = {}) {
  const ranks = evalResult.ranks ?? [];
  const kicker = evalResult.kicker ?? 13;
  const uniqueCount = ranks.length;

  if (uniqueCount <= 1) {
    return 3;
  }
  if (uniqueCount === 2) {
    if (kicker >= 10) return 3;
    if (kicker >= 7) return 2;
    return 1;
  }
  if (uniqueCount === 3) {
    if (kicker >= 10) return 2;
    if (kicker >= 7) return 1;
    return 0;
  }
  return kicker >= 11 ? 1 : 0;
}

export default function App() {
  const navigate = useNavigate();
  /* --- constants --- */
  const NUM_PLAYERS = 6;
  const SB = 10;
  const BB = 20;
  const betSize = BB;
  // DRAW phases are limited to three passes (DRAW1..DRAW3).
  const MAX_DRAWS = 3;

  // Shared deck ref so helper hooks can access it.
  const deckRef = useRef(new DeckManager());

  /* --- states --- */
  const [players, setPlayers] = useState([]);
  const [deck, setDeck] = useState([]);
  const [dealerIdx, setDealerIdx] = useState(0);

  const [phase, setPhase] = useState("BET"); // BET / DRAW / SHOWDOWN

  // Number of completed draw rounds (0..3).
  const [drawRound, setDrawRound] = useState(0);

  // Track raise counts per street (table + seat granularity).
  const [raisePerRound, setRaisePerRound] = useState([0, 0, 0, 0]);
  const [raisePerSeatRound, setRaisePerSeatRound] = useState(
    () => Array(NUM_PLAYERS).fill(0).map(() => [0, 0, 0, 0]) // [seat][round]
  );
  const [actionLog, setActionLog] = useState([]); // RL/action log feed

  function currentBetRoundIndex() {
    return Math.min(drawRound, 3);
  }

  
  const [pots, setPots] = useState([]);

  const [turn, setTurn] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);

  const [raiseCountThisRound, setRaiseCountThisRound] = useState(0);


  const [transitioning, setTransitioning] = useState(false);
  const [betHead, setBetHead] = useState(null);
  const [lastAggressor, setLastAggressor] = useState(null);
  const [showNextButton, setShowNextButton] = useState(false);

  const handSavedRef = useRef(false);
  const handIdRef = useRef(null);

  const [debugMode, setDebugMode] = useState(false);
  function debugLog(...args) {
    if (debugMode) console.log(...args);
  }

  const raiseCountRef = useRef(raiseCountThisRound);
  useEffect(() => {
    raiseCountRef.current = raiseCountThisRound;
  }, [raiseCountThisRound]);

  function positionName(index, dealer = dealerIdx) {
    const order = ["BTN", "SB", "BB", "UTG", "MP", "CO"];
    const rel = (index - dealer + NUM_PLAYERS) % NUM_PLAYERS;
    return order[rel] ?? `Seat${index}`;
  }
  
  const sbIndex = (d = dealerIdx) => (d + 1) % NUM_PLAYERS;        // SB
  const orderFromSB = (d = dealerIdx) =>
    Array.from({ length: NUM_PLAYERS }, (_, k) => (sbIndex(d) + k) % NUM_PLAYERS);
  const firstUndrawnFromSB = (snap) => {
    const order = orderFromSB();
    for (const i of order) {
      const p = snap[i];
      if (!p?.folded && !p?.hasDrawn) return i;
    }
    return -1;
  };

  useEffect(() => {
    if (!debugMode) return;
    console.table(
      players.map((p, i) => ({
        seat: i,
        name: p.name,
        folded: p.folded ? "Y" : "",
        drawn: p.hasDrawn ? "Y" : "",
        stack: p.stack,
        bet: p.betThisRound,
        allIn: p.allIn ? "Y" : "",
        lastAction: p.lastAction || "",
      }))
    );
  }, [players, dealerIdx, debugMode]);

  // ======== DEBUG LOGGER (helpers) ========
  const actionSeqRef = useRef(0);

  function setHasActedFlag(snap, seat, value = true) {
    const target = snap[seat];
    if (!target || target.hasActedThisRound === value) return;
    snap[seat] = { ...target, hasActedThisRound: value };
  }

  function sanitizeStacks(snap, setPlayers) {
    const corrected = snap.map(p => {
      if (p.stack <= 0 && !p.allIn) {
        console.warn(`[SANITIZE] ${p.name} stack=${p.stack} -> force all-in`);
        return { ...p, stack: 0, allIn: true, hasDrawn: true, isBusted: true, hasActedThisRound: true };
      }
      if (p.stack <= 0 && p.isBusted !== true) {
        return { ...p, isBusted: true, hasActedThisRound: true };
      }
      if (p.stack > 0 && p.isBusted) {
        return { ...p, isBusted: false };
      }
      return p;
    });
    if (setPlayers) setPlayers(corrected);
    return corrected;
  }

  function betRoundNo() {
    return Math.min(drawRound, MAX_DRAWS);
  }

  function drawRoundNo() {
    return Math.min(drawRound + 1, MAX_DRAWS);
  }

  function phaseTagLocal() {
    if (phase === "BET") return `BET#${betRoundNo()}`;
    if (phase === "DRAW") return `DRAW#${drawRound + 1}`;
    return "SHOWDOWN";
  }

  function logState(tag, snap = players) {
    if (!debugMode) return;
    const head = `[${phaseTagLocal()}] ${tag} (turn=${turn}, betHead=${betHead}, currentBet=${currentBet})`;
    console.groupCollapsed(head);
    try {
      console.table(
        snap.map((p, i) => ({
          i,
          name: p.name,
          act: p.lastAction || "",
          folded: p.folded ? "Y" : "",
          allIn: p.allIn ? "Y" : "",
          stack: p.stack,
          betThisRound: p.betThisRound,
          drawn: p.hasDrawn ? "Y" : "",
        }))
      );
      console.log("pots:", pots, "totalPot:", totalPotForDisplay);
      const potNow = (pots || []).reduce((s, p) => s + (p.amount || 0), 0);
      console.log("pots:", pots, "totalPotNow:", potNow);
    } finally {
      console.groupEnd();
    }
  }

  function logPhaseState(tag = "") {
    const msg = `[STATECHK] ${tag} -> phase=${phase}, drawRound=${drawRound}, transitioning=${transitioning}, turn=${turn}`;
    console.log(msg);
  }

  function logAction(i, type, payload = {}) {
    if (!debugMode) return;
    const seq = ++actionSeqRef.current;
    const nm = players[i]?.name ?? `P${i}`;
    const pos = positionName(i);
    console.log(
      `[${phaseTagLocal()}][#${seq}] ${nm} (${pos}) -> ${type}`,
      payload
    );
  }

function recordActionToLog({
  phase: phaseOverride,
  round,
  seat,
  seatName,
  type,
  stackBefore,
  stackAfter,
  betBefore,
  betAfter,
  raiseCountTable,
  potAfter,
  playerState,
  metadata,
  drawInfo,
  extra,
}) {
  const idx = typeof seat === "number" ? seat : null;
  const seatSnapshot = playerState ?? (idx !== null ? players[idx] : null);
  const phaseLabel = phaseOverride ?? phase;
  const resolvedRound =
    round ??
    (phaseLabel === "DRAW"
      ? drawRound + 1
      : phaseLabel === "SHOWDOWN"
      ? drawRound + 1
      : currentBetRoundIndex());
  const mergedMeta = {
    ...(metadata || {}),
  };
  if (drawInfo) mergedMeta.drawInfo = drawInfo;
  if (extra && typeof extra === "object") {
    mergedMeta.extra = extra;
  }

  setActionLog((prev) => [
    ...prev,
    {
      phase: phaseLabel,
      round: resolvedRound,
      seat: idx,
      seatName:
        seatName ?? seatSnapshot?.name ?? (idx === null ? "TABLE" : `Seat ${idx}`),
      action: type,
      stackBefore:
        stackBefore ?? (seatSnapshot && typeof seatSnapshot.stack === "number" ? seatSnapshot.stack : null),
      stackAfter:
        stackAfter ?? (seatSnapshot && typeof seatSnapshot.stack === "number" ? seatSnapshot.stack : null),
      betBefore:
        betBefore ?? (seatSnapshot && typeof seatSnapshot.betThisRound === "number" ? seatSnapshot.betThisRound : 0),
      betAfter:
        betAfter ?? (seatSnapshot && typeof seatSnapshot.betThisRound === "number" ? seatSnapshot.betThisRound : 0),
      potAfter: potAfter ?? totalPotRef.current,
      raiseCountTable,
      metadata: Object.keys(mergedMeta).length ? mergedMeta : undefined,
      ts: Date.now(),
    },
  ]);
}

  /* --- utils --- */
  function makeEmptyPlayers() {
    const names = ["You", "P2", "P3", "P4", "P5", "P6"];
    return Array.from({ length: NUM_PLAYERS }, (_, i) => ({
      name: names[i] ?? `P${i + 1}`,
      hand: [],
      folded: false,
      allIn: false,
      isBusted: false,
      hasActedThisRound: false,
      stack: 100,
      betThisRound: 0,
      selected: [],
      showHand: false,
      lastAction: "",
      hasDrawn: false,
      lastDrawCount: 0,
    }));
  }

  const totalPotForDisplay = useMemo(() => {
    const settled = pots.reduce((acc, p) => acc + (p.amount || 0), 0);
    const onStreet = players.reduce((acc, p) => acc + (p.betThisRound || 0), 0);
    return settled + onStreet;
  }, [pots, players]);

  const totalPotRef = useRef(0);
  useEffect(() => {
    totalPotRef.current = totalPotForDisplay;
  }, [totalPotForDisplay]);

  const seatLabels = useMemo(
    () => players.map((_, idx) => positionName(idx)),
    [players, dealerIdx]
  );

  function goShowdownNow(playersSnap) {
    debugLog("[SHOWDOWN] goShowdownNow (All-in shortcut) called");

    const active = playersSnap.filter((p) => !p.folded);
    if (active.length === 0) return;

    const settledPots = settleStreetToPots(playersSnap, pots).pots;
    const allPots =
      settledPots && settledPots.length > 0
        ? settledPots
        : [
            {
              amount:
                playersSnap.reduce(
                  (sum, p) => sum + (p.betThisRound || 0),
                  0
                ) || 0,
              eligible: active.map((p, i) => i),
            },
          ];

    console.log("[SHOWDOWN] === RESULTS (BADUGI) ===");
    const newStacks = [...playersSnap.map((p) => p.stack)];
    allPots.forEach((pot, potIdx) => {
      const eligiblePlayers = pot.eligible
        .map((i) => ({ seat: i, name: playersSnap[i].name, hand: playersSnap[i].hand }))
        .filter((p) => !playersSnap[p.seat].folded);

      if (eligiblePlayers.length === 0) return;

      const winners = getWinnersByBadugi(eligiblePlayers);
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount % winners.length;

      for (const w of winners) {
        const idx = w.seat ?? playersSnap.findIndex(p => p.name === w.name);
        if (idx >= 0) {
          const stackBefore = newStacks[idx];
          let payout = share;
          if (remainder > 0) {
            payout += 1;
            remainder -= 1;
          }
          newStacks[idx] += payout;
          recordActionToLog({
            phase: "SHOWDOWN",
            round: drawRound + 1,
            seat: idx,
            seatName: playersSnap[idx]?.name ?? w.name,
            playerState: { ...playersSnap[idx], stack: newStacks[idx], betThisRound: 0 },
            type: `Collect ${payout}`,
            stackBefore,
            stackAfter: newStacks[idx],
            betBefore: playersSnap[idx].betThisRound,
            betAfter: 0,
            potAfter: 0,
            metadata: {
              potIndex: potIdx,
              potAmount: pot.amount,
              payout,
              winners: winners.map((win) => win.name),
            },
          });
        }
      }

      console.log(
        `[SHOWDOWN] Pot#${potIdx}: ${pot.amount} -> ${winners
          .map((w) => w.name)
          .join(", ")}`
      );
    });

    const updated = playersSnap.map((p, i) => ({
      ...p,
      stack: newStacks[i],
      showHand: true,
      result: p.folded ? "FOLD" : "SHOW",
      isBusted: newStacks[i] <= 0,
    }));

    setPots([]);
    setShowNextButton(true);
    setPlayers(updated);
    setPhase("SHOWDOWN");

    const totalPot = allPots.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (!handSavedRef.current) {
      trySaveHandOnce({
        playersSnap: updated,
        dealerIdx,
        pots: allPots,
        potOverride: totalPot,
      });
    }

    console.log("[SHOWDOWN] === STACKS AFTER ===");
    updated.forEach((p) => {
      if (p.folded) return;
      const ev = evaluateBadugi(p.hand);
      const rankLabel = ev.rankType ?? "UNKNOWN";
      const rankValues =
        ev.ranks && ev.ranks.length > 0 ? ev.ranks.join("-") : "-";
      console.log(
        `Seat ${p.name}: ${p.hand.join(" ")} | type=${rankLabel} ranks=${rankValues}`
      );
    });
    console.log("[SHOWDOWN] Waiting for Next Hand button...");
  }

  function getNextAliveAfter(idx) {
    if (!players || players.length === 0) return null;
    const n = players.length;
    let next = (idx + 1) % n;
    let safety = 0;
    while (players[next]?.folded) {
      next = (next + 1) % n;
      safety++;
      if (safety > n) return null;
    }
    return next;
  }

  function checkIfOneLeftThenEnd(snapOpt) {
    const snap = snapOpt || players;
    if (!snap || snap.length === 0) return false;

    const active = snap.filter(p => !p.folded && !p.allIn);

    if (active.length === 1) {
      const winnerIdx = snap.findIndex(p => !p.folded && !p.allIn);
      const newPlayers = snap.map(p => ({ ...p }));
      const { pots: finalPots } = settleStreetToPots(snap, pots);
      const potSum = finalPots.reduce((acc, p) => acc + (p.amount || 0), 0);
      newPlayers[winnerIdx].stack += potSum;
      newPlayers.forEach((pl) => {
        pl.isBusted = pl.stack <= 0;
      });
      setPlayers(newPlayers);

      trySaveHandOnce({
        playersSnap: newPlayers,
        dealerIdx,
        pots,
        potOverride: potSum,
      });

      const nextDealer = (dealerIdx + 1) % NUM_PLAYERS;
      setTimeout(() => dealNewHand(nextDealer), 600);
      return true;
    }
    return false;
  }


  const dealingRef = useRef(false);

  function safeDealNewHand(nextDealer) {
    if (dealingRef.current) {
      debugLog("[HAND] dealNewHand skipped (already in progress)");
      return;
    }
    dealingRef.current = true;
    dealNewHand(nextDealer);
    setTimeout(() => (dealingRef.current = false), 800);
  }

  function advanceAfterAction(updatedPlayers) {
    trace("advanceAfterAction()", { phase, drawRound, turn, transitioning });
    logPhaseState("[ADVANCE]")
    debugLog("[FLOW] advanceAfterAction called");
    const snap = updatedPlayers || players;
    debugLog("[FLOW] phase:", phase, "drawRound:", drawRound);

    if (phase === "DRAW") {
      console.table(
        snap.map((p, i) => ({
          seat: i,
          name: p.name,
          folded: p.folded ? "Y" : "",
          drawn: p.hasDrawn ? "Y" : "",
          stack: p.stack,
          bet: p.betThisRound,
        }))
      );
    }

    if (checkIfOneLeftThenEnd(snap)) return;

    const activeNoFold = (updatedPlayers || players).filter(p => !p.folded);

    const allInCount = activeNoFold.filter(p => p.allIn).length;
    if (allInCount > 0 && activeNoFold.every(p => p.allIn || p.folded)) {
      console.log("[ALL-IN] All remaining players all-in -> goShowdownNow()");
      goShowdownNow(updatedPlayers);
      return;
    }

    // ------------------------
    // ------------------------
    if (phase === "BET") {
      const active = snap.filter((p) => !p.folded);
      const everyoneMatched = active.every(
        (p) => p.allIn || p.betThisRound === maxNow
      );
      const noOneBet = maxNow === 0;
      const nextAlive = nextAliveFrom(snap, actedIndex);
      const betRoundSatisfied = isBetRoundComplete(snap);
      const rawClosingSeat = closingSeatForAggressor(snap, lastAggressor);
      const fallbackSeat = typeof betHead === "number" ? betHead : null;
      const closingSeat = rawClosingSeat ?? fallbackSeat;
      const returnedToAggressor =
        typeof closingSeat === "number" && nextAlive === closingSeat;

      debugLog(
        `[BET] Check status: everyoneMatched=${everyoneMatched}, next=${nextAlive}, betHead=${betHead}, lastAgg=${lastAggressor}`
      );

      const allChecked = noOneBet && active.every((p) => p.lastAction === "Check");
      const isHU = active.length === 2;
      let shouldEnd = betRoundSatisfied && returnedToAggressor;

      console.groupCollapsed("[DEBUG][BET_CONDITION_CHECK]");
      try {
        console.table(
          active.map((p, i) => ({
            seat: i,
            name: p.name,
            lastAction: p.lastAction,
            folded: p.folded,
            allIn: p.allIn,
            betThisRound: p.betThisRound,
            stack: p.stack,
          }))
        );

        console.log("[BET_CONDITION]", {
          phase,
          drawRound,
          turn,
          betHead,
          dealerIdx,
          lastAggressor,
          everyoneMatched,
          noOneBet,
          allChecked,
          nextAlive,
          closingSeat,
          returnedToAggressor,
          maxNow,
          activeCount: active.length,
          transitioning,
        });
      } finally {
        console.groupEnd();
      }

      if (!shouldEnd) {
        if (maxNow > 0) {
          shouldEnd = everyoneMatched;
        } else if (isHU) {
          const bothActed = active.every((p) => !!p.lastAction);
          shouldEnd = bothActed;
        } else {
          shouldEnd = allChecked;
        }
      }
      console.log("[BET][RESULT]", {
        shouldEnd,
        everyoneMatched,
        allChecked,
        closingSeat,
        returnedToAggressor,
        nextAlive,
        betHead,
      });

      if (shouldEnd) {
        debugLog(`[BET] Round complete (everyone matched) -> schedule finishBetRoundFrom()`);
        if (checkIfOneLeftThenEnd(snap)) {
          debugLog("[FORCE_END] Only one active player remains -> goShowdownNow()");
          return;
        }

        setTransitioning(true);
        setTimeout(() => {
          finishBetRoundFrom({
            players: snap,
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
          });
          setTransitioning(false);
        }, 100);
        return;
      }
      if (next === null) return;
      if (nextAlive !== null) setTurn(nextAlive);
      return;
    }

    // ------------------------
    // ------------------------
    if (phase === "DRAW" && !transitioning) {
      const patched = snap.map(p =>
        p.allIn ? { ...p, hasDrawn: true } : p
      );
      if (JSON.stringify(patched) !== JSON.stringify(snap)) {
        setPlayers(patched);
      }
      const snapEffective = patched;
      console.groupCollapsed("[DEBUG][DRAW_START_STATE]");
      console.table(
        snapEffective.map((p, i) => ({
          seat: i,
          name: p.name,
          folded: p.folded,
          hasDrawn: p.hasDrawn,
          allIn: p.allIn,
          stack: p.stack,
        }))
      );
      console.log("[DRAW STATE]", {
        drawRound,
        turn,
        transitioning,
        activesCount: aliveDrawPlayers(snap).length,
      });
      console.groupEnd();

      const actives = aliveDrawPlayers(snap);
      const allDrawn = actives.every(p => p.hasDrawn);

      if (allDrawn) {
        debugLog("[DRAW] All active players have drawn -> finishDrawRound()");
        setTransitioning(true);
        finishDrawRound(snap);
        setTimeout(() => setTransitioning(false), 400);
        return;
      }

      const nextToDraw = firstUndrawnFromSB(snap);
      console.log("[DRAW][NEXT_TO_DRAW]", nextToDraw);
      if (nextToDraw !== -1) {
        if (turn !== nextToDraw) {
          setTurn(nextToDraw);
          return;
        }
        if (nextToDraw !== 0) {
          console.log("[DRAW][RUNNING]", { nextToDraw, phase, drawRound });
          runDrawRound({
            players: snap,
            turn: nextToDraw,
            deckManager: deckRef.current,
            setPlayers,
            drawRound,
            setTurn,
            dealerIdx,
            NUM_PLAYERS,
            onActionLog: recordActionToLog,
          });
          console.log("[DRAW][RUNNING]", { nextToDraw, phase, drawRound });
        }
      }
      return;
    }

    if (actives.length === 0) {
      debugLog("[DRAW] No active players left -> skipping to finishDrawRound()");
      finishDrawRound(snap);
      return;
    }
    return;
  }

  function finishDrawRound(snapOpt) {
    logPhaseState("[ADVANCE]")
    const base = snapOpt ?? players;
    const completed = Math.min(drawRound + 1, MAX_DRAWS);
    setDrawRound(completed);

    setRaiseCountThisRound(0);

    const firstToAct =
      completed === 0
        ? (dealerIdx + 3) % NUM_PLAYERS
        : (dealerIdx + 1) % NUM_PLAYERS;

    const reset = base.map((p) => ({
      ...p,
      betThisRound: 0,
      lastAction: "",
      hasDrawn: false,
    }));

    setPlayers(reset);
    setCurrentBet(0);
    setBetHead(firstToAct);
    setTurn(firstToAct);
    setPhase("BET");
    setLastAggressor(firstToAct);

    debugLog(`[BET] === START BET (after DRAW#${completed}) firstToAct=${firstToAct} ===`);
    setTimeout(() => logState(`ENTER BET(after DRAW#${completed})`), 0);
  }


  /* --- dealing --- */
  function dealNewHand(nextDealerIdx = 0, prevPlayers = null) {
    trace("dealNewHand START", { nextDealerIdx, prevPlayersCount: prevPlayers?.length ?? 0 });
    if (dealingRef.current) {
      debugLog("[HAND] dealNewHand skipped (already in progress)");
      return;
    }
    dealingRef.current = true;
    debugLog(`[HAND] dealNewHand start -> dealer=${nextDealerIdx}`);
    deckRef.current.reset();
    const newDeck = deckRef.current;

    const prev = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
      name:
        prevPlayers?.[i]?.name ??
        players?.[i]?.name ??
        `P${i + 1}`,
      stack:
        prevPlayers?.[i]?.stack ??
        players?.[i]?.stack ??
        100,
      isBusted:
        prevPlayers?.[i]?.isBusted ??
        players?.[i]?.isBusted ??
        false,
    }));

    const filteredPrev = prev.map((p) => {
      const busted = p.isBusted || p.stack <= 0;
      if (busted) {
        console.warn(`[SEAT-OUT] ${p.name} is out (stack=${p.stack})`);
        return { ...p, stack: 0, folded: true, allIn: true, seatOut: true, isBusted: true };
      }
      return { ...p, seatOut: false, isBusted: false };
    });

    const newPlayers = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
      name: filteredPrev[i].name ?? `P${i + 1}`,
      stack: Math.max(filteredPrev[i].stack ?? 100, 0),
      seatOut: filteredPrev[i].seatOut ?? false,
      isBusted: filteredPrev[i].isBusted ?? false,
      hand: deckRef.current.draw(4), 
      folded: false,
      allIn: false,
      betThisRound: 0,
      hasDrawn: false,
      lastDrawCount: 0,
      selected: [],
      showHand: false,
      isDealer: i === nextDealerIdx,
      hasActedThisRound: false,
      lastAction: "",
    }));

    for (const p of newPlayers) {
      if (p.seatOut) {
        p.folded = true;
        p.allIn = true;
        p.hand = [];
        p.isBusted = true;
        p.hasActedThisRound = true;
      }
    }

    const activeCount = newPlayers.filter(p => !p.seatOut).length;
    if (activeCount === 2) {
      console.log("[FINALS] Start heads-up match!");
      setPlayers(newPlayers);
      setPhase("TOURNAMENT_FINAL");
      setTimeout(() => dealHeadsUpFinal(newPlayers), 800);
      return;
    } else if (activeCount < 2) {
      console.warn(`[TOURNAMENT END] Only ${activeCount} active players remain.`);
      setPlayers(newPlayers);
      setShowNextButton(false);
      setPhase("TOURNAMENT_END");
      return;
    }

    const sbIdx = (nextDealerIdx + 1) % NUM_PLAYERS;
    const bbIdx = (nextDealerIdx + 2) % NUM_PLAYERS;
    const sbPay = Math.min(newPlayers[sbIdx].stack, SB);
    newPlayers[sbIdx].stack -= sbPay;
    newPlayers[sbIdx].betThisRound = sbPay;
    if (newPlayers[sbIdx].stack === 0) {
      newPlayers[sbIdx].allIn = true;
      newPlayers[sbIdx].hasActedThisRound = true;
    }
    const bbPay = Math.min(newPlayers[bbIdx].stack, BB);
    newPlayers[bbIdx].stack -= bbPay;
    newPlayers[bbIdx].betThisRound = bbPay;
    if (newPlayers[bbIdx].stack === 0) {
      newPlayers[bbIdx].allIn = true;
      newPlayers[bbIdx].hasActedThisRound = true;
    }
    const initialPot = sbPay + bbPay;
    const initialCurrentBet = Math.max(sbPay, bbPay);
    setPlayers(newPlayers);
    setDeck([]);
    setPots([{ amount: initialPot, eligible: [...Array(NUM_PLAYERS).keys()] }]);
    setCurrentBet(initialCurrentBet);
    setDealerIdx(nextDealerIdx);
    setDrawRound(0);
    setPhase("BET");
    setTurn((nextDealerIdx + 3) % NUM_PLAYERS); // UTG
    setBetHead((nextDealerIdx + 3) % NUM_PLAYERS);
    setLastAggressor(bbIdx);
    setShowNextButton(false);
    setTransitioning(false);

    setRaiseCountThisRound(0);
    setRaisePerRound([0, 0, 0, 0]);
    setRaisePerSeatRound(
      Array(NUM_PLAYERS)
        .fill(0)
        .map(() => [0, 0, 0, 0])
    );
    setActionLog([]);

    handSavedRef.current = false;
    handIdRef.current = `${nextDealerIdx}-${Date.now()}`;

    debugLog("[HAND] New players dealt:", newPlayers.map((p) => p.name));
    debugLog(
      `[STATE] phase=BET, drawRound=0, turn=${
        (nextDealerIdx + 3) % NUM_PLAYERS
      }, currentBet=${initialCurrentBet}`
    );

    console.groupCollapsed(`[DEBUG][NEW HAND] Dealer=${nextDealerIdx}`);
    newPlayers.forEach((p, i) => {
      console.log(
        `Seat ${i}: ${p.name}`,
        {
          stack: p.stack,
          folded: p.folded,
          allIn: p.allIn,
          hasDrawn: p.hasDrawn,
          betThisRound: p.betThisRound,
          lastAction: p.lastAction,
        }
      );
    });
    console.groupEnd();

    if (Array.isArray(prevPlayers) && prevPlayers.some(p => p?.hasDrawn || p?.showHand)) {
      console.warn("[INFO] previous hand snapshot had SHOWDOWN flags (expected):", prevPlayers);
    }

    setTimeout(() => logState("NEW HAND"), 0);

    setTimeout(() => { dealingRef.current = false; }, 100);
     trace("dealNewHand END", { dealerIdx: nextDealerIdx });
  }

  function dealHeadsUpFinal(prevPlayers) {
    debugLog("[FINALS] dealHeadsUpFinal start");

    const heads = prevPlayers.filter(p => !p.seatOut);
    if (heads.length !== 2) {
      console.warn("[FINALS] Cannot start: not exactly 2 active players");
      setPhase("TOURNAMENT_END");
      return;
    }

    const nextDealerIdx = 0;
    deckRef.current.reset();

    const newPlayers = heads.map((p, i) => ({
      ...p,
      folded: false,
      allIn: false,
      seatOut: false,
      isBusted: false,
      hand: deckRef.current.draw(4),
      betThisRound: 0,
      hasDrawn: false,
      lastAction: "",
      isDealer: i === nextDealerIdx,
      hasActedThisRound: false,
    }));

    const sbPay = Math.min(newPlayers[0].stack, SB);
    newPlayers[0].stack -= sbPay;
    newPlayers[0].betThisRound = sbPay;
    if (newPlayers[0].stack === 0) {
      newPlayers[0].allIn = true;
      newPlayers[0].hasActedThisRound = true;
    }
    const bbPay = Math.min(newPlayers[1].stack, BB);
    newPlayers[1].stack -= bbPay;
    newPlayers[1].betThisRound = bbPay;
    if (newPlayers[1].stack === 0) {
      newPlayers[1].allIn = true;
      newPlayers[1].hasActedThisRound = true;
    }

    setPlayers(newPlayers);
    setPots([{ amount: sbPay + bbPay, eligible: [0, 1] }]);
    setCurrentBet(Math.max(sbPay, bbPay));
    setLastAggressor(1);
    setDealerIdx(nextDealerIdx);
    setDrawRound(0);
    setPhase("BET");
    setTurn(1); // UTG = BB
    setBetHead(1);
    setShowNextButton(false);
    setTransitioning(false);

    console.log("[FINALS] Heads-up match started:", newPlayers.map(p => p.name));
  }


  useEffect(() => {
    dealNewHand(0);
  }, []);

  useEffect(() => {
    debugLog(
      `[STATE] phase=${phase}, drawRound=${drawRound}, turn=${turn}, currentBet=${currentBet}`
    );
  }, [phase, drawRound, turn, currentBet]);


  /* --- common: after BET action (snapshot-based) --- */
  function afterBetActionWithSnapshot(snap, actedIndex) {
    if (snap[turn]?.allIn) {
      setHasActedFlag(snap, turn);
      console.log(`[SKIP] Player ${snap[turn].name} is all-in -> skip action`);
      const nxt = nextAliveFrom(snap, turn);
      if (nxt !== null) setTurn(nxt);
      return;
    }

    trace("afterBetActionWithSnapshot()", { phase, drawRound, actedIndex });
    if (transitioning) {
      setPlayers(snap);
      return;
    }

    for (let i = 0; i < snap.length; i++) {
      const p = snap[i];
      if (!p.folded && p.stack <= 0 && !p.allIn) {
        console.warn(`[AUTO-FIX] ${p.name} stack=${p.stack} -> allIn=true`);
        snap[i] = { ...p, stack: 0, allIn: true };
      }
    }

    const phaseLabel = `[${phase}] Round=${drawRound}`;
    debugLog(
      `${phaseLabel} acted=${snap[actedIndex]?.name}, turn=${actedIndex}, currentBet=${currentBet}`
    );
    snap.forEach((p, i) =>
      debugLog(
        `  P${i + 1}(${p.name}): bet=${p.betThisRound}, stack=${p.stack}, folded=${p.folded}, allIn=${p.allIn}`
      )
    );

    if (checkIfOneLeftThenEnd(snap)) return;

    const stackBefore = me.stack;
    const betBefore = me.betThisRound;
    const stackBefore = me.stack;
    const betBefore = me.betThisRound;
    const maxNow = maxBetThisRound(snap);
    if (currentBet !== maxNow) setCurrentBet(maxNow);

    const next = nextAliveFrom(snap, actedIndex);
    setPlayers(snap);

    const me = { ...snap[actedIndex] };
    
    // ------------------------
    // ------------------------
    if (phase === "BET") {
      const active = snap.filter((p) => !p.folded);
      const everyoneMatched = active.every(
        (p) => p.allIn || p.betThisRound === maxNow
      );
      const noOneBet = maxNow === 0;
      const nextAlive = nextAliveFrom(snap, actedIndex);

      debugLog(
        `[BET] Check status: everyoneMatched=${everyoneMatched}, next=${next}, betHead=${betHead}`
      );

      const bbIndex = (dealerIdx + 2) % NUM_PLAYERS;
      let isBBActed = true;

      if (drawRound === 0) {
        const bb = snap[bbIndex];
        if (bb) {
          const acted = ["Bet", "Call", "Raise", "Check"].includes(bb.lastAction);
          isBBActed = bb.folded || bb.allIn || acted;
        }
      }
 
      const allChecked = (maxNow === 0) && active.every(p => p.lastAction === "Check");
      const isHU = active.length === 2;
      let shouldEnd = false;

      console.groupCollapsed("[DEBUG][BET_CONDITION_CHECK]");
      try {
        console.table(active.map((p, i) => ({
          seat: i,
          name: p.name,
          lastAction: p.lastAction,
          folded: p.folded,
          allIn: p.allIn,
          betThisRound: p.betThisRound,
          stack: p.stack,
        })));

        console.log("[BET_CONDITION]", {
          phase,
          drawRound,
          turn,
          betHead,
          dealerIdx,
          bbIndex,
          everyoneMatched,
          noOneBet,
          allChecked,
          nextAlive,
          isBBActed,
          maxNow,
          activeCount: active.length,
          transitioning,
        });
      } finally {
        console.groupEnd();
      }

      if (maxNow > 0) {
        shouldEnd = everyoneMatched && isBBActed;
      } else if (isHU) {
        const bothActed = active.every(p => !!p.lastAction);
        shouldEnd = bothActed;
      } else {
        shouldEnd = allChecked;
      }

      console.log("[BET][RESULT]", { shouldEnd, everyoneMatched, allChecked, isBBActed, nextAlive, betHead });

      if (shouldEnd) {
        debugLog(`[BET] Round complete (everyone matched) -> schedule finishBetRoundFrom()`);
          if (checkIfOneLeftThenEnd(snap)) {
            debugLog("[FORCE_END] Only one active player remains -> goShowdownNow()");
            return;
          }

        setTransitioning(true);
        setTimeout(() => {
          finishBetRoundFrom({
            players: snap,
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
          });
          setTransitioning(false);
        }, 100);
        return;
      }
      if (next === null) return;
      if (nextAlive !== null) setTurn(nextAlive);
      return;
    }

    // ------------------------
    // ------------------------
    if (phase === "DRAW") {
      const nextIdx = firstUndrawnFromSB(snap);
      console.log("[TRACE][DRAW] acted=", actedIndex, 
            "nextIdx=", nextIdx, typeof nextIdx, 
            "drawRound=", drawRound);

      const actives = snap.filter((p) => !p.folded);
      const allActiveDrawn = actives.every((p) => p.hasDrawn);

      if (allActiveDrawn) {
        finishDrawRound(snap);
        return;
      }

      if (nextIdx === -1) {
        finishDrawRound(snap);
        return;
      }
      if (turn !== nextIdx) {
        setTurn(nextIdx);
        return;
      }

    }
  }

  function recycleFoldedAndDiscardsBeforeCurrent(snap, currentIdx) {
    const order = orderFromSB();
    const pos = order.indexOf(currentIdx);
    if (pos <= 0) return;

    const toCheck = order.slice(0, pos);
    const muck = [];
    toCheck.forEach(i => {
      const pl = snap[i];
      if (pl?.folded && Array.isArray(pl.hand)) {
        muck.push(...pl.hand);
      }
    });

    const dm = deckRef.current;
    if (muck.length || (dm.discardPile && dm.discardPile.length)) {
      dm.recycleNow(muck);
      debugLog(`[RECYCLE] +${muck.length} cards (folded) + existing discard -> new deck=${dm.deck.length}`);
    }
  }

  /* --- actions: BET --- */
  function playerFold() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };
    const stackBefore = me.stack;
    const betBefore = me.betThisRound;
    me.folded = true;
    me.lastAction = "Fold";
    me.hasActedThisRound = true;
    logAction(0, "Fold");
    snap[0] = me;
    recordActionToLog({
      phase: "BET",
      round: currentBetRoundIndex(),
      seat: 0,
      playerState: me,
      type: me.lastAction,
      stackBefore,
      stackAfter: me.stack,
      betBefore,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound,
    });

    afterBetActionWithSnapshot(snap, 0);
  }

  function playerCall() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };
    
    if (me.stack <= 0) {
      console.warn("[BLOCK] Player has no stack -> cannot act");
      return;
    }

    const maxNow = maxBetThisRound(snap);
    const toCall = Math.max(0, maxNow - me.betThisRound);
    const pay = Math.min(me.stack, toCall);

    me.stack -= pay;
    me.betThisRound += pay;
    me.lastAction = toCall === 0 ? "Check" : pay < toCall ? "Call (All-in)" : "Call";
    logAction(0, me.lastAction, { toCall, pay, newBet: me.betThisRound });
    if (me.stack === 0) me.allIn = true;
    me.hasActedThisRound = true;

    snap[0] = me;
    afterBetActionWithSnapshot(snap, 0);

    recordActionToLog({
      phase: "BET",
      round: currentBetRoundIndex(),
      seat: 0,
      playerState: me,
      type: me.lastAction,
      stackBefore,
      stackAfter: me.stack,
      betBefore,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound,
    });

  }

  function playerCheck() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };
    const maxNow = maxBetThisRound(snap);
    if (me.betThisRound === maxNow || me.allIn) {
      me.lastAction = "Check";
      logAction(0, "Check");
      me.hasActedThisRound = true;
      snap[0] = me;
      recordActionToLog({
        phase: "BET",
        round: currentBetRoundIndex(),
        seat: 0,
        playerState: me,
        type: me.lastAction,
        stackBefore: me.stack,
        stackAfter: me.stack,
        betBefore: me.betThisRound,
        betAfter: me.betThisRound,
        raiseCountTable: raiseCountThisRound,
      });

      afterBetActionWithSnapshot(snap, 0);
    } else {
      playerCall();
    }
  }

  function playerRaise() {
     if (phase !== "BET") return;
     const snap = [...players];
     const me = { ...snap[0] };

     if (me.stack <= 0) {
       console.warn("[BLOCK] Player has no stack -> cannot raise");
       return;
     }

     if (raiseCountThisRound >= 4) {
       logAction(0, "Raise blocked (5-bet cap reached)", { raiseCountThisRound });
       debugLog(`[CAP] 5-bet cap reached (Raise blocked after ${raiseCountThisRound})`);
       playerCall();
       return;
     }

    const maxNow = maxBetThisRound(snap);
    const toCall = Math.max(0, maxNow - me.betThisRound);
    const raiseAmt = betSize;
    const total = toCall + raiseAmt;

    const pay = Math.min(me.stack, total);
    me.stack -= pay;
    me.betThisRound += pay;
    me.lastAction = pay < total ? "Raise (All-in)" : "Raise";
    
    if (me.stack === 0) me.allIn = true;
    me.hasActedThisRound = true;

    snap[0] = me;

    setRaiseCountThisRound((c) => c + 1);

    setBetHead(0);
    setLastAggressor(0);

     logAction(0, me.lastAction, {
       toCall,
       raise: raiseAmt,
       pay,
       newBet: me.betThisRound,
       raiseCount: raiseCountThisRound + 1,
    });

    const newMax = maxBetThisRound(snap);
    if (currentBet !== newMax) setCurrentBet(newMax);

    afterBetActionWithSnapshot(snap, 0);

    recordActionToLog({
      phase: "BET",
      round: currentBetRoundIndex(),
      seat: 0,
      playerState: me,
      type: me.lastAction,
      stackBefore,
      stackAfter: me.stack,
      betBefore,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound + 1,
    });

  }


  /* --- actions: DRAW --- */
  function toggleSelectCard(cardIdx) {
    if (phase !== "DRAW" || turn !== 0) return;
    const newPlayers = players.map((p) => ({ ...p, hand: [...p.hand] }));
    const p = { ...newPlayers[0] };
    const sel = p.selected ?? [];
    p.selected = sel.includes(cardIdx) ? sel.filter((x) => x !== cardIdx) : [...sel, cardIdx];
    newPlayers[0] = p;
    setPlayers(newPlayers);
  }

  function drawSelected() {
    debugLog(`[CHECK] phase=${phase}, drawRound=${drawRound}, MAX_DRAWS=${MAX_DRAWS}`);
    if (phase !== "DRAW" || turn !== 0) return;

    const deckManager = deckRef.current;
    const newPlayers = players.map(p => ({ ...p, hand: [...p.hand] }));
    const p = { ...newPlayers[0], hand: [...newPlayers[0].hand] };

    const sel = p.selected || [];
    const stackBefore = p.stack;
    const betBefore = p.betThisRound;

    if (sel.length > 0) {
      const oldHand = [...p.hand];
      const replaced = [];
      const newHand = [...p.hand];

      sel.forEach((i) => {
        let pack = deckManager.draw(1);
        if (!pack || pack.length === 0) {
          recycleFoldedAndDiscardsBeforeCurrent(newPlayers, 0);
          pack = deckManager.draw(1);
        }

        if (pack && pack.length > 0) {
          const newCard = pack[0];
          deckManager.discard([newHand[i]]);
          replaced.push({ index: i, oldCard: newHand[i], newCard });
          newHand[i] = newCard;
        } else {
          debugLog(`[DRAW] No card for slot[${i}] -> keep current card`);
        }
      });

      p.hand = [...newHand];

      console.log(`[DRAW] You exchanged ${replaced.length} card(s):`);
      replaced.forEach(({ index, oldCard, newCard }) =>
        console.log(`   slot[${index}] ${oldCard} -> ${newCard}`)
      );

      p.lastAction = `DRAW(${replaced.length})`;

      recordActionToLog({
        phase: "DRAW",
        round: drawRound + 1,
        seat: 0,
        playerState: p,
        type: `DRAW (${replaced.length})`,
        stackBefore,
        stackAfter: p.stack,
        betBefore,
        betAfter: p.betThisRound,
        raiseCountTable: raiseCountThisRound,
        metadata: {
          drawInfo: {
            drawCount: replaced.length,
            replacedCards: replaced,
            before: oldHand,
            after: p.hand,
          },
        },
      });
    }
    } else {
      p.lastAction = "Pat";
      recordActionToLog({
        phase: "DRAW",
        round: drawRound + 1,
        seat: 0,
        playerState: p,
        type: "Pat",
        stackBefore,
        stackAfter: p.stack,
        betBefore,
        betAfter: p.betThisRound,
        raiseCountTable: raiseCountThisRound,
        metadata: {
          drawInfo: {
            drawCount: 0,
            replacedCards: [],
            before: [...p.hand],
            after: [...p.hand],
          },
        },
      });
    }

    p.selected = [];
    p.hasDrawn = true;
    p.lastDrawCount = sel.length;
    newPlayers[0] = p;

    setPlayers(newPlayers.map(pl => ({ ...pl })));
    setTimeout(() => afterBetActionWithSnapshot([...newPlayers], 0), 0);
  }

  /* --- NPC auto --- */
  useEffect(() => {
  if (!players || players.length === 0) return;
  if (turn === 0) return;

  const p = players[turn];
  if (!p || p.folded) {
    const nxt = nextAliveFrom(players, turn);
    if (nxt !== null) setTurn(nxt);
    return;
  }

  if (p.allIn || p.stack <= 0) {
    const nxt = nextAliveFrom(players, turn);
    if (nxt !== null) setTurn(nxt);
    return;
  }

  const timer = setTimeout(() => {
    if (phase === "BET") {
      const snap = [...players];
      const me = { ...snap[turn] };
      const stackBefore = me.stack;
      const betBefore = me.betThisRound;
      const maxNow = maxBetThisRound(snap);
      const toCall = Math.max(0, maxNow - me.betThisRound);
      const evalResult = evaluateBadugi(me.hand);
      const madeCards = evalResult.ranks.length;
      const r = Math.random();

      if (toCall > 0 && r < 0.15 && madeCards < 3) {
        me.folded = true;
        me.lastAction = "Fold";
      } else {
        const pay = Math.min(me.stack, toCall);
        me.stack -= pay;
        me.betThisRound += pay;
        me.lastAction = toCall === 0 ? "Check" : "Call";
      }

      if (!me.allIn && Math.random() > 0.9 && raiseCountThisRound < 4 && madeCards >= 3) {
        const add = Math.min(me.stack, betSize);
        me.stack -= add;
        me.betThisRound += add;
        me.lastAction = "Raise";
        setRaiseCountThisRound(c => c + 1);
        setBetHead(turn);
        setLastAggressor(turn);
      }
      me.hasActedThisRound = true;

      snap[turn] = me;
      logAction(turn, me.lastAction);
      recordActionToLog({
        phase: "BET",
        round: currentBetRoundIndex(),
        seat: turn,
        playerState: me,
        type: me.lastAction,
        stackBefore,
        stackAfter: me.stack,
        betBefore,
        betAfter: me.betThisRound,
        raiseCountTable: raiseCountThisRound,
      });
      afterBetActionWithSnapshot(snap, turn);
      } else if (phase === "DRAW") {
    const snap = [...players];

    const actives = snap.filter(p => !p.folded);
    const everyoneDrawn = actives.every(p => p.hasDrawn);

    if (everyoneDrawn) {
      if (!transitioning) {
        setTransitioning(true);
        setTimeout(() => {
          finishDrawRound(snap);
          setTransitioning(false);
        }, 50);
      }
      return;
    }

    const nextToDraw = firstUndrawnFromSB(snap);
    console.log("[DRAW][NEXT_TO_DRAW]", nextToDraw);
    if (nextToDraw === -1) {
      if (!transitioning) {
        setTransitioning(true);
        setTimeout(() => { finishDrawRound(snap); setTransitioning(false); }, 50);
      }
      return;
    }

    if (turn !== nextToDraw) {
      setTurn(nextToDraw);
      return;
    }

    const me = { ...snap[nextToDraw] };
    const oldHand = [...me.hand];
    const replacedCards = [];
    const stackBefore = me.stack;
    const betBefore = me.betThisRound;
    const evaluation = evaluateBadugi(me.hand);
    const drawCount = npcAutoDrawCount(evaluation);
    const deckManager = deckRef.current;
    const newHand = [...me.hand];
    for (let i = 0; i < drawCount; i++) {
      let pack = deckManager.draw(1);
      if (!pack || pack.length === 0) {
        recycleFoldedAndDiscardsBeforeCurrent(snap, nextToDraw);
        pack = deckManager.draw(1);
      }
      if (pack && pack.length > 0) {
        const outgoing = newHand[i];
        deckManager.discard([outgoing]);
        newHand[i] = pack[0];
        replacedCards.push({ index: i, oldCard: outgoing, newCard: pack[0] });
      } else {
        debugLog(`[DRAW][NPC seat=${nextToDraw}] no card for slot[${i}] -> keep current card`);
      }
    }
    me.hand = newHand;
    me.hasDrawn = true;
    me.lastDrawCount = drawCount;
    me.lastAction = drawCount === 0 ? "Pat" : `DRAW(${drawCount})`;
    snap[nextToDraw] = me;

    setDeck([]);
    setPlayers(snap);
    logAction(nextToDraw, me.lastAction);
    recordActionToLog({
      phase: "DRAW",
      round: drawRound + 1,
      seat: nextToDraw,
      playerState: me,
      type: me.lastAction,
      stackBefore,
      stackAfter: me.stack,
      betBefore,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound,
      metadata: {
        drawInfo: {
          drawCount,
          replacedCards,
          before: oldHand,
          after: me.hand,
        },
      },
    });

    const nextAfter = firstUndrawnFromSB(snap);
    if (nextAfter !== -1) {
      setTurn(nextAfter);
    } else {
      if (!transitioning) {
        setTransitioning(true);
        setTimeout(() => {
          finishDrawRound(snap);
          setTransitioning(false);
        }, 50);
      }
    }
  }

  }, 250);

  return () => clearTimeout(timer);
}, [
  turn,
  phase,
  deck,
  currentBet,
  transitioning,
  raiseCountThisRound,
  dealerIdx,
  betSize,
]);


  useEffect(() => {
    if (phase !== "SHOWDOWN") return;
    if (handSavedRef.current) return;

    trySaveHandOnce({ playersSnap: players, dealerIdx, pots });
  }, [phase, showNextButton]); // eslint-disable-line react-hooks/exhaustive-deps

  function trySaveHandOnce({ playersSnap, dealerIdx, pots, potOverride }) {
    debugLog("[HISTORY] trySaveHandOnce called");
    try {
      const handId = handIdRef.current ?? `${dealerIdx}-${Date.now()}`;
      handIdRef.current = handId;

      const pot =
        typeof potOverride === "number"
          ? potOverride
          : Number(
           ((pots || []).reduce((s, p) => s + (p?.amount || 0), 0) || 0) +
           ((playersSnap || []).reduce((s, p) => s + (p?.betThisRound || 0), 0) || 0)
          ) || 0;

      const active = (playersSnap || []).filter((p) => !p.folded);
      if (active.length === 0) return;
      let best = active[0];
      for (const p of active) {
        if (compareBadugi(p.hand, best.hand) < 0) best = p;
      }
      const winners = active
        .filter((p) => compareBadugi(p.hand, best.hand) === 0)
        .map((p) => p.name);

      const record = {
        handId,
        ts: Date.now(),
        tableSize: playersSnap.length,
        dealerIdx,
        players: playersSnap.map((p, i) => ({
          name: p.name ?? `P${i + 1}`,
          seat: i,
          stack: p.stack,
          folded: !!p.folded,
        })),
        actions: [],
        pot,
        showdown: playersSnap.map(p => ({
          name: p.name,
          hand: p.hand,
          folded: !!p.folded,
          badugiEval: evaluateBadugi(p.hand),
        })),
        winners: (() => {
          const active = playersSnap.filter(p => !p.folded);
          if (active.length === 0) return [];
          let best = active[0];
          for (const p of active) {
            if (compareBadugi(p.hand, best.hand) < 0) best = p;
          }
          return active
            .filter(p => compareBadugi(p.hand, best.hand) === 0)
            .map(p => p.name);
        })(),
        winner: (() => {
          const w = (() => {
            const active = playersSnap.filter(p => !p.folded);
            if (active.length === 0) return [];
            let best = active[0];
            for (const p of active) {
              if (compareBadugi(p.hand, best.hand) < 0) best = p;
            }
            return active
              .filter(p => compareBadugi(p.hand, best.hand) === 0)
              .map(p => p.name);
          })();
          return w.length > 1 ? "split" : w[0] ?? "-";
        })(),


        raiseStats: {
          perRound: raisePerRound,
          perSeatPerRound: raisePerSeatRound,
          totalRaises: raisePerRound.reduce((a,b)=>a+b,0),
          roundsPlayed: Math.max(
            1,
            Math.min(drawRound + 1, 4)
          ),
          lastRoundIndex: Math.min(drawRound, 3),  // 0..3
          actionLog: actionLog,
          },
      };

      saveRLHandHistory(record);
      console.log("[HISTORY] saveRLHandHistory() called successfully");
      debugLog("[HISTORY] saved:", record.handId, record.winner);
      handSavedRef.current = true;
      // console.debug("Hand saved:", record);
    } catch (e) {
      // console.error("save hand failed", e);
    }
  }

  /* --- UI --- */
  const centerX = typeof window !== "undefined" ? window.innerWidth / 2 : 400;
  const centerY = typeof window !== "undefined" ? window.innerHeight / 2 : 300;
  const radiusX = 350;
  const radiusY = 220;

  const seatLayouts = [
    "lg:absolute lg:bottom-6 lg:left-1/2 lg:-translate-x-1/2 lg:w-[250px]",
    "lg:absolute lg:bottom-16 lg:right-8 lg:w-[230px]",
    "lg:absolute lg:top-32 lg:right-6 lg:w-[230px]",
    "lg:absolute lg:top-8 lg:left-1/2 lg:-translate-x-1/2 lg:w-[250px]",
    "lg:absolute lg:top-32 lg:left-6 lg:w-[230px]",
    "lg:absolute lg:bottom-16 lg:left-8 lg:w-[230px]",
  ];

function handleCardClick(i) {
  setPlayers((prev) => {
    return prev.map((p, idx) => {
      if (idx !== 0) return p;

      const selected = p.selected ? [...p.selected] : [];
      const already = selected.includes(i);
      const newSelected = already
        ? selected.filter((x) => x !== i)
        : [...selected, i];

      return {
        ...p,
        selected: newSelected,
      };
    });
  });
}


  return (
  <div className="flex flex-col h-screen bg-gray-900 text-white">
    {/* -------- Header -------- */}
    <header className="flex justify-between items-center px-6 py-3 bg-gray-800 shadow-md fixed top-0 left-0 right-0 z-50">
      <h1 className="text-2xl font-bold text-white">Badugi App</h1>

      <nav className="flex gap-4">
        <button
          onClick={() => navigate("/home")}
          className="hover:text-yellow-400 transition"
        >
          Home
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="hover:text-yellow-400 transition"
        >
          Profile
        </button>
        <button
          onClick={() => navigate("/history")}
          className="hover:text-yellow-400 transition"
        >
          History
        </button>
      </nav>
    </header>

    {/* -------- Main Table Area -------- */}
    <main className="flex-1 mt-20 relative flex items-center justify-center overflow-auto bg-green-700">
      {/* Core game surface */}
      <div className="relative w-[95%] max-w-[1200px] aspect-[4/3] bg-green-700 border-4 border-yellow-600 rounded-3xl shadow-inner">
        {/* Left column: status board */}
        <div className="absolute top-4 left-4 z-30 max-h-[85%] overflow-hidden">
          <PlayerStatusBoard
            players={players}
            dealerIdx={dealerIdx}
            heroIndex={0}
            turn={turn}
            totalPot={totalPotForDisplay}
            positionLabels={seatLabels}
          />
        </div>

        {/* Right column: phase, draws, dealer */}
        <div className="absolute top-4 right-4 text-white font-bold text-right space-y-1">
          <div>Phase: {phaseTagLocal()}</div>
          <div>Draw Progress: {drawRound}/{MAX_DRAWS}</div>
          {phase === "BET" && (
            <div>Raise Count (Table): {raiseCountThisRound} / 4</div>
          )}
          <div>Dealer: {players[dealerIdx]?.name ?? "-"}</div>
        </div>

        {/* Player seats */}
        <div className="players-grid grid grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:block lg:px-0">
          {players.map((p, i) => (
            <div
              key={`seat-${i}`}
              className={`mb-4 lg:mb-0 ${seatLayouts[i] ?? ""}`}
            >
              <Player
                player={{
                  ...p,
                  name: `${p.name} (${positionName(i)})`,
                }}
                index={i}
                selfIndex={0}
                phase={phase}
                turn={turn}
                dealerIdx={dealerIdx}
                onCardClick={handleCardClick}
              />
            </div>
          ))}
        </div>

        {/* Controls: BET or DRAW (hero only) */}
        {turn === 0 && players[0] && !players[0].folded && (
        <div className="absolute bottom-8 right-8 z-50 flex flex-col items-end space-y-2">
          {phase === "BET" && (
            <Controls
              phase="BET"
              currentBet={currentBet}
              player={players[0]}
              onFold={playerFold}
              onCall={playerCall}
              onCheck={playerCheck}
              onRaise={playerRaise}
            />
          )}
          {phase === "DRAW" && (
            <Controls
              phase="DRAW"
              player={players[0]}
              onDraw={drawSelected}
            />
          )}
        </div>
      )}

        {/* Showdown footer / Next Hand */}
      {showNextButton && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={() => {
              if (!handSavedRef.current) {
                trySaveHandOnce({ playersSnap: players, dealerIdx, pots });
              }
              const nextDealer = (dealerIdx + 1) % NUM_PLAYERS;
              dealNewHand(nextDealer);
              setShowNextButton(false);
            }}
            className="px-6 py-3 bg-yellow-500 text-black font-bold rounded shadow-lg"
          >
            Next Hand
          </button>
        </div>
      )}

      {phase === "TOURNAMENT_END" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-50">
          <h2 className="text-4xl font-bold text-yellow-400 mb-4">TOURNAMENT FINISHED</h2>
          <p className="text-lg mb-6 text-white">
            Congratulations to the Champion!
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-yellow-500 text-black font-bold rounded shadow-lg hover:bg-yellow-400"
          >
            Return to Home
          </button>
        </div>
      )}


      {/* Debug toggle */}
      <div className="absolute bottom-4 left-4 z-50">
        <button
          onClick={() => setDebugMode((v) => !v)}
          className={`px-4 py-2 rounded font-bold ${
      debugMode ? "bg-red-500" : "bg-gray-600"
          }`}
        >
          {debugMode ? "DEBUG ON" : "DEBUG OFF"}
        </button>
      </div>
      </div>
    </main>
  </div>
);
}








