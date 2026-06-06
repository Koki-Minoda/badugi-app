export const NPC_AUTO_ACTION_DELAY_MS = 250;

export function shouldBypassNpcDrawAllInAutoDelay({ phase, seatIndex, player } = {}) {
  if (phase !== "DRAW") return false;
  if (seatIndex === 0) return false;
  if (!player) return false;
  return Boolean(player.allIn || Math.max(0, Number(player.stack) || 0) <= 0);
}

export function runNpcDrawAllInAutoFastPath({
  phase,
  seatIndex,
  player,
  autoResolveCpuDrawIfNeeded,
} = {}) {
  if (!shouldBypassNpcDrawAllInAutoDelay({ phase, seatIndex, player })) {
    return false;
  }
  if (typeof autoResolveCpuDrawIfNeeded === "function") {
    autoResolveCpuDrawIfNeeded();
  }
  return true;
}
