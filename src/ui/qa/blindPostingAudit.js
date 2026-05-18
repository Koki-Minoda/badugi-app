import { getBlindSeatIndexes, getPositionNameForSeat } from "../utils/positionLabels.js";

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readDisplayedBetBySeat() {
  if (typeof document === "undefined") return {};
  const displayed = {};
  document.querySelectorAll("[data-seat-bet-amount]").forEach((element) => {
    const seat = element.getAttribute("data-seat-bet-amount");
    if (seat == null) return;
    const amount = Number(String(element.textContent ?? "").replace(/,/g, "").trim());
    displayed[seat] = Number.isFinite(amount) ? amount : null;
  });
  return displayed;
}

function streetContribution(player = {}) {
  return Math.max(
    0,
    Number(player.betThisStreet ?? 0) || 0,
    Number(player.committedThisStreet ?? 0) || 0,
    Number(player.betThisRound ?? 0) || 0,
    Number(player.bet ?? 0) || 0,
  );
}

function totalInvested(player = {}) {
  return Math.max(
    0,
    Number(player.totalInvested ?? 0) || 0,
    streetContribution(player),
  );
}

function resolveButtonSeat(snapshot = {}, fallback = null) {
  return numberOrNull(
    snapshot.buttonSeat ??
      snapshot.dealerSeat ??
      snapshot.dealerIdx ??
      snapshot.dealerIndex ??
      snapshot.metadata?.buttonSeat ??
      snapshot.metadata?.dealerSeat ??
      snapshot.metadata?.dealerIndex,
  ) ?? fallback;
}

function resolveBlindSeat(snapshot = {}, key, players = [], buttonSeat = 0) {
  const metadata = snapshot.metadata ?? {};
  const lastBlinds = metadata.lastBlinds ?? {};
  const direct =
    key === "sb"
      ? snapshot.smallBlindSeat ?? snapshot.sbSeat ?? snapshot.smallBlindIndex ?? lastBlinds.sbIndex
      : snapshot.bigBlindSeat ?? snapshot.bbSeat ?? snapshot.bigBlindIndex ?? lastBlinds.bbIndex;
  const directNumber = numberOrNull(direct);
  if (directNumber !== null) return directNumber;
  const blindSeats = getBlindSeatIndexes(players, buttonSeat ?? 0);
  return key === "sb" ? blindSeats.sbIdx : blindSeats.bbIdx;
}

function resolveBlindAmount(snapshot = {}, key, fallback) {
  const metadata = snapshot.metadata ?? {};
  const blindValues = metadata.blindValues ?? snapshot.blindValues ?? {};
  const value =
    key === "sb"
      ? snapshot.smallBlind ?? snapshot.sb ?? blindValues.sb ?? blindValues.smallBlind
      : snapshot.bigBlind ?? snapshot.bb ?? blindValues.bb ?? blindValues.bigBlind;
  return numberOrNull(value) ?? fallback;
}

export function buildBlindPostingAudit({
  snapshot = {},
  players = [],
  heroSeat = 0,
  displayedBetBySeat = null,
  displayedPot = null,
} = {}) {
  const normalizedPlayers = Array.isArray(players) ? players : [];
  const buttonSeat = resolveButtonSeat(snapshot, 0);
  const sbSeat = resolveBlindSeat(snapshot, "sb", normalizedPlayers, buttonSeat);
  const bbSeat = resolveBlindSeat(snapshot, "bb", normalizedPlayers, buttonSeat);
  const smallBlind = resolveBlindAmount(snapshot, "sb", 10);
  const bigBlind = resolveBlindAmount(snapshot, "bb", 20);
  const ante = numberOrNull(snapshot.ante ?? snapshot.metadata?.ante ?? snapshot.blindValues?.ante) ?? 0;
  const currentBet =
    numberOrNull(snapshot.currentBet ?? snapshot.metadata?.currentBet) ??
    Math.max(0, ...normalizedPlayers.map(streetContribution));
  const actualInvestedBySeat = {};
  const streetBetBySeat = {};
  const stackBySeat = {};
  const toCallBySeat = {};
  normalizedPlayers.forEach((player, seat) => {
    const streetBet = streetContribution(player);
    streetBetBySeat[seat] = streetBet;
    actualInvestedBySeat[seat] = totalInvested(player);
    stackBySeat[seat] = numberOrNull(player?.stack) ?? 0;
    toCallBySeat[seat] = Math.max(0, currentBet - streetBet);
  });
  const pot =
    numberOrNull(snapshot.pot ?? snapshot.metadata?.potAmount) ??
    (Array.isArray(snapshot.pots)
      ? snapshot.pots.reduce((sum, potEntry) => sum + (Number(potEntry?.amount ?? potEntry?.potAmount) || 0), 0)
      : 0);
  const streetCommitted = Object.values(streetBetBySeat).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const heroPositionLabel =
    typeof heroSeat === "number"
      ? getPositionNameForSeat(heroSeat, buttonSeat ?? 0, normalizedPlayers)
      : null;
  return {
    buttonSeat,
    sbSeat,
    bbSeat,
    heroSeat,
    heroPositionLabel,
    smallBlind,
    bigBlind,
    ante,
    expectedBlindPosts: [
      { seat: sbSeat, type: "SB", amount: smallBlind },
      { seat: bbSeat, type: "BB", amount: bigBlind },
    ].filter((entry) => typeof entry.seat === "number"),
    actualInvestedBySeat,
    streetBetBySeat,
    displayedBetBySeat: displayedBetBySeat ?? readDisplayedBetBySeat(),
    stackBySeat,
    pot: pot > 0 ? pot : streetCommitted,
    displayedPot,
    toCallBySeat,
    heroToCall: typeof heroSeat === "number" ? toCallBySeat[heroSeat] ?? null : null,
  };
}

export default buildBlindPostingAudit;
