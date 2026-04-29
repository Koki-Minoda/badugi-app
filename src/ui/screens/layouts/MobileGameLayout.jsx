import React, { useEffect } from "react";
import GameLayoutBase from "./GameLayoutBase.jsx";

export default function MobileGameLayout(props) {
  const { debugFlags, onDebugScale, ...rest } = props;

  useEffect(() => {
    if (typeof onDebugScale === "function") {
      onDebugScale(1);
    }
  }, [onDebugScale]);

  return (
    <div
      className={`mobile-scroll-root ${debugFlags?.novh ? "min-h-0" : "min-h-screen"} w-full overflow-x-hidden overflow-y-auto bg-gray-900`}
      style={{
        minHeight: debugFlags?.novh ? undefined : "100dvh",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
      }}
    >
      <div
        className="mobile-scale-root w-full"
        style={{
          minHeight: debugFlags?.novh ? undefined : "100dvh",
        }}
      >
        <GameLayoutBase {...rest} debugFlags={debugFlags} layoutMode="mobile" />
      </div>
    </div>
  );
}
