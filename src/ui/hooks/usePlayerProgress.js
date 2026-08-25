import { useEffect, useState } from "react";
import { getPlayerProgressFromConsolidated } from "../utils/consolidatedProgress.js";

export function usePlayerProgress() {
  const [progress, setProgress] = useState(() =>
    getPlayerProgressFromConsolidated(),
  );

  useEffect(() => {
    function handleProgressEvent() {
      setProgress(getPlayerProgressFromConsolidated());
    }
    if (typeof window !== "undefined") {
      window.addEventListener("badugi:playerProgress-changed", handleProgressEvent);
      window.addEventListener("badugi:worldChampUnlocked", handleProgressEvent);
      window.addEventListener("storage", handleProgressEvent);
      return () => {
        window.removeEventListener("badugi:playerProgress-changed", handleProgressEvent);
        window.removeEventListener("badugi:worldChampUnlocked", handleProgressEvent);
        window.removeEventListener("storage", handleProgressEvent);
      };
    }
    return undefined;
  }, []);

  return progress;
}
