import { useEffect, useState } from "react";
import { loadPlayerProgress } from "../utils/playerProgress.js";

export function usePlayerProgress() {
  const [progress, setProgress] = useState(() => loadPlayerProgress());

  useEffect(() => {
    function handleProgressEvent() {
      setProgress(loadPlayerProgress());
    }
    if (typeof window !== "undefined") {
      window.addEventListener("badugi:playerProgress-changed", handleProgressEvent);
      window.addEventListener("storage", handleProgressEvent);
      return () => {
        window.removeEventListener("badugi:playerProgress-changed", handleProgressEvent);
        window.removeEventListener("storage", handleProgressEvent);
      };
    }
    return undefined;
  }, []);

  return progress;
}
