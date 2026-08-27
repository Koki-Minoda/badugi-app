import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { designTokens } from "../../styles/designTokens.js";
import { LANGUAGE_STORAGE_KEY, MGX_DEFAULT_LOCALE } from "../../config/mgxLocaleConfig.js";
import {
  buildRoomWebSocketUrl,
  buildRoomWebSocketProtocols,
  createRoom,
  actInRoom,
  drawInRoom,
  getRoomState,
  joinRoom,
  leaveRoom,
  readRoomAuth,
  readyRoom,
  RoomApiError,
} from "../utils/roomApi.js";

const ACTIVE_ROOM_STORAGE_KEY = "mgx_friend_match_active_room_v1";
const WS_MAX_RECONNECT_ATTEMPTS = 3;
const REST_POLL_INTERVAL_MS = 1_000;
const BADUGI_VARIANT = Object.freeze({
  id: "badugi",
  label: "Badugi",
  description: "Heads-up / 4 cards / 3 draws",
});

function loadStoredActiveRoom() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistActiveRoom(room) {
  if (typeof window === "undefined") return;
  if (!room) {
    window.sessionStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(room));
}

function getInitialFriendMatchLanguage(language) {
  if (language) return language;
  if (typeof window === "undefined") return MGX_DEFAULT_LOCALE;
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? MGX_DEFAULT_LOCALE;
}

const FRIEND_COPY = {
  ja: {
    eyebrow: "フレンドマッチ",
    title: "プライベート卓を作成",
    description:
      "友人と遊ぶための専用ルームを作成します。ルームコードを共有すると、同じ卓へ参加できます。",
    variant: "ゲーム",
    chooseGame: "遊ぶゲームを選択",
    searchGame: "ゲーム検索",
    searchPlaceholder: "ゲーム名・形式・説明で検索...",
    clearSearch: "クリア",
    showingVariants: (count, total) => `${count}/${total}件を表示`,
    noVariants: "条件に一致するゲームがありません。",
    enabled: "利用可能",
    tableRules: "テーブル設定",
    setParams: "人数・スタック・ブラインド",
    seats: "席数",
    startingStack: "開始スタック",
    smallBlind: "スモールブラインド",
    bigBlind: "ビッグブラインド",
    ante: "アンティ（任意）",
    creating: "作成中...",
    createRoom: "ルームを作成",
    backToMenu: "ゲーム選択へ戻る",
    roomCode: "ルームコード",
    joinRoom: "ルームに参加",
    enterCode: "ルームコードを入力",
    roomCodeAria: "ルームコード",
    joining: "参加中...",
    join: "参加",
    syncStatus: "同期状態",
    latestSequence: "最新番号",
    staleIgnored: "破棄した古い通知",
    liveTable: "現在の卓",
    hand: "ハンド",
    ready: "準備完了",
    check: "チェック",
    call: "コール",
    betAction: "ベット",
    raise: "レイズ",
    draw: "ドロー",
    standPat: "スタンドパット",
    fold: "フォールド",
    selectCards: "交換するカードを選択",
    leave: "ルームを退出",
    copyCode: "コードをコピー",
    copied: "ルームコードをコピーしました。",
    loginRequired: "フレンドマッチを利用するにはログインしてください。",
    roomClosed: "ホストが退出したため、ルームを終了しました。",
    sessionReplaced: "このルームは別の画面で開かれました。",
    newMatch: "新しいマッチを開始",
    waitingPlayers: "参加者を待っています...",
    readyState: "準備済み",
    notReadyState: "未準備",
    foldedState: " / フォールド",
    stack: "スタック",
    bet: "ベット",
    currentTurn: "現在の手番",
    yourTurn: "あなたの手番です",
    waitingTurn: "相手の手番を待っています",
    showdownWinner: "ショーダウン勝者",
    noWinner: "なし",
    noEvents: "まだ同期イベントはありません。",
    roomCreated: "ルームを作成しました。ルームコードを共有し、全員が参加したら準備完了を押してください。",
    roomCreateFailed: "ルーム作成に失敗しました。",
    enterRoomCode: "ルームコードを入力してください。",
    joinedRoom: "ルームに参加しました。卓の同期を待っています。",
    joinFailed: "ルーム参加に失敗しました。",
    socketNotConnected: "まだルームに接続できていません。",
    hostName: "ホスト",
    guestName: "ゲスト",
  },
  en: {
    eyebrow: "Friend Match",
    title: "Create a Room",
    description:
      "Configure a private table for friends. Share the room code so everyone can join the same table.",
    variant: "Variant",
    chooseGame: "Choose your game",
    searchGame: "Game Search",
    searchPlaceholder: "Search by game, format, or description...",
    clearSearch: "Clear",
    showingVariants: (count, total) => `Showing ${count}/${total} variants`,
    noVariants: "No variants match the current filters.",
    enabled: "Enabled",
    tableRules: "Table Rules",
    setParams: "Set table parameters",
    seats: "Seats",
    startingStack: "Starting Stack",
    smallBlind: "Small Blind",
    bigBlind: "Big Blind",
    ante: "Ante (Optional)",
    creating: "Creating...",
    createRoom: "Create Room",
    backToMenu: "Back to Menu",
    roomCode: "Room Code",
    joinRoom: "Join Room",
    enterCode: "Enter a room code",
    roomCodeAria: "Room code",
    joining: "Joining...",
    join: "Join",
    syncStatus: "Sync Status",
    latestSequence: "Latest sequence",
    staleIgnored: "Stale ignored",
    liveTable: "Live Table State",
    hand: "Hand",
    ready: "Ready",
    check: "Check",
    call: "Call",
    betAction: "Bet",
    raise: "Raise",
    draw: "Draw",
    standPat: "Stand pat",
    fold: "Fold",
    selectCards: "Select cards to replace",
    leave: "Leave room",
    copyCode: "Copy code",
    copied: "Room code copied.",
    loginRequired: "Log in to use Friend Match.",
    roomClosed: "The room was closed because the host left.",
    sessionReplaced: "This room was opened in another window.",
    newMatch: "Start new match",
    waitingPlayers: "Waiting for players...",
    readyState: "ready",
    notReadyState: "not ready",
    foldedState: " / folded",
    stack: "Stack",
    bet: "Bet",
    currentTurn: "Current turn",
    yourTurn: "Your turn",
    waitingTurn: "Waiting for opponent",
    showdownWinner: "Showdown winner",
    noWinner: "none",
    noEvents: "No room events received yet.",
    roomCreated: "Room created. Share the room code and use Ready when both players join.",
    roomCreateFailed: "Failed to create room.",
    enterRoomCode: "Enter a room code.",
    joinedRoom: "Joined room. Waiting for live table synchronization.",
    joinFailed: "Failed to join room.",
    socketNotConnected: "Room socket is not connected yet.",
    hostName: "Host",
    guestName: "Guest",
  },
};

function VariantOption({ variant, isSelected, onSelect, copy }) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition ${
        isSelected
          ? "border-emerald-400/70 bg-emerald-500/10"
          : "border-white/15 bg-slate-950/60 hover:border-emerald-300/50"
      }`}
    >
      <div className="flex flex-col">
        <span className="text-sm text-slate-300">{variant.label}</span>
        <span className="text-xs text-slate-500">
          {variant.description || copy.enabled}
        </span>
      </div>
      <input
        type="radio"
        name="friend-variant"
        value={variant.id}
        checked={isSelected}
        onChange={() => onSelect(variant.id)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`h-4 w-4 rounded-full border-2 ${
          isSelected ? "border-emerald-300 bg-emerald-300" : "border-white/30"
        }`}
      />
    </label>
  );
}

function getEventSequenceId(entry) {
  const raw =
    entry?.sequenceId ??
    entry?.payload?.sequenceId ??
    entry?.payload?.delta?.sequenceId ??
    entry?.payload?.roomState?.sequenceId;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function normalizeRoomEvent(entry) {
  if (entry?.event === "history" && Array.isArray(entry?.payload?.events)) {
    return entry.payload.events.map((historyEntry, index) => ({
      event: historyEntry.event ?? historyEntry.type ?? "history",
      payload: historyEntry,
      sequenceId: getEventSequenceId(historyEntry) ?? index,
      replayed: true,
    }));
  }
  return [entry];
}

const EMPTY_TABLE_STATE = {
  phase: "waiting",
  handId: null,
  players: [],
  playerStates: [],
  pot: 0,
  bets: {},
  stacks: {},
  lastAction: null,
  secureDeals: [],
  showdown: null,
  currentTurnPlayerId: null,
  legalActions: [],
  hand: [],
  toCall: 0,
  currentBet: 0,
  history: [],
  config: { startingStack: 2000, smallBlind: 10, bigBlind: 20, ante: 0 },
};

function mergePlayerStates(players = [], playerStates = [], stacks = {}, bets = {}) {
  const byId = new Map(playerStates.map((player) => [player.id, player]));
  return players.map((playerId) => {
    const state = byId.get(playerId) ?? {};
    return {
      id: playerId,
      displayName: state.displayName ?? playerId,
      ready: Boolean(state.ready),
      stack: Number(stacks[playerId] ?? state.stack ?? 0),
      bet: Number(bets[playerId] ?? state.bet ?? 0),
      folded: Boolean(state.folded),
    };
  });
}

function applyRoomEventToTableState(current, entry) {
  const payload = entry?.payload ?? {};
  if (entry?.event === "state") {
    const playerStates = Array.isArray(payload.players) ? payload.players : [];
    return {
      ...current,
      roomId: payload.roomCode ?? current.roomId,
      phase: payload.phase ?? current.phase,
      handId: payload.handId ?? current.handId,
      players: playerStates.map((player) => player.id),
      playerStates,
      pot: Number(payload.pot ?? 0),
      currentBet: Number(payload.currentBet ?? 0),
      toCall: Number(payload.toCall ?? 0),
      currentTurnPlayerId: payload.currentTurnPlayerId ?? null,
      legalActions: Array.isArray(payload.legalActions) ? payload.legalActions : [],
      hand: Array.isArray(payload.hand) ? payload.hand : [],
      showdown: payload.showdown ?? null,
      history: Array.isArray(payload.history) ? payload.history : [],
      config: { ...current.config, ...(payload.config ?? {}) },
    };
  }
  if (entry?.event === "room_state") {
    const players = payload.players ?? current.players;
    return {
      ...current,
      roomId: payload.roomId ?? current.roomId,
      phase: payload.phase ?? current.phase,
      handId: payload.handId ?? current.handId,
      players,
      playerStates: mergePlayerStates(players, payload.playerStates, current.stacks, current.bets),
      warnings: payload.warnings ?? current.warnings,
      currentTurnPlayerId: payload.currentTurnPlayerId ?? current.currentTurnPlayerId,
      showdown: payload.phase === "playing" ? null : current.showdown,
    };
  }
  if (entry?.event === "updated_state") {
    const players = current.players.length > 0 ? current.players : Object.keys(payload.stacks ?? {});
    return {
      ...current,
      phase: payload.phase ?? current.phase,
      handId: payload.handId ?? current.handId,
      pot: Number(payload.pot ?? current.pot ?? 0),
      bets: payload.bets ?? current.bets,
      stacks: payload.stacks ?? current.stacks,
      lastAction: payload.lastAction ?? current.lastAction,
      currentTurnPlayerId: payload.currentTurnPlayerId ?? current.currentTurnPlayerId,
      players,
      playerStates: mergePlayerStates(players, current.playerStates, payload.stacks, payload.bets),
    };
  }
  if (entry?.event === "secure_deal") {
    return {
      ...current,
      handId: payload.handId ?? current.handId,
      secureDeals: payload.cards ?? [],
      showdown: null,
    };
  }
  if (entry?.event === "showdown") {
    return {
      ...current,
      phase: "showdown",
      handId: payload.handId ?? current.handId,
      pot: Number(payload.pot ?? current.pot ?? 0),
      showdown: payload,
    };
  }
  return current;
}

export default function FriendMatchSetupScreen({ language = null } = {}) {
  const navigate = useNavigate();
  const languageKey = getInitialFriendMatchLanguage(language);
  const copy = useMemo(
    () =>
      FRIEND_COPY[languageKey] ??
      FRIEND_COPY[MGX_DEFAULT_LOCALE] ??
      FRIEND_COPY.en,
    [languageKey],
  );
  const friendVariants = useMemo(() => [BADUGI_VARIANT], []);
  const [variantId, setVariantId] = useState("badugi");
  const [seats] = useState(2);
  const [stack, setStack] = useState(2000);
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [ante, setAnte] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [createdRoom, setCreatedRoom] = useState(() => loadStoredActiveRoom());
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [roomEvents, setRoomEvents] = useState([]);
  const [p2pTableState, setP2pTableState] = useState(EMPTY_TABLE_STATE);
  const [latestSequenceId, setLatestSequenceId] = useState(0);
  const [staleEventCount, setStaleEventCount] = useState(0);
  const [selectedCardIndexes, setSelectedCardIndexes] = useState([]);
  const socketRef = useRef(null);
  const latestSequenceRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const transportModeRef = useRef("websocket");

  const acceptRoomEvent = useCallback((event) => {
    const normalizedEvents = normalizeRoomEvent(event);
    const accepted = [];
    let staleCount = 0;
    normalizedEvents.forEach((entry) => {
      const sequenceId = getEventSequenceId(entry);
      if (sequenceId !== null && sequenceId < latestSequenceRef.current) {
        staleCount += 1;
        return;
      }
      if (sequenceId !== null) {
        latestSequenceRef.current = sequenceId;
        setLatestSequenceId(sequenceId);
      }
      accepted.push(entry);
    });
    if (staleCount > 0) setStaleEventCount((count) => count + staleCount);
    if (accepted.length > 0) {
      setP2pTableState((current) =>
        accepted.reduce((nextState, entry) => applyRoomEventToTableState(nextState, entry), current),
      );
      setRoomEvents((previous) => [...accepted.slice().reverse(), ...previous].slice(0, 8));
    }
  }, []);

  const closeTerminalSession = useCallback((code) => {
    setSyncStatus("closed");
    setStatusMessage(
      code === 4001
        ? copy.sessionReplaced
        : code === 4401
          ? copy.loginRequired
          : copy.roomClosed,
    );
    persistActiveRoom(null);
    setCreatedRoom(null);
    setP2pTableState(EMPTY_TABLE_STATE);
  }, [copy.loginRequired, copy.roomClosed, copy.sessionReplaced]);

  useEffect(() => {
    persistActiveRoom(createdRoom);
  }, [createdRoom]);

  useEffect(() => {
    if (!createdRoom?.roomId) return undefined;
    const url = buildRoomWebSocketUrl(createdRoom.roomId);

    let cancelled = false;
    let reconnectAttempt = 0;
    transportModeRef.current = "websocket";
    setSyncStatus("connecting");
    setRoomEvents([]);
    setP2pTableState({
      ...EMPTY_TABLE_STATE,
      roomId: createdRoom.roomId,
      phase: createdRoom.phase ?? "waiting",
      handId: createdRoom.handId ?? null,
      players: (createdRoom.players ?? []).map((player) =>
        typeof player === "string" ? player : player.id,
      ),
      playerStates: (createdRoom.players ?? []).map((player) =>
        typeof player === "string"
          ? mergePlayerStates([player], [], {}, {})[0]
          : player,
      ),
    });
    setLatestSequenceId(0);
    setStaleEventCount(0);
    latestSequenceRef.current = 0;

    const pollState = async () => {
      try {
        const state = await getRoomState(createdRoom.roomId);
        if (!cancelled) acceptRoomEvent({ event: "state", payload: state });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof RoomApiError && error.terminalCode) {
          closeTerminalSession(error.terminalCode);
          return;
        }
        setStatusMessage(error instanceof Error ? error.message : copy.socketNotConnected);
      }
    };

    const startPolling = () => {
      if (cancelled || transportModeRef.current === "polling") return;
      transportModeRef.current = "polling";
      socketRef.current = null;
      setSyncStatus("polling");
      void pollState();
      pollingTimerRef.current = window.setInterval(pollState, REST_POLL_INTERVAL_MS);
    };

    const scheduleReconnect = () => {
      reconnectAttempt += 1;
      if (reconnectAttempt >= WS_MAX_RECONNECT_ATTEMPTS) {
        startPolling();
        return;
      }
      setSyncStatus("reconnecting");
      const delay = Math.min(5_000, 500 * 2 ** Math.min(reconnectAttempt, 4));
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };

    const connect = () => {
      if (cancelled) return;
      if (!url || typeof WebSocket === "undefined") {
        startPolling();
        return;
      }
      setSyncStatus(reconnectAttempt > 0 ? "reconnecting" : "connecting");
      let socket;
      try {
        socket = new WebSocket(url, buildRoomWebSocketProtocols());
      } catch {
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;
      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
        transportModeRef.current = "websocket";
        setSyncStatus("connected");
        socket.send(JSON.stringify({ event: "sync", payload: {} }));
        if (heartbeatTimerRef.current) window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ event: "heartbeat", payload: {} }));
          }
        }, 25_000);
      });
      socket.addEventListener("message", (event) => {
      const parsed = (() => {
        try {
          return JSON.parse(event.data);
        } catch {
          return { event: "message", payload: event.data };
        }
      })();
      if (parsed?.event === "error") {
        setStatusMessage(parsed?.payload?.message ?? copy.socketNotConnected);
        return;
      }
      if (parsed?.event === "room_closed") {
        closeTerminalSession(4004);
        return;
      }
      acceptRoomEvent(parsed);
      });
      socket.addEventListener("close", (event) => {
        if (cancelled) return;
        if (heartbeatTimerRef.current) window.clearInterval(heartbeatTimerRef.current);
        if ([4001, 4004, 4401].includes(event.code)) {
          closeTerminalSession(event.code);
          return;
        }
        scheduleReconnect();
      });
      socket.addEventListener("error", () => setSyncStatus("error"));
    };
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) window.clearInterval(heartbeatTimerRef.current);
      if (pollingTimerRef.current) window.clearInterval(pollingTimerRef.current);
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) socket.close();
    };
  }, [
    createdRoom?.handId,
    createdRoom?.phase,
    createdRoom?.players,
    createdRoom?.roomId,
    acceptRoomEvent,
    closeTerminalSession,
    copy.socketNotConnected,
  ]);

  useEffect(() => {
    setSelectedCardIndexes([]);
  }, [p2pTableState.handId, p2pTableState.phase]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsCreating(true);
    setStatusMessage("");
    setCreatedRoom(null);
    try {
      const room = await createRoom({
        metadata: {
          variantId,
          startingStack: String(stack),
          smallBlind: String(smallBlind),
          bigBlind: String(bigBlind),
          ante: String(ante),
        },
      });
      setCreatedRoom({
        ...room,
        websocketUrl: buildRoomWebSocketUrl(room.roomId),
      });
      setStatusMessage(copy.roomCreated);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : copy.roomCreateFailed);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinExistingRoom = async (event) => {
    event.preventDefault();
    const roomId = joinCode.trim();
    if (!roomId) {
      setStatusMessage(copy.enterRoomCode);
      return;
    }
    setIsJoining(true);
    setStatusMessage("");
    setCreatedRoom(null);
    try {
      const info = await joinRoom({ roomId });
      setCreatedRoom({
        ...info,
        websocketUrl: buildRoomWebSocketUrl(roomId),
      });
      setStatusMessage(copy.joinedRoom);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : copy.joinFailed);
    } finally {
      setIsJoining(false);
    }
  };

  const handleBackToMenu = () => {
    navigate("/menu");
  };

  const sendRoomMessage = async (event, payload) => {
    if (!createdRoom?.roomId) return;
    if (transportModeRef.current === "polling") {
      try {
        const state =
          event === "ready"
            ? await readyRoom(createdRoom.roomId)
            : event === "draw"
              ? await drawInRoom(createdRoom.roomId, payload.cardIndexes)
              : await actInRoom(createdRoom.roomId, payload);
        acceptRoomEvent({ event: "state", payload: state });
      } catch (error) {
        if (error instanceof RoomApiError && error.terminalCode) {
          closeTerminalSession(error.terminalCode);
          return;
        }
        setStatusMessage(error instanceof Error ? error.message : copy.socketNotConnected);
      }
      return;
    }
    const socket = socketRef.current;
    const openState = typeof WebSocket !== "undefined" && WebSocket.OPEN ? WebSocket.OPEN : 1;
    if (!socket || socket.readyState !== openState) {
      setStatusMessage(copy.socketNotConnected);
      return;
    }
    socket.send(JSON.stringify({ event, payload }));
  };

  const sendReady = () => {
    if (!createdRoom?.ownerId) return;
    void sendRoomMessage("ready", {});
  };

  const sendAction = (type, amount = 0) => {
    if (!createdRoom?.ownerId) return;
    void sendRoomMessage("action", {
      type,
      amount,
    });
  };
  const sendDraw = () => {
    void sendRoomMessage("draw", { cardIndexes: selectedCardIndexes });
  };
  const handleLeave = async () => {
    if (!createdRoom?.roomId) return;
    try {
      await leaveRoom(createdRoom.roomId);
    } finally {
      persistActiveRoom(null);
      setCreatedRoom(null);
      setP2pTableState(EMPTY_TABLE_STATE);
    }
  };
  const canSendAction =
    Boolean(createdRoom?.ownerId) &&
    (!p2pTableState.currentTurnPlayerId ||
      p2pTableState.currentTurnPlayerId === createdRoom.ownerId);
  const tableBigBlind = Number(p2pTableState.config?.bigBlind ?? bigBlind);
  const filteredVariants = friendVariants;
  const hasAuth = Boolean(readRoomAuth());

  return (
    <div
      className="min-h-screen overflow-x-clip px-4 py-10 text-white"
      style={{
        background: `radial-gradient(120% 120% at 50% 0%, ${designTokens.colors.surface} 0%, ${designTokens.colors.background} 60%)`,
      }}
    >
      <div className="mx-auto min-w-0 max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">{copy.eyebrow}</p>
          <h1 className="text-3xl font-bold text-white">{copy.title}</h1>
          <p className="text-sm text-slate-300">
            {copy.description}
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="min-w-0 rounded-3xl border border-white/10 bg-slate-900/80 p-4 space-y-8 sm:p-6"
        >
          <section aria-label="Game variant" className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">{copy.variant}</p>
              <h2 className="text-xl font-semibold text-white">{copy.chooseGame}</h2>
            </div>
            <p className="rounded-2xl border border-emerald-400/20 bg-slate-950/40 px-4 py-3 text-xs text-slate-300">
              {languageKey === "ja"
                ? "現在は品質保証済みの2人Badugiのみ利用できます。"
                : "Friend Match currently supports the quality-gated heads-up Badugi game."}
            </p>
            <div
              className="space-y-3"
              role="radiogroup"
              aria-label="Game variant options"
              data-testid="friend-variant-options"
            >
              {filteredVariants.length > 0 ? (
                filteredVariants.map((variant) => (
                  <VariantOption
                    key={variant.id}
                    variant={variant}
                    isSelected={variantId === variant.id}
                    onSelect={setVariantId}
                    copy={copy}
                  />
                ))
              ) : (
                <p
                  data-testid="friend-variant-no-results"
                  className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
                >
                  {copy.noVariants}
                </p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">{copy.tableRules}</p>
              <h2 className="text-xl font-semibold text-white">{copy.setParams}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
                <label htmlFor="friend-seats">{copy.seats}</label>
                <input
                  id="friend-seats"
                  name="seats"
                  type="number"
                  min="2"
                  max="2"
                  value={seats}
                  readOnly
                  className="min-w-0 w-full rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
                <label htmlFor="friend-starting-stack">{copy.startingStack}</label>
                <input
                  id="friend-starting-stack"
                  name="startingStack"
                  type="number"
                  min="500"
                  step="100"
                  value={stack}
                  onChange={(event) => setStack(Number(event.target.value))}
                  className="min-w-0 w-full rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
                <label htmlFor="friend-small-blind">{copy.smallBlind}</label>
                <input
                  id="friend-small-blind"
                  name="smallBlind"
                  type="number"
                  min="1"
                  value={smallBlind}
                  onChange={(event) => setSmallBlind(Number(event.target.value))}
                  className="min-w-0 w-full rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
                <label htmlFor="friend-big-blind">{copy.bigBlind}</label>
                <input
                  id="friend-big-blind"
                  name="bigBlind"
                  type="number"
                  min="2"
                  value={bigBlind}
                  onChange={(event) => setBigBlind(Number(event.target.value))}
                  className="min-w-0 w-full rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1 text-sm text-slate-300 md:col-span-2">
                <label htmlFor="friend-ante">{copy.ante}</label>
                <input
                  id="friend-ante"
                  name="ante"
                  type="number"
                  min="0"
                  value={ante}
                  onChange={(event) => setAnte(Number(event.target.value))}
                  className="min-w-0 w-full rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button
              type="submit"
              disabled={isCreating || !hasAuth}
              className="flex-1 rounded-3xl bg-emerald-500/90 px-6 py-3 text-lg font-semibold text-slate-950 hover:bg-emerald-400 transition"
            >
              {isCreating ? copy.creating : copy.createRoom}
            </button>
            <button
              type="button"
              onClick={handleBackToMenu}
              className="flex-1 rounded-3xl border border-white/20 px-6 py-3 text-lg font-semibold text-white hover:border-emerald-400/60 hover:text-emerald-200 transition"
            >
              {copy.backToMenu}
            </button>
          </div>

          {statusMessage && (
            <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-amber-200 text-sm">
              {statusMessage}
            </p>
          )}
          {!hasAuth ? (
            <p className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {copy.loginRequired}
            </p>
          ) : null}
          {createdRoom && (
            <section className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                  {copy.roomCode}
                </span>
                  <strong className="break-all text-lg text-white">{createdRoom.roomId}</strong>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(createdRoom.roomId);
                    setStatusMessage(copy.copied);
                  }}
                  className="rounded-xl border border-emerald-300/50 px-3 py-2 text-xs font-semibold"
                >
                  {copy.copyCode}
                </button>
              </div>
            </section>
          )}
        </form>

        <form
          onSubmit={handleJoinExistingRoom}
          className="min-w-0 rounded-3xl border border-white/10 bg-slate-900/70 p-4 space-y-4 sm:p-6"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">{copy.joinRoom}</p>
            <h2 className="text-xl font-semibold text-white">{copy.enterCode}</h2>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              aria-label={copy.roomCodeAria}
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="room-..."
              className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
            />
            <button
              type="submit"
              disabled={isJoining || !hasAuth}
              className="rounded-2xl border border-emerald-400/50 px-6 py-3 font-semibold text-emerald-100 hover:bg-emerald-400/10"
            >
              {isJoining ? copy.joining : copy.join}
            </button>
          </div>
        </form>

        {createdRoom && (
          <section className="min-w-0 rounded-3xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300 space-y-3 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
                {copy.syncStatus}
              </p>
              <strong className="text-white">{syncStatus}</strong>
            </div>
            <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
                {copy.latestSequence}: {latestSequenceId}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
                {copy.staleIgnored}: {staleEventCount}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-50">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                    {copy.liveTable}
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {p2pTableState.phase.toUpperCase()} / Pot {p2pTableState.pot}
                  </p>
                  {p2pTableState.handId ? (
                    <p className="text-xs text-emerald-100/70">{copy.hand} {p2pTableState.handId}</p>
                  ) : null}
                  {p2pTableState.currentTurnPlayerId ? (
                    <p className="text-xs text-emerald-100/80">
                      {copy.currentTurn}: {p2pTableState.currentTurnPlayerId === createdRoom.ownerId
                        ? copy.yourTurn
                        : copy.waitingTurn}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="p2p-ready"
                    onClick={sendReady}
                    className="rounded-xl border border-emerald-300/60 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-300/10"
                  >
                    {p2pTableState.phase === "showdown" &&
                    p2pTableState.playerStates.some((player) => player.stack <= 0)
                      ? copy.newMatch
                      : copy.ready}
                  </button>
                  {p2pTableState.legalActions.includes("check") ? (
                    <button
                      type="button"
                      data-testid="p2p-check"
                      onClick={() => sendAction("check")}
                      className="rounded-xl border border-sky-300/60 px-3 py-2 text-xs font-semibold text-sky-50"
                    >
                      {copy.check}
                    </button>
                  ) : null}
                  {p2pTableState.legalActions.includes("bet") ? (
                    <button
                      type="button"
                      data-testid="p2p-bet"
                      onClick={() => sendAction("bet", tableBigBlind)}
                      className="rounded-xl border border-sky-300/60 px-3 py-2 text-xs font-semibold text-sky-50"
                    >
                      {copy.betAction} {tableBigBlind}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    data-testid="p2p-call"
                    disabled={!canSendAction || !p2pTableState.legalActions.includes("call")}
                    onClick={() => sendAction("call")}
                    className="rounded-xl border border-sky-300/60 px-3 py-2 text-xs font-semibold text-sky-50 hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copy.call} {p2pTableState.toCall || ""}
                  </button>
                  {p2pTableState.legalActions.includes("raise") ? (
                    <button
                      type="button"
                      data-testid="p2p-raise"
                      onClick={() => sendAction("raise", p2pTableState.toCall + tableBigBlind)}
                      className="rounded-xl border border-violet-300/60 px-3 py-2 text-xs font-semibold text-violet-50"
                    >
                      {copy.raise} {p2pTableState.toCall + tableBigBlind}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    data-testid="p2p-draw"
                    disabled={!p2pTableState.legalActions.includes("draw")}
                    onClick={sendDraw}
                    className="rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {selectedCardIndexes.length === 0
                      ? copy.standPat
                      : `${copy.draw} ${selectedCardIndexes.length}`}
                  </button>
                  <button
                    type="button"
                    data-testid="p2p-fold"
                    disabled={!canSendAction || !p2pTableState.legalActions.includes("fold")}
                    onClick={() => sendAction("fold", 0)}
                    className="rounded-xl border border-rose-300/60 px-3 py-2 text-xs font-semibold text-rose-50 hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copy.fold}
                  </button>
                  <button
                    type="button"
                    data-testid="p2p-leave"
                    onClick={handleLeave}
                    className="rounded-xl border border-white/30 px-3 py-2 text-xs font-semibold text-white"
                  >
                    {copy.leave}
                  </button>
                </div>
              </div>
              {p2pTableState.hand.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-emerald-100/80">
                    {p2pTableState.legalActions.includes("draw") ? copy.selectCards : copy.hand}
                  </p>
                  <div className="grid grid-cols-4 gap-2" data-testid="p2p-private-hand">
                    {p2pTableState.hand.map((card, index) => {
                      const selected = selectedCardIndexes.includes(index);
                      return (
                        <button
                          key={`${p2pTableState.handId}-${index}-${card}`}
                          type="button"
                          data-testid={`p2p-card-${index}`}
                          disabled={!p2pTableState.legalActions.includes("draw")}
                          aria-pressed={selected}
                          onClick={() =>
                            setSelectedCardIndexes((current) =>
                              current.includes(index)
                                ? current.filter((entry) => entry !== index)
                                : [...current, index],
                            )
                          }
                          className={`min-h-16 rounded-xl border px-2 py-3 text-lg font-bold ${
                            selected
                              ? "border-amber-300 bg-amber-300/20 text-amber-100"
                              : "border-white/25 bg-white text-slate-900"
                          } disabled:opacity-90`}
                        >
                          {card}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {p2pTableState.playerStates.length === 0 ? (
                  <p className="text-sm text-emerald-100/70">{copy.waitingPlayers}</p>
                ) : (
                  p2pTableState.playerStates.map((player) => (
                    <div
                      key={player.id}
                      data-testid={`p2p-player-${player.id}`}
                      className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <strong className="min-w-0 break-all text-white">{player.displayName}</strong>
                        <span className="shrink-0 text-xs text-emerald-100/70">
                          {player.ready ? copy.readyState : copy.notReadyState}
                          {player.folded ? copy.foldedState : ""}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-100/70">
                        {copy.stack} {player.stack} / {copy.bet} {player.bet}
                      </p>
                    </div>
                  ))
                )}
              </div>
              {p2pTableState.showdown ? (
                <div className="mt-3 rounded-xl border border-yellow-300/40 bg-yellow-300/10 px-3 py-2 text-yellow-100">
                  <p>
                    {copy.showdownWinner}:{" "}
                    {(p2pTableState.showdown.winnerIds ?? [])
                      .map((id) =>
                        p2pTableState.playerStates.find((player) => player.id === id)?.displayName ?? id,
                      )
                      .join(", ") || copy.noWinner}{" "}
                    / Pot {p2pTableState.showdown.pot ?? 0}
                  </p>
                  {Object.entries(p2pTableState.showdown.hands ?? {}).map(([id, cards]) => (
                    <p key={id} className="text-xs">
                      {p2pTableState.playerStates.find((player) => player.id === id)?.displayName ?? id}: {cards.join(" ")}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              {roomEvents.length === 0 ? (
                <p>{copy.noEvents}</p>
              ) : (
                roomEvents.map((entry, index) => (
                  <div
                    key={`${entry.event ?? "event"}-${entry.sequenceId ?? index}-${index}`}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">
                        {entry.event ?? "event"}
                        {entry.replayed ? " (replay)" : ""}
                      </span>
                      {entry.payload?.sequenceId || entry.sequenceId ? (
                        <span className="text-xs text-slate-500">
                          seq {entry.payload?.sequenceId ?? entry.sequenceId}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
