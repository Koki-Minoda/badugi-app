export const HISTORY_EXPORT_SCHEMA = "mgx-hand-history-export/v1";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function createHistoryExportPayload({
  cashHands = [],
  tournaments = [],
  tournamentHands = [],
  liveHand = null,
  exportedAt = new Date().toISOString(),
} = {}) {
  return {
    schema: HISTORY_EXPORT_SCHEMA,
    exportedAt,
    privacy: "player-local-history",
    counts: {
      cashHands: cashHands.length,
      tournaments: tournaments.length,
      tournamentHands: tournamentHands.length,
      liveHands: liveHand ? 1 : 0,
    },
    cashHands: cloneJson(cashHands),
    tournaments: cloneJson(tournaments),
    tournamentHands: cloneJson(tournamentHands),
    liveHand: cloneJson(liveHand),
  };
}

export function downloadHistoryExport(payload, {
  documentRef = globalThis.document,
  urlRef = globalThis.URL,
} = {}) {
  if (!documentRef || !urlRef?.createObjectURL) return false;
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const href = urlRef.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  const stamp = String(payload?.exportedAt ?? new Date().toISOString())
    .replace(/[:.]/g, "-");
  anchor.href = href;
  anchor.download = `mgx-hand-history-${stamp}.json`;
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  urlRef.revokeObjectURL(href);
  return true;
}
