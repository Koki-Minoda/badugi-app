// src/ui/App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Player from "./components/Player";
import Controls from "./components/Controls";
import PlayerStatusBoard from "./components/PlayerStatusBoard";
import Modal from "./components/Modal";
import Notification from "./components/Notification";
import TableSummaryPanel from "./components/TableSummaryPanel";
import HandResultOverlay from "./components/HandResultOverlay";
import { DEFAULT_SEAT_TYPES, DEFAULT_STARTING_STACK, TOURNAMENT_STRUCTURE } from "../tournament/tournamentStructure";
import { formatComment } from "./utils/commentCatalog.js";
import { DeckManager } from "../games/badugi/utils/deck";
import { debugLog } from "../utils/debugLog";
import { runDrawRound } from "../games/badugi/engine/drawRound";
import { runShowdown } from "../games/badugi/engine/showdown";
import { evaluateBadugi, compareBadugi, getWinnersByBadugi } from "../games/badugi/utils/badugiEvaluator";
import {
  startHandHistoryRecord,
  appendHandHistoryAction,
  updateHandHistorySeat,
  finalizeHandHistoryRecord,
  getCurrentHandHistoryRecord,
  resetHandHistoryRecord,
} from "./utils/handHistory";

import {
  aliveBetPlayers,
  aliveDrawPlayers,
  nextAliveFrom,
  maxBetThisRound,
  settleStreetToPots,
  isBetRoundComplete,
  finishBetRoundFrom,
  closingSeatForAggressor,
  isFoldedOrOut,
} from "../games/badugi/engine/roundFlow.js";

// History persistence helpers
import {
  saveRLHandHistory,
  getAllRLHandHistories,
  exportRLHistoryAsJSONL,
} from "../utils/history_rl";
import { useNavigate } from "react-router-dom";
import { loadTitleSettings } from "./utils/titleSettings";
import { useRatingState } from "./hooks/useRatingState.js";
import {
  applyMatchRatings,
  computeRankFromRating,
  exportP2PMatchesAsJSONL,
} from "./utils/ratingState.js";
import {
  loadAiTierOverride,
  persistAiTierOverride,
  loadP2pCaptureFlag,
  persistP2pCaptureFlag,
  DEV_EVENTS,
} from "./utils/devOverrides.js";
import { listTierIds, getTierById } from "../ai/tierManager.js";
import { useGameEngine } from "./engine/GameEngineContext";
import { mergeEngineSnapshot } from "./utils/engineSnapshotUtils.js";
import { loadActiveTournamentSession } from "./tournament/tournamentManager";
import { installE2eTestDriver } from "./utils/e2eTestDriver.js";

const DEFAULT_GAME_ID = "D03";

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
  const [tournamentSession, setTournamentSession] = useState(
    () => loadActiveTournamentSession()
  );
  const stageGameId = useMemo(
    () => tournamentSession?.gameId ?? DEFAULT_GAME_ID,
    [tournamentSession]
  );

  useEffect(() => {
    const handler = () => {
      setTournamentSession(loadActiveTournamentSession());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    }
    return undefined;
  }, []);
  const navigate = useNavigate();
  const NUM_PLAYERS = 6;
  const lastStructureIndex = TOURNAMENT_STRUCTURE.length - 1;

  const [startingStack, setStartingStack] = useState(DEFAULT_STARTING_STACK);
  const startingStackRef = useRef(startingStack);
  useEffect(() => {
    startingStackRef.current = startingStack;
  }, [startingStack]);

  const [seatConfig, setSeatConfig] = useState(() => [...DEFAULT_SEAT_TYPES]);
  const seatConfigRef = useRef(seatConfig);
  useEffect(() => {
    seatConfigRef.current = seatConfig;
  }, [seatConfig]);

  const [autoRotateSeats, setAutoRotateSeats] = useState(false);
  const autoRotateSeatsRef = useRef(autoRotateSeats);
  useEffect(() => {
    autoRotateSeatsRef.current = autoRotateSeats;
  }, [autoRotateSeats]);

  const [titleSettings, setTitleSettings] = useState(() => loadTitleSettings());
  const heroProfile = useMemo(
    () => ({
      name: titleSettings.playerName?.trim() || "You",
      titleBadge: titleSettings.playerTitle?.trim() || "",
      avatar: titleSettings.avatar || "default_avatar",
    }),
    [titleSettings]
  );
  useEffect(() => {
    function handleTitleUpdate() {
      setTitleSettings(loadTitleSettings());
    }
    if (typeof window !== "undefined") {
      window.addEventListener("badugi:titleSettings-updated", handleTitleUpdate);
      window.addEventListener("storage", handleTitleUpdate);
      return () => {
        window.removeEventListener("badugi:titleSettings-updated", handleTitleUpdate);
        window.removeEventListener("storage", handleTitleUpdate);
      };
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleTierEvent = (event) => {
      setDevTierOverride(event?.detail ?? loadAiTierOverride());
    };
    const handleP2pEvent = (event) => {
      if (typeof event?.detail === "boolean") {
        setP2pCaptureEnabled(event.detail);
      } else {
        setP2pCaptureEnabled(loadP2pCaptureFlag());
      }
    };
    window.addEventListener(DEV_EVENTS.tierOverrideChanged, handleTierEvent);
    window.addEventListener(DEV_EVENTS.p2pCaptureChanged, handleP2pEvent);
    return () => {
      window.removeEventListener(DEV_EVENTS.tierOverrideChanged, handleTierEvent);
      window.removeEventListener(DEV_EVENTS.p2pCaptureChanged, handleP2pEvent);
    };
  }, []);

  const [blindLevelIndex, setBlindLevelIndex] = useState(0);
  const [handsInLevel, setHandsInLevel] = useState(0);
  const currentStructure =
    TOURNAMENT_STRUCTURE[blindLevelIndex] ??
    TOURNAMENT_STRUCTURE[lastStructureIndex];
  const SB = currentStructure.sb;
  const BB = currentStructure.bb;
  const currentAnte = currentStructure.ante ?? 0;
  const betSize = BB;
  const seatTypeOptions = useMemo(
    () => [
      { value: "HUMAN", label: "Human" },
      { value: "CPU", label: "CPU" },
      { value: "EMPTY", label: "Empty" },
    ],
    []
  );
  const handsInLevelDisplay = Math.max(handsInLevel, 1);
  const handsCapDisplay = currentStructure.hands ?? "INF";
  const [seatManagerOpen, setSeatManagerOpen] = useState(false);
  const [statusBoardOpen, setStatusBoardOpen] = useState(true);
  const MAX_DRAWS = 3;
  const [uiPerf, setUiPerf] = useState({
    loadTime: null,
    lastInteractionDuration: null,
    lastInteractionLabel: "",
  });
  const interactionStartRef = useRef(null);
  const [locale, setLocale] = useState(() => {
    if (typeof navigator === "undefined") return "en";
    return navigator.language ?? "en";
  });
  const performanceSupported =
    typeof window !== "undefined" && typeof performance !== "undefined";
  useEffect(() => {
    if (!performanceSupported) return undefined;
    const start = performance.now();
    const handleLoad = () => {
      setUiPerf((prev) => ({
        ...prev,
        loadTime: Math.round(performance.now() - start),
      }));
    };
    if (typeof document !== "undefined" && document.readyState === "complete") {
      handleLoad();
      return undefined;
    }
    window.addEventListener("load", handleLoad);
    return () => window.removeEventListener("load", handleLoad);
  }, [performanceSupported]);
  const ratingState = useRatingState();
  const rankInfo = useMemo(
    () => computeRankFromRating(ratingState.globalRating),
    [ratingState.globalRating]
  );
  const heroHistoryLimit = 4;
  const HERO_TRACKER_STORAGE_KEY = "badugi.heroTracker";

  function getHeroTrackerStorage() {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  }

  function loadHeroTrackerState() {
    const storage = getHeroTrackerStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(HERO_TRACKER_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn("Failed to parse hero tracker state", err);
      return null;
    }
  }

  function persistHeroTrackerState(state) {
    const storage = getHeroTrackerStorage();
    if (!storage) return;
    try {
      if (state) {
        storage.setItem(HERO_TRACKER_STORAGE_KEY, JSON.stringify(state));
      } else {
        storage.removeItem(HERO_TRACKER_STORAGE_KEY);
      }
    } catch (err) {
      console.warn("Failed to persist hero tracker state", err);
    }
  }

  const [heroTracker, setHeroTracker] = useState(() => loadHeroTrackerState() ?? ({
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    lastOutcome: null,
    history: [],
    lastRatingDelta: 0,
  }));
  useEffect(() => {
    persistHeroTrackerState(heroTracker);
  }, [heroTracker]);
  const [handResultSummary, setHandResultSummary] = useState(null);
  const [handResultVisible, setHandResultVisible] = useState(false);
  const [devTierOverride, setDevTierOverride] = useState(() => loadAiTierOverride());
  const [p2pCaptureEnabled, setP2pCaptureEnabled] = useState(() => loadP2pCaptureFlag());
  const tierOptions = useMemo(
    () =>
      listTierIds().map((tierId) => ({
        id: tierId,
        label: getTierById(tierId)?.label ?? tierId,
      })),
    []
  );

  const deckRef = useRef(new DeckManager());

  const [players, setPlayers] = useState(() =>
    applyHeroProfile(
      buildPlayersFromSeatTypes(seatConfigRef.current, startingStackRef.current, heroProfile),
      heroProfile
    )
  );
  const playersRef = useRef(players);
  playersRef.current = players;
  const [deck, setDeck] = useState([]);
  const [engineState, setEngineState] = useState(null);
  const engineStateRef = useRef(null);
  const { engine } = useGameEngine();
  const [dealerIdx, setDealerIdx] = useState(0);

  const [phase, setPhase] = useState("BET"); // BET / DRAW / SHOWDOWN

  // Number of completed draw rounds (0..3).
  const [drawRound, setDrawRound] = useState(0);
  const [betRoundIndex, setBetRoundIndex] = useState(0);
  const drawRoundTracker = useRef(drawRound);
  const betRoundTracker = useRef(betRoundIndex);

  function setDrawRoundValue(value) {
    const previous = drawRoundTracker.current;
    const raw =
      typeof value === "function"
        ? value(previous)
        : value;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      console.warn("[ROUND-TRACK] setDrawRoundValue called with non-finite value", value);
      return previous;
    }
    const normalized = Math.min(Math.max(numeric, 0), MAX_DRAWS);
    drawRoundTracker.current = normalized;
    setDrawRound(normalized);
    console.debug(
      `[ROUND-TRACK] setDrawRoundValue ${normalized} (prev=${previous}, tracker=${drawRoundTracker.current})`
    );
    return normalized;
  }

  function setBetRoundValue(value) {
    const previous = betRoundTracker.current;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      console.warn("[ROUND-TRACK] setBetRoundValue called with non-finite value", value);
      return previous;
    }
    const normalized = Math.min(Math.max(numeric, 0), MAX_DRAWS);
    betRoundTracker.current = normalized;
    setBetRoundIndex(normalized);
    console.debug(
      `[ROUND-TRACK] setBetRoundValue ${normalized} (prev=${previous}, tracker=${betRoundTracker.current})`
    );
    return normalized;
  }

  function getPhaseRoundLabel(targetPhase) {
    const drawIdx = Math.max(0, Number(drawRoundTracker.current) || 0);
    if (targetPhase === "DRAW") {
      return drawIdx * 2 + 1;
    }
    if (targetPhase === "SHOWDOWN") {
      return drawIdx * 2 + 2;
    }
    return drawIdx * 2;
  }

  function getStreetRound(targetPhase) {
    if (targetPhase === "DRAW" || targetPhase === "SHOWDOWN") {
      return Math.max(0, Number(drawRoundTracker.current) || 0);
    }
    return Math.max(0, Number(betRoundTracker.current) || 0);
  }

  // Track raise counts per street (table + seat granularity).
  const [raisePerRound, setRaisePerRound] = useState([0, 0, 0, 0]);
  const [raisePerSeatRound, setRaisePerSeatRound] = useState(
    () => Array(NUM_PLAYERS).fill(0).map(() => [0, 0, 0, 0]) // [seat][round]
  );
  const [actionLog, setActionLog] = useState([]); // RL/action log feed

  function currentBetRoundIndex() {
    return Math.min(betRoundIndex, MAX_DRAWS);
  }

  
  const [pots, setPots] = useState([]);
  const potsRef = useRef(pots);
  useEffect(() => {
    potsRef.current = pots;
  }, [pots]);

  const [turn, setTurn] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);

  const [raiseCountThisRound, setRaiseCountThisRound] = useState(0);


  const [transitioning, setTransitioning] = useState(false);
  const transitioningRef = useRef(transitioning);
  const drawRoundLogCounter = useRef(1);
  useEffect(() => {
    transitioningRef.current = transitioning;
  }, [transitioning]);
  const [betHead, setBetHead] = useState(null);
  const [lastAggressor, setLastAggressor] = useState(null);
  const [showNextButton, setShowNextButton] = useState(false);

  const handSavedRef = useRef(false);
  const handIdRef = useRef(null);
  const handStartStacksRef = useRef([]);
  const handHistoryRef = useRef([]);
  const currentHandHistoryRef = useRef(null);

  const forcedSeatActionsRef = useRef(new Map());
  const e2eDriverApiRef = useRef({});

  const consoleLogBuffer = useRef([]);
  const e2eLogEnabledRef = useRef(false);
  const recentE2eActionIdsRef = useRef(new Set());
  const recentE2eActionQueueRef = useRef([]);
  const MAX_RECENT_E2E_ACTIONS = 128;
  const BADUGI_RANK_SYMBOLS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function resolveEvaluationCount(evaluation) {
    if (evaluation && typeof evaluation.count === "number") return evaluation.count;
    switch (evaluation?.rankType) {
      case "BADUGI":
        return 4;
      case "THREE_CARD":
        return 3;
      case "TWO_CARD":
        return 2;
      case "ONE_CARD":
      default:
        return 1;
    }
  }

  function formatBadugiHandLabel(evaluation) {
    const count = Math.max(0, resolveEvaluationCount(evaluation));
    if (count >= 4) return "Badugi 4-card";
    if (count > 0) return `Badugi ${count}-card`;
    return "Badugi";
  }

  function formatBadugiRanksLabel(evaluation) {
    if (!evaluation || !Array.isArray(evaluation.ranks) || evaluation.ranks.length === 0) return "-";
    return evaluation.ranks
      .map((value) => BADUGI_RANK_SYMBOLS[value] ?? `${value}`)
      .join("-");
  }
  const e2eErrorLogRef = useRef(new Set());
  const lastPotSummaryRef = useRef([]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const drainConsole = () => consoleLogBuffer.current.splice(0);
    const helperMethods = {
      simulateBust(seatIndex = 3) {
        setPlayers((prev) =>
          prev.map((player, idx) =>
            idx === seatIndex
              ? {
                  ...player,
                  stack: 0,
                  betThisRound: 0,
                  folded: true,
                  allIn: true,
                  isBusted: true,
                  seatOut: true,
                  hasActedThisRound: true,
                  lastAction: "BUSTED",
                }
              : player
          )
        );
      },
      setDealerIndex(next) {
        if (typeof next !== "number") return;
        const normalized = Math.max(0, Math.min(NUM_PLAYERS - 1, Math.floor(next)));
        setDealerIdx(normalized);
      },
      getPhaseState() {
        const snapshot = (playersRef.current ?? []).map((player, idx) => {
          const seatIndex = typeof player?.seat === "number" ? player.seat : idx;
          return {
            seat: seatIndex,
            name: player?.name,
            stack: player?.stack,
            betThisRound: player?.betThisRound,
            totalInvested: player?.totalInvested ?? 0,
            lastAction: player?.lastAction,
            folded: Boolean(player?.folded),
            hasFolded: Boolean(player?.hasFolded),
            allIn: Boolean(player?.allIn),
            seatOut: Boolean(player?.seatOut),
            hand: Array.isArray(player?.hand) ? [...player.hand] : [],
          };
        });
        return {
          phase,
          drawRound,
          betRoundIndex,
          betRound: betRoundIndex,
          turn,
          dealerIdx,
          handId: handIdRef.current,
          players: snapshot,
        };
      },
      drainLogs: drainConsole,
      captureConsole: drainConsole,
    };

    const existing = window.__BADUGI_E2E__;
    const target =
      existing && typeof existing === "object" ? existing : {};
    const createdNew = !existing || typeof existing !== "object";

    Object.assign(target, helperMethods);
    window.__BADUGI_E2E__ = target;
    e2eLogEnabledRef.current = true;

    return () => {
      if (typeof window === "undefined") return;
      if (window.__BADUGI_E2E__ && window.__BADUGI_E2E__ === target) {
        Object.entries(helperMethods).forEach(([key, fn]) => {
          if (window.__BADUGI_E2E__?.[key] === fn) {
            delete window.__BADUGI_E2E__[key];
          }
        });
        if (Object.keys(window.__BADUGI_E2E__).length === 0) {
          delete window.__BADUGI_E2E__;
        }
      }
      e2eLogEnabledRef.current = false;
    };
  }, [phase, drawRound, betRoundIndex, turn, dealerIdx]);

  useEffect(() => {
    const original = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };
    console.log = (...args) => {
      consoleLogBuffer.current.push(formatConsole("LOG", args));
      original.log(...args);
    };
    console.warn = (...args) => {
      consoleLogBuffer.current.push(formatConsole("WARN", args));
      original.warn(...args);
    };
    console.error = (...args) => {
      consoleLogBuffer.current.push(formatConsole("ERROR", args));
      original.error(...args);
    };
    return () => {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    };
  }, []);

  const [debugMode, setDebugMode] = useState(false);
  function debugLog(...args) {
    if (debugMode) console.log(...args);
  }

  const raiseCountRef = useRef(raiseCountThisRound);
  useEffect(() => {
    raiseCountRef.current = raiseCountThisRound;
  }, [raiseCountThisRound]);

  function clonePlayerState(player) {
    if (!player) return null;
    return {
      ...player,
      hand: Array.isArray(player.hand) ? [...player.hand] : player.hand,
      selected: Array.isArray(player.selected) ? [...player.selected] : player.selected,
    };
  }

  function formatConsole(level, args) {
    const payload = args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : `${arg}`))
      .join(" ");
    return `[${level}] phase=${phase} drawRound=${drawRound} betRound=${betRoundIndex} turn=${turn} ${payload}`;
  }

  function setPlayerSnapshot(snap) {
    const normalized = Array.isArray(snap)
      ? snap.map(clonePlayerState).filter(Boolean)
      : [];
    setPlayers(normalized);
    return normalized;
  }

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
      if (!isFoldedOrOut(p) && !p?.hasDrawn) return i;
    }
    return -1;
  };

  function shiftAggressorsAfterFold(snap, foldIdx) {
    if (!Array.isArray(snap) || typeof foldIdx !== "number") return;
    // フォールドしたプレイヤが最後のアグレッサーだった場合のみ、
    // 次の生きているプレイヤをアグレッサーとして引き継ぐ。
    if (lastAggressor === foldIdx) {
      const nextSeat = nextAliveFrom(snap, foldIdx);
      setLastAggressor(nextSeat ?? null);
    }
  }

  function findNextActiveSeat(snap, startIdx = 0) {
    if (!Array.isArray(snap) || snap.length === 0) return null;
    const n = snap.length;
    for (let offset = 0; offset < n; offset += 1) {
      const candidate = (startIdx + offset) % n;
      const player = snap[candidate];
      if (player && !isFoldedOrOut(player) && !player.allIn) {
        return candidate;
      }
    }
    return null;
  }

  function firstBetterAfterBlinds(snap, dealerIndex = dealerIdx) {
    if (!Array.isArray(snap) || snap.length === 0) return 0;
    const n = snap.length;
    const start = ((dealerIndex + 3) % n + n) % n;
    for (let offset = 0; offset < n; offset += 1) {
      const seat = (start + offset) % n;
      const player = snap[seat];
      if (player && !isFoldedOrOut(player) && !player.allIn) {
        return seat;
      }
    }
    return start;
  }

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
    return Math.min(betRoundIndex, MAX_DRAWS);
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

  function buildHandResultSummary({ players = [], summary = [], totalPot }) {
    const potEntries = Array.isArray(summary) ? summary : [];
    const hydrateWinnerEntry = (entry, explicitSeat = null) => {
      const seatIndex =
        typeof explicitSeat === "number"
          ? explicitSeat
          : typeof entry?.seatIndex === "number"
          ? entry.seatIndex
          : typeof entry?.seat === "number"
          ? entry.seat
          : null;
      const playerState = typeof seatIndex === "number" ? players?.[seatIndex] : null;
      const playerHand = playerState?.hand ?? entry?.hand ?? [];
      const evaluation =
        entry?.evaluation && typeof entry.evaluation === "object"
          ? entry.evaluation
          : playerHand.length
          ? evaluateBadugi(playerHand)
          : null;
      const activeCards =
        evaluation?.activeCards && evaluation.activeCards.length
          ? evaluation.activeCards
          : playerHand;
      const deadCards = evaluation?.deadCards ?? [];

      return {
        seatIndex,
        name: entry?.name ?? (typeof seatIndex === "number" ? `Seat ${seatIndex}` : "Unknown"),
        payout: Math.max(0, entry?.payout ?? 0),
        stack: playerState?.stack,
        hand: playerHand,
        handLabel: formatBadugiHandLabel(evaluation),
        ranksLabel: formatBadugiRanksLabel(evaluation),
        activeCards,
        deadCards,
      };
    };

    const rawPotDetails = potEntries.map((pot) => {
      const potAmount = Math.max(0, pot?.potAmount ?? pot?.amount ?? 0);
      const payouts = Array.isArray(pot?.payouts) ? pot.payouts : [];
      const winners = payouts.map((entry) => {
        const seatKey =
          typeof entry?.seatIndex === "number"
            ? entry.seatIndex
            : typeof entry?.seat === "number"
            ? entry.seat
            : null;
        return hydrateWinnerEntry(entry, seatKey);
      });
      return {
        potIndex: typeof pot?.potIndex === "number" ? pot.potIndex : null,
        potAmount,
        winners,
      };
    });

    const filteredPotDetails = rawPotDetails.filter(
      (pot) => pot.potAmount > 0 || (pot.winners ?? []).length > 0
    );
    const potDetails = filteredPotDetails.length ? filteredPotDetails : rawPotDetails;

    const payoutSum = potDetails
      .flatMap((pot) => pot.winners)
      .reduce((acc, entry) => acc + (entry.payout ?? 0), 0);
    const potAmountFallback = potDetails.reduce((acc, pot) => acc + (pot.potAmount ?? 0), 0);
    const resolvedTotal =
      typeof totalPot === "number" && !Number.isNaN(totalPot)
        ? totalPot
        : Math.max(potAmountFallback, payoutSum);
    const winnerMap = new Map();
    potDetails.flatMap((pot) => pot.winners).forEach((entry) => {
      if (typeof entry.seatIndex !== "number") return;
      const existing = winnerMap.get(entry.seatIndex);
      const merged = existing
        ? {
            ...existing,
            payout: (existing.payout ?? 0) + (entry.payout ?? 0),
          }
        : { ...entry };
      winnerMap.set(entry.seatIndex, merged);
    });
    const winners = Array.from(winnerMap.values()).map((entry) => ({
      ...entry,
      payout: entry.payout ?? 0,
    }));
    return {
      handId: handIdRef.current,
      pot: resolvedTotal,
      winners,
      potDetails: potDetails.length
        ? potDetails
        : winners.length
        ? [
            {
              potIndex: 0,
              potAmount: resolvedTotal,
              winners,
            },
          ]
        : [],
    };
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
  const hand = Array.isArray(players[i]?.hand)
    ? players[i].hand.join(" ")
    : "";
  console.log(
    `[HANDSTATE] phase=${phaseTagLocal()} turn=${turn} seat=${i} hand=${hand} folded=${players[i]?.folded} stack=${players[i]?.stack}`
  );
}
  function emitE2EActionTrace(entry, playerSnapshot) {
    if (!e2eLogEnabledRef.current) return;
    const seatIdx = typeof entry.seat === "number" ? entry.seat : null;
    const handId = handIdRef.current ?? "unknown-hand";
    const phaseForStreet = entry.phase ?? phaseSnapshot ?? phase;
    const street =
      entry.street ??
      (phaseForStreet === "DRAW"
        ? "draw"
        : phaseForStreet === "SHOWDOWN"
        ? "showdown"
        : "bet");
    const seatState =
      playerSnapshot ?? (seatIdx !== null ? playersRef.current?.[seatIdx] : null);
    if (
      seatState &&
      (seatState.folded || seatState.hasFolded) &&
      entry.action !== "Fold"
    ) {
      logE2EError("folded seat acted", {
        seat: seatIdx,
        action: entry.action,
        round: entry.round,
        street,
      });
      return;
    }
    const hand = Array.isArray(seatState?.hand) ? seatState.hand.join(" ") : "";
    const metaString =
      entry.metadata && Object.keys(entry.metadata).length
        ? JSON.stringify(entry.metadata)
        : "{}";
    const stackBefore =
      entry.stackBefore ??
      (seatState && typeof seatState.stack === "number" ? seatState.stack : "?");
    const stackAfter =
      entry.stackAfter ??
      (seatState && typeof seatState.stack === "number" ? seatState.stack : "?");
    const betBefore =
      entry.betBefore ??
      (seatState && typeof seatState.betThisRound === "number"
        ? seatState.betThisRound
        : "?");
    const betAfter =
      entry.betAfter ??
      (seatState && typeof seatState.betThisRound === "number"
        ? seatState.betThisRound
        : "?");
    const logDrawRound = entry.drawRound ?? drawRoundTracker.current;
    const logBetRound = entry.betRound ?? betRoundTracker.current;
    const streetRound =
      typeof entry.streetRound === "number"
        ? entry.streetRound
        : street === "draw" || street === "showdown"
        ? logDrawRound
        : logBetRound;
    console.log(
      `[E2E-ACTION] handId=${handId} street=${street} streetRound=${streetRound} phase=${entry.phase} round=${entry.round} seat=${seatIdx ?? "-"} name=${entry.seatName} action=${entry.action} stackBefore=${stackBefore} stackAfter=${stackAfter} betBefore=${betBefore} betAfter=${betAfter} hand=${hand} turn=${turn} drawRound=${logDrawRound} betRound=${logBetRound} metadata=${metaString}`
    );
    const drawInfo = entry.metadata?.drawInfo;
    if (drawInfo) {
      const replaced = Array.isArray(drawInfo.replacedCards)
        ? drawInfo.replacedCards
            .map(
              (change) =>
                `${change.oldCard ?? "?"}->${change.newCard ?? "?"}@idx${change.index}`
            )
            .join(", ")
        : "";
      const before = Array.isArray(drawInfo.before)
        ? drawInfo.before.join(" ")
        : "";
      const after = Array.isArray(drawInfo.after)
        ? drawInfo.after.join(" ")
        : "";
      console.log(
        `[E2E-DRAW] seat=${seatIdx ?? "-"} drawCount=${drawInfo.drawCount ?? "?"} replaced=[${replaced}] before=[${before}] after=[${after}]`
      );
    }
  }
  function logE2EError(message, extra = {}) {
    const payload = {
      handId: handIdRef.current ?? "unknown-hand",
      phase,
      drawRound,
      betRound: betRoundIndex,
      turn,
      ...extra,
    };
    console.error(`[E2E-ERROR] ${message}`, payload);
  }
  function logE2ESkip(seat, reason) {
    const roster = playersRef.current ?? players;
    const seatCount = Array.isArray(roster) ? roster.length : 0;
    if (
      seat == null ||
      Number.isNaN(seat) ||
      seat < 0 ||
      seat >= seatCount
    ) {
      const aliveSeats = Array.isArray(roster)
        ? roster.filter((p) => !isFoldedOrOut(p)).length
        : 0;
      if (aliveSeats === 0) {
        console.warn(
          `[E2E-SKIP] seat=${seat ?? "null"} reason=${reason} hand=${
            handIdRef.current ?? "unknown"
          } phase=${phase} drawRound=${drawRound} betRound=${betRoundIndex}`
        );
      }
      return;
    }
    console.warn(
      `[E2E-SKIP] seat=${seat} reason=${reason} hand=${handIdRef.current ?? "unknown"} phase=${phase} drawRound=${drawRound} betRound=${betRoundIndex}`
    );
  }
  function logE2EEvent(tag, details = {}) {
    const context = {
      handId: handIdRef.current ?? "unknown-hand",
      phase,
      drawRound,
      betRound: betRoundIndex,
      turn,
      street: phase === "DRAW" ? "draw" : phase === "SHOWDOWN" ? "showdown" : "bet",
      streetRound:
        phase === "DRAW" || phase === "SHOWDOWN"
          ? Math.max(0, Number(drawRoundTracker.current) || 0)
          : Math.max(0, Number(betRoundTracker.current) || 0),
      ...details,
    };
    const seatLabel =
      typeof details.seat === "number" ? ` seat=${details.seat}` : "";
    console.log(`[E2E-EVENT] ${tag}${seatLabel}`, context);
  }
  function ensureSeatCanAct(seat, context) {
    const roster = playersRef.current ?? players;
    const seatCount = Array.isArray(roster) ? roster.length : 0;
    if (
      seat == null ||
      Number.isNaN(seat) ||
      seat < 0 ||
      seat >= seatCount
    ) {
      logE2EError("invalid seat before action", { seat, context });
      return false;
    }
    const player = roster[seat];
    if (turn !== seat) {
      logE2EError("turn mismatch before action", {
        seat,
        context,
        expectedTurn: turn,
      });
      return false;
    }
    if (!player || isFoldedOrOut(player)) {
      logE2EError("player not active before action", {
        seat,
        context,
        hasFolded: player?.hasFolded,
        folded: player?.folded,
      });
      logE2ESkip(seat, "folded");
      return false;
    }
    console.assert(
      player.hasFolded !== true,
      `Invariant violated: player.hasFolded already true before action seat=${seat} context=${context}`
    );
    return true;
  }
  function normalizeHandHistoryType(label) {
    if (!label) return "action";
    const lower = label.toLowerCase();
    if (lower.includes("all-in")) return "all-in";
    if (lower.startsWith("raise")) return "raise";
    if (lower.startsWith("bet")) return "bet";
    if (lower.startsWith("call")) return "call";
    if (lower.startsWith("check")) return "check";
    if (lower.startsWith("fold")) return "fold";
    if (lower.startsWith("draw")) return "draw";
    if (lower.startsWith("collect")) return "collect";
    if (lower.startsWith("ante")) return "ante";
    if (lower.startsWith("blind")) return "blind";
    return lower.trim() || "action";
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
  const sourcePlayers = playersRef.current ?? players;
  const seatSnapshot = playerState
    ? clonePlayerState(playerState)
    : idx !== null
    ? clonePlayerState(sourcePlayers?.[idx])
    : null;
  const phaseLabel = phaseOverride ?? phase;
  const phaseSnapshot = phase;
  const resolvedDrawRound =
    typeof drawRound === "number" ? drawRound : drawRoundTracker.current;
  const resolvedBetRound = betRoundTracker.current;
  const resolvedRound = round ?? getPhaseRoundLabel(phaseLabel);
  const resolvedStreetRound = getStreetRound(phaseLabel);
  const nextActionId =
    metadata?.actionId ??
    `${handIdRef.current ?? "unknown"}|${phaseLabel}|${resolvedRound}|${seat ?? "table"}|${type}|${Math.round(
      stackBefore ?? 0
    )}|${Math.round(stackAfter ?? 0)}`;
  const mergedMeta = {
    ...(metadata || {}),
    actionId: nextActionId,
  };
  const normalizedDrawInfo = drawInfo
    ? {
        ...drawInfo,
        replacedCards: Array.isArray(drawInfo.replacedCards)
          ? drawInfo.replacedCards.map((entry) => ({
              index: entry?.index ?? null,
              oldCard: entry?.oldCard,
              newCard: entry?.newCard,
            }))
          : drawInfo.replacedCards,
        before: Array.isArray(drawInfo.before) ? [...drawInfo.before] : drawInfo.before,
        after: Array.isArray(drawInfo.after) ? [...drawInfo.after] : drawInfo.after,
      }
    : undefined;
  if (normalizedDrawInfo) mergedMeta.drawInfo = normalizedDrawInfo;
  if (extra && typeof extra === "object") {
    mergedMeta.extra = { ...extra };
  }

  const resolvedStackBefore =
    typeof stackBefore === "number"
      ? stackBefore
      : seatSnapshot && typeof seatSnapshot.stack === "number"
      ? seatSnapshot.stack
      : null;
  const resolvedStackAfter =
    typeof stackAfter === "number"
      ? stackAfter
      : seatSnapshot && typeof seatSnapshot.stack === "number"
      ? seatSnapshot.stack
      : null;
  const resolvedBetBefore =
    typeof betBefore === "number"
      ? betBefore
      : seatSnapshot && typeof seatSnapshot.betThisRound === "number"
      ? seatSnapshot.betThisRound
      : 0;
  const resolvedBetAfter =
    typeof betAfter === "number"
      ? betAfter
      : seatSnapshot && typeof seatSnapshot.betThisRound === "number"
      ? seatSnapshot.betThisRound
      : 0;

  console.assert(
    typeof resolvedStackBefore === "number" && typeof resolvedStackAfter === "number",
    "[LOG] stack values missing for action",
    { seat: idx, type, phase: phaseLabel, resolvedStackBefore, resolvedStackAfter }
  );

  const nextEntry = {
    phase: phaseLabel,
    phaseSnapshot,
    round: resolvedRound,
    street: phaseLabel,
    streetRound: resolvedStreetRound,
    seat: idx,
    seatName: seatName ?? seatSnapshot?.name ?? (idx === null ? "TABLE" : `Seat ${idx}`),
    action: type,
    stackBefore: resolvedStackBefore,
    stackAfter: resolvedStackAfter,
    betBefore: resolvedBetBefore,
    betAfter: resolvedBetAfter,
    potAfter: potAfter ?? totalPotRef.current,
    raiseCountTable,
    metadata: Object.keys(mergedMeta).length ? mergedMeta : undefined,
    drawRound: resolvedDrawRound,
    betRound: resolvedBetRound,
    ts: Date.now(),
  };
  if (idx !== null && currentHandHistoryRef.current) {
    const historyType = normalizeHandHistoryType(type);
    const amountDelta = Math.max(0, (resolvedBetAfter ?? 0) - (resolvedBetBefore ?? 0));
    const totalInvestedValue =
      seatSnapshot?.totalInvested ??
      playerState?.totalInvested ??
      sourcePlayers?.[idx]?.totalInvested ??
      resolvedBetAfter ??
      0;
    const historyMetadata = normalizedDrawInfo ? { drawInfo: normalizedDrawInfo } : undefined;
    appendHandHistoryAction({
      seat: idx,
      street: phaseLabel,
      type: historyType,
      amount: amountDelta,
      totalInvested: totalInvestedValue,
      metadata: historyMetadata,
    });
    if (historyType === "fold") {
      updateHandHistorySeat(idx, { finalAction: "fold" });
    }
  }
  setActionLog((prev) => [...prev, nextEntry]);
  if (shouldEmitE2EAction(nextActionId)) {
    emitE2EActionTrace(nextEntry, seatSnapshot);
  }
  }
  function logE2EError(message, extra = {}) {
    const handId = handIdRef.current ?? "unknown-hand";
    const payload = {
      handId,
      phase,
      drawRound,
      betRound: betRoundIndex,
      turn,
      ...extra,
    };
    console.error(`[E2E-ERROR] ${message}`, payload);
  }

  function shouldEmitE2EAction(actionId) {
    const recent = recentE2eActionIdsRef.current;
    if (recent.has(actionId)) return false;
    recent.add(actionId);
    recentE2eActionQueueRef.current.push(actionId);
    if (recentE2eActionQueueRef.current.length > MAX_RECENT_E2E_ACTIONS) {
      const oldest = recentE2eActionQueueRef.current.shift();
      if (oldest) recent.delete(oldest);
    }
    return true;
  }

  const applyForcedBetAction = useCallback(
    (seat, payload = {}) => {
      if (phase !== "BET") return false;
      const forceInstant = payload?.__forceInstant;
      if (!forceInstant && turn !== seat) return false;
      const roster = playersRef.current;
      if (!Array.isArray(roster) || seat < 0 || seat >= roster.length) return false;

      const snap = roster.map(clonePlayerState).filter(Boolean);
      const actor = snap[seat];
      if (!actor || isFoldedOrOut(actor)) {
        forcedSeatActionsRef.current.delete(seat);
        return false;
      }

      const stackBefore = actor.stack;
      const betBefore = actor.betThisRound;
      const maxNow = maxBetThisRound(snap);
      const toCall = Math.max(0, maxNow - actor.betThisRound);
      let actionType = (payload.type || "call").toLowerCase();
      let raiseSize = Number.isFinite(payload.amount) ? Math.max(0, payload.amount) : betSize;
      let raiseApplied = false;

      const invest = (chips) => {
        if (chips <= 0) return 0;
        const applied = Math.min(actor.stack, chips);
        actor.stack -= applied;
        actor.betThisRound += applied;
        if (applied > 0) {
          actor.totalInvested = (actor.totalInvested ?? 0) + applied;
        }
        if (actor.stack === 0) {
          actor.allIn = true;
          actor.hasActedThisRound = true;
        }
        return applied;
      };

      switch (actionType) {
        case "fold":
          actor.folded = true;
          actor.hasFolded = true;
          actor.lastAction = "Fold";
          actor.hasActedThisRound = true;
          break;
        case "check":
          if (toCall > 0) {
            actionType = "call";
            // fallthrough to call handling
          } else {
            actor.lastAction = "Check";
            actor.hasActedThisRound = true;
            break;
          }
        // eslint-disable-next-line no-fallthrough
        case "call": {
          const paid = invest(toCall);
          actor.lastAction = paid === 0 ? "Check" : "Call";
          actor.hasActedThisRound = true;
          break;
        }
        case "bet":
        case "raise": {
          invest(toCall);
          const paidRaise = invest(Math.max(raiseSize, betSize));
          actor.lastAction = "Raise";
          actor.hasActedThisRound = true;
          raiseApplied = paidRaise > 0;
          break;
        }
        case "all-in": {
          invest(toCall);
          const shoveTarget =
            payload.amount == null ? actor.stack : Math.max(0, payload.amount);
          const paid = invest(shoveTarget);
          actor.lastAction = "All-in";
          actor.hasActedThisRound = true;
          raiseApplied = paid > 0;
          break;
        }
        default:
          console.warn("[E2E] Unknown forced action type:", payload.type);
          return false;
      }

      snap[seat] = actor;
      playersRef.current = snap;
      forcedSeatActionsRef.current.delete(seat);

      logAction(seat, actor.lastAction || actionType.toUpperCase(), { forced: true });
      recordActionToLog({
        phase: "BET",
        round: currentBetRoundIndex(),
        seat,
        playerState: actor,
        type: actor.lastAction,
        stackBefore,
        stackAfter: actor.stack,
        betBefore,
        betAfter: actor.betThisRound,
        raiseCountTable: raiseCountThisRound,
      });

      if (actor.folded) {
        shiftAggressorsAfterFold(snap, seat);
      } else if (raiseApplied) {
        setRaiseCountThisRound((count) => count + 1);
        setBetHead(seat);
        setLastAggressor(seat);
      }

      afterBetActionWithSnapshot(snap, seat);
      return true;
    },
    [
      phase,
      betSize,
      raiseCountThisRound,
      afterBetActionWithSnapshot,
      setBetHead,
      setLastAggressor,
      turn,
    ]
  );

  const applyCustomHands = useCallback(
    (overrides = []) => {
      if (!Array.isArray(overrides) || overrides.length === 0) return;
      setPlayers((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const snap = prev.map(clonePlayerState).filter(Boolean);
        let mutated = false;
        overrides.forEach(
          ({ seat, cards, totalInvested, betThisRound: betOverride, stack, allIn }) => {
          if (
            typeof seat !== "number" ||
            seat < 0 ||
            seat >= snap.length ||
            !Array.isArray(cards) ||
            cards.length === 0
          ) {
            return;
          }
          const normalizedHand = cards.map((card) => String(card).toUpperCase());
          snap[seat] = {
            ...snap[seat],
            hand: normalizedHand,
            folded: false,
            hasFolded: false,
            allIn: Boolean(allIn),
          };
          if (typeof totalInvested === "number") {
            snap[seat].totalInvested = Math.max(0, totalInvested);
          }
          if (typeof betOverride === "number") {
            snap[seat].betThisRound = Math.max(0, betOverride);
          }
          if (typeof stack === "number") {
            snap[seat].stack = Math.max(0, stack);
          }
          mutated = true;
        });
        if (!mutated) return prev;
        syncEngineSnapshot({
          players: snap,
          pots,
          metadata: {
            currentBet,
            betHead,
            lastAggressor,
            actingPlayerIndex: turn,
          },
        });
        return snap;
      });
    },
    [pots, currentBet, betHead, lastAggressor, turn, syncEngineSnapshot]
  );

  const queueForcedSeatAction = useCallback(
    (seat, payload = {}) => {
      if (typeof seat !== "number") return;
      forcedSeatActionsRef.current.set(seat, { ...payload });
      if (phase === "BET") {
        applyForcedBetAction(seat, payload);
      }
    },
    [phase, applyForcedBetAction]
  );

  const forceSequentialFolds = useCallback(
    (seats = []) => {
      const list = Array.isArray(seats) ? seats : [seats];
      list.forEach((seat) => queueForcedSeatAction(seat, { type: "fold", __forceInstant: true }));
    },
    [queueForcedSeatAction]
  );

  const forceAllInAction = useCallback(
    (seat, amount) => {
      queueForcedSeatAction(seat, { type: "all-in", amount, __forceInstant: true });
    },
    [queueForcedSeatAction]
  );

  const resolveHandImmediately = useCallback(() => {
    const roster = playersRef.current;
    if (!Array.isArray(roster) || roster.length === 0) return;
    const snapshot = roster.map(clonePlayerState).filter(Boolean);
    goShowdownNow(snapshot, { force: true });
  }, [goShowdownNow]);

  const handleTierOverrideChange = (event) => {
    const nextTier = event.target.value || null;
    const stored = persistAiTierOverride(nextTier);
    setDevTierOverride(stored);
  };

  const clearTierOverride = () => {
    persistAiTierOverride(null);
    setDevTierOverride(null);
  };

  const toggleP2pCapture = () => {
    const next = persistP2pCaptureFlag(!p2pCaptureEnabled);
    setP2pCaptureEnabled(next);
  };

  const handleExportP2pMatches = () => {
    exportP2PMatchesAsJSONL();
  };

  function deriveHeroOutcome(record) {
    const hero = record.players?.[0];
    if (!hero) return null;
    const winners = Array.isArray(record.winners) ? record.winners : [];
    const heroWon = hero.name ? winners.includes(hero.name) : false;
    const isSplit = heroWon && winners.length > 1;
    const value = heroWon ? (isSplit ? 0.5 : 1) : 0;
    const label = heroWon
      ? isSplit
        ? "Split pot"
        : "Win"
      : hero.folded
      ? "Fold"
      : "Loss";
    return { label, value };
  }

  function recordHeroTracker(record, outcome, ratingAfter, ratingDelta) {
    if (!outcome) return;
    setHeroTracker((prev) => {
      const entry = {
        id: record.handId,
        ts: record.ts,
        outcome: outcome.label,
        resultValue: outcome.value,
        pot: record.pot,
        stack: record.players?.[0]?.stack ?? 0,
        ratingAfter: ratingAfter?.globalRating ?? ratingState.globalRating,
        ratingDelta: typeof ratingDelta === "number" ? ratingDelta : 0,
      };
      const nextHistory = [entry, ...prev.history].slice(0, heroHistoryLimit);
      const nextStreak =
        outcome.value === 1
          ? prev.streak >= 0
            ? prev.streak + 1
            : 1
          : outcome.value === 0
          ? prev.streak <= 0
            ? prev.streak - 1
            : -1
          : 0;
      return {
        ...prev,
        wins: prev.wins + (outcome.value === 1 ? 1 : 0),
        losses: prev.losses + (outcome.value === 0 ? 1 : 0),
        draws: prev.draws + (outcome.value === 0.5 ? 1 : 0),
        streak: nextStreak,
        lastOutcome: outcome.label,
        history: nextHistory,
        lastRatingDelta: typeof ratingDelta === "number" ? ratingDelta : prev.lastRatingDelta,
      };
    });
  }

  /* --- utils --- */
  function rotateSeatBlueprint(config = [], direction = 1) {
    if (!Array.isArray(config) || config.length <= 1) return [...config];
    const head = config[0];
    const rest = config.slice(1);
    if (rest.length === 0) return [head];
    const len = rest.length;
    const offset = ((direction % len) + len) % len;
    const rotatedRest = rest.map(
      (_, idx) => rest[(idx - offset + len) % len]
    );
    return [head, ...rotatedRest];
  }

  function applyHeroProfile(list = [], profile) {
    if (!profile) return list;
    return list.map((player, idx) =>
      idx === 0
        ? {
            ...player,
            name: profile.name,
            titleBadge: profile.titleBadge,
            avatar: profile.avatar,
          }
        : player
    );
  }

  function buildPlayersFromSeatTypes(seatConfig, stackValue = DEFAULT_STARTING_STACK, profile = heroProfile) {
    return seatConfig.map((seatType, idx) => {
      const isHuman = seatType === "HUMAN";
      const isEmpty = seatType === "EMPTY";
      const heroName = profile?.name ?? "You";
      return {
        name: isHuman ? heroName : `CPU ${idx + 1}`,
        seatType,
        isCPU: !isHuman && !isEmpty,
        hand: [],
      folded: isEmpty,
      hasFolded: isEmpty,
        allIn: false,
        isBusted: isEmpty,
        hasActedThisRound: false,
        seatOut: isEmpty,
        stack: isEmpty ? 0 : stackValue,
        betThisRound: 0,
        selected: [],
        showHand: isHuman,
        lastAction: "",
        hasDrawn: false,
        lastDrawCount: 0,
        titleBadge: isHuman ? profile?.titleBadge ?? "" : "",
        avatar: isHuman ? profile?.avatar ?? "default_avatar" : undefined,
      };
    });
  }

  function handleSeatTypeChange(index, nextType) {
    if (index === 0) return; // Seat 0 must remain the human hero.
    setSeatConfig((prev) => {
      if (!Array.isArray(prev) || prev[index] === nextType) return prev;
      const updated = [...prev];
      updated[index] = nextType;
      seatConfigRef.current = updated;
      return updated;
    });
  }

  function rotateSeatConfigOnce(direction = 1) {
    setSeatConfig((prev) => {
      const rotated = rotateSeatBlueprint(prev, direction);
      seatConfigRef.current = rotated;
      return rotated;
    });
  }

  function consumeSeatConfigForHand(shouldRotate) {
    const blueprint = seatConfigRef.current;
    if (!shouldRotate) return [...blueprint];
    const rotated = rotateSeatBlueprint(blueprint, 1);
    seatConfigRef.current = rotated;
    setSeatConfig(rotated);
    return rotated;
  }

  function handleStartingStackChange(value) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    const normalized = Math.max(0, Math.floor(parsed));
    setStartingStack(normalized);
  }

  function resetSeatConfigToDefault() {
    const reset = [...DEFAULT_SEAT_TYPES];
    seatConfigRef.current = reset;
    setSeatConfig(reset);
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

  function goShowdownNow(playersSnap, options = {}) {
    debugLog("[SHOWDOWN] goShowdownNow (All-in shortcut) called");
    const forceShowdown = options.force === true;

    if (engine && !forceShowdown && handleEngineShowdown(drawRound)) {
      return;
    }

    const active = playersSnap.filter((p) => !isFoldedOrOut(p));
    if (active.length === 0) return;
    if (!forceShowdown && active.length > 1 && drawRound < MAX_DRAWS) {
      debugLog("[SHOWDOWN] skipping early showdown because multiple players remain");
      return;
    }

    const { pots: settledPots, clearedPlayers } = settleStreetToPots(playersSnap, pots);
    const workingPlayers = Array.isArray(clearedPlayers) && clearedPlayers.length
      ? clearedPlayers
      : playersSnap.map(clonePlayerState).filter(Boolean);
    const activeSeats = workingPlayers
      .map((p, seatIdx) => (!isFoldedOrOut(p) ? seatIdx : null))
      .filter((seatIdx) => seatIdx !== null);
    const allPots =
      settledPots && settledPots.length > 0
        ? settledPots
        : [
            {
              amount: 0,
              eligible: activeSeats,
            },
          ];

    console.log("[SHOWDOWN] === RESULTS (BADUGI) ===");
    const newStacks = workingPlayers.map((p) => p.stack);
    const showdownSummary = [];

    allPots.forEach((pot, potIdx) => {
      const eligiblePlayers = pot.eligible
        .map((i) => ({ seat: i, name: workingPlayers[i]?.name, hand: workingPlayers[i]?.hand }))
        .filter((p) => !isFoldedOrOut(workingPlayers[p.seat]));

      if (eligiblePlayers.length === 0) {
        showdownSummary.push({
          potIndex: potIdx,
          potAmount: pot.amount ?? 0,
          payouts: [],
        });
        return;
      }

      const winners = getWinnersByBadugi(eligiblePlayers);
      const evaluationBySeat = new Map(
        winners.map((entry) => [typeof entry.seat === "number" ? entry.seat : entry.seatIndex, entry])
      );
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount % winners.length;
      const payouts = [];

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
          payouts.push({
            seat: idx,
            name: workingPlayers[idx]?.name ?? w.name,
            amount: payout,
            stackBefore,
            stackAfter: newStacks[idx],
            hand: workingPlayers[idx]?.hand ?? [],
            evaluation: evaluationBySeat.get(idx)?.evaluation ?? evaluateBadugi(workingPlayers[idx]?.hand ?? []),
          });
          recordActionToLog({
            phase: "SHOWDOWN",
            round: drawRound + 1,
            seat: idx,
            seatName: workingPlayers[idx]?.name ?? w.name,
            playerState: {
              ...workingPlayers[idx],
              stack: newStacks[idx],
              betThisRound: 0,
            },
            type: `Collect ${payout}`,
            stackBefore,
            stackAfter: newStacks[idx],
            betBefore: workingPlayers[idx]?.betThisRound ?? 0,
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

      showdownSummary.push({
        potIndex: potIdx,
        potAmount: pot.amount ?? 0,
        payouts: payouts.map((entry) => ({ ...entry })),
        eligible: Array.isArray(pot.eligible) ? [...pot.eligible] : [],
      });
    });

    const totalPotAmount = allPots.reduce((sum, pot) => sum + (pot.amount || 0), 0);
    if (debugMode) {
      console.log("[CHECK][SHOWDOWN_BALANCE]", {
        stacksAtStartOfHand: handStartStacksRef.current,
        stacksBeforeShowdown: workingPlayers.map((p) => p.stack),
        newStacksAfterShowdown: newStacks,
        potList: allPots,
        totalPot: totalPotAmount,
      });
    }

    const updated = workingPlayers.map((p, i) => ({
      ...p,
      stack: newStacks[i],
      showHand: true,
      result: p.folded ? "FOLD" : "SHOW",
      isBusted: newStacks[i] <= 0,
    }));

    console.log(
      "[SHOWDOWN] DETAILS ->",
      updated.map((player, seat) => ({
        seat,
        name: player.name,
        hand: Array.isArray(player.hand) ? player.hand.join(" ") : "",
        result: player.result,
        stack: player.stack,
        isBusted: player.isBusted,
      }))
    );
    const potSnapshot = showdownSummary.map((pot, potIdx) => ({
      potIndex: pot.potIndex ?? potIdx,
      amount: pot.potAmount ?? 0,
      eligible: Array.isArray(pot.eligible) ? [...pot.eligible] : [],
      winners: (pot.payouts ?? []).map((entry) => ({
        seat: entry.seat ?? entry.seatIndex,
        name: entry.name,
        payout: entry.payout,
        hand: Array.isArray(entry.hand) ? entry.hand.join(" ") : "",
        evaluation: entry.evaluation,
        activeCards: entry.evaluation?.activeCards ?? [],
        deadCards: entry.evaluation?.deadCards ?? [],
      })),
    }));
    console.log("[SHOWDOWN] POT SUMMARY ->", potSnapshot);
    lastPotSummaryRef.current = potSnapshot.map((entry) => ({
      potIndex: entry.potIndex,
      amount: entry.amount,
      eligible: [...entry.eligible],
      winners: entry.winners.map((winner) => ({ ...winner })),
    }));

    setPots([]);
    setShowNextButton(true);
    setPlayers(updated);
    setPhase("SHOWDOWN");
    setHandResultVisible(true);
    const handSummaryPayload = buildHandResultSummary({
      players: updated,
      summary: showdownSummary,
      totalPot: totalPotAmount,
    });
    setHandResultSummary(handSummaryPayload);
    const finalizedRecord = finalizeHandHistoryRecord({
      players: updated,
      pots: showdownSummary,
      uiSummary: handSummaryPayload,
      endedAt: Date.now(),
    });
    if (finalizedRecord) {
      const snapshot = JSON.parse(JSON.stringify(finalizedRecord));
      handHistoryRef.current = [...handHistoryRef.current, snapshot];
      console.log("[HAND_HISTORY]", JSON.stringify(snapshot));
      resetHandHistoryRecord();
      currentHandHistoryRef.current = null;
    }

    const totalPot = totalPotAmount;
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
    while (isFoldedOrOut(players[next])) {
      next = (next + 1) % n;
      safety++;
      if (safety > n) return null;
    }
    return next;
  }

  function checkIfOneLeftThenEnd(snapOpt) {
    const base =
      Array.isArray(snapOpt) && snapOpt.length > 0
        ? snapOpt
        : playersRef.current ?? players;
    if (!base || base.length === 0) return false;

    const active = base.filter((p) => !isFoldedOrOut(p) && !p.allIn);
    if (active.length === 1) {
      const showdownSnap = base.map(clonePlayerState).filter(Boolean);
      goShowdownNow(showdownSnap);
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

  // Legacy entry point kept for older callers（NPC auto-action 等）。
  // 実際の進行処理は afterBetActionWithSnapshot(...) に委譲する。
  function advanceAfterAction(updatedPlayers, actedIndex) {
    const snap = Array.isArray(updatedPlayers)
      ? [...updatedPlayers]
      : [...players];

    const idx =
      typeof actedIndex === "number"
        ? actedIndex
        : turn;

    afterBetActionWithSnapshot(snap, idx);
  }

  /* --- dealing --- */
  function dealNewHand(nextDealerIdx = 0, prevPlayers = null) {
    trace("dealNewHand START", { nextDealerIdx, prevPlayersCount: prevPlayers?.length ?? 0 });
    if (dealingRef.current) {
      debugLog("[HAND] dealNewHand skipped (already in progress)");
      return;
    }
    dealingRef.current = true;
    lastPotSummaryRef.current = [];
    debugLog(`[HAND] dealNewHand start -> dealer=${nextDealerIdx}`);
    setHandResultVisible(false);
    setHandResultSummary(null);

    const isFreshStart = !prevPlayers;
    let resolvedBlindIdx = isFreshStart ? 0 : blindLevelIndex;
    let resolvedHandCount = isFreshStart ? 1 : Math.max(1, handsInLevel + 1);
    const structureAtLevel =
      TOURNAMENT_STRUCTURE[resolvedBlindIdx] ??
      TOURNAMENT_STRUCTURE[lastStructureIndex];
    const handCap = structureAtLevel.hands;
    const shouldLevelUp =
      !isFreshStart &&
      Number.isFinite(handCap) &&
      handCap > 0 &&
      resolvedHandCount > handCap &&
      resolvedBlindIdx < lastStructureIndex;

    if (shouldLevelUp) {
      resolvedBlindIdx = Math.min(resolvedBlindIdx + 1, lastStructureIndex);
      resolvedHandCount = 1;
    }

    setBlindLevelIndex(resolvedBlindIdx);
    setHandsInLevel(resolvedHandCount);

    const structureForHand =
      TOURNAMENT_STRUCTURE[resolvedBlindIdx] ??
      TOURNAMENT_STRUCTURE[lastStructureIndex];
    const sbValue = structureForHand.sb;
    const bbValue = structureForHand.bb;
    const anteValue = structureForHand.ante ?? 0;

    const shouldRotateSeats = Boolean(prevPlayers && autoRotateSeatsRef.current);
    const effectiveSeatConfig = consumeSeatConfigForHand(shouldRotateSeats);

    deckRef.current.reset();
    const fallbackStack = startingStackRef.current;

    const prev = Array.from({ length: NUM_PLAYERS }, (_, i) => {
      const seatType =
        effectiveSeatConfig[i] ??
        prevPlayers?.[i]?.seatType ??
        players?.[i]?.seatType ??
        (i === 0 ? "HUMAN" : "CPU");
      const defaultName =
        seatType === "HUMAN"
          ? "You"
          : seatType === "CPU"
          ? `CPU ${i + 1}`
          : `Seat ${i + 1}`;
      const baseStack =
        seatType === "EMPTY"
          ? 0
          : prevPlayers?.[i]?.stack ??
            players?.[i]?.stack ??
            fallbackStack;
      return {
        name:
          prevPlayers?.[i]?.name ??
          players?.[i]?.name ??
          defaultName,
        stack: baseStack,
        isBusted:
          prevPlayers?.[i]?.isBusted ??
          players?.[i]?.isBusted ??
          seatType === "EMPTY",
        seatType,
        seatOut:
          prevPlayers?.[i]?.seatOut ??
          players?.[i]?.seatOut ??
          seatType === "EMPTY",
      };
    });

    // folded/hasFolded flags are only reset here when starting a new hand.
    // Once this hand begins, no other logic should clear those flags mid-hand.
    const filteredPrev = prev.map((p) => {
      const busted = p.isBusted || p.stack <= 0 || p.seatType === "EMPTY";
      if (busted) {
        console.warn(`[SEAT-OUT] ${p.name} is out (stack=${p.stack})`);
        return {
          ...p,
          stack: 0,
          folded: true,
          hasFolded: true,
          allIn: true,
          seatOut: true,
          isBusted: true,
        };
      }
      // 新しいハンドで座っているプレイヤーのフォールド状態は必ずリセットする。
      // ここで false に戻しておかないと、前ハンドで fold/all-in した座席が次ハンドでも
      // isFoldedOrOut 扱いになり、アクションが回ってこなくなる。
      return {
        ...p,
        seatOut: false,
        isBusted: false,
        hasFolded: false,
        folded: false,
        allIn: false,
      };
    });

    const newPlayers = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
      name: filteredPrev[i].name ?? `P${i + 1}`,
      seatType: filteredPrev[i].seatType ?? effectiveSeatConfig[i] ?? "CPU",
      stack: Math.max(filteredPrev[i].stack ?? fallbackStack, 0),
      seatOut: filteredPrev[i].seatOut ?? false,
      isBusted: filteredPrev[i].isBusted ?? false,
      hand: (filteredPrev[i].seatOut ?? false) ? [] : deckRef.current.draw(4),
      folded: filteredPrev[i].seatOut ?? false,
      hasFolded: filteredPrev[i].seatOut ?? false,
      allIn: filteredPrev[i].seatOut ?? false,
      betThisRound: 0,
      totalInvested: 0,
      hasDrawn: false,
      lastDrawCount: 0,
      selected: [],
      showHand: (filteredPrev[i].seatType ?? effectiveSeatConfig[i]) === "HUMAN",
      isDealer: i === nextDealerIdx,
      hasActedThisRound: filteredPrev[i].seatOut ?? false,
      lastAction: "",
      isCPU: (filteredPrev[i].seatType ?? effectiveSeatConfig[i]) === "CPU",
    }));
    if (newPlayers[0]) {
      newPlayers[0] = {
        ...newPlayers[0],
        name: heroProfile.name,
        titleBadge: heroProfile.titleBadge,
        avatar: heroProfile.avatar,
      };
    }

    // keep seatOut players marked as folded/hasFolded for the new hand; folded flags
    // must only ever change at hand boundaries or when a seat actively folds.
    for (const p of newPlayers) {
      if (p.seatOut) {
        p.folded = true;
        p.hasFolded = true;
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

    handSavedRef.current = false;
    handIdRef.current = `${nextDealerIdx}-${Date.now()}`;
    currentHandHistoryRef.current = startHandHistoryRecord({
      handId: handIdRef.current,
      dealer: nextDealerIdx,
      level: { sb: sbValue, bb: bbValue, ante: anteValue },
      seats: newPlayers.map((player, seat) => ({
        seat,
        name: player.name,
        startStack: player.stack,
      })),
      startedAt: Date.now(),
    });

    const sbIdx = (nextDealerIdx + 1) % NUM_PLAYERS;
    const bbIdx = (nextDealerIdx + 2) % NUM_PLAYERS;
    if (anteValue > 0) {
      newPlayers.forEach((pl, idx) => {
        if (pl.seatOut) return;
        const antePay = Math.min(pl.stack, anteValue);
        pl.stack -= antePay;
        pl.betThisRound += antePay;
        if (antePay > 0) {
          pl.totalInvested = (pl.totalInvested ?? 0) + antePay;
          appendHandHistoryAction({
            seat: idx,
            street: "BET",
            type: "ante",
            amount: antePay,
            totalInvested: pl.totalInvested ?? antePay,
            metadata: { ante: anteValue },
          });
        }
        if (antePay > 0) pl.lastAction = `ANTE(${antePay})`;
        if (pl.stack === 0) {
          pl.allIn = true;
          pl.hasActedThisRound = true;
        }
      });
    }

    const sbPay = Math.min(newPlayers[sbIdx].stack, sbValue);
    newPlayers[sbIdx].stack -= sbPay;
    newPlayers[sbIdx].betThisRound += sbPay;
    if (sbPay > 0) {
      newPlayers[sbIdx].totalInvested = (newPlayers[sbIdx].totalInvested ?? 0) + sbPay;
      appendHandHistoryAction({
        seat: sbIdx,
        street: "BET",
        type: "blind",
        amount: sbPay,
        totalInvested: newPlayers[sbIdx].totalInvested ?? sbPay,
        metadata: { blind: "SB" },
      });
    }
    if (newPlayers[sbIdx].stack === 0) {
      newPlayers[sbIdx].allIn = true;
      newPlayers[sbIdx].hasActedThisRound = true;
    }
    const bbPay = Math.min(newPlayers[bbIdx].stack, bbValue);
    newPlayers[bbIdx].stack -= bbPay;
    newPlayers[bbIdx].betThisRound += bbPay;
    if (bbPay > 0) {
      newPlayers[bbIdx].totalInvested = (newPlayers[bbIdx].totalInvested ?? 0) + bbPay;
      appendHandHistoryAction({
        seat: bbIdx,
        street: "BET",
        type: "blind",
        amount: bbPay,
        totalInvested: newPlayers[bbIdx].totalInvested ?? bbPay,
        metadata: { blind: "BB" },
      });
    }
    if (newPlayers[bbIdx].stack === 0) {
      newPlayers[bbIdx].allIn = true;
      newPlayers[bbIdx].hasActedThisRound = true;
    }
    const initialCurrentBet = Math.max(sbPay, bbPay);

    setPlayers(newPlayers);
    handStartStacksRef.current = newPlayers.map((p) => p.stack);
    setDeck([]);
    setPots([]);
    setCurrentBet(initialCurrentBet);
    setDealerIdx(nextDealerIdx);
    setDrawRoundValue(0);
    setBetRoundValue(0);
    setPhase("BET");
    const resolvedTurn = firstBetterAfterBlinds(newPlayers, nextDealerIdx); // UTG or next alive
    setTurn(resolvedTurn);
    setBetHead(resolvedTurn);
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
    drawRoundLogCounter.current = 1;
    const seedSnapshot = {
      players: newPlayers.map(clonePlayerState).filter(Boolean),
      pots: [],
      deck: deckRef.current.deck ?? [],
      metadata: {
        currentBet: initialCurrentBet,
        betHead: resolvedTurn,
        actingPlayerIndex: resolvedTurn,
        lastAggressor: bbIdx,
      },
      gameId: stageGameId,
      engineId: stageGameId,
    };
    syncEngineSnapshot(seedSnapshot, seedSnapshot);
    trace("dealNewHand END", { dealerIdx: nextDealerIdx });
  }

  const startNextHand = useCallback(() => {
    if (!handSavedRef.current) {
      trySaveHandOnce({
        playersSnap: playersRef.current ?? players,
        dealerIdx,
        pots: potsRef.current ?? pots,
      });
    }
    const nextDealer = (dealerIdx + 1) % NUM_PLAYERS;
    setShowNextButton(false);
    setHandResultVisible(false);
    dealNewHand(nextDealer);
  }, [dealerIdx, dealNewHand, trySaveHandOnce]);

  useEffect(() => {
    if (!handResultVisible) return undefined;
    const timer = setTimeout(() => {
      startNextHand();
    }, 5000);
    return () => clearTimeout(timer);
  }, [handResultVisible, startNextHand]);

  useEffect(() => {
    e2eDriverApiRef.current = {
      forceSeatAction: (seat, payload = {}) =>
        queueForcedSeatAction(seat, { ...payload, __forceInstant: true }),
      forceSequentialFolds,
      forceAllIn: forceAllInAction,
      resolveHandNow: resolveHandImmediately,
      dealNewHandNow: startNextHand,
      setPlayerHands: applyCustomHands,
      getStateSnapshot: () => ({
        phase,
        turn,
        drawRound,
        betRound: betRoundIndex,
        dealerIdx,
        handId: handIdRef.current,
      }),
      getHandHistory: () => [...handHistoryRef.current],
      getLastPotSummary: () => lastPotSummaryRef.current,
    };
  }, [
    queueForcedSeatAction,
    forceSequentialFolds,
    forceAllInAction,
    resolveHandImmediately,
    startNextHand,
    applyCustomHands,
    phase,
    turn,
    drawRound,
    betRoundIndex,
    dealerIdx,
  ]);

  useEffect(() => installE2eTestDriver(e2eDriverApiRef), []);

  const heroFolded = players[0]?.folded ?? false;
  const foldButtonVisible = phase === "BET" && turn === 0 && !heroFolded;

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
    const structure =
      TOURNAMENT_STRUCTURE[blindLevelIndex] ??
      TOURNAMENT_STRUCTURE[lastStructureIndex];
    const sbValue = structure.sb;
    const bbValue = structure.bb;
    const anteValue = structure.ante ?? 0;

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
    if (newPlayers[0]) {
      newPlayers[0] = {
        ...newPlayers[0],
        name: heroProfile.name,
        titleBadge: heroProfile.titleBadge,
        avatar: heroProfile.avatar,
      };
    }

    if (anteValue > 0) {
      newPlayers.forEach((pl) => {
        if (pl.stack <= 0) return;
        const antePay = Math.min(pl.stack, anteValue);
        pl.stack -= antePay;
        pl.betThisRound += antePay;
        if (pl.stack === 0) {
          pl.allIn = true;
          pl.hasActedThisRound = true;
        }
      });
    }

    const sbPay = Math.min(newPlayers[0].stack, sbValue);
    newPlayers[0].stack -= sbPay;
    newPlayers[0].betThisRound += sbPay;
    if (newPlayers[0].stack === 0) {
      newPlayers[0].allIn = true;
      newPlayers[0].hasActedThisRound = true;
    }
    const bbPay = Math.min(newPlayers[1].stack, bbValue);
    newPlayers[1].stack -= bbPay;
    newPlayers[1].betThisRound += bbPay;
    if (newPlayers[1].stack === 0) {
      newPlayers[1].allIn = true;
      newPlayers[1].hasActedThisRound = true;
    }

    setPlayers(newPlayers);
    handStartStacksRef.current = newPlayers.map((p) => p.stack);
    setPots([]);
    setCurrentBet(Math.max(sbPay, bbPay));
    setLastAggressor(1);
    setDealerIdx(nextDealerIdx);
    setDrawRoundValue(0);
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

  useEffect(() => {
    setPlayers((prev) => applyHeroProfile(prev, heroProfile));
  }, [heroProfile]);


  function ensureLastActionLabelsForSnapshot(snapshotPlayers = []) {
    const base = Array.isArray(snapshotPlayers) ? snapshotPlayers : [];
    return base.map((player, idx) => {
      if (!player) return player;
      if (typeof player.lastAction === "string" && player.lastAction.trim().length > 0) {
        return player;
      }
      const previous = players[idx];
      if (previous?.lastAction) {
        return { ...player, lastAction: previous.lastAction };
      }
      if (player.folded) {
        return { ...player, lastAction: "Fold" };
      }
      return player;
    });
  }

  /* --- common: after BET action (snapshot-based) --- */
  function afterBetActionWithSnapshot(snap, actedIndex) {
    snap = Array.isArray(snap) ? snap.map(clonePlayerState).filter(Boolean) : [];
    snap = ensureLastActionLabelsForSnapshot(snap);
    if (snap[turn]?.allIn) {
      setHasActedFlag(snap, turn);
      console.log(`[SKIP] Player ${snap[turn].name} is all-in -> skip action`);
      const nxt = nextAliveFrom(snap, turn);
      if (nxt !== null) setTurn(nxt);
      return;
    }

    trace("afterBetActionWithSnapshot()", { phase, drawRound, actedIndex });
    if (transitioning) {
      const interimBet = maxBetThisRound(snap);
      syncEngineSnapshot({
        players: snap,
        pots,
        metadata: {
          currentBet: interimBet,
          betHead,
          lastAggressor,
          actingPlayerIndex: turn,
        },
      });
      return;
    }

    for (let i = 0; i < snap.length; i++) {
      const p = snap[i];
      if (!p.folded && p.stack <= 0 && !p.allIn) {
        console.warn(`[AUTO-FIX] ${p.name} stack=${p.stack} -> allIn=true`);
        snap[i] = { ...p, stack: 0, allIn: true };
      }
    }

    const actedPlayer = snap[actedIndex];
    let forcedNextTurn = null;
    if (!actedPlayer?.folded && !ensureSeatCanAct(actedIndex, "afterBetAction")) {
      return;
    }
    if (actedPlayer?.folded) {
      if (!actedPlayer.hasFolded) {
        snap[actedIndex] = { ...actedPlayer, hasFolded: true };
      }
      shiftAggressorsAfterFold(snap, actedIndex);

      console.debug("[FOLD] actedIndex folded, looking for next alive after", actedIndex);
      const nextAfterFold = nextAliveFrom(snap, actedIndex);
      forcedNextTurn = nextAfterFold;
      if (nextAfterFold !== null) {
        console.debug("[FOLD] pending next turn after fold:", nextAfterFold);
      } else {
        console.debug("[FOLD] no alive players after fold; defer to finish logic");
      }
      logE2EEvent("FOLD", {
        seat: actedIndex,
        stackAfter: snap[actedIndex]?.stack,
        hasFolded: true,
      });
      if (nextAfterFold === null) {
        debugLog("[FOLD] nextAfterFold is null -> scheduling finish immediately");
        scheduleFinish();
        return;
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

    const maxNow = maxBetThisRound(snap);
    if (currentBet !== maxNow) setCurrentBet(maxNow);

    const computedNext = nextAliveFrom(snap, actedIndex);
    const nextAlive =
      typeof forcedNextTurn === "number" ? forcedNextTurn : computedNext;

    syncEngineSnapshot({
      players: snap,
      pots,
      metadata: {
        currentBet: maxNow,
        betHead,
        lastAggressor,
        actingPlayerIndex:
          typeof nextAlive === "number" ? nextAlive : actedIndex,
      },
    });

    if (checkIfOneLeftThenEnd(snap)) return;

    function scheduleFinish() {
      if (transitioningRef.current) {
        debugLog("[FLOW] scheduleFinish skipped (already transitioning)");
        return;
      }
      setTransitioning(true);
      transitioningRef.current = true;
      setTimeout(() => {
        const handled = handleEngineRoundTransition(drawRound, dealerIdx);
        if (!handled) {
          finishBetRoundFrom({
            players: snap,
            pots,
            setPlayers,
            setPots,
            drawRound,
            setDrawRound: setDrawRoundValue,
            setPhase,
            setTurn,
            dealerIdx,
            NUM_PLAYERS,
            MAX_DRAWS,
            runShowdown,
            dealNewHand,
            setShowNextButton,
            setBetHead,
          });
        }
        setTransitioning(false);
        transitioningRef.current = false;
      }, 100);
    }
    
    // ------------------------
    // ------------------------
    if (phase === "BET") {
      const active = snap.filter((p) => !isFoldedOrOut(p));
      const everyoneMatched = active.every(
        (p) => p.allIn || p.betThisRound === maxNow
      );
      const noOneBet = maxNow === 0;
      const nextAlive = typeof forcedNextTurn === "number" ? forcedNextTurn : computedNext;

      debugLog(
        `[BET] Check status: everyoneMatched=${everyoneMatched}, next=${nextAlive}, betHead=${betHead}`
      );

      const bbIndex = (dealerIdx + 2) % NUM_PLAYERS;
      let isBBActed = true;

      if (drawRound === 0) {
        const bb = snap[bbIndex];
        if (bb) {
          const acted = ["Bet", "Call", "Raise", "Check"].includes(bb.lastAction);
          isBBActed = isFoldedOrOut(bb) || bb.allIn || acted;
        }
      }
 
      const allChecked = (maxNow === 0) && active.every((p) => isFoldedOrOut(p) || p.allIn || p.lastAction === "Check");
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

        scheduleFinish();
        return;
      }
    if (nextAlive === null) {
      debugLog("[BET] No next alive player, forcing finish");
      scheduleFinish();
      return;
    }
    setTurn(nextAlive);
    return;
  }

    // ------------------------
    // ------------------------
    if (phase === "DRAW") {
      const nextIdx = firstUndrawnFromSB(snap);
      console.log("[TRACE][DRAW] acted=", actedIndex, 
            "nextIdx=", nextIdx, typeof nextIdx, 
            "drawRound=", drawRound);

      const actives = snap.filter((p) => !isFoldedOrOut(p));
      const allActiveDrawn = actives.every((p) => p.hasDrawn);

      if (allActiveDrawn) {
        finishDrawRound(playersRef.current ?? snap);
        return;
      }

      if (nextIdx === -1) {
        finishDrawRound(playersRef.current ?? snap);
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

  function finishDrawRound(snapOpt) {
    const snap = Array.isArray(snapOpt)
      ? [...snapOpt]
      : [...(playersRef.current ?? players)];
    const startSeat = (dealerIdx + 1) % NUM_PLAYERS;
    debugLog("[DRAW] -> finishDrawRound", { drawRound, startSeat, snap });

    // folded flags are left untouched here; folded players remain out until a new hand.

    setPhase("BET");
    const currentDraw = Math.max(0, Math.min(Number(drawRoundTracker.current) || 0, MAX_DRAWS));
    setBetRoundValue(currentDraw);
    setLastAggressor(null);
    const nextTurn = firstUndrawnFromSB(snap);
    const resolvedTurn = nextTurn !== -1 ? nextTurn : startSeat;
    setTurn(resolvedTurn);
    setBetHead(startSeat);
  }

  /* --- actions: BET --- */
  function syncEngineSnapshot(snapshot, baseOverride = null) {
    if (!snapshot) return;
    const baseState =
      baseOverride ??
      {
        players,
        pots,
        metadata: {
          currentBet,
          betHead,
          lastAggressor,
          actingPlayerIndex: turn,
        },
        currentBet,
        betHead,
        lastAggressor,
        turn,
        deck,
        gameId: stageGameId,
        engineId: stageGameId,
      };
    const merged = mergeEngineSnapshot(baseState, snapshot);

    const normalizedPlayers = ensureLastActionLabelsForSnapshot(merged.players);
    setPlayers(normalizedPlayers);
    setPots(merged.pots);
    setCurrentBet(merged.metadata.currentBet);
    setBetHead(merged.metadata.betHead);
    setLastAggressor(merged.metadata.lastAggressor);
    setTurn(merged.metadata.actingPlayerIndex);
    setDeck(merged.deck);
    const normalizedSnapshot = {
      ...snapshot,
      players: normalizedPlayers,
      pots: merged.pots,
      deck: merged.deck,
      metadata: merged.metadata,
      gameId: merged.gameId ?? stageGameId,
      engineId: merged.engineId ?? stageGameId,
    };
    engineStateRef.current = normalizedSnapshot;
    setEngineState(normalizedSnapshot);
  }

  function recordInteractionPerformance(label) {
    if (!performanceSupported || !interactionStartRef.current) return;
    const duration = Math.round(performance.now() - interactionStartRef.current.startedAt);
    interactionStartRef.current = null;
    setUiPerf((prev) => ({
      ...prev,
      lastInteractionDuration: duration,
      lastInteractionLabel: label,
    }));
  }

  function handleHeroAction(type, metadata = {}) {
    if (!engine) return;
    const interactionLabel = metadata?.label ?? type ?? "action";
    if (performanceSupported) {
      interactionStartRef.current = { label: interactionLabel, startedAt: performance.now() };
    }
    const baseState = engineStateRef.current ?? {
      players,
      pots,
      metadata: { currentBet },
    };
    const prePlayers = playersRef.current ?? players;
    const beforeSnap = prePlayers.map(clonePlayerState).filter(Boolean);
    const heroBefore = beforeSnap[0] ? { ...beforeSnap[0] } : null;
    const nextState = engine.applyPlayerAction(baseState, {
      seatIndex: 0,
      type,
      metadata,
    });
    if (nextState) {
      syncEngineSnapshot(nextState);
      const postPlayers = playersRef.current ?? players;
      const heroAfter = postPlayers[0] ? { ...postPlayers[0] } : null;
      recordActionToLog({
        phase: phase,
        round: currentBetRoundIndex(),
        seat: 0,
        playerState: heroAfter,
        type,
        stackBefore: heroBefore?.stack,
        stackAfter: heroAfter?.stack,
        betBefore: heroBefore?.betThisRound,
        betAfter: heroAfter?.betThisRound,
        metadata,
      });
      saveRLHandHistory(nextState);
      recordInteractionPerformance(interactionLabel);
    }
  }

  function playerFold() {
    if (phase !== "BET") return;

    const basePlayers = playersRef.current ?? players;
    if (!ensureSeatCanAct(0, "playerFold")) return;
    const snap = basePlayers.map(clonePlayerState).filter(Boolean);
    const me = snap[0];
    if (me.folded || isFoldedOrOut(me)) return;

    const stackBefore = me.stack;
    const betBefore = me.betThisRound;

    me.folded = true;
    me.hasFolded = true;
    me.lastAction = "Fold";
    me.hasActedThisRound = true;

    snap[0] = me;

    recordActionToLog({
      phase: "BET",
      round: currentBetRoundIndex(),
      seat: 0,
      playerState: me,
      type: "Fold",
      stackBefore,
      stackAfter: me.stack,
      betBefore,
      betAfter: me.betThisRound,
      raiseCountTable: raiseCountThisRound,
    });

    setPlayerSnapshot(snap);

    afterBetActionWithSnapshot(snap, 0);
  }

  function getEngineBaseState() {
    if (engineStateRef.current) {
      return engineStateRef.current;
    }
    const fallbackGameId = stageGameId;
    return {
      players,
      pots,
      metadata: {
        currentBet,
        betHead,
        lastAggressor,
        actingPlayerIndex: turn,
      },
      deck,
      gameId: fallbackGameId,
      engineId: fallbackGameId,
    };
  }

  function onHandFinished() {
    debugLog("[HAND] onHandFinished triggered");
  }

  function handleShowdownResult(updatedPlayers, totalPot, summary) {
    const result = buildHandResultSummary({
      players: updatedPlayers,
      summary,
      totalPot,
    });
    setHandResultSummary(result);
    setHandResultVisible(true);
    setShowNextButton(false);
    const finalizedRecord = finalizeHandHistoryRecord({
      players: updatedPlayers,
      pots: summary,
      uiSummary: result,
      endedAt: Date.now(),
    });
    if (finalizedRecord) {
      const snapshot = JSON.parse(JSON.stringify(finalizedRecord));
      handHistoryRef.current = [...handHistoryRef.current, snapshot];
      console.log("[HAND_HISTORY]", JSON.stringify(snapshot));
      resetHandHistoryRecord();
      currentHandHistoryRef.current = null;
    }
    console.log(
      "[SHOWDOWN] DETAILS FULL ->",
      updatedPlayers.map((p, idx) => ({
        seat: idx,
        name: p.name,
        hand: Array.isArray(p.hand) ? p.hand.join(" ") : "",
        folded: p.folded,
        stack: p.stack,
      }))
    );
  }

  function handleEngineShowdown(drawRoundParam = drawRound) {
    if (!engine) return false;
    const baseState = getEngineBaseState();
    const outcome = engine.resolveShowdown(baseState, { cloneState: false });
    if (!outcome?.state) return false;
    syncEngineSnapshot({
      players: outcome.state.players,
      pots: outcome.state.pots,
      metadata: outcome.state.metadata,
      deck: outcome.state.deck ?? deck,
    });
    runShowdown({
      players: outcome.state.players,
      setPlayers,
      pots: outcome.state.pots,
      setPots,
      dealerIdx,
      dealNewHand,
      setShowNextButton,
      setPhase,
      setDrawRound: setDrawRoundValue,
      setTurn,
      setTransitioning,
      setCurrentBet,
      recordActionToLog,
      drawRound: drawRoundParam,
      onHandFinished,
      onShowdownComplete: handleShowdownResult,
      precomputedResult: {
        summary: outcome.summary ?? [],
        totalPot: outcome.totalPot ?? 0,
        players: outcome.state.players,
        pots: outcome.state.pots,
      },
      engineResolveShowdown: () => outcome,
    });
    return true;
  }

  function handleEngineRoundTransition(drawRoundValue, dealerIndexValue) {
    if (!engine) return false;
    const baseState = getEngineBaseState();
    const outcome = engine.advanceAfterBet(baseState, {
      drawRound: drawRoundValue,
      maxDraws: MAX_DRAWS,
      dealerIndex: dealerIndexValue,
      numPlayers: NUM_PLAYERS,
    });
    if (!outcome?.state) return false;
    const state = outcome.state;
    const mergedMetadata = {
      ...(state.metadata ?? outcome.metadata ?? baseState.metadata ?? {}),
    };
    if (!mergedMetadata.gameId) {
      mergedMetadata.gameId = stageGameId;
    }
    if (!mergedMetadata.engineId) {
      mergedMetadata.engineId = stageGameId;
    }
    syncEngineSnapshot({
      players: state.players,
      pots: state.pots,
      metadata: mergedMetadata,
      deck: state.deck ?? deck,
    });

    if (outcome.showdown || outcome.street === "SHOWDOWN") {
      runShowdown({
        players: state.players,
        setPlayers,
        pots: state.pots,
        setPots,
        dealerIdx: dealerIndexValue,
        dealNewHand,
        setShowNextButton,
        setPhase,
        setDrawRound: setDrawRoundValue,
        setTurn,
        setTransitioning,
        setCurrentBet,
        recordActionToLog,
        drawRound: drawRoundValue,
        onHandFinished,
        onShowdownComplete: handleShowdownResult,
        precomputedResult: {
          summary: outcome.showdownSummary ?? [],
          totalPot: outcome.showdownTotal ?? 0,
          players: state.players,
          pots: state.pots,
        },
        engineResolveShowdown: () => outcome,
      });
      return true;
    }

    if (outcome.street === "DRAW") {
      const prevDraw = Number.isFinite(drawRoundTracker.current)
        ? drawRoundTracker.current
        : Number.isFinite(drawRoundValue)
        ? drawRoundValue
        : 0;
      const candidate =
        Number.isFinite(outcome.drawRoundIndex) && outcome.drawRoundIndex != null
          ? outcome.drawRoundIndex
          : prevDraw + 1;
      const normalizedDraw = Math.min(Math.max(candidate, 0), MAX_DRAWS);
      setDrawRoundValue(normalizedDraw);
      setBetRoundValue(normalizedDraw);
      setPhase("DRAW");
      const nextActing =
        outcome.actingPlayerIndex ??
        calcDrawStartIndex(dealerIndexValue, normalizedDraw, NUM_PLAYERS);
      setTurn(nextActing);
      return true;
    }

    return false;
  }

  function playerCall() {
    if (phase !== "BET") return;
    if (!ensureSeatCanAct(0, "playerCall")) return;
    const basePlayers = playersRef.current ?? players;
    const snap = basePlayers.map(clonePlayerState).filter(Boolean);
    const me = snap[0] ? { ...snap[0] } : null;
    if (!me) return;
    if (me.stack <= 0) {
      console.warn("[BLOCK] Player has no stack -> cannot act");
      return;
    }

    const stackBefore = me.stack;
    const betBefore = me.betThisRound;

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

  function playerCheck() {
    if (phase !== "BET") return;
    if (!ensureSeatCanAct(0, "playerCheck")) return;
    const basePlayers = playersRef.current ?? players;
    const snap = basePlayers.map(clonePlayerState).filter(Boolean);
    const me = snap[0] ? { ...snap[0] } : null;
    if (!me) return;
    const maxNow = maxBetThisRound(snap);
    if (!ensureSeatCanAct(0, "playerCheck")) return;
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
     if (!ensureSeatCanAct(0, "playerRaise")) return;
     const basePlayers = playersRef.current ?? players;
     const snap = basePlayers.map(clonePlayerState).filter(Boolean);
     const me = snap[0] ? { ...snap[0] } : null;
     if (!me) return;
     const stackBefore = me.stack;
     const betBefore = me.betThisRound;

    if (!ensureSeatCanAct(0, "playerRaise")) return;
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

    afterBetActionWithSnapshot(snap, 0);

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
    const currentPlayers = playersRef.current ?? players;
    const player = currentPlayers?.[0];
    if (!player || isFoldedOrOut(player)) {
      logE2EError("Hero draw attempted while folded", {
        seat: 0,
        context: "drawSelected",
      });
      return;
    }
    if (!ensureSeatCanAct(0, "playerDraw")) return;

    const deckManager = deckRef.current;
    const basePlayers = playersRef.current ?? players;
    const newPlayers = basePlayers.map(clonePlayerState).filter(Boolean);
    const p = newPlayers[0]
      ? { ...newPlayers[0], hand: Array.isArray(newPlayers[0].hand) ? [...newPlayers[0].hand] : [] }
      : null;
    if (!p) return;

    const sel = p.selected || [];
    const stackBefore = p.stack;
    const betBefore = p.betThisRound;

    if (sel.length > 0) {
      const beforeHand = [...p.hand];
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
            replacedCards: replaced.map((entry) => ({ ...entry })),
            before: beforeHand,
            after: [...p.hand],
          },
        },
      });
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

    const committedSnapshot = newPlayers.map(clonePlayerState).filter(Boolean);
    setDeck([]);
    setPlayerSnapshot(committedSnapshot);
    syncEngineSnapshot({
      players: committedSnapshot,
      pots,
      metadata: {
        currentBet,
        betHead,
        lastAggressor,
        actingPlayerIndex: firstUndrawnFromSB(committedSnapshot) ?? 0,
      },
      deck: deckRef.current.deck,
    });
    setTimeout(
      () => afterBetActionWithSnapshot(committedSnapshot.map(clonePlayerState).filter(Boolean), 0),
      0
    );
  }

  /* --- NPC auto --- */
  useEffect(() => {
    if (!players || players.length === 0) return;
    const seatCount = players.length;

    if (
      typeof turn !== "number" ||
      Number.isNaN(turn) ||
      turn < 0 ||
      turn >= seatCount
    ) {
      if (phase === "DRAW") {
        const drawFallback = firstUndrawnFromSB(players);
        if (drawFallback === -1) {
          finishDrawRound(players);
        } else {
          setTurn(drawFallback);
        }
      } else {
        const nextBetSeat = firstBetterAfterBlinds(players, dealerIdx);
        setTurn(nextBetSeat);
      }
      return;
    }

    if (phase === "BET" && forcedSeatActionsRef.current.size > 0) {
      const entries = Array.from(forcedSeatActionsRef.current.entries());
      for (const [seat, payload] of entries) {
        if (applyForcedBetAction(seat, payload)) {
          return;
        }
      }
    }
    if (turn === 0) return;

    const p = players[turn];
    if (!p || isFoldedOrOut(p)) {
      logE2ESkip(turn, "folded_or_out");
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
      const basePlayers = playersRef.current ?? players;
      const snap = basePlayers.map(clonePlayerState).filter(Boolean);
      const activeSeat = turn;
      if (!ensureSeatCanAct(activeSeat, "npcBetAction")) {
        const nxt = nextAliveFrom(snap, turn);
        if (nxt !== null) setTurn(nxt);
        return;
      }
      const me = snap[turn] ? { ...snap[turn] } : null;
      if (!me) return;
      const stackBefore = me.stack;
      const betBefore = me.betThisRound;
      const maxNow = maxBetThisRound(snap);
      const toCall = Math.max(0, maxNow - me.betThisRound);
      const evalResult = evaluateBadugi(me.hand);
      const madeCards = evalResult.ranks.length;
      const r = Math.random();

      if (toCall > 0 && r < 0.15 && madeCards < 3) {
        me.folded = true;
        me.hasFolded = true;
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
      if (me.folded) {
        shiftAggressorsAfterFold(snap, turn);
      }
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
    const basePlayers = playersRef.current ?? players;
    const snap = basePlayers.map(clonePlayerState).filter(Boolean);

    const actives = snap.filter((p) => !isFoldedOrOut(p));
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
        setTimeout(() => { finishDrawRound(playersRef.current ?? snap); setTransitioning(false); }, 50);
      }
      return;
    }

    if (turn !== nextToDraw) {
      setTurn(nextToDraw);
      return;
    }

    const me = snap[nextToDraw] ? { ...snap[nextToDraw], hand: Array.isArray(snap[nextToDraw].hand) ? [...snap[nextToDraw].hand] : [] } : null;
    if (!me) return;
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

    console.log(
      `[DRAW] player=${nextToDraw} draw=${drawCount} replaced`,
      replacedCards
    );

    setDeck([]);
    setPlayerSnapshot(snap);
    syncEngineSnapshot({
      players: snap,
      pots,
      metadata: {
        currentBet,
        betHead,
        lastAggressor,
        actingPlayerIndex: firstUndrawnFromSB(snap) ?? nextToDraw,
      },
      deck: deckRef.current.deck,
    });
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
            replacedCards: replacedCards.map((entry) => ({ ...entry })),
            before: [...oldHand],
            after: [...me.hand],
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
            finishDrawRound(playersRef.current ?? snap);
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
    applyForcedBetAction,
  ]);

  useEffect(() => {
    if (phase !== "BET") return;
    const pending = forcedSeatActionsRef.current.get(turn);
    if (pending) {
      applyForcedBetAction(turn, pending);
    }
  }, [phase, turn, applyForcedBetAction]);


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

      const active = (playersSnap || []).filter((p) => !isFoldedOrOut(p));
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
          const active = playersSnap.filter((p) => !isFoldedOrOut(p));
          if (active.length === 0) return [];
          let best = active[0];
          for (const p of active) {
            if (compareBadugi(p.hand, best.hand) < 0) best = p;
          }
          return active
            .filter((p) => compareBadugi(p.hand, best.hand) === 0)
            .map((p) => p.name);
        })(),
        winner: (() => {
          const w = (() => {
            const active = playersSnap.filter((p) => !isFoldedOrOut(p));
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
      const heroOutcome = deriveHeroOutcome(record);
      const ratingMode = phase?.includes("TOURNAMENT") ? "tournament" : "ring";
      const stageId = phase?.includes("TOURNAMENT")
        ? `stage-${currentStructure?.level ?? blindLevelIndex + 1}`
        : "ring";
      const preGlobal = ratingState.globalRating ?? 1500;
      const ratingAfter = applyMatchRatings({
        result: heroOutcome?.value ?? 0,
        opponentRating: ratingState.skillRating,
        mixedResult: heroOutcome?.value ?? 0,
        mode: ratingMode,
        stageId,
        metadata: {
          tableSize: record.tableSize,
          blindLevel: blindLevelIndex,
        },
      });
      const ratingDelta = (ratingAfter.globalRating ?? preGlobal) - preGlobal;
      recordHeroTracker(record, heroOutcome, ratingAfter, ratingDelta);
      handSavedRef.current = true;
      // console.debug("Hand saved:", record);
    } catch (e) {
      // console.error("save hand failed", e);
    }
  }

  /* --- UI --- */
  const heroTrackerTotal = heroTracker.wins + heroTracker.losses + heroTracker.draws;
  const heroWinRate = heroTrackerTotal
    ? Math.round(((heroTracker.wins + heroTracker.draws * 0.5) / heroTrackerTotal) * 100)
    : 0;
  const centerX = typeof window !== "undefined" ? window.innerWidth / 2 : 400;
  const centerY = typeof window !== "undefined" ? window.innerHeight / 2 : 300;
  const radiusX = 350;
  const radiusY = 220;

  const seatLayouts = [
    "lg:absolute lg:bottom-[6%] lg:left-1/2 lg:-translate-x-1/2 lg:w-[320px]", // Hero (BTN)
    "lg:absolute lg:bottom-[18%] lg:left-[12%] lg:w-[300px]", // SB
    "lg:absolute lg:top-[8%] lg:left-[12%] lg:w-[300px]", // BB
    "lg:absolute lg:top-[2%] lg:left-1/2 lg:-translate-x-1/2 lg:w-[300px]", // UTG
    "lg:absolute lg:top-[8%] lg:right-[12%] lg:w-[300px]", // MP
    "lg:absolute lg:bottom-[18%] lg:right-[12%] lg:w-[300px]", // CO
  ];

  const isDrawPhase = phase === "DRAW";
  const tableOuterBg = isDrawPhase ? "bg-red-900" : "bg-green-800";
  const tableSurfaceBg = isDrawPhase ? "bg-red-800" : "bg-green-700";
  const tableBorderColor = isDrawPhase ? "border-red-400" : "border-yellow-600";

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


  const tableSummaryProps = {
    phaseTag: phaseTagLocal(),
    drawRound,
    maxDraws: MAX_DRAWS,
    betRoundIndex,
    levelNumber: currentStructure.level ?? blindLevelIndex + 1,
    sbValue: SB,
    bbValue: BB,
    anteValue: currentAnte,
    handCount: handsInLevelDisplay,
    handsCap: handsCapDisplay,
    startingStack,
    showRaiseCount: phase === "BET",
    raiseCount: raiseCountThisRound,
    dealerName: players[dealerIdx]?.name ?? "-",
  };

  const loadWarning = uiPerf.loadTime != null && uiPerf.loadTime > 3000;
  const interactionWarning =
    uiPerf.lastInteractionDuration != null && uiPerf.lastInteractionDuration > 100;
  const notificationVariant = loadWarning || interactionWarning
    ? "warning"
    : uiPerf.loadTime == null
      ? "info"
      : "success";
  const loadStatus = uiPerf.loadTime == null ? "measuring..." : `${uiPerf.loadTime}ms`;
  const interactionStatus = uiPerf.lastInteractionDuration == null
    ? "waiting..."
    : `${uiPerf.lastInteractionDuration}ms${uiPerf.lastInteractionLabel ? ` (${uiPerf.lastInteractionLabel})` : ""}`;
  const notificationMessage = formatComment(
    "uiPerfNotification",
    { load: loadStatus, interaction: interactionStatus },
    locale
  );
  const nextHandLabel = formatComment("nextHandButton", {}, locale);

  return (
  <div className="flex flex-col h-screen bg-gray-900 text-white">
    {/* -------- Header -------- */}
    <header className="flex flex-col gap-3 px-6 py-3 bg-gray-800 shadow-md fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between gap-6">
        <h1 className="text-2xl font-bold text-white">Badugi App</h1>
        <div className="flex items-center gap-4 text-xs text-slate-200">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Global Rating</p>
            <strong className="text-lg text-white">
              {Math.round(ratingState.globalRating ?? 1500)}
            </strong>
          </div>
          <div className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold uppercase tracking-wider">
            {rankInfo.label}
          </div>
          <div className="text-[11px] text-slate-300">
            Skill {Math.round(ratingState.skillRating ?? 1500)} | Mixed {Math.round(ratingState.mixedRating ?? 1500)}
          </div>
          <button
            onClick={() => navigate("/leaderboard")}
            className="px-3 py-1 rounded-full border border-white/30 text-[11px] font-semibold uppercase tracking-wide hover:border-emerald-300 transition"
          >
            Leaderboard
          </button>
        </div>
      </div>
      <nav className="flex gap-4">
        <button
          onClick={() => navigate("/")}
          className="hover:text-yellow-400 transition text-[13px]"
        >
          Title
        </button>
        <button
          onClick={() => navigate("/settings")}
          className="hover:text-yellow-400 transition text-[13px]"
        >
          Settings
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="hover:text-yellow-400 transition text-[13px]"
        >
          Profile
        </button>
        <button
          onClick={() => navigate("/history")}
          className="hover:text-yellow-400 transition text-[13px]"
        >
          History
        </button>
      </nav>
    </header>

    {/* -------- Main Table Area -------- */}
    <main className={`flex-1 mt-20 relative flex items-center justify-center overflow-auto ${tableOuterBg}`}>
      <div className="absolute top-6 left-6 z-40 flex flex-col gap-4 w-[280px] pointer-events-none">
        <div className="pointer-events-auto bg-black/70 text-white text-xs rounded-lg p-3 shadow-lg space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Table Status</span>
            <button
              type="button"
              onClick={() => setStatusBoardOpen((v) => !v)}
              className="text-[11px] font-semibold text-yellow-300 hover:text-yellow-200 transition"
            >
              {statusBoardOpen ? "Hide" : "Show"}
            </button>
          </div>
          {statusBoardOpen && (
            <div className="overflow-hidden rounded-xl shadow-inner border border-yellow-500/30">
              <PlayerStatusBoard
                players={players}
                dealerIdx={dealerIdx}
                heroIndex={0}
                turn={turn}
                totalPot={totalPotForDisplay}
                positionLabels={seatLabels}
              />
            </div>
          )}
        </div>

        <Notification
          variant={notificationVariant}
          message={notificationMessage}
        />
        <div className="pointer-events-auto bg-black/70 text-white text-xs rounded-lg p-3 shadow-lg">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Seat Manager</span>
            <button
              type="button"
              onClick={() => setSeatManagerOpen(true)}
              className="text-[11px] font-semibold text-yellow-300 hover:text-yellow-200 transition"
            >
              Open
            </button>
          </div>
        </div>
        <Modal title="Seat Manager" open={seatManagerOpen} onClose={() => setSeatManagerOpen(false)}>
          <label className="flex items-center space-x-1 text-[11px] font-normal">
            <input
              type="checkbox"
              className="accent-yellow-400"
              checked={autoRotateSeats}
              onChange={(e) => setAutoRotateSeats(e.target.checked)}
            />
            <span>Auto rotate</span>
          </label>
          <p className="text-[11px] text-gray-300 leading-snug">
            Seat / stack changes apply to the next hand. Use the reset button to redeal immediately when testing layouts.
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
            {seatConfig.map((type, idx) => (
              <label key={`seat-config-${idx}`} className="flex flex-col space-y-1">
                <span className="text-[11px] font-semibold">
                  Seat {idx + 1}
                  {idx === 0 ? " (You)" : ""}
                </span>
                <select
                  value={type}
                  disabled={idx === 0}
                  onChange={(event) => handleSeatTypeChange(idx, event.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:opacity-50"
                >
                  {seatTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="flex flex-col space-y-1">
            <span className="text-[11px] font-semibold">Starting stack</span>
            <input
              type="number"
              min="0"
              step="25"
              value={startingStack}
              onChange={(event) => handleStartingStackChange(event.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => rotateSeatConfigOnce(1)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold"
            >
              Rotate once
            </button>
            <button
              type="button"
              onClick={resetSeatConfigToDefault}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold"
            >
              Default seats
            </button>
            <button
              type="button"
              onClick={() => dealNewHand(0)}
              className="px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-black rounded text-xs font-semibold"
            >
              Reset & Redeal
            </button>
          </div>
        </Modal>

        <div className="pointer-events-auto bg-black/70 text-white text-xs rounded-lg p-3 shadow-lg space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Hero Tracker</span>
            <span className="text-[11px] text-slate-400">
              {heroTracker.lastOutcome ?? "-"}
              {heroTracker.streak
                ? ` - ${heroTracker.streak > 0 ? "+" : ""}${heroTracker.streak}`
                : ""}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Wins</p>
              <strong className="text-emerald-400 text-base">{heroTracker.wins}</strong>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Draws</p>
              <strong className="text-yellow-300 text-base">{heroTracker.draws}</strong>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Losses</p>
              <strong className="text-red-400 text-base">{heroTracker.losses}</strong>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Win rate: {heroTrackerTotal ? `${heroWinRate}%` : "-"}
          </div>
          {heroTracker.history.length ? (
            <div className="space-y-1">
              {heroTracker.history.map((entry) => (
                <div
                  key={entry.id ?? entry.ts}
                  className="flex items-center justify-between text-[11px] text-slate-200"
                >
                  <span>{entry.outcome}</span>
                  <span>Pot {entry.pot}</span>
                  <span className="text-[10px] text-emerald-300">
                    {entry.ratingDelta >= 0 ? `+${entry.ratingDelta}` : entry.ratingDelta}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">No hero history yet</p>
          )}
        </div>

        <div className="pointer-events-auto bg-black/70 text-white text-xs rounded-lg p-3 shadow-lg space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Developer Panel</span>
            <span className="text-[11px] text-slate-400">AI / P2P</span>
          </div>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.35em] text-slate-400">
            Tier Override
            <select
              value={devTierOverride ?? ""}
              onChange={handleTierOverrideChange}
              className="rounded-full bg-slate-900/70 border border-white/20 px-2 py-1 text-[12px]"
            >
              <option value="">Auto (game decides)</option>
              {tierOptions.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <button
              type="button"
              onClick={clearTierOverride}
              className="flex-1 rounded-full border border-red-400/60 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/10 transition"
            >
              Clear Override
            </button>
            <button
              type="button"
              onClick={toggleP2pCapture}
              className={`flex-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                p2pCaptureEnabled
                  ? "bg-emerald-500 text-slate-900"
                  : "border border-white/20 text-white"
              }`}
            >
              P2P Capture {p2pCaptureEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportP2pMatches}
            className="w-full rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold hover:bg-white/10 transition"
          >
            Export P2P JSONL
          </button>
        </div>
      </div>

      {/* Core game surface */}
      <div className={`relative w-[92%] max-w-[1400px] aspect-[16/9] ${tableSurfaceBg} border-4 ${tableBorderColor} rounded-3xl shadow-inner transition-colors duration-300`}>

        {/* Phase summary: inline for mobile, fixed side for desktop */}
        <TableSummaryPanel
          {...tableSummaryProps}
          className="lg:hidden absolute top-4 right-4 text-right bg-black/70 rounded-lg px-3 py-2 shadow-lg"
        />
        <TableSummaryPanel
          {...tableSummaryProps}
          className="hidden lg:block fixed top-28 right-8 text-right bg-black/70 rounded-lg px-4 py-3 shadow-lg z-40 w-64"
        />

        {/* Player seats */}
        <div className="players-grid grid grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:block lg:px-0">
          {players.map((p, i) => {
            const seatLabel = positionName(i);
            const seatTestId = seatLabel === "SB" ? "seat-sb" : undefined;
            return (
              <div
                key={`seat-${i}`}
                className={`mb-4 lg:mb-0 ${seatLayouts[i] ?? ""}`}
                data-testid={seatTestId}
              >
                <Player
                  player={{
                    ...p,
                    name: `${p.name} (${seatLabel})`,
                  }}
                  index={i}
                  selfIndex={0}
                  phase={phase}
                  turn={turn}
                  dealerIdx={dealerIdx}
                  onCardClick={handleCardClick}
                  positionLabel={seatLabel}
                />
              </div>
            );
          })}
        </div>

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


      </div>
    </main>

    <HandResultOverlay
      visible={handResultVisible}
      summary={handResultSummary}
      onNext={startNextHand}
      buttonLabel={nextHandLabel}
    />

    <div className="w-full flex justify-center mt-6">
      <div className="w-[92%] max-w-[1400px] flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <button
            onClick={() => setDebugMode((v) => !v)}
            className={`px-4 py-2 rounded font-bold ${
              debugMode ? "bg-red-500" : "bg-gray-600"
            }`}
          >
            {debugMode ? "DEBUG ON" : "DEBUG OFF"}
          </button>
        </div>

        <div className="flex justify-end items-center gap-4 h-20">
          {turn === 0 && players[0] && !players[0].folded ? (
            phase === "BET" ? (
              <Controls
                phase="BET"
                currentBet={currentBet}
                player={players[0]}
                onFold={playerFold}
                onCall={playerCall}
                onCheck={playerCheck}
                onRaise={playerRaise}
              />
            ) : phase === "DRAW" ? (
              <Controls
                phase="DRAW"
                player={players[0]}
                onDraw={drawSelected}
              />
            ) : null
          ) : null}

          {showNextButton && !handResultVisible && (
            <button
              onClick={startNextHand}
              className="px-6 py-3 bg-yellow-500 text-black font-bold rounded shadow-lg"
            >
              {nextHandLabel}
            </button>
          )}
        </div>
      </div>

    </div>
  </div>
);
}








