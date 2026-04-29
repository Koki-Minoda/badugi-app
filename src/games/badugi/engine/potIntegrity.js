import { buildSidePots, isFoldedOrOut } from "./roundFlow.jsx";

function cloneEligibleSeats(pot = {}) {
  const eligible = Array.isArray(pot?.eligible)
    ? pot.eligible
    : Array.isArray(pot?.eligibleSeats)
    ? pot.eligibleSeats
    : [];
  return Array.from(
    new Set(
      eligible
        .map((seat) => (typeof seat === "number" ? seat : null))
        .filter((seat) => seat !== null)
    )
  );
}

function clonePotEntry(pot = {}) {
  return {
    amount: Math.max(0, pot?.amount ?? pot?.potAmount ?? 0),
    eligible: cloneEligibleSeats(pot),
  };
}

function fallbackEligibleFromPlayers(players = []) {
  return players
    .map((player, seatIndex) => (!isFoldedOrOut(player) ? seatIndex : null))
    .filter((seatIndex) => seatIndex !== null);
}

export function calculatePotContributions(players = []) {
  const perSeat = players.map((player, seatIndex) => ({
    seatIndex,
    amount: Math.max(0, player?.totalInvested ?? player?.betThisRound ?? 0),
  }));
  const total = perSeat.reduce((sum, entry) => sum + entry.amount, 0);
  return { perSeat, total };
}

export function normalizePotsWithContributions(players = [], existingPots = []) {
  const derived = buildSidePots(players);
  const basePots = derived.length
    ? derived
    : Array.isArray(existingPots)
    ? existingPots.map(clonePotEntry)
    : [];
  const contributions = calculatePotContributions(players);
  const normalized = basePots.map(clonePotEntry);
  let totalPot = normalized.reduce((sum, pot) => sum + pot.amount, 0);

  if ((!normalized.length || totalPot !== contributions.total) && contributions.total > 0) {
    const eligible = fallbackEligibleFromPlayers(players);
    if (!normalized.length) {
      normalized.push({ amount: contributions.total, eligible });
      totalPot = contributions.total;
    } else {
      const diff = contributions.total - totalPot;
      if (diff !== 0) {
        const targetIndex = normalized.findIndex((pot) => pot.amount > 0);
        const idx = targetIndex >= 0 ? targetIndex : 0;
        if (!normalized[idx]) {
          normalized[idx] = { amount: 0, eligible };
        }
        normalized[idx] = {
          amount: Math.max(0, (normalized[idx]?.amount ?? 0) + diff),
          eligible: normalized[idx]?.eligible?.length ? normalized[idx].eligible : eligible,
        };
        totalPot = normalized.reduce((sum, pot) => sum + pot.amount, 0);
      }
    }
  }

  return {
    pots: normalized,
    totalPot,
    contributions,
  };
}
