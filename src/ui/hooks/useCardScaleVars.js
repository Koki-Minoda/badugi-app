import { useEffect, useState } from "react";

const TABLE_BASE_WIDTH = 1280;
const CARD_BASE_WIDTH = 56;
const CARD_MIN_WIDTH = 38;
const CARD_MAX_WIDTH = 64;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPx(value) {
  return `${Math.round(value)}px`;
}

function buildVars(containerWidth) {
  const safeWidth =
    Number.isFinite(containerWidth) && containerWidth > 0
      ? containerWidth
      : TABLE_BASE_WIDTH;
  const scale = clamp(safeWidth / TABLE_BASE_WIDTH, 0.72, 1.0);
  const cardWidth = clamp(CARD_BASE_WIDTH * scale, CARD_MIN_WIDTH, CARD_MAX_WIDTH);
  const cardHeight = cardWidth * 1.4;
  const playerPad = clamp(cardWidth * 0.2, 8, 12);
  const playerGap = clamp(cardWidth * 0.14, 6, 10);
  const playerNameSize = clamp(cardWidth * 0.28, 12, 16);
  const playerMetaSize = clamp(cardWidth * 0.16, 9, 11);
  const playerStackSize = clamp(cardWidth * 0.2, 10, 12);
  const playerActionSize = clamp(cardWidth * 0.2, 10, 13);
  const chipBubbleSize = clamp(cardWidth * 0.5, 18, 30);
  const chipBubbleFont = clamp(cardWidth * 0.18, 9, 12);
  const chipAmountSize = clamp(cardWidth * 0.25, 11, 15);
  const cardGap = clamp(cardWidth * 0.16, 5, 9);
  const actionMinHeight = clamp(cardWidth * 0.32, 14, 20);
  const cardStripWidth = clamp(cardWidth * 4 + cardGap * 3 + 20, 170, 320);

  return {
    "--card-w": toPx(cardWidth),
    "--card-h": toPx(cardHeight),
    "--card-font-size": toPx(clamp(cardWidth * 0.29, 12, 18)),
    "--card-dot-size": toPx(clamp(cardWidth * 0.125, 5, 8)),
    "--card-center-size": toPx(clamp(cardWidth * 0.62, 24, 40)),
    "--card-center-inner-size": toPx(clamp(cardWidth * 0.25, 10, 16)),
    "--player-pad": toPx(playerPad),
    "--player-gap": toPx(playerGap),
    "--player-name-size": toPx(playerNameSize),
    "--player-meta-size": toPx(playerMetaSize),
    "--player-stack-size": toPx(playerStackSize),
    "--player-action-size": toPx(playerActionSize),
    "--player-chip-bubble-size": toPx(chipBubbleSize),
    "--player-chip-bubble-font-size": toPx(chipBubbleFont),
    "--player-chip-amount-size": toPx(chipAmountSize),
    "--player-chip-pad-x": toPx(clamp(cardWidth * 0.18, 7, 12)),
    "--player-chip-pad-y": toPx(clamp(cardWidth * 0.09, 4, 8)),
    "--player-card-gap": toPx(cardGap),
    "--player-card-strip-maxw": toPx(cardStripWidth),
    "--player-action-min-h": toPx(actionMinHeight),
  };
}

function isSameVars(prev, next) {
  return (
    prev["--card-w"] === next["--card-w"] &&
    prev["--card-h"] === next["--card-h"] &&
    prev["--card-font-size"] === next["--card-font-size"] &&
    prev["--card-dot-size"] === next["--card-dot-size"] &&
    prev["--card-center-size"] === next["--card-center-size"] &&
    prev["--card-center-inner-size"] === next["--card-center-inner-size"]
  );
}

export default function useCardScaleVars(targetRef) {
  const [vars, setVars] = useState(() => buildVars(TABLE_BASE_WIDTH));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const target = targetRef?.current;
    if (!target) return undefined;

    const update = (width) => {
      const next = buildVars(width);
      setVars((prev) => (isSameVars(prev, next) ? prev : next));
    };

    update(target.getBoundingClientRect().width || target.clientWidth);

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => {
        update(target.getBoundingClientRect().width || target.clientWidth);
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      update(entry.contentRect?.width ?? target.clientWidth);
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef]);

  return vars;
}
