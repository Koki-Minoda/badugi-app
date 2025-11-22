import { getVariantById } from "../config/variantCatalog.js";
import { evaluateHighHand } from "./high.js";
import { evaluateLowHand } from "./low.js";
import { evaluateBadugiHand } from "./badugi.js";
import {
  evaluateSplitHand,
  evaluateBadeucey,
  evaluateBadacey,
  evaluateHiLoEight,
} from "./split.js";

const tagHandlers = new Map();
const gameTagOverrides = new Map();

registerEvaluatorTag("high", (params) => evaluateHighHand(params));
registerEvaluatorTag("low-27", (params) => evaluateLowHand({ ...params, lowType: "27" }));
registerEvaluatorTag("low-a5", (params) => evaluateLowHand({ ...params, lowType: "A5" }));
registerEvaluatorTag("badugi-low", (params) => evaluateBadugiHand(params));
registerEvaluatorTag("badugi-high", (params) => evaluateBadugiHand({ ...params, mode: "high" }));
registerEvaluatorTag("split-badugi-27", (params) => evaluateBadeucey(params));
registerEvaluatorTag("split-badugi-a5", (params) => evaluateBadacey(params));
registerEvaluatorTag("hi-lo-8-split", (params) => evaluateHiLoEight(params));

registerGameEvaluator("badugi", ["badugi-low"]);

export function registerEvaluatorTag(tag, handler) {
  if (!tag || typeof handler !== "function") {
    throw new Error("registerEvaluatorTag requires a tag and handler.");
  }
  tagHandlers.set(tag, handler);
}

export function registerGameEvaluator(gameType, tags) {
  if (!gameType) return;
  if (!Array.isArray(tags) || tags.length === 0) return;
  gameTagOverrides.set(gameType, tags);
}

function resolveTags({ gameType, tags }) {
  if (Array.isArray(tags) && tags.length) {
    return tags;
  }
  if (gameType && gameTagOverrides.has(gameType)) {
    return gameTagOverrides.get(gameType);
  }
  if (gameType) {
    const variant = getVariantById(gameType);
    if (variant?.evaluators?.length) {
      return variant.evaluators;
    }
  }
  return [];
}

export function evaluateHand({ cards, gameType, tags, ...rest }) {
  const resolvedTags = resolveTags({ gameType, tags });
  if (!resolvedTags.length) {
    throw new Error(
      `No evaluator tags available for gameType=${gameType ?? "unknown"}. Provide tags manually.`
    );
  }
  const primaryTag = resolvedTags[0];
  const handler = tagHandlers.get(primaryTag);
  if (!handler) {
    throw new Error(`No handler registered for evaluator tag "${primaryTag}".`);
  }
  return handler({ cards, ...rest, tags: resolvedTags, gameType });
}

export function compareEvaluations(a, b) {
  const metadataA = a?.metadata ?? {};
  const metadataB = b?.metadata ?? {};
  const sizeA = typeof metadataA.size === "number" ? metadataA.size : 0;
  const sizeB = typeof metadataB.size === "number" ? metadataB.size : 0;
  if (sizeA !== sizeB) {
    return sizeB - sizeA;
  }
  if (a.rankPrimary !== b.rankPrimary) {
    return a.rankPrimary - b.rankPrimary;
  }
  const ranksA = Array.isArray(metadataA.ranks) ? metadataA.ranks : [];
  const ranksB = Array.isArray(metadataB.ranks) ? metadataB.ranks : [];
  const len = Math.max(ranksA.length, ranksB.length);
  for (let i = 0; i < len; i += 1) {
    const va = ranksA[i] ?? Number.MAX_SAFE_INTEGER;
    const vb = ranksB[i] ?? Number.MAX_SAFE_INTEGER;
    if (va !== vb) return va - vb;
  }
  return 0;
}
