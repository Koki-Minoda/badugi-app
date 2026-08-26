import { getVariantById } from "../../config/variantCatalog.js";
import { compareNlhHands, evaluateNlhHand } from "../../nlh/utils/nlhEvaluator.js";
import { extractPayouts, validateHandEvIntegrity } from "./evIntegrityChecker.js";

const FAMILY_ALLOWLISTS = Object.freeze([
  {
    ids: ["B02", "B03", "B04"],
    reason: "Board pilot expansion awaits variant-specific fixed-limit and three-hole settlement fixtures.",
  },
  {
    ids: ["B05", "B06", "B07", "B08", "B09"],
    reason: "Omaha settlement awaits strict must-use-two, side-pot, hi/lo, quartering, and odd-chip fixtures.",
  },
  {
    ids: ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "S01", "S02", "S03", "S04", "S05", "S06", "S07"],
    reason: "Draw settlement awaits normalized terminal pot snapshots and component-pot winner replay.",
  },
  {
    ids: ["H01", "H02", "H03", "H04", "H05", "H06"],
    reason: "Dramaha settlement awaits board/draw component winner and odd-chip verification.",
  },
  {
    ids: ["ST1", "ST2", "ST3", "ST4", "ST5", "ST6"],
    reason: "Stud settlement awaits bring-in history replay and split-component winner verification.",
  },
  {
    ids: ["CP1"],
    reason: "Classic Chinese Poker uses points rather than chip-pot settlement; a dedicated strict points gate is required.",
  },
]);

export const STRICT_SETTLEMENT_ALLOWLIST = Object.freeze(
  Object.fromEntries(
    FAMILY_ALLOWLISTS.flatMap(({ ids, reason }) => ids.map((id) => [id, reason])),
  ),
);

export function getStrictSettlementPolicy(variantId) {
  const variant = getVariantById(variantId);
  if (!variant) {
    return { variantId, status: "UNKNOWN", reason: "Variant is absent from the canonical catalog." };
  }
  if (variant.id === "B01") {
    return { variantId: variant.id, status: "ENFORCED", reason: null };
  }
  const reason = STRICT_SETTLEMENT_ALLOWLIST[variant.id];
  return {
    variantId: variant.id,
    status: reason ? "ALLOWLISTED" : "UNCLASSIFIED",
    reason: reason ?? "Strict settlement policy is missing.",
  };
}

function seatIndexOf(player, fallback) {
  return player?.seatIndex ?? fallback;
}

function verifyNlhPotWinners(afterState, result) {
  const errors = [];
  const board = afterState?.boardCards ?? result?.board ?? [];
  const players = afterState?.players ?? [];
  const evaluations = players
    .map((player, index) => ({
      player,
      seatIndex: seatIndexOf(player, index),
      evaluation:
        !player?.folded && !player?.seatOut && player?.holeCards?.length === 2 && board.length === 5
          ? evaluateNlhHand({ cards: [...player.holeCards, ...board] })
          : null,
    }))
    .filter((entry) => entry.evaluation);
  const payouts = extractPayouts(result);

  for (const [potIndex, pot] of (result?.potDetails ?? []).entries()) {
    const eligible = new Set(pot.eligibleSeatIndexes ?? evaluations.map((entry) => entry.seatIndex));
    const candidates = evaluations.filter((entry) => eligible.has(entry.seatIndex));
    if (!candidates.length) {
      errors.push({ code: "strict_nlh_pot_has_no_evaluable_player", potIndex });
      continue;
    }
    const best = candidates.reduce((current, entry) =>
      !current || compareNlhHands(entry.evaluation, current.evaluation) < 0 ? entry : current,
    null);
    const expected = candidates
      .filter((entry) => compareNlhHands(entry.evaluation, best.evaluation) === 0)
      .map((entry) => entry.seatIndex)
      .sort((left, right) => left - right);
    const actual = payouts
      .filter((payout) => (payout.potIndex ?? 0) === potIndex && Number(payout.amount) > 0)
      .map((payout) => payout.seatIndex)
      .sort((left, right) => left - right);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      errors.push({ code: "strict_nlh_evaluator_winner_mismatch", potIndex, expected, actual });
    }
  }
  return errors;
}

export function validateStrictVariantSettlement({
  variantId,
  beforeState,
  afterState,
  result = afterState?.lastHandResult,
} = {}) {
  const policy = getStrictSettlementPolicy(variantId);
  if (policy.status !== "ENFORCED") {
    return { ok: policy.status === "ALLOWLISTED", policy, errors: [], check: null };
  }

  const check = validateHandEvIntegrity({
    beforeState,
    afterState,
    result,
    variant: getVariantById(variantId),
    options: {
      requireResult: true,
      strictChipConservation: true,
      terminalPotIsResultEcho: true,
    },
  });
  const strictErrors = [];
  if (!Array.isArray(result?.potDetails) || result.potDetails.length === 0) {
    strictErrors.push({ code: "strict_pot_details_missing" });
  } else {
    const detailsTotal = result.potDetails.reduce(
      (sum, pot) => sum + Math.max(0, Number(pot?.amount ?? pot?.potAmount) || 0),
      0,
    );
    if (detailsTotal !== Number(result.totalPot ?? result.pot ?? 0)) {
      strictErrors.push({
        code: "strict_pot_details_total_mismatch",
        detailsTotal,
        totalPot: Number(result.totalPot ?? result.pot ?? 0),
      });
    }
  }
  strictErrors.push(...verifyNlhPotWinners(afterState, result));
  const errors = [...check.errors, ...strictErrors];
  return { ok: errors.length === 0, policy, errors, check };
}

