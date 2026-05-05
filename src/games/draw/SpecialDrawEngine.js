import { evaluateBadugiHand } from "../evaluators/badugi.js";
import { evaluateHighHand } from "../evaluators/high.js";
import { evaluateLowHand, formatLowHandLabel } from "../evaluators/low.js";
import { compareEvaluations } from "../evaluators/registry.js";
import { DeuceToSevenTripleDrawEngine } from "./DeuceToSevenTripleDrawEngine.js";

function splitAmountBySeatOrder(amount, winners = []) {
  const normalized = [...winners].sort((a, b) => a.seatIndex - b.seatIndex);
  const base = Math.floor(amount / Math.max(1, normalized.length));
  let remainder = amount % Math.max(1, normalized.length);
  return normalized.map((winner) => {
    const payout = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return { ...winner, payout };
  });
}

function splitHalfAmounts(amount) {
  const normalized = Math.max(0, Number(amount) || 0);
  return [Math.ceil(normalized / 2), Math.floor(normalized / 2)];
}

const COMPONENT_LABELS = {
  badugi: "Badugi half",
  low27: "2-7 Low half",
  lowA5: "A-5 Low half",
  archieHigh: "High half",
  archieLow: "A-5 Low half",
};

function getComponentLabel(component) {
  return COMPONENT_LABELS[component] ?? component;
}

function getComponentAmountDetails(amount, components = []) {
  const componentAmounts = splitHalfAmounts(amount);
  return components.map((component, componentIndex) => ({
    component,
    componentLabel: getComponentLabel(component),
    amount: componentAmounts[componentIndex] ?? 0,
    oddChipAmount: amount % 2 === 1 && componentIndex === 0 ? 1 : 0,
  }));
}

function getActiveCardsFromBadugi(cards = []) {
  const evaluation = evaluateBadugiHand({ cards });
  return new Set(evaluation.metadata?.cards ?? []);
}

function chooseBadugiDiscardIndexes(cards = []) {
  const keep = getActiveCardsFromBadugi(cards);
  const discard = cards
    .map((card, idx) => ({ card, idx }))
    .filter(({ card }) => !keep.has(card))
    .map(({ idx }) => idx);
  if (discard.length) return discard;
  const evaluation = evaluateBadugiHand({ cards });
  const ranks = evaluation.metadata?.ranks ?? [];
  const roughFourCard = (evaluation.metadata?.size ?? 0) === 4 && Math.max(...ranks, 0) >= 11;
  return roughFourCard ? [cards.length - 1].filter((idx) => idx >= 0) : [];
}

function choosePairOrLowDiscardIndexes(cards = [], lowType = "27") {
  const badugiDiscard = chooseBadugiDiscardIndexes(cards);
  if (badugiDiscard.length) return badugiDiscard;
  const low = evaluateLowHand({ cards, lowType });
  const ranks = low.metadata?.ranks ?? [];
  const highest = ranks.length ? Math.max(...ranks) : 14;
  if (highest <= 8 && low.rankPrimary !== Number.POSITIVE_INFINITY) return [];
  return cards.length ? [cards.length - 1] : [];
}

function normalizePotEligibleSeats(pot, players = []) {
  if (Array.isArray(pot?.eligible)) return pot.eligible.filter((seat) => typeof seat === "number");
  if (Array.isArray(pot?.eligibleSeats)) return pot.eligibleSeats.filter((seat) => typeof seat === "number");
  if (Array.isArray(pot?.eligiblePlayerIds)) {
    return pot.eligiblePlayerIds
      .map((id) => players.findIndex((player) => player?.playerId === id || player?.id === id))
      .filter((idx) => idx >= 0);
  }
  return players
    .map((player, seatIndex) => ({ player, seatIndex }))
    .filter(({ player }) => player && !player.folded && !player.sittingOut)
    .map(({ seatIndex }) => seatIndex);
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function settleCurrentBets(state) {
  const committed = state.players.reduce((sum, player) => sum + Math.max(0, player.bet ?? 0), 0);
  const players = state.players.map((player) => ({
    ...player,
    bet: 0,
    hasActedThisRound: false,
  }));
  const pots = Array.isArray(state.pots) ? state.pots.map((pot) => ({ ...pot })) : [];
  if (committed > 0) {
    if (pots.length) {
      pots[0] = { ...pots[0], amount: Math.max(0, pots[0].amount ?? 0) + committed };
    } else {
      pots.push({
        amount: committed,
        eligiblePlayerIds: players
          .filter((player) => !player.folded && !player.sittingOut)
          .map((player) => player.playerId ?? player.id),
      });
    }
  }
  return { players, pots };
}

function labelForEvaluation(evaluation) {
  if (!evaluation) return "Invalid";
  if (evaluation.handName) return evaluation.handName;
  return evaluation.metadata?.ranks?.join("-") ?? "Hand";
}

function isQualifiedComponentEvaluation(evaluation) {
  if (!evaluation) return false;
  if (evaluation.qualifies === false || evaluation.metadata?.qualifies === false) return false;
  if (evaluation.rankPrimary === Number.POSITIVE_INFINITY) return false;
  if (evaluation.rankSecondary === Number.POSITIVE_INFINITY) return false;
  return true;
}

const VARIANT_CONFIGS = {
  badeucey_triple_draw: {
    gameId: "badeucey_triple_draw",
    displayName: "Badeucey TD",
    variantId: "D04",
    evaluatorTag: "split-badugi-27",
    maxDrawRounds: 3,
    handCardCount: 5,
    split: { lowType: "27", components: ["badugi", "low27"] },
  },
  badacey_triple_draw: {
    gameId: "badacey_triple_draw",
    displayName: "Badacey TD",
    variantId: "D05",
    evaluatorTag: "split-badugi-a5",
    maxDrawRounds: 3,
    handCardCount: 5,
    split: { lowType: "A5", components: ["badugi", "lowA5"] },
  },
  hidugi_triple_draw: {
    gameId: "hidugi_triple_draw",
    displayName: "Hidugi TD",
    variantId: "D06",
    evaluatorTag: "badugi-high",
    maxDrawRounds: 3,
    handCardCount: 4,
    mode: "badugiHigh",
  },
  archie_triple_draw: {
    gameId: "archie_triple_draw",
    displayName: "Archie TD",
    variantId: "D07",
    evaluatorTag: "archie",
    maxDrawRounds: 3,
    handCardCount: 5,
    split: { lowType: "A5", components: ["archieHigh", "archieLow"] },
  },
  badugi_single_draw: {
    gameId: "badugi_single_draw",
    displayName: "Badugi SD",
    variantId: "S04",
    evaluatorTag: "badugi-low",
    maxDrawRounds: 1,
    handCardCount: 4,
    mode: "badugiLow",
  },
  badeucey_single_draw: {
    gameId: "badeucey_single_draw",
    displayName: "Badeucey SD",
    variantId: "S05",
    evaluatorTag: "split-badugi-27",
    maxDrawRounds: 1,
    handCardCount: 5,
    split: { lowType: "27", components: ["badugi", "low27"] },
  },
  badacey_single_draw: {
    gameId: "badacey_single_draw",
    displayName: "Badacey SD",
    variantId: "S06",
    evaluatorTag: "split-badugi-a5",
    maxDrawRounds: 1,
    handCardCount: 5,
    split: { lowType: "A5", components: ["badugi", "lowA5"] },
  },
  hidugi_single_draw: {
    gameId: "hidugi_single_draw",
    displayName: "Hidugi SD",
    variantId: "S07",
    evaluatorTag: "badugi-high",
    maxDrawRounds: 1,
    handCardCount: 4,
    mode: "badugiHigh",
  },
};

export class SpecialDrawEngine extends DeuceToSevenTripleDrawEngine {
  constructor(configKey, { deckManager = null } = {}) {
    const config = VARIANT_CONFIGS[configKey];
    if (!config) throw new Error(`Unknown special draw config: ${configKey}`);
    super({
      deckManager,
      gameId: config.gameId,
      displayName: config.displayName,
      variantId: config.variantId,
      evaluatorTag: config.evaluatorTag,
      lowType: config.split?.lowType ?? "27",
      cpuStrategy: `ruleBased${config.variantId}`,
      maxDrawRounds: config.maxDrawRounds,
      bigBetStartsAtDrawRound: config.maxDrawRounds === 1 ? 1 : 2,
      handCardCount: config.handCardCount,
    });
    this.specialConfig = config;
  }

  evaluateComponent(cards = [], component) {
    if (component === "badugi") return evaluateBadugiHand({ cards, mode: "low" });
    if (component === "low27") {
      const evaluation = evaluateLowHand({ cards, lowType: "27" });
      return { ...evaluation, handName: formatLowHandLabel(evaluation, { lowType: "27" }) };
    }
    if (component === "lowA5") {
      const evaluation = evaluateLowHand({ cards, lowType: "A5" });
      return { ...evaluation, handName: formatLowHandLabel(evaluation, { lowType: "A5" }) };
    }
    if (component === "archieHigh") {
      const evaluation = evaluateHighHand({ cards });
      const qualifies = [
        "one-pair",
        "two-pair",
        "three-of-a-kind",
        "straight",
        "flush",
        "full-house",
        "four-of-a-kind",
        "straight-flush",
      ].includes(evaluation.metadata?.category);
      return { ...evaluation, qualifies, rankPrimary: qualifies ? evaluation.rankPrimary : Number.POSITIVE_INFINITY };
    }
    if (component === "archieLow") {
      const evaluation = evaluateLowHand({ cards, lowType: "A5", requireQualifier: 8 });
      return { ...evaluation, handName: formatLowHandLabel(evaluation, { lowType: "A5" }) };
    }
    throw new Error(`Unknown special draw component: ${component}`);
  }

  evaluateShowdownHand(cards = []) {
    if (this.specialConfig.mode === "badugiHigh") {
      return evaluateBadugiHand({ cards, mode: "high" });
    }
    if (this.specialConfig.mode === "badugiLow") {
      return evaluateBadugiHand({ cards, mode: "low" });
    }
    const components = this.specialConfig.split?.components ?? [];
    const evaluations = Object.fromEntries(
      components.map((component) => [component, this.evaluateComponent(cards, component)]),
    );
    const labels = components.map((component) => labelForEvaluation(evaluations[component]));
    return {
      rankPrimary: evaluations[components[0]]?.rankPrimary ?? Number.POSITIVE_INFINITY,
      rankSecondary: evaluations[components[1]]?.rankPrimary ?? Number.POSITIVE_INFINITY,
      handName: labels.join(" / "),
      isValid: Object.values(evaluations).some((evaluation) => evaluation?.isValid),
      metadata: { components: evaluations, splitMode: "component" },
    };
  }

  chooseCpuAction(state, seatIndex = state?.actingPlayerIndex) {
    const player = state?.players?.[seatIndex];
    if (!state || typeof seatIndex !== "number" || !player || player.folded || player.sittingOut) return null;
    if (state.actingPlayerIndex !== null && state.actingPlayerIndex !== seatIndex) return null;
    const discardIndexes = this.specialConfig.handCardCount === 5
      ? choosePairOrLowDiscardIndexes(player.hand ?? [], this.specialConfig.split?.lowType ?? "27")
      : chooseBadugiDiscardIndexes(player.hand ?? []);
    if (state.street === "DRAW") {
      return {
        seatIndex,
        type: "DRAW",
        discardIndexes,
        metadata: { strategy: this.cpuStrategy, drawCount: discardIndexes.length },
      };
    }
    if (state.street !== "BET") return null;
    const currentBet = Number(state.metadata?.currentBet ?? state.currentBet ?? 0) || 0;
    const playerBet = Number(player.bet ?? 0) || 0;
    const facingBet = currentBet > playerBet;
    const strong = discardIndexes.length <= 1;
    const lateWeak = discardIndexes.length >= 3 && (state.drawRoundIndex ?? 0) >= Math.max(1, this.maxDrawRounds - 1);
    if (facingBet) return { seatIndex, type: lateWeak ? "FOLD" : "CALL", metadata: { strategy: this.cpuStrategy } };
    return { seatIndex, type: strong ? "BET" : "CHECK", metadata: { strategy: this.cpuStrategy } };
  }

  resolveShowdown(state, { cloneState: shouldClone = true } = {}) {
    if (!this.specialConfig.split) {
      return super.resolveShowdown(state, { cloneState: shouldClone });
    }
    const working = shouldClone ? cloneState(state) : state;
    if ((working.players ?? []).some((player) => (player.bet ?? 0) > 0)) {
      const settled = settleCurrentBets(working);
      working.players = settled.players;
      working.pots = settled.pots;
    }
    if (!working.pots?.length) {
      const committed = working.players.reduce((sum, player) => sum + Math.max(0, player.totalInvested ?? 0), 0);
      if (committed > 0) {
        working.pots = [{
          amount: committed,
          eligiblePlayerIds: working.players
            .filter((player) => !player.folded && !player.sittingOut)
            .map((player) => player.playerId ?? player.id),
        }];
      }
    }

    const components = this.specialConfig.split.components;
    const evaluations = working.players.map((player, seatIndex) => {
      if (!player || player.folded || player.sittingOut) return null;
      return {
        seatIndex,
        name: player.name,
        hand: Array.isArray(player.hand) ? [...player.hand] : [],
        evaluation: this.evaluateShowdownHand(player.hand ?? []),
        components: Object.fromEntries(
          components.map((component) => [component, this.evaluateComponent(player.hand ?? [], component)]),
        ),
      };
    });

    const summary = [];
    let totalPot = 0;
    (working.pots ?? []).forEach((pot, potIndex) => {
      const potAmount = Math.max(0, pot.amount ?? 0);
      totalPot += potAmount;
      const componentAmountDetails = getComponentAmountDetails(potAmount, components);
      const eligibleSeats = normalizePotEligibleSeats(pot, working.players).filter((seatIndex) => {
        const player = working.players[seatIndex];
        return player && !player.folded && !player.sittingOut;
      });
      const contendersByComponent = Object.fromEntries(
        components.map((component) => [
          component,
          eligibleSeats
            .map((seatIndex) => evaluations[seatIndex])
            .filter((entry) => isQualifiedComponentEvaluation(entry?.components?.[component])),
        ]),
      );
      const awardedAmounts = Object.fromEntries(
        componentAmountDetails.map((detail) => [detail.component, detail.amount]),
      );
      const oddChipByComponent = Object.fromEntries(
        componentAmountDetails.map((detail) => [detail.component, detail.oddChipAmount]),
      );
      const qualifyingComponents = components.filter((component) => contendersByComponent[component]?.length);

      if (qualifyingComponents.length) {
        components.forEach((component) => {
          if (contendersByComponent[component]?.length) return;
          const amount = awardedAmounts[component] ?? 0;
          awardedAmounts[component] = 0;
          awardedAmounts[qualifyingComponents[0]] += amount;
        });
      } else if (components.length) {
        // Archie can have no pair-or-better high and no 8-or-better low.
        // In that rare case, keep accounting stable by awarding the whole pot
        // through the primary component using all live eligible seats.
        const fallbackComponent = components[0];
        contendersByComponent[fallbackComponent] = eligibleSeats
          .map((seatIndex) => evaluations[seatIndex])
          .filter(Boolean);
        components.forEach((component) => {
          awardedAmounts[component] = component === fallbackComponent ? potAmount : 0;
        });
      }

      components.forEach((component) => {
        const amount = awardedAmounts[component] ?? 0;
        const contenders = contendersByComponent[component] ?? [];
        const componentLabel = getComponentLabel(component);
        const oddChipAmount = oddChipByComponent[component] ?? 0;
        const baseSummary = {
          potIndex,
          sourcePotIndex: pot.potIndex ?? potIndex,
          component,
          componentLabel,
          label: componentLabel,
          oddChipAmount,
          oddChip: oddChipAmount > 0 ? { amount: oddChipAmount, component, componentLabel } : null,
          eligibleSeatIndexes: [...eligibleSeats],
        };
        if (!amount) {
          summary.push({ ...baseSummary, potAmount: 0, payouts: [], evaluations: contenders });
          return;
        }
        if (!contenders.length) {
          summary.push({ ...baseSummary, potAmount: amount, payouts: [], evaluations: contenders });
          return;
        }
        const best = contenders.reduce((currentBest, entry) => {
          if (!currentBest) return entry.components?.[component] ?? entry.evaluation;
          const nextEvaluation = entry.components?.[component] ?? entry.evaluation;
          return compareEvaluations(nextEvaluation, currentBest) < 0
            ? nextEvaluation
            : currentBest;
        }, null);
        const winners = contenders.filter((entry) => {
          const evaluation = entry.components?.[component] ?? entry.evaluation;
          return compareEvaluations(evaluation, best) === 0;
        });
        const payouts = splitAmountBySeatOrder(amount, winners).map((winner) => {
          const evaluation = winner.components?.[component] ?? winner.evaluation;
          const player = working.players[winner.seatIndex];
          const stackBefore = player.stack ?? 0;
          player.stack = stackBefore + winner.payout;
          player.lastAction = `Collect ${winner.payout}`;
          return {
            seatIndex: winner.seatIndex,
            name: player.name,
            payout: winner.payout,
            stackBefore,
            stackAfter: player.stack,
            handName: evaluation?.handName,
            handLabel: evaluation?.handName,
            ranksLabel: evaluation?.metadata?.ranks?.join("-") ?? "",
            hand: Array.isArray(player.hand) ? [...player.hand] : [],
            evaluation,
            component,
            componentLabel,
          };
        });
        summary.push({ ...baseSummary, potAmount: amount, payouts, evaluations: contenders });
      });
    });

    working.street = "SHOWDOWN";
    working.isHandOver = true;
    working.actingPlayerIndex = null;
    working.pots = [];
    working.players = working.players.map((player) => ({
      ...player,
      bet: 0,
      hasActedThisRound: false,
      canDraw: false,
    }));
    working.metadata = {
      ...(working.metadata ?? {}),
      currentBet: 0,
      potAmount: 0,
      showdownSummary: summary,
      showdownTotal: totalPot,
      evaluations,
      splitMode: "component",
    };
    return { state: working, summary, totalPot };
  }
}

export class BadeuceyTripleDrawEngine extends SpecialDrawEngine {
  constructor(options = {}) { super("badeucey_triple_draw", options); }
}
export class BadaceyTripleDrawEngine extends SpecialDrawEngine {
  constructor(options = {}) { super("badacey_triple_draw", options); }
}
export class HidugiTripleDrawEngine extends SpecialDrawEngine {
  constructor(options = {}) { super("hidugi_triple_draw", options); }
}
export class ArchieTripleDrawEngine extends SpecialDrawEngine {
  constructor(options = {}) { super("archie_triple_draw", options); }
}
export class BadugiSingleDrawEngine extends SpecialDrawEngine {
  constructor(options = {}) { super("badugi_single_draw", options); }
}
export class BadeuceySingleDrawEngine extends SpecialDrawEngine {
  constructor(options = {}) { super("badeucey_single_draw", options); }
}
export class BadaceySingleDrawEngine extends SpecialDrawEngine {
  constructor(options = {}) { super("badacey_single_draw", options); }
}
export class HidugiSingleDrawEngine extends SpecialDrawEngine {
  constructor(options = {}) { super("hidugi_single_draw", options); }
}
