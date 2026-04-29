import { fetchVariant, fetchVariants } from "./variantApi.js";
import { normalizeVariant, validateVariant } from "./variantDefinition.js";
import { getVariant, listVariants } from "./variantRegistry.js";

function normalizeHoleCards(holeCards = {}) {
  const { must_use: _mustUseSnake, ...rest } = holeCards;
  return {
    ...rest,
    mustUse: holeCards.mustUse ?? holeCards.must_use,
  };
}

function normalizeBoards(boards = {}) {
  const { cards_per_board: _cardsPerBoardSnake, ...rest } = boards;
  return {
    ...rest,
    cardsPerBoard: boards.cardsPerBoard ?? boards.cards_per_board,
    streets: [...(boards.streets ?? [])],
  };
}

function normalizeBetting(betting = {}) {
  const { has_preflop: _hasPreflopSnake, ...rest } = betting;
  return {
    ...rest,
    hasPreflop: betting.hasPreflop ?? betting.has_preflop,
    streets: [...(betting.streets ?? [])],
  };
}

function normalizeForcedBets(forcedBets = {}) {
  const {
    everyone_posts: _everyonePostsSnake,
    amount_bb: _amountBBSnake,
    ...rest
  } = forcedBets;
  return {
    ...rest,
    everyonePosts: forcedBets.everyonePosts ?? forcedBets.everyone_posts,
    amountBB: forcedBets.amountBB ?? forcedBets.amount_bb,
  };
}

function normalizeShowdown(showdown = {}) {
  const {
    split_mode: _splitModeSnake,
    scoop_allowed: _scoopAllowedSnake,
    ...rest
  } = showdown;
  return {
    ...rest,
    splitMode: showdown.splitMode ?? showdown.split_mode,
    scoopAllowed: showdown.scoopAllowed ?? showdown.scoop_allowed,
  };
}

function stripUndefined(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}

export function normalizeDbVariant(dbVariant) {
  if (!dbVariant || typeof dbVariant !== "object") {
    throw new Error("dbVariant must be an object");
  }

  return normalizeVariant({
    id: dbVariant.variant_key ?? dbVariant.id,
    name: dbVariant.name,
    description: dbVariant.description,
    base: dbVariant.base_game ?? dbVariant.base,
    players: {
      min: dbVariant.min_players ?? dbVariant.players?.min,
      max: dbVariant.max_players ?? dbVariant.players?.max,
    },
    deck: {
      type: dbVariant.deck_type ?? dbVariant.deck?.type,
    },
    holeCards: stripUndefined(normalizeHoleCards(dbVariant.hole_cards ?? dbVariant.holeCards)),
    boards: stripUndefined(normalizeBoards(dbVariant.boards)),
    betting: stripUndefined(normalizeBetting(dbVariant.betting)),
    forcedBets: stripUndefined(normalizeForcedBets(dbVariant.forced_bets ?? dbVariant.forcedBets)),
    showdown: stripUndefined(normalizeShowdown(dbVariant.showdown)),
    modifiers: [...(dbVariant.modifiers ?? [])],
  });
}

function tryNormalizeAndValidate(dbVariant) {
  const normalized = normalizeDbVariant(dbVariant);
  validateVariant(normalized);
  return normalized;
}

export function getLocalFallbackVariant(variantKey) {
  return getVariant(variantKey);
}

export async function loadVariant(variantKey) {
  try {
    const dbVariant = await fetchVariant(variantKey);
    return tryNormalizeAndValidate(dbVariant);
  } catch {
    return getLocalFallbackVariant(variantKey);
  }
}

export async function loadVariants() {
  try {
    const dbVariants = await fetchVariants();
    const variants = (Array.isArray(dbVariants) ? dbVariants : [])
      .map((dbVariant) => {
        try {
          return tryNormalizeAndValidate(dbVariant);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (variants.length > 0) {
      return variants;
    }
  } catch {
    // Fall through to local registry fallback.
  }

  return listVariants();
}
