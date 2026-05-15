export function createShadowSourceAttribution({
  selectedRow = null,
  matchedRows = [],
} = {}) {
  const rows = Array.isArray(matchedRows) ? matchedRows : [];
  const relaxedRow = rows.find((row) => String(row?.sourceType ?? row?.metadata?.sourceType ?? "") === "verified-relaxed-match") ?? null;
  const selectedSource = String(selectedRow?.sourceType ?? selectedRow?.metadata?.sourceType ?? "");
  const shadowSource = String(relaxedRow?.sourceType ?? relaxedRow?.metadata?.sourceType ?? "");
  const selectedAction = String(selectedRow?.chosenBestAction?.type ?? "").toUpperCase();
  const shadowAction = String(relaxedRow?.chosenBestAction?.type ?? "").toUpperCase();
  return {
    selectedSource,
    shadowRelaxedSource: shadowSource || null,
    sameAction: Boolean(selectedAction && shadowAction && selectedAction === shadowAction),
    differentAction: Boolean(selectedAction && shadowAction && selectedAction !== shadowAction),
    evEstimateDelta: Number(
      (
        Number(selectedRow?.trainingWeight ?? 0) -
        Number(relaxedRow?.trainingWeight ?? 0)
      ).toFixed(4),
    ),
    selectionReason:
      selectedSource && shadowSource
        ? selectedSource === shadowSource
          ? "same-source"
          : "higher-specificity-or-priority"
        : selectedSource
          ? "no-relaxed-shadow"
          : "no-selection",
  };
}
