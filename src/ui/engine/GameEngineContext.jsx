import React, { useMemo, useRef, useState } from "react";
import { getEngine } from "../../games/core/engineRegistry.js";
import { GameEngineContext } from "./gameEngineContext.js";

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
