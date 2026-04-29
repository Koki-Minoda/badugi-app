const BASE_TYPES = new Set(["badugi", "holdem", "omaha", "draw", "stud"]);
const DECK_TYPES = new Set(["standard52", "shortDeck36"]);
const BETTING_STRUCTURES = new Set([
  "noLimit",
  "potLimit",
  "limit",
  "fixed",
  "none",
]);
const FORCED_BET_TYPES = new Set(["blinds", "antes", "bombPot", "none"]);
const SPLIT_MODES = new Set(["single", "byBoard", "hiLo"]);

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Variant ${label} must be an object`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Variant ${label} must be a number`);
  }
}

export function normalizeVariant(variant) {
  assertObject(variant, "definition");

  return {
    ...variant,
    players: { ...(variant.players ?? {}) },
    deck: { ...(variant.deck ?? {}) },
    holeCards: { ...(variant.holeCards ?? {}) },
    boards: {
      ...(variant.boards ?? {}),
      streets: [...(variant.boards?.streets ?? [])],
    },
    betting: {
      ...(variant.betting ?? {}),
      streets: [...(variant.betting?.streets ?? [])],
    },
    forcedBets: {
      type: "none",
      ...(variant.forcedBets ?? {}),
    },
    showdown: { ...(variant.showdown ?? {}) },
    modifiers: [...(variant.modifiers ?? [])],
  };
}

export function validateVariant(variant) {
  const normalized = normalizeVariant(variant);

  if (!normalized.id || typeof normalized.id !== "string") {
    throw new Error("Variant id is required");
  }
  if (!normalized.name || typeof normalized.name !== "string") {
    throw new Error(`Variant ${normalized.id} name is required`);
  }
  if (!BASE_TYPES.has(normalized.base)) {
    throw new Error(`Variant ${normalized.id} base is invalid`);
  }

  assertNumber(normalized.players.min, `${normalized.id}.players.min`);
  assertNumber(normalized.players.max, `${normalized.id}.players.max`);
  if (normalized.players.min < 1 || normalized.players.max < normalized.players.min) {
    throw new Error(`Variant ${normalized.id} players range is invalid`);
  }

  if (!DECK_TYPES.has(normalized.deck.type)) {
    throw new Error(`Variant ${normalized.id} deck.type is invalid`);
  }

  assertNumber(normalized.holeCards.count, `${normalized.id}.holeCards.count`);
  if (normalized.holeCards.count < 0) {
    throw new Error(`Variant ${normalized.id} holeCards.count is invalid`);
  }

  assertNumber(normalized.boards.count, `${normalized.id}.boards.count`);
  if (normalized.boards.count < 1) {
    throw new Error(`Variant ${normalized.id} boards.count must be at least 1`);
  }
  assertNumber(normalized.boards.cardsPerBoard, `${normalized.id}.boards.cardsPerBoard`);
  if (!Array.isArray(normalized.boards.streets)) {
    throw new Error(`Variant ${normalized.id} boards.streets must be an array`);
  }

  if (!BETTING_STRUCTURES.has(normalized.betting.structure)) {
    throw new Error(`Variant ${normalized.id} betting.structure is invalid`);
  }
  if (!Array.isArray(normalized.betting.streets)) {
    throw new Error(`Variant ${normalized.id} betting.streets must be an array`);
  }
  if (typeof normalized.betting.hasPreflop !== "boolean") {
    throw new Error(`Variant ${normalized.id} betting.hasPreflop must be boolean`);
  }

  if (!FORCED_BET_TYPES.has(normalized.forcedBets.type)) {
    throw new Error(`Variant ${normalized.id} forcedBets.type is invalid`);
  }

  if (!normalized.showdown.evaluator || typeof normalized.showdown.evaluator !== "string") {
    throw new Error(`Variant ${normalized.id} showdown.evaluator is required`);
  }
  if (!SPLIT_MODES.has(normalized.showdown.splitMode)) {
    throw new Error(`Variant ${normalized.id} showdown.splitMode is invalid`);
  }
  if (!Array.isArray(normalized.modifiers)) {
    throw new Error(`Variant ${normalized.id} modifiers must be an array`);
  }

  if (normalized.base === "omaha" && normalized.holeCards.mustUse !== 2) {
    throw new Error(`Variant ${normalized.id} Omaha variants must use exactly 2 hole cards`);
  }

  if (normalized.modifiers.includes("doubleBoard") && normalized.boards.count < 2) {
    throw new Error(`Variant ${normalized.id} doubleBoard variants require at least 2 boards`);
  }

  if (normalized.modifiers.includes("bombPot")) {
    if (normalized.forcedBets.type !== "bombPot") {
      throw new Error(`Variant ${normalized.id} bombPot variants require bombPot forced bets`);
    }
    if (normalized.betting.hasPreflop !== false) {
      throw new Error(`Variant ${normalized.id} bombPot variants must disable preflop betting`);
    }
  }

  return true;
}
