export function findReplayFrameIndex(frames = [], target = {}) {
  if (!Array.isArray(frames) || !frames.length || !target) return -1;
  const actionSeqCandidates = [
    target.actionSeq,
    target.actionSeqStart,
    target.actionSeqRange?.start,
    target.replayTarget?.actionSeq,
    target.replayTarget?.actionSeqStart,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  const actionSeq = actionSeqCandidates[0] ?? null;
  if (actionSeq) {
    const exact = frames.findIndex((frame) => Number(frame?.event?.actionSeq) === actionSeq);
    if (exact >= 0) return exact;
  }
  const targetSeat = Number(target.seat);
  const targetStreet = typeof target.street === "string" ? target.street.toUpperCase() : null;
  const targetType = typeof target.type === "string" ? target.type.toLowerCase() : null;
  return frames.findIndex((frame) => {
    const event = frame?.event ?? {};
    if (Number.isInteger(targetSeat) && event.seat !== targetSeat) return false;
    if (targetStreet && String(frame?.phase ?? event.street ?? "").toUpperCase() !== targetStreet) {
      return false;
    }
    if (targetType) {
      const eventType = String(event.action ?? event.type ?? "").toLowerCase();
      if (!eventType.includes(targetType)) return false;
    }
    return event.type === "BET_ACTION" || event.type === "DRAW_ACTION";
  });
}
