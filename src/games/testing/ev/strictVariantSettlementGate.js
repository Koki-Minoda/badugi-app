import { getVariantById } from "../../config/variantCatalog.js";
import { compareNlhHands, evaluateNlhHand } from "../../nlh/utils/nlhEvaluator.js";
import { comparePloHands, evaluatePloHand } from "../../plo/utils/ploEvaluator.js";
import { evaluateOmahaEightLow } from "../../plo/PLO8GameController.js";
import { evaluateBadugiHand } from "../../evaluators/badugi.js";
import { evaluateHighHand } from "../../evaluators/high.js";
import { evaluateLowHand } from "../../evaluators/low.js";
import { extractPayouts, validateHandEvIntegrity } from "./evIntegrityChecker.js";

const STRICT_BOARD_VARIANTS = new Set([
  "B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09",
]);

const STRICT_STUD_VARIANTS = new Set(["ST1", "ST2", "ST3", "ST4", "ST5", "ST6"]);

const FAMILY_ALLOWLISTS = Object.freeze([
  {
    ids: ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "S01", "S02", "S03", "S04", "S05", "S06", "S07"],
    reason: "Draw settlement awaits normalized terminal pot snapshots and component-pot winner replay.",
  },
  {
    ids: ["H01", "H02", "H03", "H04", "H05", "H06"],
    reason: "Dramaha settlement awaits board/draw component winner and odd-chip verification.",
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
  if (STRICT_BOARD_VARIANTS.has(variant.id) || STRICT_STUD_VARIANTS.has(variant.id)) {
    return { variantId: variant.id, status: "ENFORCED", reason: null };
  }
  const reason = STRICT_SETTLEMENT_ALLOWLIST[variant.id];
  return {
    variantId: variant.id,
    status: reason ? "ALLOWLISTED" : "UNCLASSIFIED",
    reason: reason ?? "Strict settlement policy is missing.",
  };
}

function buildStudEvaluations(variantId, afterState) {
  return (afterState?.players ?? [])
    .map((player, index) => {
      const seatIndex = seatIndexOf(player, index);
      if (player?.folded || player?.seatOut || !Array.isArray(player?.holeCards) || player.holeCards.length < 5) {
        return null;
      }
      const high = evaluateHighHand({ cards: player.holeCards });
      const a5Low = evaluateLowHand({
        cards: player.holeCards,
        lowType: "A5",
        requireQualifier: variantId === "ST2" ? 8 : null,
      });
      return {
        player,
        seatIndex,
        high,
        low: variantId === "ST5" || variantId === "ST6"
          ? evaluateLowHand({ cards: player.holeCards, lowType: "27" })
          : a5Low,
        badugi: evaluateBadugiHand({ cards: player.holeCards }),
      };
    })
    .filter(Boolean);
}

function payoutSeatsForComponent(payouts, potIndex, component) {
  return payouts
    .filter((payout) =>
      (payout.potIndex ?? 0) === potIndex &&
      Number(payout.amount) > 0 &&
      payout.component === component,
    )
    .map((payout) => payout.seatIndex)
    .sort((left, right) => left - right);
}

function verifyStudPotWinners(variantId, afterState, result) {
  const errors = [];
  const evaluations = buildStudEvaluations(variantId, afterState);
  const payouts = extractPayouts(result);
  if (result?.splitMode == null) {
    const liveSeats = (afterState?.players ?? [])
      .map((player, index) => ({ player, seatIndex: seatIndexOf(player, index) }))
      .filter(({ player }) => player && !player.folded && !player.seatOut)
      .map(({ seatIndex }) => seatIndex)
      .sort((left, right) => left - right);
    for (const [potIndex] of (result?.potDetails ?? []).entries()) {
      const actual = payoutSeatsForComponent(payouts, potIndex, "main");
      if (liveSeats.length !== 1 || JSON.stringify(actual) !== JSON.stringify(liveSeats)) {
        errors.push({
          code: "strict_stud_uncontested_winner_mismatch",
          variantId,
          potIndex,
          expected: liveSeats,
          actual,
        });
      }
    }
    return errors;
  }
  const splitComponents = variantId === "ST2"
    ? [["high", "high"], ["low", "low"]]
    : variantId === "ST4" || variantId === "ST5"
      ? [["badugi", "badugi"], ["low", "low"]]
      : [["main", variantId === "ST3" || variantId === "ST6" ? "low" : "high"]];

  for (const [potIndex, pot] of (result?.potDetails ?? []).entries()) {
    const eligible = new Set(pot.eligibleSeatIndexes ?? evaluations.map((entry) => entry.seatIndex));
    const candidates = evaluations.filter((entry) => eligible.has(entry.seatIndex));
    if (!candidates.length) {
      errors.push({ code: "strict_stud_pot_has_no_evaluable_player", variantId, potIndex });
      continue;
    }
    for (const [component, evaluationKey] of splitComponents) {
      const componentCandidates = evaluationKey === "low" && variantId === "ST2"
        ? candidates.filter((entry) => entry.low?.qualifies)
        : candidates;
      const expected = expectedWinnerSeats(componentCandidates, evaluationKey, (left, right) => left.rankPrimary - right.rankPrimary);
      const actual = payoutSeatsForComponent(payouts, potIndex, component);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        errors.push({
          code: "strict_stud_component_winner_mismatch",
          variantId,
          potIndex,
          component,
          expected,
          actual,
        });
      }
    }
  }
  return errors;
}

function seatIndexOf(player, fallback) {
  return player?.seatIndex ?? fallback;
}

function buildBoardEvaluations(variantId, afterState, result) {
  const board = afterState?.boardCards ?? result?.board ?? [];
  return (afterState?.players ?? [])
    .map((player, index) => {
      const seatIndex = seatIndexOf(player, index);
      if (player?.folded || player?.seatOut) return null;
      if (["B01", "B02", "B03", "B04"].includes(variantId)) {
        const requiredHoleCards = variantId === "B03" || variantId === "B04" ? 3 : 2;
        if (player?.holeCards?.length !== requiredHoleCards || board.length !== 5) return null;
        return {
          player,
          seatIndex,
          high: evaluateNlhHand({ cards: [...player.holeCards, ...board] }),
          low: null,
        };
      }
      const requiredHoleCards = variantId === "B07" || variantId === "B08" ? 5 : 4;
      if (!Array.isArray(player?.holeCards) || player.holeCards.length < requiredHoleCards || board.length !== 5) {
        return null;
      }
      return {
        player,
        seatIndex,
        high: evaluatePloHand({ holeCards: player.holeCards, boardCards: board }),
        low: variantId === "B06" || variantId === "B09"
          ? evaluateOmahaEightLow({ holeCards: player.holeCards, boardCards: board })
          : null,
      };
    })
    .filter(Boolean);
}

function expectedWinnerSeats(entries, evaluationKey, compareEvaluations) {
  const candidates = entries.filter((entry) => entry[evaluationKey]);
  if (!candidates.length) return [];
  const best = candidates.reduce((current, entry) =>
    !current || compareEvaluations(entry[evaluationKey], current[evaluationKey]) < 0
      ? entry
      : current,
  null);
  return candidates
    .filter((entry) => compareEvaluations(entry[evaluationKey], best[evaluationKey]) === 0)
    .map((entry) => entry.seatIndex)
    .sort((left, right) => left - right);
}

function verifyBoardPotWinners(variantId, afterState, result) {
  const errors = [];
  const evaluations = buildBoardEvaluations(variantId, afterState, result);
  const payouts = extractPayouts(result);
  const compareHigh = ["B01", "B02", "B03", "B04"].includes(variantId)
    ? compareNlhHands
    : comparePloHands;
  const split = variantId === "B06" || variantId === "B09";

  for (const [potIndex, pot] of (result?.potDetails ?? []).entries()) {
    const eligible = new Set(pot.eligibleSeatIndexes ?? evaluations.map((entry) => entry.seatIndex));
    const candidates = evaluations.filter((entry) => eligible.has(entry.seatIndex));
    if (!candidates.length) {
      errors.push({ code: "strict_nlh_pot_has_no_evaluable_player", potIndex });
      continue;
    }
    const expectedHigh = expectedWinnerSeats(candidates, "high", compareHigh);
    const actualHigh = payouts
      .filter((payout) =>
        (payout.potIndex ?? 0) === potIndex &&
        Number(payout.amount) > 0 &&
        (!split || payout.component === "high"),
      )
      .map((payout) => payout.seatIndex)
      .sort((left, right) => left - right);
    if (JSON.stringify(actualHigh) !== JSON.stringify(expectedHigh)) {
      errors.push({
        code: "strict_board_high_winner_mismatch",
        variantId,
        potIndex,
        expected: expectedHigh,
        actual: actualHigh,
      });
    }
    if (split) {
      const expectedLow = expectedWinnerSeats(
        candidates,
        "low",
        (left, right) => left.rankPrimary - right.rankPrimary,
      );
      const actualLow = payouts
        .filter((payout) =>
          (payout.potIndex ?? 0) === potIndex &&
          Number(payout.amount) > 0 &&
          payout.component === "low",
        )
        .map((payout) => payout.seatIndex)
        .sort((left, right) => left - right);
      if (JSON.stringify(actualLow) !== JSON.stringify(expectedLow)) {
        errors.push({
          code: "strict_board_low_winner_mismatch",
          variantId,
          potIndex,
          expected: expectedLow,
          actual: actualLow,
        });
      }
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
  if (STRICT_BOARD_VARIANTS.has(variantId)) {
    strictErrors.push(...verifyBoardPotWinners(variantId, afterState, result));
  } else if (STRICT_STUD_VARIANTS.has(variantId)) {
    strictErrors.push(...verifyStudPotWinners(variantId, afterState, result));
  }
  const errors = [...check.errors, ...strictErrors];
  return { ok: errors.length === 0, policy, errors, check };
}
