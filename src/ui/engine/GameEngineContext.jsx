import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { getEngine } from "../../games/core/engineRegistry.js";

const GameEngineContext = createContext(null);

export function GameEngineProvider({ gameId = "badugi", children }) {
  const engineRef = useRef(null);
  const [engineId, setEngineId] = useState(gameId);

  const engine = useMemo(() => {
    engineRef.current = getEngine(engineId);
    return engineRef.current;
  }, [engineId]);

  const value = useMemo(
    () => ({
      engineId,
      setEngineId,
      engine,
    }),
    [engineId, engine, setEngineId]
  );

  return <GameEngineContext.Provider value={value}>{children}</GameEngineContext.Provider>;
}

export function useGameEngine() {
  const ctx = useContext(GameEngineContext);
  if (!ctx) {
    throw new Error("useGameEngine must be used within GameEngineProvider");
  }
  return ctx;
}
