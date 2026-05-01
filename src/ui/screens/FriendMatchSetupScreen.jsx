import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { designTokens } from "../../styles/designTokens.js";
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

function VariantOption({ variant, isSelected, onSelect }) {
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
        <span className="text-xs text-slate-500">Enabled</span>
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

export default function FriendMatchSetupScreen() {
  const navigate = useNavigate();
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
            displayName: createdRoom.displayName ?? "Host",
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
  }, [createdRoom]);

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
        displayName: "Host",
        seatHint: "0",
      });
      setCreatedRoom({
        ...room,
        ownerId,
        displayName: "Host",
        players: [ownerId],
        websocketUrl: buildRoomWebSocketUrl(room.roomId),
      });
      setStatusMessage("Room created. Share the room code and use Ready when both players join.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to create room.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinExistingRoom = async (event) => {
    event.preventDefault();
    const roomId = joinCode.trim();
    if (!roomId) {
      setStatusMessage("Enter a room code.");
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
        displayName: "Guest",
        seatHint: String(info.players?.length ?? 0),
      });
      setCreatedRoom({
        roomId,
        phase: info.phase,
        metadata: info.metadata,
        maxPlayers: info.maxPlayers ?? info.metadata?.maxPlayers,
        ownerId: playerId,
        displayName: "Guest",
        players: info.players?.map((player) => player.id) ?? [playerId],
        websocketUrl: buildRoomWebSocketUrl(roomId),
      });
      setStatusMessage("Joined room. Waiting for live table synchronization.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to join room.");
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
      setStatusMessage("Room socket is not connected yet.");
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

  return (
    <div
      className="min-h-screen px-4 py-10 text-white"
      style={{
        background: `radial-gradient(120% 120% at 50% 0%, ${designTokens.colors.surface} 0%, ${designTokens.colors.background} 60%)`,
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Friend Match</p>
          <h1 className="text-3xl font-bold text-white">Create a Room</h1>
          <p className="text-sm text-slate-300">
            Configure a private table for friends. Networking will arrive soon; for now this is a
            configuration preview.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-8"
        >
          <section aria-label="Game variant" className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Variant</p>
              <h2 className="text-xl font-semibold text-white">Choose your game</h2>
            </div>
            <div className="space-y-3" role="radiogroup" aria-label="Game variant options">
              {enabledVariants.map((variant) => (
                <VariantOption
                  key={variant.id}
                  variant={variant}
                  isSelected={variantId === variant.id}
                  onSelect={setVariantId}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Table Rules</p>
              <h2 className="text-xl font-semibold text-white">Set table parameters</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col text-sm text-slate-300 gap-1">
                <label htmlFor="friend-seats">Seats</label>
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
                <label htmlFor="friend-starting-stack">Starting Stack</label>
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
                <label htmlFor="friend-small-blind">Small Blind</label>
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
                <label htmlFor="friend-big-blind">Big Blind</label>
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
                <label htmlFor="friend-ante">Ante (Optional)</label>
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
              {isCreating ? "Creating..." : "Create Room"}
            </button>
            <button
              type="button"
              onClick={handleBackToMenu}
              className="flex-1 rounded-3xl border border-white/20 px-6 py-3 text-lg font-semibold text-white hover:border-emerald-400/60 hover:text-emerald-200 transition"
            >
              Back to Menu
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
                  Room Code
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
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Join Room</p>
            <h2 className="text-xl font-semibold text-white">Enter a room code</h2>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              aria-label="Room code"
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
              {isJoining ? "Joining..." : "Join"}
            </button>
          </div>
        </form>

        {createdRoom && (
          <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
                Sync Status
              </p>
              <strong className="text-white">{syncStatus}</strong>
            </div>
            <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
                Latest sequence: {latestSequenceId}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
                Stale ignored: {staleEventCount}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-50">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                    Live Table State
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {p2pTableState.phase.toUpperCase()} / Pot {p2pTableState.pot}
                  </p>
                  {p2pTableState.handId ? (
                    <p className="text-xs text-emerald-100/70">Hand {p2pTableState.handId}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="p2p-ready"
                    onClick={sendReady}
                    className="rounded-xl border border-emerald-300/60 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-300/10"
                  >
                    Ready
                  </button>
                  <button
                    type="button"
                    data-testid="p2p-call"
                    onClick={() => sendAction("call", bigBlind)}
                    className="rounded-xl border border-sky-300/60 px-3 py-2 text-xs font-semibold text-sky-50 hover:bg-sky-300/10"
                  >
                    Call {bigBlind}
                  </button>
                  <button
                    type="button"
                    data-testid="p2p-draw"
                    onClick={() => sendAction("draw", 0)}
                    className="rounded-xl border border-amber-300/60 px-3 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-300/10"
                  >
                    Draw
                  </button>
                  <button
                    type="button"
                    data-testid="p2p-fold"
                    onClick={() => sendAction("fold", 0)}
                    className="rounded-xl border border-rose-300/60 px-3 py-2 text-xs font-semibold text-rose-50 hover:bg-rose-300/10"
                  >
                    Fold
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {p2pTableState.playerStates.length === 0 ? (
                  <p className="text-sm text-emerald-100/70">Waiting for players...</p>
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
                          {player.ready ? "ready" : "not ready"}
                          {player.folded ? " / folded" : ""}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-100/70">
                        Stack {player.stack} / Bet {player.bet}
                      </p>
                    </div>
                  ))
                )}
              </div>
              {p2pTableState.showdown ? (
                <p className="mt-3 rounded-xl border border-yellow-300/40 bg-yellow-300/10 px-3 py-2 text-yellow-100">
                  Showdown winner: {p2pTableState.showdown.winner ?? "none"} / Pot{" "}
                  {p2pTableState.showdown.pot ?? 0}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              {roomEvents.length === 0 ? (
                <p>No room events received yet.</p>
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
