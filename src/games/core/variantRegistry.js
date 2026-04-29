import { normalizeVariant, validateVariant } from "./variantDefinition.js";

const initialVariants = [
  {
    id: "badugi",
    name: "Badugi",
    base: "badugi",
    players: { min: 2, max: 6 },
    deck: { type: "standard52" },
    holeCards: { count: 4 },
    boards: { count: 1, cardsPerBoard: 0, streets: [] },
    betting: {
      structure: "limit",
      streets: ["preDraw", "draw1", "draw2", "draw3"],
      hasPreflop: true,
    },
    forcedBets: { type: "blinds" },
    showdown: { evaluator: "badugiLow", splitMode: "single" },
    modifiers: ["draw"],
  },
  {
    id: "nl_holdem",
    name: "No-Limit Hold'em",
    base: "holdem",
    players: { min: 2, max: 9 },
    deck: { type: "standard52" },
    holeCards: { count: 2 },
    boards: { count: 1, cardsPerBoard: 5, streets: ["flop", "turn", "river"] },
    betting: {
      structure: "noLimit",
      streets: ["preflop", "flop", "turn", "river"],
      hasPreflop: true,
    },
    forcedBets: { type: "blinds" },
    showdown: { evaluator: "holdemHigh", splitMode: "single" },
    modifiers: [],
  },
  {
    id: "limit_holdem",
    name: "Limit Hold'em",
    base: "holdem",
    players: { min: 2, max: 9 },
    deck: { type: "standard52" },
    holeCards: { count: 2 },
    boards: { count: 1, cardsPerBoard: 5, streets: ["flop", "turn", "river"] },
    betting: {
      structure: "limit",
      streets: ["preflop", "flop", "turn", "river"],
      hasPreflop: true,
    },
    forcedBets: { type: "blinds" },
    showdown: { evaluator: "holdemHigh", splitMode: "single" },
    modifiers: [],
  },
  {
    id: "plo",
    name: "Pot-Limit Omaha",
    base: "omaha",
    players: { min: 2, max: 9 },
    deck: { type: "standard52" },
    holeCards: { count: 4, mustUse: 2 },
    boards: { count: 1, cardsPerBoard: 5, streets: ["flop", "turn", "river"] },
    betting: {
      structure: "potLimit",
      streets: ["preflop", "flop", "turn", "river"],
      hasPreflop: true,
    },
    forcedBets: { type: "blinds" },
    showdown: { evaluator: "omahaHigh", splitMode: "single" },
    modifiers: [],
  },
  {
    id: "double_board_bomb_pot_omaha",
    name: "Double Board Bomb Pot Omaha",
    base: "omaha",
    players: { min: 2, max: 9 },
    deck: { type: "standard52" },
    holeCards: { count: 4, mustUse: 2 },
    boards: { count: 2, cardsPerBoard: 5, streets: ["flop", "turn", "river"] },
    betting: {
      structure: "potLimit",
      streets: ["flop", "turn", "river"],
      hasPreflop: false,
    },
    forcedBets: { type: "bombPot", everyonePosts: true, amountBB: 1 },
    showdown: { evaluator: "omahaHigh", splitMode: "byBoard", scoopAllowed: true },
    modifiers: ["doubleBoard", "bombPot"],
  },
];

const variantMap = new Map();

export function registerVariant(variant) {
  const normalized = normalizeVariant(variant);
  validateVariant(normalized);

  if (variantMap.has(normalized.id)) {
    throw new Error(`Variant ${normalized.id} is already registered`);
  }

  variantMap.set(normalized.id, Object.freeze(normalized));
  return variantMap.get(normalized.id);
}

export function getVariant(id) {
  if (!id) return null;
  return variantMap.get(id) ?? null;
}

export function listVariants() {
  return Array.from(variantMap.values());
}

export function hasVariant(id) {
  return variantMap.has(id);
}

initialVariants.forEach((variant) => registerVariant(variant));
