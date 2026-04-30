function normalizeSource(metadata = {}) {
  return (
    metadata.decisionSource ??
    metadata.source ??
    metadata.drawInfo?.decisionSource ??
    metadata.extra?.decisionSource ??
    null
  );
}

function normalizeTierId(metadata = {}) {
  return (
    metadata.tierId ??
    metadata.drawInfo?.tierId ??
    metadata.extra?.tierId ??
    null
  );
}

function normalizeReason(metadata = {}) {
  return (
    metadata.decisionReason ??
    metadata.reason ??
    metadata.drawInfo?.decisionReason ??
    metadata.extra?.decisionReason ??
    null
  );
}

function normalizeDiscardIndexes(metadata = {}) {
  const drawInfo = metadata.drawInfo ?? metadata;
  const indexes = drawInfo.discardIndexes ?? drawInfo.drawIndexes ?? [];
  return Array.isArray(indexes)
    ? indexes.filter((index) => Number.isInteger(index))
    : [];
}

export function extractAiDecisionEntry(entry = {}) {
  const metadata = entry.metadata ?? {};
  const source = normalizeSource(metadata);
  const tierId = normalizeTierId(metadata);
  if (!source && !tierId) return null;

  const action = String(entry.action ?? "").trim();
  const phase = String(entry.phase ?? entry.street ?? "").toUpperCase();
  const discardIndexes = normalizeDiscardIndexes(metadata);

  return {
    handId: entry.handId ?? null,
    seat: typeof entry.seat === "number" ? entry.seat : null,
    seatName: entry.seatName ?? (typeof entry.seat === "number" ? `Seat ${entry.seat}` : "CPU"),
    phase,
    action,
    source,
    tierId,
    reason: normalizeReason(metadata),
    discardIndexes,
    ts: Number(entry.ts) || 0,
  };
}

export function summarizeAiDecisionLog(actionLog = [], { limit = 6 } = {}) {
  const entries = (Array.isArray(actionLog) ? actionLog : [])
    .map(extractAiDecisionEntry)
    .filter(Boolean);
  const byTier = entries.reduce((acc, entry) => {
    const key = entry.tierId ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const bySource = entries.reduce((acc, entry) => {
    const key = entry.source ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const recent = entries
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .slice(0, Math.max(0, limit));

  return {
    total: entries.length,
    byTier,
    bySource,
    recent,
  };
}
