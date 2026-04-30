import { useContext } from "react";
import { MixedGameContext } from "./mixedGameContext.js";

export function useMixedGame() {
  const ctx = useContext(MixedGameContext);
  if (!ctx) {
    throw new Error("useMixedGame must be used within MixedGameProvider");
  }
  return ctx;
}
