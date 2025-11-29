// src/ui/game/nlh/NLHUIAdapter.js

import { BaseGameUIAdapter } from "../GameUIAdapter.js";

function sumTotalInvested(players = []) {
  return players.reduce(
    (sum, player) => sum + (player?.totalInvested ?? player?.betThisStreet ?? 0),
    0,
  );
}

function shouldRevealCards(player, snapshot) {
  if (player.seatIndex === 0) return true;
  return (snapshot.street ?? "").toUpperCase() === "SHOWDOWN";
}

function mapSeatViews(snapshot = {}, tableConfig = {}) {
  const players = snapshot.players ?? [];
  const dealerIdx = snapshot.dealerIndex ?? 0;
  const sbIdx = snapshot.smallBlindIndex ?? null;
  const bbIdx = snapshot.bigBlindIndex ?? null;
  return players.map((player = {}, idx) => {
    const revealCards = shouldRevealCards({ ...player, seatIndex: idx }, snapshot);
    const holeCards = Array.isArray(player.holeCards) ? [...player.holeCards] : [];
    const obfuscated =
      revealCards || holeCards.length === 0 ? holeCards : new Array(holeCards.length).fill("?");
    return {
      seatIndex: idx,
      name: player.name ?? `Seat ${idx + 1}`,
      stack: player.stack ?? 0,
      betThisRound: player.betThisStreet ?? 0,
      totalInvested: player.totalInvested ?? 0,
      isHero: idx === 0,
      isDealer: idx === dealerIdx,
      isSB: sbIdx === idx,
      isBB: bbIdx === idx,
      hasFolded: Boolean(player.folded),
      isAllIn: Boolean(player.allIn),
      seatOut: Boolean(player.seatOut),
      cards: obfuscated,
      lastAction: player.lastAction ?? "",
    };
  });
}

function buildControlsConfig(snapshot = {}, tableConfig = {}) {
  const players = snapshot.players ?? [];
  const hero = players[0] ?? null;
  const heroBet = hero?.betThisStreet ?? 0;
  const currentBet = snapshot.currentBet ?? heroBet ?? 0;
  const toCall = Math.max(0, currentBet - heroBet);
  const heroStack = hero?.stack ?? 0;
  const isHeroTurn =
    hero &&
    hero.seatOut !== true &&
    hero.folded !== true &&
    (snapshot.currentActor ?? null) === 0 &&
    !hero.allIn;
  const hasChips = heroStack > 0;
  const blinds = tableConfig.blinds ?? {};
  const minBet = blinds.bb ?? currentBet ?? 0;
  const canCheck = Boolean(isHeroTurn && toCall === 0);
  const canCall = Boolean(isHeroTurn && toCall > 0 && hasChips);
  const canBet = Boolean(isHeroTurn && toCall === 0 && hasChips);
  const canRaise = Boolean(isHeroTurn && toCall > 0 && heroStack > toCall);
  const canFold = Boolean(isHeroTurn && (toCall > 0 || hero?.canFoldByChoice));
  const canAllIn = Boolean(isHeroTurn && hasChips);
  return {
    phase: "BET",
    street: snapshot.street ?? "PREFLOP",
    isHeroTurn,
    currentBet,
    heroBet,
    amountToCall: toCall,
    canFold,
    canCheck,
    canCall,
    canBet,
    canRaise,
    canAllIn,
    minBet,
    minRaise: toCall > 0 ? currentBet + minBet : minBet,
  };
}

function buildHudInfo(snapshot = {}, tableConfig = {}, potTotal = 0) {
  const street = snapshot.street ?? "PREFLOP";
  const blinds = tableConfig.blinds ?? {};
  return {
    streetId: street,
    streetLabel: formatStreetLabelValue(street),
    boardCards: Array.isArray(snapshot.boardCards) ? [...snapshot.boardCards] : [],
    totalPot: potTotal,
    blinds: {
      sb: blinds.sb ?? 0,
      bb: blinds.bb ?? 0,
      ante: blinds.ante ?? 0,
    },
  };
}

function formatStreetLabelValue(streetId = "") {
  switch ((streetId || "").toUpperCase()) {
    case "PREFLOP":
      return "Preflop";
    case "FLOP":
      return "Flop";
    case "TURN":
      return "Turn";
    case "RIVER":
      return "River";
    case "SHOWDOWN":
      return "Showdown";
    default:
      return streetId || "";
  }
}

function buildPotView(snapshot, players) {
  const total =
    snapshot.pot ??
    snapshot.totalPot ??
    sumTotalInvested(players);
  return {
    total,
    pots: [{ index: 0, amount: total, eligible: [] }],
  };
}

function formatHandLabelValue(evaluation = {}) {
  if (!evaluation || typeof evaluation !== "object") return "";
  const category = evaluation.category ?? "";
  const ranks = Array.isArray(evaluation.primaryRanks) ? evaluation.primaryRanks.join("-") : "";
  return ranks ? `${category} (${ranks})` : category;
}

export class NLHUIAdapter extends BaseGameUIAdapter {
  createInitialViewState({ controllerSnapshot = {}, tableConfig = {} } = {}) {
    return {
      controllerSnapshot,
      tableConfig,
    };
  }

  buildViewProps({ controllerSnapshot = {}, tableConfig = {} } = {}) {
    const seatViews = mapSeatViews(controllerSnapshot, tableConfig);
    const potView = buildPotView(controllerSnapshot, controllerSnapshot.players);
    const controlsConfig = buildControlsConfig(controllerSnapshot, tableConfig);
    const hudInfo = buildHudInfo(controllerSnapshot, tableConfig, potView.total);
    return {
      tablePhase: controllerSnapshot.street ?? "PREFLOP",
      seatViews,
      potView,
      controlsConfig,
      hudInfo,
    };
  }

  formatStreetLabel(streetId) {
    return formatStreetLabelValue(streetId);
  }

  formatHandLabel(evaluation) {
    return formatHandLabelValue(evaluation);
  }

  getAvailableActions({ controllerSnapshot = {}, seatIndex = 0 } = {}) {
    const cfg = buildControlsConfig(controllerSnapshot, {});
    if (seatIndex !== 0 || !cfg.isHeroTurn) {
      return [];
    }
    const actions = [];
    if (cfg.canFold) actions.push("fold");
    if (cfg.amountToCall > 0) {
      if (cfg.canCall) actions.push("call");
      if (cfg.canRaise) actions.push("raise");
    } else {
      if (cfg.canCheck) actions.push("check");
      if (cfg.canBet) actions.push("bet");
    }
    if (cfg.canAllIn) actions.push("all-in");
    return actions;
  }
}

export default NLHUIAdapter;
