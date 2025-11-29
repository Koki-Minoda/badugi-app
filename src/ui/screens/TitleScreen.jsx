import React, { useEffect, useRef } from "react";
import mgxTitleKitsune from "../../assets/mgx_title_kitsune.png";

export default function TitleScreen({ onEnter }) {
  const containerRef = useRef(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      onEnter?.();
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="title-screen"
      className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-[#fbe8ba]"
    >
      <img
        src={mgxTitleKitsune}
        alt="MGX Kitsune Logo"
        className="mb-10 w-full max-w-5xl kitsune-glow object-contain"
      />
      <button
        type="button"
        onClick={() => onEnter?.()}
        className="rounded-full border border-amber-300/60 px-10 py-3 text-sm uppercase tracking-[0.3em] text-amber-100 transition hover:bg-amber-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        data-testid="title-enter-button"
      >
        Press Enter
      </button>
    </div>
  );
}
