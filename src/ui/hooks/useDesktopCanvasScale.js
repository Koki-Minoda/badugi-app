import { useEffect, useState } from "react";

export const DEFAULT_DESKTOP_CANVAS_SIZE = {
  width: 1600,
  height: 900,
};

function readViewport() {
  if (typeof window === "undefined") {
    return { width: 1600, height: 900 };
  }
  const vv = window.visualViewport;
  const width = Math.max(1, Math.round(vv?.width ?? window.innerWidth ?? 1));
  const height = Math.max(1, Math.round(vv?.height ?? window.innerHeight ?? 1));
  return { width, height };
}

function computeScaleState(baseWidth, baseHeight) {
  const viewport = readViewport();
  const rawScale = Math.min(viewport.width / baseWidth, viewport.height / baseHeight);
  const scale = Number.isFinite(rawScale)
    ? Math.max(0.1, Math.min(1, rawScale))
    : 1;
  const scaledWidth = baseWidth * scale;
  const scaledHeight = baseHeight * scale;
  const offsetX = Math.max(0, Math.floor((viewport.width - scaledWidth) / 2));
  const offsetY = Math.max(0, Math.floor((viewport.height - scaledHeight) / 2));
  return {
    scale,
    offsetX,
    offsetY,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    baseWidth,
    baseHeight,
  };
}

export function useDesktopCanvasScale({
  enabled = false,
  baseWidth = DEFAULT_DESKTOP_CANVAS_SIZE.width,
  baseHeight = DEFAULT_DESKTOP_CANVAS_SIZE.height,
} = {}) {
  const [scaleState, setScaleState] = useState(() =>
    computeScaleState(baseWidth, baseHeight),
  );

  useEffect(() => {
    const update = () => {
      if (!enabled) {
        const viewport = readViewport();
        setScaleState({
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          baseWidth,
          baseHeight,
        });
        return;
      }
      setScaleState(computeScaleState(baseWidth, baseHeight));
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
    };
  }, [enabled, baseWidth, baseHeight]);

  return scaleState;
}

export default useDesktopCanvasScale;
