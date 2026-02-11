import React, { useEffect, useState } from "react";
import GameLayoutBase from "./GameLayoutBase.jsx";

const BASE_WIDTH = 1280;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1;

function computeScale() {
  if (typeof window === "undefined") return 1;
  const width = window.innerWidth || BASE_WIDTH;
  const raw = width / BASE_WIDTH;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
}

export default function MobileGameLayout(props) {
  const { debugFlags, onDebugScale, ...rest } = props;
  const [scale, setScale] = useState(() => computeScale());
  const disableScale = Boolean(debugFlags?.noscale);
  const effectiveScale = disableScale ? 1 : scale;

  useEffect(() => {
    const handleResize = () => setScale(computeScale());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof onDebugScale === "function") {
      onDebugScale(effectiveScale);
    }
  }, [effectiveScale, onDebugScale]);

  return (
    <div
      className={`mobile-scroll-root ${debugFlags?.novh ? "min-h-0" : "min-h-screen"} w-full overflow-y-auto bg-gray-900`}
    >
      <div
        className="mobile-scale-root origin-top-left"
        style={{
          transform: disableScale ? "none" : `scale(${scale})`,
          transformOrigin: "top left",
          minWidth: `${BASE_WIDTH}px`,
        }}
      >
        <GameLayoutBase {...rest} debugFlags={debugFlags} layoutMode="mobile" />
      </div>
    </div>
  );
}
