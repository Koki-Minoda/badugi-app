import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { designTokens } from "../../styles/designTokens.js";
import { LANGUAGE_STORAGE_KEY, MGX_DEFAULT_LOCALE } from "../../config/mgxLocaleConfig.js";
import { getEnabledVariants } from "../game/variants.js";
import { buildRoomWebSocketUrl, createRoom, getRoomInfo, joinRoom } from "../utils/roomApi.js";

const ACTIVE_ROOM_STORAGE_KEY = "mgx_friend_match_active_room_v1";

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
    call: "コール",
    draw: "ドロー",
    fold: "フォールド",
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
    call: "Call",
    draw: "Draw",
    fold: "Fold",
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
        <span className="text-xs text-slate-500">{copy.enabled}</span>
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
  const enabledVariants = useMemo(() => getEnabledVariants(), []);
  const [variantId, setVariantId] = useState(enabledVariants[0]?.id ?? "badugi");
  const [seats, setSeats] = useState(4);
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
  const socketRef = useRef(null);
  const latestSequenceRef = useRef(0);

  useEffect(() => {
    persistActiveRoom(createdRoom);
  }, [createdRoom]);

  useEffect(() => {
    if (!createdRoom?.roomId || typeof WebSocket === "undefined") return undefined;
    const url = buildRoomWebSocketUrl(createdRoom.roomId);
    if (!url) return undefined;

    setSyncStatus("connecting");
    setRoomEvents([]);
    setP2pTableState({
      ...EMPTY_TABLE_STATE,
      roomId: createdRoom.roomId,
      phase: createdRoom.phase ?? "waiting",
      handId: createdRoom.handId ?? null,
      players: createdRoom.players ?? [],
      playerStates: mergePlayerStates(createdRoom.players ?? [], [], {}, {}),
    });
    setLatestSequenceId(0);
    setStaleEventCount(0);
    latestSequenceRef.current = 0;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setSyncStatus("connected");
      socket.send(
        JSON.stringify({
          event: "join_room",
          payload: {
            playerId: createdRoom.ownerId,
            displayName: createdRoom.displayName ?? copy.hostName,
          },
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      const parsed = (() => {
        try {
          return JSON.parse(event.data);
        } catch {
          return { event: "message", payload: event.data };
        }
      })();
      const normalizedEvents = normalizeRoomEvent(parsed);
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
      if (staleCount > 0) {
        setStaleEventCount((count) => count + staleCount);
      }
      if (accepted.length > 0) {
        setP2pTableState((current) =>
          accepted.reduce((nextState, entry) => applyRoomEventToTableState(nextState, entry), current),
        );
        setRoomEvents((prev) => [...accepted.reverse(), ...prev].slice(0, 8));
      }
    });
    socket.addEventListener("close", () => {
      setSyncStatus("closed");
    });
    socket.addEventListener("error", () => {
      setSyncStatus("error");
    });

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [createdRoom, copy.hostName]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsCreating(true);
    setStatusMessage("");
    setCreatedRoom(null);
    const ownerId = `local-${Date.now().toString(36)}`;
    try {
      const room = await createRoom({
        ownerId,
        maxPlayers: seats,
        mode: "friend",
        metadata: {
          variantId,
          startingStack: String(stack),
          smallBlind: String(smallBlind),
          bigBlind: String(bigBlind),
          ante: String(ante),
        },
      });
      await joinRoom({
        roomId: room.roomId,
        playerId: ownerId,
        displayName: copy.hostName,
        seatHint: "0",
      });
      setCreatedRoom({
        ...room,
        ownerId,
        displayName: copy.hostName,
        players: [ownerId],
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
    const playerId = `guest-${Date.now().toString(36)}`;
    try {
      const info = await getRoomInfo(roomId);
      await joinRoom({
        roomId,
        playerId,
        displayName: copy.guestName,
        seatHint: String(info.players?.length ?? 0),
      });
      setCreatedRoom({
        roomId,
        phase: info.phase,
        metadata: info.metadata,
        maxPlayers: info.maxPlayers ?? info.metadata?.maxPlayers,
        ownerId: playerId,
        displayName: copy.guestName,
        players: info.players?.map((player) => player.id) ?? [playerId],
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

  const sendRoomMessage = (event, payload) => {
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
    sendRoomMessage("reaction", {
      playerId: createdRoom.ownerId,
      type: "ready",
    });
  };

  const sendAction = (type, amount = 0) => {
    if (!createdRoom?.ownerId) return;
    sendRoomMessage("action", {
      playerId: createdRoom.ownerId,
      type,
      amount,
    });
  };
  const canSendAction =
    Boolean(createdRoom?.ownerId) &&
    (!p2pTableState.currentTurnPlayerId ||
      p2pTableState.currentTurnPlayerId === createdRoom.ownerId);

  return (
    <div
      className="min-h-screen px-4 py-10 text-white"
      style={{
        background: `radial-gradient(120% 120% at 50% 0%, ${designTokens.colors.surface} 0%, ${designTokens.colors.background} 60%)`,
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">{copy.eyebrow}</p>
          <h1 className="text-3xl font-bold text-white">{copy.title}</h1>
          <p className="text-sm text-slate-300">
            {copy.description}
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-8"
        >
          <section aria-label="Game variant" className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">{copy.variant}</p>
              <h2 className="text-xl font-semibold text-white">{copy.chooseGame}</h2>
            </div>
            <div className="space-y-3" role="radiogroup" aria-label="Game variant options">
              {enabledVariants.map((variant) => (
                <VariantOption
                  key={variant.id}
                  variant={variant}
                  isSelected={variantId === variant.id}
                  onSelect={setVariantId}
                  copy={copy}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">{copy.tableRules}</p>
              <h2 className="text-xl font-semibold text-white">{copy.setParams}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col text-sm text-slate-300 gap-1">
                <label htmlFor="friend-seats">{copy.seats}</label>
                <input
                  id="friend-seats"
                  name="seats"
                  type="number"
                  min="2"
                  max="8"
                  value={seats}
                  onChange={(event) => setSeats(Number(event.target.value))}
                  className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex flex-col text-sm text-slate-300 gap-1">
                <label htmlFor="friend-starting-stack">{copy.startingStack}</label>
                <input
                  id="friend-starting-stack"
                  name="startingStack"
                  type="number"
                  min="500"
                  step="100"
                  value={stack}
                  onChange={(event) => setStack(Number(event.target.value))}
                  className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex flex-col text-sm text-slate-300 gap-1">
                <label htmlFor="friend-small-blind">{copy.smallBlind}</label>
                <input
                  id="friend-small-blind"
                  name="smallBlind"
                  type="number"
                  min="1"
                  value={smallBlind}
                  onChange={(event) => setSmallBlind(Number(event.target.value))}
                  className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex flex-col text-sm text-slate-300 gap-1">
                <label htmlFor="friend-big-blind">{copy.bigBlind}</label>
                <input
                  id="friend-big-blind"
                  name="bigBlind"
                  type="number"
                  min="2"
                  value={bigBlind}
                  onChange={(event) => setBigBlind(Number(event.target.value))}
                  className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
              <div className="flex flex-col text-sm text-slate-300 gap-1 md:col-span-2">
                <label htmlFor="friend-ante">{copy.ante}</label>
                <input
                  id="friend-ante"
                  name="ante"
                  type="number"
                  min="0"
                  value={ante}
                  onChange={(event) => setAnte(Number(event.target.value))}
                  className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button
              type="submit"
              disabled={isCreating}
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
          {createdRoom && (
            <section className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 space-y-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                  {copy.roomCode}
                </span>
              <strong className="text-lg text-white">{createdRoom.roomId}</strong>
              </div>
              <p className="text-xs text-emerald-200/80">
                WebSocket: {createdRoom.websocketUrl}
              </p>
            </section>
          )}
        </form>

        <form
          onSubmit={handleJoinExistingRoom}
          className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 space-y-4"
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
              className="flex-1 rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white"
            />
            <button
              type="submit"
              disabled={isJoining}
              className="rounded-2xl border border-emerald-400/50 px-6 py-3 font-semibold text-emerald-100 hover:bg-emerald-400/10"
            >
              {isJoining ? copy.joining : copy.join}
            </button>
          </div>
        </form>

        {createdRoom && (
          <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300 space-y-3">
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
                    {copy.ready}
                  </button>
                  <button
                    type="button"
                    data-testid="p2p-call"
                    disabled={!canSendAction}
                    onClick={() => sendAction("call", bigBlind)}
                    className="rounded-xl border border-sky-300/60 px-3 py-2 text-xs font-semibold text-sky-50 hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copy.call} {bigBlind}
                  </button>
                  <button
                    type="button"
                    data-testid="p2p-draw"
                    disabled={!canSendAction}
                    onClick={() => sendAction("draw", 0)}
                    className="rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copy.draw}
                  </button>
                  <button
                    type="button"
                    data-testid="p2p-fold"
                    disabled={!canSendAction}
                    onClick={() => sendAction("fold", 0)}
                    className="rounded-xl border border-rose-300/60 px-3 py-2 text-xs font-semibold text-rose-50 hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copy.fold}
                  </button>
                </div>
              </div>
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
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-white">{player.displayName}</strong>
                        <span className="text-xs text-emerald-100/70">
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
                <p className="mt-3 rounded-xl border border-yellow-300/40 bg-yellow-300/10 px-3 py-2 text-yellow-100">
                  {copy.showdownWinner}: {p2pTableState.showdown.winner ?? copy.noWinner} / Pot{" "}
                  {p2pTableState.showdown.pot ?? 0}
                </p>
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
