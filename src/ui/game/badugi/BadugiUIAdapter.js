// src/ui/game/badugi/BadugiUIAdapter.js

import { BaseGameUIAdapter } from "../GameUIAdapter.js";
import {
  formatBadugiHandLabel,
  formatBadugiRanksLabel,
} from "../../../games/badugi/flow/handResultUtils.js";
import {
  getFixedLimitBetSize,
  isBigBetStreet,
} from "../../../games/badugi/logic/bettingRules.js";

function sumPotAmounts(pots = [], fallbackPlayers = []) {
  if (Array.isArray(pots) && pots.length) {
    return pots.reduce((acc, pot) => acc + (pot?.amount ?? pot?.potAmount ?? 0), 0);
  }
  if (Array.isArray(fallbackPlayers)) {
    return fallbackPlayers.reduce((acc, player) => acc + (player?.betThisRound ?? 0), 0);
  }
  return 0;
}

function positionName(index, dealerIdx = 0, seatCount = 6) {
  const order = ["BTN", "SB", "BB", "UTG", "MP", "CO"];
  const rel = ((index - dealerIdx) % seatCount + seatCount) % seatCount;
  return order[rel] ?? `Seat ${index + 1}`;
}

function defaultStructureMeta(tableConfig = {}) {
  return {
    levelNumber: tableConfig.levelNumber ?? 1,
    sbValue: tableConfig.sbValue ?? 0,
    bbValue: tableConfig.bbValue ?? 0,
    anteValue: tableConfig.anteValue ?? 0,
    handCount: tableConfig.handCount ?? 1,
    handsCap: tableConfig.handsCap ?? "INF",
    startingStack: tableConfig.startingStack ?? 0,
    maxDraws: tableConfig.maxDraws ?? 3,
  };
}

function buildControlsConfig(snapshot, tableConfig) {
  const players = snapshot.players ?? [];
  const hero = players[0] ?? null;
  const phase = snapshot.phase ?? "BET";
  const heroTurn = hero && snapshot.turn === 0 && !hero.folded && !hero.seatOut;
  const heroBet = hero?.betThisRound ?? 0;
  const currentBet = snapshot.currentBet ?? 0;
  const needsToCall = hero ? currentBet > heroBet : false;
  const heroStack = hero?.stack ?? 0;
  const hasCardsToDraw = Boolean(hero?.hand && hero.hand.length && (hero.selected ?? []).length);

  const canFold = Boolean(heroTurn && phase === "BET" && !hero?.allIn);
  const canCall = Boolean(heroTurn && phase === "BET" && heroStack > 0);
  const canCheck = Boolean(heroTurn && phase === "BET" && !needsToCall);
  const canRaise = Boolean(heroTurn && phase === "BET" && heroStack > 0 && !hero?.allIn);
  const canDraw = Boolean(
    heroTurn &&
      phase === "DRAW" &&
      !hero?.folded &&
      !hero?.seatOut &&
      hasCardsToDraw,
  );
  const drawRound = snapshot.drawRound ?? 0;
  const betRound = snapshot.betRoundIndex ?? 0;
  const baseBet = tableConfig.bbValue ?? 0;
  const betSize = getFixedLimitBetSize({
    baseBet,
    drawRound,
    betRound,
  });
  const bigBetStreet = isBigBetStreet({ drawRound, betRound });

  return {
    phase,
    heroTurn: Boolean(heroTurn),
    heroStack,
    heroBet,
    currentBet,
    needsToCall,
    canFold,
    canCall,
    canCheck,
    canRaise,
    canDraw,
    drawSelections: hero?.selected ?? [],
    maxDraws: tableConfig.maxDraws ?? 3,
    betSize,
    isBigBetStreet: bigBetStreet,
  };
}

function mapSeatViews(snapshot, structureMeta) {
  const players = snapshot.players ?? [];
  const dealerIdx = snapshot.dealerIdx ?? 0;
  const seatCount = players.length || 6;
  const sbIdx = seatCount > 0 ? (dealerIdx + 1) % seatCount : 0;
  const bbIdx = seatCount > 0 ? (dealerIdx + 2) % seatCount : 0;

  return players.map((player, idx) => {
    const sanitizedPlayer = player ? { ...player } : {};
    return {
      ...sanitizedPlayer,
      seatIndex: idx,
      label: positionName(idx, dealerIdx, seatCount),
      isDealer: idx === dealerIdx,
      isSB: idx === sbIdx,
      isBB: idx === bbIdx,
      isHero: idx === 0,
      isTurn: idx === snapshot.turn,
      stack: sanitizedPlayer.stack ?? 0,
      betThisRound: sanitizedPlayer.betThisRound ?? 0,
      totalInvested: sanitizedPlayer.totalInvested ?? 0,
      folded: Boolean(sanitizedPlayer.folded || sanitizedPlayer.hasFolded),
      hasFolded: Boolean(sanitizedPlayer.folded || sanitizedPlayer.hasFolded),
      allIn: Boolean(sanitizedPlayer.allIn),
      seatOut: Boolean(sanitizedPlayer.seatOut),
      isBusted: Boolean(sanitizedPlayer.isBusted),
      lastAction: sanitizedPlayer.lastAction ?? "",
      hand: Array.isArray(sanitizedPlayer.hand) ? [...sanitizedPlayer.hand] : [],
      showHand: sanitizedPlayer.showHand ?? idx === 0,
      selected: Array.isArray(sanitizedPlayer.selected) ? [...sanitizedPlayer.selected] : [],
      hasDrawn: Boolean(sanitizedPlayer.hasDrawn),
      hasActedThisRound: Boolean(sanitizedPlayer.hasActedThisRound),
      titleBadge: sanitizedPlayer.titleBadge ?? "",
      avatar: sanitizedPlayer.avatar ?? "default_avatar",
      structureMeta,
    };
  });
}

function buildHudInfo(snapshot, tableConfig, totalPot) {
  const meta = defaultStructureMeta(tableConfig);
  return {
    ...meta,
    totalPot,
    phase: snapshot.phase ?? "BET",
    phaseTag: snapshot.phaseTag ?? snapshot.phase ?? "BET",
    drawRound: snapshot.drawRound ?? 0,
    betRoundIndex: snapshot.betRoundIndex ?? 0,
    dealerName: snapshot.players?.[snapshot.dealerIdx ?? 0]?.name ?? "-",
  };
}

export class BadugiUIAdapter extends BaseGameUIAdapter {
  constructor({ gameDefinition } = {}) {
    super();
    this.gameDefinition = gameDefinition ?? null;
  }

  createInitialViewState({ controllerSnapshot = {}, tableConfig = {} } = {}) {
    return {
      controllerSnapshot,
      tableConfig,
    };
  }

  buildViewProps({ controllerSnapshot = {}, tableConfig = {} } = {}) {
    const phase = controllerSnapshot.phase ?? "BET";
    const structureMeta = defaultStructureMeta(tableConfig);
    const seatViews = mapSeatViews(controllerSnapshot, structureMeta);
    const totalPot = sumPotAmounts(controllerSnapshot.pots, controllerSnapshot.players);

    const potView = {
      total: totalPot,
      pots: (controllerSnapshot.pots ?? []).map((pot, index) => ({
        index: pot?.potIndex ?? index,
        amount: pot?.amount ?? pot?.potAmount ?? 0,
        eligible: pot?.eligible ? [...pot.eligible] : [],
      })),
    };

    const controlsConfig = buildControlsConfig(controllerSnapshot, structureMeta);
    const hudInfo = buildHudInfo(controllerSnapshot, structureMeta, totalPot);

    return {
      tablePhase: phase,
      seatViews,
      potView,
      controlsConfig,
      hudInfo,
    };
  }

  formatStreetLabel(streetId) {
    if (!streetId) return "";
    const normalized = streetId.toUpperCase();
    if (normalized.startsWith("BET")) {
      return "Betting";
    }
    if (normalized.startsWith("DRAW")) {
      return "Draw";
    }
    if (normalized === "SHOWDOWN") {
      return "Showdown";
    }
    return streetId;
  }

  formatHandLabel(evaluation) {
    return formatBadugiHandLabel(evaluation);
  }

  formatHandRanks(evaluation) {
    return formatBadugiRanksLabel(evaluation);
  }

  getAvailableActions({ controllerSnapshot = {}, seatIndex = 0 } = {}) {
    if (seatIndex !== 0) return [];
    const controls = buildControlsConfig(controllerSnapshot, {});
    const actions = [];
    if (controls.canFold) actions.push("fold");
    if (controls.needsToCall && controls.canCall) {
      actions.push("call");
    } else if (controls.canCheck) {
      actions.push("check");
    }
    if (controls.canRaise) actions.push("raise");
    if (controls.canDraw) actions.push("draw");
    return actions;
  }
}

export default BadugiUIAdapter;
