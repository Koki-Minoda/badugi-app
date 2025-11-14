// src/ui/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Player from "./components/Player";
import Controls from "./components/Controls";
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

// 螻･豁ｴ菫晏ｭ連PI
import {
  saveRLHandHistory,
  getAllRLHandHistories,
  exportRLHistoryAsJSONL,
} from "../utils/history_rl";
import { useNavigate } from "react-router-dom";

// === TRACE HELPER (繝・ヰ繝・げ逕ｨ) ===
function trace(tag, extra = {}) {
  const now = new Date().toISOString().split("T")[1].split(".")[0]; // 譎・蛻・遘・
  const hand = typeof handIdRef !== "undefined" && handIdRef?.current
    ? handIdRef.current
    : "-";
  console.log(`[TRACE ${now}] [HAND ${hand}] [${typeof phase !== "undefined" ? phase : "-"}] ${tag}`, extra);
}

export default function App() {
  const navigate = useNavigate();
  /* --- constants --- */
  const NUM_PLAYERS = 6;
  const SB = 10;
  const BB = 20;
  const betSize = BB;
  const MAX_DRAWS = 3; // DRAW縺ｯ3蝗橸ｼ・ DRAW1,2,3・・

  // state螳夂ｾｩ縺ｮ荳企Κ縺ｪ縺ｩ縺ｫ deckRef 繧定ｨｭ鄂ｮ
  const deckRef = useRef(new DeckManager());

  /* --- states --- */
  const [players, setPlayers] = useState([]);
  const [deck, setDeck] = useState([]);
  const [dealerIdx, setDealerIdx] = useState(0);

  const [phase, setPhase] = useState("BET"); // BET / DRAW / SHOWDOWN

  // 譁ｰ隕剰ｿｽ蜉・咤ET繝ｩ繧ｦ繝ｳ繝蛾幕蟋区凾縺ｮ蜈磯ｭ繝励Ξ繧､繝､繝ｼ繧剃ｿ晄戟
  const [drawRound, setDrawRound] = useState(0); // 螳御ｺ・＠縺櫂RAW謨ｰ 0..3

  const [raisePerRound, setRaisePerRound] = useState([0, 0, 0, 0]); // 蜷ВET繝ｩ繧ｦ繝ｳ繝峨・蜷郁ｨ・aise蝗樊焚
  const [raisePerSeatRound, setRaisePerSeatRound] = useState(
    () => Array(NUM_PLAYERS).fill(0).map(() => [0, 0, 0, 0]) // [seat][round]
  );
  // === 譁ｰ隕・ 陦悟虚繝ｭ繧ｰ・・I蟄ｦ鄙堤畑・・===
  const [actionLog, setActionLog] = useState([]);

  // 萓ｿ蛻ｩ繝倥Ν繝代・・壻ｻ翫′縺ｩ縺ｮBET繝ｩ繧ｦ繝ｳ繝峨°・・=繝励Μ, 1=1蝗樒岼蠕・ 2=2蝗樒岼蠕・ 3=3蝗樒岼蠕鯉ｼ・
  function currentBetRoundIndex() {
    // drawRound=0 縺ｮ髢薙・繝励Μ繝峨Ο繝ｼBET荳ｭ縺ｪ縺ｮ縺ｧ 0縲・
    // 莉･髯阪・ drawRound 縺ｨ蜷後§逡ｪ蜿ｷ・域怙螟ｧ3・峨〒OK
    return Math.min(drawRound, 3);
  }

  
  const [pots, setPots] = useState([]);

  const [turn, setTurn] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);

    // 蜷ВET繝ｩ繧ｦ繝ｳ繝峨・Raise蝗樊焚繧定ｨ倬鹸
  const [raiseCountThisRound, setRaiseCountThisRound] = useState(0);


  // 蜀榊・髦ｲ豁｢・壹Λ繧ｦ繝ｳ繝蛾・遘ｻ繧НPC蜃ｦ逅・′莠碁㍾逋ｺ轣ｫ縺励※縺翫°縺励￥縺ｪ繧峨↑縺・ｈ縺・↓
  const [transitioning, setTransitioning] = useState(false);
  const [betHead, setBetHead] = useState(null);
  const [lastAggressor, setLastAggressor] = useState(null);
  const [showNextButton, setShowNextButton] = useState(false);

  // 笆ｼ 霑ｽ險假ｼ壹％縺ｮ繝上Φ繝峨ｒ菫晏ｭ俶ｸ医∩縺九←縺・°・亥､夐㍾菫晏ｭ倬亟豁｢・・
  const handSavedRef = useRef(false);
  // 萓ｿ螳應ｸ翫・ handId・医ョ繧｣繝ｼ繝ｩ繝ｼ蠎ｧ蟶ｭ・九ち繧､繝繧ｹ繧ｿ繝ｳ繝暦ｼ・
  const handIdRef = useRef(null);

  // 笆ｼ 繝・ヰ繝・げ繝医げ繝ｫ霑ｽ蜉
  const [debugMode, setDebugMode] = useState(false);
  function debugLog(...args) {
    if (debugMode) console.log(...args);
  }

  const raiseCountRef = useRef(raiseCountThisRound);
  useEffect(() => {
    raiseCountRef.current = raiseCountThisRound;
  }, [raiseCountThisRound]);

  // === 繝昴ず繧ｷ繝ｧ繝ｳ蜷阪ｒ霑斐☆髢｢謨ｰ・・ealer蝓ｺ貅厄ｼ・===
  // dealerIdx 縺後沓TN・医ョ繧｣繝ｼ繝ｩ繝ｼ・峨阪↑縺ｮ縺ｧ縲。TN 竊・SB 竊・BB 竊・UTG 竊・MP 竊・CO 縺ｮ鬆・〒蝗槭☆
  function positionName(index, dealer = dealerIdx) {
    const order = ["BTN", "SB", "BB", "UTG", "MP", "CO"];
    const rel = (index - dealer + NUM_PLAYERS) % NUM_PLAYERS;
    return order[rel] ?? `Seat${index}`;
  }
  
  // === 蠎ｧ蟶ｭ繝倥Ν繝代・・・B襍ｷ轤ｹ縺ｮ蟾ｦ蝗槭ｊ鬆・ｼ・===
  const sbIndex = (d = dealerIdx) => (d + 1) % NUM_PLAYERS;        // SB
  const orderFromSB = (d = dealerIdx) =>
    Array.from({ length: NUM_PLAYERS }, (_, k) => (sbIndex(d) + k) % NUM_PLAYERS);
  // 隕九▽縺九ｉ縺ｪ縺代ｌ縺ｰ蠢・★ -1 繧定ｿ斐☆・亥他縺ｳ蜃ｺ縺怜・縺ｨ螂醍ｴ・ｒ蜷医ｏ縺帙ｋ・・
  const firstUndrawnFromSB = (snap) => {
    const order = orderFromSB();
    for (const i of order) {
      const p = snap[i];
      if (!p?.folded && !p?.hasDrawn) return i;
    }
    return -1;
  };

  // === 繝・ヰ繝・げ: 迴ｾ蝨ｨ縺ｮ繝昴ず繧ｷ繝ｧ繝ｳ鬆・ｺ冗｢ｺ隱・===
  useEffect(() => {
    if (!debugMode) return;
    console.table(
      players.map((p, i) => ({
        seat: i,
        name: p.name,
        folded: p.folded ? "笨・ : "",
        drawn: p.hasDrawn ? "笨・ : "",
        stack: p.stack,
        bet: p.betThisRound,
        allIn: p.allIn,
        lastAction: p.lastAction
      }))
    );
  }, [players, dealerIdx, debugMode]);

  // ======== DEBUG LOGGER (add just under debugLog) ========
const actionSeqRef = useRef(0); // 騾｣逡ｪ

function setHasActedFlag(snap, seat, value = true) {
  const target = snap[seat];
  if (!target || target.hasActedThisRound === value) return;
  snap[seat] = { ...target, hasActedThisRound: value };
}

// ｧｩ 繧ｹ繧ｿ繝・け繧堤屮隕悶＠縺ｦ 0 莉･荳九ｒ allIn 謇ｱ縺・↓陬懈ｭ｣
function sanitizeStacks(snap, setPlayers) {
  const corrected = snap.map(p => {
    if (p.stack <= 0 && !p.allIn) {
      console.warn(`[SANITIZE] ${p.name} stack=${p.stack} ?EallIn`);
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
  // BET 縺ｮ蝗樊焚縺ｯ縲悟ｮ御ｺ・＠縺・DRAW 謨ｰ縲阪↓荳閾ｴ・・..3・・
  return Math.min(drawRound, MAX_DRAWS);
}
function drawRoundNo() {
  // 陦ｨ遉ｺ逕ｨ・・..3・・
  return Math.min(drawRound + 1, MAX_DRAWS);
}
function phaseTagLocal() {
  if (phase === "BET")  return `BET#${betRoundNo()}`;
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
        folded: p.folded ? "笨・ : "",
        allIn: p.allIn ? "笨・ : "",
        stack: p.stack,
        betThisRound: p.betThisRound,
        drawn: p.hasDrawn ? "笨・ : "",
      }))
    );
    console.log("pots:", pots, "totalPot:", totalPotForDisplay);
    const potNow = (pots || []).reduce((s, p) => s + (p.amount || 0), 0);
    console.log("pots:", pots, "totalPotNow:", potNow);
  } finally {
    console.groupEnd();
  }
}

function logPhaseState(tag="") {
  const msg = `[STATECHK] ${tag} 竊・phase=${phase}, drawRound=${drawRound}, transitioning=${transitioning}, turn=${turn}`;
  console.log(msg);
}


function logAction(i, type, payload = {}) {
  if (!debugMode) return;
  const seq = ++actionSeqRef.current;
  const nm = players[i]?.name ?? `P${i}`;
  const pos = positionName(i);
  console.log(
    `[${phaseTagLocal()}][#${seq}] ${nm} (${pos}) 竊・${type}`,
    payload
  );
}

// === 譁ｰ隕・ 陦悟虚險倬鹸繧但I蟄ｦ鄙堤畑繝ｭ繧ｰ縺ｫ菫晏ｭ・===
function recordActionToLog({ round, seat, type, stackBefore, betAfter, raiseCountTable }) {
  setActionLog(prev => [
    ...prev,
    {
      round,
      seat,
      type,
      stackBefore,
      betAfter,
      raiseCountTable,
      ts: Date.now(),
    }
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

  function goShowdownNow(playersSnap) {
    debugLog("[SHOWDOWN] goShowdownNow (All-in蟇ｾ蠢・ called");

    // 1・鞘Ε 譛牙柑繝励Ξ繧､繝､繝ｼ・・old縺励※縺・↑縺・ｺｺ・・
    const active = playersSnap.filter((p) => !p.folded);
    if (active.length === 0) return;

    // 2・鞘Ε 迴ｾ蝨ｨ縺ｮ繝昴ャ繝医ｒ螳牙・縺ｫ遒ｺ螳・
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

    // === Badugi隧穂ｾ｡繝ｭ繧ｸ繝・け縺ｫ邨ｱ荳 ===
    console.log("[SHOWDOWN] === RESULTS (BADUGI) ===");
    const newStacks = [...playersSnap.map((p) => p.stack)];
    allPots.forEach((pot, potIdx) => {
      const eligiblePlayers = pot.eligible
        .map((i) => ({ seat: i, name: playersSnap[i].name, hand: playersSnap[i].hand }))
        .filter((p) => !playersSnap[p.seat].folded);

      if (eligiblePlayers.length === 0) return;

      // getWinnersByBadugi 縺ｧ譛蠑ｷ閠・ｾ､蜿門ｾ・
      const winners = getWinnersByBadugi(eligiblePlayers);
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount % winners.length;

      for (const w of winners) {
        const idx = w.seat ?? playersSnap.findIndex(p => p.name === w.name);
        if (idx >= 0) {
          newStacks[idx] += share;
          if (remainder > 0) {
            newStacks[idx] += 1;
            remainder -= 1;
          }
        }
      }

      console.log(
        `[SHOWDOWN] Pot#${potIdx}: ${pot.amount} 竊・${winners
          .map((w) => w.name)
          .join(", ")}`
      );
    });

    // 6・鞘Ε 繧ｹ繧ｿ繝・け譖ｴ譁ｰ繝ｻ蜈ｨ蜩｡縺ｮ繝上Φ繝牙・髢・
    const updated = playersSnap.map((p, i) => ({
      ...p,
      stack: newStacks[i],
      showHand: true,
      result: p.folded ? "FOLD" : "SHOW",
      isBusted: newStacks[i] <= 0,
    }));

    // 7・鞘Ε 迥ｶ諷区峩譁ｰ
    setPots([]);
    setShowNextButton(true);
    setPlayers(updated);
    setPhase("SHOWDOWN");

    // 8・鞘Ε 螻･豁ｴ菫晏ｭ倥□縺大ｮ溯｡鯉ｼ域ｬ｡繝上Φ繝峨・繝懊ち繝ｳ謚ｼ荳九〒・・
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
      console.log(
        `Seat ${p.name}: ${p.hand.join(" ")} | score=${ev.score}, unique=${ev.uniqueCount}`
      );
    });
    console.log("葡 Waiting for Next Hand button...");
  }

  function getNextAliveAfter(idx) {
    if (!players || players.length === 0) return null;
    const n = players.length;
    let next = (idx + 1) % n;
    let safety = 0;
    while (players[next]?.folded) {
      next = (next + 1) % n;
      safety++;
      if (safety > n) return null; // 蜈ｨ蜩｡繝輔か繝ｼ繝ｫ繝臥ｭ峨・菫晞匱
    }
    return next;
  }

  function checkIfOneLeftThenEnd(snapOpt) {
    const snap = snapOpt || players;
    if (!snap || snap.length === 0) return false;

    // 筮・ｸ・菫ｮ豁｣: fold縺励※縺・↑縺・ｼ・ll-in縺ｧ縺ｯ縺ｪ縺・・繝ｬ繧､繝､繝ｼ縺ｮ縺ｿ繧偵き繧ｦ繝ｳ繝・
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


  // ｩｵ SHOWDOWN蠕後↓ dealNewHand 莠碁㍾蜻ｼ縺ｳ蜃ｺ縺鈴亟豁｢繝輔Λ繧ｰ
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

    // ｧｩ 繝・ヰ繝・げ蜃ｺ蜉幢ｼ壼・蜩｡縺ｮ hasDrawn 迥ｶ諷九ｒ豈主屓陦ｨ遉ｺ
    if (phase === "DRAW") {
      console.table(
        snap.map((p, i) => ({
          seat: i,
          name: p.name,
          folded: p.folded ? "笨・ : "",
          drawn: p.hasDrawn ? "笨・ : "",
          stack: p.stack,
          bet: p.betThisRound,
        }))
      );
    }

    // 蜍晁ｲ豎ｺ縺ｾ縺｣縺ｦ縺溘ｉ邨ゆｺ・
    if (checkIfOneLeftThenEnd(snap)) return;

    // ・ All-in蜷ｫ繧繧ｷ繝ｧ繝ｼ繝育憾諷九・蠑ｷ蛻ｶ繧ｷ繝ｧ繝ｼ繝繧ｦ繝ｳ
    const activeNoFold = (updatedPlayers || players).filter(p => !p.folded);

    const allInCount = activeNoFold.filter(p => p.allIn).length;
    if (allInCount > 0 && activeNoFold.every(p => p.allIn || p.folded)) {
      console.log("[ALL-IN] All remaining players all-in 竊・goShowdownNow()");
      goShowdownNow(updatedPlayers);
      return;
    }

    // ------------------------
    // BET繝輔ぉ繝ｼ繧ｺ荳ｭ
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
        `[BET] Check status: everyoneMatched=${everyoneMatched}, next=${next}, betHead=${betHead}, lastAgg=${lastAggressor}`
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
        debugLog(`[BET] ラウンド完了 (everyone matched) → schedule finishBetRoundFrom()`);
        if (checkIfOneLeftThenEnd(snap)) {
          debugLog("[FORCE_END] Only one active player remains → goShowdownNow()");
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
    // 洽 DRAW繝輔ぉ繝ｼ繧ｺ荳ｭ
    // ------------------------
    if (phase === "DRAW" && !transitioning) {
      // ｧｩ All-in 繝励Ξ繧､繝､繝ｼ縺ｯ閾ｪ蜍慕噪縺ｫ繝峨Ο繝ｼ螳御ｺ・桶縺・
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
        debugLog("[DRAW] 笨・All active drawn 竊・finishDrawRound()");
        setTransitioning(true);
        finishDrawRound(snap);
        setTimeout(() => setTransitioning(false), 400);
        return;
      }

      // 燥 縺薙％縺悟ｾｩ豢ｻ繝昴う繝ｳ繝茨ｼ壽ｬ｡縺ｮ譛ｪ繝峨Ο繝ｼ閠・∈騾ｲ繧√ｋ・・B襍ｷ轤ｹ縺ｮ蟾ｦ蝗槭ｊ・・
      const nextToDraw = firstUndrawnFromSB(snap);
      console.log("[DRAW][NEXT_TO_DRAW]", nextToDraw);
      if (nextToDraw !== -1) {
        if (turn !== nextToDraw) {
          setTurn(nextToDraw);
          return;
        }
        // 莉翫′NPC縺ｮ逡ｪ縺ｪ繧牙叉繝峨Ο繝ｼ繧定・蜍募ｮ溯｡鯉ｼ医・繝ｬ繧､繝､繝ｼ逡ｪ縺ｪ繧蔚I蠕・■・・
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

    // 庁 菫晞匱・壹ラ繝ｭ繝ｼ蟇ｾ雎｡縺後ぞ繝ｭ縺ｮ蝣ｴ蜷医・蜊ｳ驕ｷ遘ｻ・亥・folded謇ｱ縺・ｼ・
    if (actives.length === 0) {
      debugLog("[DRAW] 笞・・No active players left 窶・skipping to finishDrawRound()");
      finishDrawRound(snap);
      return;
    }
    return;
  }

  function finishDrawRound(snapOpt) {
    logPhaseState("[ADVANCE]")
    const base = snapOpt ?? players; // 譛譁ｰ繧ｹ繝翫ャ繝励ｒ蜆ｪ蜈・
    // DRAW 繧貞ｼ輔″邨ゅ∴縺溽椪髢薙↓縲悟ｮ御ｺ・＠縺溘ラ繝ｭ繝ｼ蝗樊焚縲阪ｒ +1 縺吶ｋ・井ｸ企剞 3・・
    const completed = Math.min(drawRound + 1, MAX_DRAWS);
    setDrawRound(completed);

    // 繝吶ャ繝医Λ繧ｦ繝ｳ繝峨ｒ髢句ｧ九☆繧具ｼ・蝗樒岼縺ｮ繝峨Ο繝ｼ蠕後ｂ蠢・★繝吶ャ繝茨ｼ・ｼ・
    setRaiseCountThisRound(0);

    // Pre-draw 縺縺代・ UTG・・ealer+3・峨√◎繧御ｻ･髯阪・繝吶ャ繝医・蟶ｸ縺ｫ SB・・ealer+1・・
    const firstToAct =
      completed === 0
        ? (dealerIdx + 3) % NUM_PLAYERS // 縺薙％縺ｫ縺ｯ譚･縺ｪ縺・′菫晞匱
        : (dealerIdx + 1) % NUM_PLAYERS;

    const reset = base.map((p) => ({
      ...p,
      betThisRound: 0,
      lastAction: "",
      hasDrawn: false, // 谺｡縺ｮ繝峨Ο繝ｼ縺ｫ蛯吶∴縺ｦ謌ｻ縺・\n      hasActedThisRound: p.folded ? true : false,
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
    trace("・ dealNewHand START", { nextDealerIdx, prevPlayersCount: prevPlayers?.length ?? 0 });
    if (dealingRef.current) {
      debugLog("[HAND] dealNewHand skipped (already in progress)");
      return;
    }
    dealingRef.current = true;
    debugLog(`[HAND] dealNewHand start 竊・dealer=${nextDealerIdx}`);
    // 笨・DeckManager 縺ｧ繝ｪ繧ｻ繝・ヨ縺励※1繝・ャ繧ｭ邂｡逅・
    deckRef.current.reset();
    const newDeck = deckRef.current; // 竊・createShuffledDeck縺ｯ菴ｿ繧上↑縺・

    // 笨・繧ｹ繧ｿ繝・け蠑輔″邯吶℃蜆ｪ蜈磯・ｽ搾ｼ・
    //  1. prevPlayers・・howdown縺九ｉ貂｡縺輔ｌ縺滓怙譁ｰ迥ｶ諷具ｼ・
    //  2. 迴ｾ蝨ｨ縺ｮplayers・医ユ繝ｼ繝悶Ν縺ｫ谿九▲縺ｦ縺・ｋ迥ｶ諷具ｼ・
    //  3. 繝・ヵ繧ｩ繝ｫ繝亥・譛溷､
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

    // 徴 繧ｷ繝ｼ繝医い繧ｦ繝亥愛螳・
    const filteredPrev = prev.map((p) => {
      const busted = p.isBusted || p.stack <= 0;
      if (busted) {
        console.warn(`[SEAT-OUT] ${p.name} is out (stack=${p.stack})`);
        return { ...p, stack: 0, folded: true, allIn: true, seatOut: true, isBusted: true };
      }
      return { ...p, seatOut: false, isBusted: false };
    });

    // ・ 繝励Ξ繧､繝､繝ｼ驟榊・繧堤函謌・
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

    // 繧ｷ繝ｼ繝医い繧ｦ繝医・蜊ｳfold謇ｱ縺・
    for (const p of newPlayers) {
      if (p.seatOut) {
        p.folded = true;
        p.allIn = true;
        p.hand = [];
        p.isBusted = true;
        p.hasActedThisRound = true;
      }
    }

    // ｧｩ 繧｢繧ｯ繝・ぅ繝紋ｺｺ謨ｰ蛻､螳・
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

    // SB/BB 縺ｮ繝悶Λ繧､繝ｳ繝画髪謇輔＞
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
    // --- 迥ｶ諷区峩譁ｰ ---
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

    // Raise繧ｫ繧ｦ繝ｳ繧ｿ繝ｻ蟄ｦ鄙偵Ο繧ｰ蛻晄悄蛹・
    setRaiseCountThisRound(0);
    setRaisePerRound([0, 0, 0, 0]);
    setRaisePerSeatRound(
      Array(NUM_PLAYERS)
        .fill(0)
        .map(() => [0, 0, 0, 0])
    );
    setActionLog([]);

    // 谺｡繝上Φ繝画ｺ門ｙ
    handSavedRef.current = false;
    handIdRef.current = `${nextDealerIdx}-${Date.now()}`;

    debugLog("[HAND] New players dealt:", newPlayers.map((p) => p.name));
    debugLog(
      `[STATE] phase=BET, drawRound=0, turn=${
        (nextDealerIdx + 3) % NUM_PLAYERS
      }, currentBet=${initialCurrentBet}`
    );

    // ｧｩ 霑ｽ蜉: 繝・ヰ繝・げ讀懆ｨｼ逕ｨ縺ｫ縲梧眠繝上Φ繝牙・繝励Ξ繧､繝､繝ｼ迥ｶ諷九阪ｒ繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ蜃ｺ蜉・
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

    // ｧｩ 蜿ら・繝√ぉ繝・け縺ｯ prevPlayers 縺縺代↓髯仙ｮ夲ｼ・layers 縺ｯ譖ｴ譁ｰ蜑榊盾辣ｧ縺ｪ縺ｮ縺ｧ隱､隴ｦ蜻翫・蜴溷屏・・
    if (Array.isArray(prevPlayers) && prevPlayers.some(p => p?.hasDrawn || p?.showHand)) {
      console.warn("[INFO] previous hand snapshot had SHOWDOWN flags (expected):", prevPlayers);
    }

    setTimeout(() => logState("NEW HAND"), 0);

    // 蜀榊・髦ｲ豁｢繝輔Λ繧ｰ繧堤洒譎る俣縺ｧ隗｣髯､
    setTimeout(() => { dealingRef.current = false; }, 100);
     trace("・ dealNewHand END", { dealerIdx: nextDealerIdx });
  }

  // === 潤 繝倥ャ繧ｺ繧｢繝・・豎ｺ蜍晄姶逕ｨ ===
  function dealHeadsUpFinal(prevPlayers) {
    debugLog("[FINALS] dealHeadsUpFinal start");

    const heads = prevPlayers.filter(p => !p.seatOut);
    if (heads.length !== 2) {
      console.warn("[FINALS] Cannot start: not exactly 2 active players");
      setPhase("TOURNAMENT_END");
      return;
    }

    const nextDealerIdx = 0; // BTN蝗ｺ螳・
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

    // Small blind / big blind險ｭ螳・
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

  // 笆ｼ 迥ｶ諷句､牙喧繧堤屮隕悶＠縺ｦ繝ｭ繧ｰ蜃ｺ蜉・
  useEffect(() => {
    debugLog(
      `[STATE] phase=${phase}, drawRound=${drawRound}, turn=${turn}, currentBet=${currentBet}`
    );
  }, [phase, drawRound, turn, currentBet]);


  /* --- common: after BET action (snapshot-based) --- */
  function afterBetActionWithSnapshot(snap, actedIndex) {
    // --- 繧ｪ繝ｼ繝ｫ繧､繝ｳ繝励Ξ繧､繝､繝ｼ縺ｯBET繝輔ぉ繝ｼ繧ｺ縺ｧ繧ｹ繧ｭ繝・・ ---
    if (snap[turn]?.allIn) {
      setHasActedFlag(snap, turn);
      console.log(`[SKIP] Player ${snap[turn].name} is all-in 竊・skip action`);
      const nxt = nextAliveFrom(snap, turn);
      if (nxt !== null) setTurn(nxt);
      return;
    }

    trace("afterBetActionWithSnapshot()", { phase, drawRound, actedIndex });
    if (transitioning) {
      setPlayers(snap);
      return;
    }

    // 庁 繧ｪ繝ｼ繝ｫ繧､繝ｳ陬懈ｭ｣・嘖tack<=0 縺ｮ繝励Ξ繧､繝､繝ｼ繧・allIn=true 縺ｫ邨ｱ荳
    for (let i = 0; i < snap.length; i++) {
      const p = snap[i];
      if (!p.folded && p.stack <= 0 && !p.allIn) {
        console.warn(`[AUTO-FIX] ${p.name} stack=${p.stack} 竊・allIn=true`);
        snap[i] = { ...p, stack: 0, allIn: true };
      }
    }

    // --- 繝ｭ繧ｰ蜃ｺ蜉帛ｼｷ蛹・---
    const phaseLabel = `[${phase}] Round=${drawRound}`;
    debugLog(
      `${phaseLabel} acted=${snap[actedIndex]?.name}, turn=${actedIndex}, currentBet=${currentBet}`
    );
    snap.forEach((p, i) =>
      debugLog(
        `  P${i + 1}(${p.name}): bet=${p.betThisRound}, stack=${p.stack}, folded=${p.folded}, allIn=${p.allIn}`
      )
    );

    // 騾比ｸｭ縺ｧ蜍晁ｲ豎ｺ逹縺ｪ繧臥ｵゆｺ・
    if (checkIfOneLeftThenEnd(snap)) return;

    // 迴ｾ蝨ｨ縺ｮ譛螟ｧ繝吶ャ繝医ｒ蜿肴丐
    const maxNow = maxBetThisRound(snap);
    if (currentBet !== maxNow) setCurrentBet(maxNow);

    // 谺｡縺ｮ繧｢繧ｯ繝・ぅ繝・
    const next = nextAliveFrom(snap, actedIndex);
    setPlayers(snap);

    // 庁 霑ｽ蜉・夂樟蝨ｨ繧｢繧ｯ繧ｷ繝ｧ繝ｳ縺励◆繝励Ξ繧､繝､繝ｼ繧呈・遉ｺ逧・↓蜿門ｾ・
    const me = { ...snap[actedIndex] };
    
    // ------------------------
    // BET繝輔ぉ繝ｼ繧ｺ荳ｭ
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

      // 庁 BB縺後∪縺繧｢繧ｯ繧ｷ繝ｧ繝ｳ縺励※縺・↑縺・ｴ蜷医・邨ｶ蟇ｾ縺ｫ邨ゆｺ・＆縺帙↑縺・
      const bbIndex = (dealerIdx + 2) % NUM_PLAYERS;
      let isBBActed = true;

      // 庁 繝励Μ繝峨Ο繝ｼ(BET#0)縺ｮ縺ｿBB陦悟虚蠢・・
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

      // ｧ BET邨ゆｺ・擅莉ｶ縺ｮ隧ｳ邏ｰ繝ｭ繧ｰ蜃ｺ蜉幢ｼ域､懆ｨｼ逕ｨ・・
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
        // 繝吶ャ繝・繝ｬ繧､繧ｺ縺後≠繧・竊・蜈ｨ蜩｡繧ｳ繝ｼ繝ｫ荳閾ｴ縺ｧ邨ゆｺ・ｼ医・繝ｪ縺ｮ縺ｿBB陦悟虚蠢・茨ｼ・
        shouldEnd = everyoneMatched && isBBActed;
      } else if (isHU) {
        // HU縺ｮ繝√ぉ繝・け繧｢繝ｩ繧ｦ繝ｳ繝会ｼ壻ｸ｡閠・｡悟虚貂医∩縺ｪ繧臥ｵゆｺ・
        const bothActed = active.every(p => !!p.lastAction);
        shouldEnd = bothActed;
      } else {
        // 繝槭Ν繝√え繧ｧ繧､・壼・蜩｡Check縺ｧ邨ゆｺ・
        shouldEnd = allChecked;
      }

      console.log("[BET][RESULT]", { shouldEnd, everyoneMatched, allChecked, isBBActed, nextAlive, betHead });

      if (shouldEnd) {
        debugLog(`[BET] 笨・Round complete (everyone matched) 竊・schedule finishBetRoundFrom()`);
          if (checkIfOneLeftThenEnd(snap)) {
            debugLog("[FORCE_END] Only one active player remains 竊・goShowdownNow()");
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
    // DRAW繝輔ぉ繝ｼ繧ｺ荳ｭ
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
        // 蜈ｨ蜩｡・・old/all-in 莉･螟厄ｼ峨′蠑輔″邨ゅｏ繧・
        finishDrawRound(snap);
        return;
      }
      if (turn !== nextIdx) {
        setTurn(nextIdx);
        return;
      }
      // 縺薙％縺ｾ縺ｧ譚･縺溘ｉ縲御ｻ翫′縺昴・莠ｺ縺ｮ逡ｪ縲阪・
      // 莠ｺ髢・0)縺ｪ繧蔚I蠕・■縲¨PC縺ｪ繧・useEffect 蛛ｴ縺瑚・蜍輔ラ繝ｭ繝ｼ縲・

    }
  }

  // App() 蜀・↓霑ｽ蜉
  function recycleFoldedAndDiscardsBeforeCurrent(snap, currentIdx) {
    const order = orderFromSB();
    const pos = order.indexOf(currentIdx);
    if (pos <= 0) return;

    // 逶ｴ蜑阪∪縺ｧ縺ｮ繝輔か繝ｼ繝ｫ繝峨・繝ｬ繧､繝､繝ｼ縺ｮ謇区惆繧貞屓蜿・
    const toCheck = order.slice(0, pos);
    const muck = [];
    toCheck.forEach(i => {
      const pl = snap[i];
      if (pl?.folded && Array.isArray(pl.hand)) {
        muck.push(...pl.hand);
      }
    });

    // 謐ｨ縺ｦ譛ｭ・・eckManager.discardPile・峨ｂ蜀榊茜逕ｨ
    const dm = deckRef.current;
    if (muck.length || (dm.discardPile && dm.discardPile.length)) {
      dm.recycleNow(muck);
      debugLog(`[RECYCLE] +${muck.length} cards (folded) + existing discard 竊・new deck=${dm.deck.length}`);
    }
  }

  /* --- actions: BET --- */
  function playerFold() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };
    me.folded = true;
    me.lastAction = "Fold";
    me.hasActedThisRound = true;
    logAction(0, "Fold");
    snap[0] = me;
    recordActionToLog({
      round: currentBetRoundIndex(),
      seat: 0,
      type: me.lastAction,
      stackBefore: me.stack,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound,
    });

    afterBetActionWithSnapshot(snap, 0);
  }

  function playerCall() {
    if (phase !== "BET") return;
    const snap = [...players];
    const me = { ...snap[0] };
    
    // 徴 繧ｹ繧ｿ繝・け縺檎┌縺・ｴ蜷医・菴輔ｂ縺励↑縺・
    if (me.stack <= 0) {
      console.warn("[BLOCK] Player has no stack 窶・cannot act");
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
      round: currentBetRoundIndex(),
      seat: 0,
      type: me.lastAction,
      stackBefore: me.stack + pay,
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
        round: currentBetRoundIndex(),
        seat: 0,
        type: me.lastAction,
        stackBefore: me.stack,
        betAfter: me.betThisRound,
        raiseCountTable: raiseCountThisRound,
      });

      afterBetActionWithSnapshot(snap, 0);
    } else {
      playerCall();
    }
  }

    // --- 5繝吶ャ繝医く繝｣繝・・莉倥″ Raise 蜃ｦ逅・---
  function playerRaise() {
     if (phase !== "BET") return;
     const snap = [...players];
     const me = { ...snap[0] };

     // 徴 繧ｹ繧ｿ繝・け縺檎┌縺・ｴ蜷医・ Raise 荳榊庄
     if (me.stack <= 0) {
       console.warn("[BLOCK] Player has no stack 窶・cannot raise");
       return;
     }

    // 笨・5bet繧ｭ繝｣繝・・蛻､螳夲ｼ・aise荳企剞4蝗橸ｼ・
     if (raiseCountThisRound >= 4) {
       logAction(0, "Raise blocked (5-bet cap reached)", { raiseCountThisRound });
       debugLog(`[CAP] 5-bet cap reached (Raise blocked after ${raiseCountThisRound})`);
       playerCall(); // Call謇ｱ縺・
       return;
     }

    // 迴ｾ蝨ｨ縺ｮ譛螟ｧ繝吶ャ繝磯｡・
    const maxNow = maxBetThisRound(snap);
    const toCall = Math.max(0, maxNow - me.betThisRound);
    const raiseAmt = betSize;
    const total = toCall + raiseAmt;

    // --- Raise 螳溯｡・---
    const pay = Math.min(me.stack, total);
    me.stack -= pay;
    me.betThisRound += pay;
    me.lastAction = pay < total ? "Raise (All-in)" : "Raise";
    
    if (me.stack === 0) me.allIn = true;
    me.hasActedThisRound = true;

    snap[0] = me;

    // 笨・Raise蝗樊焚繧､繝ｳ繧ｯ繝ｪ繝｡繝ｳ繝・
    setRaiseCountThisRound((c) => c + 1);

    // 笨・譛蠕後↓Raise縺励◆繝励Ξ繧､繝､繝ｼ繧偵・繝・ヨ繝倥ャ繝峨↓譖ｴ譁ｰ
    setBetHead(0); // 竊・閾ｪ蛻・′Raise縺励◆縺ｮ縺ｧbetHead繧呈峩譁ｰ
    setLastAggressor(0);

     logAction(0, me.lastAction, {
       toCall,
       raise: raiseAmt,
       pay,
       newBet: me.betThisRound,
       raiseCount: raiseCountThisRound + 1,
    });

    // 繝ｬ繧､繧ｺ蠕後・譛螟ｧ繝吶ャ繝磯｡阪ｒ譖ｴ譁ｰ
    const newMax = maxBetThisRound(snap);
    if (currentBet !== newMax) setCurrentBet(newMax);

    afterBetActionWithSnapshot(snap, 0);

    // === 繝ｭ繧ｰ霑ｽ險・===
    recordActionToLog({
      round: currentBetRoundIndex(),
      seat: 0,
      type: me.lastAction,
      stackBefore: me.stack + pay,
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
          deckManager.discard([newHand[i]]); // 竊・莠､謠帛燕繧ｫ繝ｼ繝峨ｒ謐ｨ縺ｦ譛ｭ縺ｫ
          replaced.push({ index: i, oldCard: newHand[i], newCard });
          newHand[i] = newCard;
        } else {
          debugLog(`[DRAW] No card for slot[${i}] 竊・keep`);
        }
      });

      p.hand = [...newHand];

      console.log(`[DRAW] You exchanged ${replaced.length} card(s):`);
      replaced.forEach(({ index, oldCard, newCard }) =>
        console.log(`   slot[${index}] ${oldCard} 竊・${newCard}`)
      );

      recordActionToLog({
        round: currentBetRoundIndex(),
        seat: 0,
        type: `DRAW (${replaced.length})`,
        stackBefore: p.stack,
        betAfter: p.betThisRound,
        raiseCountTable: raiseCountThisRound,
        drawInfo: {
          drawCount: replaced.length,
          replacedCards: replaced,
          before: oldHand,
          after: p.hand,
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
  if (turn === 0) return; // 閾ｪ蛻・・逡ｪ縺ｯUI謫堺ｽ・

  const p = players[turn];
  if (!p || p.folded) {
    const nxt = nextAliveFrom(players, turn);
    if (nxt !== null) setTurn(nxt);
    return;
  }

  // 徴 All-in 縺ｯ陦悟虚繧ｹ繧ｭ繝・・
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

      // 縺溘∪縺ｫRaise
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
        round: currentBetRoundIndex(),
        seat: turn,
        type: me.lastAction,
        stackBefore,
        betAfter: me.betThisRound,
        raiseCountTable: raiseCountThisRound,
      });
      afterBetActionWithSnapshot(snap, turn);
      } else if (phase === "DRAW") {
    const snap = [...players];

    // 1) 譛牙柑繝励Ξ繧､繝､繝ｼ・医ヵ繧ｩ繝ｼ繝ｫ繝・繧ｪ繝ｼ繝ｫ繧､繝ｳ莉･螟厄ｼ・
    const actives = snap.filter(p => !p.folded);
    const everyoneDrawn = actives.every(p => p.hasDrawn);

    // 2) 蜈ｨ蜩｡繝峨Ο繝ｼ貂医∩縺ｪ繧我ｸ蝗槭□縺腺ET縺ｸ驕ｷ遘ｻ
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

    // 3) 谺｡縺ｫ繝峨Ο繝ｼ縺吶∋縺堺ｺｺ・・asDrawn=false 縺ｮ譛蛻昴・莠ｺ・峨ｒ蝗ｺ螳・
    const nextToDraw = firstUndrawnFromSB(snap);
    console.log("[DRAW][NEXT_TO_DRAW]", nextToDraw);
    if (nextToDraw === -1) {
      if (!transitioning) {
        setTransitioning(true);
        setTimeout(() => { finishDrawRound(snap); setTransitioning(false); }, 50);
      }
      return;
    }

    // 4) 繧ｿ繝ｼ繝ｳ繝昴う繝ｳ繧ｿ繧呈ｬ｡縺ｫ縺吶∋縺堺ｺｺ縺ｸ蜷医ｏ縺帙ｋ・医＄繧九＄繧句屓縺輔↑縺・ｼ・
    if (turn !== nextToDraw) {
      setTurn(nextToDraw);
      return;
    }

    // 5) 螳滄圀縺ｮ繝峨Ο繝ｼ・井ｻ翫′逡ｪ縺ｮ繝励Ξ繧､繝､繝ｼ縺縺托ｼ・
    const me = { ...snap[nextToDraw] };
    const { score } = evaluateBadugi(me.hand);
    const drawCount = score > 8 ? 3 : score > 5 ? 2 : score > 3 ? 1 : 0;
    const deckManager = deckRef.current;
    const newHand = [...me.hand];
    for (let i = 0; i < drawCount; i++) {
      let pack = deckManager.draw(1);
      if (!pack || pack.length === 0) {
        recycleFoldedAndDiscardsBeforeCurrent(snap, nextToDraw);
        pack = deckManager.draw(1);
      }
      if (pack && pack.length > 0) {
        deckManager.discard([newHand[i]]);
        newHand[i] = pack[0];
      } else {
        debugLog(`[DRAW][NPC seat=${nextToDraw}] no card for slot[${i}] 竊・keep`);
      }
    }
    me.hand = newHand;
    me.hasDrawn = true;
    me.lastDrawCount = drawCount;
    me.lastAction = `DRAW(${drawCount})`;
    snap[nextToDraw] = me;

    setDeck([]);
    setPlayers(snap);
    logAction(nextToDraw, me.lastAction);
    recordActionToLog({
      round: currentBetRoundIndex(),
      seat: nextToDraw,
      type: me.lastAction,
      stackBefore: me.stack,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound,
    });

    // 6) 谺｡縺ｮ譛ｪ繝峨Ο繝ｼ閠・∈縲ゅ＞縺ｪ縺代ｌ縺ｰBET縺ｸ
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


  /* --- SHOWDOWN螳御ｺ・竊・螻･豁ｴ菫晏ｭ假ｼ・繝上Φ繝・蝗橸ｼ・--- */
  useEffect(() => {
    if (phase !== "SHOWDOWN") return;
    if (handSavedRef.current) return;

    trySaveHandOnce({ playersSnap: players, dealerIdx, pots });
  }, [phase, showNextButton]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== 螻･豁ｴ菫晏ｭ倥Θ繝ｼ繝・ぅ繝ｪ繝・ぅ =====
  function trySaveHandOnce({ playersSnap, dealerIdx, pots, potOverride }) {
    debugLog("[HISTORY] trySaveHandOnce called");
    try {
      const handId = handIdRef.current ?? `${dealerIdx}-${Date.now()}`;
      handIdRef.current = handId;

      // 邱上・繝・ヨ・・ettled + 迴ｾ蝨ｨ縺ｮbet・峨ｒ螳牙・縺ｫ險育ｮ・
      const pot =
        typeof potOverride === "number"
          ? potOverride
          : Number(
           ((pots || []).reduce((s, p) => s + (p?.amount || 0), 0) || 0) +
           ((playersSnap || []).reduce((s, p) => s + (p?.betThisRound || 0), 0) || 0)
          ) || 0;

      // 蜍晁・耳螳夲ｼ・valuateBadugi 縺ｧ譛濶ｯ繧ｹ繧ｳ繧｢繧呈戟縺､髱槭ヵ繧ｩ繝ｼ繝ｫ繝峨・蜷榊燕・・
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
          // result 縺ｯ驟榊・縺ｾ縺ｧ霑ｽ縺・▼繧峨＞縺ｮ縺ｧ莉雁屓縺ｯ逵∫払・亥ｰ・擂: runShowdown縺九ｉ蜿励￠蜿悶ｋ・・
        })),
        actions: [], // 莉翫・譛ｪ髮・ｨ医ょｰ・擂: 繝吶ャ繝・繝峨Ο繝ｼ縺ｮ繝ｭ繧ｰ繧定ｩｰ繧√ｋ
        pot,
        // === Badugi隧穂ｾ｡繝ｭ繧ｸ繝・け繧剃ｽｿ縺｣縺ｦ蜍晄風邨先棡繧剃ｿ晏ｭ・===
        showdown: playersSnap.map(p => ({
          name: p.name,
          hand: p.hand,
          folded: !!p.folded,
          badugiEval: evaluateBadugi(p.hand),
        })),
        winners: (() => {
          const active = playersSnap.filter(p => !p.folded);
          if (active.length === 0) return [];
          // 譛濶ｯBadugi繧呈ｱｺ螳・
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
          perRound: raisePerRound,                 // 萓・ [2,0,3,1]
          perSeatPerRound: raisePerSeatRound,      // 萓・ [[1,0,1,0],[1,0,2,1],...]
          totalRaises: raisePerRound.reduce((a,b)=>a+b,0),
          roundsPlayed: Math.max(
            1, // 繝励Μ縺ｯ蠢・★縺ゅｋ
            Math.min(drawRound + 1, 4) // 騾ｲ陦檎憾豕√↓蠢懊§縺檻ET謨ｰ
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
      // 菫晏ｭ倥↓螟ｱ謨励＠縺ｦ繧ゅご繝ｼ繝縺ｯ邯咏ｶ・
      // console.error("save hand failed", e);
    }
  }

  /* --- UI --- */
  const centerX = typeof window !== "undefined" ? window.innerWidth / 2 : 400;
  const centerY = typeof window !== "undefined" ? window.innerHeight / 2 : 300;
  const radiusX = 350;
  const radiusY = 220;

  // ワ 謇区惆繧ｯ繝ｪ繝・け蜃ｦ逅・
function handleCardClick(i) {
  // 繝励Ξ繧､繝､繝ｼ縺ｮ驕ｸ謚樒憾諷九ｒ繝医げ繝ｫ
  setPlayers((prev) => {
    return prev.map((p, idx) => {
      if (idx !== 0) return p; // 閾ｪ蛻・ｻ･螟悶・縺昴・縺ｾ縺ｾ

      const selected = p.selected ? [...p.selected] : [];
      const already = selected.includes(i);
      const newSelected = already
        ? selected.filter((x) => x !== i)
        : [...selected, i];

      // 縺ｾ縺｣縺溘￥譁ｰ縺励＞繧ｪ繝悶ず繧ｧ繧ｯ繝医ｒ霑斐☆
      return {
        ...p,
        selected: newSelected,
      };
    });
  });
}


  return (
  <div className="flex flex-col h-screen bg-gray-900 text-white">
    {/* 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏 繝倥ャ繝繝ｼ蝗ｺ螳・笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏 */}
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

    {/* 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏 繝｡繧､繝ｳ繝・・繝悶Ν鬆伜沺 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏 */}
    <main className="flex-1 mt-20 relative flex items-center justify-center overflow-auto bg-green-700">
      {/* 繝・・繝悶Ν・域里蟄倥ご繝ｼ繝驛ｨ蛻・ｼ・*/}
      <div className="relative w-[95%] max-w-[1200px] aspect-[4/3] bg-green-700 border-4 border-yellow-600 rounded-3xl shadow-inner">
        {/* 蟾ｦ荳奇ｼ啀ot */}
        <div className="absolute top-4 left-4 text-white font-bold space-y-1">
          <div>Total Pot: {totalPotForDisplay}</div>
        </div>

        {/* 蜿ｳ荳奇ｼ啀hase, Dealer 縺ｪ縺ｩ */}
        <div className="absolute top-4 right-4 text-white font-bold text-right space-y-1">
          <div>Phase: {phaseTagLocal()}</div>
          <div>Draw Progress: {drawRound}/{MAX_DRAWS}</div>
          {phase === "BET" && (
            <div>Raise Count (Table): {raiseCountThisRound} / 4</div>
          )}
          <div>Dealer: {players[dealerIdx]?.name ?? "-"}</div>
        </div>

        {/* 笆ｼ 繝励Ξ繧､繝､繝ｼ驟咲ｽｮ驛ｨ蛻・*/}
        {players.map((p, i) => (
          <Player
            key={i}
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
        ))}

        {/* controls・咤ET譎・or DRAW譎・縺・★繧後°荳譁ｹ縺縺・*/}
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

        {/* showdown蠕後・ Next Hand */}
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
          <h2 className="text-4xl font-bold text-yellow-400 mb-4">醇 TOURNAMENT FINISHED 醇</h2>
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


      {/* 笆ｼ 繝・ヰ繝・げ繝医げ繝ｫ繧ｹ繧､繝・メ */}
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

