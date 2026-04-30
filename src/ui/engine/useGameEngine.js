import { useContext } from "react";
import { GameEngineContext } from "./gameEngineContext.js";

export function useGameEngine() {
  const ctx = useContext(GameEngineContext);
  if (!ctx) {
    throw new Error("useGameEngine must be used within GameEngineProvider");
  }
  return ctx;
}
