import { getCurrentLevel } from "../../games/badugi/engine/tournamentMTT.js";

const DEFAULT_SEATS_PER_TABLE = 6;

function formatLevelLabel(level, fallbackLabel) {
  if (!level) {
    return fallbackLabel ?? "Level ?";
  }
  const ante = typeof level.ante === "number" ? level.ante : 0;
  return `Level ${level.levelIndex ?? "?"}  ${level.smallBlind}/${level.bigBlind} (Ante ${ante})`;
}

/**
 * Build the base HUD payload for the tournament view.
 * @param {Object} params
 * @param {Object|null} params.state TournamentStateMTT snapshot.
 * @param {Object|null} params.heroPlayer Hero player record.
 * @param {string|null} [params.heroTableId] Preferred table for hands-played tracking.
 * @param {number} [params.fallbackSeatsPerTable=6] Seat count fallback.
 * @returns {Object|null}
 */
export function buildTournamentHudPayload({
  state,
  heroPlayer,
  heroTableId = null,
  fallbackSeatsPerTable = DEFAULT_SEATS_PER_TABLE,
} = {}) {
  if (!state) return null;
  const config = state.config ?? {};
  const level = getCurrentLevel(state);
  const levelIndexDisplay =
    typeof level?.levelIndex === "number" ? level.levelIndex : (state.levelIndex ?? 0) + 1;
  const levelLabel = formatLevelLabel(level, `Level ${levelIndexDisplay}`);
  const tablesActive = Array.isArray(state.tables)
    ? state.tables.filter((table) => table.isActive).length
    : 0;
  const heroSeatNumber =
    typeof heroPlayer?.seatIndex === "number" ? heroPlayer.seatIndex + 1 : "-";
  const rawTableLabel = heroPlayer?.tableId
    ? heroPlayer.tableId.split("-")[1] ?? heroPlayer.tableId
    : "-";
  const tableLabel = tablesActive <= 1 ? "Final" : rawTableLabel;

  const seatsPerTable = config.seatsPerTable ?? fallbackSeatsPerTable;
  const entrantsFallback =
    (Math.max(1, Number(config.tables) || 1) *
      Math.max(1, Number(seatsPerTable) || fallbackSeatsPerTable)) ||
    fallbackSeatsPerTable;
  const totalEntrants = Math.max(state.totalPlayers ?? 0, entrantsFallback);

  const alivePlayers = Object.values(state.players ?? {}).filter((player) => !player?.busted);
  const playersRemaining =
    alivePlayers.length || Math.max(0, Number(state.playersRemaining) || 0);
  const totalChipsInPlay = alivePlayers.reduce(
    (sum, player) => sum + Math.max(0, Number(player?.stack) || 0),
    0,
  );
  const averageStack =
    playersRemaining > 0 ? Math.floor(totalChipsInPlay / playersRemaining) : null;
  const startingStackValue = Math.max(1, Number(config.startingStack) || 1);
  const prizePoolTotal = startingStackValue * totalEntrants;

  const payoutList = Array.isArray(config.payouts) ? [...config.payouts] : [];
  const payoutBreakdown = payoutList.slice(0, 3).map((entry, idx) => {
    const percent = typeof entry?.percent === "number" ? entry.percent : null;
    const amount =
      percent != null ? Math.floor((percent / 100) * prizePoolTotal) : null;
    return {
      place: entry?.place ?? idx + 1,
      percent,
      amount,
    };
  });
  while (payoutBreakdown.length < 3) {
    const nextPlace = payoutBreakdown.length + 1;
    payoutBreakdown.push({ place: nextPlace, percent: null, amount: null });
  }

  const heroTableLookupId = heroTableId ?? heroPlayer?.tableId ?? null;
  const referenceTable =
    (heroTableLookupId &&
      (state.tables ?? []).find((table) => table.tableId === heroTableLookupId)) ||
    (state.tables ?? []).find((table) => table.isActive) ||
    (state.tables ?? [])[0] ||
    null;
  const handsPlayedThisLevel = referenceTable?.handsPlayedAtThisLevel ?? 0;
  const handsThisLevel = level?.handsThisLevel ?? null;
  const nextLevel =
    Array.isArray(config.levels) && state.levelIndex + 1 < config.levels.length
      ? config.levels[state.levelIndex + 1]
      : null;

  const payoutCount = Array.isArray(config.payouts) ? config.payouts.length : 0;
  const payoutSummaryText = payoutCount > 0 ? `Top ${payoutCount} paid` : null;
  const isFinalTable =
    tablesActive <= 1 &&
    playersRemaining <= Math.max(1, Number(seatsPerTable) || fallbackSeatsPerTable);

  return {
    tournamentName: config.name ?? "Store Tournament",
    levelLabel,
    currentLevelNumber: levelIndexDisplay,
    currentBlinds: {
      sb: level?.smallBlind ?? null,
      bb: level?.bigBlind ?? null,
      ante: level?.ante ?? null,
    },
    nextLevelBlinds: nextLevel
      ? {
          sb: nextLevel.smallBlind ?? null,
          bb: nextLevel.bigBlind ?? null,
          ante: nextLevel.ante ?? null,
        }
      : null,
    playersRemainingText: `Players Remaining: ${playersRemaining} / ${totalEntrants}`,
    tablesActiveText: tablesActive <= 1 ? "Tables: Final" : `Tables: ${tablesActive}`,
    heroPositionText: `Table ${tableLabel}  Seat ${heroSeatNumber}`,
    payoutSummaryText,
    isFinalTable,
    playersRemaining,
    totalPlayers: totalEntrants,
    totalEntrants,
    averageStack,
    prizePoolTotal,
    payoutBreakdown,
    handsPlayedThisLevel,
    handsThisLevel,
    nextBreakLabel: null,
  };
}

/**
 * Merge variant labels into the HUD payload.
 * @param {Object|null} payload
 * @param {Object} labels
 * @param {string|null} labels.currentVariantLabel
 * @param {string|null} labels.nextVariantLabel
 * @returns {Object|null}
 */
export function attachVariantLabelsToHud(payload, { currentVariantLabel, nextVariantLabel } = {}) {
  if (!payload) return null;
  const augmented = {
    ...payload,
    currentVariantLabel: currentVariantLabel ?? null,
    nextVariantLabel: nextVariantLabel ?? null,
  };
  return augmented;
}
