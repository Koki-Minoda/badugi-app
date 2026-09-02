import { getVariantById } from "../../config/variantCatalog.js";
import { compareNlhHands, evaluateNlhHand } from "../../nlh/utils/nlhEvaluator.js";
import { comparePloHands, evaluatePloHand } from "../../plo/utils/ploEvaluator.js";
import { evaluateOmahaEightLow } from "../../plo/PLO8GameController.js";
import { evaluateBadugiHand } from "../../evaluators/badugi.js";
import { evaluateHighHand } from "../../evaluators/high.js";
import { evaluateLowHand } from "../../evaluators/low.js";
import { compareEvaluations } from "../../evaluators/registry.js";
import {
  compareDramahaBoard,
  compareDramahaDraw,
  evaluateDramahaHand,
} from "../../dramaha/utils/dramahaEvaluator.js";
import { compareChineseScore, evaluateChineseRows } from "../../chinese/chinesePokerScorer.js";
import { extractPayouts, validateHandEvIntegrity } from "./evIntegrityChecker.js";

const STRICT_BOARD_VARIANTS = new Set([
  "B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09",
]);

const STRICT_STUD_VARIANTS = new Set(["ST1", "ST2", "ST3", "ST4", "ST5", "ST6"]);

const STRICT_DRAW_VARIANTS = new Set([
  "D01", "D02", "D03", "D04", "D05", "D06", "D07",
  "S01", "S02", "S03", "S04", "S05", "S06", "S07",
]);

const STRICT_DRAMAHA_VARIANTS = new Set(["H01", "H02", "H03", "H04", "H05", "H06"]);
const STRICT_CHINESE_VARIANTS = new Set(["CP1"]);
const DEFERRED_SETTLEMENT_VARIANTS = Object.freeze({
  CP2: "Open-Face Chinese Poker is unavailable until street placement and Fantasyland settlement are implemented.",
});

const DRAMAHA_ENGINE_KEY_BY_VARIANT = Object.freeze({
  H01: "dramaha_hi",
  H02: "dramaha_27",
  H03: "dramaha_a5",
  H04: "dramaha_zero",
  H05: "dramaha_hidugi",
  H06: "dramaha_badugi",
});

export const STRICT_SETTLEMENT_ALLOWLIST = Object.freeze({});

export function getStrictSettlementPolicy(variantId) {
  const variant = getVariantById(variantId);
  if (!variant) {
    return { variantId, status: "UNKNOWN", reason: "Variant is absent from the canonical catalog." };
  }
  if (
    STRICT_BOARD_VARIANTS.has(variant.id) ||
    STRICT_STUD_VARIANTS.has(variant.id) ||
    STRICT_DRAW_VARIANTS.has(variant.id) ||
    STRICT_DRAMAHA_VARIANTS.has(variant.id) ||
    STRICT_CHINESE_VARIANTS.has(variant.id)
  ) {
    return { variantId: variant.id, status: "ENFORCED", reason: null };
  }
  if (DEFERRED_SETTLEMENT_VARIANTS[variant.id]) {
    return {
      variantId: variant.id,
      status: "DEFERRED",
      reason: DEFERRED_SETTLEMENT_VARIANTS[variant.id],
    };
  }
  const reason = STRICT_SETTLEMENT_ALLOWLIST[variant.id];
  return {
    variantId: variant.id,
    status: reason ? "ALLOWLISTED" : "UNCLASSIFIED",
    reason: reason ?? "Strict settlement policy is missing.",
  };
}

function sortedUnique(values = []) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function expectedPayouts(
  amount,
  winnerSeatIndexes = [],
  { buttonSeat = 0, seatCount = Math.max(1, ...winnerSeatIndexes.map((seat) => seat + 1)) } = {},
) {
  const firstSeat = (buttonSeat + 1) % seatCount;
  const seats = sortedUnique(winnerSeatIndexes).sort((left, right) => {
    const leftDistance = (left - firstSeat + seatCount) % seatCount;
    const rightDistance = (right - firstSeat + seatCount) % seatCount;
    return leftDistance - rightDistance || left - right;
  });
  if (!seats.length || amount <= 0) return [];
  const base = Math.floor(amount / seats.length);
  let remainder = amount - base * seats.length;
  return seats.map((seatIndex) => {
    const payout = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return { seatIndex, payout };
  });
}

function buildExpectedDramahaPots(players = [], fallbackAmount = 0) {
  const contributions = players.map((player, seatIndex) => ({
    seatIndex: seatIndexOf(player, seatIndex),
    amount: Math.max(0, Number(player?.totalInvested) || 0),
    eligible: Boolean(player) && !player.folded && !player.seatOut && !player.sittingOut,
  }));
  const levels = sortedUnique(contributions.map((entry) => entry.amount).filter((amount) => amount > 0));
  let previous = 0;
  const pots = levels.map((level, sourcePotIndex) => {
    const contributors = contributions.filter((entry) => entry.amount >= level);
    const pot = {
      sourcePotIndex,
      amount: (level - previous) * contributors.length,
      eligibleSeatIndexes: contributors.filter((entry) => entry.eligible).map((entry) => entry.seatIndex),
    };
    previous = level;
    return pot;
  });
  if (pots.length) return pots;
  return [{
    sourcePotIndex: 0,
    amount: Math.max(0, Number(fallbackAmount) || 0),
    eligibleSeatIndexes: contributions.filter((entry) => entry.eligible).map((entry) => entry.seatIndex),
  }];
}

function verifyDramahaSettlement(variantId, afterState, result) {
  const errors = [];
  const engineKey = DRAMAHA_ENGINE_KEY_BY_VARIANT[variantId];
  const boardCards = afterState?.boardCards ?? result?.board ?? [];
  const evaluations = (afterState?.players ?? [])
    .map((player, index) => {
      const seatIndex = seatIndexOf(player, index);
      if (player?.folded || player?.seatOut || !Array.isArray(player?.holeCards) || player.holeCards.length !== 5) {
        return null;
      }
      if (!Array.isArray(boardCards) || boardCards.length !== 5) return null;
      return {
        seatIndex,
        evaluation: evaluateDramahaHand({
          holeCards: player.holeCards,
          boardCards,
          variant: engineKey,
        }),
      };
    })
    .filter(Boolean);
  const details = Array.isArray(result?.potDetails) ? result.potDetails : [];
  const sourceIndexes = sortedUnique(details.map((pot) => Number(pot?.sourcePotIndex)));
  const expectedSourcePots = buildExpectedDramahaPots(
    afterState?.players ?? [],
    result?.totalPot ?? result?.pot,
  );
  const expectedSourceIndexes = expectedSourcePots.map((pot) => pot.sourcePotIndex);
  if (!sameJson(sourceIndexes, expectedSourceIndexes)) {
    errors.push({
      code: "strict_dramaha_source_pot_indexes_mismatch",
      variantId,
      expected: expectedSourceIndexes,
      actual: sourceIndexes,
    });
  }

  for (const sourcePotIndex of sourceIndexes) {
    const components = details.filter((pot) => Number(pot?.sourcePotIndex) === sourcePotIndex);
    const boardPot = components.find((pot) => pot?.component === "board");
    const drawPot = components.find((pot) => pot?.component === "draw");
    if (components.length !== 2 || !boardPot || !drawPot) {
      errors.push({ code: "strict_dramaha_component_pair_missing", variantId, sourcePotIndex });
      continue;
    }
    const boardAmount = Math.max(0, Number(boardPot.amount ?? boardPot.potAmount) || 0);
    const drawAmount = Math.max(0, Number(drawPot.amount ?? drawPot.potAmount) || 0);
    const sourceAmount = boardAmount + drawAmount;
    if (boardAmount !== Math.floor(sourceAmount / 2) || drawAmount !== Math.ceil(sourceAmount / 2)) {
      errors.push({
        code: "strict_dramaha_component_split_mismatch",
        variantId,
        sourcePotIndex,
        boardAmount,
        drawAmount,
      });
    }
    const expectedOddChip = sourceAmount % 2;
    if (Number(boardPot.oddChipAmount ?? 0) !== 0 || Number(drawPot.oddChipAmount ?? 0) !== expectedOddChip) {
      errors.push({
        code: "strict_dramaha_odd_chip_mismatch",
        variantId,
        sourcePotIndex,
        expectedOddChip,
      });
    }
    const boardEligible = sortedUnique(boardPot.eligibleSeatIndexes ?? []);
    const drawEligible = sortedUnique(drawPot.eligibleSeatIndexes ?? []);
    if (!sameJson(boardEligible, drawEligible)) {
      errors.push({
        code: "strict_dramaha_component_eligibility_mismatch",
        variantId,
        sourcePotIndex,
        boardEligible,
        drawEligible,
      });
      continue;
    }
    const expectedSourcePot = expectedSourcePots.find((pot) => pot.sourcePotIndex === sourcePotIndex);
    if (
      !expectedSourcePot ||
      sourceAmount !== expectedSourcePot.amount ||
      !sameJson(boardEligible, sortedUnique(expectedSourcePot.eligibleSeatIndexes))
    ) {
      errors.push({
        code: "strict_dramaha_source_pot_mismatch",
        variantId,
        sourcePotIndex,
        expected: expectedSourcePot ?? null,
        actual: { amount: sourceAmount, eligibleSeatIndexes: boardEligible },
      });
      continue;
    }
    const candidates = evaluations.filter((entry) => boardEligible.includes(entry.seatIndex));
    if (!candidates.length) {
      errors.push({ code: "strict_dramaha_pot_has_no_evaluable_player", variantId, sourcePotIndex });
      continue;
    }
    for (const [component, pot, compare] of [
      ["board", boardPot, compareDramahaBoard],
      ["draw", drawPot, compareDramahaDraw],
    ]) {
      const best = candidates.reduce((current, entry) =>
        !current || compare(entry.evaluation, current.evaluation) < 0 ? entry : current,
      null);
      const expectedSeats = sortedUnique(
        candidates.filter((entry) => compare(entry.evaluation, best.evaluation) === 0).map((entry) => entry.seatIndex),
      );
      const actualSeats = sortedUnique(pot.winnerSeatIndexes ?? pot.winners?.map((winner) => winner.seatIndex) ?? []);
      if (!sameJson(actualSeats, expectedSeats)) {
        errors.push({
          code: "strict_dramaha_component_winner_mismatch",
          variantId,
          sourcePotIndex,
          component,
          expected: expectedSeats,
          actual: actualSeats,
        });
      }
      const amount = Math.max(0, Number(pot.amount ?? pot.potAmount) || 0);
      const actualPayouts = (pot.winners ?? [])
        .map((winner) => ({ seatIndex: winner.seatIndex, payout: Number(winner.payout) || 0 }))
        .sort((left, right) => left.seatIndex - right.seatIndex);
      const payouts = expectedPayouts(amount, expectedSeats, {
        buttonSeat: Number(afterState?.dealerIndex ?? 0),
        seatCount: Math.max(1, afterState?.players?.length ?? 0),
      }).sort((left, right) => left.seatIndex - right.seatIndex);
      if (!sameJson(actualPayouts, payouts)) {
        errors.push({
          code: "strict_dramaha_component_payout_mismatch",
          variantId,
          sourcePotIndex,
          component,
          expected: payouts,
          actual: actualPayouts,
        });
      }
    }
  }
  return errors;
}

function scoreChineseMatchup(left, right) {
  if (left.evaluation.foul && right.evaluation.foul) {
    return { points: 0, rows: {}, royalties: 0, scoop: 0, foul: "both" };
  }
  if (left.evaluation.foul) {
    return { points: -6, rows: { front: -1, middle: -1, back: -1 }, royalties: 0, scoop: -3, foul: left.id };
  }
  if (right.evaluation.foul) {
    return { points: 6, rows: { front: 1, middle: 1, back: 1 }, royalties: 0, scoop: 3, foul: right.id };
  }
  const rows = {};
  let rowPoints = 0;
  for (const row of ["front", "middle", "back"]) {
    const comparison = compareChineseScore(left.evaluation[row], right.evaluation[row]);
    rows[row] = comparison < 0 ? 1 : comparison > 0 ? -1 : 0;
    rowPoints += rows[row];
  }
  const scoop = rowPoints === 3 ? 3 : rowPoints === -3 ? -3 : 0;
  const royalties = left.evaluation.royalties.total - right.evaluation.royalties.total;
  return { points: rowPoints + scoop + royalties, rows, royalties, scoop, foul: null };
}

export function validateChinesePokerPoints({ afterState, result = afterState?.results } = {}) {
  const errors = [];
  const players = Array.isArray(afterState?.players) ? afterState.players : [];
  if (players.length < 2 || players.length > 4) {
    errors.push({ code: "strict_chinese_player_count_invalid", count: players.length });
  }
  const playerIds = players
    .map((player) => player?.id)
    .filter((id) => typeof id === "string" && id.length > 0);
  if (playerIds.length !== players.length || new Set(playerIds).size !== players.length) {
    errors.push({ code: "strict_chinese_player_ids_invalid", playerIds });
  }
  const evaluations = [];
  const allCards = [];
  for (const player of players) {
    const rows = player?.rows ?? {};
    const cards = [...(rows.front ?? []), ...(rows.middle ?? []), ...(rows.back ?? [])];
    const hand = Array.isArray(player?.hand) ? player.hand : [];
    if ((rows.front?.length ?? 0) !== 3 || (rows.middle?.length ?? 0) !== 5 || (rows.back?.length ?? 0) !== 5) {
      errors.push({ code: "strict_chinese_row_shape_invalid", playerId: player?.id });
      continue;
    }
    if (new Set(cards).size !== 13 || hand.length !== 13 || !sameJson([...cards].sort(), [...hand].sort())) {
      errors.push({ code: "strict_chinese_card_ownership_invalid", playerId: player?.id });
      continue;
    }
    allCards.push(...cards);
    evaluations.push({ id: player.id, evaluation: evaluateChineseRows(rows) });
  }
  if (new Set(allCards).size !== allCards.length) {
    errors.push({ code: "strict_chinese_cross_player_duplicate_card" });
  }
  const expectedTotals = Object.fromEntries(players.map((player) => [player.id, 0]));
  const expectedMatchups = [];
  for (let leftIndex = 0; leftIndex < evaluations.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < evaluations.length; rightIndex += 1) {
      const left = evaluations[leftIndex];
      const right = evaluations[rightIndex];
      const matchup = scoreChineseMatchup(left, right);
      expectedTotals[left.id] += matchup.points;
      expectedTotals[right.id] -= matchup.points;
      expectedMatchups.push({ playerA: left.id, playerB: right.id, ...matchup });
    }
  }
  if (!sameJson(result?.matchups ?? [], expectedMatchups)) {
    errors.push({ code: "strict_chinese_matchups_mismatch", expected: expectedMatchups, actual: result?.matchups ?? [] });
  }
  if (!sameJson(result?.totals ?? {}, expectedTotals)) {
    errors.push({ code: "strict_chinese_totals_mismatch", expected: expectedTotals, actual: result?.totals ?? {} });
  }
  const totalPoints = Object.values(result?.totals ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!Number.isFinite(totalPoints) || totalPoints !== 0) {
    errors.push({ code: "strict_chinese_points_not_zero_sum", totalPoints });
  }
  return { ok: errors.length === 0, errors, expectedTotals, expectedMatchups };
}

function drawCards(player = {}) {
  if (Array.isArray(player.hand)) return player.hand;
  if (Array.isArray(player.cards)) return player.cards;
  if (Array.isArray(player.holeCards)) return player.holeCards;
  return [];
}

function evaluateArchieHigh(cards) {
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
  return qualifies ? evaluation : null;
}

function buildDrawEvaluations(variantId, afterState) {
  return (afterState?.players ?? [])
    .map((player, index) => {
      const cards = drawCards(player);
      if (!cards.length) return null;
      const low27 = evaluateLowHand({ cards, lowType: "27" });
      const lowA5 = evaluateLowHand({
        cards,
        lowType: "A5",
        requireQualifier: variantId === "D07" ? 8 : null,
      });
      return {
        seatIndex: seatIndexOf(player, index),
        folded: Boolean(player?.folded || player?.hasFolded),
        high: evaluateHighHand({ cards }),
        archieHigh: evaluateArchieHigh(cards),
        low27,
        lowA5,
        badugi: evaluateBadugiHand({ cards, mode: "low" }),
        badugiHigh: evaluateBadugiHand({ cards, mode: "high" }),
      };
    })
    .filter(Boolean);
}

function drawEvaluationKey(variantId, component) {
  if (component === "badugi") return "badugi";
  if (component === "low27") return "low27";
  if (component === "lowA5") return "lowA5";
  if (component === "archieHigh") return "archieHigh";
  if (component === "archieLow") return "lowA5";
  if (["D01", "S01"].includes(variantId)) return "low27";
  if (["D02", "S02"].includes(variantId)) return "lowA5";
  if (["D03", "S04"].includes(variantId)) return "badugi";
  if (["D06", "S07"].includes(variantId)) return "badugiHigh";
  if (variantId === "S03") return "high";
  return null;
}

function verifyDrawPotWinners(variantId, afterState, result) {
  const errors = [];
  const evaluations = buildDrawEvaluations(variantId, afterState);
  const payouts = extractPayouts(result);
  const liveSeats = evaluations
    .filter((entry) => !entry.folded)
    .map((entry) => entry.seatIndex)
    .sort((left, right) => left - right);

  for (const [resultPotIndex, pot] of (result?.potDetails ?? []).entries()) {
    const amount = Math.max(0, Number(pot?.amount ?? pot?.potAmount) || 0);
    const component = pot.component ?? "main";
    const evaluationKey = drawEvaluationKey(variantId, component);
    const explicitEligible = Array.isArray(pot.eligibleSeatIndexes) && pot.eligibleSeatIndexes.length
      ? pot.eligibleSeatIndexes
      : null;
    const eligible = new Set(explicitEligible ?? liveSeats);
    const candidates = evaluations.filter((entry) => {
      if (!eligible.has(entry.seatIndex)) return false;
      const evaluation = entry[evaluationKey];
      return Boolean(
        evaluation &&
        evaluation.qualifies !== false &&
        evaluation.metadata?.qualifies !== false &&
        Number.isFinite(evaluation.rankPrimary) &&
        (evaluation.rankSecondary == null || Number.isFinite(evaluation.rankSecondary)),
      );
    });
    const actual = payouts
      .filter((payout) => payout.potIndex === resultPotIndex && Number(payout.amount) > 0)
      .map((payout) => payout.seatIndex)
      .sort((left, right) => left - right);
    if (amount === 0) {
      if (actual.length) {
        errors.push({
          code: "strict_draw_zero_pot_has_payout",
          variantId,
          resultPotIndex,
          component,
          actual,
        });
      }
      continue;
    }
    if (candidates.length === 1) {
      const expected = [candidates[0].seatIndex];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        errors.push({
          code: "strict_draw_uncontested_winner_mismatch",
          variantId,
          resultPotIndex,
          component,
          expected,
          actual,
        });
      }
      continue;
    }
    if (!evaluationKey || !candidates.length) {
      errors.push({
        code: "strict_draw_pot_has_no_evaluable_player",
        variantId,
        resultPotIndex,
        component,
        eligible: [...eligible],
        evaluatedSeats: evaluations.map((entry) => entry.seatIndex),
        playerShapes: (afterState?.players ?? []).map((player, seatIndex) => ({
          seatIndex: seatIndexOf(player, seatIndex),
          handCount: drawCards(player).length,
          folded: Boolean(player?.folded || player?.hasFolded),
        })),
      });
      continue;
    }
    const expected = expectedWinnerSeats(candidates, evaluationKey, compareEvaluations);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      errors.push({
        code: "strict_draw_component_winner_mismatch",
        variantId,
        resultPotIndex,
        component,
        expected,
        actual,
      });
    }
  }
  return errors;
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
        low: variantId === "B06" || variantId === "B07" || variantId === "B09"
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
  const split = variantId === "B06" || variantId === "B07" || variantId === "B09";

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
  result = afterState?.lastHandResult ?? afterState?.results,
} = {}) {
  const policy = getStrictSettlementPolicy(variantId);
  if (policy.status !== "ENFORCED") {
    return { ok: policy.status === "ALLOWLISTED", policy, errors: [], check: null };
  }

  if (STRICT_CHINESE_VARIANTS.has(variantId)) {
    const pointsCheck = validateChinesePokerPoints({ afterState, result });
    return {
      ok: pointsCheck.ok,
      policy,
      errors: pointsCheck.errors,
      check: pointsCheck,
    };
  }

  const check = validateHandEvIntegrity({
    beforeState,
    afterState,
    result,
    variant: getVariantById(variantId),
    options: {
      requireResult: true,
      strictChipConservation: true,
      terminalPotIsResultEcho: !STRICT_DRAW_VARIANTS.has(variantId),
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
  } else if (STRICT_DRAW_VARIANTS.has(variantId)) {
    strictErrors.push(...verifyDrawPotWinners(variantId, afterState, result));
  } else if (STRICT_DRAMAHA_VARIANTS.has(variantId)) {
    strictErrors.push(...verifyDramahaSettlement(variantId, afterState, result));
  }
  const errors = [...check.errors, ...strictErrors];
  return { ok: errors.length === 0, policy, errors, check };
}
