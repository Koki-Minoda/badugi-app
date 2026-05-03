import React, { useEffect } from "react";
import GameLayoutBase from "./GameLayoutBase.jsx";

export default function MobileGameLayout(props) {
  const { debugFlags, onDebugScale, ...rest } = props;

  useEffect(() => {
    if (typeof onDebugScale === "function") {
      onDebugScale(1);
    }
  }, [onDebugScale]);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.width = "";
    };
  }, []);

  return (
    <div
      className="mobile-scroll-root fixed inset-0 h-screen w-screen overflow-hidden bg-gray-900"
      style={{
        height: debugFlags?.novh ? "100vh" : "100dvh",
        width: "100vw",
        overscrollBehavior: "none",
      }}
    >
      <div
        className="mobile-scale-root h-full w-full overflow-hidden"
        style={{
          height: debugFlags?.novh ? "100vh" : "100dvh",
        }}
      >
        <GameLayoutBase {...rest} debugFlags={debugFlags} layoutMode="mobile" />
      </div>
    </div>
  );
}
