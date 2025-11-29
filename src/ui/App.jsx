// src/ui/App.jsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Player from "./components/Player";
import Controls from "./components/Controls";
import PlayerStatusBoard from "./components/PlayerStatusBoard";
import Modal from "./components/Modal";
import Notification from "./components/Notification";
import TableSummaryPanel from "./components/TableSummaryPanel";
import HandResultOverlay from "./components/HandResultOverlay";
import { DEFAULT_SEAT_TYPES, DEFAULT_STARTING_STACK, TOURNAMENT_STRUCTURE } from "../tournament/tournamentStructure";
import { formatComment } from "./utils/commentCatalog.js";
import { debugLog } from "../utils/debugLog";
import GameRegistry from "../games/_core/GameRegistry";
import { DEBUG_TOURNAMENT, logMTT } from "../config/debugFlags.js";
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
  isFoldedOrOut,
  queueForcedSeatAction as queueForcedSeatActionMap,
  forceSequentialFolds as forceSequentialFoldsMap,
  forceAllInAction as forceAllInActionMap,
  firstBetterAfterBlinds,
  findNextActiveSeat,
} from "../games/badugi/flow/actionUtils.js";
import {
  settleStreetToPots,
  finishBetRoundFrom,
  resetBetRoundFlags,
} from "../games/badugi/engine/roundFlow.js";
import { analyzeBetSnapshot } from "../games/badugi/flow/betRoundUtils.js";
import BadugiGameController from "../games/badugi/BadugiGameController.js";
import NLHGameController from "../games/nlh/NLHGameController.js";
import {
  formatBadugiHandLabel,
  formatBadugiRanksLabel,
  buildHandResultSummary,
} from "../games/badugi/flow/handResultUtils.js";
import { getGameUIAdapter } from "./game/GameUIAdapterRegistry.js";
import { ensureBadugiUIAdapterRegistered } from "./game/badugi/registerBadugiUIAdapter.js";
import { ensureNLHUIAdapterRegistered } from "./game/nlh/registerNLHUIAdapter.js";
import {
  createVariantRotationController,
  advanceVariantRotation,
  getCurrentVariant,
  getNextVariant,
} from "./game/variantRotationController.js";
import {
  attachVariantLabelsToHud,
  buildTournamentHudPayload,
} from "./utils/tournamentHudUtils.js";

// History persistence helpers
import {
  saveRLHandHistory,
  getAllRLHandHistories,
  exportRLHistoryAsJSONL,
} from "../utils/history_rl";
import { useLocation, useNavigate } from "react-router-dom";
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
import {
  initTournamentReplay,
  appendTournamentReplayHand,
  finalizeTournamentReplay,
  getTournamentReplay as getStoredTournamentReplay,
  resetTournamentReplay,
} from "./utils/tournamentReplayStore.js";
import TournamentHUD from "./components/TournamentHUD.jsx";
import TournamentResultOverlay from "./components/TournamentResultOverlay.jsx";
import HeroBustOverlay from "./components/HeroBustOverlay.jsx";
import TitleScreen from "./screens/TitleScreen.jsx";
import MainMenuScreen from "./screens/MainMenuScreen.jsx";
import {
  createMTTTournamentState,
  onTableHandCompleted,
  getCurrentLevel,
  simulateBackgroundTables,
  computePayouts,
} from "../games/badugi/engine/tournamentMTT.js";
import {
  MGX_LOCALES,
  MGX_DEFAULT_LOCALE,
  LANGUAGE_STORAGE_KEY,
} from "../config/mgxLocaleConfig.js";
import { getFixedLimitBetSize } from "../games/badugi/logic/bettingRules.js";

const DEFAULT_GAME_ID = "D03";
const DEFAULT_GAME_VARIANT = "badugi";
const HERO_TOURNAMENT_PLAYER_ID = "hero-player";
const DEFAULT_STORE_TOURNAMENT_CONFIG = {
  id: "store-mtt",
  name: "Store Tournament",
  tables: 3,
  seatsPerTable: 6,
  startingStack: 500,
  gameVariant: "badugi",
  gameRotation: ["badugi"],
  rotationPolicy: "fixed",
  levels: [
    { levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 5 },
    { levelIndex: 2, smallBlind: 10, bigBlind: 20, ante: 1, handsThisLevel: 5 },
    { levelIndex: 3, smallBlind: 20, bigBlind: 40, ante: 2, handsThisLevel: 999 },
  ],
  payouts: [
    { place: 1, percent: 50 },
    { place: 2, percent: 30 },
    { place: 3, percent: 20 },
  ],
};

function getRequestedVariantIdFromURL() {
  if (typeof window === "undefined") return DEFAULT_GAME_VARIANT;
  try {
    const params = new URLSearchParams(window.location.search);
    const variant = params.get("variant");
    if (variant && ["nlh", "badugi"].includes(variant.toLowerCase())) {
      return variant.toLowerCase();
    }
  } catch (err) {
    console.warn("variant detection failed", err);
  }
  return DEFAULT_GAME_VARIANT;
}

function getRequestedModeFromURL() {
  if (typeof window === "undefined") return "cash";
  try {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    if (modeParam === "store_tournament" || modeParam === "tournament-mtt") {
      return "tournament-mtt";
    }
  } catch (err) {
    console.warn("mode detection failed", err);
  }
  return "cash";
}


const TOURNAMENT_CLOCK_PLACEHOLDER = "--:--";
const LEGACY_LANGUAGE_STORAGE_KEY = "mgx.language";
function getInitialLanguage() {
  if (typeof window === "undefined") return MGX_DEFAULT_LOCALE;

  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && MGX_LOCALES[saved]) {
      return saved;
    }

    const legacy = window.localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
    if (legacy && MGX_LOCALES[legacy]) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
      return legacy;
    }
  } catch (err) {
    console.warn("language detection failed", err);
  }

  return MGX_DEFAULT_LOCALE;
}

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
  const initialModeRef = useRef(getRequestedModeFromURL());
  const [mode, setMode] = useState(initialModeRef.current);
  const [language, setLanguage] = useState(() => getInitialLanguage());
  // MGX branding: kitsune title screen + title → menu → game flow (2025-11-28)
  const [currentScreen, setCurrentScreen] = useState("title");
  const isTournament = mode === "tournament-mtt";
  const initialVariantIdRef = useRef(getRequestedVariantIdFromURL());
  const [gameVariant, setGameVariant] = useState(() => initialVariantIdRef.current);
  const variantRotationRef = useRef(
    createVariantRotationController({
      rotation: [initialVariantIdRef.current],
      policy: "fixed",
      defaultVariant: DEFAULT_GAME_VARIANT,
    }),
  );
  const gameVariantRef = useRef(gameVariant);
  const gameDefinition = useMemo(
    () => GameRegistry.get(gameVariant),
    [gameVariant],
  );
  const evaluateBadugi = useMemo(
    () => gameDefinition?.evaluateHand ?? (() => null),
    [gameDefinition],
  );
  const compareBadugi = useMemo(
    () => gameDefinition?.compareHands ?? (() => 0),
    [gameDefinition],
  );
  const getWinnersByBadugi = useMemo(
    () => gameDefinition?.getWinners ?? (() => []),
    [gameDefinition],
  );
  const runShowdown = useMemo(
    () => gameDefinition?.runShowdown ?? (() => ({})),
    [gameDefinition],
  );
  const [tournamentHudState, setTournamentHudState] = useState(null);
  const [tournamentOverlayVisible, setTournamentOverlayVisible] = useState(false);
  const [tournamentPlacements, setTournamentPlacements] = useState([]);
  const [tournamentTitle, setTournamentTitle] = useState("Tournament Results");
  const [heroBustSummary, setHeroBustSummary] = useState(null);
  const [heroBustOverlayVisible, setHeroBustOverlayVisible] = useState(false);
  const tournamentStateRef = useRef(null);
  const formatVariantLabel = useCallback(
    (variantId) => {
      if (!variantId) return null;
      const definition = GameRegistry.get(variantId);
      return definition?.label ?? variantId.toUpperCase();
    },
    [],
  );

  const attachVariantLabels = useCallback(
    (hudPayload) =>
      attachVariantLabelsToHud(hudPayload, {
        currentVariantLabel: formatVariantLabel(gameVariantRef.current),
        nextVariantLabel: formatVariantLabel(getNextVariant(variantRotationRef.current)),
      }),
    [formatVariantLabel],
  );

  const refreshHudVariantLabels = useCallback(() => {
    setTournamentHudState((prev) => {
      if (!prev) return prev;
      const nextPayload = attachVariantLabels(prev);
      if (
        nextPayload?.currentVariantLabel === prev.currentVariantLabel &&
        nextPayload?.nextVariantLabel === prev.nextVariantLabel
      ) {
        return prev;
      }
      return nextPayload;
    });
  }, [attachVariantLabels]);

  const initializeVariantRotation = useCallback(
    ({ rotation, policy, initialVariant }) => {
      const controller = createVariantRotationController({
        rotation,
        policy,
        initialVariant,
        defaultVariant: DEFAULT_GAME_VARIANT,
      });
      variantRotationRef.current = controller;
      const nextVariant = getCurrentVariant(controller) ?? DEFAULT_GAME_VARIANT;
      gameVariantRef.current = nextVariant;
      setGameVariant(nextVariant);
      refreshHudVariantLabels();
    },
    [refreshHudVariantLabels],
  );

  const handleVariantRotationTrigger = useCallback(
    (trigger) => {
      const controller = variantRotationRef.current;
      const nextController = advanceVariantRotation(controller, trigger);
      if (nextController === controller) {
        return false;
      }
      variantRotationRef.current = nextController;
      const nextVariant = getCurrentVariant(nextController) ?? DEFAULT_GAME_VARIANT;
      if (nextVariant !== gameVariantRef.current) {
        gameVariantRef.current = nextVariant;
        setGameVariant(nextVariant);
      }
      return true;
    },
    [],
  );

  const triggerRotationAndRefreshHud = useCallback(
    (trigger) => {
      const rotated = handleVariantRotationTrigger(trigger);
      if (rotated) {
        refreshHudVariantLabels();
      }
    },
    [handleVariantRotationTrigger, refreshHudVariantLabels],
  );
  useLayoutEffect(() => {
    gameVariantRef.current = gameVariant;
    refreshHudVariantLabels();
  }, [gameVariant, refreshHudVariantLabels]);
  const heroSeatMapRef = useRef([]);
  const heroTableIdRef = useRef(null);
  const heroTableMetaRef = useRef({ tableId: null, seatIndex: null });
  const heroTournamentPlayerIdRef = useRef(HERO_TOURNAMENT_PLAYER_ID);
  const handStartingStacksRef = useRef({});
  const heroBustHandledRef = useRef(false);
  const heroRenderTableIdRef = useRef(null);
  const heroTableAnimTimerRef = useRef(null);
  const animationsEnabledRef = useRef(
    typeof process !== "undefined" ? process.env.NODE_ENV !== "test" : true,
  );
  const [heroTableAnimating, setHeroTableAnimating] = useState(false);
  const fastForwardMTTCompleteRef = useRef(null);
  const autoModeInitRef = useRef(false);
  const gameControllerRef = useRef(null);
  const controllerVariantRef = useRef(null);
  const uiAdapterRef = useRef(null);


  const triggerHeroTableAnimation = useCallback(() => {
    const e2eActive =
      typeof window !== "undefined" && window.__BADUGI_E2E__;
    if (!animationsEnabledRef.current || e2eActive) return;
    if (heroTableAnimTimerRef.current) {
      clearTimeout(heroTableAnimTimerRef.current);
    }
    setHeroTableAnimating(true);
    heroTableAnimTimerRef.current = setTimeout(() => {
      setHeroTableAnimating(false);
    }, 260);
  }, []);

  useEffect(
    () => () => {
      if (heroTableAnimTimerRef.current) {
        clearTimeout(heroTableAnimTimerRef.current);
      }
    },
    [],
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
  const location = useLocation();
  const ensureURLModeParam = useCallback(
    (modeValue) => {
      const params = new URLSearchParams(location.search ?? "");
      if (params.get("mode") === modeValue) {
        return;
      }
      params.set("mode", modeValue);
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true },
      );
    },
    [location.pathname, location.search, navigate],
  );
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
  const blindLevelIndexRef = useRef(blindLevelIndex);
  useEffect(() => {
    blindLevelIndexRef.current = blindLevelIndex;
  }, [blindLevelIndex]);
  const handsInLevelRef = useRef(handsInLevel);
  useEffect(() => {
    handsInLevelRef.current = handsInLevel;
  }, [handsInLevel]);
  const currentStructure =
    TOURNAMENT_STRUCTURE[blindLevelIndex] ??
    TOURNAMENT_STRUCTURE[lastStructureIndex];
  const SB = currentStructure.sb;
  const BB = currentStructure.bb;
  const currentAnte = currentStructure.ante ?? 0;
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
  const [dealerIdx, setDealerIdx] = useState(0);
  const [betHead, setBetHead] = useState(null);
  const [lastAggressor, setLastAggressor] = useState(null);
  const [currentBet, setCurrentBet] = useState(0);
  const [phase, setPhase] = useState("BET"); // BET / DRAW / SHOWDOWN
  const [drawRound, setDrawRound] = useState(0);
  const [betRoundIndex, setBetRoundIndex] = useState(0);
  const drawRoundTracker = useRef(drawRound);
  const betRoundTracker = useRef(betRoundIndex);
  const drawRoundLogCounter = useRef(1);
  const [turn, setTurn] = useState(0);
  const MAX_DRAWS = 3;
  const MAX_DRAW_SELECTION = 4;
  const [heroDrawSelection, setHeroDrawSelection] = useState([]);
  const betSize = useMemo(
    () =>
      getFixedLimitBetSize({
        baseBet: BB,
        drawRound,
        betRound: betRoundIndex,
      }),
    [BB, drawRound, betRoundIndex]
  );
  const FAST_FORWARD_SLEEP_MS = 5;
  const [players, setPlayers] = useState(() =>
    applyHeroProfile(
      buildPlayersFromSeatTypes(seatConfigRef.current, startingStackRef.current, heroProfile),
      heroProfile,
    ),
  );
  const playersRef = useRef(players);
  playersRef.current = players;
  const tableConfig = useMemo(
    () => ({
      levelNumber:
        currentStructure.level ??
        currentStructure.levelIndex ??
        blindLevelIndex + 1,
      sbValue: SB,
      bbValue: BB,
      anteValue: currentAnte,
      handCount: handsInLevelDisplay,
      handsCap: handsCapDisplay,
      startingStack,
      maxDraws: MAX_DRAWS,
    }),
    [
      currentStructure.level,
      currentStructure.levelIndex,
      blindLevelIndex,
      SB,
      BB,
      currentAnte,
      handsInLevelDisplay,
      handsCapDisplay,
      startingStack,
      MAX_DRAWS,
    ]
  );
  const controllerSnapshot = useMemo(() => {
    const controller = gameControllerRef.current;
    if (!controller) return null;
    try {
      return controller.getSnapshot();
    } catch (err) {
      console.warn("[UI-ADAPTER] controller snapshot failed", err);
      return null;
    }
  }, [
    players,
    dealerIdx,
    blindLevelIndex,
    handsInLevel,
    betHead,
    lastAggressor,
    currentBet,
    phase,
    drawRound,
    turn,
    betRoundIndex,
  ]);
  const adapterViewProps = useMemo(() => {
    const adapter = uiAdapterRef.current;
    if (!adapter || !controllerSnapshot) return null;
    try {
      return adapter.buildViewProps({
        controllerSnapshot,
        tableConfig,
      });
    } catch (error) {
      console.warn("[UI-ADAPTER] buildViewProps error", error);
      return null;
    }
  }, [controllerSnapshot, tableConfig]);
  const [deck, setDeck] = useState([]);
  const [engineState, setEngineState] = useState(null);
  const engineStateRef = useRef(null);
  const { engine } = useGameEngine();
  const tablePhase = adapterViewProps?.tablePhase ?? phase;
  const isTableActionPhase =
    tablePhase === "BET" || tablePhase === "DRAW";
  const safeEngineState = engineState ?? {};
  const snapshotTurn =
    typeof safeEngineState?.metadata?.actingPlayerIndex === "number"
      ? safeEngineState.metadata.actingPlayerIndex
      : typeof safeEngineState?.nextTurn === "number"
      ? safeEngineState.nextTurn
      : typeof safeEngineState?.turn === "number"
      ? safeEngineState.turn
      : typeof controllerSnapshot?.turn === "number"
      ? controllerSnapshot.turn
      : turn;
  const controllerTurn =
    typeof snapshotTurn === "number" && !Number.isNaN(snapshotTurn)
      ? snapshotTurn
      : 0;

  const seatViews = useMemo(() => {
    const seatCount = players.length || NUM_PLAYERS;

    // まずは常に「players ベースの seat 情報」を組み立てる
    const baseSeats = players.map((player, idx) => {
      const clone = player ? clonePlayerState(player) : {};
      return {
        ...clone,
        seatIndex: idx,
        label: positionName(idx),
        isDealer: idx === dealerIdx,
        isSB: seatCount ? idx === ((dealerIdx + 1) % seatCount) : false,
        isBB: seatCount ? idx === ((dealerIdx + 2) % seatCount) : false,
        isHero: idx === 0,
        isTurn: false,
      };
    });

    // adapter が seatViews を提供していれば、それを「差分」としてマージする
    if (adapterViewProps?.seatViews?.length) {
      return baseSeats.map((base, idx) => {
        const override = adapterViewProps.seatViews[idx];
        if (!override) return base;

        return {
          ...base,
          ...override,
          // cards は必ずどちらかから埋まるようにしておく
          cards: override.cards ?? base.cards ?? [],
        };
      });
    }

    // なければベースそのまま
    const normalized = adapterViewProps?.seatViews?.length
      ? baseSeats.map((base, idx) => {
          const override = adapterViewProps.seatViews[idx];
          if (!override) return base;
          return {
            ...base,
            ...override,
            cards: override.cards ?? base.cards ?? [],
          };
        })
      : baseSeats;
    return normalized.map((seat, idx) => ({
      ...seat,
      isTurn: isTableActionPhase && idx === controllerTurn,
    }));
  }, [
    adapterViewProps?.seatViews,
    players,
    dealerIdx,
    controllerTurn,
    isTableActionPhase,
  ]);

  const seatLabels = useMemo(
    () =>
      seatViews.map((seat, idx) =>
        seat?.label ?? positionName(typeof seat?.seatIndex === "number" ? seat.seatIndex : idx)
      ),
    [seatViews]
  );
  const hudInfo = adapterViewProps?.hudInfo ?? null;
  const controlsConfig = adapterViewProps?.controlsConfig ?? null;
  const potView = adapterViewProps?.potView ?? null;
  const controllerDealerIdx = controllerSnapshot?.dealerIdx ?? dealerIdx;
  const tournamentHud =
    isTournament && tournamentHudState ? (
      <div className="w-full px-4 pt-4">
        <TournamentHUD {...tournamentHudState} />
      </div>
    ) : null;
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

  const deckRef = useRef(
    gameDefinition?.createDeck ? gameDefinition.createDeck() : null,
  );

  useEffect(() => {
    if (gameDefinition?.createDeck) {
      deckRef.current = gameDefinition.createDeck();
    }
  }, [gameDefinition]);

  const getDeckManager = useCallback(() => {
    if (!deckRef.current && gameDefinition?.createDeck) {
      deckRef.current = gameDefinition.createDeck();
    }
    return deckRef.current;
  }, [gameDefinition]);

  const buildNlhTableConfig = useCallback(
    () => ({
      seats: players.map((player, idx) => ({
        seatIndex: idx,
        name: player?.name ?? `Seat ${idx + 1}`,
        stack: player?.stack ?? 0,
        seatOut: player?.seatOut ?? false,
      })),
      blinds: { sb: SB, bb: BB, ante: currentAnte },
    }),
    [players, SB, BB, currentAnte],
  );

  const ensureGameController = useCallback(() => {
    const variantId = gameVariant;
    const needsNew =
      !gameControllerRef.current || controllerVariantRef.current !== variantId;
    if (needsNew) {
      if (variantId === "nlh") {
        gameControllerRef.current = new NLHGameController({
          tableConfig: buildNlhTableConfig(),
        });
      } else {
        gameControllerRef.current = new BadugiGameController({
          numSeats: NUM_PLAYERS,
          blindStructure: TOURNAMENT_STRUCTURE,
          lastStructureIndex,
          evaluateHand: evaluateBadugi,
        });
      }
      controllerVariantRef.current = variantId;
    } else if (variantId === "badugi") {
      gameControllerRef.current.updateConfig({
        blindStructure: TOURNAMENT_STRUCTURE,
        lastStructureIndex,
        evaluateHand: evaluateBadugi,
      });
    } else if (
      variantId === "nlh" &&
      typeof gameControllerRef.current.updateTableConfig === "function"
    ) {
      gameControllerRef.current.updateTableConfig(buildNlhTableConfig());
    }
    return gameControllerRef.current;
  }, [
    gameVariant,
    buildNlhTableConfig,
    evaluateBadugi,
    lastStructureIndex,
  ]);

  useEffect(() => {
    ensureGameController();
    if (gameVariant === "nlh") {
      ensureNLHUIAdapterRegistered();
    } else {
      ensureBadugiUIAdapterRegistered({ gameDefinition });
    }
    uiAdapterRef.current = getGameUIAdapter(gameVariant) ?? null;
  }, [ensureGameController, gameDefinition, gameVariant]);
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
  const [raiseCountThisRound, setRaiseCountThisRound] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const transitioningRef = useRef(transitioning);
  useEffect(() => {
    transitioningRef.current = transitioning;
  }, [transitioning]);
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
  
  const sbIndex = (d = dealerIdx) => (d + 1) % NUM_PLAYERS; // SB
  const orderFromSB = (d = dealerIdx) =>
    Array.from({ length: NUM_PLAYERS }, (_, k) => (sbIndex(d) + k) % NUM_PLAYERS);
  const normalizeSeatIndex = (seat, count) =>
    ((seat % count) + count) % count;
  const findNextDrawActorSeat = (snap, startIdx = null) => {
    if (!Array.isArray(snap) || snap.length === 0) return null;
    const n = snap.length;
    const startSeat =
      typeof startIdx === "number"
        ? normalizeSeatIndex(startIdx, n)
        : sbIndex();
    for (let offset = 0; offset < n; offset += 1) {
      const seat = (startSeat + offset) % n;
      const player = snap[seat];
      const needsAction =
        player &&
        !isFoldedOrOut(player) &&
        !player.seatOut &&
        !player.allIn &&
        !player.hasDrawn;
      console.log("[DRAW][CANDIDATE]", {
        seat,
        name: player?.name,
        folded: player?.folded,
        allIn: player?.allIn,
        hasDrawn: player?.hasDrawn,
        needsAction,
      });
      if (needsAction) {
        return seat;
      }
    }
    return null;
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
      const roster = playersRef.current;
      if (!Array.isArray(roster) || seat < 0 || seat >= roster.length) return false;
      const snap = roster.map(clonePlayerState).filter(Boolean);
      const controller = ensureGameController();
      const result = controller.applyPlayerAction({
        seatIndex: seat,
        payload,
        betSize,
        players: snap,
      });
      if (!result.success) {
        forcedSeatActionsRef.current.delete(seat);
        return false;
      }

      const {
        updatedPlayers,
        actor,
        actionLabel,
        raiseApplied,
        stackBefore,
        stackAfter,
        betBefore,
        betAfter,
      } = result;

      playersRef.current = updatedPlayers;
      forcedSeatActionsRef.current.delete(seat);

      logAction(seat, actionLabel, { forced: true });
      recordActionToLog({
        phase: "BET",
        round: currentBetRoundIndex(),
        seat,
        playerState: actor,
        type: actor.lastAction,
        stackBefore,
        stackAfter,
        betBefore,
        betAfter,
        raiseCountTable: raiseCountThisRound,
      });

      if (actor.folded) {
        shiftAggressorsAfterFold(updatedPlayers, seat);
      } else if (raiseApplied) {
        setRaiseCountThisRound((count) => count + 1);
        setBetHead(seat);
        setLastAggressor(seat);
      }

      afterBetActionWithSnapshot(updatedPlayers, seat);
      return true;
    },
    [
      phase,
      betSize,
      raiseCountThisRound,
      afterBetActionWithSnapshot,
      setBetHead,
      setLastAggressor,
      ensureGameController,
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
          nextTurn: turn,
          turn,
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
      forcedSeatActionsRef.current = queueForcedSeatActionMap(
        forcedSeatActionsRef.current,
        seat,
        payload,
      );
      if (phase === "BET") {
        applyForcedBetAction(seat, payload);
      }
    },
    [phase, applyForcedBetAction]
  );

  const forceSequentialFolds = useCallback(
    (seats = []) => {
      forcedSeatActionsRef.current = forceSequentialFoldsMap(
        forcedSeatActionsRef.current,
        seats,
      );
      if (phase === "BET") {
        const list = Array.isArray(seats) ? seats : [seats];
        list.forEach((seat) =>
          applyForcedBetAction(seat, { type: "fold", __forceInstant: true }),
        );
      }
    },
    [phase, applyForcedBetAction]
  );

  const forceAllInAction = useCallback(
    (seat, amount) => {
      forcedSeatActionsRef.current = forceAllInActionMap(
        forcedSeatActionsRef.current,
        seat,
        amount,
      );
      if (phase === "BET") {
        applyForcedBetAction(seat, { type: "all-in", amount, __forceInstant: true });
      }
    },
    [phase, applyForcedBetAction]
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
        tournamentPlayerId: null,
        tournamentSeatIndex: null,
      };
    });
  }

  function buildTournamentEntrants(config) {
    const totalPlayersForConfig =
      Math.max(1, Number(config?.tables) || 1) *
      Math.max(1, Number(config?.seatsPerTable) || NUM_PLAYERS);
    return Array.from({ length: totalPlayersForConfig }, (_, idx) => {
      if (idx === 0) {
        return {
          id: HERO_TOURNAMENT_PLAYER_ID,
          name: heroProfile?.name ?? "You",
        };
      }
      return {
        id: `cpu-${idx}`,
        name: `CPU ${idx + 1}`,
      };
    });
  }

  function hydrateHeroTableFromTournamentState(state) {
    if (!state) return null;
    const heroId = heroTournamentPlayerIdRef.current;
    const heroPlayer = state.players?.[heroId];
    if (!heroPlayer || !heroPlayer.tableId) return null;
    const table = state.tables.find((t) => t.tableId === heroPlayer.tableId);
    if (!table) return null;
    const seats = table.seats ?? [];
    if (!seats.length) return null;
    const heroSeatIdx = seats.findIndex((seat) => seat.playerId === heroId);
    const rotationStart = heroSeatIdx >= 0 ? heroSeatIdx : 0;
    const orderedSeats = Array.from({ length: seats.length }, (_, offset) => {
      const seat = seats[(rotationStart + offset) % seats.length];
      return seat ?? { seatIndex: offset, playerId: null };
    });
    const seatMapping = orderedSeats.map((seat) =>
      typeof seat?.seatIndex === "number" ? seat.seatIndex : null,
    );
    const basePlayers = buildPlayersFromSeatTypes(
      seatConfigRef.current,
      state.config?.startingStack ?? DEFAULT_STARTING_STACK,
      heroProfile,
    );
    const tablePlayers = basePlayers.map((player, idx) => {
      const seat = orderedSeats[idx];
      if (!seat?.playerId) {
        return {
          ...player,
          name: `(Empty Seat ${seat?.seatIndex ?? idx + 1})`,
          stack: 0,
          folded: true,
          hasFolded: true,
          seatOut: true,
          isBusted: true,
          tournamentPlayerId: null,
          tournamentSeatIndex: seat?.seatIndex ?? idx,
        };
      }
      const linkedPlayer = state.players[seat.playerId];
      return {
        ...player,
        name: linkedPlayer?.name ?? player.name,
        stack: linkedPlayer?.stack ?? 0,
        seatOut: !!linkedPlayer?.busted,
        isBusted: !!linkedPlayer?.busted,
        folded: !!linkedPlayer?.busted,
        hasFolded: !!linkedPlayer?.busted,
        tournamentPlayerId: linkedPlayer?.id ?? null,
        tournamentSeatIndex: seat.seatIndex,
      };
    });
    return {
      tablePlayers,
      seatMapping,
      tableId: table.tableId,
      heroSeatIndex: heroSeatIdx,
    };
  }

  function buildTournamentHandSummaryFromPlayers(playersSnapshot) {
    if (!playersSnapshot || !heroSeatMapRef.current.length || !heroTableIdRef.current) {
      return null;
    }
    const startingStacks = handStartingStacksRef.current ?? {};
    const seatResults = playersSnapshot
      .map((player, idx) => {
        if (!player?.tournamentPlayerId) return null;
        const seatIndex = heroSeatMapRef.current[idx];
        if (typeof seatIndex !== "number") return null;
        return {
          seatIndex,
          playerId: player.tournamentPlayerId,
          stack: Math.max(0, Number(player.stack) || 0),
          startingStack: Math.max(
            0,
            Number(startingStacks[player.tournamentPlayerId]) ?? Number(player.stack) ?? 0,
          ),
        };
      })
      .filter(Boolean);
    if (!seatResults.length) return null;
    return {
      handId: handIdRef.current ?? null,
      seatResults,
    };
  }

  function buildTournamentPlacementsPayload(state) {
    if (!state?.players) return [];
    return Object.values(state.players)
      .filter(
        (player) =>
          typeof player?.finishPlace === "number" &&
          player.finishPlace > 0,
      )
      .sort((a, b) => a.finishPlace - b.finishPlace)
      .map((player) => ({
        id: player.id,
        place: player.finishPlace,
        name: player.name ?? player.id,
        stack: Math.max(0, Number(player.stack) || 0),
        payout: Math.max(0, Number(player.payout) || 0),
      }));
  }

  const recordHeroHandForReplay = useCallback((tableId, summary) => {
    if (!summary) return;
    appendTournamentReplayHand({
      handId: summary.handId ?? `hero-${Date.now()}`,
      tableId,
      seatResults: summary.seatResults,
      source: "hero",
    });
  }, []);

  const recordCpuHandForReplay = useCallback((handPacket) => {
    if (!handPacket) return;
    appendTournamentReplayHand({
      handId:
        handPacket.handId ??
        `cpu-${handPacket.tableId ?? "unknown"}-${handPacket.handIndex ?? Date.now()}`,
      tableId: handPacket.tableId ?? null,
      seatResults: handPacket.seatResults,
      source: "cpu",
      meta: { handIndex: handPacket.handIndex ?? null },
    });
  }, []);

  const applyTournamentStateUpdate = useCallback(
    (nextState, { hydrate = true, suppressResultOverlay = false } = {}) => {
      if (!nextState) return;
      const previousState = tournamentStateRef.current;
      tournamentStateRef.current = nextState;
      const levelChanged =
        typeof previousState?.levelIndex === "number" &&
        previousState.levelIndex !== nextState.levelIndex;
      if (levelChanged) {
        handleVariantRotationTrigger("level");
      }
      const heroPlayer = nextState.players?.[heroTournamentPlayerIdRef.current];
      heroTableIdRef.current = heroPlayer?.tableId ?? null;
      heroTableMetaRef.current = {
        tableId: heroPlayer?.tableId ?? null,
        seatIndex: heroPlayer?.seatIndex ?? null,
      };
      const hudPayload = buildTournamentHudPayload({
        state: nextState,
        heroPlayer,
        heroTableId: heroPlayer?.tableId ?? heroTableIdRef.current ?? null,
        fallbackSeatsPerTable: nextState.config?.seatsPerTable ?? NUM_PLAYERS,
      });
      if (hudPayload) {
        hudPayload.handsPlayedThisLevel =
          typeof handsInLevelRef.current === "number"
            ? handsInLevelRef.current
            : hudPayload.handsPlayedThisLevel ?? 0;
        const currentLevelDef = getCurrentLevel(nextState);
        hudPayload.handsThisLevel =
          hudPayload.handsThisLevel ??
          currentLevelDef?.handsThisLevel ??
          null;
        hudPayload.nextBreakLabel =
          hudPayload.nextBreakLabel ?? TOURNAMENT_CLOCK_PLACEHOLDER;
      }
      setTournamentHudState(attachVariantLabels(hudPayload));
      if (hydrate) {
        const hydration = hydrateHeroTableFromTournamentState(nextState);
        if (hydration) {
          const prevTableId = heroRenderTableIdRef.current;
          heroSeatMapRef.current = hydration.seatMapping;
          heroTableIdRef.current = hydration.tableId;
          playersRef.current = hydration.tablePlayers;
          setPlayers(hydration.tablePlayers);
          heroRenderTableIdRef.current = hydration.tableId;
          if (prevTableId && hydration.tableId && prevTableId !== hydration.tableId) {
            triggerHeroTableAnimation();
          }
        }
      }
      const publishHeroBustOverlay = (finalState, heroPlayerSnapshot) => {
        if (!finalState || !heroPlayerSnapshot) return;
        const placements = buildTournamentPlacementsPayload(finalState);
        const heroPlacement =
          placements.find((entry) => entry.id === heroPlayerSnapshot.id) ?? {
            id: heroPlayerSnapshot.id,
            place: heroPlayerSnapshot.finishPlace ?? placements.length + 1,
            name: heroPlayerSnapshot.name ?? heroProfile.name ?? "You",
            stack: heroPlayerSnapshot.stack ?? 0,
            payout: heroPlayerSnapshot.payout ?? 0,
          };
        const inMoneyPlacements = placements.filter((entry) => (entry.payout ?? 0) > 0);
        setHeroBustSummary({
          title: finalState?.config?.name ?? "Tournament Results",
          hero: heroPlacement,
          inMoney: inMoneyPlacements,
        });
        setHeroBustOverlayVisible(true);
        setTournamentOverlayVisible(false);
      };

      if (nextState.isFinished) {
        if (DEBUG_TOURNAMENT) {
          logMTT("PLACEMENT", {
            event: "ui-finish",
            championId: nextState.championId,
          });
        }
        computePayouts(nextState);
        const placements = buildTournamentPlacementsPayload(nextState);
        setTournamentPlacements(placements);
        setTournamentTitle(nextState?.config?.name ?? "Tournament Results");
        setShowNextButton(false);
        setHandResultVisible(false);
        finalizeTournamentReplay(nextState, placements);
        if (!suppressResultOverlay) {
          setTournamentOverlayVisible(true);
        } else {
          setTournamentOverlayVisible(false);
        }
      }

      const heroPlayerSnapshot = nextState.players?.[heroTournamentPlayerIdRef.current];
      if (!heroBustHandledRef.current && heroPlayerSnapshot?.busted) {
        heroBustHandledRef.current = true;
        setShowNextButton(false);
        setHandResultVisible(false);
        const forwardPromise =
          fastForwardMTTCompleteRef.current?.({ suppressResultOverlay: true }) ?? null;
      if (forwardPromise) {
        forwardPromise.then((finalState) => {
          if (!finalState) return;
          if (DEBUG_TOURNAMENT) {
            logMTT("PLACEMENT", {
              event: "hero-bust-detected",
              playerId: heroPlayerSnapshot.id,
            });
          }
          publishHeroBustOverlay(finalState, {
            id: heroPlayerSnapshot.id ?? heroTournamentPlayerIdRef.current,
            finishPlace: heroPlayerSnapshot.finishPlace,
            name: heroPlayerSnapshot.name,
            stack: heroPlayerSnapshot.stack,
            payout: heroPlayerSnapshot.payout,
          });
        });
      } else {
        if (DEBUG_TOURNAMENT) {
          logMTT("PLACEMENT", {
            event: "hero-bust-detected",
            playerId: heroPlayerSnapshot.id,
          });
        }
        publishHeroBustOverlay(nextState, heroPlayerSnapshot);
      }
    }
    },
    [
      attachVariantLabels,
      handleVariantRotationTrigger,
      heroProfile,
      setHandResultVisible,
      setPlayers,
      setShowNextButton,
      setTournamentHudState,
      setTournamentOverlayVisible,
      setTournamentPlacements,
      setTournamentTitle,
      triggerHeroTableAnimation,
    ],
  );

  function getTournamentHudSnapshot() {
    const state = tournamentStateRef.current;
    if (!state) return null;
    const heroPlayer = state.players?.[heroTournamentPlayerIdRef.current];
    const tablesActive = Array.isArray(state.tables)
      ? state.tables.filter((table) => table.isActive).length
      : 0;
    const config = state.config ?? {};
    const startingStackValue = Math.max(0, Number(config.startingStack) || 0);
    const totalPlayers = state.totalPlayers ?? 0;
    const playersRemaining = state.playersRemaining ?? 0;
    const prizePoolTotal = startingStackValue * Math.max(0, totalPlayers);
    const averageStack =
      playersRemaining > 0 ? Math.floor(prizePoolTotal / playersRemaining) : null;
    const levelInfo = getCurrentLevel(state);
    const currentLevelNumber =
      typeof levelInfo?.levelIndex === "number"
        ? levelInfo.levelIndex
        : (state.levelIndex ?? 0) + 1;
    const levelsList = Array.isArray(config.levels) ? config.levels : [];
    let nextLevelInfo = null;
    if (levelsList.length) {
      if (typeof levelInfo?.levelIndex === "number") {
        nextLevelInfo =
          levelsList.find((lvl) => lvl.levelIndex === levelInfo.levelIndex + 1) ?? null;
      }
      if (!nextLevelInfo) {
        const fallbackIndex =
          typeof currentLevelNumber === "number" ? currentLevelNumber : 0;
        nextLevelInfo =
          levelsList.find((lvl) => lvl.levelIndex === fallbackIndex + 1) ??
          levelsList[fallbackIndex] ??
          null;
      }
    }
    const payoutList = Array.isArray(config.payouts) ? config.payouts : [];
    const payoutBreakdown = payoutList.slice(0, 3).map((entry, idx) => {
      const percent = typeof entry.percent === "number" ? entry.percent : null;
      const amount =
        percent != null ? Math.floor((percent / 100) * prizePoolTotal) : null;
      return {
        place: entry.place ?? idx + 1,
        percent,
        amount,
      };
    });
    while (payoutBreakdown.length < 3) {
      payoutBreakdown.push({
        place: payoutBreakdown.length + 1,
        percent: null,
        amount: null,
      });
    }
    const baseHud = buildTournamentHudPayload({
      state,
      heroPlayer,
      heroTableId: heroPlayer?.tableId ?? heroTableIdRef.current ?? null,
      fallbackSeatsPerTable: state.config?.seatsPerTable ?? NUM_PLAYERS,
    }) ?? {};
    const handsProgress =
      typeof handsInLevelRef.current === "number"
        ? handsInLevelRef.current
        : 0;
    return {
      ...baseHud,
      playersRemaining,
      totalPlayers,
      totalEntrants: totalPlayers,
      tablesActive,
      isFinished: Boolean(state.isFinished),
      championId: state.championId ?? null,
      overlayVisible: tournamentOverlayVisible,
      heroTableId: heroPlayer?.tableId ?? null,
      heroSeatIndex:
        typeof heroPlayer?.seatIndex === "number" ? heroPlayer.seatIndex : null,
      currentVariantLabel:
        tournamentHudState?.currentVariantLabel ?? baseHud.currentVariantLabel ?? null,
      nextVariantLabel:
        tournamentHudState?.nextVariantLabel ?? baseHud.nextVariantLabel ?? null,
      tournamentName: config.name ?? null,
      prizePoolTotal,
      averageStack,
      payoutBreakdown,
      currentLevelNumber,
      currentBlinds: {
        sb: levelInfo?.smallBlind ?? null,
        bb: levelInfo?.bigBlind ?? null,
        ante: levelInfo?.ante ?? null,
      },
      nextLevelBlinds: nextLevelInfo
        ? {
            sb: nextLevelInfo.smallBlind ?? null,
            bb: nextLevelInfo.bigBlind ?? null,
            ante: nextLevelInfo.ante ?? null,
          }
        : null,
      startingStack: startingStackValue,
      handsPlayedThisLevel: handsProgress,
      handsThisLevel: levelInfo?.handsThisLevel ?? null,
      nextBreakLabel: TOURNAMENT_CLOCK_PLACEHOLDER,
    };
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

  const fallbackTotalPot = useMemo(() => {
    const settled = pots.reduce((acc, p) => acc + (p.amount || 0), 0);
    const onStreet = players.reduce((acc, p) => acc + (p.betThisRound || 0), 0);
    return settled + onStreet;
  }, [pots, players]);
  const totalPotForDisplay = adapterViewProps?.potView?.total ?? fallbackTotalPot;

  const totalPotRef = useRef(0);
  useEffect(() => {
    totalPotRef.current = totalPotForDisplay;
  }, [totalPotForDisplay]);

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
    const controllerForSummary = gameControllerRef.current;
    const handSummaryPayload =
      controllerForSummary?.resolveShowdown({
        players: updated,
        summary: showdownSummary,
        totalPot: totalPotAmount,
        handId: handIdRef.current,
        evaluateHand: evaluateBadugi,
      }) ??
      buildHandResultSummary({
        players: updated,
        summary: showdownSummary,
        totalPot: totalPotAmount,
        handId: handIdRef.current,
        evaluateHand: evaluateBadugi,
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
    if (mode === "tournament-mtt" && tournamentStateRef.current) {
      const tournamentSummary = buildTournamentHandSummaryFromPlayers(updated);
      if (tournamentSummary) {
        const tableId = heroTableIdRef.current ?? heroTableMetaRef.current.tableId;
        recordHeroHandForReplay(tableId, tournamentSummary);
        let nextState = onTableHandCompleted(
          tournamentStateRef.current,
          tableId,
          tournamentSummary,
        );
        if (!nextState.isFinished) {
          nextState = simulateBackgroundTables(nextState, tableId, {
            maxHandsPerTable: 2,
            onHandSimulated: recordCpuHandForReplay,
          });
        }
        applyTournamentStateUpdate(nextState);
      }
    }
    triggerRotationAndRefreshHud("hand");
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

  const resetTournamentState = useCallback(() => {
    tournamentStateRef.current = null;
    heroSeatMapRef.current = [];
    heroTableIdRef.current = null;
    heroTableMetaRef.current = { tableId: null, seatIndex: null };
    heroTournamentPlayerIdRef.current = HERO_TOURNAMENT_PLAYER_ID;
    heroRenderTableIdRef.current = null;
    heroBustHandledRef.current = false;
    setTournamentHudState(null);
    setTournamentPlacements([]);
    setTournamentOverlayVisible(false);
    setHeroBustSummary(null);
    setHeroBustOverlayVisible(false);
    setHeroTableAnimating(false);
    resetTournamentReplay();
    initializeVariantRotation({
      rotation: [gameVariantRef.current ?? DEFAULT_GAME_VARIANT],
      policy: "fixed",
      initialVariant: gameVariantRef.current ?? DEFAULT_GAME_VARIANT,
    });
  }, [initializeVariantRotation]);

  const startTournamentMTT = useCallback(
    (configOverride = DEFAULT_STORE_TOURNAMENT_CONFIG) => {
      const config = { ...DEFAULT_STORE_TOURNAMENT_CONFIG, ...configOverride };
      resetTournamentState();
      initTournamentReplay(config);
      const entrants = buildTournamentEntrants(config);
      const tournamentState = createMTTTournamentState(config, entrants);
      tournamentStateRef.current = tournamentState;
      heroTournamentPlayerIdRef.current = entrants[0]?.id ?? HERO_TOURNAMENT_PLAYER_ID;
      const hydration = hydrateHeroTableFromTournamentState(tournamentState);
      if (hydration) {
        heroSeatMapRef.current = hydration.seatMapping;
        heroTableIdRef.current = hydration.tableId;
        playersRef.current = hydration.tablePlayers;
        setPlayers(hydration.tablePlayers);
        heroRenderTableIdRef.current = hydration.tableId;
      }
      const heroPlayer = tournamentState.players?.[heroTournamentPlayerIdRef.current];
      heroTableIdRef.current = heroPlayer?.tableId ?? null;
      heroTableMetaRef.current = {
        tableId: heroPlayer?.tableId ?? null,
        seatIndex: heroPlayer?.seatIndex ?? null,
      };
      const hudPayload = buildTournamentHudPayload({
        state: tournamentState,
        heroPlayer,
        heroTableId: heroPlayer?.tableId ?? heroTableIdRef.current ?? null,
        fallbackSeatsPerTable: tournamentState.config?.seatsPerTable ?? NUM_PLAYERS,
      });
      if (hudPayload) {
        hudPayload.handsPlayedThisLevel =
          typeof handsInLevelRef.current === "number"
            ? handsInLevelRef.current
            : hudPayload.handsPlayedThisLevel ?? 0;
        const currentLevelDef = getCurrentLevel(tournamentState);
        hudPayload.handsThisLevel =
          hudPayload.handsThisLevel ??
          currentLevelDef?.handsThisLevel ??
          null;
        hudPayload.nextBreakLabel =
          hudPayload.nextBreakLabel ?? TOURNAMENT_CLOCK_PLACEHOLDER;
      }
      const normalizedRotation =
        Array.isArray(config.gameRotation) && config.gameRotation.length
          ? config.gameRotation
          : [config.gameVariant ?? DEFAULT_GAME_VARIANT];
      initializeVariantRotation({
        rotation: normalizedRotation,
        policy: config.rotationPolicy ?? "fixed",
        initialVariant: config.gameVariant ?? normalizedRotation[0],
      });
      setTournamentHudState(attachVariantLabels(hudPayload));
      setTournamentTitle(config?.name ?? "Tournament Results");
      handStartingStacksRef.current = {};
      setMode("tournament-mtt");
      setStartingStack(config.startingStack);
      startingStackRef.current = config.startingStack;
      setShowNextButton(false);
      setHandResultVisible(false);
      setPhase("BET");
      setDrawRoundValue(0);
      setBetRoundValue(0);
      setHandsInLevel(0);
      setBlindLevelIndex(0);
      resetSeatConfigToDefault();
      resetHandHistoryRecord();
      handHistoryRef.current = [];
      currentHandHistoryRef.current = null;
      handSavedRef.current = false;
      const deckManager = getDeckManager();
      deckManager?.reset();
      if (hydration) {
        dealNewHand(0, hydration.tablePlayers);
      } else {
        dealNewHand(0);
      }
    },
    // dealNewHand is a stable function declaration; no need to include in deps.
    [attachVariantLabels, initializeVariantRotation, resetTournamentState],
  );

  const handleTournamentBackToMenu = useCallback(() => {
    resetTournamentState();
    setMode("cash");
    setCurrentScreen("menu");
    navigate("/");
  }, [navigate, resetTournamentState, setCurrentScreen]);

  const handleTournamentPlayAgain = useCallback(() => {
    const config = tournamentStateRef.current?.config ?? DEFAULT_STORE_TOURNAMENT_CONFIG;
    startTournamentMTT(config);
  }, [startTournamentMTT]);

  useEffect(() => {
    if (!location?.state?.startTournamentMTT) return;
    autoModeInitRef.current = true;
    ensureURLModeParam("store_tournament");
    startTournamentMTT(DEFAULT_STORE_TOURNAMENT_CONFIG);
    setCurrentScreen("gameTournament");
    const nextState = { ...location.state };
    delete nextState.startTournamentMTT;
    navigate(location.pathname, { replace: true, state: nextState });
  }, [ensureURLModeParam, location, navigate, setCurrentScreen, startTournamentMTT]);

  useEffect(() => {
    if (autoModeInitRef.current) return;
    if (initialModeRef.current === "tournament-mtt") {
      autoModeInitRef.current = true;
      debugLog("[MODE]", { source: "url-param", requestedMode: "tournament-mtt" });
      startTournamentMTT(DEFAULT_STORE_TOURNAMENT_CONFIG);
      setCurrentScreen("gameTournament");
    }
  }, [setCurrentScreen, startTournamentMTT]);

  const handleEnterFromTitle = () => {
    setCurrentScreen("menu");
  };

  const handleBackToMenu = () => {
    setCurrentScreen("menu");
  };

  const handleSelectSettings = () => {
    setCurrentScreen("settings");
  };

  const handleSelectRing = (variantId = gameVariantRef.current ?? DEFAULT_GAME_VARIANT) => {
    const normalizedVariant = variantId || DEFAULT_GAME_VARIANT;
    if (normalizedVariant !== gameVariantRef.current) {
      setGameVariant(normalizedVariant);
    }
    setMode("cash");
    setCurrentScreen("gameRing");
  };

  const handleSelectTournament = (configOverride) => {
    const config = configOverride ?? DEFAULT_STORE_TOURNAMENT_CONFIG;
    setCurrentScreen("gameTournament");
    startTournamentMTT(config);
  };

  const handleNavigateToTitle = useCallback(() => {
    resetTournamentState();
    setMode("cash");
    setCurrentScreen("title");
    navigate("/");
  }, [navigate, resetTournamentState]);

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
    const releaseDealingLock = () => {
      setTimeout(() => {
        dealingRef.current = false;
      }, 100);
    };

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

    const basePlayersSnapshot = playersRef.current ?? [];
    const shouldRotateSeats = Boolean(prevPlayers && autoRotateSeatsRef.current);
    const effectiveSeatConfig = consumeSeatConfigForHand(shouldRotateSeats);

    const deckManager = getDeckManager();
    deckManager?.reset();
    const fallbackStack = startingStackRef.current;
    const blindLevelSnapshot = blindLevelIndexRef.current ?? 0;
    const handsInLevelSnapshot = handsInLevelRef.current ?? 0;

    const controller = ensureGameController();
    const nextHandState = controller.startNewHand({
      prevPlayers,
      currentPlayers: basePlayersSnapshot,
      numSeats: NUM_PLAYERS,
      seatConfig: effectiveSeatConfig,
      startingStack: fallbackStack,
      heroProfile,
      nextDealerIdx,
      blindStructure: TOURNAMENT_STRUCTURE,
      blindState: {
        blindLevelIndex: blindLevelSnapshot,
        handsInLevel: handsInLevelSnapshot,
      },
      lastStructureIndex,
      drawCardsForSeat: (seat, seatPlayer) => {
        if (seatPlayer?.seatOut) return [];
        return deckManager?.draw(4) ?? [];
      },
    });

    const {
      players: newPlayers,
      blindLevelIndex: resolvedBlindIdx,
      handsInLevel: resolvedHandCount,
      blindValues,
      sbIdx,
      bbIdx,
      sbPay,
      bbPay,
      anteEvents,
      initialCurrentBet,
      resolvedTurn,
      activeCount,
      handStartingStacksById,
      seatOutWarnings,
    } = nextHandState;

    setBlindLevelIndex(resolvedBlindIdx);
    setHandsInLevel(resolvedHandCount);

    handStartingStacksRef.current = handStartingStacksById;
    seatOutWarnings.forEach((msg) => console.warn(msg));
    if (activeCount === 2) {
      console.log("[FINALS] Start heads-up match!");
      setPlayers(newPlayers);
      releaseDealingLock();
      setPhase("TOURNAMENT_FINAL");
      setTimeout(() => dealHeadsUpFinal(newPlayers), 800);
      return;
    } else if (activeCount < 2) {
      console.warn(`[TOURNAMENT END] Only ${activeCount} active players remain.`);
      setPlayers(newPlayers);
      releaseDealingLock();
      setShowNextButton(false);
      setPhase("TOURNAMENT_END");
      return;
    }

    handSavedRef.current = false;
    handIdRef.current = `${nextDealerIdx}-${Date.now()}`;
    controller.setHandContext({ handId: handIdRef.current });
    currentHandHistoryRef.current = startHandHistoryRecord({
      handId: handIdRef.current,
      dealer: nextDealerIdx,
      level: { sb: blindValues.sb, bb: blindValues.bb, ante: blindValues.ante },
      seats: newPlayers.map((player, seat) => ({
        seat,
        name: player.name,
        startStack: player.stack,
      })),
      startedAt: Date.now(),
    });

    if (blindValues.ante > 0 && anteEvents.length) {
      anteEvents.forEach(({ seat, amount }) => {
        appendHandHistoryAction({
          seat,
          street: "BET",
          type: "ante",
          amount,
          totalInvested: newPlayers[seat]?.totalInvested ?? amount,
          metadata: { ante: blindValues.ante },
        });
      });
    }

    if (sbPay > 0 && newPlayers[sbIdx]) {
      appendHandHistoryAction({
        seat: sbIdx,
        street: "BET",
        type: "blind",
        amount: sbPay,
        totalInvested: newPlayers[sbIdx]?.totalInvested ?? sbPay,
        metadata: { blind: "SB" },
      });
    }

    if (bbPay > 0 && newPlayers[bbIdx]) {
      appendHandHistoryAction({
        seat: bbIdx,
        street: "BET",
        type: "blind",
        amount: bbPay,
        totalInvested: newPlayers[bbIdx]?.totalInvested ?? bbPay,
        metadata: { blind: "BB" },
      });
    }

    setPlayers(newPlayers);
    handStartStacksRef.current = newPlayers.map((p) => p.stack);
    setDeck([]);
    setPots([]);
    setCurrentBet(initialCurrentBet);
    setDealerIdx(nextDealerIdx);
    setDrawRoundValue(0);
    setBetRoundValue(0);
    setPhase("BET");
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
        .map(() => [0, 0, 0, 0]),
    );
    setActionLog([]);

    debugLog("[HAND] New players dealt:", newPlayers.map((p) => p.name));
    debugLog(
      `[STATE] phase=BET, drawRound=0, turn=${
        (nextDealerIdx + 3) % NUM_PLAYERS
      }, currentBet=${initialCurrentBet}`,
    );

    console.groupCollapsed(`[DEBUG][NEW HAND] Dealer=${nextDealerIdx}`);
    newPlayers.forEach((p, i) => {
      console.log(`Seat ${i}: ${p.name}`, {
        stack: p.stack,
        folded: p.folded,
        allIn: p.allIn,
        hasDrawn: p.hasDrawn,
        betThisRound: p.betThisRound,
        lastAction: p.lastAction,
      });
    });
    console.groupEnd();

    if (Array.isArray(prevPlayers) && prevPlayers.some((p) => p?.hasDrawn || p?.showHand)) {
      console.warn("[INFO] previous hand snapshot had SHOWDOWN flags (expected):", prevPlayers);
    }

    setTimeout(() => logState("NEW HAND"), 0);

    releaseDealingLock();
    drawRoundLogCounter.current = 1;
    const seedSnapshot = {
      players: newPlayers.map(clonePlayerState).filter(Boolean),
      pots: [],
      deck: getDeckManager()?.deck ?? [],
      nextTurn: resolvedTurn,
      turn: resolvedTurn,
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
    if (mode === "tournament-mtt" && tournamentStateRef.current?.isFinished) {
      return;
    }
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
  }, [dealerIdx, mode, trySaveHandOnce]);

  const runTournamentBackgroundSimulation = useCallback(
    (iterations = 1) => {
      let nextState = tournamentStateRef.current;
      if (!nextState) return null;
      const heroTableId = heroTableIdRef.current ?? heroTableMetaRef.current.tableId;
      const cycles = Math.max(1, Number(iterations) || 1);
      for (let i = 0; i < cycles && nextState && !nextState.isFinished; i += 1) {
        nextState = simulateBackgroundTables(nextState, heroTableId, {
          maxHandsPerTable: 3,
          onHandSimulated: recordCpuHandForReplay,
        });
      }
      applyTournamentStateUpdate(nextState, { hydrate: true });
      return nextState;
    },
    [applyTournamentStateUpdate, recordCpuHandForReplay],
  );

  const flushAsync = (delay = 0) =>
    new Promise((resolve) => {
      setTimeout(resolve, delay);
    });

  const runHeroHandsForE2E = useCallback(
    async (hands = 1) => {
      const loops = Math.max(1, Number(hands) || 1);
      for (let i = 0; i < loops; i += 1) {
        if (mode !== "tournament-mtt" || tournamentStateRef.current?.isFinished) break;
        resolveHandImmediately();
        await flushAsync(FAST_FORWARD_SLEEP_MS);
        if (mode !== "tournament-mtt" || tournamentStateRef.current?.isFinished) break;
        startNextHand();
        await flushAsync(FAST_FORWARD_SLEEP_MS);
      }
      return tournamentStateRef.current;
    },
    [mode, resolveHandImmediately, startNextHand],
  );

  const forceHeroBustNow = useCallback(() => {
    if (mode !== "tournament-mtt") return tournamentStateRef.current;
    const state = tournamentStateRef.current;
    if (!state) return null;
    const heroId = heroTournamentPlayerIdRef.current;
    const heroPlayer = state.players?.[heroId];
    if (!heroPlayer || heroPlayer.busted || !heroPlayer.tableId) {
      return state;
    }
    if (typeof heroPlayer.seatIndex !== "number") {
      return state;
    }
    const summary = {
      handId: handIdRef.current ?? null,
      seatResults: [
        {
          seatIndex: heroPlayer.seatIndex,
          playerId: heroPlayer.id,
          stack: 0,
          startingStack: Math.max(0, Number(heroPlayer.stack) || 0),
        },
      ],
    };
    if (DEBUG_TOURNAMENT) {
      logMTT("PLACEMENT", { event: "hero-bust-forced", playerId: heroPlayer.id });
    }
    const nextState = onTableHandCompleted(state, heroPlayer.tableId, summary);
    applyTournamentStateUpdate(nextState, { hydrate: true, suppressResultOverlay: true });
    return nextState;
  }, [mode, applyTournamentStateUpdate]);

  const fastForwardMTTComplete = useCallback(
    async ({ suppressResultOverlay = false } = {}) => {
      if (mode !== "tournament-mtt") return tournamentStateRef.current;
      let nextState = tournamentStateRef.current;
      if (!nextState) return null;
      const MAX_LOOPS = 256;
      let loop = 0;
      while (nextState && !nextState.isFinished && loop < MAX_LOOPS) {
        nextState = simulateBackgroundTables(nextState, null, {
          maxHandsPerTable: 6,
          onHandSimulated: recordCpuHandForReplay,
        });
        loop += 1;
      }
      if (!nextState) {
        return null;
      }
      if (!nextState.isFinished && loop >= MAX_LOOPS) {
        if (DEBUG_TOURNAMENT) {
          logMTT("CPU", { event: "fast-forward-loop-guard", loops: loop });
        }
      } else if (nextState.isFinished) {
        computePayouts(nextState);
      }
      applyTournamentStateUpdate(nextState, {
        hydrate: true,
        suppressResultOverlay,
      });
      await flushAsync(FAST_FORWARD_SLEEP_MS);
      return nextState;
    },
    [mode, applyTournamentStateUpdate, recordCpuHandForReplay],
  );

  useEffect(() => {
    fastForwardMTTCompleteRef.current = fastForwardMTTComplete;
  }, [fastForwardMTTComplete]);

  useEffect(() => {
    if (!handResultVisible) return undefined;
    if (mode === "tournament-mtt" && tournamentStateRef.current?.isFinished) {
      return undefined;
    }
    const timer = setTimeout(() => {
      startNextHand();
    }, 5000);
    return () => clearTimeout(timer);
  }, [handResultVisible, mode, startNextHand]);

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
      getTournamentHudState: () => getTournamentHudSnapshot(),
      getTournamentPlacements: () => [...tournamentPlacements],
      isTournamentOverlayVisible: () => tournamentOverlayVisible,
      startTournamentMTT: (config) => startTournamentMTT(config),
      simulateTournamentBackground: (iterations = 1) =>
        runTournamentBackgroundSimulation(iterations),
      completeHeroHands: (hands = 1) => runHeroHandsForE2E(hands),
      forceHeroBust: () => forceHeroBustNow(),
      fastForwardMTTComplete: () => fastForwardMTTComplete(),
      getTournamentReplay: () => getStoredTournamentReplay(),
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
    tournamentHudState,
    startTournamentMTT,
    runTournamentBackgroundSimulation,
    runHeroHandsForE2E,
    forceHeroBustNow,
    fastForwardMTTComplete,
    tournamentPlacements,
    tournamentOverlayVisible,
    getStoredTournamentReplay,
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
    const deckManager = getDeckManager();
    deckManager?.reset();
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
      hand: getDeckManager()?.draw(4) ?? [],
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
    if (!gameControllerRef.current) return;
    const phaseTag = phaseTagLocal();
    gameControllerRef.current.syncExternalState({
      players: playersRef.current ?? players,
      dealerIdx,
      blindLevelIndex,
      handsInLevel,
      betHead,
      lastAggressorIdx: lastAggressor,
      currentBet,
      phase,
      drawRound,
      turn,
      betRoundIndex,
      phaseTag,
    });
  }, [
    players,
    dealerIdx,
    blindLevelIndex,
    handsInLevel,
    betHead,
    lastAggressor,
    currentBet,
    phase,
    drawRound,
    turn,
    betRoundIndex,
  ]);

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
        nextTurn: turn,
        turn,
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

    let resolvedBetHead = betHead;
    let resolvedLastAggressor = lastAggressor;
    const actedLabel = String(actedPlayer?.lastAction ?? "").toUpperCase();
    const actedAggressive =
      actedLabel.startsWith("RAISE") ||
      actedLabel.startsWith("BET") ||
      actedLabel.startsWith("ALL-IN");
    if (actedAggressive) {
      resolvedBetHead = actedIndex;
      resolvedLastAggressor = actedIndex;
      setBetHead(actedIndex);
      setLastAggressor(actedIndex);
      console.log("[BET][HEAD_DEBUG]", {
        actedIndex,
        newBetHead: actedIndex,
        lastAggressor: actedIndex,
      });
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

    const controller = ensureGameController();
    const analysis =
      controller?.advanceStreet({
        players: snap,
        actedIndex,
        dealerIdx,
        drawRound,
        betHead: resolvedBetHead,
        lastAggressorIdx: resolvedLastAggressor,
      }) ??
      analyzeBetSnapshot({
        players: snap,
        actedIndex,
        dealerIdx,
        drawRound,
        betHead: resolvedBetHead,
        lastAggressorIdx: resolvedLastAggressor,
      });
    const maxNow = analysis?.maxBet ?? maxBetThisRound(snap);
    if (currentBet !== maxNow) setCurrentBet(maxNow);

    const fallbackNext =
      typeof actedIndex === "number" ? nextAliveFrom(snap, actedIndex) : null;
    const analysisNext =
      typeof forcedNextTurn === "number"
        ? forcedNextTurn
        : typeof analysis?.nextTurn === "number"
        ? analysis.nextTurn
        : undefined;
    const nextAlive =
      typeof analysisNext === "number" ? analysisNext : fallbackNext;

    const snapshotForUi = {
      players: snap,
      pots,
      nextTurn: typeof nextAlive === "number" ? nextAlive : null,
      turn: typeof nextAlive === "number" ? nextAlive : undefined,
      metadata: {
        currentBet: maxNow,
        betHead: resolvedBetHead,
        lastAggressor: resolvedLastAggressor,
        actingPlayerIndex:
          typeof nextAlive === "number" ? nextAlive : actedIndex,
      },
    };
    console.log("[BET][SNAPSHOT_OUT]", {
      actedIndex,
      nextTurn: snapshotForUi.nextTurn,
      betHead: snapshotForUi.metadata.betHead,
    });
    syncEngineSnapshot(snapshotForUi);

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
      const resolvedNext =
        typeof forcedNextTurn === "number"
          ? forcedNextTurn
          : analysis?.nextTurn ?? nextAlive;

      console.log("[BET][ANALYSIS]", {
        shouldAdvance: analysis?.shouldAdvance,
        nextTurn: resolvedNext,
        betHead,
        maxNow,
      });

      if (analysis?.shouldAdvance) {
        if (checkIfOneLeftThenEnd(snap)) {
          debugLog("[FORCE_END] Only one active player remains -> goShowdownNow()");
          return;
        }
        scheduleFinish();
        return;
      }
      if (resolvedNext === null || typeof resolvedNext !== "number") {
        debugLog("[BET] No next alive player, forcing finish");
        scheduleFinish();
        return;
      }
      setTurn(resolvedNext);
      return;
    }

    // ------------------------
    // ------------------------
    if (phase === "DRAW") {
      const searchStart =
        typeof actedIndex === "number" ? actedIndex + 1 : turn ?? 0;
      const nextIdx = findNextDrawActorSeat(snap, searchStart);
      console.log("[TRACE][DRAW] acted=", actedIndex, 
            "nextIdx=", nextIdx, typeof nextIdx, 
            "drawRound=", drawRound);

      const actives = snap.filter((p) => !isFoldedOrOut(p));
      const allActiveDrawn = actives.every((p) => p.hasDrawn);

      if (allActiveDrawn) {
        finishDrawRound(playersRef.current ?? snap);
        return;
      }

      if (nextIdx === null) {
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

    const dm = getDeckManager();
    if (muck.length || (dm.discardPile && dm.discardPile.length)) {
      dm.recycleNow(muck);
      debugLog(`[RECYCLE] +${muck.length} cards (folded) + existing discard -> new deck=${dm.deck.length}`);
    }
  }

  function finishDrawRound(snapOpt) {
    const basePlayers = Array.isArray(snapOpt) && snapOpt.length
      ? snapOpt
      : playersRef.current ?? players;
    const snap = Array.isArray(basePlayers)
      ? basePlayers.map((p) => (p ? { ...p } : p))
      : [];
    const betRoundReady = resetBetRoundFlags(snap);
    setPlayers(betRoundReady);
    const startSeat = (dealerIdx + 1) % NUM_PLAYERS;
    debugLog("[DRAW] -> finishDrawRound", { drawRound, startSeat, snap });

    // folded flags are left untouched here; folded players remain out until a new hand.

    setPhase("BET");
    const currentDraw = Math.max(0, Math.min(Number(drawRoundTracker.current) || 0, MAX_DRAWS));
    setBetRoundValue(currentDraw);
    setLastAggressor(null);
    const nextTurn = findNextDrawActorSeat(betRoundReady, sbIndex());
    const resolvedTurn = typeof nextTurn === "number" ? nextTurn : startSeat;
    setTurn(resolvedTurn);
    setBetHead(startSeat);
  }

  /* --- actions: BET --- */
  function syncEngineSnapshot(snapshot, baseOverride = null) {
    if (!snapshot) return;
    const engineActingIndex =
      typeof snapshot?.nextTurn === "number"
        ? snapshot.nextTurn
        : typeof snapshot?.turn === "number"
        ? snapshot.turn
        : null;
    const snapshotWithTurn = {
      ...snapshot,
      nextTurn: engineActingIndex,
      turn: engineActingIndex,
      metadata: {
        ...(snapshot.metadata ?? {}),
        actingPlayerIndex: engineActingIndex,
      },
    };
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
    const merged = mergeEngineSnapshot(baseState, snapshotWithTurn);

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
      const ensuredNextState =
        typeof nextState?.nextTurn === "number" ||
        typeof nextState?.turn === "number"
          ? nextState
          : {
              ...nextState,
              nextTurn: null,
              turn: null,
            };
      syncEngineSnapshot(ensuredNextState);
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
    const controller = gameControllerRef.current;
    const result =
      controller?.resolveShowdown({
        players: updatedPlayers,
        summary,
        totalPot,
        handId: handIdRef.current,
        evaluateHand: evaluateBadugi,
      }) ??
      buildHandResultSummary({
        players: updatedPlayers,
        summary,
        totalPot,
        handId: handIdRef.current,
        evaluateHand: evaluateBadugi,
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
      nextTurn: null,
      turn: null,
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
    const nextTurnValue =
      typeof state.nextTurn === "number"
        ? state.nextTurn
        : typeof state.turn === "number"
        ? state.turn
        : null;
    syncEngineSnapshot({
      players: state.players,
      pots: state.pots,
      nextTurn: nextTurnValue,
      turn: nextTurnValue,
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

    const deckManager = getDeckManager();
    const basePlayers = playersRef.current ?? players;
    const newPlayers = basePlayers.map(clonePlayerState).filter(Boolean);
    const p = newPlayers[0]
      ? { ...newPlayers[0], hand: Array.isArray(newPlayers[0].hand) ? [...newPlayers[0].hand] : [] }
      : null;
    if (!p) return;

    const sel = heroDrawSelection.slice(0, MAX_DRAW_SELECTION);
    const stackBefore = p.stack;
    const betBefore = p.betThisRound;
    debugLog("[HERO][DRAW_REQUEST]", {
      heroSeatIndex,
      selectedIndices: sel,
      canDraw: heroCanDraw,
      phase: controlsPhase,
    });

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
    setHeroDrawSelection([]);

    const committedSnapshot = newPlayers.map(clonePlayerState).filter(Boolean);
    setDeck([]);
    setPlayerSnapshot(committedSnapshot);
    const nextHeroTurn = findNextDrawActorSeat(committedSnapshot, 1);
    syncEngineSnapshot({
      players: committedSnapshot,
      pots,
      nextTurn: nextHeroTurn ?? null,
      turn: nextHeroTurn ?? null,
      metadata: {
        currentBet,
        betHead,
        lastAggressor,
        actingPlayerIndex: nextHeroTurn ?? null,
      },
      deck: getDeckManager()?.deck,
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
        const drawFallback = findNextDrawActorSeat(players);
        if (drawFallback === null) {
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

    const nextToDraw = findNextDrawActorSeat(snap, turn);
    console.log("[DRAW][NEXT_TO_DRAW]", nextToDraw);
    if (nextToDraw === null) {
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
    const deckManager = getDeckManager();
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
    const nextDrawSeat = findNextDrawActorSeat(snap, nextToDraw + 1);
    syncEngineSnapshot({
      players: snap,
      pots,
      nextTurn: nextDrawSeat ?? null,
      turn: nextDrawSeat ?? null,
      metadata: {
        currentBet,
        betHead,
        lastAggressor,
        actingPlayerIndex: nextDrawSeat ?? null,
      },
      deck: getDeckManager()?.deck,
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

      const nextAfter = nextDrawSeat;
      if (nextAfter !== null) {
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

  const seatLayouts = useMemo(() => {
    const cashLayouts = [
      "lg:absolute lg:bottom-[6%] lg:left-1/2 lg:-translate-x-1/2 lg:w-[320px]", // Hero (BTN)
      "lg:absolute lg:bottom-[18%] lg:left-[12%] lg:w-[300px]", // SB
      "lg:absolute lg:top-[8%] lg:left-[12%] lg:w-[300px]", // BB
      "lg:absolute lg:top-[2%] lg:left-1/2 lg:-translate-x-1/2 lg:w-[300px]", // UTG
      "lg:absolute lg:top-[8%] lg:right-[12%] lg:w-[300px]", // MP
      "lg:absolute lg:bottom-[18%] lg:right-[12%] lg:w-[300px]", // CO
    ];
    // Tournament tables follow a fixed 6-max oval layout (BTN bottom-center, clockwise SB→CO).
    const tournamentLayouts = [
      "lg:absolute lg:bottom-[14%] lg:left-1/2 lg:-translate-x-1/2 lg:w-[320px]", // Hero (BTN)
      "lg:absolute lg:bottom-[28%] lg:left-[22%] lg:-translate-x-1/2 lg:w-[260px]", // SB
      "lg:absolute lg:top-[24%] lg:left-[22%] lg:-translate-x-1/2 lg:w-[260px]", // BB
      "lg:absolute lg:top-[12%] lg:left-1/2 lg:-translate-x-1/2 lg:w-[280px]", // UTG
      "lg:absolute lg:top-[24%] lg:left-[78%] lg:-translate-x-1/2 lg:w-[260px]", // MP
      "lg:absolute lg:bottom-[28%] lg:left-[78%] lg:-translate-x-1/2 lg:w-[260px]", // CO
    ];
    return mode === "tournament-mtt" ? tournamentLayouts : cashLayouts;
  }, [mode]);

  const isDrawPhase = tablePhase === "DRAW";
  const tableOuterBg = isDrawPhase ? "bg-red-900" : "bg-green-800";
  const tableSurfaceBg = isDrawPhase ? "bg-red-800" : "bg-green-700";
  const tableBorderColor = isDrawPhase ? "border-red-400" : "border-yellow-600";

  const tableSummaryProps = {
    phaseTag: hudInfo?.phaseTag ?? phaseTagLocal(),
    drawRound: hudInfo?.drawRound ?? drawRound,
    maxDraws: hudInfo?.maxDraws ?? MAX_DRAWS,
    betRoundIndex: hudInfo?.betRoundIndex ?? betRoundIndex,
    levelNumber: hudInfo?.levelNumber ?? (currentStructure.level ?? blindLevelIndex + 1),
    sbValue: hudInfo?.sbValue ?? SB,
    bbValue: hudInfo?.bbValue ?? BB,
    anteValue: hudInfo?.anteValue ?? currentAnte,
    handCount: hudInfo?.handCount ?? handsInLevelDisplay,
    handsCap: hudInfo?.handsCap ?? handsCapDisplay,
    startingStack: hudInfo?.startingStack ?? startingStack,
    showRaiseCount: (hudInfo?.phase ?? tablePhase) === "BET",
    raiseCount: raiseCountThisRound,
    dealerName:
      hudInfo?.dealerName ??
      seatViews.find((seat) => seat.seatIndex === controllerDealerIdx)?.name ??
      players[controllerDealerIdx]?.name ??
      "-",
  };
  const heroSeatView = seatViews.find((seat) => seat?.seatIndex === 0) ?? null;
  const heroPlayerForControls = heroSeatView
    ? {
        ...(players[0] ? clonePlayerState(players[0]) : {}),
        ...heroSeatView,
      }
    : players[0] ?? null;

  const controlsPhase = controlsConfig?.phase ?? tablePhase;
  const controlsCurrentBet = controlsConfig?.currentBet ?? currentBet;

  // Whether the adapter explicitly marks heroTurn
  const hasExplicitHeroTurnFlag =
    controlsConfig && typeof controlsConfig.heroTurn === "boolean";

  const heroSeatIndex =
    typeof heroSeatView?.seatIndex === "number" ? heroSeatView.seatIndex : 0;
  const heroEligible =
    heroPlayerForControls &&
    !heroPlayerForControls.folded &&
    !heroPlayerForControls.seatOut;
  const explicitHeroTurn =
    hasExplicitHeroTurnFlag && Boolean(controlsConfig.heroTurn);
  const isActionPhase =
    controlsPhase === "BET" || controlsPhase === "DRAW";

  // Hero is allowed to act during BET/DRAW when engine turn points to hero
  // (or adapter explicitly forces heroTurn) and hero is still eligible.
  const heroCanAct =
    isActionPhase &&
    heroEligible &&
    (controllerTurn === heroSeatIndex || explicitHeroTurn);

  const enginePlayersSnapshot = Array.isArray(engineState?.players)
    ? engineState.players
    : players;
  const heroEngineSeat =
    enginePlayersSnapshot &&
    typeof heroSeatIndex === "number" &&
    enginePlayersSnapshot[heroSeatIndex]
      ? enginePlayersSnapshot[heroSeatIndex]
      : null;
  const heroHasDrawn = Boolean(heroEngineSeat?.hasDrawn);
  const heroAllIn = Boolean(heroEngineSeat?.allIn);
  const heroDrawAllowedByEngine =
    controlsPhase === "DRAW" &&
    heroEligible &&
    !heroHasDrawn &&
    !heroAllIn;
  const heroCanDraw = heroCanAct && heroDrawAllowedByEngine;

  useEffect(() => {
    if (!heroCanDraw && heroDrawSelection.length > 0) {
      setHeroDrawSelection([]);
    }
  }, [heroCanDraw, heroDrawSelection.length]);

  const handleCardClick = useCallback(
    (cardIdx) => {
      if (!heroCanDraw) return;
      setHeroDrawSelection((prev) => {
        let nextSelection = prev;
        if (prev.includes(cardIdx)) {
          nextSelection = prev.filter((idx) => idx !== cardIdx);
        } else if (prev.length < MAX_DRAW_SELECTION) {
          nextSelection = [...prev, cardIdx].sort((a, b) => a - b);
        }
        return nextSelection;
      });
    },
    [heroCanDraw]
  );

  useEffect(() => {
    if (!isActionPhase) return;
    debugLog("[HERO][TURN_FLAGS]", {
      phase: controlsPhase,
      heroSeatIndex,
      controllerTurn,
      heroEligible,
      heroCanAct,
      heroDrawAllowedByEngine,
      heroHasDrawn,
      heroAllIn,
      heroName: heroPlayerForControls?.name ?? "unknown",
    });
  }, [
    isActionPhase,
    controlsPhase,
    heroSeatIndex,
    controllerTurn,
    heroEligible,
    heroCanAct,
    heroDrawAllowedByEngine,
    heroHasDrawn,
    heroAllIn,
    heroPlayerForControls?.name,
  ]);

  useEffect(() => {
    if (controlsPhase !== "BET" && controlsPhase !== "DRAW") return;
    debugLog("[TURN_SYNC]", {
      phase: controlsPhase,
      controllerTurn,
      heroSeatIndex,
      heroCanAct,
      seatFlags: seatViews.map((seat, idx) => ({
        idx,
        name: seat?.name ?? players[idx]?.name ?? `Seat ${idx}`,
        isTurn: seat?.isTurn ?? false,
      })),
    });
  }, [
    controlsPhase,
    controllerTurn,
    heroSeatIndex,
    heroCanAct,
    seatViews,
    players,
  ]);

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

  if (currentScreen === "title") {
    return <TitleScreen onEnter={handleEnterFromTitle} />;
  }

  if (currentScreen === "menu") {
    return (
      <MainMenuScreen
        language={language}
        onChangeLanguage={(nextLanguage) => {
          const next =
            nextLanguage && MGX_LOCALES[nextLanguage]
              ? nextLanguage
              : MGX_DEFAULT_LOCALE;
          setLanguage(next);
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
            } catch (err) {
              console.warn("language persistence failed", err);
            }
          }
        }}
        onSelectRing={handleSelectRing}
        onSelectTournament={handleSelectTournament}
        onSelectSettings={handleSelectSettings}
      />
    );
  }

  if (currentScreen === "settings") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
        <p className="text-xs uppercase tracking-[0.4em] text-amber-400">MGX</p>
        <h2 className="mt-2 text-4xl font-semibold">Settings (Coming Soon)</h2>
        <p className="mt-4 max-w-xl text-sm text-slate-400">
          Table themes, HUD presets, and audio layers will land here shortly. For now, return to the
          main menu to jump into your preferred mode.
        </p>
        <button
          type="button"
          onClick={handleBackToMenu}
          className="mt-8 rounded-full border border-amber-300/60 px-8 py-3 text-xs uppercase tracking-[0.4em] text-amber-100 hover:bg-amber-300/10"
        >
          Back to Menu
        </button>
      </div>
    );
  }

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
          type="button"
          onClick={handleNavigateToTitle}
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
    <main className={`flex-1 mt-20 relative ${tableOuterBg}`}>
      {!isTournament && (
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
                  players={seatViews}
                  dealerIdx={controllerDealerIdx}
                  heroIndex={0}
                  turn={controllerTurn}
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
      )}

      <div className="flex h-full w-full">
        <div className="flex-1 flex flex-col items-center">
          {tournamentHud}

          <div className="flex-1 flex w-full items-center justify-center overflow-auto pb-6">
            {/* Core game surface */}
            <div
              className={`relative w-[92%] max-w-[1400px] aspect-[16/9] ${tableSurfaceBg} border-4 ${tableBorderColor} rounded-3xl shadow-inner transition-colors duration-300 ${
                heroTableAnimating ? "table-switch-anim" : ""
              }`}
            >
              {/* Phase summary panels: cash layout keeps sidebar panels, tournament gets compact HUD */}
              {isTournament ? (
                <div className="absolute top-4 left-4 z-20 px-4 py-2 bg-black/40 rounded-xl text-xs shadow-lg backdrop-blur">
                  <TableSummaryPanel
                    {...tableSummaryProps}
                    className="text-left space-y-1"
                  />
                </div>
              ) : (
                <>
                  <TableSummaryPanel
                    {...tableSummaryProps}
                    className="lg:hidden absolute top-4 right-4 text-right bg-black/70 rounded-lg px-3 py-2 shadow-lg"
                  />
                  <TableSummaryPanel
                    {...tableSummaryProps}
                    className="hidden lg:block fixed top-28 right-8 text-right bg-black/70 rounded-lg px-4 py-3 shadow-lg z-40 w-64"
                  />
                </>
              )}

              {/* Player seats */}
              <div className="players-grid grid grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:block lg:px-0">
                {seatViews.map((seat) => {
                  const seatIndex =
                    typeof seat?.seatIndex === "number" ? seat.seatIndex : 0;
                  const basePlayer = players[seatIndex]
                    ? clonePlayerState(players[seatIndex])
                    : {};
                  const seatLabel = seat?.label ?? positionName(seatIndex);
                  const seatTestId = seatLabel === "SB" ? "seat-sb" : undefined;
                  const composedPlayer = {
                    ...basePlayer,
                    ...seat,
                    name: `${seat?.name ?? basePlayer.name ?? `Seat ${seatIndex + 1}`} (${seatLabel})`,
                  };
                  const selectedForSeat =
                    seatIndex === heroSeatIndex
                      ? heroDrawSelection
                      : Array.isArray(composedPlayer.selected)
                      ? composedPlayer.selected
                      : Array.isArray(basePlayer.selected)
                      ? basePlayer.selected
                      : [];
                  const normalizedPlayer = {
                    ...composedPlayer,
                    selected: selectedForSeat,
                  };
                  return (
                    <div
                      key={`seat-${seatIndex}`}
                      className={`mb-4 lg:mb-0 ${seatLayouts[seatIndex] ?? ""}`}
                      data-testid={seatTestId}
                    >
                      <Player
                        player={normalizedPlayer}
                        index={seatIndex}
                        selfIndex={0}
                        phase={tablePhase}
                        turn={controllerTurn}
                        dealerIdx={controllerDealerIdx}
                        onCardClick={handleCardClick}
                        positionLabel={seatLabel}
                        canSelectForDraw={
                          heroCanDraw && seatIndex === heroSeatIndex
                        }
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
          </div>
        </div>
      </div>
    </main>

    <HandResultOverlay
      visible={handResultVisible}
      summary={handResultSummary}
      onNext={startNextHand}
      buttonLabel={nextHandLabel}
    />

    {mode === "tournament-mtt" && (
      <HeroBustOverlay
        visible={heroBustOverlayVisible}
        title={heroBustSummary?.title ?? tournamentTitle}
        heroSummary={heroBustSummary?.hero}
        inMoneyPlacements={heroBustSummary?.inMoney ?? []}
        onBackToMenu={handleTournamentBackToMenu}
      />
    )}

    {mode === "tournament-mtt" && (
      <TournamentResultOverlay
        visible={tournamentOverlayVisible}
        title={tournamentTitle}
        placements={tournamentPlacements}
        onBackToMenu={handleTournamentBackToMenu}
        onPlayAgain={handleTournamentPlayAgain}
      />
    )}

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
          {heroCanAct && heroPlayerForControls ? (
            controlsPhase === "BET" ? (
              <Controls
                phase="BET"
                currentBet={controlsCurrentBet}
                player={heroPlayerForControls}
                onFold={playerFold}
                onCall={playerCall}
                onCheck={playerCheck}
                onRaise={playerRaise}
              />
            ) : controlsPhase === "DRAW" ? (
              <Controls
                phase="DRAW"
                player={heroPlayerForControls}
                onDraw={drawSelected}
                canDraw={heroCanDraw}
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








