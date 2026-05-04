// src/ui/App.jsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_SEAT_TYPES, DEFAULT_STARTING_STACK, TOURNAMENT_STRUCTURE } from "../tournament/tournamentStructure";
import { formatComment } from "./utils/commentCatalog.js";
import GameRegistry from "../games/_core/GameRegistry";
import { DEBUG_TOURNAMENT, logMTT } from "../config/debugFlags.js";
import {
  startHandHistoryRecord,
  appendHandHistoryAction,
  updateHandHistorySeat,
  finalizeHandHistoryRecord,
  resetHandHistoryRecord,
} from "./utils/handHistory";
import { buildPostMatchFollowUpSummary } from "../games/badugi/analysis/followUpAnalyzer.js";

import {
  nextAliveFrom,
  maxBetThisRound,
  isFoldedOrOut,
  markPlayerFolded,
  isPlayerSeated,
  applyChips,
  queueForcedSeatAction as queueForcedSeatActionMap,
  forceSequentialFolds as forceSequentialFoldsMap,
  forceAllInAction as forceAllInActionMap,
  firstBetterAfterBlinds,
  findNextActiveSeat,
  findNextDrawActorSeat as findNextDrawActorSeatHelper,
} from "../games/badugi/flow/actionUtils.js";
import {
  settleStreetToPots,
  buildSidePots,
  finishBetRoundFrom,
  resetBetRoundFlags,
  transitionToBetPhase,
  transitionToDrawPhase,
  transitionToShowdownPhase,
} from "../games/badugi/engine/roundFlow.jsx";
import {
  analyzeBetSnapshot,
  findNextBetActorSeat,
  needsActionForBet,
} from "../games/badugi/flow/betRoundUtils.js";
import BadugiGameController from "../games/badugi/BadugiGameController.js";
import NLHGameController from "../games/nlh/NLHGameController.js";
import { GAME_VARIANTS } from "../games/core/variants.js";
import {
  buildHandResultSummary,
} from "../games/badugi/flow/handResultUtils.js";
import { getGameUIAdapter } from "./game/GameUIAdapterRegistry.js";
import { ensureBadugiUIAdapterRegistered } from "./game/badugi/registerBadugiUIAdapter.js";
import { ensureNLHUIAdapterRegistered } from "./game/nlh/registerNLHUIAdapter.js";
import { ensureDrawLowballUIAdaptersRegistered } from "./game/draw/registerDrawLowballUIAdapters.js";
import { shouldWaitForHeroDrawTurn } from "./game/drawActorUtils.js";
import {
  APP_VARIANT_IDS,
  isControllerBackedAppVariant,
  isDrawLowballAppVariant,
  normalizeAppVariantId,
} from "./game/appVariantRouting.js";
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
  installHumanBenchmarkLogDevTools,
  saveRLHandHistory,
} from "../utils/history_rl";
import { useLocation, useNavigate } from "react-router-dom";
import { loadTitleSettings } from "./utils/titleSettings";
import { useRatingState } from "./hooks/useRatingState.js";
import { summarizeAiDecisionLog } from "./utils/aiDecisionLog.js";
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
import { selectModelForVariant } from "../ai/modelRouter.js";
import { getCpuCharacterForIndex, getCpuDisplayName } from "../ai/cpuRoster.js";
import {
  buildAiContext,
  computeBetDecision,
  computeDrawDecision,
} from "../ai/policyRouter.js";
import { useGameEngine } from "./engine/useGameEngine";
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
import { initializeButtonForFirstHand, nextAliveSeat } from "./utils/buttonSeatUtils.js";
import TournamentHUD from "./components/TournamentHUD.jsx";
import TitleScreen from "./screens/TitleScreen.jsx";
import MainMenuScreen from "./screens/MainMenuScreen.jsx";
import GameScreen from "./screens/GameScreen.jsx";
import AuthScreen from "./screens/AuthScreen.jsx";
import HandHistoryScreen from "./screens/HandHistoryScreen.jsx";
import ReplayScreen from "./screens/ReplayScreen.jsx";
import GameSelectorScreen from "./screens/GameSelectorScreen.jsx";
import TitleSettingsScreen from "./screens/TitleSettingsScreen.jsx";
import ProfileStats from "../components/ProfileStats.jsx";
import { useGameSessionState } from "./hooks/useGameSessionState.js";
import { mergeSeatViewsForDisplay } from "./utils/seatViewMerge.js";
import { getPositionNameForSeat } from "./utils/positionLabels.js";
import MobileOrientationGate from "./components/MobileOrientationGate.jsx";
import { useDeviceProfile } from "./hooks/useDeviceProfile.js";
import { useDesktopCanvasScale } from "./hooks/useDesktopCanvasScale.js";
import { computeSeatStats } from "./utils/stats.js";
import { AuthProvider } from "./state/authStore.jsx";
import { useAuth } from "./state/useAuth.js";
import {
  findHandHistoryById,
  getCurrentHandHistorySnapshot,
  getHandHistoryBufferSnapshot,
  setHandHistoryAccessors,
} from "./state/handHistoryStore.js";
import {
  enqueueBadugiActions,
  enqueueHandRecord,
  fetchSeatStats,
  startAutoSync,
} from "./utils/syncManager.js";
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
import { assertNoDuplicateCards } from "../games/badugi/utils/deck.js";
import { dealInitialHands, validatePreflopState } from "../games/badugi/utils/deckHelpers.js";

function cloneHandHistory(value) {
  if (value == null) return null;
  try {
    const cloned = JSON.parse(JSON.stringify(value));
    if (process.env.NODE_ENV !== "production" && cloned && typeof cloned === "object") {
      Object.freeze(cloned);
    }
    return cloned;
  } catch (error) {
    console.warn("Failed to clone hand history snapshot", error);
    return null;
  }
}

const DEFAULT_GAME_ID = "D03";
const DEFAULT_GAME_VARIANT = "badugi";
const DEFAULT_AI_TIER_ID = "pro";
const DESKTOP_CANVAS_BASE_WIDTH = 1600;
const DESKTOP_CANVAS_BASE_HEIGHT = 900;
const HERO_TOURNAMENT_PLAYER_ID = "hero-player";
function getPositionName(index, dealer, players = []) {
  return getPositionNameForSeat(index, dealer, players);
}
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

function normalizeTournamentBlindLevel(level = {}, index = 0) {
  const levelNumber = level.level ?? level.levelIndex ?? index + 1;
  return {
    level: levelNumber,
    levelIndex: levelNumber,
    sb: level.sb ?? level.smallBlind ?? 0,
    bb: level.bb ?? level.bigBlind ?? 0,
    ante: level.ante ?? 0,
    hands: level.hands ?? level.handsThisLevel ?? 999,
    handsThisLevel: level.handsThisLevel ?? level.hands ?? 999,
  };
}

function getBlindStructureForTournamentConfig(config) {
  const levels = Array.isArray(config?.levels) ? config.levels : [];
  if (!levels.length) return TOURNAMENT_STRUCTURE;
  return levels.map((level, index) => normalizeTournamentBlindLevel(level, index));
}

const API_BASE_RAW = import.meta.env?.VITE_API_BASE ?? "/api";
const API_BASE = API_BASE_RAW.endsWith("/api")
  ? API_BASE_RAW
  : `${API_BASE_RAW.replace(/\/$/, "")}/api`;

function getRequestedVariantIdFromURL() {
  if (typeof window === "undefined") return DEFAULT_GAME_VARIANT;
  try {
    const params = new URLSearchParams(window.location.search);
    const variant = params.get("variant");
    const normalized = normalizeAppVariantId(variant, null);
    if (normalized) {
      return normalized;
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

function readDebugMetrics() {
  if (typeof window === "undefined") {
    return {
      href: "",
      innerWidth: 0,
      innerHeight: 0,
      visualViewportWidth: null,
      visualViewportHeight: null,
      rootChildCount: 0,
    };
  }
  const vv = window.visualViewport;
  const root = document.getElementById("root");
  return {
    href: window.location.href,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    visualViewportWidth: vv ? Math.round(vv.width) : null,
    visualViewportHeight: vv ? Math.round(vv.height) : null,
    rootChildCount: root?.children?.length ?? 0,
  };
}


function formatHandIdentifier({
  tableId,
  handNumber,
  dealerSeat,
  timestamp = Date.now(),
}) {
  const tableSegment =
    typeof tableId === "string" && tableId.trim().length
      ? tableId.trim().replace(/\s+/g, "-")
      : "table";
  const sequenceSegment =
    Number.isFinite(handNumber) && handNumber >= 0 ? `h${handNumber}` : `h${timestamp}`;
  const dealerSegment =
    Number.isFinite(dealerSeat) && dealerSeat >= 0 ? `d${dealerSeat}` : "dX";
  return `${tableSegment}-${sequenceSegment}-${dealerSegment}-${timestamp.toString(36)}`;
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
  const authUserIdRef = useRef(null);
  const [authUserId, setAuthUserId] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [authTokenType, setAuthTokenType] = useState(null);
  const [mode, setMode] = useState(initialModeRef.current);
  const [language, setLanguage] = useState(() => getInitialLanguage());
  // MGX branding: kitsune title screen + title → menu → game flow (2025-11-28)
  const [currentScreen, setCurrentScreen] = useState("title");
  const [gameUtilityModal, setGameUtilityModal] = useState(null);
  const pendingRingStartRef = useRef(false);
  const [debugScale, setDebugScale] = useState(null);
  const [authIsAuthenticated, setAuthIsAuthenticated] = useState(null);
  const [replayHandId, setReplayHandId] = useState(null);
  const [replayTarget, setReplayTarget] = useState(null);
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
  const [tournamentBlindStructure, setTournamentBlindStructure] = useState(() =>
    getBlindStructureForTournamentConfig(DEFAULT_STORE_TOURNAMENT_CONFIG),
  );
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
  const isDev = import.meta.env?.DEV;
  const debugFlags = useMemo(() => {
    if (!isDev) {
      return {
        enabled: false,
        noscale: false,
        nofixed: false,
        novh: false,
      };
    }
    const params = new URLSearchParams(location.search ?? "");
    return {
      enabled: params.get("debug") === "1",
      noscale: params.get("noscale") === "1",
      nofixed: params.get("nofixed") === "1",
      novh: params.get("novh") === "1",
    };
  }, [isDev, location.search]);
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
  const buildPlayersFromSeatTypes = useCallback(
    (seatConfig, stackValue = DEFAULT_STARTING_STACK, profile = heroProfile) =>
      seatConfig.map((seatType, idx) => {
        const isHuman = seatType === "HUMAN";
        const isEmpty = seatType === "EMPTY";
        const heroName = profile?.name ?? "You";
        const heroPlayerId =
          authUserIdRef.current != null
            ? `user-${authUserIdRef.current}`
            : "hero";
        const playerId = isHuman
          ? heroPlayerId
          : isEmpty
          ? `empty-${idx}`
          : `cpu-${idx + 1}`;
        const cpuCharacter = !isHuman && !isEmpty ? getCpuCharacterForIndex(idx) : null;
        return {
          playerId,
          name: isHuman ? heroName : getCpuDisplayName(idx),
          cpuCharacterId: cpuCharacter?.id ?? null,
          cpuStyle: cpuCharacter?.style ?? null,
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
          avatarUrl: isHuman ? null : cpuCharacter?.avatarUrl ?? null,
          tournamentPlayerId: null,
          tournamentSeatIndex: null,
        };
      }),
    [heroProfile],
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
  const activeBlindStructure = useMemo(() => {
    if (!isTournament) return TOURNAMENT_STRUCTURE;
    return tournamentBlindStructure;
  }, [isTournament, tournamentBlindStructure]);
  const lastStructureIndex = Math.max(0, activeBlindStructure.length - 1);
  const currentStructure =
    activeBlindStructure[blindLevelIndex] ??
    activeBlindStructure[lastStructureIndex] ??
    TOURNAMENT_STRUCTURE[0];
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
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const [drawRound, setDrawRound] = useState(0);
  const [betRoundIndex, setBetRoundIndex] = useState(0);
  const drawRoundTracker = useRef(drawRound);
  const betRoundTracker = useRef(betRoundIndex);
  const drawRoundLogCounter = useRef(1);
  const handCountRef = useRef(0);
  const tableMetadataRef = useRef({});
  const [turn, setTurn] = useState(0);
  const MAX_DRAWS = 3;
const MAX_DRAW_SELECTION = 4;
const SAFE_RESET_PHASE = "IDLE";
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
  const [pots, setPots] = useState([]);
  const potsRef = useRef(pots);
  useEffect(() => {
    potsRef.current = pots;
  }, [pots]);
  // Track raise counts per street (table + seat granularity).
  const [raisePerRound, setRaisePerRound] = useState([0, 0, 0, 0]);
  const [raisePerSeatRound, setRaisePerSeatRound] = useState(
    () => Array(NUM_PLAYERS).fill(0).map(() => [0, 0, 0, 0]) // [seat][round]
  );
  const [raiseCountThisRound, setRaiseCountThisRound] = useState(0);
  const [actionLog, setActionLog] = useState([]); // RL/action log feed
  const seatStatsByPlayerId = useMemo(
    () => computeSeatStats(actionLog, { keyBy: "playerId" }),
    [actionLog],
  );
  const aiDecisionSummary = useMemo(
    () => summarizeAiDecisionLog(actionLog, { limit: 5 }),
    [actionLog],
  );
  const [remoteSeatStatsByPlayerId, setRemoteSeatStatsByPlayerId] = useState({});
  const mergedSeatStatsByPlayerId = useMemo(
    () => ({
      ...seatStatsByPlayerId,
      ...remoteSeatStatsByPlayerId,
    }),
    [seatStatsByPlayerId, remoteSeatStatsByPlayerId],
  );
  const resetInitialButtonState = useCallback(() => {
    handCountRef.current = 0;
    tableMetadataRef.current = {};
  }, []);
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
  const controllerSnapshot = (() => {
    const controller = gameControllerRef.current;
    if (!controller) return null;
    try {
      if (typeof controller.getSnapshot === "function") {
        return controller.getSnapshot();
      }
      if (typeof controller.getUiSnapshot === "function") {
        return controller.getUiSnapshot();
      }
      return null;
    } catch (err) {
      console.warn("[UI-ADAPTER] controller snapshot failed", err);
      return null;
    }
  })();
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

  const {
    session: gameSession,
    resetForNewHand,
    resetForNewHandFromSnapshot,
    updateAfterAction,
    updateAfterActionFromSnapshot,
    updateShowdown,
  } = useGameSessionState();
  const updateShowdownRef = useRef(() => {});
  updateShowdownRef.current = updateShowdown;
  const deviceProfile = useDeviceProfile();

  const uiFromSession = useMemo(() => {
    if (!gameSession) return null;
    return {
      handId: gameSession.handId,
      dealerSeat: gameSession.dealerSeat,
      heroSeat: gameSession.heroSeat,
      players: gameSession.players,
      pots: gameSession.pots,
      phase: gameSession.phase,
      drawRound: gameSession.drawRound,
      betRoundIndex: gameSession.betRoundIndex,
      turnSeat: gameSession.turnSeat,
      betHead: gameSession.betHead,
      lastAggressor: gameSession.lastAggressor,
      currentBet: gameSession.currentBet,
      raiseStats: gameSession.raiseStats,
      heroDrawSelection: gameSession.heroDrawSelection,
      actionLog: gameSession.actionLog,
      overlays: gameSession.overlays,
      tableMeta: gameSession.tableMeta,
      debug: gameSession.debug,
    };
  }, [gameSession]);

  const sessionControllerRef = useRef(null);
  const sessionControllerStateRef = useRef(null);

  const ensureSessionController = useCallback(() => {
    const normalizedVariant = normalizeAppVariantId(gameVariant);
    if (mode === "tournament-mtt" || !isControllerBackedAppVariant(normalizedVariant)) {
      sessionControllerRef.current = null;
      sessionControllerStateRef.current = null;
      return null;
    }
    if (
      !sessionControllerRef.current ||
      sessionControllerRef.current.__appVariantId !== normalizedVariant
    ) {
      const seatBlueprint = Array.isArray(seatConfigRef.current)
        ? [...seatConfigRef.current]
        : [...DEFAULT_SEAT_TYPES];
      const controllerConfig = {
        numSeats: NUM_PLAYERS,
        seatConfig: seatBlueprint,
        startingStack: startingStackRef.current ?? DEFAULT_STARTING_STACK,
        heroProfile,
        blindStructure: activeBlindStructure,
        lastStructureIndex,
        structure: { sb: SB, bb: BB, ante: currentAnte },
      };
      const controllerFactory =
        normalizedVariant === APP_VARIANT_IDS.BADUGI
          ? GAME_VARIANTS.badugi.controllerFactory
          : GAME_VARIANTS[normalizedVariant]?.controllerFactory;
      if (typeof controllerFactory !== "function") {
        sessionControllerRef.current = null;
        sessionControllerStateRef.current = null;
        return null;
      }
      sessionControllerRef.current = controllerFactory(controllerConfig);
      sessionControllerRef.current.__appVariantId = normalizedVariant;
      sessionControllerStateRef.current =
        sessionControllerRef.current.createInitialState({
          seatConfig: seatBlueprint,
          structure: { sb: SB, bb: BB, ante: currentAnte },
        });
    }
    return sessionControllerRef.current;
  }, [SB, BB, activeBlindStructure, currentAnte, gameVariant, heroProfile, lastStructureIndex, mode]);

  const syncSessionFromSnapshot = useCallback(
    (snapshot, context = null, { reason = "action" } = {}) => {
      if (mode === "tournament-mtt" || !snapshot) return null;
      const controller = ensureSessionController();
      if (!controller) return null;
      const nextHandIndex =
        reason === "new-hand"
          ? (sessionControllerStateRef.current?.handIndex ?? 0) + 1
          : sessionControllerStateRef.current?.handIndex ?? 0;
      try {
        const nextState = controller.syncFromExternalState({
          snapshot,
          context,
          handIndex: nextHandIndex,
        });
        if (nextState) {
          sessionControllerStateRef.current = nextState;
          return controller.getUiSnapshot(nextState);
        }
      } catch (error) {
        console.warn("[SESSION_CONTROLLER] sync failed", error);
      }
      return null;
    },
    [ensureSessionController, mode],
  );

  useEffect(() => {
    if (mode === "tournament-mtt") {
      sessionControllerRef.current = null;
      sessionControllerStateRef.current = null;
      return;
    }
    ensureSessionController();
  }, [ensureSessionController, mode]);

  const sessionSnapshot = !isTournament && uiFromSession ? uiFromSession : null;
  const playersSrc = sessionSnapshot?.players ?? players;
  const potsSrc = sessionSnapshot?.pots ?? pots;
  const phaseSrc = sessionSnapshot?.phase ?? phase;
  const drawRoundSrc = sessionSnapshot?.drawRound ?? drawRound;
  const betRoundIndexSrc = sessionSnapshot?.betRoundIndex ?? betRoundIndex;
  const turnSeatSrc = sessionSnapshot?.turnSeat ?? turn;
  const betHeadSrc = sessionSnapshot?.betHead ?? betHead;
  const lastAggressorSrc = sessionSnapshot?.lastAggressor ?? lastAggressor;
  const currentBetSrc = sessionSnapshot?.currentBet ?? currentBet;
  const dealerSeatSrc = sessionSnapshot?.dealerSeat ?? dealerIdx;
  const raiseStatsSrc = sessionSnapshot?.raiseStats ?? {
    raiseCountThisRound,
    raisePerRound,
    raisePerSeatRound,
  };

  const tablePhase = adapterViewProps?.tablePhase ?? phaseSrc;
  const isTableActionPhase =
    tablePhase === "BET" || tablePhase === "DRAW";
  const safeEngineState = engineState ?? {};
  const snapshotTurn =
    typeof turnSeatSrc === "number"
      ? turnSeatSrc
      : typeof safeEngineState?.metadata?.actingPlayerIndex === "number"
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

  const normalizedGameVariant = normalizeAppVariantId(gameVariant);
  const isSingleTableBadugi =
    mode !== "tournament-mtt" && normalizedGameVariant === APP_VARIANT_IDS.BADUGI;
  const isSingleTableDrawLowball =
    mode !== "tournament-mtt" && isDrawLowballAppVariant(normalizedGameVariant);
  const isControllerDrivenSingleTable =
    isSingleTableBadugi || isSingleTableDrawLowball;
  const isMobileDevice = deviceProfile.isMobile;
  const layoutMode = isMobileDevice ? "mobile" : "desktop";
  const shouldUseDesktopCanvasScale = false;
  const desktopCanvasScale = useDesktopCanvasScale({
    enabled: shouldUseDesktopCanvasScale,
    baseWidth: DESKTOP_CANVAS_BASE_WIDTH,
    baseHeight: DESKTOP_CANVAS_BASE_HEIGHT,
  });
  const shouldGateOrientation = isMobileDevice;
  useEffect(() => {
    if (!shouldUseDesktopCanvasScale) {
      setDebugScale(1);
      return;
    }
    setDebugScale(desktopCanvasScale.scale);
  }, [shouldUseDesktopCanvasScale, desktopCanvasScale.scale]);
  const screenLabel = useMemo(() => {
    if (authIsAuthenticated === false) return "Auth";
    if (currentScreen === "title") return "Title";
    if (currentScreen === "menu") return "Menu";
    if (currentScreen === "settings") return "Settings";
    if (currentScreen === "handHistory") return "HandHistory";
    if (currentScreen === "handReplay") return "Replay";
    return "Game";
  }, [authIsAuthenticated, currentScreen]);

  const tryControllerBetAction = useCallback(
    ({ actionType, amount = 0, seatIndex = 0, metadata = {} }) => {
      if (!isControllerDrivenSingleTable) return null;
      const controller = sessionControllerRef.current;
      const controllerState = sessionControllerStateRef.current;
      if (!controller || !controllerState) return null;
      try {
        const normalizedType =
          typeof actionType === "string" && actionType.length
            ? actionType.toLowerCase()
            : "call";
        const sanitizedMetadata = { ...(metadata ?? {}) };
        delete sanitizedMetadata.raiseCap;
        delete sanitizedMetadata.raiseCountThisRound;
        const actionPayload = {
          seatIndex,
          payload: {
            type: normalizedType.toUpperCase() === "DRAW" ? "DRAW" : normalizedType,
            amount,
            ...sanitizedMetadata,
          },
        };
        const result = controller.applyAction(controllerState, actionPayload);
        if (!result || !result.state) {
          return null;
        }
        const events = Array.isArray(result.events) ? result.events : [];
        const rejectionEvent = events.find(
          (event) => event?.type === "invalidAction" || event?.type === "error",
        );
        if (rejectionEvent) {
          return {
            rejected: true,
            code:
              rejectionEvent?.code ??
              result?.code ??
              null,
            message:
              rejectionEvent?.error ??
              rejectionEvent?.message ??
              "action rejected",
            events,
          };
        }
        sessionControllerStateRef.current = result.state;
        const snapshot = controller.getUiSnapshot(result.state);
        if (snapshot) {
          updateAfterActionFromSnapshot(snapshot);
        }
        return {
          snapshot,
          events,
        };
      } catch (error) {
        console.warn("[CTRL][BET] applyAction failed", error);
        return null;
      }
    },
    [isControllerDrivenSingleTable, updateAfterActionFromSnapshot],
  );

  const seatPlayerIds = useMemo(() => {
    return (playersSrc ?? [])
      .map((player, idx) => {
        if (!player) return null;
        if (String(player.seatType ?? "").toUpperCase() === "EMPTY") return null;
        const playerId =
          player?.playerId ??
          player?.tournamentPlayerId ??
          (idx === 0 && authUserId != null ? `user-${authUserId}` : `seat-${idx}`);
        return playerId;
      })
      .filter(Boolean);
  }, [authUserId, playersSrc]);

  const refreshSeatStats = useCallback(async () => {
    if (!authToken) return;
    const ids = [...new Set(seatPlayerIds.filter(Boolean))];
    if (!ids.length) return;
    const results = await Promise.all(
      ids.map((playerId) =>
        fetchSeatStats({
          playerId,
          accessToken: authToken,
          tokenType: authTokenType,
          limitHands: 200,
        }),
      ),
    );
    const next = {};
    results.forEach((payload) => {
      if (payload?.player_id) {
        next[payload.player_id] = payload;
      }
    });
    if (Object.keys(next).length > 0) {
      setRemoteSeatStatsByPlayerId((prev) => ({
        ...prev,
        ...next,
      }));
    }
  }, [authToken, authTokenType, seatPlayerIds]);

  useEffect(() => {
    if (!authToken) return undefined;
    let active = true;
    refreshSeatStats().catch((err) => {
      if (active) console.warn("[stats] fetch failed", err);
    });
    const interval = window.setInterval(() => {
      refreshSeatStats().catch((err) => {
        if (active) console.warn("[stats] periodic fetch failed", err);
      });
    }, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [authToken, refreshSeatStats]);

  const seatViews = useMemo(() => {
    const seatCount = playersSrc.length || NUM_PLAYERS;

    // まずは常に「players ベースの seat 情報」を組み立てる
    const baseSeats = playersSrc.map((player, idx) => {
      const clone = player ? clonePlayerState(player) : {};
      const playerId =
        clone?.playerId ??
        clone?.tournamentPlayerId ??
        (idx === 0 && authUserId != null
          ? `user-${authUserId}`
          : `seat-${idx}`);
      const stats =
        mergedSeatStatsByPlayerId[playerId] ?? mergedSeatStatsByPlayerId[`seat-${idx}`];
      const avatarUrl = clone?.avatarUrl ?? null;
      const avatar = clone?.avatar ?? avatarUrl ?? "default_avatar";
      return {
        ...clone,
        playerId,
        stats,
        avatar,
        avatarUrl,
        seatIndex: idx,
        label: getPositionName(idx, dealerSeatSrc, playersSrc),
        isDealer: idx === dealerSeatSrc,
        isSB: seatCount ? idx === ((dealerSeatSrc + 1) % seatCount) : false,
        isBB: seatCount ? idx === ((dealerSeatSrc + 2) % seatCount) : false,
        isHero: idx === 0,
        isTurn: false,
      };
    });

    const normalized = mergeSeatViewsForDisplay({
      baseSeats,
      adapterSeatViews: adapterViewProps?.seatViews ?? [],
      phase,
    });
    return normalized.map((seat, idx) => ({
      ...seat,
      isTurn: isTableActionPhase && idx === controllerTurn,
    }));
  }, [
    adapterViewProps?.seatViews,
    playersSrc,
    dealerSeatSrc,
    controllerTurn,
    isTableActionPhase,
    authUserId,
    mergedSeatStatsByPlayerId,
    phase,
  ]);

  const seatLabels = useMemo(
    () =>
      seatViews.map((seat, idx) =>
        seat?.label ??
          getPositionName(
            typeof seat?.seatIndex === "number" ? seat.seatIndex : idx,
            dealerSeatSrc,
            seatViews,
          )
      ),
    [seatViews, dealerSeatSrc]
  );
  const hudInfo = adapterViewProps?.hudInfo ?? null;
  const controlsConfig = adapterViewProps?.controlsConfig ?? null;
  const controllerDealerIdx = controllerSnapshot?.dealerIdx ?? dealerIdx;
  const liveTournamentHudState = useMemo(() => {
    if (!isTournament || !tournamentHudState) return tournamentHudState;
    const state = tournamentStateRef.current;
    if (!state?.players || !Array.isArray(playersSrc)) return tournamentHudState;
    const pendingBustedIds = new Set(
      playersSrc
        .filter(
          (player) =>
            player?.tournamentPlayerId &&
            (player.seatOut || player.isBusted || Math.max(0, Number(player.stack) || 0) <= 0),
        )
        .map((player) => player.tournamentPlayerId),
    );
    if (!pendingBustedIds.size) return tournamentHudState;
    const alreadyBusted = new Set(
      Object.values(state.players)
        .filter((player) => player?.busted)
        .map((player) => player.id),
    );
    const pendingCount = [...pendingBustedIds].filter((id) => !alreadyBusted.has(id)).length;
    if (pendingCount <= 0) return tournamentHudState;
    const playersRemaining = Math.max(0, Number(tournamentHudState.playersRemaining) - pendingCount);
    const totalEntrants =
      tournamentHudState.totalEntrants ?? tournamentHudState.totalPlayers ?? state.totalPlayers ?? 0;
    const liveStacksById = new Map(
      playersSrc
        .filter((player) => player?.tournamentPlayerId)
        .map((player) => [player.tournamentPlayerId, Math.max(0, Number(player.stack) || 0)]),
    );
    const totalChipsInPlay = Object.values(state.players).reduce((sum, player) => {
      if (!player || player.busted || pendingBustedIds.has(player.id)) return sum;
      return sum + (liveStacksById.get(player.id) ?? Math.max(0, Number(player.stack) || 0));
    }, 0);
    const averageStack = playersRemaining > 0 ? Math.floor(totalChipsInPlay / playersRemaining) : null;
    return {
      ...tournamentHudState,
      playersRemaining,
      playersRemainingText: `Players Remaining: ${playersRemaining} / ${totalEntrants}`,
      averageStack,
    };
  }, [isTournament, playersSrc, tournamentHudState]);
  const tournamentHud =
    isTournament && liveTournamentHudState ? (
      <TournamentHUD {...liveTournamentHudState} compact placement="side" />
    ) : null;
  const [uiPerf, setUiPerf] = useState({
    loadTime: null,
    lastInteractionDuration: null,
    lastInteractionLabel: "",
  });
  const [locale] = useState(() => {
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

  const persistHeroTrackerState = useCallback((state) => {
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
  }, []);

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
  }, [heroTracker, persistHeroTrackerState]);
  useEffect(() => {
    installHumanBenchmarkLogDevTools();
  }, []);
  const [handResultSummary, setHandResultSummary] = useState(null);
  const [handResultVisible, setHandResultVisible] = useState(false);
  const [cashOutSummary, setCashOutSummary] = useState(null);
  const [devTierOverride, setDevTierOverride] = useState(() => loadAiTierOverride());
  const activeAiTierConfig = useMemo(
    () => getTierById(devTierOverride ?? DEFAULT_AI_TIER_ID),
    [devTierOverride],
  );
  const aiDecisionContext = useMemo(
    () =>
      buildAiContext({
        variantId: normalizedGameVariant,
        tierConfig: activeAiTierConfig,
        opponentStats: {},
      }),
    [activeAiTierConfig, normalizedGameVariant],
  );
  const [p2pCaptureEnabled, setP2pCaptureEnabled] = useState(() => loadP2pCaptureFlag());
  const tierOptions = useMemo(
    () =>
      listTierIds().map((tierId) => ({
        id: tierId,
        label: getTierById(tierId)?.label ?? tierId,
      })),
    []
  );

  const deckRef = useRef(null);

  useEffect(() => {
    if (engine?.getDeckManager) {
      const shared = engine.getDeckManager();
      if (shared) {
        deckRef.current = shared;
      }
      return;
    }
    if (!deckRef.current && gameDefinition?.createDeck) {
      deckRef.current = gameDefinition.createDeck();
    }
  }, [engine, gameDefinition]);

  const getDeckManager = useCallback(() => {
    if (engine?.getDeckManager) {
      const shared = engine.getDeckManager();
      if (shared && deckRef.current !== shared) {
        deckRef.current = shared;
      }
      return shared;
    }
    if (!deckRef.current && gameDefinition?.createDeck) {
      deckRef.current = gameDefinition.createDeck();
    }
    return deckRef.current;
  }, [engine, gameDefinition]);

  const buildSeatCardBuckets = useCallback((snapshot) => {
    const buckets = {};
    (snapshot ?? []).forEach((player, idx) => {
      buckets[`seat${idx}`] = player?.hand ?? [];
    });
    return buckets;
  }, []);

  const getDeckSnapshot = useCallback(() => {
    const deckManager = getDeckManager();
    if (deckManager && typeof deckManager.getState === "function") {
      const state = deckManager.getState();
      return {
        deck: state.deck ?? [],
        discard: state.discardPile ?? [],
        burn: state.burnPile ?? [],
      };
    }
    return { deck: [], discard: [], burn: [] };
  }, [getDeckManager]);

  const applyDeckSnapshot = useCallback(
    (payload = {}) => {
      const { deck, discard, burn } = getDeckSnapshot();
      return {
        ...payload,
        deck,
        discard,
        burn,
      };
    },
    [getDeckSnapshot]
  );

  const warnLegacySingleTablePath = (reason) => {
    if (process.env.NODE_ENV === "production") return;
    console.warn("[LEGACY][SINGLE-TABLE] Fallback path:", reason);
  };

  const syncLegacyFromControllerSnapshot = (
    snapshot,
    { seatIndex = null, scheduleAfterBet = false } = {},
  ) => {
    if (!snapshot || !Array.isArray(snapshot.players)) return null;
    const normalizedPlayers = setPlayerSnapshot(snapshot.players ?? []);
    const snapshotNextTurn =
      typeof snapshot.turn === "number"
        ? snapshot.turn
        : typeof snapshot.nextTurn === "number"
        ? snapshot.nextTurn
        : typeof snapshot?.metadata?.actingPlayerIndex === "number"
        ? snapshot.metadata.actingPlayerIndex
        : null;
    const resolvedCurrentBet =
      typeof snapshot.currentBet === "number"
        ? snapshot.currentBet
        : snapshot.metadata?.currentBet ?? currentBet;
    const resolvedBetHead =
      snapshot.betHead ?? snapshot.metadata?.betHead ?? betHead;
    const resolvedLastAggressor =
      snapshot.lastAggressor ?? snapshot.metadata?.lastAggressor ?? lastAggressor;
    const engineSnapshot = applyDeckSnapshot({
      ...snapshot,
      players: normalizedPlayers,
      nextTurn: snapshotNextTurn,
      turn: snapshotNextTurn,
      metadata: {
        ...(snapshot.metadata ?? {}),
        currentBet: resolvedCurrentBet,
        betHead: resolvedBetHead,
        lastAggressor: resolvedLastAggressor,
        actingPlayerIndex: snapshotNextTurn,
      },
    });
    syncEngineSnapshot(engineSnapshot);
    if (!isSingleTableBadugi) {
      setPots(Array.isArray(snapshot.pots) ? snapshot.pots.map((pot) => ({ ...pot })) : []);
      setCurrentBet(resolvedCurrentBet ?? 0);
      setBetHead(resolvedBetHead ?? null);
      setLastAggressor(resolvedLastAggressor ?? null);
      setTurn(snapshotNextTurn);
      const drawResultSummary = snapshot.lastHandResult ?? null;
      if (drawResultSummary) {
        if (!handSavedRef.current) {
          finishHand({
            playersSnapshot: normalizedPlayers,
            summary:
              snapshot.metadata?.showdownSummary ??
              drawResultSummary.results ??
              [],
            totalPot:
              snapshot.metadata?.showdownTotal ??
              drawResultSummary.pot ??
              0,
            precomputedResult: drawResultSummary,
          });
        } else {
          setHandResultSummary(drawResultSummary);
          setHandResultVisible(true);
          setShowNextButton(true);
          setPhase("HAND_RESULT");
          updateShowdown({
            phase: "SHOWDOWN",
            players: normalizedPlayers,
            pots: Array.isArray(snapshot.pots) ? snapshot.pots : [],
            handResultVisible: true,
            handResultSummary: drawResultSummary,
            showNextButton: true,
          });
        }
      } else if (snapshot.phase) {
        setPhase(snapshot.phase);
      }
      if (Number.isFinite(snapshot.drawRound ?? snapshot.drawRoundIndex)) {
        const nextDrawRound = snapshot.drawRound ?? snapshot.drawRoundIndex;
        setDrawRoundValue(nextDrawRound);
        setBetRoundValue(snapshot.betRoundIndex ?? nextDrawRound);
      }
      updateAfterActionFromSnapshot(engineSnapshot);
      return { normalizedPlayers, engineSnapshot, nextTurn: snapshotNextTurn };
    }
    if (typeof seatIndex === "number") {
      const clonedForAfterBet = normalizedPlayers.map(clonePlayerState).filter(Boolean);
      if (scheduleAfterBet) {
        setTimeout(() => afterBetActionWithSnapshot(clonedForAfterBet, seatIndex), 0);
      } else {
        afterBetActionWithSnapshot(clonedForAfterBet, seatIndex);
      }
    }
    return { normalizedPlayers, engineSnapshot, nextTurn: snapshotNextTurn };
  };

  const collectActiveCards = useCallback((snapshot) => {
    const cards = [];
    (snapshot ?? []).forEach((player) => {
      if (Array.isArray(player?.hand) && player.hand.length) {
        cards.push(...player.hand);
      }
    });
    return cards;
  }, []);

  const snapshotSeatHands = useCallback((snapshotPlayers) => {
    const source = Array.isArray(snapshotPlayers) ? snapshotPlayers : [];
    return source.map((player) =>
      Array.isArray(player?.hand) ? [...player.hand] : [],
    );
  }, []);

  const verifyDeckIntegrityOrThrow = useCallback(
    (contextLabel, seatSnapshot = null) => {
      const deckManager = getDeckManager();
      if (!deckManager || typeof deckManager.getState !== "function") return;
      const state = deckManager.getState();
      const seats = Array.isArray(seatSnapshot)
        ? seatSnapshot
        : playersRef.current ?? [];
      const seatCards = seats.reduce(
        (sum, player) => sum + (player?.hand?.length ?? 0),
        0,
      );
      const deckCount = Array.isArray(state.deck) ? state.deck.length : 0;
      const discardCount = Array.isArray(state.discardPile)
        ? state.discardPile.length
        : 0;
      const burnCount = Array.isArray(state.burnPile)
        ? state.burnPile.length
        : 0;
      const total = deckCount + discardCount + burnCount + seatCards;
      if (total !== 52) {
        console.error("[DECK][INTEGRITY_FAIL][UI]", {
          context: contextLabel,
          total,
          deck: state.deck,
          discard: state.discardPile,
          burn: state.burnPile,
          seats: seats.map((player) => player?.hand ?? []),
        });
        throw new Error("Badugi deck integrity violated (ui)");
      }
    },
    [getDeckManager],
  );

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
    const variantId = normalizeAppVariantId(gameVariant);
    const needsNew =
      !gameControllerRef.current || controllerVariantRef.current !== variantId;
    if (needsNew) {
      if (variantId === APP_VARIANT_IDS.NLH) {
        gameControllerRef.current = new NLHGameController({
          tableConfig: buildNlhTableConfig(),
        });
      } else if (isDrawLowballAppVariant(variantId)) {
        gameControllerRef.current = GAME_VARIANTS[variantId]?.controllerFactory?.({
          seatConfig: Array.isArray(seatConfigRef.current)
            ? [...seatConfigRef.current]
            : [...DEFAULT_SEAT_TYPES],
          startingStack: startingStackRef.current ?? DEFAULT_STARTING_STACK,
          heroProfile,
          dealerIndex: dealerIdx,
          structure: { sb: SB, bb: BB, ante: currentAnte },
        }) ?? null;
      } else {
        gameControllerRef.current = new BadugiGameController({
          numSeats: NUM_PLAYERS,
          blindStructure: activeBlindStructure,
          lastStructureIndex,
          evaluateHand: evaluateBadugi,
        });
      }
      controllerVariantRef.current = variantId;
    } else if (variantId === APP_VARIANT_IDS.BADUGI) {
      gameControllerRef.current.updateConfig({
        blindStructure: activeBlindStructure,
        lastStructureIndex,
        evaluateHand: evaluateBadugi,
      });
    } else if (
      variantId === APP_VARIANT_IDS.NLH &&
      typeof gameControllerRef.current.updateTableConfig === "function"
    ) {
      gameControllerRef.current.updateTableConfig(buildNlhTableConfig());
    }
    return gameControllerRef.current;
  }, [
    gameVariant,
    buildNlhTableConfig,
    heroProfile,
    dealerIdx,
    SB,
    BB,
    currentAnte,
    activeBlindStructure,
    evaluateBadugi,
    lastStructureIndex,
  ]);

  useEffect(() => {
    ensureGameController();
    const normalizedVariant = normalizeAppVariantId(gameVariant);
    if (normalizedVariant === APP_VARIANT_IDS.NLH) {
      ensureNLHUIAdapterRegistered();
    } else if (isDrawLowballAppVariant(normalizedVariant)) {
      ensureDrawLowballUIAdaptersRegistered();
    } else {
      ensureBadugiUIAdapterRegistered({ gameDefinition });
    }
    uiAdapterRef.current = getGameUIAdapter(normalizedVariant) ?? null;
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

  function currentBetRoundIndex() {
    return Math.min(betRoundIndex, MAX_DRAWS);
  }

  const [transitioning, setTransitioning] = useState(false);
  const transitioningRef = useRef(transitioning);
  useEffect(() => {
    transitioningRef.current = transitioning;
  }, [transitioning]);
  const [showNextButton, setShowNextButton] = useState(false);

  const handSavedRef = useRef(false);
  const sentHandIdsRef = useRef(new Set());
  const handIdRef = useRef(null);
  const showdownTokenRef = useRef(0);
  const handStartStacksRef = useRef([]);
  const handHistoryRef = useRef(null);
  const handHistoryBufferRef = useRef([]);
  const currentHandHistoryRef = useRef(null);
  setHandHistoryAccessors({
    readCurrent: () => cloneHandHistory(handHistoryRef.current),
    readBuffer: () =>
      Array.isArray(handHistoryBufferRef.current)
        ? handHistoryBufferRef.current.filter((entry) => entry != null).map(cloneHandHistory)
        : [],
    findById: (handId) => {
      if (!handId) return null;
      if (handHistoryRef.current?.handId === handId) {
        return cloneHandHistory(handHistoryRef.current);
      }
      const buffer = handHistoryBufferRef.current ?? [];
      const match = buffer.find((entry) => entry?.handId === handId);
      return match ? cloneHandHistory(match) : null;
    },
  });
  const appendCanonicalHandEvent = useCallback((event) => {
    if (!handHistoryRef.current || !event) return null;
    const payload = {
      ...event,
      timestamp: event.timestamp ?? Date.now(),
    };
    handHistoryRef.current.events.push(payload);
    return payload;
  }, []);
  const beginCanonicalHandHistory = useCallback(
    ({
      handId,
      handCount,
      tableId,
      buttonSeat,
      sbSeat,
      bbSeat,
      seatsSnapshot = [],
    }) => {
      const seats = seatsSnapshot.map((player, seat) => ({
        seat,
        name: player?.name ?? `Seat ${seat}`,
        isHero: Boolean(player?.isHero) || seat === 0,
        initialStack: Math.max(0, Number(player?.stack) || 0),
      }));
      const startedAt = Date.now();
      handHistoryRef.current = {
        handId,
        handCount,
        tableId,
        buttonSeat,
        sbSeat,
        bbSeat,
        seats,
        startedAt,
        endedAt: null,
        events: [],
      };
      appendCanonicalHandEvent({ type: "HAND_START", timestamp: startedAt });
    },
    [appendCanonicalHandEvent],
  );
  const logPhaseTransition = useCallback(
    (fromPhase, toPhase) => {
      if (!toPhase) return;
      appendCanonicalHandEvent({
        type: "PHASE_TRANSITION",
        from: fromPhase ?? null,
        to: toPhase,
      });
    },
    [appendCanonicalHandEvent],
  );
  const logShowdownEvent = useCallback(() => {
    appendCanonicalHandEvent({ type: "SHOWDOWN" });
  }, [appendCanonicalHandEvent]);
  const finalizeCanonicalHandHistory = useCallback(
    ({ winners = [], totalPot = 0, legacyRecord = null, playersSnapshot = [] } = {}) => {
      if (!handHistoryRef.current) return null;
      const normalizedWinners = Array.isArray(winners) && winners.length
        ? winners.map((entry) => ({
            seat: typeof entry?.seat === "number" ? entry.seat : null,
            amount: Math.max(0, Number(entry?.amount) || 0),
          })).filter((entry) => entry.seat !== null)
        : (() => {
            const survivors = Array.isArray(playersSnapshot)
              ? playersSnapshot
                  .map((player, seat) => ({ player, seat }))
                  .filter(
                    ({ player }) =>
                      player &&
                      !player.folded &&
                      player.isActiveInGame !== false,
                  )
              : [];
            if (survivors.length === 1) {
              return [
                {
                  seat: survivors[0].seat,
                  amount: Math.max(0, Number(totalPot) || 0),
                },
              ];
            }
            return [];
          })();
      appendCanonicalHandEvent({
        type: "HAND_END",
        winners: normalizedWinners,
        totalPot: Math.max(0, Number(totalPot) || 0),
      });
      handHistoryRef.current.endedAt = Date.now();
      if (legacyRecord) {
        handHistoryRef.current.legacyRecord = legacyRecord;
        handHistoryRef.current.seats = Array.isArray(legacyRecord.seats)
          ? legacyRecord.seats.map((seat) => ({ ...seat }))
          : handHistoryRef.current.seats;
        handHistoryRef.current.pots = Array.isArray(legacyRecord.pots)
          ? legacyRecord.pots.map((pot) => ({ ...pot }))
          : [];
        handHistoryRef.current.uiSummary = legacyRecord.uiSummary
          ? { ...legacyRecord.uiSummary }
          : null;
      }
      const snapshot = cloneHandHistory(handHistoryRef.current);
      if (!snapshot) {
        console.warn("[HAND_HISTORY] Failed to clone finalized record for buffer append");
        return null;
      }
      handHistoryBufferRef.current = [...handHistoryBufferRef.current, snapshot];
      handHistoryRef.current = null;
      return snapshot;
    },
    [appendCanonicalHandEvent],
  );

  const forcedSeatActionsRef = useRef(new Map());
  const e2eDriverApiRef = useRef({});

  const consoleLogBuffer = useRef([]);
  const consoleContextRef = useRef({
    phase: phaseSrc,
    drawRound: drawRoundSrc,
    betRoundIndex: betRoundIndexSrc,
    turn: turnSeatSrc,
  });
  const e2eLogEnabledRef = useRef(false);
  const recentE2eActionIdsRef = useRef(new Set());
  const recentE2eActionQueueRef = useRef([]);
  const MAX_RECENT_E2E_ACTIONS = 128;
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
    consoleContextRef.current = {
      phase: phaseSrc,
      drawRound: drawRoundSrc,
      betRoundIndex: betRoundIndexSrc,
      turn: turnSeatSrc,
    };
  }, [phaseSrc, drawRoundSrc, betRoundIndexSrc, turnSeatSrc]);

  useEffect(() => {
    const original = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };
    const formatConsoleEntry = (level, args) => {
      const context = consoleContextRef.current;
      const payload = args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : `${arg}`))
        .join(" ");
      return `[${level}] phase=${context.phase} drawRound=${context.drawRound} betRound=${context.betRoundIndex} turn=${context.turn} ${payload}`;
    };
    console.log = (...args) => {
      consoleLogBuffer.current.push(formatConsoleEntry("LOG", args));
      original.log(...args);
    };
    console.warn = (...args) => {
      consoleLogBuffer.current.push(formatConsoleEntry("WARN", args));
      original.warn(...args);
    };
    console.error = (...args) => {
      consoleLogBuffer.current.push(formatConsoleEntry("ERROR", args));
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
  const debugLogRef = useRef(() => {});
  debugLogRef.current = debugLog;

  const raiseCountRef = useRef(raiseCountThisRound);
  useEffect(() => {
    raiseCountRef.current = raiseCountThisRound;
  }, [raiseCountThisRound]);

  const resolvingDrawRef = useRef(false);
  const scheduledFinishDrawRef = useRef(false);
  const autoDrawHelpersRef = useRef({});
  const forcedBetHelpersRef = useRef({});
  const customHandHelpersRef = useRef({});
  const goShowdownNowRef = useRef(() => {});
  // NOTE (G-11e): CPU draw actions run through this helper so DRAW phase always
  // advances via the canonical lifecycle. It returns true when it consumed the
  // acting seat (to avoid duplicate work in callers).
  // ANALYSIS: (C) 全員がAIでもここで順番に draw を実行し、全席 hasDrawn=true に
  //           なるまで finishDrawRound() を呼ばないため DRAW ラウンドは省略されない。
  const autoResolveCpuDrawIfNeeded = useCallback(() => {
    if (phase !== "DRAW") return false;
    if (resolvingDrawRef.current) return false;
    resolvingDrawRef.current = true;
    const helpers = autoDrawHelpersRef.current;
    try {
      const basePlayers = playersRef.current ?? players;
      if (!Array.isArray(basePlayers) || basePlayers.length === 0) return false;
      const seatCount = basePlayers.length;
      const ensureNextSeat = () => {
        const fallback = helpers.findNextDrawActorSeat(basePlayers);
        if (fallback === null) {
          if (!transitioningRef.current && !transitioning) {
            if (scheduledFinishDrawRef.current) return true;
            scheduledFinishDrawRef.current = true;
            setTransitioning(true);
            setTimeout(() => {
              try {
                const freshSnapshot = playersRef.current ?? basePlayers;
                forceFinishRoundRef.current({
                  reason: "auto-draw-no-actor",
                  phaseOverride: "DRAW",
                  playersSnapshot: freshSnapshot,
                });
              } finally {
                scheduledFinishDrawRef.current = false;
                setTransitioning(false);
              }
            }, 50);
          }
          return true;
        }
        setTurn(fallback);
        return true;
      };
      if (!Number.isInteger(turn) || turn < 0 || turn >= seatCount) {
        return ensureNextSeat() || false;
      }
      const snapshot = basePlayers.map(clonePlayerState).filter(Boolean);
      if (turn === 0 && shouldWaitForHeroDrawTurn({ phase, turn, players: snapshot })) {
        // Hero acts manually only while the hero is still an eligible draw actor.
        return false;
      }
      const currentSeat = snapshot[turn];
      if (!currentSeat || isFoldedOrOut(currentSeat)) {
        const nxt = helpers.findNextDrawActorSeat(snapshot, turn);
        if (nxt !== null) {
          setTurn(nxt);
        } else {
          forceFinishRoundRef.current({
            reason: "auto-draw-seat-missing",
            phaseOverride: "DRAW",
            playersSnapshot: snapshot,
          });
        }
        return true;
      }
      if (currentSeat.hasDrawn || currentSeat.allIn) {
        const nxt = helpers.findNextDrawActorSeat(snapshot, turn + 1);
        if (nxt !== null) {
          setTurn(nxt);
        } else {
          forceFinishRoundRef.current({
            reason: "auto-draw-already-acted",
            phaseOverride: "DRAW",
            playersSnapshot: snapshot,
          });
        }
        return true;
      }
      const seatToAct = turn;
      const me = snapshot[seatToAct]
        ? {
            ...snapshot[seatToAct],
            hand: Array.isArray(snapshot[seatToAct].hand)
              ? [...snapshot[seatToAct].hand]
              : [],
          }
        : null;
      if (!me) return false;
      if (isSingleTableDrawLowball) {
        const controller = sessionControllerRef.current;
        const controllerState = sessionControllerStateRef.current;
        const cpuAction =
          typeof controller?.getCpuAction === "function"
            ? controller.getCpuAction(controllerState, seatToAct)
            : null;
        const payload = cpuAction?.payload ?? cpuAction ?? {
          type: "DRAW",
          discardIndexes: [],
        };
        const controllerOutcome = tryControllerBetAction({
          actionType: "draw",
          seatIndex: seatToAct,
          metadata: {
            ...payload,
            type: "DRAW",
            discardIndexes: Array.isArray(payload.discardIndexes)
              ? payload.discardIndexes
              : Array.isArray(payload.drawIndexes)
              ? payload.drawIndexes
              : [],
            drawRound,
          },
        });
        if (controllerOutcome?.snapshot) {
          const actorAfter = controllerOutcome.snapshot.players?.[seatToAct] ?? me;
          helpers.logAction(seatToAct, actorAfter.lastAction ?? "DRAW");
          helpers.recordActionToLog({
            phase: "DRAW",
            round: drawRound + 1,
            seat: seatToAct,
            playerState: actorAfter,
            type: actorAfter.lastAction ?? "DRAW",
            stackBefore: me.stack,
            stackAfter: actorAfter.stack ?? me.stack,
            betBefore: me.betThisRound,
            betAfter: actorAfter.betThisRound ?? me.betThisRound,
            raiseCountTable: raiseCountThisRound,
            metadata: {
              drawInfo: {
                drawCount: payload.discardIndexes?.length ?? payload.drawIndexes?.length ?? 0,
                drawIndexes: payload.discardIndexes ?? payload.drawIndexes ?? [],
                before: Array.isArray(me.hand) ? [...me.hand] : [],
                after: Array.isArray(actorAfter.hand) ? [...actorAfter.hand] : [],
              },
            },
          });
          helpers.syncLegacyFromControllerSnapshot(controllerOutcome.snapshot);
          return true;
        }
        return false;
      }
      const deckManager = helpers.getDeckManager();
      const drawEvaluator = helpers.evaluateBadugi(me.hand);
      const aiDrawDecision = computeDrawDecision({
        context: aiDecisionContext,
        evaluation: drawEvaluator,
        hand: me.hand,
      });
      const fallbackDrawCount = npcAutoDrawCount(drawEvaluator);
      const requestedDrawCount = Number.isInteger(aiDrawDecision?.drawCount)
        ? aiDrawDecision.drawCount
        : fallbackDrawCount;
      const discardIndexes = Array.isArray(aiDrawDecision?.discardIndexes)
        ? aiDrawDecision.discardIndexes
            .filter((index) => Number.isInteger(index) && index >= 0 && index < me.hand.length)
            .slice(0, requestedDrawCount)
        : [];
      for (
        let fallbackIndex = 0;
        discardIndexes.length < requestedDrawCount && fallbackIndex < me.hand.length;
        fallbackIndex += 1
      ) {
        if (!discardIndexes.includes(fallbackIndex)) {
          discardIndexes.push(fallbackIndex);
        }
      }
      const drawCount = discardIndexes.length;
      const replacedCards = [];
      const oldHand = [...me.hand];
      const npcActiveCards = helpers.collectActiveCards(snapshot);
      const deckBefore =
        typeof deckManager?.snapshot === "function" ? deckManager.snapshot() : null;
      if (debugMode && deckBefore) {
        console.debug("[DRAW][AUTO][BEFORE]", {
          seat: seatToAct,
          drawCount,
          deck: deckBefore,
          hand: [...oldHand],
        });
      }
      try {
        assertNoDuplicateCards(`[DRAW][AUTO seat=${seatToAct}][BEFORE]`, {
          deck: deckManager?.deck,
          discard: deckManager?.discardPile,
          burn: deckManager?.burnPile,
          ...helpers.buildSeatCardBuckets(snapshot),
        });
      } catch (err) {
        console.error(err);
        throw err;
      }
      const newHand = [...me.hand];
      discardIndexes.forEach((cardIndex) => {
        let drawn = deckManager?.draw?.(1, { activeCards: npcActiveCards }) ?? [];
        if (!drawn.length) {
          helpers.recycleFoldedAndDiscardsBeforeCurrent(snapshot, seatToAct);
          drawn =
            deckManager?.draw?.(1, { activeCards: helpers.collectActiveCards(snapshot) }) ??
            [];
        }
        if (!drawn.length) return;
        const outgoing = newHand[cardIndex];
        deckManager?.discard?.([outgoing]);
        newHand[cardIndex] = drawn[0];
        replacedCards.push({ index: cardIndex, oldCard: outgoing, newCard: drawn[0] });
      });
      me.hand = newHand;
      me.hasDrawn = true;
      me.hasActedThisRound = true;
      me.lastDrawCount = drawCount;
      me.lastAction = drawCount === 0 ? "Pat" : `DRAW(${drawCount})`;
      snapshot[seatToAct] = me;
      if (debugMode) {
        console.debug("[DRAW][AUTO][ACTION]", {
          seat: seatToAct,
          drawCount,
          replacedCards,
          before: oldHand,
          after: [...newHand],
        });
      }
      try {
        assertNoDuplicateCards(`[DRAW][AUTO seat=${seatToAct}][AFTER]`, {
          deck: deckManager?.deck,
          discard: deckManager?.discardPile,
          burn: deckManager?.burnPile,
          ...helpers.buildSeatCardBuckets(snapshot),
        });
      } catch (err) {
        console.error(err);
        throw err;
      }
      const npcControllerMetadata = {
        drawCount,
        replacedCards: replacedCards.map((entry) => ({ ...entry })),
        handAfter: [...me.hand],
        drawIndexes: replacedCards.map((entry) => entry.index),
        drawRound,
        actionLabel: me.lastAction,
        decisionSource: aiDrawDecision?.source ?? "npcAutoDrawCount",
        tierId: aiDrawDecision?.tierId ?? activeAiTierConfig?.id,
      };
      const controllerOutcome = tryControllerBetAction({
        actionType: "draw",
        seatIndex: seatToAct,
        metadata: npcControllerMetadata,
      });
      if (controllerOutcome?.snapshot) {
        const controllerPlayers = controllerOutcome.snapshot.players ?? [];
        const actorAfter = controllerPlayers[seatToAct] ?? me;
        helpers.logAction(seatToAct, actorAfter.lastAction ?? me.lastAction);
        helpers.recordActionToLog({
          phase: "DRAW",
          round: drawRound + 1,
          seat: seatToAct,
          playerState: actorAfter,
          type: actorAfter.lastAction ?? me.lastAction,
          stackBefore: actorAfter.stack,
          stackAfter: actorAfter.stack,
          betBefore: actorAfter.betThisRound,
          betAfter: actorAfter.betThisRound,
          raiseCountTable: raiseCountThisRound,
          metadata: { drawInfo: npcControllerMetadata },
        });
        const legacyFanout = helpers.syncLegacyFromControllerSnapshot(
          controllerOutcome.snapshot,
        );
        const normalizedPlayers =
          legacyFanout?.normalizedPlayers ?? controllerPlayers;
        const nextSeat =
          legacyFanout?.nextTurn ??
          (typeof controllerOutcome.snapshot.turn === "number"
            ? controllerOutcome.snapshot.turn
            : typeof controllerOutcome.snapshot.nextTurn === "number"
            ? controllerOutcome.snapshot.nextTurn
            : null);
        if (nextSeat !== null && nextSeat !== undefined) {
          if (debugMode) {
            console.debug("[DRAW][AUTO][NEXT]", { from: seatToAct, to: nextSeat });
          }
          setTurn(nextSeat);
        } else if (!transitioning) {
          setTransitioning(true);
          setTimeout(() => {
            forceFinishRoundRef.current({
              reason: "auto-draw-controller-finish",
              phaseOverride: "DRAW",
              playersSnapshot: playersRef.current ?? normalizedPlayers,
            });
            setTransitioning(false);
          }, 50);
        }
        return true;
      }
      const nextAfter = helpers.findNextDrawActorSeat(snapshot, seatToAct + 1);
      const safeTurnForDraw = typeof nextAfter === "number" ? nextAfter : seatToAct;
      helpers.setPlayerSnapshot(snapshot);
      const snapshotAfter = helpers.applyDeckSnapshot({
        players: snapshot,
        pots,
        nextTurn: safeTurnForDraw,
        turn: safeTurnForDraw,
        metadata: {
          currentBet,
          betHead,
          lastAggressor,
          actingPlayerIndex: safeTurnForDraw,
        },
      });
      helpers.syncEngineSnapshot(snapshotAfter);
      helpers.logAction(seatToAct, me.lastAction);
      helpers.recordActionToLog({
        phase: "DRAW",
        round: drawRound + 1,
        seat: seatToAct,
        playerState: me,
        type: me.lastAction,
        stackBefore: me.stack,
        stackAfter: me.stack,
        betBefore: me.betThisRound,
        betAfter: me.betThisRound,
        raiseCountTable: raiseCountThisRound,
        metadata: { drawInfo: npcControllerMetadata },
      });
      if (debugMode) {
        console.debug("[DRAW][AUTO][NEXT]", { from: seatToAct, to: nextAfter });
      }
      if (nextAfter !== null) {
        setTurn(nextAfter);
      } else if (!transitioning) {
        if (scheduledFinishDrawRef.current) return true;
        scheduledFinishDrawRef.current = true;
        setTransitioning(true);
        setTimeout(() => {
          try {
            forceFinishRoundRef.current({
              reason: "auto-draw-finished",
              phaseOverride: "DRAW",
              playersSnapshot: playersRef.current ?? snapshot,
            });
          } finally {
            scheduledFinishDrawRef.current = false;
            setTransitioning(false);
          }
        }, 50);
      }
      return true;
    } finally {
      resolvingDrawRef.current = false;
    }
  }, [
    phase,
    players,
    turn,
    transitioning,
    drawRound,
    debugMode,
    raiseCountThisRound,
    pots,
    currentBet,
    betHead,
    lastAggressor,
    aiDecisionContext,
    activeAiTierConfig,
    isSingleTableDrawLowball,
    tryControllerBetAction,
  ]);

  // === TRACE HELPER (debug only) ===
  function trace(tag, extra = {}) {
    const now = new Date().toISOString().split("T")[1].split(".")[0];
    const hand = handIdRef?.current ?? "-";
    const phaseLabel = phase ?? "-";
    console.log(`[TRACE ${now}] [HAND ${hand}] [${phaseLabel}] ${tag}`, extra);
  }

  function clonePlayerState(player) {
    if (!player) return null;
    return {
      ...player,
      hand: Array.isArray(player.hand) ? [...player.hand] : player.hand,
      selected: Array.isArray(player.selected) ? [...player.selected] : player.selected,
    };
  }

  function setPlayerSnapshot(snap) {
    const normalized = Array.isArray(snap)
      ? snap.map(clonePlayerState).filter(Boolean)
      : [];
    setPlayers(normalized);
    return normalized;
  }

  function positionName(index, dealer = dealerSeatSrc) {
    return getPositionName(index, dealer, playersSrc);
  }
  
  const sbIndex = (d = dealerSeatSrc) => (d + 1) % NUM_PLAYERS; // SB
  const orderFromSB = (d = dealerSeatSrc) =>
    Array.from({ length: NUM_PLAYERS }, (_, k) => (sbIndex(d) + k) % NUM_PLAYERS);
  const findNextDrawActorSeat = useCallback((snap, startIdx = null) => {
    if (!Array.isArray(snap) || snap.length === 0) return null;
    const base =
      typeof startIdx === "number"
        ? startIdx
        : (dealerSeatSrc + 1) % NUM_PLAYERS;
    const seat = findNextDrawActorSeatHelper(snap, base);
    if (debugMode) {
      console.log("[DRAW][NEXT_ACTOR]", { base, seat });
    }
    return typeof seat === "number" ? seat : null;
  }, [dealerSeatSrc, debugMode, NUM_PLAYERS]);
  autoDrawHelpersRef.current = {
    applyDeckSnapshot,
    buildSeatCardBuckets,
    collectActiveCards,
    evaluateBadugi,
    findNextDrawActorSeat,
    getDeckManager,
    logAction,
    recordActionToLog,
    recycleFoldedAndDiscardsBeforeCurrent,
    setPlayerSnapshot,
    syncEngineSnapshot,
    syncLegacyFromControllerSnapshot,
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

  function betRoundNo(value = betRoundIndexSrc) {
    return Math.min(value, MAX_DRAWS);
  }

  function phaseTagLocal(currentPhase = phaseSrc) {
    if (currentPhase === "BET") return `BET#${betRoundNo()}`;
    if (currentPhase === "DRAW") return `DRAW#${drawRoundSrc + 1}`;
    return "SHOWDOWN";
  }
  const phaseTagLocalRef = useRef(() => "SHOWDOWN");
  phaseTagLocalRef.current = phaseTagLocal;

  function logState(tag, snap = playersSrc) {
    if (!debugMode) return;
    const head = `[${phaseTagLocal()}] ${tag} (turn=${turnSeatSrc}, betHead=${betHeadSrc}, lastAgg=${lastAggressorSrc}, currentBet=${currentBetSrc})`;
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
      console.log("pots:", potsSrc, "totalPot:", totalPotForDisplay);
      const potNow = (potsSrc || []).reduce((s, p) => s + (p.amount || 0), 0);
      console.log("pots:", potsSrc, "totalPotNow:", potNow);
    } finally {
      console.groupEnd();
    }
  }

  function logAction(i, type, payload = {}) {
    if (!debugMode) return;
    const seq = ++actionSeqRef.current;
    const nm = playersSrc[i]?.name ?? `P${i}`;
    const pos = positionName(i);
    console.log(
      `[${phaseTagLocal()}][#${seq}] ${nm} (${pos}) -> ${type}`,
      payload
    );
    const hand = Array.isArray(playersSrc[i]?.hand)
      ? playersSrc[i].hand.join(" ")
      : "";
    console.log(
      `[HANDSTATE] phase=${phaseTagLocal()} turn=${turnSeatSrc} seat=${i} hand=${hand} folded=${playersSrc[i]?.folded} stack=${playersSrc[i]?.stack}`
    );
  }

  // NOTE (G-10): forceFinishCurrentRound handles healthy BET endings, while this
  // helper wipes the entire table when the flow becomes unrecoverable.
  const resetTableStateToSafeDefaults = useCallback(
    ({
      reason = "manual-reset",
      preserveHandCount = true,
      navigateTo = null,
    } = {}) => {
      console.warn("[RESET][G-10] resetting table state", { reason, navigateTo });
      dealingRef.current = false;
      transitioningRef.current = false;
      forcedSeatActionsRef.current = new Map();
      recentE2eActionIdsRef.current.clear();
      recentE2eActionQueueRef.current = [];
      e2eLogEnabledRef.current = false;
      handSavedRef.current = false;
      handStartStacksRef.current = [];
      if (!preserveHandCount) {
        handCountRef.current = 0;
      }
      handHistoryBufferRef.current = [];
      handHistoryRef.current = null;
      currentHandHistoryRef.current = null;
      lastPotSummaryRef.current = [];
      tableMetadataRef.current = {};
      handIdRef.current = null;
      drawRoundTracker.current = 0;
      betRoundTracker.current = 0;
      setDrawRoundValue(0);
      setBetRoundValue(0);
      setRaiseCountThisRound(0);
      setRaisePerRound([0, 0, 0, 0]);
      setRaisePerSeatRound(
        Array(NUM_PLAYERS)
          .fill(0)
          .map(() => [0, 0, 0, 0]),
      );
      setActionLog([]);
      setTransitioning(false);
      setShowNextButton(false);
      setHandResultVisible(false);
      setHandResultSummary(null);
      setPots([]);
      potsRef.current = [];
      setCurrentBet(0);
      setBetHead(null);
      setLastAggressor(null);
      setDealerIdx(0);
      setTurn(-1);
      setPhase(SAFE_RESET_PHASE);
      const safeSeatConfig = Array.isArray(seatConfigRef.current)
        ? [...seatConfigRef.current]
        : Array.from({ length: NUM_PLAYERS }, () => "CPU");
      const safePlayers = applyHeroProfile(
        buildPlayersFromSeatTypes(
          safeSeatConfig,
          startingStackRef.current ?? DEFAULT_STARTING_STACK,
          heroProfile,
        ),
        heroProfile,
      );
      setPlayers(safePlayers);
      playersRef.current = safePlayers;
      engineStateRef.current = null;
      if (gameControllerRef.current && typeof gameControllerRef.current.syncExternalState === "function") {
        try {
          gameControllerRef.current.syncExternalState({
            players: safePlayers,
            phase: SAFE_RESET_PHASE,
            betHead: null,
            lastAggressorIdx: null,
            currentBet: 0,
            nextTurn: null,
            metadata: { currentBet: 0, betHead: null, actingPlayerIndex: null },
          });
        } catch (err) {
          console.warn("[RESET][G-10] controller sync failed", err);
        }
      }
      if (typeof navigateTo === "string") {
        setCurrentScreen(navigateTo);
      }
    },
    [buildPlayersFromSeatTypes, heroProfile, setCurrentScreen],
  );

  const handleFatalTableError = useCallback(
    (reason, context = {}) => {
      console.error("[G-10][FATAL]", reason, context);
      resetTableStateToSafeDefaults({
        reason,
        ...(context.resetOptions ?? {}),
      });
    },
    [resetTableStateToSafeDefaults],
  );

  const findNextDrawActorSeatRef = useRef(findNextDrawActorSeat);
  findNextDrawActorSeatRef.current = findNextDrawActorSeat;
  const forceFinishRoundRef = useRef(forceFinishRound);
  forceFinishRoundRef.current = forceFinishRound;

  useEffect(() => {
    if (phase !== "BET" && phase !== "DRAW") return;
    if (transitioningRef.current || transitioning) return;
    const roster = playersRef.current ?? players;
    const seatCount = Array.isArray(roster) ? roster.length : 0;
    if (seatCount === 0) return;
    if (!Number.isInteger(turn) || turn < 0 || turn >= seatCount) {
      if (phase === "DRAW") {
        const drawFallback = findNextDrawActorSeatRef.current(roster);
        if (typeof drawFallback === "number") {
          setTurn(drawFallback);
          return;
        }
      } else {
        const betFallback = firstBetterAfterBlinds(roster, dealerIdx);
        if (typeof betFallback === "number") {
          setTurn(betFallback);
          return;
        }
      }
      const handled = forceFinishRoundRef.current({
        reason: "acting-seat-out-of-range",
        phaseOverride: phase,
        playersSnapshot: roster,
      });
      if (!handled) {
        handleFatalTableError("acting-seat-out-of-range", { phase, turn, seatCount });
      }
    }
  }, [
    phase,
    turn,
    players,
    dealerIdx,
    transitioning,
    handleFatalTableError,
  ]);
  function emitE2EActionTrace(entry, playerSnapshot) {
    if (!e2eLogEnabledRef.current) return;
    const seatIdx = typeof entry.seat === "number" ? entry.seat : null;
    const handId = handIdRef.current ?? "unknown-hand";
    const phaseForStreet = entry.phase ?? phase;
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
      handleFatalTableError("folded-seat-acted", {
        seat: seatIdx,
        action: entry.action,
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
  const normalizedActionLabel = String(type ?? "").toLowerCase();
  const resolvedIsForced =
    typeof metadata?.isForced === "boolean"
      ? metadata.isForced
      : normalizedActionLabel.includes("blind") || normalizedActionLabel.includes("ante");
  const resolvedPaid =
    Number.isFinite(resolvedStackBefore) && Number.isFinite(resolvedStackAfter)
      ? Math.max(0, (resolvedStackBefore ?? 0) - (resolvedStackAfter ?? 0))
      : Number.isFinite(metadata?.paid)
      ? metadata.paid
      : Math.max(0, (resolvedBetAfter ?? 0) - (resolvedBetBefore ?? 0));
  const resolvedToCall = Number.isFinite(metadata?.toCall) ? metadata.toCall : null;

  console.assert(
    typeof resolvedStackBefore === "number" && typeof resolvedStackAfter === "number",
    "[LOG] stack values missing for action",
    { seat: idx, type, phase: phaseLabel, resolvedStackBefore, resolvedStackAfter }
  );

  const nextEntry = {
    handId: handIdRef.current ?? metadata?.handId ?? null,
    playerId:
      seatSnapshot?.playerId ??
      seatSnapshot?.tournamentPlayerId ??
      (idx !== null ? `seat-${idx}` : null),
    phase: phaseLabel,
    phaseSnapshot,
    round: resolvedRound,
    street: phaseLabel,
    streetRound: resolvedStreetRound,
    seat: idx,
    seatName: seatName ?? seatSnapshot?.name ?? (idx === null ? "TABLE" : `Seat ${idx}`),
    positionLabel:
      idx !== null ? positionName(idx, dealerSeatSrc, playersRef.current?.length ?? NUM_PLAYERS) : null,
    action: type,
    stackBefore: resolvedStackBefore,
    stackAfter: resolvedStackAfter,
    betBefore: resolvedBetBefore,
    betAfter: resolvedBetAfter,
    paid: resolvedPaid,
    isForced: resolvedIsForced,
    toCall: resolvedToCall,
    potAfter: potAfter ?? totalPotRef.current,
    raiseCountTable,
    metadata: Object.keys(mergedMeta).length ? mergedMeta : undefined,
    drawRound: resolvedDrawRound,
    betRound: resolvedBetRound,
    ts: Date.now(),
  };
  let historyAction = null;
  if (idx !== null && currentHandHistoryRef.current) {
    const historyType = normalizeHandHistoryType(type);
    const amountDelta = Math.max(0, (resolvedBetAfter ?? 0) - (resolvedBetBefore ?? 0));
    const totalInvestedValue =
      seatSnapshot?.totalInvested ??
      playerState?.totalInvested ??
      sourcePlayers?.[idx]?.totalInvested ??
      resolvedBetAfter ??
      0;
    const betInfo =
      normalizedDrawInfo
        ? null
        : {
            before: Array.isArray(seatSnapshot?.hand)
              ? [...seatSnapshot.hand]
              : Array.isArray(playerState?.hand)
              ? [...playerState.hand]
              : undefined,
            toCall: resolvedToCall ?? 0,
            raiseCountTable: Number.isFinite(raiseCountTable) ? raiseCountTable : 0,
            capReached: Number.isFinite(raiseCountTable) ? raiseCountTable >= 4 : false,
            canRaise:
              Number.isFinite(raiseCountTable) &&
              raiseCountTable < 4 &&
              (seatSnapshot?.allIn ?? playerState?.allIn) !== true,
          };
    const historyMetadata = normalizedDrawInfo
      ? { drawInfo: normalizedDrawInfo }
      : { betInfo };
    historyAction = appendHandHistoryAction({
      seat: idx,
      street: phaseLabel,
      type: historyType,
      amount: amountDelta,
      totalInvested: totalInvestedValue,
      metadata: historyMetadata,
      userId: authUserIdRef.current,
    });
    if (historyType === "fold") {
      updateHandHistorySeat(idx, { finalAction: "fold" });
    }
  }
  if (idx !== null) {
    if (normalizedDrawInfo) {
      appendCanonicalHandEvent({
        type: "DRAW_ACTION",
        seat: idx,
        actionSeq: historyAction?.seq ?? null,
        discarded: Array.isArray(normalizedDrawInfo.drawIndexes)
          ? normalizedDrawInfo.drawIndexes.filter((val) => Number.isInteger(val))
          : [],
      });
    } else {
      const normalizedType = normalizeHandHistoryType(type);
      const amountDelta = Math.max(0, (resolvedBetAfter ?? 0) - (resolvedBetBefore ?? 0));
      appendCanonicalHandEvent({
        type: "BET_ACTION",
        seat: idx,
        action: normalizedType,
        actionSeq: historyAction?.seq ?? null,
        amount: amountDelta,
      });
    }
  }
  setActionLog((prev) => [...prev, nextEntry]);
  if (nextEntry.handId) {
    enqueueBadugiActions([nextEntry]);
  }
  if (shouldEmitE2EAction(nextActionId)) {
    emitE2EActionTrace(nextEntry, seatSnapshot);
  }
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
  forcedBetHelpersRef.current = {
    afterBetActionWithSnapshot,
    currentBetRoundIndex,
    emitE2EActionTrace,
    ensureSeatCanAct,
    evaluateBadugi,
    logAction,
    logE2ESkip,
    recordActionToLog,
    shiftAggressorsAfterFold,
    syncLegacyFromControllerSnapshot,
    tryControllerBetAction,
  };

  const applyForcedBetAction = useCallback(
    (seat, payload = {}) => {
      if (phase !== "BET") return false;
      const helpers = forcedBetHelpersRef.current;
      const roster = playersRef.current;
      if (!Array.isArray(roster) || seat < 0 || seat >= roster.length) return false;
      const snap = roster.map(clonePlayerState).filter(Boolean);
      const seatBefore = snap[seat] ? { ...snap[seat] } : null;
      if (isControllerDrivenSingleTable) {
        const actionType = payload?.type ?? "call";
        const forcedCurrentBet = snap.reduce(
          (max, player) => Math.max(max, Number(player?.betThisRound) || 0),
          0,
        );
        const callAmount =
          String(actionType).toLowerCase() === "call" && payload?.amount == null
            ? Math.max(
                0,
                forcedCurrentBet - Math.max(0, Number(seatBefore?.betThisRound) || 0),
              )
            : payload?.amount ?? 0;
        const controllerOutcome = helpers.tryControllerBetAction({
          actionType,
          amount: callAmount,
          seatIndex: seat,
          metadata: payload,
        });
        if (controllerOutcome?.snapshot) {
          const actorAfter = controllerOutcome.snapshot.players?.[seat] ?? seatBefore;
          helpers.logAction(seat, actorAfter?.lastAction ?? payload?.type ?? "call", {
            forced: true,
          });
          helpers.recordActionToLog({
            phase: "BET",
            round: helpers.currentBetRoundIndex(),
            seat,
            playerState: actorAfter,
            type: actorAfter?.lastAction ?? payload?.type ?? "call",
            stackBefore: seatBefore?.stack ?? actorAfter?.stack ?? 0,
            stackAfter: actorAfter?.stack ?? seatBefore?.stack ?? 0,
            betBefore: seatBefore?.betThisRound ?? 0,
            betAfter: actorAfter?.betThisRound ?? seatBefore?.betThisRound ?? 0,
            raiseCountTable: raiseCountThisRound,
          });
          forcedSeatActionsRef.current.delete(seat);
          helpers.syncLegacyFromControllerSnapshot(controllerOutcome.snapshot, {
            seatIndex: seat,
          });
          return true;
        }
        if (controllerOutcome?.rejected) {
          const isForcedInstantFold =
            payload?.__forceInstant === true &&
            String(actionType).toLowerCase() === "fold";
          if (!isForcedInstantFold) {
            forcedSeatActionsRef.current.delete(seat);
            return false;
          }
          warnLegacySingleTablePath(
            `forced instant fold fallback seat=${seat} code=${controllerOutcome.code ?? "unknown"}`,
          );
        }
        if (isSingleTableBadugi) {
          warnLegacySingleTablePath(`forced-bet fallback seat=${seat}`);
        }
      }
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

      helpers.logAction(seat, actionLabel, { forced: true });
      helpers.recordActionToLog({
        phase: "BET",
        round: helpers.currentBetRoundIndex(),
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
        helpers.shiftAggressorsAfterFold(updatedPlayers, seat);
      } else if (raiseApplied) {
        setRaiseCountThisRound((count) => count + 1);
        setBetHead(seat);
        setLastAggressor(seat);
      }

      helpers.afterBetActionWithSnapshot(updatedPlayers, seat);
      return true;
    },
    [
      phase,
      betSize,
      raiseCountThisRound,
      setBetHead,
      setLastAggressor,
      ensureGameController,
      isControllerDrivenSingleTable,
      isSingleTableBadugi,
    ]
  );

  customHandHelpersRef.current = {
    applyDeckSnapshot,
    syncEngineSnapshot,
  };

  const applyCustomHands = useCallback(
    (overrides = []) => {
      if (!Array.isArray(overrides) || overrides.length === 0) return;
      const helpers = customHandHelpersRef.current;
      setPlayers((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const snap = prev.map(clonePlayerState).filter(Boolean);
        let mutated = false;
        let hasTotalInvestedOverride = false;
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
            hasTotalInvestedOverride = true;
            if (typeof betOverride !== "number") {
              snap[seat].betThisRound = 0;
            }
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
        const nextPots = hasTotalInvestedOverride
          ? buildSidePots(snap)
          : Array.isArray(pots)
            ? pots.map((pot) => ({ ...pot }))
            : [];
        if (hasTotalInvestedOverride) {
          setPots(nextPots.map((pot) => ({ ...pot })));
        }
        const forcedSnapshot = helpers.applyDeckSnapshot({
          players: snap,
          pots: nextPots,
          nextTurn: turn,
          turn,
          metadata: {
            currentBet,
            betHead,
            lastAggressor,
            actingPlayerIndex: turn,
          },
        });
        if (isSingleTableBadugi) {
          const controllerSnapshot = {
            ...forcedSnapshot,
            phase,
            players: snap.map(clonePlayerState).filter(Boolean),
            pots: nextPots.map((pot) => ({ ...pot })),
            currentBet,
            betHead,
            lastAggressor,
            nextTurn: turn,
            turn,
            metadata: {
              ...(forcedSnapshot.metadata ?? {}),
              currentBet,
              betHead,
              lastAggressor,
              actingPlayerIndex: turn,
            },
          };
          if (sessionControllerStateRef.current) {
            sessionControllerStateRef.current = {
              ...sessionControllerStateRef.current,
              snapshot: controllerSnapshot,
            };
          }
          const sessionController = sessionControllerRef.current;
          if (sessionController?.legacy?.state) {
            sessionController.legacy.state.players = controllerSnapshot.players.map(clonePlayerState);
            sessionController.legacy.state.pots = controllerSnapshot.pots.map((pot) => ({ ...pot }));
            sessionController.legacy.state.phase = phase;
            sessionController.legacy.state.currentBet = currentBet;
            sessionController.legacy.state.betHead = betHead;
            sessionController.legacy.state.lastAggressorIdx = lastAggressor;
            sessionController.legacy.state.nextTurn = turn;
            sessionController.legacy.state.turn = turn;
            sessionController.legacy.state.metadata = {
              ...(sessionController.legacy.state.metadata ?? {}),
              ...(controllerSnapshot.metadata ?? {}),
            };
          }
        }
        helpers.syncEngineSnapshot(forcedSnapshot);
        return snap;
      });
    },
    [
      pots,
      currentBet,
      betHead,
      lastAggressor,
      turn,
      phase,
      isSingleTableBadugi,
    ]
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
      const helpers = forcedBetHelpersRef.current;
      forcedSeatActionsRef.current = forceSequentialFoldsMap(
        forcedSeatActionsRef.current,
        seats,
      );
      if (phase === "BET") {
        const list = Array.isArray(seats) ? seats : [seats];
        list.forEach((seat) => {
          applyForcedBetAction(seat, { type: "fold", __forceInstant: true });
          const seatState = playersRef.current?.[seat] ?? null;
          helpers.emitE2EActionTrace?.(
            {
              phase: "BET",
              round: helpers.currentBetRoundIndex?.() ?? betRoundTracker.current,
              seat,
              seatName: seatState?.name ?? `Seat ${seat}`,
              action: "Fold",
              stackBefore: seatState?.stack ?? 0,
              stackAfter: seatState?.stack ?? 0,
              betBefore: seatState?.betThisRound ?? 0,
              betAfter: seatState?.betThisRound ?? 0,
              metadata: { forcedSequentialFold: true },
            },
            seatState,
          );
        });
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
    goShowdownNowRef.current(snapshot, { force: true, bypassEngine: true });
  }, []);

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

  function canContinueGame(snapshot) {
    const roster = Array.isArray(snapshot) ? snapshot : [];
    const alive = roster.filter(
      (player) =>
        player &&
        isPlayerSeated(player) &&
        !player.seatOut &&
        !player.isBusted &&
        typeof player.stack === "number" &&
        player.stack > 0,
    );
    return alive.length >= 2;
  }

  const buildCashNextHandSnapshot = useCallback(
    (snapshot = []) => {
      const configuredPlayers = applyHeroProfile(
        buildPlayersFromSeatTypes(
          seatConfigRef.current,
          startingStackRef.current ?? DEFAULT_STARTING_STACK,
          heroProfile,
        ),
        heroProfile,
      );
      const source =
        Array.isArray(snapshot) && snapshot.length ? snapshot : configuredPlayers;
      const rebuyStack = startingStackRef.current ?? DEFAULT_STARTING_STACK;

      return configuredPlayers.map((baseline, idx) => {
        const player = source[idx] ? clonePlayerState(source[idx]) : baseline;
        const seatType = player?.seatType ?? baseline?.seatType ?? seatConfigRef.current?.[idx];
        const isEmptySeat = String(seatType ?? "").toUpperCase() === "EMPTY";
        if (isEmptySeat) {
          return {
            ...baseline,
            ...player,
            seatType,
            stack: 0,
            folded: true,
            hasFolded: true,
            allIn: false,
            isBusted: true,
            seatOut: true,
            hand: [],
            selected: [],
            showHand: false,
            betThisRound: 0,
            totalInvested: 0,
            lastAction: "",
          };
        }

        const stack =
          Number.isFinite(player?.stack) && player.stack > 0
            ? player.stack
            : rebuyStack;
        const isHeroSeat = idx === 0 && String(seatType ?? "").toUpperCase() === "HUMAN";
        return {
          ...baseline,
          ...player,
          seatType,
          stack,
          hand: [],
          selected: [],
          folded: false,
          hasFolded: false,
          allIn: false,
          isBusted: false,
          seatOut: false,
          hasActedThisRound: false,
          betThisRound: 0,
          totalInvested: 0,
          lastAction: "",
          hasDrawn: false,
          lastDrawCount: 0,
          showHand: isHeroSeat,
        };
      });
    },
    [buildPlayersFromSeatTypes, heroProfile],
  );

  const buildTournamentEntrants = useCallback((config) => {
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
      const cpuCharacter = getCpuCharacterForIndex(idx);
      return {
        id: `cpu-${idx}`,
        name: cpuCharacter.name,
        cpuCharacterId: cpuCharacter.id,
        cpuStyle: cpuCharacter.style,
        avatarUrl: cpuCharacter.avatarUrl,
      };
    });
  }, [heroProfile]);

  const hydrateHeroTableFromTournamentState = useCallback((state) => {
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
        cpuCharacterId: linkedPlayer?.cpuCharacterId ?? player.cpuCharacterId ?? null,
        cpuStyle: linkedPlayer?.cpuStyle ?? player.cpuStyle ?? null,
        avatarUrl: linkedPlayer?.avatarUrl ?? player.avatarUrl ?? null,
        avatar:
          linkedPlayer?.avatarUrl ??
          player.avatar ??
          player.avatarUrl ??
          "default_avatar",
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
  }, [buildPlayersFromSeatTypes, heroProfile]);

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
            Number.isFinite(Number(startingStacks[player.tournamentPlayerId]))
              ? Number(startingStacks[player.tournamentPlayerId])
              : Number(player.stack) || 0,
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
      hydrateHeroTableFromTournamentState,
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
  const getTournamentHudSnapshotRef = useRef(() => null);
  getTournamentHudSnapshotRef.current = getTournamentHudSnapshot;

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
    const settled = potsSrc.reduce((acc, p) => acc + (p.amount || 0), 0);
    const onStreet = playersSrc.reduce((acc, p) => acc + (p.betThisRound || 0), 0);
    return settled + onStreet;
  }, [potsSrc, playersSrc]);
  const totalPotForDisplay = adapterViewProps?.potView?.total ?? fallbackTotalPot;

  const totalPotRef = useRef(0);
  useEffect(() => {
    totalPotRef.current = totalPotForDisplay;
  }, [totalPotForDisplay]);

  function goShowdownNow(playersSnap, options = {}) {
    debugLog("[SHOWDOWN] goShowdownNow (All-in shortcut) called");
    const forceShowdown = options.force === true;
    const bypassEngine = options.bypassEngine === true;

    const active = playersSnap.filter((p) => !isFoldedOrOut(p));
    if (active.length === 0) return;
    if (!forceShowdown && active.length > 1 && drawRound < MAX_DRAWS) {
      debugLog("[SHOWDOWN] skipping early showdown because multiple players remain");
      return;
    }

    if (
      !bypassEngine &&
      engine &&
      handleEngineShowdown(drawRound, {
        playersOverride: Array.isArray(playersSnap) ? playersSnap : null,
        potsOverride: Array.isArray(pots) ? pots : null,
      })
    ) {
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
        .filter(
          (p) =>
            !isFoldedOrOut(workingPlayers[p.seat]) &&
            workingPlayers[p.seat]?.isActiveInGame !== false
        );

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
            payout,
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
    setPlayers(updated);
    setPhase("SHOWDOWN");
    finishHand({
      playersSnapshot: updated,
      summary: showdownSummary,
      totalPot: totalPotAmount,
    });

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
  goShowdownNowRef.current = goShowdownNow;

  // ANALYSIS: (B) 行動可能者がいないケースでは active.length===1 判定で
  //           goShowdownNow() を直接呼び出し、BET/DRAW を飛ばして強制ショーダウン。
  //           all-in プレイヤーは active フィルタから外れるため、
  //           「全員 all-in」の場合はここを通らず scheduleFinish が DRAW→SHOWDOWN を選択する。
  const checkIfOneLeftThenEnd = useCallback((snapOpt) => {
    const base =
      Array.isArray(snapOpt) && snapOpt.length > 0
        ? snapOpt
        : playersRef.current ?? players;
    if (!base || base.length === 0) return false;

    const active = base.filter((p) => !isFoldedOrOut(p) && !p.allIn);
    if (active.length === 1) {
      const showdownSnap = base.map(clonePlayerState).filter(Boolean);
      goShowdownNowRef.current(showdownSnap);
      return true;
    }
    return false;
  }, [players]);


  const dealingRef = useRef(false);
  const startNextHandRef = useRef(() => {});

  const resetTournamentState = useCallback(() => {
    tournamentStateRef.current = null;
    heroSeatMapRef.current = [];
    heroTableIdRef.current = null;
    heroTableMetaRef.current = { tableId: null, seatIndex: null };
    heroTournamentPlayerIdRef.current = HERO_TOURNAMENT_PLAYER_ID;
    heroRenderTableIdRef.current = null;
    heroBustHandledRef.current = false;
    setTournamentHudState(null);
    setTournamentBlindStructure(getBlindStructureForTournamentConfig(DEFAULT_STORE_TOURNAMENT_CONFIG));
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
      setTournamentBlindStructure(getBlindStructureForTournamentConfig(config));
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
      handHistoryBufferRef.current = [];
      handHistoryRef.current = null;
      currentHandHistoryRef.current = null;
      handSavedRef.current = false;
      resetInitialButtonState();
      const deckManager = getDeckManager();
      deckManager?.reset();
      if (hydration) {
        startNextHandRef.current({
          dealerOverride: 0,
          prevPlayers: hydration.tablePlayers,
        });
      } else {
        startNextHandRef.current({ dealerOverride: 0 });
      }
    },
    // dealNewHand is a stable function declaration; no need to include in deps.
    [
      attachVariantLabels,
      buildTournamentEntrants,
      getDeckManager,
      hydrateHeroTableFromTournamentState,
      initializeVariantRotation,
      resetInitialButtonState,
      resetTournamentState,
    ],
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
      debugLogRef.current("[MODE]", {
        source: "url-param",
        requestedMode: "tournament-mtt",
      });
      startTournamentMTT(DEFAULT_STORE_TOURNAMENT_CONFIG);
      setCurrentScreen("gameTournament");
    }
  }, [setCurrentScreen, startTournamentMTT]);

  const handleEnterFromTitle = () => {
    setCurrentScreen("menu");
  };

  const handleBackToMenu = () => {
    setGameUtilityModal(null);
    setCurrentScreen("menu");
  };

  const handleCashOut = useCallback(() => {
    if (mode !== "cash") return;
    const hero = playersRef.current?.[0] ?? players?.[0] ?? null;
    const buyIn = Number(startingStackRef.current ?? startingStack ?? DEFAULT_STARTING_STACK) || DEFAULT_STARTING_STACK;
    const stack = Number(hero?.stack ?? 0) || 0;
    setCashOutSummary({
      variantName:
        GAME_VARIANTS[gameVariantRef.current]?.label ??
        GAME_VARIANTS[gameVariant]?.label ??
        "Cash Game",
      buyIn,
      stack,
      net: stack - buyIn,
      hands: handCountRef.current,
    });
  }, [gameVariant, mode, players, startingStack]);

  const handleCloseCashOut = useCallback(() => {
    setCashOutSummary(null);
  }, []);

  const handleCashOutBackToMenu = () => {
    setCashOutSummary(null);
    handleBackToMenu();
  };

  const handleOpenGameSelector = () => {
    setCurrentScreen("gameSelector");
  };

  const handleOpenGameUtilityModal = useCallback((modalName) => {
    setGameUtilityModal(modalName);
  }, []);

  const handleCloseGameUtilityModal = useCallback(() => {
    setGameUtilityModal(null);
  }, []);

  const handleSelectSettings = () => {
    setCurrentScreen("settings");
  };

  const handleSelectRing = (variantId = gameVariantRef.current ?? DEFAULT_GAME_VARIANT) => {
    const normalizedVariant = normalizeAppVariantId(variantId, DEFAULT_GAME_VARIANT);
    if (normalizedVariant !== gameVariantRef.current) {
      gameVariantRef.current = normalizedVariant;
      setGameVariant(normalizedVariant);
    }
    resetInitialButtonState();
    setMode("cash");
    pendingRingStartRef.current = true;
    resetTableStateToSafeDefaults({
      reason: "menu-ring-start",
      preserveHandCount: false,
      navigateTo: "gameRing",
    });
  };

  const handleCashOutNewSession = () => {
    setCashOutSummary(null);
    handleSelectRing(gameVariantRef.current ?? DEFAULT_GAME_VARIANT);
  };

  const handleSelectTournament = (configOverride) => {
    const config = configOverride ?? DEFAULT_STORE_TOURNAMENT_CONFIG;
    setCurrentScreen("gameTournament");
    startTournamentMTT(config);
  };

  const handleOpenHandHistoryScreen = useCallback(() => {
    setCurrentScreen("handHistory");
  }, []);

  const handleCloseHandHistoryScreen = useCallback(() => {
    setReplayHandId(null);
    setReplayTarget(null);
    setCurrentScreen("menu");
  }, []);

  const handleOpenReplayFromHistory = useCallback((handId, target = null) => {
    if (!handId) return;
    const snapshot = findHandHistoryById(handId);
    if (!snapshot) {
      console.warn("[HAND_HISTORY] Unable to locate snapshot for hand", handId);
      return;
    }
    setReplayHandId(handId);
    setReplayTarget(target);
    setCurrentScreen("handReplay");
  }, []);

  const handleOpenReplayTarget = useCallback(
    (target = null) => {
      const handId = target?.handId ?? replayHandId;
      if (!handId) return;
      handleOpenReplayFromHistory(handId, target);
    },
    [handleOpenReplayFromHistory, replayHandId],
  );

  const handleBackFromReplayToHistory = useCallback(() => {
    setCurrentScreen("handHistory");
  }, []);

  const handleExitReplayToMenu = useCallback(() => {
    setReplayHandId(null);
    setReplayTarget(null);
    setCurrentScreen("menu");
  }, []);

  const handleNavigateToTitle = useCallback(() => {
    resetTournamentState();
    setMode("cash");
    setCurrentScreen("title");
    navigate("/");
  }, [navigate, resetTournamentState]);

  /* --- dealing --- */
  function dealNewHand(initialDealerIdx = 0, prevPlayers = null, handNumberOverride = null) {
    let nextDealerIdx = typeof initialDealerIdx === "number" ? initialDealerIdx : 0;
    const releaseDealingLock = () => {
      setTimeout(() => {
        dealingRef.current = false;
      }, 100);
    };
    try {

    const basePlayersSnapshot = playersRef.current ?? [];
    const nextHandNumber = Number.isFinite(handNumberOverride)
      ? Number(handNumberOverride)
      : handCountRef.current + 1;

    trace("dealNewHand START", { nextDealerIdx, prevPlayersCount: prevPlayers?.length ?? 0 });
    if (dealingRef.current) {
      debugLog("[HAND] dealNewHand skipped (already in progress)");
      return false;
    }
    dealingRef.current = true;
    showdownTokenRef.current += 1;
    lastPotSummaryRef.current = [];
    debugLog(`[HAND] dealNewHand start -> dealer=${nextDealerIdx}`);
    setHandResultVisible(false);
    setHandResultSummary(null);

    const shouldRotateSeats = Boolean(prevPlayers && autoRotateSeatsRef.current);
    const effectiveSeatConfig = consumeSeatConfigForHand(shouldRotateSeats);

    const deckManager = getDeckManager();
    if (deckManager && !isSingleTableDrawLowball) {
      deckManager.reset();
      if (typeof deckManager.shuffle === "function") {
        deckManager.shuffle();
      }
      if (typeof deckManager.burnTopCards === "function") {
        deckManager.burnTopCards(1);
      }
    }
    let initialDealResult = null;
    const assignInitialHands = (seat, seatPlayer, drawContext) => {
      if (seatPlayer?.seatOut) return [];
      if (!initialDealResult && deckManager) {
        initialDealResult =
          dealInitialHands({
            deckManager,
            seats: drawContext?.seats ?? [],
            dealerIdx: drawContext?.dealerIdx ?? nextDealerIdx,
            cardsPerPlayer: 4,
          }) ?? { hands: [] };
      }
      return initialDealResult?.hands?.[seat] ?? [];
    };
    const fallbackStack = startingStackRef.current;
    const blindLevelSnapshot = blindLevelIndexRef.current ?? 0;
    const handsInLevelSnapshot = handsInLevelRef.current ?? 0;
    const handBlindStructure = isTournament
      ? getBlindStructureForTournamentConfig(
          tournamentStateRef.current?.config ?? DEFAULT_STORE_TOURNAMENT_CONFIG,
        )
      : activeBlindStructure;
    const handLastStructureIndex = Math.max(0, handBlindStructure.length - 1);

    const legacyGameController = ensureGameController();
    let controllerHandSnapshot = null;
    let nextHandState = null;
    if (isControllerDrivenSingleTable) {
      const sessionController = ensureSessionController();
      if (sessionController) {
        const prevSessionState = sessionControllerStateRef.current;
        try {
          const nextControllerState = sessionController.createNewHandState(
            prevSessionState,
            {
              prevPlayers,
              currentPlayers: basePlayersSnapshot,
              numSeats: NUM_PLAYERS,
              seatConfig: effectiveSeatConfig,
              startingStack: fallbackStack,
              heroProfile,
              nextDealerIdx,
              blindStructure: handBlindStructure,
              blindState: {
                blindLevelIndex: blindLevelSnapshot,
                handsInLevel: handsInLevelSnapshot,
              },
              lastStructureIndex: handLastStructureIndex,
              drawCardsForSeat: assignInitialHands,
            },
          );
          if (nextControllerState) {
            sessionControllerStateRef.current = nextControllerState;
            if (isSingleTableDrawLowball) {
              gameControllerRef.current = sessionController;
              controllerVariantRef.current = normalizedGameVariant;
            }
            controllerHandSnapshot = sessionController.getUiSnapshot(nextControllerState);
            if (isSingleTableDrawLowball && controllerHandSnapshot) {
              const snapshotPlayers = (controllerHandSnapshot.players ?? [])
                .map(clonePlayerState)
                .filter(Boolean);
              const resolvedDrawTurn =
                typeof controllerHandSnapshot.turn === "number"
                  ? controllerHandSnapshot.turn
                  : typeof controllerHandSnapshot.nextTurn === "number"
                  ? controllerHandSnapshot.nextTurn
                  : 0;
              const resolvedSbIdx = (nextDealerIdx + 1) % NUM_PLAYERS;
              const resolvedBbIdx = (nextDealerIdx + 2) % NUM_PLAYERS;
              const investedForSeat = (seat) =>
                Math.max(
                  0,
                  Number(snapshotPlayers[seat]?.totalInvested) ||
                    Number(snapshotPlayers[seat]?.betThisRound) ||
                    Number(snapshotPlayers[seat]?.bet) ||
                    0,
                );
              nextHandState = {
                players: snapshotPlayers,
                blindLevelIndex: blindLevelSnapshot,
                handsInLevel: handsInLevelSnapshot,
                blindValues: { sb: SB, bb: BB, ante: currentAnte },
                sbIdx: resolvedSbIdx,
                bbIdx: resolvedBbIdx,
                sbPay: investedForSeat(resolvedSbIdx),
                bbPay: investedForSeat(resolvedBbIdx),
                anteEvents: [],
                initialCurrentBet: controllerHandSnapshot.currentBet ?? BB,
                resolvedTurn: resolvedDrawTurn,
                activeCount: snapshotPlayers.filter((player) => !player?.seatOut).length,
                handStartingStacksById: snapshotPlayers.map((player) =>
                  Math.max(
                    0,
                    Number(player?.stack) +
                      Math.max(
                        Number(player?.totalInvested) || 0,
                        Number(player?.betThisRound) || 0,
                        Number(player?.bet) || 0,
                      ),
                  ),
                ),
                seatOutWarnings: [],
              };
            } else {
              nextHandState = nextControllerState.context ?? null;
            }
          }
        } catch (error) {
          console.warn("[SESSION_CONTROLLER] createNewHandState failed", error);
        }
      }
    }

    if (!nextHandState) {
      nextHandState = legacyGameController.startNewHand({
        prevPlayers,
        currentPlayers: basePlayersSnapshot,
        numSeats: NUM_PLAYERS,
        seatConfig: effectiveSeatConfig,
        startingStack: fallbackStack,
        heroProfile,
        nextDealerIdx,
        blindStructure: handBlindStructure,
        blindState: {
          blindLevelIndex: blindLevelSnapshot,
          handsInLevel: handsInLevelSnapshot,
        },
        lastStructureIndex: handLastStructureIndex,
        drawCardsForSeat: assignInitialHands,
      });
    }

    if (typeof tableMetadataRef.current?.firstButtonSeat === "number") {
      legacyGameController.state.metadata = {
        ...(legacyGameController.state.metadata ?? {}),
        firstButtonSeat: tableMetadataRef.current.firstButtonSeat,
      };
    }

    if (deckManager && !isSingleTableDrawLowball) {
      const preflopCheck = validatePreflopState({
        deck: deckManager.deck,
        burn: deckManager.burnPile,
        discard: deckManager.discardPile,
        players: nextHandState.players ?? [],
      });
      if (
        !preflopCheck.isValidTotal ||
        !preflopCheck.hasSingleBurn ||
        !preflopCheck.hasEmptyDiscard
      ) {
        console.error("[DECK][PRE_FLOP_INVALID][UI]", preflopCheck);
        throw new Error("Badugi deck integrity violated (ui-preflop)");
      }
      verifyDeckIntegrityOrThrow("[HAND][DEAL]", nextHandState.players ?? []);
    }

    const {
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
    let newPlayers = nextHandState.players ?? [];
    // NOTE (G-11b/H-01-1): BTN has already been chosen, then assignBlinds paid SB/BB.
    // We immediately normalize hasActedThisRound so the upcoming BET street starts
    // with a consistent flag state for all eligible seats.
    newPlayers = resetBetRoundFlags(newPlayers);
    if (debugMode) {
      console.debug("[DEBUG][BET-START] preflop actor snapshot:");
      newPlayers.forEach((player, seat) => {
        console.debug("[DEBUG][BET-START]", {
          seat,
          name: player?.name,
          hasActed: player?.hasActedThisRound,
          allIn: player?.allIn,
          folded: player?.folded,
          stack: player?.stack,
        });
      });
    }

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
      return true;
    } else if (activeCount < 2) {
      console.warn(`[TOURNAMENT END] Only ${activeCount} active players remain.`);
      setPlayers(newPlayers);
      releaseDealingLock();
      setShowNextButton(false);
      setPhase("TOURNAMENT_END");
      return true;
    }

    const baseTableId =
      heroTableIdRef.current ??
      heroTableMetaRef.current?.tableId ??
      stageGameId ??
      DEFAULT_GAME_ID;
    const newHandId = formatHandIdentifier({
      tableId: baseTableId,
      handNumber: nextHandNumber,
      dealerSeat: nextDealerIdx,
    });
    // NOTE (G-09): This generated handId is the single source of truth for logs,
    // hand results, and backend payloads. Do not mint ad-hoc IDs elsewhere.
    tableMetadataRef.current = {
      ...(tableMetadataRef.current ?? {}),
      tableId: baseTableId,
      handId: newHandId,
      handCount: nextHandNumber,
      buttonSeat: nextDealerIdx,
      sbSeat: typeof sbIdx === "number" ? sbIdx : null,
      bbSeat: typeof bbIdx === "number" ? bbIdx : null,
    };
    handSavedRef.current = false;
    handIdRef.current = newHandId;
    if (legacyGameController?.state) {
      legacyGameController.state.metadata = {
        ...(legacyGameController.state.metadata ?? {}),
        handId: newHandId,
      };
    }
    if (typeof legacyGameController?.setHandContext === "function") {
      legacyGameController.setHandContext({ handId: newHandId });
    }
    const normalizedHandVariant = normalizeAppVariantId(gameVariantRef.current);
    const handVariantProfile = GAME_VARIANTS[normalizedHandVariant] ?? null;
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
      userId: authUserIdRef.current,
      variantId: handVariantProfile?.variantId ?? normalizedHandVariant,
      variantName: handVariantProfile?.label ?? formatVariantLabel(normalizedHandVariant),
    });
    beginCanonicalHandHistory({
      handId: newHandId,
      handCount: nextHandNumber,
      tableId: baseTableId,
      buttonSeat: nextDealerIdx,
      sbSeat: typeof sbIdx === "number" ? sbIdx : null,
      bbSeat: typeof bbIdx === "number" ? bbIdx : null,
      seatsSnapshot: newPlayers,
    });

    if (!isSingleTableDrawLowball) {
      try {
        assertNoDuplicateCards("[HAND][DEAL]", {
          deck: deckManager?.deck,
          discard: deckManager?.discardPile,
          burn: deckManager?.burnPile,
          ...buildSeatCardBuckets(newPlayers),
        });
      } catch (err) {
        console.error(err);
        throw err;
      }
      verifyDeckIntegrityOrThrow("[HAND][DEAL_POST_ASSERT]", newPlayers);
    }

    if (blindValues.ante > 0 && anteEvents.length) {
      anteEvents.forEach(({ seat, amount }) => {
        appendHandHistoryAction({
          seat,
          street: "BET",
          type: "ante",
          amount,
          totalInvested: newPlayers[seat]?.totalInvested ?? amount,
          metadata: { ante: blindValues.ante },
          userId: authUserIdRef.current,
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
        userId: authUserIdRef.current,
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
        userId: authUserIdRef.current,
      });
    }
    appendCanonicalHandEvent({
      type: "BLINDS_POSTED",
      sbSeat: typeof sbIdx === "number" ? sbIdx : null,
      bbSeat: typeof bbIdx === "number" ? bbIdx : null,
      sbAmount: Math.max(0, Number(sbPay) || 0),
      bbAmount: Math.max(0, Number(bbPay) || 0),
    });

    handStartStacksRef.current = newPlayers.map((p) => p.stack);
    setPots([]);
    setCurrentBet(initialCurrentBet);
    setDealerIdx(nextDealerIdx);
    setDrawRoundValue(0);
    setBetRoundValue(0);
    transitionToBetPhase({
      players: newPlayers,
      setPlayers,
      setPhase,
      setTurn,
      turnSeat: resolvedTurn,
      setBetHead,
      betHeadSeat: resolvedTurn,
      fromPhase: phase,
      onPhaseTransition: logPhaseTransition,
    });
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
    const firstButtonSeatMeta =
      typeof tableMetadataRef.current?.firstButtonSeat === "number"
        ? tableMetadataRef.current.firstButtonSeat
        : null;
    const activeHandId =
      tableMetadataRef.current?.handId ?? handIdRef.current ?? null;
    const controllerMetadata = controllerHandSnapshot
      ? { ...(controllerHandSnapshot.metadata ?? {}) }
      : null;
    if (
      controllerMetadata &&
      typeof firstButtonSeatMeta === "number" &&
      typeof controllerMetadata.firstButtonSeat !== "number"
    ) {
      controllerMetadata.firstButtonSeat = firstButtonSeatMeta;
    }
    if (controllerMetadata && activeHandId && !controllerMetadata.handId) {
      controllerMetadata.handId = activeHandId;
    }
    const fallbackMetadata = {
      currentBet: initialCurrentBet,
      betHead: resolvedTurn,
      actingPlayerIndex: resolvedTurn,
      lastAggressor: bbIdx,
    };
    if (typeof firstButtonSeatMeta === "number") {
      fallbackMetadata.firstButtonSeat = firstButtonSeatMeta;
    }
    if (activeHandId) {
      fallbackMetadata.handId = activeHandId;
    }
    const seedSnapshot = controllerHandSnapshot
      ? applyDeckSnapshot({
          ...controllerHandSnapshot,
          players: newPlayers.map(clonePlayerState).filter(Boolean),
          nextTurn:
            typeof controllerHandSnapshot.turn === "number"
              ? controllerHandSnapshot.turn
              : typeof controllerHandSnapshot.nextTurn === "number"
              ? controllerHandSnapshot.nextTurn
              : resolvedTurn,
          turn:
            typeof controllerHandSnapshot.turn === "number"
              ? controllerHandSnapshot.turn
              : typeof controllerHandSnapshot.nextTurn === "number"
              ? controllerHandSnapshot.nextTurn
              : resolvedTurn,
          metadata: {
            ...(controllerMetadata ?? {}),
            currentBet:
              controllerHandSnapshot.currentBet ?? initialCurrentBet ?? 0,
            betHead:
              controllerHandSnapshot.betHead ?? resolvedTurn,
            lastAggressor:
              controllerHandSnapshot.lastAggressor ?? bbIdx ?? null,
            actingPlayerIndex:
              typeof controllerHandSnapshot.turn === "number"
                ? controllerHandSnapshot.turn
                : typeof controllerHandSnapshot.nextTurn === "number"
                ? controllerHandSnapshot.nextTurn
                : resolvedTurn,
          },
        })
      : applyDeckSnapshot({
          players: newPlayers.map(clonePlayerState).filter(Boolean),
          pots: [],
          nextTurn: resolvedTurn,
          turn: resolvedTurn,
          metadata: fallbackMetadata,
          gameId: stageGameId,
          engineId: stageGameId,
        });
    const nextHandSnapshot = {
      ...seedSnapshot,
      phase: "BET",
      drawRound: 0,
      betRoundIndex: 0,
      dealerSeat: nextDealerIdx,
      currentBet: initialCurrentBet ?? 0,
      betHead: resolvedTurn,
      lastAggressor: bbIdx ?? null,
      nextTurn: resolvedTurn,
      turn: resolvedTurn,
      metadata: {
        ...(seedSnapshot?.metadata ?? {}),
        phase: "BET",
        drawRound: 0,
        betRoundIndex: 0,
        currentBet: initialCurrentBet ?? 0,
        betHead: resolvedTurn,
        lastAggressor: bbIdx ?? null,
        actingPlayerIndex: resolvedTurn,
      },
    };

    if (!isTournament) {
      if (isControllerDrivenSingleTable && controllerHandSnapshot) {
        resetForNewHandFromSnapshot(nextHandSnapshot);
      } else {
        const sessionUi =
          syncSessionFromSnapshot(nextHandSnapshot, nextHandState, {
            reason: "new-hand",
          });
        if (sessionUi) {
          resetForNewHandFromSnapshot(sessionUi);
        } else {
          if (isSingleTableBadugi) {
            warnLegacySingleTablePath("resetForNewHand fallback");
          }
          resetForNewHand({
            handId: handIdRef.current,
            dealerSeat: nextDealerIdx,
            heroSeat: 0,
            players: newPlayers.map((player) => ({ ...player })),
            pots: [],
            phase: "BET",
            drawRound: 0,
            betRoundIndex: 0,
            turnSeat: resolvedTurn,
            betHead: resolvedTurn,
            lastAggressor: bbIdx ?? null,
            currentBet: initialCurrentBet ?? 0,
            raiseStats: {
              raiseCountThisRound: 0,
              raisePerRound: [0, 0, 0, 0],
              raisePerSeatRound: Array(NUM_PLAYERS)
                .fill(0)
                .map(() => [0, 0, 0, 0]),
            },
            heroDrawSelection: [],
            actionLog: [],
            overlays: {
              handResult: { visible: false, summary: null },
              showNextButton: false,
            },
            debug: {
              deck: deckManager?.deck ? [...deckManager.deck] : [],
              engineState: null,
            },
          });
        }
      }
    }

    syncEngineSnapshot(nextHandSnapshot, nextHandSnapshot);
    trace("dealNewHand END", { dealerIdx: nextDealerIdx });
    return true;
  } catch (error) {
    console.error("[HAND][G-10] dealNewHand failed", error);
    handleFatalTableError("dealNewHand-error", { error: error?.message });
    releaseDealingLock();
    return false;
  }
  }
  const dealNewHandRef = useRef(() => false);
  dealNewHandRef.current = dealNewHand;
  const trySaveHandOnceRef = useRef(() => {});
  trySaveHandOnceRef.current = trySaveHandOnce;

  // NOTE (G-11a): startNextHand is the single canonical entry for dealing a new
  // hand. Any UI/controller path that needs a new hand must invoke this helper
  // instead of calling dealNewHand directly so BTN/blinds/metadata stay in sync.
  const startNextHand = useCallback(
    ({ dealerOverride = null, prevPlayers = null } = {}) => {
      if (dealingRef.current) {
        console.warn("[HAND] dealNewHand busy; next request ignored");
        return false;
      }
      const currentPhase = phaseRef.current ?? phase;
      const allowedStartPhases = new Set([
        SAFE_RESET_PHASE,
        "INIT",
        "HAND_RESULT",
        "SHOWDOWN",
        "WAITING_NEXT_HAND",
        "TABLE_FINISHED",
        "TOURNAMENT_END",
        "TOURNAMENT_FINAL",
      ]);
      if (
        handCountRef.current > 0 &&
        !allowedStartPhases.has(currentPhase)
      ) {
        console.warn("[HAND] stale next-hand trigger ignored", {
          phase: currentPhase,
          handId: handIdRef.current,
        });
        return false;
      }
      setShowNextButton(false);
      setHandResultVisible(false);
      setHandResultSummary(null);
      updateShowdownRef.current({
        phase: "BET",
        handResultVisible: false,
        handResultSummary: null,
        showNextButton: false,
      });
      if (mode === "tournament-mtt" && tournamentStateRef.current?.isFinished) {
        return false;
      }
      let snapshot =
        Array.isArray(prevPlayers) && prevPlayers.length
          ? prevPlayers
          : playersRef.current ?? players;
      if (!canContinueGame(snapshot)) {
        if (mode !== "tournament-mtt") {
          const recoveredSnapshot = buildCashNextHandSnapshot(snapshot);
          if (canContinueGame(recoveredSnapshot)) {
            console.warn("[HAND] cash table recovered with rebuy stacks for next hand.");
            snapshot = recoveredSnapshot;
            setPlayers(recoveredSnapshot);
            playersRef.current = recoveredSnapshot;
          }
        }
        if (!canContinueGame(snapshot)) {
          console.warn("[HAND] Unable to continue – not enough active players.");
          setPhase("TABLE_FINISHED");
          setShowNextButton(false);
          setHandResultVisible(false);
          return false;
        }
      }
      if (!handSavedRef.current) {
        trySaveHandOnceRef.current({
          playersSnap: playersRef.current ?? players,
          dealerIdx,
          pots: potsRef.current ?? pots,
        });
      }
      let targetDealerIdx =
        typeof dealerOverride === "number" ? dealerOverride : dealerIdx;
      if (handCountRef.current === 0 && typeof dealerOverride !== "number") {
        const randomizedSeat = initializeButtonForFirstHand(snapshot);
        if (typeof randomizedSeat === "number") {
          targetDealerIdx = randomizedSeat;
          if (typeof tableMetadataRef.current?.firstButtonSeat !== "number") {
            tableMetadataRef.current = {
              ...(tableMetadataRef.current ?? {}),
              firstButtonSeat: randomizedSeat,
            };
          }
        }
      } else if (handCountRef.current > 0 && typeof dealerOverride !== "number") {
        const candidate = nextAliveSeat(snapshot, dealerIdx);
        if (typeof candidate === "number") {
          targetDealerIdx = candidate;
        } else {
          console.warn("[HAND] No eligible players remain to assign the button.");
          setShowNextButton(false);
          setHandResultVisible(false);
          return false;
        }
      }
      const nextHandNumber = handCountRef.current + 1;
      const success = dealNewHandRef.current(
        targetDealerIdx,
        snapshot,
        nextHandNumber,
      );
      if (success) {
        handCountRef.current = nextHandNumber;
      }
      return success;
    },
    [buildCashNextHandSnapshot, dealerIdx, mode, phase, players, pots],
  );
  startNextHandRef.current = startNextHand;

  useEffect(() => {
    if (!pendingRingStartRef.current) return;
    if (currentScreen !== "gameRing") return;
    pendingRingStartRef.current = false;
    startNextHandRef.current({ dealerOverride: 0 });
  }, [currentScreen, gameVariant]);

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

  const drawSelectedRef = useRef(() => {});
  drawSelectedRef.current = drawSelected;

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
    const forceHeroDraw = () => drawSelectedRef.current();
    e2eDriverApiRef.current = {
      forceSeatAction: (seat, payload = {}) =>
        queueForcedSeatAction(seat, { ...payload, __forceInstant: true }),
      forceSequentialFolds,
      forceAllIn: forceAllInAction,
      forceHeroDraw,
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
      getHandHistory: () => getHandHistoryBufferSnapshot(),
      getCurrentHandHistory: () => getCurrentHandHistorySnapshot(),
      getLastPotSummary: () => lastPotSummaryRef.current,
      getTournamentHudState: () => getTournamentHudSnapshotRef.current(),
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
  ]);

  useEffect(() => installE2eTestDriver(e2eDriverApiRef), []);

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
      activeBlindStructure[blindLevelIndex] ??
      activeBlindStructure[lastStructureIndex] ??
      TOURNAMENT_STRUCTURE[0];
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
        const applied = applyChips(pl, anteValue);
        pl.betThisRound += applied;
        if (pl.stack === 0) {
          pl.allIn = true;
          pl.hasActedThisRound = true;
        }
      });
    }

    const sbPay = applyChips(newPlayers[0], sbValue);
    newPlayers[0].betThisRound += sbPay;
    if (newPlayers[0].stack === 0) {
      newPlayers[0].allIn = true;
      newPlayers[0].hasActedThisRound = true;
    }
    const bbPay = applyChips(newPlayers[1], bbValue);
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
    resetInitialButtonState();
    startNextHandRef.current({ dealerOverride: 0 });
  }, [resetInitialButtonState]);

  useEffect(() => {
    debugLogRef.current(
      `[STATE] phase=${phase}, drawRound=${drawRound}, turn=${turn}, currentBet=${currentBet}`
    );
  }, [phase, drawRound, turn, currentBet]);

  useEffect(() => {
    if (!gameControllerRef.current) return;
    if (typeof gameControllerRef.current.syncExternalState !== "function") return;
    const phaseTag = phaseTagLocalRef.current();
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
    return base.map((player) => {
      if (!player) return player;
      if (typeof player.lastAction === "string" && player.lastAction.trim().length > 0) {
        return player;
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
    trace("afterBetActionWithSnapshot()", { phase, drawRound, actedIndex });
    if (transitioning) {
      const interimBet = maxBetThisRound(snap);
      const transitionSnapshot = applyDeckSnapshot({
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
      syncEngineSnapshot(transitionSnapshot);
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
    const finishBetRoundSafely = (reason) =>
      forceFinishRound({
        reason,
        phaseOverride: "BET",
        playersSnapshot: snap,
        potsSnapshot: pots,
        drawRoundIndex: drawRound,
        dealerIndex: dealerIdx,
      });
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
        finishBetRoundSafely("bet-fold-no-next");
        return;
      }
    }

    let resolvedBetHead = betHead;
    let resolvedLastAggressor = lastAggressor;
    const actedLabel = String(actedPlayer?.lastAction ?? "").toUpperCase();
    const actedAggressive =
      actedLabel.startsWith("RAISE") ||
      actedLabel.startsWith("BET");
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

    const snapshotForUi = applyDeckSnapshot({
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
    });
    console.log("[BET][SNAPSHOT_OUT]", {
      actedIndex,
      nextTurn: snapshotForUi.nextTurn,
      betHead: snapshotForUi.metadata.betHead,
    });
    syncEngineSnapshot(snapshotForUi);
    const sessionUiForAction =
      !isTournament
        ? syncSessionFromSnapshot(snapshotForUi, null, { reason: "action" })
        : null;

    if (checkIfOneLeftThenEnd(snap)) return;

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
        finishBetRoundSafely("bet-analysis-advance");
        return;
      }
      if (resolvedNext === null || typeof resolvedNext !== "number") {
        debugLog("[BET] No next alive player, forcing finish");
        finishBetRoundSafely("bet-no-next-actor");
        return;
      }
      setTurn(resolvedNext);
      if (!isTournament) {
        if (sessionUiForAction) {
          updateAfterActionFromSnapshot(sessionUiForAction);
        } else {
          if (isSingleTableBadugi) {
            warnLegacySingleTablePath("updateAfterAction fallback - BET");
          }
          updateAfterAction({
            players: snap.map((player) => ({ ...player })),
            pots: pots.map((pot) => ({ ...pot })),
            phase: "BET",
            drawRound,
            betRoundIndex,
            turnSeat: resolvedNext ?? turn,
            betHead: resolvedBetHead,
            lastAggressor: resolvedLastAggressor,
            currentBet: maxNow,
            raiseStats: {
              raiseCountThisRound,
              raisePerRound,
              raisePerSeatRound,
            },
            actionLog,
            overlays: {
              showNextButton,
            },
          });
        }
      }
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

      if (allActiveDrawn || nextIdx === null) {
        forceFinishRound({
          reason: allActiveDrawn ? "draw-all-acted" : "draw-no-next-actor",
          phaseOverride: "DRAW",
          playersSnapshot: playersRef.current ?? snap,
        });
        return;
      }
      if (turn !== nextIdx) {
        setTurn(nextIdx);
        if (!isTournament) {
        if (sessionUiForAction) {
          updateAfterActionFromSnapshot(sessionUiForAction);
        } else {
            if (isSingleTableBadugi) {
              warnLegacySingleTablePath("updateAfterAction fallback - DRAW");
            }
            updateAfterAction({
              players: snap.map((player) => ({ ...player })),
              pots: pots.map((pot) => ({ ...pot })),
              phase: "DRAW",
              drawRound,
              betRoundIndex,
              turnSeat: nextIdx,
              betHead: resolvedBetHead,
              lastAggressor: resolvedLastAggressor,
              currentBet: maxNow,
              raiseStats: {
                raiseCountThisRound,
                raisePerRound,
                raisePerSeatRound,
              },
              actionLog,
              overlays: {
                showNextButton,
              },
            });
          }
        }
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
      if (pl?.folded && Array.isArray(pl.hand) && pl.hand.length) {
        muck.push(...pl.hand);
        pl.hand = [];
      }
    });

    const dm = getDeckManager();
    if (!dm) return;
    if (muck.length) {
      dm.discard(muck);
    }
    if (muck.length || (dm.discardPile && dm.discardPile.length)) {
      dm.recycleNow([], { activeCards: collectActiveCards(snap) });
      debugLog(
        `[RECYCLE] +${muck.length} cards (folded) + existing discard -> new deck=${dm.deck.length}`
      );
      assertNoDuplicateCards("[RECYCLE][FOLDED]", {
        deck: dm.deck,
        discard: dm.discardPile,
        burn: dm.burnPile,
        ...buildSeatCardBuckets(snap),
      });
    }
  }

  function buildCanonicalWinnersFromSummary(summary = [], totalPotValue = 0, playersSnapshot = []) {
    const winnersMap = new Map();
    summary.forEach((pot) => {
      (pot?.payouts ?? []).forEach((payout) => {
        const seat =
          typeof payout?.seat === "number"
            ? payout.seat
            : typeof payout?.seatIndex === "number"
            ? payout.seatIndex
            : null;
        const amount = Number(payout?.payout ?? payout?.amount ?? 0);
        if (seat === null || !Number.isFinite(amount)) return;
        winnersMap.set(seat, (winnersMap.get(seat) ?? 0) + amount);
      });
    });
    if (winnersMap.size === 0 && Array.isArray(playersSnapshot) && playersSnapshot.length) {
      const survivors = playersSnapshot
        .map((player, seat) => ({ seat, player }))
        .filter(({ player }) => player && !player.folded);
      if (survivors.length === 1) {
        winnersMap.set(
          survivors[0].seat,
          Math.max(0, Number(totalPotValue) || 0),
        );
      }
    }
    return Array.from(winnersMap.entries()).map(([seat, amount]) => ({
      seat,
      amount: Math.max(0, Number(amount) || 0),
    }));
  }

  function finishDrawRound(snapOpt) {
    const basePlayers = Array.isArray(snapOpt) && snapOpt.length
      ? snapOpt
      : playersRef.current ?? players;
    const snap = Array.isArray(basePlayers)
      ? basePlayers.map((p) => (p ? { ...p } : p))
      : [];
    const streetLabel = phaseTagLocal();
    console.log("[DRAW][ROUND_COMPLETE]", {
      street: streetLabel,
      nextStreet: "BET",
      nextPhase: "BET",
      drawRound,
      players: snap.map((p, seat) => ({
        seat,
        name: p?.name,
        folded: Boolean(p?.folded),
        allIn: Boolean(p?.allIn),
        hasDrawn: Boolean(p?.hasDrawn),
      })),
    });
    const betRoundReady = resetBetRoundFlags(snap);
    const startSeat = (dealerIdx + 1) % NUM_PLAYERS;
    debugLog("[DRAW] -> finishDrawRound", { drawRound, startSeat, snap });

    // folded flags are left untouched here; folded players remain out until a new hand.

    const currentDraw = Math.max(0, Math.min(Number(drawRoundTracker.current) || 0, MAX_DRAWS));
    setBetRoundValue(currentDraw);
    setCurrentBet(0);
    setLastAggressor(null);
    setRaiseCountThisRound(0);
    const nextTurn = findNextActiveSeat(betRoundReady, startSeat);
    const resolvedTurn = typeof nextTurn === "number" ? nextTurn : startSeat;
    transitionToBetPhase({
      players: betRoundReady,
      setPlayers,
      setPhase,
      setTurn,
      setBetHead,
      turnSeat: resolvedTurn,
      betHeadSeat: startSeat,
      fromPhase: "DRAW",
      onPhaseTransition: logPhaseTransition,
    });
    const betTransitionSnapshot = applyDeckSnapshot({
      players: betRoundReady,
      pots,
      phase: "BET",
      drawRound: currentDraw,
      betRoundIndex: currentDraw,
      nextTurn: resolvedTurn,
      turn: resolvedTurn,
      currentBet: 0,
      betHead: startSeat,
      lastAggressor: null,
      metadata: {
        ...(engineStateRef.current?.metadata ?? {}),
        currentBet: 0,
        betHead: startSeat,
        lastAggressor: null,
        actingPlayerIndex: resolvedTurn,
        phase: "BET",
        drawRoundIndex: currentDraw,
        betRoundIndex: currentDraw,
        raiseCountThisRound: 0,
      },
    });
    syncEngineSnapshot(betTransitionSnapshot);
    if (!isTournament) {
      syncSessionFromSnapshot(
        {
          ...betTransitionSnapshot,
          phase: "BET",
          drawRound: currentDraw,
          betRoundIndex: currentDraw,
          dealerSeat: dealerIdx,
          currentBet: 0,
          betHead: startSeat,
          lastAggressor: null,
        },
        null,
        { reason: "action" },
      );
    }
  }

  function forceFinishRound({
    reason = "unspecified",
    phaseOverride = null,
    playersSnapshot = null,
    potsSnapshot = null,
    drawRoundIndex = null,
    dealerIndex = null,
  } = {}) {
    const phaseNow = phaseOverride ?? phaseRef.current ?? phase;
    if (phaseNow === "BET") {
      const basePlayers =
        Array.isArray(playersSnapshot) && playersSnapshot.length
          ? playersSnapshot
          : playersRef.current ?? [];
      const snap = Array.isArray(basePlayers)
        ? basePlayers.map(clonePlayerState).filter(Boolean)
        : [];
      const basePots =
        Array.isArray(potsSnapshot) && potsSnapshot.length
          ? potsSnapshot
          : potsRef.current ?? [];
      const potSnapshot = Array.isArray(basePots)
        ? basePots.map((pot) => (pot ? { ...pot } : pot))
        : [];
      const roundValue = Number.isFinite(drawRoundIndex)
        ? drawRoundIndex
        : Number.isFinite(drawRoundTracker.current)
        ? drawRoundTracker.current
        : 0;
      const dealerSeatValue = Number.isFinite(dealerIndex)
        ? dealerIndex
        : dealerIdx;
      if (transitioningRef.current) {
        debugLog("[ROUND_FORCE] Skip BET finish (transitioning)", { reason });
        return false;
      }
      debugLog("[ROUND_FORCE] Forcing BET finish", {
        reason,
        round: roundValue,
        dealerSeat: dealerSeatValue,
      });
      setTransitioning(true);
      transitioningRef.current = true;
      setTimeout(() => {
        try {
          const handled = handleEngineRoundTransition(roundValue, dealerSeatValue);
          if (!handled) {
            finishBetRoundFrom({
              players: snap,
              pots: potSnapshot,
              setPlayers,
              setPots,
              drawRound: roundValue,
              setDrawRound: setDrawRoundValue,
              setPhase,
              setTurn,
              dealerIdx: dealerSeatValue,
              NUM_PLAYERS,
              MAX_DRAWS,
              runShowdown,
              dealNewHand: (seat, snapshot) =>
                startNextHandRef.current({
                  dealerOverride: seat,
                  prevPlayers: snapshot,
                }),
              setShowNextButton,
              setBetHead,
              onPhaseTransition: logPhaseTransition,
              onShowdownEntered: logShowdownEvent,
            });
          }
        } finally {
          setTransitioning(false);
          transitioningRef.current = false;
        }
      }, 100);
      return true;
    }

    if (phaseNow === "DRAW") {
      if (transitioningRef.current || transitioning) {
        debugLog("[ROUND_FORCE] Skip DRAW finish (transitioning)", { reason });
        return false;
      }
      const basePlayers =
        Array.isArray(playersSnapshot) && playersSnapshot.length
          ? playersSnapshot
          : playersRef.current ?? [];
      const snap = Array.isArray(basePlayers)
        ? basePlayers.map(clonePlayerState).filter(Boolean)
        : [];
      debugLog("[ROUND_FORCE] Forcing DRAW finish", { reason });
      transitioningRef.current = true;
      setTransitioning(true);
      try {
        finishDrawRound(snap);
      } finally {
        transitioningRef.current = false;
        setTransitioning(false);
      }
      return true;
    }

    console.warn("[ROUND_FORCE] Unsupported phase for forced finish", {
      phase: phaseNow,
      reason,
    });
    return false;
  }

  /* --- actions: BET --- */
  function syncEngineSnapshot(snapshot, baseOverride = null) {
    if (!snapshot) return;
    const snapshotWithDeck = {
      ...snapshot,
      deck: Array.isArray(snapshot.deck) ? snapshot.deck : [],
      discard: Array.isArray(snapshot.discard) ? snapshot.discard : [],
      burn: Array.isArray(snapshot.burn) ? snapshot.burn : [],
    };
    const engineActingIndex =
      typeof snapshotWithDeck?.nextTurn === "number"
        ? snapshotWithDeck.nextTurn
        : typeof snapshotWithDeck?.turn === "number"
        ? snapshotWithDeck.turn
        : typeof snapshotWithDeck?.metadata?.actingPlayerIndex === "number"
        ? snapshotWithDeck.metadata.actingPlayerIndex
        : null;
    const snapshotWithTurn = {
      ...snapshotWithDeck,
      nextTurn: engineActingIndex,
      turn: engineActingIndex,
      metadata: {
        ...(snapshotWithDeck.metadata ?? {}),
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
          handId: tableMetadataRef.current?.handId ?? handIdRef.current ?? null,
        },
        currentBet,
        betHead,
        lastAggressor,
        turn,
        deck: Array.isArray(deck) ? deck : snapshotWithDeck.deck,
        discard: snapshotWithDeck.discard,
        burn: snapshotWithDeck.burn,
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
      ...snapshotWithDeck,
      players: normalizedPlayers,
      pots: merged.pots,
      deck: merged.deck,
      discard: merged.discard,
      burn: merged.burn,
      metadata: merged.metadata,
      gameId: merged.gameId ?? stageGameId,
      engineId: merged.engineId ?? stageGameId,
    };
    engineStateRef.current = normalizedSnapshot;
    setEngineState(normalizedSnapshot);
    console.log("[DECK][UI_AFTER_SYNC]", {
      context: "[SYNC_ENGINE_SNAPSHOT]",
      deck: normalizedSnapshot.deck,
      discard: normalizedSnapshot.discard,
      burn: normalizedSnapshot.burn,
    });
    console.log("[DECK][UI_AFTER_SYNC_FULL]", {
      deck: normalizedSnapshot.deck,
      discard: normalizedSnapshot.discard,
      burn: normalizedSnapshot.burn,
      seats: (normalizedSnapshot.players ?? []).map((player) => player?.hand ?? []),
    });
  }

  function playerFold() {
    if (phase !== "BET") return;

    const basePlayers = playersRef.current ?? players;
    if (!ensureSeatCanAct(0, "playerFold")) return;
    const heroBefore = basePlayers[0] ? { ...basePlayers[0] } : null;
    if (!heroBefore || heroBefore.folded || isFoldedOrOut(heroBefore)) return;

    const controllerHandled = tryControllerBetAction({
      actionType: "fold",
      seatIndex: 0,
    });
    if (controllerHandled?.snapshot) {
      const heroAfter =
        controllerHandled.snapshot.players?.[0] ?? heroBefore;
      recordActionToLog({
        phase: "BET",
        round: currentBetRoundIndex(),
        seat: 0,
        playerState: heroAfter,
        type: "Fold",
        stackBefore: heroBefore.stack,
        stackAfter: heroAfter?.stack ?? heroBefore.stack,
        betBefore: heroBefore.betThisRound ?? 0,
        betAfter: heroAfter?.betThisRound ?? heroBefore.betThisRound ?? 0,
        raiseCountTable: raiseCountThisRound,
      });
      syncLegacyFromControllerSnapshot(controllerHandled.snapshot, {
        seatIndex: 0,
      });
      return;
    }
    if (controllerHandled?.rejected) {
      console.warn("[CTRL][BET] hero fold rejected", {
        code: controllerHandled?.code ?? null,
        message: controllerHandled?.message ?? "action rejected",
      });
      return;
    }
    if (isSingleTableBadugi) {
      warnLegacySingleTablePath("hero-fold fallback");
    }

    const snap = basePlayers.map(clonePlayerState).filter(Boolean);
    const me = snap[0];
    const stackBefore = me.stack;
    const betBefore = me.betThisRound;

    markPlayerFolded(me);
    me.lastAction = "Fold";

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

  function reconcilePlayersForShowdown(playersSnapshot = []) {
    if (!Array.isArray(playersSnapshot)) return [];
    const recordedSeats = currentHandHistoryRef.current?.seats ?? [];
    const startStacksBySeat = Array.isArray(handStartStacksRef.current)
      ? handStartStacksRef.current
      : [];
    const paidActionTypes = new Set(["blind", "ante", "call", "raise", "bet", "all-in"]);

    return playersSnapshot.map((player, seatIndex) => {
      if (!player) return player;
      const stack = Math.max(0, Number(player.stack) || 0);
      const existingInvested = Math.max(0, Number(player.totalInvested) || 0);
      const historyStart = Number(recordedSeats?.[seatIndex]?.startStack);
      const runtimeStart = Number(startStacksBySeat?.[seatIndex]);
      const resolvedStart = Number.isFinite(historyStart)
        ? historyStart
        : Number.isFinite(runtimeStart)
        ? runtimeStart
        : null;
      if (!Number.isFinite(resolvedStart)) {
        const actionInvested =
          (recordedSeats?.[seatIndex]?.actions ?? []).reduce((sum, action) => {
            const type = String(action?.type ?? "").toLowerCase();
            if (!paidActionTypes.has(type)) return sum;
            return sum + Math.max(0, Number(action?.amount) || 0);
          }, 0);
        const reconciledInvested = Math.max(existingInvested, actionInvested);
        if (reconciledInvested === existingInvested) return player;
        return { ...player, totalInvested: reconciledInvested };
      }
      const inferredInvested = Math.max(0, Math.round(resolvedStart - stack));
      const actionInvested =
        (recordedSeats?.[seatIndex]?.actions ?? []).reduce((sum, action) => {
          const type = String(action?.type ?? "").toLowerCase();
          if (!paidActionTypes.has(type)) return sum;
          return sum + Math.max(0, Number(action?.amount) || 0);
        }, 0);
      const reconciledInvested = Math.max(
        existingInvested,
        inferredInvested,
        actionInvested,
      );
      if (reconciledInvested === existingInvested) {
        return player;
      }
      return {
        ...player,
        totalInvested: reconciledInvested,
      };
    });
  }

  function onHandFinished() {
    debugLog("[HAND] onHandFinished triggered");
  }

  function finishHand({
    playersSnapshot = playersRef.current ?? players,
    summary = [],
    totalPot = null,
    precomputedResult = null,
  } = {}) {
    const finalPlayers = Array.isArray(playersSnapshot)
      ? playersSnapshot.map((player) => (player ? { ...player } : player))
      : [];
    const metadataForHand = tableMetadataRef.current ?? {};
    const buttonSeatMeta =
      typeof metadataForHand.buttonSeat === "number" ? metadataForHand.buttonSeat : dealerIdx;
    const sbSeatMeta =
      typeof metadataForHand.sbSeat === "number" ? metadataForHand.sbSeat : null;
    const bbSeatMeta =
      typeof metadataForHand.bbSeat === "number" ? metadataForHand.bbSeat : null;
    const totalPotValue =
      typeof totalPot === "number" && !Number.isNaN(totalPot)
        ? totalPot
        : Array.isArray(summary)
        ? summary.reduce(
            (acc, pot) => acc + Math.max(0, pot?.potAmount ?? pot?.amount ?? 0),
            0,
          )
        : 0;
    const controller = gameControllerRef.current;
    const resolvedSummary =
      precomputedResult ??
      controller?.resolveShowdown({
        players: finalPlayers,
        summary,
        totalPot: totalPotValue,
        handId: handIdRef.current,
        evaluateHand: evaluateBadugi,
        buttonSeat: buttonSeatMeta,
        sbSeat: sbSeatMeta,
        bbSeat: bbSeatMeta,
      }) ??
      buildHandResultSummary({
        players: finalPlayers,
        summary,
        totalPot: totalPotValue,
        handId: handIdRef.current,
        evaluateHand: evaluateBadugi,
        buttonSeat: buttonSeatMeta,
        sbSeat: sbSeatMeta,
        bbSeat: bbSeatMeta,
      });
    const summaryWithContext = {
      ...resolvedSummary,
      buttonSeat:
        typeof resolvedSummary.buttonSeat === "number" ? resolvedSummary.buttonSeat : buttonSeatMeta,
      sbSeat: typeof resolvedSummary.sbSeat === "number" ? resolvedSummary.sbSeat : sbSeatMeta,
      bbSeat: typeof resolvedSummary.bbSeat === "number" ? resolvedSummary.bbSeat : bbSeatMeta,
    };
    setHandResultSummary(summaryWithContext);
    setHandResultVisible(true);
    const finishedAt = Date.now();
    tableMetadataRef.current = {
      ...metadataForHand,
      totalPot: summaryWithContext?.pot ?? totalPotValue,
      endTimestamp: finishedAt,
      lastSummary: summaryWithContext,
    };
    if (!isTournament) {
      updateShowdown({
        phase: "SHOWDOWN",
        players: finalPlayers.map((player) => ({ ...player })),
        pots: summary.map((pot) => ({ ...pot })),
        handResultVisible: true,
        handResultSummary: summaryWithContext,
        showNextButton: true,
      });
    }
    setPhase("HAND_RESULT");
    const finalizedRecord = finalizeHandHistoryRecord({
      players: finalPlayers,
      pots: summary,
      uiSummary: summaryWithContext,
      endedAt: finishedAt,
    });
    let legacySnapshot = null;
    if (finalizedRecord) {
      legacySnapshot = cloneHandHistory(finalizedRecord);
      if (legacySnapshot) {
        console.log("[HAND_HISTORY]", JSON.stringify(legacySnapshot));
        const followUpSummary = buildPostMatchFollowUpSummary(legacySnapshot);
        if (!isTournament && followUpSummary.issueCount > 0) {
          const summaryWithFollowUp = {
            ...summaryWithContext,
            followUpSummary,
          };
          setHandResultSummary((prev) =>
            prev
              ? {
                  ...prev,
                  followUpSummary,
                }
              : prev,
          );
          updateShowdown({
            handResultVisible: true,
            handResultSummary: summaryWithFollowUp,
          });
        }
        if (isSingleTableDrawLowball) {
          saveRLHandHistory(legacySnapshot);
          const sendId = legacySnapshot.handId ?? legacySnapshot.hand_id ?? legacySnapshot.id;
          if (sendId && !sentHandIdsRef.current.has(sendId)) {
            try {
              enqueueHandRecord(legacySnapshot, { flushNow: true });
              sentHandIdsRef.current.add(sendId);
            } catch (err) {
              console.warn("[sync] draw hand-history enqueue failed", err);
            }
          }
          handSavedRef.current = true;
        }
      } else {
        console.warn("[HAND_HISTORY] Failed to clone legacy hand history record");
      }
      resetHandHistoryRecord();
      currentHandHistoryRef.current = null;
    }
    const canonicalWinners = buildCanonicalWinnersFromSummary(
      summary,
      summaryWithContext?.pot ?? totalPotValue,
      finalPlayers,
    );
    finalizeCanonicalHandHistory({
      winners: canonicalWinners,
      totalPot: summaryWithContext?.pot ?? totalPotValue,
      legacyRecord: legacySnapshot,
      playersSnapshot: finalPlayers,
    });
    const canPlayNext = canContinueGame(finalPlayers);
    if (canPlayNext) {
      setPhase("WAITING_NEXT_HAND");
      setShowNextButton(true);
    } else {
      setPhase("TABLE_FINISHED");
      setShowNextButton(false);
    }
    return summaryWithContext;
  }

  function handleShowdownResult(updatedPlayers, totalPot, summary, showdownToken = null) {
    if (
      typeof showdownToken === "number" &&
      showdownToken !== showdownTokenRef.current
    ) {
      console.warn("[SHOWDOWN] stale completion ignored", {
        token: showdownToken,
        activeToken: showdownTokenRef.current,
        handId: handIdRef.current,
      });
      return;
    }
    finishHand({
      playersSnapshot: updatedPlayers,
      summary: Array.isArray(summary) ? summary : [],
      totalPot,
    });
  }

  function handleEngineShowdown(
    drawRoundParam = drawRound,
    { playersOverride = null, potsOverride = null } = {},
  ) {
    if (!engine) return false;
    const baseState = getEngineBaseState();
    const candidatePlayers = Array.isArray(playersOverride)
      ? playersOverride
      : baseState?.players ?? [];
    const candidatePots = Array.isArray(potsOverride) ? potsOverride : baseState?.pots ?? [];
    const reconciledPlayers = reconcilePlayersForShowdown(
      candidatePlayers.map(clonePlayerState).filter(Boolean),
    );
    const showdownState = {
      ...baseState,
      players: reconciledPlayers,
      pots: candidatePots,
      metadata: {
        ...(baseState?.metadata ?? {}),
        currentBet: baseState?.metadata?.currentBet ?? currentBet ?? 0,
        betHead: baseState?.metadata?.betHead ?? betHead ?? null,
        lastAggressor: baseState?.metadata?.lastAggressor ?? lastAggressor ?? null,
        actingPlayerIndex: null,
      },
    };
    const outcome = engine.resolveShowdown(showdownState, { cloneState: false });
    if (!outcome?.state) return false;
    const showdownSnapshot = applyDeckSnapshot({
      players: outcome.state.players,
      pots: outcome.state.pots,
      nextTurn: null,
      turn: null,
      metadata: outcome.state.metadata,
    });
    syncEngineSnapshot(showdownSnapshot);
    const showdownToken = showdownTokenRef.current + 1;
    showdownTokenRef.current = showdownToken;
    runShowdown({
      players: outcome.state.players,
      setPlayers,
      pots: outcome.state.pots,
      setPots,
      dealerIdx,
      dealNewHand: (seat, snapshot) =>
        startNextHand({
          dealerOverride: seat,
          prevPlayers: snapshot,
        }),
      setShowNextButton,
      setPhase,
      setDrawRound: setDrawRoundValue,
      setTurn,
      setTransitioning,
      setCurrentBet,
      recordActionToLog,
      drawRound: drawRoundParam,
      onHandFinished,
      onShowdownComplete: (updatedPlayers, totalPot, summary) =>
        handleShowdownResult(updatedPlayers, totalPot, summary, showdownToken),
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
    const reconciledBaseState = {
      ...baseState,
      players: reconcilePlayersForShowdown(
        (baseState?.players ?? []).map(clonePlayerState).filter(Boolean),
      ),
    };
    const outcome = engine.advanceAfterBet(reconciledBaseState, {
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
        : typeof state.actingPlayerIndex === "number"
        ? state.actingPlayerIndex
        : typeof mergedMetadata.actingPlayerIndex === "number"
        ? mergedMetadata.actingPlayerIndex
        : null;
    const transitionSnapshot = applyDeckSnapshot({
      players: state.players,
      pots: state.pots,
      nextTurn: nextTurnValue,
      turn: nextTurnValue,
      metadata: mergedMetadata,
    });
    syncEngineSnapshot(transitionSnapshot);
    if (!isTournament) {
      const sessionPhase =
        outcome.street === "DRAW"
          ? "DRAW"
          : outcome.street === "SHOWDOWN"
          ? "SHOWDOWN"
          : phaseRef.current ?? phase;
      const sessionRound =
        outcome.street === "DRAW"
          ? Number.isFinite(outcome.drawRoundIndex)
            ? outcome.drawRoundIndex
            : drawRoundValue + 1
          : drawRoundValue;
      syncSessionFromSnapshot(
        {
          ...transitionSnapshot,
          phase: sessionPhase,
          drawRound: sessionRound,
          betRoundIndex: sessionRound,
          dealerSeat: dealerIndexValue,
          currentBet: mergedMetadata.currentBet ?? 0,
          betHead: mergedMetadata.betHead ?? null,
          lastAggressor: mergedMetadata.lastAggressor ?? null,
        },
        null,
        { reason: "action" },
      );
    }

    if (outcome.showdown || outcome.street === "SHOWDOWN") {
      const showdownToken = showdownTokenRef.current + 1;
      showdownTokenRef.current = showdownToken;
      transitionToShowdownPhase({
        players: state.players,
        pots: state.pots,
        setPlayers,
        setPots,
        setPhase,
        dealerIdx: dealerIndexValue,
        drawRound: drawRoundValue,
        runShowdown,
        dealNewHand: (seat, snapshot) =>
          startNextHand({
            dealerOverride: seat,
            prevPlayers: snapshot,
          }),
        setShowNextButton,
        onShowdownComplete: (updatedPlayers, totalPot, summary) =>
          handleShowdownResult(updatedPlayers, totalPot, summary, showdownToken),
        engineResolveShowdown: () => outcome,
        precomputedResult: {
          summary: outcome.showdownSummary ?? outcome.summary ?? [],
          totalPot:
            outcome.totalPot ??
            outcome.showdownTotal ??
            outcome.state?.metadata?.showdownTotal ??
            0,
          players: state.players,
          pots: state.pots,
        },
        fromPhase: "BET",
        onPhaseTransition: logPhaseTransition,
        onShowdownEntered: logShowdownEvent,
        recordActionToLog,
        onHandFinished,
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
      const handleDrawSkip = ({ players: skipPlayers }) => {
        const betReady = resetBetRoundFlags(skipPlayers ?? state.players ?? []);
        const startSeat = sbIndex(dealerIndexValue);
        const resolvedTurn =
          findNextActiveSeat(betReady, startSeat) ?? startSeat;
        setDrawRoundValue(normalizedDraw);
        setBetRoundValue(normalizedDraw);
        setCurrentBet(0);
        setLastAggressor(null);
        setRaiseCountThisRound(0);
        transitionToBetPhase({
          players: betReady,
          setPlayers,
          setPhase,
          setTurn,
          setBetHead,
          turnSeat: resolvedTurn,
          betHeadSeat: startSeat,
          fromPhase: "DRAW",
          onPhaseTransition: logPhaseTransition,
        });
        if (!isTournament) {
          syncSessionFromSnapshot(
            applyDeckSnapshot({
              players: betReady,
              pots: state.pots ?? [],
              phase: "BET",
              drawRound: normalizedDraw,
              betRoundIndex: normalizedDraw,
              dealerSeat: dealerIndexValue,
              nextTurn: resolvedTurn,
              turn: resolvedTurn,
              currentBet: 0,
              betHead: startSeat,
              lastAggressor: null,
              metadata: {
                ...(mergedMetadata ?? {}),
                currentBet: 0,
                betHead: startSeat,
                lastAggressor: null,
                actingPlayerIndex: resolvedTurn,
                phase: "BET",
              },
            }),
            null,
            { reason: "action" },
          );
        }
      };
      const enteredDraw = transitionToDrawPhase({
        players: state.players,
        pots: state.pots,
        setPlayers,
        setPots,
        setPhase,
        setDrawRound: setDrawRoundValue,
        setTurn,
        dealerIdx: dealerIndexValue,
        nextRound: normalizedDraw,
        actingPlayerIndex: outcome.actingPlayerIndex,
        NUM_PLAYERS,
        setTransitioning,
        onPhaseTransition: logPhaseTransition,
        fromPhase: "BET",
        meta: mergedMetadata,
        onSkipDrawRound: ({ players: skipPlayers }) =>
          handleDrawSkip({ players: skipPlayers }),
      });
      if (enteredDraw === false) {
        return true;
      }
      setBetRoundValue(normalizedDraw);
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
    const pay = toCall;
    const controllerOutcome = tryControllerBetAction({
      actionType: toCall === 0 ? "check" : "call",
      amount: toCall,
      seatIndex: 0,
    });
    if (controllerOutcome?.snapshot) {
      const heroAfter = controllerOutcome.snapshot.players?.[0] ?? me;
      const actionLabel =
        toCall === 0
          ? "Check"
          : heroAfter.stack === 0 && heroAfter.betThisRound > betBefore
          ? "Call (All-in)"
          : "Call";
      logAction(0, actionLabel, { toCall, pay: Math.min(heroAfter.betThisRound - betBefore, toCall), newBet: heroAfter.betThisRound });
      recordActionToLog({
        phase: "BET",
        round: currentBetRoundIndex(),
        seat: 0,
        playerState: heroAfter,
        type: actionLabel,
        stackBefore,
        stackAfter: heroAfter.stack ?? stackBefore,
        betBefore,
        betAfter: heroAfter.betThisRound ?? betBefore,
        raiseCountTable: raiseCountThisRound,
      });
      syncLegacyFromControllerSnapshot(controllerOutcome.snapshot, {
        seatIndex: 0,
      });
      return;
    }
    if (controllerOutcome?.rejected) {
      console.warn("[CTRL][BET] hero call/check rejected", {
        code: controllerOutcome?.code ?? null,
        message: controllerOutcome?.message ?? "action rejected",
      });
      return;
    }
    if (isSingleTableBadugi) {
      warnLegacySingleTablePath("hero-call/check fallback");
    }

    const applied = applyChips(me, pay);
    me.betThisRound += applied;
    me.lastAction = toCall === 0 ? "Check" : applied < toCall ? "Call (All-in)" : "Call";
    logAction(0, me.lastAction, { toCall, pay: applied, newBet: me.betThisRound });
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
    const controllerOutcome = tryControllerBetAction({
      actionType: "check",
      seatIndex: 0,
    });
    if (controllerOutcome?.snapshot) {
      const heroAfter = controllerOutcome.snapshot.players?.[0] ?? me;
      logAction(0, "Check");
      recordActionToLog({
        phase: "BET",
        round: currentBetRoundIndex(),
        seat: 0,
        playerState: heroAfter,
        type: "Check",
        stackBefore: me.stack,
        stackAfter: heroAfter?.stack ?? me.stack,
        betBefore: me.betThisRound,
        betAfter: heroAfter?.betThisRound ?? me.betThisRound,
        raiseCountTable: raiseCountThisRound,
      });
      syncLegacyFromControllerSnapshot(controllerOutcome.snapshot, {
        seatIndex: 0,
      });
      return;
    }
    if (controllerOutcome?.rejected) {
      console.warn("[CTRL][BET] hero check rejected", {
        code: controllerOutcome?.code ?? null,
        message: controllerOutcome?.message ?? "action rejected",
      });
      return;
    }
    if (isSingleTableBadugi) {
      warnLegacySingleTablePath("hero-check fallback");
    }
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

    const maxNow = maxBetThisRound(snap);
    const toCall = Math.max(0, maxNow - me.betThisRound);
    const raiseAmt = betSize;
    const total = toCall + raiseAmt;

    const controllerOutcome = tryControllerBetAction({
      actionType: "raise",
      amount: raiseAmt,
      seatIndex: 0,
    });
    if (controllerOutcome?.snapshot) {
      const heroAfter = controllerOutcome.snapshot.players?.[0] ?? me;
      const payApplied =
        (heroAfter.betThisRound ?? betBefore) - betBefore;
      const actionLabel =
        heroAfter.stack === 0 && payApplied < total ? "Raise (All-in)" : "Raise";
      setRaiseCountThisRound((c) => c + 1);
      setBetHead(0);
      setLastAggressor(0);
      logAction(0, actionLabel, {
        toCall,
        raise: raiseAmt,
        pay: payApplied,
        newBet: heroAfter.betThisRound ?? betBefore,
        raiseCount: raiseCountThisRound + 1,
      });
      const newMax = maxBetThisRound(controllerOutcome.snapshot.players ?? []);
      if (currentBet !== newMax) setCurrentBet(newMax);
      recordActionToLog({
        phase: "BET",
        round: currentBetRoundIndex(),
        seat: 0,
        playerState: heroAfter,
        type: actionLabel,
        stackBefore,
        stackAfter: heroAfter.stack ?? me.stack,
        betBefore,
        betAfter: heroAfter.betThisRound ?? betBefore,
        raiseCountTable: raiseCountThisRound + 1,
      });
      syncLegacyFromControllerSnapshot(controllerOutcome.snapshot, {
        seatIndex: 0,
      });
      return;
    }
    if (controllerOutcome?.rejected) {
      if (controllerOutcome.code === "FL_RAISE_CAP") {
        playerCall();
        return;
      }
      console.warn("[CTRL][BET] hero raise rejected", {
        code: controllerOutcome?.code ?? null,
        message: controllerOutcome?.message ?? "action rejected",
      });
      return;
    }
    if (isSingleTableBadugi) {
      warnLegacySingleTablePath("hero-raise fallback");
    }

    const pay = total;
    const applied = applyChips(me, pay);
    me.betThisRound += applied;
    me.lastAction = applied < total ? "Raise (All-in)" : "Raise";
    
    if (me.stack === 0) me.allIn = true;
    me.hasActedThisRound = true;

    snap[0] = me;

    setRaiseCountThisRound((c) => c + 1);

    setBetHead(0);
    setLastAggressor(0);

     logAction(0, me.lastAction, {
       toCall,
       raise: raiseAmt,
       pay: applied,
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
    if (isSingleTableDrawLowball) {
      const controllerDrawOutcome = tryControllerBetAction({
        actionType: "draw",
        seatIndex: 0,
        metadata: {
          discardIndexes: sel.map((idx) => idx),
          drawIndexes: sel.map((idx) => idx),
          drawRound,
        },
      });
      if (controllerDrawOutcome?.snapshot) {
        const heroAfter = controllerDrawOutcome.snapshot.players?.[0] ?? p;
        setHeroDrawSelection([]);
        recordActionToLog({
          phase: "DRAW",
          round: drawRound + 1,
          seat: 0,
          playerState: heroAfter,
          type: heroAfter.lastAction ?? (sel.length === 0 ? "Pat" : `DRAW (${sel.length})`),
          stackBefore: p.stack,
          stackAfter: heroAfter.stack ?? p.stack,
          betBefore: p.betThisRound,
          betAfter: heroAfter.betThisRound ?? p.betThisRound,
          raiseCountTable: raiseCountThisRound,
          metadata: {
            drawInfo: {
              drawCount: sel.length,
              drawIndexes: sel.map((idx) => idx),
              before: Array.isArray(p.hand) ? [...p.hand] : [],
              after: Array.isArray(heroAfter.hand) ? [...heroAfter.hand] : [],
            },
          },
        });
        syncLegacyFromControllerSnapshot(controllerDrawOutcome.snapshot, {
          seatIndex: 0,
        });
        return;
      }
      if (controllerDrawOutcome?.rejected) {
        console.warn("[CTRL][DRAW] hero draw rejected", {
          code: controllerDrawOutcome?.code ?? null,
          message: controllerDrawOutcome?.message ?? "action rejected",
        });
        return;
      }
    }
    const activeCardsBeforeDraw = collectActiveCards(basePlayers);
    const stackBefore = p.stack;
    const betBefore = p.betThisRound;
    debugLog("[HERO][DRAW_REQUEST]", {
      heroSeatIndex,
      selectedIndices: sel,
      canDraw: heroCanDraw,
      phase: controlsPhase,
    });

    try {
      assertNoDuplicateCards("[DRAW][HERO][BEFORE]", {
        deck: deckManager?.deck,
        discard: deckManager?.discardPile,
        burn: deckManager?.burnPile,
        ...buildSeatCardBuckets(basePlayers),
      });
    } catch (err) {
      console.error(err);
      throw err;
    }

    const heroSeatHandsBefore = snapshotSeatHands(basePlayers);
    const heroDeckSnapshotBefore =
      typeof deckManager?.snapshot === "function" ? deckManager.snapshot() : null;
    if (heroDeckSnapshotBefore) {
      console.log("[DECK][UI_BEFORE_DRAW]", {
        context: "[DRAW][HERO]",
        snapshot: heroDeckSnapshotBefore,
        seats: heroSeatHandsBefore,
      });
    }

    let heroDrawLogEntry = null;
    if (sel.length > 0) {
      const beforeHand = [...p.hand];
      const replaced = [];
      const newHand = [...p.hand];

      sel.forEach((i) => {
        let pack = deckManager.draw(1, { activeCards: activeCardsBeforeDraw });
        if (!pack || pack.length === 0) {
          recycleFoldedAndDiscardsBeforeCurrent(newPlayers, 0);
          pack = deckManager.draw(1, { activeCards: collectActiveCards(newPlayers) });
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
      heroDrawLogEntry = {
        phase: "DRAW",
        round: drawRound + 1,
        seat: 0,
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
      };
    } else {
      p.lastAction = "Pat";
      heroDrawLogEntry = {
        phase: "DRAW",
        round: drawRound + 1,
        seat: 0,
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
      };
    }

    const heroDeckSnapshotAfter =
      typeof deckManager?.snapshot === "function" ? deckManager.snapshot() : null;
    if (heroDeckSnapshotAfter) {
      console.log("[DECK][UI_AFTER_DRAW]", {
        context: "[DRAW][HERO]",
        snapshot: heroDeckSnapshotAfter,
        seats: snapshotSeatHands(newPlayers),
      });
    }

    verifyDeckIntegrityOrThrow("[DRAW][HERO][AFTER]", newPlayers);

    p.selected = [];
    p.hasDrawn = true;
    p.hasActedThisRound = true;
    p.lastDrawCount = sel.length;
    newPlayers[0] = p;
    setHeroDrawSelection([]);

    try {
      const deckManagerState = getDeckManager();
      assertNoDuplicateCards("[DRAW][HERO]", {
        deck: deckManagerState?.deck,
        discard: deckManagerState?.discardPile,
        burn: deckManagerState?.burnPile,
        ...buildSeatCardBuckets(newPlayers),
      });
    } catch (err) {
      console.error(err);
      throw err;
    }

    const heroDrawInfo = heroDrawLogEntry?.metadata?.drawInfo;
    const controllerDrawMetadata = {
      drawCount: heroDrawInfo?.drawCount ?? sel.length,
      replacedCards: heroDrawInfo?.replacedCards
        ? heroDrawInfo.replacedCards.map((entry) => ({ ...entry }))
        : [],
      handAfter: heroDrawInfo?.after ? [...heroDrawInfo.after] : [...p.hand],
      drawIndexes: sel.map((idx) => idx),
      drawRound,
      actionLabel: heroDrawLogEntry?.type ?? p.lastAction,
    };
    const controllerDrawOutcome = tryControllerBetAction({
      actionType: "draw",
      seatIndex: 0,
      metadata: controllerDrawMetadata,
    });
    if (controllerDrawOutcome?.snapshot) {
      const controllerPlayers = controllerDrawOutcome.snapshot.players ?? [];
      const heroAfter = controllerPlayers[0] ?? p;
      if (heroDrawLogEntry) {
        recordActionToLog({
          ...heroDrawLogEntry,
          playerState: heroAfter,
        });
      }
      syncLegacyFromControllerSnapshot(controllerDrawOutcome.snapshot, {
        seatIndex: 0,
        scheduleAfterBet: true,
      });
      return;
    }
    if (isSingleTableBadugi) {
      warnLegacySingleTablePath("hero-draw fallback");
    }

    const committedSnapshot = newPlayers.map(clonePlayerState).filter(Boolean);
    if (heroDrawLogEntry) {
      recordActionToLog({
        ...heroDrawLogEntry,
        playerState: committedSnapshot[0] ?? p,
      });
    }
    setPlayerSnapshot(committedSnapshot);
    const nextHeroTurn = findNextDrawActorSeat(committedSnapshot, 1);
    const safeHeroDrawTurn =
      typeof nextHeroTurn === "number" ? nextHeroTurn : 0;
    const heroDrawSnapshot = applyDeckSnapshot({
      players: committedSnapshot,
      pots,
      nextTurn: safeHeroDrawTurn,
      turn: safeHeroDrawTurn,
      metadata: {
        currentBet,
        betHead,
        lastAggressor,
        actingPlayerIndex: safeHeroDrawTurn,
      },
    });
    syncEngineSnapshot(heroDrawSnapshot);
    setTimeout(
      () => afterBetActionWithSnapshot(committedSnapshot.map(clonePlayerState).filter(Boolean), 0),
      0
    );
  }

  /* --- NPC auto --- */
  useEffect(() => {
    const activePlayers = playersRef.current ?? [];
    if (!Array.isArray(activePlayers) || activePlayers.length === 0) return;
    const betHelpers = forcedBetHelpersRef.current;
    const drawHelpers = autoDrawHelpersRef.current;
    const seatCount = activePlayers.length;

    if (
      typeof turn !== "number" ||
      Number.isNaN(turn) ||
      turn < 0 ||
      turn >= seatCount
    ) {
      if (phase === "DRAW") {
        const drawFallback = drawHelpers.findNextDrawActorSeat?.(activePlayers) ?? null;
        if (drawFallback === null) {
          forceFinishRoundRef.current({
            reason: "draw-invalid-turn",
            phaseOverride: "DRAW",
            playersSnapshot: activePlayers,
          });
        } else {
          setTurn(drawFallback);
        }
      } else {
        const nextBetSeat = firstBetterAfterBlinds(activePlayers, dealerIdx);
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
    if (phase === "BET" && checkIfOneLeftThenEnd(activePlayers)) {
      return;
    }
    if (turn === 0) {
      if (shouldWaitForHeroDrawTurn({ phase, turn, players: activePlayers })) {
        return;
      }
      if (phase === "DRAW") {
        autoResolveCpuDrawIfNeeded();
        return;
      }
      return;
    }

    const p = activePlayers[turn];
    if (!p || isFoldedOrOut(p)) {
      betHelpers.logE2ESkip?.(turn, "folded_or_out");
      const nxt = nextAliveFrom(activePlayers, turn);
      if (nxt !== null) setTurn(nxt);
      return;
    }

    if (phase === "BET" && (p.allIn || p.stack <= 0)) {
      const maxNow = maxBetThisRound(activePlayers);
      const nextActor = findNextBetActorSeat(activePlayers, turn + 1, maxNow);
      if (nextActor !== null) {
        setTurn(nextActor);
        return;
      }
      forceFinishRoundRef.current({
        reason: "bet-all-in-no-next-actor",
        phaseOverride: "BET",
        playersSnapshot: activePlayers,
      });
      return;
    }

    const timer = setTimeout(() => {
      if (phase === "BET") {
        const basePlayers = playersRef.current ?? activePlayers;
        const snap = basePlayers.map(clonePlayerState).filter(Boolean);
        const activeSeat = turn;
        if (!betHelpers.ensureSeatCanAct?.(activeSeat, "npcBetAction")) {
          const nxt = nextAliveFrom(snap, turn);
          if (nxt !== null) setTurn(nxt);
          else {
            forceFinishRoundRef.current({
              reason: "npc-bet-seat-cannot-act-no-next",
              phaseOverride: "BET",
              playersSnapshot: snap,
            });
          }
          return;
        }
        if (checkIfOneLeftThenEnd(snap)) {
          return;
        }
        const me = snap[turn] ? { ...snap[turn] } : null;
        if (!me) return;
        if (isSingleTableDrawLowball) {
          const controller = sessionControllerRef.current;
          const controllerState = sessionControllerStateRef.current;
          const cpuAction =
            typeof controller?.getCpuAction === "function"
              ? controller.getCpuAction(controllerState, activeSeat)
              : null;
          const payload = cpuAction?.payload ?? cpuAction ?? null;
          const actionType = payload?.type ?? (maxBetThisRound(snap) > (me.betThisRound ?? 0) ? "CALL" : "CHECK");
          const amount =
            typeof payload?.amount === "number"
              ? payload.amount
              : Math.max(0, maxBetThisRound(snap) - (me.betThisRound ?? 0));
          const controllerOutcome = tryControllerBetAction({
            actionType,
            amount,
            seatIndex: activeSeat,
            metadata: payload ?? {},
          });
          if (controllerOutcome?.snapshot) {
            const actorAfter = controllerOutcome.snapshot.players?.[activeSeat] ?? me;
            betHelpers.logAction?.(activeSeat, actorAfter?.lastAction ?? actionType, { controller: true });
            betHelpers.recordActionToLog?.({
              phase: "BET",
              round: betHelpers.currentBetRoundIndex?.() ?? betRoundTracker.current,
              seat: activeSeat,
              playerState: actorAfter,
              type: actorAfter?.lastAction ?? actionType,
              stackBefore: me.stack,
              stackAfter: actorAfter?.stack ?? me.stack,
              betBefore: me.betThisRound ?? 0,
              betAfter: actorAfter?.betThisRound ?? me.betThisRound ?? 0,
              raiseCountTable: raiseCountThisRound,
            });
            betHelpers.syncLegacyFromControllerSnapshot?.(controllerOutcome.snapshot, {
              seatIndex: activeSeat,
            });
            return;
          }
        }
        const maxNow = maxBetThisRound(snap);
        const toCall = Math.max(0, maxNow - me.betThisRound);
        const evalResult = betHelpers.evaluateBadugi?.(me.hand) ?? { ranks: [] };
        const madeCards = evalResult.ranks.length;
        const canRaise = !me.allIn && raiseCountThisRound < 4;
        const activeOpponents = snap.filter(
          (player, seatIndex) => seatIndex !== activeSeat && player && !isFoldedOrOut(player) && !player.allIn,
        ).length;
        const betDecision = computeBetDecision({
          context: aiDecisionContext,
          toCall,
          canRaise,
          madeCards,
          betSize,
          actor: me,
          evaluation: evalResult,
          activeOpponents,
          drawRound,
          betRound: betRoundIndex,
        });
        const decisionAction = String(betDecision?.action ?? "").toLowerCase();
        const actionPayload = {
          type:
            decisionAction === "fold" || decisionAction === "raise"
              ? decisionAction
              : toCall === 0
              ? "check"
              : "call",
          amount:
            decisionAction === "raise"
              ? betSize
              : toCall,
          __forceInstant: true,
          decisionSource: betDecision?.source ?? "policy-router",
          tierId: betDecision?.tierId ?? activeAiTierConfig?.id,
          decisionReason: betDecision?.reason,
        };

        if (applyForcedBetAction(activeSeat, actionPayload)) {
          return;
        }
        if (actionPayload?.type === "raise") {
          const fallbackPayload = {
            type: toCall === 0 ? "check" : "call",
            amount: toCall,
            __forceInstant: true,
          };
          if (applyForcedBetAction(activeSeat, fallbackPayload)) {
            return;
          }
        }

        if (isSingleTableBadugi) {
          warnLegacySingleTablePath(`npc-bet fallback seat=${activeSeat}`);
        }
      } else if (phase === "DRAW") {
        autoResolveCpuDrawIfNeeded();
        return;
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
    betRoundIndex,
    drawRound,
    aiDecisionContext,
    activeAiTierConfig,
    applyForcedBetAction,
    autoResolveCpuDrawIfNeeded,
    checkIfOneLeftThenEnd,
    isSingleTableBadugi,
    isSingleTableDrawLowball,
    tryControllerBetAction,
  ]);

  useEffect(() => {
    if (phase !== "BET") return;
    const pending = forcedSeatActionsRef.current.get(turn);
    if (pending) {
      applyForcedBetAction(turn, pending);
    }
  }, [phase, turn, applyForcedBetAction]);

  useEffect(() => {
    if (phase !== "DRAW") {
      scheduledFinishDrawRef.current = false;
    }
  }, [phase]);


  useEffect(() => {
    if (phase !== "SHOWDOWN") return;
    if (handSavedRef.current) return;

    trySaveHandOnce({ playersSnap: players, dealerIdx, pots });
  }, [phase, showNextButton]); // eslint-disable-line react-hooks/exhaustive-deps

  function trySaveHandOnce({ playersSnap, dealerIdx, pots, potOverride }) {
    debugLog("[HISTORY] trySaveHandOnce called");
    try {
      const fallbackTableId =
        tableMetadataRef.current?.tableId ??
        heroTableIdRef.current ??
        heroTableMetaRef.current?.tableId ??
        stageGameId ??
        DEFAULT_GAME_ID;
      const handId =
        handIdRef.current ??
        formatHandIdentifier({
          tableId: fallbackTableId,
          handNumber: handCountRef.current,
          dealerSeat: dealerIdx,
        });
      handIdRef.current = handId;
      const buttonSeat =
        typeof tableMetadataRef.current?.buttonSeat === "number"
          ? tableMetadataRef.current.buttonSeat
          : dealerIdx;
      const sbSeat =
        typeof tableMetadataRef.current?.sbSeat === "number"
          ? tableMetadataRef.current.sbSeat
          : null;
      const bbSeat =
        typeof tableMetadataRef.current?.bbSeat === "number"
          ? tableMetadataRef.current.bbSeat
          : null;

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

      const normalizedRecordVariant = normalizeAppVariantId(gameVariantRef.current);
      const recordVariantProfile = GAME_VARIANTS[normalizedRecordVariant] ?? null;
      const recordVariantId = recordVariantProfile?.variantId ?? normalizedRecordVariant;
      const recordedSeats = currentHandHistoryRef.current?.seats ?? [];
      const cpuModelEntry = selectModelForVariant({
        variantId: recordVariantId,
        tierId: activeAiTierConfig?.id ?? "standard",
      });
      const recordedActions = recordedSeats.flatMap((seatRecord) =>
        (Array.isArray(seatRecord?.actions) ? seatRecord.actions : []).map((action) => ({
          ...action,
          seat: typeof action?.seat === "number" ? action.seat : seatRecord?.seat ?? null,
        })),
      );
      const resolveStartStack = (seatIndex, player) => {
        const historyStart = Number(recordedSeats?.[seatIndex]?.startStack);
        if (Number.isFinite(historyStart)) return historyStart;
        const runtimeStart = Number(handStartStacksRef.current?.[seatIndex]);
        if (Number.isFinite(runtimeStart)) return runtimeStart;
        const invested = Number(player?.totalInvested);
        if (Number.isFinite(invested)) {
          return Math.max(0, Number(player?.stack ?? 0) + invested);
        }
        return Number(player?.stack ?? 0);
      };
      const recordPlayers = (playersSnap || []).map((p, i) => {
        const isCPU = i !== 0;
        const startStack = resolveStartStack(i, p);
        const endStack = Number(p?.stack ?? 0);
        return {
          name: p.name ?? `P${i + 1}`,
          seat: i,
          stack: endStack,
          startStack,
          endStack,
          net: Math.round((endStack - startStack) * 1000) / 1000,
          folded: !!p.folded,
          isCPU,
          cpuTier: isCPU ? activeAiTierConfig?.id ?? cpuModelEntry?.tier ?? null : null,
          cpuModelId: isCPU ? cpuModelEntry?.id ?? cpuModelEntry?.modelId ?? null : null,
          cpuModelVersion: isCPU ? cpuModelEntry?.version ?? null : null,
          featureSet: isCPU ? cpuModelEntry?.featureSet ?? null : null,
          trainingRun: isCPU ? cpuModelEntry?.trainingRun ?? null : null,
          trainingCheckpoint: isCPU ? cpuModelEntry?.trainingCheckpoint ?? null : null,
          trainingStatus: isCPU ? cpuModelEntry?.trainingStatus ?? null : null,
        };
      });
      const heroPlayerRecord = recordPlayers[0] ?? null;
      const heroNet = Number(heroPlayerRecord?.net);
      const heroResult = Number.isFinite(heroNet)
        ? heroNet > 0
          ? "win"
          : heroNet < 0
          ? "loss"
          : "tie"
        : null;

      // NOTE (G-09): Persist the same identifiers/seat metadata that drive
      // action logs so backend HandLog payloads stay aligned with UI history.
      const record = {
        handId,
        ts: Date.now(),
        variantId: recordVariantId,
        variantName:
          recordVariantProfile?.label ??
          currentHandHistoryRef.current?.variantName ??
          formatVariantLabel(normalizedRecordVariant),
        tableId: fallbackTableId,
        tableSize: (playersSnap || []).length,
        dealerIdx,
        buttonSeat,
        sbSeat,
        bbSeat,
        heroSeat: 0,
        heroNet,
        heroResult,
        players: recordPlayers,
        actions: recordedActions,
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
        humanBenchmark: {
          enabled: true,
          schemaVersion: "human-benchmark-v1",
          source: "cash-game",
          heroSeat: 0,
          heroStartStack: heroPlayerRecord?.startStack ?? null,
          heroEndStack: heroPlayerRecord?.endStack ?? null,
          heroNet,
          heroResult,
          variantId: recordVariantId,
          variantName:
            recordVariantProfile?.label ??
            currentHandHistoryRef.current?.variantName ??
            formatVariantLabel(normalizedRecordVariant),
          cpuTier: activeAiTierConfig?.id ?? cpuModelEntry?.tier ?? null,
          cpuModelId: cpuModelEntry?.id ?? cpuModelEntry?.modelId ?? null,
          cpuModelVersion: cpuModelEntry?.version ?? null,
          featureSet: cpuModelEntry?.featureSet ?? null,
          trainingRun: cpuModelEntry?.trainingRun ?? null,
          trainingCheckpoint: cpuModelEntry?.trainingCheckpoint ?? null,
          trainingStatus: cpuModelEntry?.trainingStatus ?? null,
        },
      };

      saveRLHandHistory(record);
      // Hand completion trigger: trySaveHandOnce runs after SHOWDOWN and builds the final record.
      const sendId = record.handId ?? record.hand_id ?? record.id;
      if (!sendId) {
        console.warn("[sync] hand-history missing handId", record);
      } else if (!sentHandIdsRef.current.has(sendId)) {
        try {
          enqueueHandRecord(record, { flushNow: true });
          sentHandIdsRef.current.add(sendId);
        } catch (err) {
          console.warn("[sync] hand-history enqueue failed", err);
        }
      }
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
    } catch {
      // console.error("save hand failed", e);
    }
  }

  /* --- UI --- */
  const heroTrackerTotal = heroTracker.wins + heroTracker.losses + heroTracker.draws;
  const heroWinRate = heroTrackerTotal
    ? Math.round(((heroTracker.wins + heroTracker.draws * 0.5) / heroTrackerTotal) * 100)
    : 0;
  const seatLayouts = useMemo(() => {
    const cashLayouts = [
      "absolute bottom-[-2%] left-1/2 -translate-x-1/2 w-[clamp(190px,24vw,270px)]", // Hero (BTN)
      "absolute bottom-[27%] left-[1.5%] w-[clamp(160px,20vw,240px)]", // SB
      "absolute top-[14%] left-[2%] w-[clamp(160px,21vw,250px)]", // BB
      "absolute top-[0%] left-1/2 -translate-x-1/2 w-[clamp(170px,23vw,270px)]", // UTG
      "absolute top-[14%] right-[2%] w-[clamp(160px,21vw,250px)]", // MP
      "absolute bottom-[27%] right-[1.5%] w-[clamp(160px,20vw,240px)]", // CO
    ];
    // Tournament tables follow a fixed 6-max oval layout (BTN bottom-center, clockwise SB→CO).
    const tournamentLayouts = [
      "absolute bottom-[-2%] left-1/2 -translate-x-1/2 w-[clamp(190px,21vw,255px)]", // Hero (BTN)
      "absolute bottom-[10%] left-[14%] -translate-x-1/2 w-[clamp(136px,16vw,198px)]", // SB
      "absolute top-[17%] left-[14%] -translate-x-1/2 w-[clamp(136px,16vw,198px)]", // BB
      "absolute top-[0%] left-1/2 -translate-x-1/2 w-[clamp(150px,18vw,220px)]", // UTG
      "absolute top-[17%] left-[86%] -translate-x-1/2 w-[clamp(136px,16vw,198px)]", // MP
      "absolute bottom-[10%] left-[86%] -translate-x-1/2 w-[clamp(136px,16vw,198px)]", // CO
    ];
    return mode === "tournament-mtt" ? tournamentLayouts : cashLayouts;
  }, [mode]);

  const isDrawPhase = tablePhase === "DRAW";
  const tableOuterBg = isDrawPhase ? "bg-red-900" : "bg-green-800";
  const tableSurfaceBg = isDrawPhase ? "bg-red-800" : "bg-green-700";
  const tableBorderColor = isDrawPhase ? "border-red-400" : "border-yellow-600";

  const tableSummaryProps = {
    phaseTag: hudInfo?.phaseTag ?? phaseTagLocal(),
    drawRound: hudInfo?.drawRound ?? drawRoundSrc,
    maxDraws: hudInfo?.maxDraws ?? MAX_DRAWS,
    betRoundIndex: hudInfo?.betRoundIndex ?? betRoundIndexSrc,
    levelNumber: hudInfo?.levelNumber ?? (currentStructure.level ?? blindLevelIndex + 1),
    sbValue: hudInfo?.sbValue ?? SB,
    bbValue: hudInfo?.bbValue ?? BB,
    anteValue: hudInfo?.anteValue ?? currentAnte,
    handCount: hudInfo?.handCount ?? handsInLevelDisplay,
    handsCap: hudInfo?.handsCap ?? handsCapDisplay,
    startingStack: hudInfo?.startingStack ?? startingStack,
    showRaiseCount: (hudInfo?.phase ?? tablePhase) === "BET",
    raiseCount: raiseStatsSrc?.raiseCountThisRound ?? raiseCountThisRound,
    dealerName:
      hudInfo?.dealerName ??
      seatViews.find((seat) => seat.seatIndex === controllerDealerIdx)?.name ??
      playersSrc[controllerDealerIdx]?.name ??
      "-",
  };
  const heroSeatView = seatViews.find((seat) => seat?.seatIndex === 0) ?? null;
  const heroPlayerForControls = heroSeatView
    ? {
        ...(playersSrc[0] ? clonePlayerState(playersSrc[0]) : {}),
        ...heroSeatView,
      }
    : playersSrc[0] ?? null;

  const controlsPhase = controlsConfig?.phase ?? tablePhase;
  const controlsCurrentBet = controlsConfig?.currentBet ?? currentBetSrc;
  const heroBetThisRound = Math.max(0, Number(heroPlayerForControls?.betThisRound) || 0);
  const heroToCall = Math.max(0, Number(controlsCurrentBet || 0) - heroBetThisRound);
  const currentRaiseCount = Math.max(
    0,
    Number(raiseStatsSrc?.raiseCountThisRound ?? raiseCountThisRound) || 0,
  );
  const fixedLimitRaiseCap = 4;
  const currentRaiseUnit = getFixedLimitBetSize({
    baseBet: BB,
    drawRound: drawRoundSrc,
    betRound: betRoundIndexSrc,
  });
  const actionPanelInfo = {
    currentBet: Math.max(0, Number(controlsCurrentBet) || 0),
    heroBet: heroBetThisRound,
    toCall: heroToCall,
    raiseCount: currentRaiseCount,
    raiseCap: fixedLimitRaiseCap,
    raiseUnit: currentRaiseUnit,
    capReached: currentRaiseCount >= fixedLimitRaiseCap,
  };

  const heroSeatIndex =
    typeof heroSeatView?.seatIndex === "number" ? heroSeatView.seatIndex : 0;
  const heroEligible =
    heroPlayerForControls &&
    !heroPlayerForControls.folded &&
    !heroPlayerForControls.seatOut;
  const isActionPhase =
    controlsPhase === "BET" || controlsPhase === "DRAW";

  const enginePlayersSnapshot = Array.isArray(engineState?.players)
    ? engineState.players
    : playersSrc;
  const heroEngineSeat =
    enginePlayersSnapshot &&
    typeof heroSeatIndex === "number" &&
    enginePlayersSnapshot[heroSeatIndex]
      ? enginePlayersSnapshot[heroSeatIndex]
      : null;
  const heroHasDrawn = Boolean(heroEngineSeat?.hasDrawn);
  const heroAllIn = Boolean(heroEngineSeat?.allIn);
  const heroMaxBetThisRound = maxBetThisRound(enginePlayersSnapshot ?? playersSrc ?? []);
  const heroNeedsBetAction =
    controlsPhase === "BET" &&
    heroEligible &&
    needsActionForBet(heroEngineSeat ?? playersSrc[heroSeatIndex], heroMaxBetThisRound);
  const heroDrawAllowedByEngine =
    controlsPhase === "DRAW" &&
    heroEligible &&
    !heroHasDrawn;
  const heroPhaseNeedsAction =
    controlsPhase === "BET"
      ? heroNeedsBetAction
      : controlsPhase === "DRAW"
      ? heroDrawAllowedByEngine
      : false;

  // Hero controls must follow the same acting seat used by action handlers.
  const heroCanAct =
    isActionPhase &&
    heroEligible &&
    heroPhaseNeedsAction &&
    controllerTurn === heroSeatIndex;
  const heroCanDraw = controlsPhase === "DRAW" && heroCanAct;

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
    debugLogRef.current("[HERO][TURN_FLAGS]", {
      phase: controlsPhase,
      heroSeatIndex,
      controllerTurn,
      heroEligible,
      heroCanAct,
      heroNeedsBetAction,
      heroPhaseNeedsAction,
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
    heroNeedsBetAction,
    heroPhaseNeedsAction,
    heroDrawAllowedByEngine,
    heroHasDrawn,
    heroAllIn,
    heroPlayerForControls?.name,
  ]);

  useEffect(() => {
    if (controlsPhase !== "BET" && controlsPhase !== "DRAW") return;
    debugLogRef.current("[TURN_SYNC]", {
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
  function handleAuthSuccess() {
    setCurrentScreen("menu");
  }
  function handleAuthStateChange(state) {
    authUserIdRef.current = state?.user?.id ?? null;
    setAuthUserId(state?.user?.id ?? null);
    setAuthToken(state?.accessToken ?? null);
    setAuthTokenType(state?.tokenType ?? null);
    if (typeof state?.isAuthenticated === "boolean") {
      setAuthIsAuthenticated(state.isAuthenticated);
    }
  }

  if (currentScreen === "title") {
    return (
      <>
        <TitleScreen onEnter={handleEnterFromTitle} />
        <DebugHud
          enabled={debugFlags.enabled}
          deviceProfile={deviceProfile}
          shouldGateOrientation={shouldGateOrientation}
          debugScale={debugScale}
          screenLabel={screenLabel}
        />
      </>
    );
  }

  if (currentScreen === "menu") {
    return (
      <>
        <AuthProvider>
          <AuthGate
            onAuthenticated={handleAuthSuccess}
            onAuthStateChange={handleAuthStateChange}
          >
            <MenuScreenWithLogout
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
              onSelectRing={handleOpenGameSelector}
              onSelectTournament={handleSelectTournament}
              onSelectSettings={handleSelectSettings}
              onSelectHandHistory={handleOpenHandHistoryScreen}
              onLogoutComplete={handleNavigateToTitle}
            />
          </AuthGate>
        </AuthProvider>
        <DebugHud
          enabled={debugFlags.enabled}
          deviceProfile={deviceProfile}
          shouldGateOrientation={shouldGateOrientation}
          debugScale={debugScale}
          screenLabel={screenLabel}
        />
      </>
    );
  }

  if (currentScreen === "settings") {
    return (
      <>
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-400">MGX</p>
          <h2 className="mt-2 text-4xl font-semibold">
            {MGX_LOCALES[language]?.modal?.settingsTitle ?? "Settings"}
          </h2>
          <p className="mt-4 max-w-xl text-sm text-slate-400">
            {MGX_LOCALES[language]?.modal?.settingsBody ??
              "Settings will be added later. Return to the main menu to jump into your preferred mode."}
          </p>
          <button
            type="button"
            onClick={handleBackToMenu}
            className="mt-8 rounded-full border border-amber-300/60 px-8 py-3 text-xs uppercase tracking-[0.4em] text-amber-100 hover:bg-amber-300/10"
          >
            {MGX_LOCALES[language]?.common?.backToMenu ?? "Back to Menu"}
          </button>
        </div>
        <DebugHud
          enabled={debugFlags.enabled}
          deviceProfile={deviceProfile}
          shouldGateOrientation={shouldGateOrientation}
          debugScale={debugScale}
          screenLabel={screenLabel}
        />
      </>
    );
  }

  if (currentScreen === "gameSelector") {
    return (
      <>
        <GameSelectorScreen
          language={language}
          onBack={handleBackToMenu}
          onLaunchVariant={handleSelectRing}
        />
        <DebugHud
          enabled={debugFlags.enabled}
          deviceProfile={deviceProfile}
          shouldGateOrientation={shouldGateOrientation}
          debugScale={debugScale}
          screenLabel={screenLabel}
        />
      </>
    );
  }

  if (currentScreen === "handHistory") {
    return (
      <>
        <HandHistoryScreen
          onClose={handleCloseHandHistoryScreen}
          onReplay={handleOpenReplayFromHistory}
          language={language}
        />
        <DebugHud
          enabled={debugFlags.enabled}
          deviceProfile={deviceProfile}
          shouldGateOrientation={shouldGateOrientation}
          debugScale={debugScale}
          screenLabel={screenLabel}
        />
      </>
    );
  }

  if (currentScreen === "handReplay") {
    return (
      <>
        <ReplayScreen
          handId={replayHandId}
          target={replayTarget}
          onBack={handleBackFromReplayToHistory}
          onClose={handleExitReplayToMenu}
        />
        <DebugHud
          enabled={debugFlags.enabled}
          deviceProfile={deviceProfile}
          shouldGateOrientation={shouldGateOrientation}
          debugScale={debugScale}
          screenLabel={screenLabel}
        />
      </>
    );
  }

  const headerLabels = MGX_LOCALES[language]?.header ?? MGX_LOCALES[MGX_DEFAULT_LOCALE].header;
  const currentGameTitle =
    GAME_VARIANTS[gameVariant]?.label ??
    GAME_VARIANTS[gameVariantRef.current]?.label ??
    "MGX Poker";

  const headerProps = {
    ratingState,
    rankInfo,
    gameTitle: currentGameTitle,
    labels: headerLabels,
    onNavigateTitle: handleBackToMenu,
    onNavigateLeaderboard: () => navigate("/leaderboard"),
    onNavigateSettings: () => handleOpenGameUtilityModal("settings"),
    onNavigateProfile: () => handleOpenGameUtilityModal("profile"),
    onNavigateHistory: () => handleOpenGameUtilityModal("history"),
  };

  const sidePanelProps = {
    show: !isTournament,
    statusBoardOpen,
    onToggleStatusBoard: () => setStatusBoardOpen((value) => !value),
    seatViews,
    dealerIdx: controllerDealerIdx,
    heroIndex: 0,
    turn: controllerTurn,
    totalPot: totalPotForDisplay,
    seatLabels,
    notificationVariant,
    notificationMessage,
    seatManagerOpen,
    onOpenSeatManager: () => setSeatManagerOpen(true),
    onCloseSeatManager: () => setSeatManagerOpen(false),
    autoRotateSeats,
    onToggleAutoRotateSeats: (value) => setAutoRotateSeats(value),
    seatConfig,
    seatTypeOptions,
    onSeatTypeChange: handleSeatTypeChange,
    startingStack,
    onStartingStackChange: handleStartingStackChange,
    onRotateSeatConfig: () => rotateSeatConfigOnce(1),
    onResetSeatConfig: resetSeatConfigToDefault,
    onRedeal: () => startNextHandRef.current({ dealerOverride: 0 }),
    heroTracker,
    heroTrackerTotal,
    heroWinRate,
    tierOptions,
    devTierOverride,
    onTierOverrideChange: handleTierOverrideChange,
    onClearTierOverride: clearTierOverride,
    p2pCaptureEnabled,
    onToggleP2pCapture: toggleP2pCapture,
    onExportP2pMatches: handleExportP2pMatches,
    aiDecisionSummary,
  };

  const tablePlayers = playersSrc;
  const tablePots = potsSrc;

  const tableProps = {
    tableOuterBg,
    tournamentHud,
    tableSurfaceBg,
    tableBorderColor,
    heroTableAnimating,
    isTournament,
    tableSummaryProps,
    seatViews,
    seatLayouts,
    players: tablePlayers,
    pots: tablePots,
    heroSeatIndex,
    heroDrawSelection,
    heroCanDraw,
    controllerTurn: turnSeatSrc,
    controllerDealerIdx: dealerSeatSrc,
    positionNameFn: positionName,
    clonePlayerStateFn: clonePlayerState,
    handleCardClick,
    tablePhase,
    phase: phaseSrc,
    drawRoundValue: drawRoundSrc,
    betRoundValue: betRoundIndexSrc,
  };

  const overlaysProps = {
    handResultVisible:
      sessionSnapshot?.overlays?.handResult?.visible ?? handResultVisible,
    handResultSummary:
      sessionSnapshot?.overlays?.handResult?.summary ?? handResultSummary,
    onNextHand: startNextHand,
    nextHandLabel,
    onReplayTarget: handleOpenReplayTarget,
    mode,
    heroBustOverlayVisible,
    heroBustSummary,
    tournamentTitle,
    tournamentOverlayVisible,
    tournamentPlacements,
    onTournamentBackToMenu: handleTournamentBackToMenu,
    onTournamentPlayAgain: handleTournamentPlayAgain,
  };

  const controlsProps = {
    heroCanAct,
    heroPlayerForControls,
    controlsPhase,
    controlsCurrentBet,
    actionPanelInfo,
    playerFold,
    playerCall,
    playerCheck,
    playerRaise,
    drawSelected,
    showNextButton:
      sessionSnapshot?.overlays?.showNextButton ?? showNextButton,
    heroCanDraw,
    nextHandLabel,
    onNextHand: startNextHand,
    isCashGame: mode === "cash",
    onCashOut: handleCashOut,
  };

  const debugProps = {
    debugMode,
    onToggleDebugMode: () => setDebugMode((value) => !value),
    onEmergencyReset: () =>
      resetTableStateToSafeDefaults({
        reason: "debug-emergency-reset",
        preserveHandCount: false,
      }),
  };

  const gameScreen = (
    <GameScreen
      headerProps={headerProps}
      sidePanelProps={sidePanelProps}
      tableProps={tableProps}
      overlaysProps={overlaysProps}
      controlsProps={controlsProps}
      debugProps={debugProps}
      debugFlags={debugFlags}
      onDebugScale={setDebugScale}
      layoutMode={layoutMode}
    />
  );
  const renderedGameScreen = shouldUseDesktopCanvasScale ? (
    <div
      className="relative w-screen overflow-hidden bg-gray-900"
      style={{ height: "100dvh" }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: `${desktopCanvasScale.baseWidth}px`,
          height: `${desktopCanvasScale.baseHeight}px`,
          transformOrigin: "top left",
          transform: `translate(${desktopCanvasScale.offsetX}px, ${desktopCanvasScale.offsetY}px) scale(${desktopCanvasScale.scale})`,
          willChange: "transform",
        }}
      >
        {gameScreen}
      </div>
    </div>
  ) : (
    gameScreen
  );
  const utilityModal =
    gameUtilityModal ? (
      <GameUtilityModal
        modalName={gameUtilityModal}
        language={language}
        onClose={handleCloseGameUtilityModal}
        onReplay={(handId, target) => {
          handleCloseGameUtilityModal();
          handleOpenReplayFromHistory(handId, target);
        }}
      />
    ) : null;

  return (
    <>
      <AuthProvider>
        <AuthGate
          onAuthenticated={handleAuthSuccess}
          onAuthStateChange={handleAuthStateChange}
        >
          <MobileOrientationGate
            enabled={shouldGateOrientation}
            isPortrait={deviceProfile.isPortrait}
            debugFlags={debugFlags}
          >
          {renderedGameScreen}
        </MobileOrientationGate>
        {utilityModal}
        {cashOutSummary && (
          <CashOutResultModal
            summary={cashOutSummary}
            onClose={handleCloseCashOut}
            onBackToMenu={handleCashOutBackToMenu}
            onNewSession={handleCashOutNewSession}
          />
        )}
      </AuthGate>
    </AuthProvider>
      <DebugHud
        enabled={debugFlags.enabled}
        deviceProfile={deviceProfile}
        shouldGateOrientation={shouldGateOrientation}
        debugScale={debugScale}
        screenLabel={screenLabel}
      />
    </>
  );
}

function GameUtilityModal({ modalName, language, onClose, onReplay }) {
  const titleByModal = {
    settings: language === "ja" ? "設定" : "Settings",
    profile: language === "ja" ? "プロフィール" : "Profile",
    history: language === "ja" ? "履歴" : "History",
  };
  const title = titleByModal[modalName] ?? titleByModal.settings;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="game-utility-modal"
    >
      <div className="relative max-h-[88dvh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-950/95 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-300">MGX</p>
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/90 transition hover:border-emerald-300/70 hover:text-emerald-200"
          >
            {language === "ja" ? "閉じる" : "Close"}
          </button>
        </div>
        <div className="p-2 sm:p-4">
          {modalName === "settings" && <TitleSettingsScreen embedded onClose={onClose} />}
          {modalName === "profile" && <ProfileStats embedded onClose={onClose} />}
          {modalName === "history" && (
            <HandHistoryScreen
              embedded
              language={language}
              onClose={onClose}
              onReplay={onReplay}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CashOutResultModal({ summary, onClose, onBackToMenu, onNewSession }) {
  const net = Number(summary?.net ?? 0);
  const netLabel = net >= 0 ? `+${net}` : `${net}`;
  const netClass = net >= 0 ? "text-emerald-300" : "text-red-300";
  return (
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Cash out result"
    >
      <div className="w-full max-w-md rounded-3xl border border-emerald-300/20 bg-slate-950 p-6 text-white shadow-2xl">
        <div className="mb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">
            Cash Out
          </p>
          <h2 className="mt-2 text-2xl font-black">{summary?.variantName ?? "Cash Game"}</h2>
          <p className="mt-1 text-sm text-slate-400">
            今回のキャッシュゲーム結果です。続行するか、ゲーム選択へ戻れます。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-slate-500">Buy-in</p>
            <p className="text-xl font-black">{summary?.buyIn ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-slate-500">Cash out stack</p>
            <p className="text-xl font-black">{summary?.stack ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-slate-500">Hands</p>
            <p className="text-xl font-black">{summary?.hands ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-slate-500">Net</p>
            <p className={`text-xl font-black ${netClass}`}>{netLabel}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            続行
          </button>
          <button
            type="button"
            onClick={onNewSession}
            className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-black text-slate-950 hover:bg-emerald-400"
          >
            新しい卓
          </button>
          <button
            type="button"
            onClick={onBackToMenu}
            className="rounded-xl bg-yellow-400 px-3 py-2 text-sm font-black text-slate-950 hover:bg-yellow-300"
          >
            ゲーム選択
          </button>
        </div>
      </div>
    </div>
  );
}

function DebugHud({
  enabled,
  deviceProfile,
  shouldGateOrientation,
  debugScale,
  screenLabel,
}) {
  const [metrics, setMetrics] = useState(() => readDebugMetrics());

  useEffect(() => {
    if (!enabled) return undefined;
    const update = () => setMetrics(readDebugMetrics());
    update();
    const interval = window.setInterval(update, 500);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
    };
  }, [enabled]);

  if (!enabled) return null;

  const vvText =
    metrics.visualViewportWidth != null && metrics.visualViewportHeight != null
      ? `${metrics.visualViewportWidth}x${metrics.visualViewportHeight}`
      : "n/a";
  const scaleText =
    typeof debugScale === "number" && Number.isFinite(debugScale)
      ? debugScale.toFixed(3)
      : "n/a";

  return (
    <div className="pointer-events-none fixed top-2 left-2 z-[9999] max-w-[92vw] rounded bg-black/70 px-2 py-1 text-[10px] leading-tight text-white shadow">
      <div>href: {metrics.href}</div>
      <div>inner: {metrics.innerWidth}x{metrics.innerHeight}</div>
      <div>vv: {vvText}</div>
      <div>
        flags: mobile={String(deviceProfile.isMobile)} portrait={String(deviceProfile.isPortrait)} gate={String(shouldGateOrientation)}
      </div>
      <div>scale: {scaleText}</div>
      <div>root children: {metrics.rootChildCount}</div>
      <div>screen: {screenLabel}</div>
    </div>
  );
}

function AuthGate({ children, onAuthenticated, onAuthStateChange }) {
  const { authState } = useAuth();
  useEffect(() => {
    if (typeof onAuthStateChange === "function") {
      onAuthStateChange(authState);
    }
  }, [authState, onAuthStateChange]);
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.accessToken) {
      return undefined;
    }
    const stopAutoSync = startAutoSync(30000, {
      accessToken: authState.accessToken,
      tokenType: authState.tokenType,
    });
    return () => {
      if (typeof stopAutoSync === "function") {
        stopAutoSync();
      }
    };
  }, [authState.accessToken, authState.isAuthenticated, authState.tokenType]);
  if (!authState.isAuthenticated) {
    return <AuthScreen onAuthenticated={onAuthenticated} />;
  }
  return children;
}

function MenuScreenWithLogout({
  onLogoutComplete,
  ...menuProps
}) {
  const { authState, logout } = useAuth();
  const [pending, setPending] = useState(false);

  const handleLogout = useCallback(async () => {
    if (pending) return;
    setPending(true);
    const token = authState?.accessToken;
    const tokenType = authState?.tokenType ?? "Bearer";
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `${tokenType} ${token}` } : {}),
        },
      });
    } catch (err) {
      console.warn("[auth] logout request failed", err);
    } finally {
      logout();
      if (typeof onLogoutComplete === "function") {
        onLogoutComplete();
      }
      setPending(false);
    }
  }, [authState?.accessToken, authState?.tokenType, logout, onLogoutComplete, pending]);

  return (
    <div className="relative min-h-screen">
      <MainMenuScreen {...menuProps} />
      <div className="pointer-events-none fixed top-0 right-0 z-50 p-4">
        <button
          type="button"
          onClick={handleLogout}
          disabled={pending}
          className="pointer-events-auto rounded-full border border-white/30 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-white backdrop-blur transition hover:border-emerald-400/60 hover:text-emerald-200 disabled:opacity-50"
        >
          {pending
            ? menuProps.language === "ja"
              ? "ログアウト中..."
              : "Logging out..."
            : menuProps.language === "ja"
            ? "ログアウト"
            : "Logout"}
        </button>
      </div>
    </div>
  );
}
