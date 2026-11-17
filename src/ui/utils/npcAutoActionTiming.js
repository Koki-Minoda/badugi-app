// Keep the existing thinking time, then add a brief readable beat per CPU.
export const NPC_ACTION_READ_PAUSE_MS = 200;
export const BOARD_NPC_AUTO_ACTION_DELAY_MS = 180 + NPC_ACTION_READ_PAUSE_MS;
export const NPC_AUTO_ACTION_DELAY_MS = 250 + NPC_ACTION_READ_PAUSE_MS;

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
