import { describe, expect, it } from "vitest";
import { GAME_VARIANTS } from "../../config/variantCatalog.js";
import { NLHGameController } from "../../nlh/NLHGameController.js";
import { FLHGameController } from "../../nlh/FLHGameController.js";
import { FLSuperHoldemGameController, SuperHoldemGameController } from "../../nlh/SuperHoldemGameController.js";
import { BigOGameController } from "../../plo/BigOGameController.js";
import { FiveCardPLOGameController } from "../../plo/FiveCardPLOGameController.js";
import { PLOGameController } from "../../plo/PLOGameController.js";
import { PLO8GameController } from "../../plo/PLO8GameController.js";
import { FLO8GameController } from "../../plo/FLO8GameController.js";
import { DramahaGameController } from "../../dramaha/DramahaGameController.js";
import { ChinesePokerController } from "../../chinese/ChinesePokerController.js";
import {
  Razz27GameController,
  RazzduceyGameController,
  RazzdugiGameController,
  RazzGameController,
  Stud8GameController,
  StudGameController,
} from "../../stud/StudGameController.js";
import { createDeterministicRng } from "../deterministicRng.js";
import {
  STRICT_SETTLEMENT_ALLOWLIST,
  getStrictSettlementPolicy,
  validateStrictVariantSettlement,
} from "./strictVariantSettlementGate.js";
import { runProgressScenario } from "../scenario/runProgressScenario.js";

function seats() {
  return Array.from({ length: 6 }, (_, seatIndex) => ({
    seatIndex,
    playerId: `p${seatIndex}`,
    name: `P${seatIndex}`,
    stack: 500,
  }));
}

function playPassiveHand(controller) {
  const beforeState = controller.startNewHand();
  for (let step = 0; step < 100; step += 1) {
    const snapshot = controller.getSnapshot();
    if (snapshot.street === "SHOWDOWN") {
      return { beforeState, afterState: snapshot };
    }
    const actor = snapshot.currentActor;
    const player = snapshot.players[actor];
    const toCall = Math.max(0, snapshot.currentBet - (player.betThisStreet ?? 0));
    const action = toCall > 0 ? "call" : "check";
    const outcome = controller.applyPlayerAction({ seatIndex: actor, action });
    expect(outcome.success).toBe(true);
  }
  throw new Error("NLH passive hand did not terminate");
}

describe("strict per-variant settlement gate", () => {
  it("enforces a dedicated settlement or points policy for every catalog variant", () => {
    const policies = GAME_VARIANTS.map((variant) => getStrictSettlementPolicy(variant.id));
    expect(policies.every((policy) => policy.status === "ENFORCED")).toBe(true);
    expect(policies).toHaveLength(36);
    expect(policies.filter((policy) => policy.status === "UNCLASSIFIED")).toEqual([]);
    expect(Object.keys(STRICT_SETTLEMENT_ALLOWLIST)).toHaveLength(0);
  });

  it.each(["H01", "H02", "H03", "H04", "H05", "H06"])(
    "enforces board/draw split settlement for ten seeded %s hands",
    (variantId) => {
      const result = runProgressScenario({
        variantId,
        scenarioId: "cash-10-hands-smoke",
        seed: `strict-dramaha-${variantId}`,
        maxSteps: 260,
      });
      expect(result.status).toBe("passed");
      expect(result.strictSettlements).toHaveLength(10);
      expect(result.strictSettlements.every((entry) => entry.status === "ENFORCED" && entry.ok)).toBe(true);
    },
  );

  it("rejects a Dramaha component winner tamper even when the total payout is unchanged", () => {
    const controller = new DramahaGameController({
      variant: "dramaha_badugi",
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 0 } },
      rng: createDeterministicRng("strict-dramaha-tamper"),
    });
    const hand = playPassiveHand(controller);
    const result = structuredClone(hand.afterState.lastHandResult);
    const boardPot = result.potDetails.find((pot) => pot.component === "board");
    const actualWinner = boardPot.winnerSeatIndexes[0];
    const wrongWinner = boardPot.eligibleSeatIndexes.find((seatIndex) => seatIndex !== actualWinner);
    boardPot.winnerSeatIndexes = [wrongWinner];
    boardPot.winners = boardPot.winners.map((winner) => ({ ...winner, seatIndex: wrongWinner }));
    const gate = validateStrictVariantSettlement({ variantId: "H06", ...hand, result });
    expect(gate.ok).toBe(false);
    expect(gate.errors.map((error) => error.code)).toContain("strict_dramaha_component_winner_mismatch");
  });

  it("rejects a Dramaha odd chip assigned to the board half", () => {
    const controller = new DramahaGameController({
      variant: "dramaha_hi",
      tableConfig: { seats: seats().slice(0, 3), blinds: { sb: 5, bb: 10, ante: 1 } },
      rng: createDeterministicRng("strict-dramaha-odd-chip-tamper"),
    });
    const hand = playPassiveHand(controller);
    const result = structuredClone(hand.afterState.lastHandResult);
    const boardPot = result.potDetails.find((pot) => pot.component === "board");
    const drawPot = result.potDetails.find((pot) => pot.component === "draw");
    boardPot.oddChipAmount = 1;
    drawPot.oddChipAmount = 0;
    const gate = validateStrictVariantSettlement({ variantId: "H01", ...hand, result });
    expect(gate.ok).toBe(false);
    expect(gate.errors.map((error) => error.code)).toContain("strict_dramaha_odd_chip_mismatch");
  });

  it("enforces Dramaha main/side-pot eligibility before splitting each pot", () => {
    const controller = new DramahaGameController({
      variant: "dramaha_hi",
      tableConfig: { seats: seats().slice(0, 3), blinds: { sb: 5, bb: 10, ante: 0 } },
    });
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.boardCards = ["2C", "7D", "7H", "9C", "JD"];
    controller.state.players = controller.state.players.map((player, index) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: [
        ["2S", "2D", "AS", "KD", "QC"],
        ["AH", "KH", "QH", "JH", "10H"],
        ["3S", "4D", "5C", "6H", "8S"],
      ][index],
      totalInvested: [50, 100, 200][index],
      stack: 0,
    }));
    controller.state.pot = controller.calculatePot();
    const beforeState = structuredClone(controller.getSnapshot());
    controller.resolveShowdown();
    const afterState = controller.getSnapshot();
    const gate = validateStrictVariantSettlement({ variantId: "H01", beforeState, afterState });
    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
    expect(afterState.lastHandResult.potDetails).toHaveLength(6);

    const result = structuredClone(afterState.lastHandResult);
    result.potDetails[2].eligibleSeatIndexes = [0, 1, 2];
    result.potDetails[3].eligibleSeatIndexes = [0, 1, 2];
    const tampered = validateStrictVariantSettlement({ variantId: "H01", beforeState, afterState, result });
    expect(tampered.ok).toBe(false);
    expect(tampered.errors.map((error) => error.code)).toContain("strict_dramaha_source_pot_mismatch");
  });

  it("recomputes four-player Chinese Poker points for ten seeded hands", () => {
    const result = runProgressScenario({
      variantId: "CP1",
      scenarioId: "cash-10-hands-smoke",
      seed: "strict-chinese-ten-hands",
      maxSteps: 10,
    });
    expect(result.status).toBe("passed");
    expect(result.strictSettlements).toHaveLength(10);
    expect(result.strictSettlements.every((entry) => entry.status === "ENFORCED" && entry.ok)).toBe(true);
  }, 60_000);

  it("rejects Chinese Poker point and matchup tampering", () => {
    const controller = new ChinesePokerController({
      seats: [
        { id: "hero", name: "Hero", isHero: true },
        { id: "cpu-1", name: "CPU 1" },
        { id: "cpu-2", name: "CPU 2" },
        { id: "cpu-3", name: "CPU 3" },
      ],
      random: createDeterministicRng("strict-chinese-tamper"),
    });
    const started = controller.startNewHand();
    controller.autoSetRows(started.players[0].id);
    const afterState = controller.resolveShowdown();
    const result = structuredClone(afterState.results);
    result.matchups[0].royalties += 1;
    result.matchups[0].points += 1;
    result.totals[result.matchups[0].playerA] += 1;
    const gate = validateStrictVariantSettlement({ variantId: "CP1", afterState, result });
    expect(gate.ok).toBe(false);
    expect(gate.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      "strict_chinese_matchups_mismatch",
      "strict_chinese_totals_mismatch",
      "strict_chinese_points_not_zero_sum",
    ]));

    const duplicatePlayerState = structuredClone(afterState);
    duplicatePlayerState.players[1].id = duplicatePlayerState.players[0].id;
    const duplicatePlayerGate = validateStrictVariantSettlement({
      variantId: "CP1",
      afterState: duplicatePlayerState,
      result: afterState.results,
    });
    expect(duplicatePlayerGate.errors.map((error) => error.code)).toContain("strict_chinese_player_ids_invalid");
  }, 60_000);

  it.each([
    "D01", "D02", "D03", "D04", "D05", "D06", "D07",
    "S01", "S02", "S03", "S04", "S05", "S06", "S07",
  ])("enforces evaluator-backed draw settlement for ten seeded %s hands", (variantId) => {
    const result = runProgressScenario({
      variantId,
      scenarioId: "cash-10-hands-smoke",
      seed: `strict-draw-${variantId}`,
      maxSteps: 260,
    });
    expect(result.status).toBe("passed");
    expect(result.strictSettlements).toHaveLength(10);
    expect(result.strictSettlements.every((entry) => entry.status === "ENFORCED" && entry.ok)).toBe(true);
  });

  it("passes strict result, pot, evaluator, and chip conservation for seeded NLH", () => {
    const controller = new NLHGameController({
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 0 } },
      rng: createDeterministicRng("strict-nlh-pilot"),
    });
    const hand = playPassiveHand(controller);
    const gate = validateStrictVariantSettlement({ variantId: "B01", ...hand });
    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
  });

  it("rejects a tampered NLH payout even when totals still add up", () => {
    const controller = new NLHGameController({
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 0 } },
      rng: createDeterministicRng("strict-nlh-tamper"),
    });
    const hand = playPassiveHand(controller);
    const result = structuredClone(hand.afterState.lastHandResult);
    const actualWinner = result.winners[0].seatIndex;
    const wrongWinner = (actualWinner + 1) % seats().length;
    result.winners = result.winners.map((winner) => ({ ...winner, seatIndex: wrongWinner }));
    result.potDetails = result.potDetails.map((pot) => ({
      ...pot,
      winners: pot.winners.map((winner) => ({ ...winner, seatIndex: wrongWinner })),
      winnerSeatIndexes: [wrongWinner],
    }));
    const gate = validateStrictVariantSettlement({ variantId: "B01", ...hand, result });
    expect(gate.ok).toBe(false);
    expect(gate.errors.map((error) => error.code)).toContain("strict_board_high_winner_mismatch");
  });

  it.each([
    ["B02", FLHGameController],
    ["B03", SuperHoldemGameController],
    ["B04", FLSuperHoldemGameController],
    ["B05", PLOGameController],
    ["B06", PLO8GameController],
    ["B07", BigOGameController],
    ["B08", FiveCardPLOGameController],
    ["B09", FLO8GameController],
  ])("enforces strict multi-pot settlement for %s", (variantId, Controller) => {
    const controller = new Controller({
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 0 } },
      rng: createDeterministicRng(`strict-${variantId}`),
    });
    const hand = playPassiveHand(controller);
    const gate = validateStrictVariantSettlement({ variantId, ...hand });
    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
  });

  it.each([
    ["ST1", StudGameController],
    ["ST2", Stud8GameController],
    ["ST3", RazzGameController],
    ["ST4", RazzdugiGameController],
    ["ST5", RazzduceyGameController],
    ["ST6", Razz27GameController],
  ])("enforces replay-safe strict Stud settlement for %s", (variantId, Controller) => {
    const controller = new Controller({
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 1 } },
      rng: createDeterministicRng(`strict-${variantId}`),
    });
    const hand = playPassiveHand(controller);
    const replayedResult = JSON.parse(JSON.stringify(hand.afterState.lastHandResult));
    const gate = validateStrictVariantSettlement({
      variantId,
      beforeState: hand.beforeState,
      afterState: hand.afterState,
      result: replayedResult,
    });
    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
    expect(gate.check.metrics.beforeStackTotal + gate.check.metrics.beforeLivePot).toBe(3000);
    expect(gate.check.metrics.afterStackTotal).toBe(3000);
    expect(replayedResult.potDetails.every((pot) => Array.isArray(pot.eligibleSeatIndexes))).toBe(true);
  });

  it("rejects a tampered Stud winner while preserving payout totals", () => {
    const controller = new StudGameController({
      tableConfig: { seats: seats(), blinds: { sb: 5, bb: 10, ante: 1 } },
      rng: createDeterministicRng("strict-stud-tamper"),
    });
    const hand = playPassiveHand(controller);
    const result = structuredClone(hand.afterState.lastHandResult);
    const actualWinner = result.potDetails[0].winners[0].seatIndex;
    const wrongWinner = result.potDetails[0].eligibleSeatIndexes.find((seat) => seat !== actualWinner);
    result.potDetails[0].winners = result.potDetails[0].winners.map((winner) => ({
      ...winner,
      seatIndex: wrongWinner,
    }));
    result.winners = result.winners.map((winner) => ({ ...winner, seatIndex: wrongWinner }));
    const gate = validateStrictVariantSettlement({ variantId: "ST1", ...hand, result });
    expect(gate.ok).toBe(false);
    expect(gate.errors.map((error) => error.code)).toContain("strict_stud_component_winner_mismatch");
  });

  it("enforces Stud main/side-pot eligibility and exact chip conservation", () => {
    const controller = new StudGameController({
      tableConfig: { seats: seats().slice(0, 3), blinds: { sb: 5, bb: 10, ante: 0 } },
    });
    controller.state = {
      ...controller.state,
      handId: "stud-side-pot-history-1",
      street: "SEVENTH",
      currentActor: null,
      players: [
        {
          ...controller.state.players[0],
          stack: 90,
          totalInvested: 10,
          holeCards: ["AH", "KH", "QH", "JH", "TH", "2C", "3D"],
          folded: false,
          seatOut: false,
        },
        {
          ...controller.state.players[1],
          stack: 80,
          totalInvested: 20,
          holeCards: ["AS", "AD", "AC", "AH", "KD", "2H", "3C"],
          folded: false,
          seatOut: false,
        },
        {
          ...controller.state.players[2],
          stack: 80,
          totalInvested: 20,
          holeCards: ["KS", "KD", "QC", "QD", "9S", "4H", "3C"],
          folded: false,
          seatOut: false,
        },
      ],
    };
    controller.state.pot = controller.calculatePot();
    const beforeState = structuredClone(controller.getSnapshot());
    controller.resolveShowdown();
    const afterState = controller.getSnapshot();
    const gate = validateStrictVariantSettlement({ variantId: "ST1", beforeState, afterState });

    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
    expect(afterState.lastHandResult.potDetails).toMatchObject([
      { amount: 30, eligibleSeatIndexes: [0, 1, 2], winnerSeatIndexes: [0] },
      { amount: 20, eligibleSeatIndexes: [1, 2], winnerSeatIndexes: [1] },
    ]);
    expect(afterState.players.map((player) => player.stack)).toEqual([120, 100, 80]);
    expect(gate.check.metrics.payoutTotal).toBe(50);
    expect(gate.check.metrics.afterStackTotal).toBe(300);
  });

  it.each([
    ["ST1", StudGameController],
    ["ST2", Stud8GameController],
    ["ST3", RazzGameController],
    ["ST4", RazzdugiGameController],
    ["ST5", RazzduceyGameController],
    ["ST6", Razz27GameController],
  ])("enforces multiway all-in side-pot settlement for %s", (variantId, Controller) => {
    const controller = new Controller({
      tableConfig: {
        seats: seats().slice(0, 3).map((seat) => ({ ...seat, stack: 100 })),
        blinds: { sb: 5, bb: 10, ante: 0 },
      },
    });
    controller.startNewHand();
    controller.state = {
      ...controller.state,
      handId: `stud-family-side-pot-${variantId}`,
      street: "SEVENTH",
      currentActor: null,
      players: controller.state.players.map((player, index) => ({
        ...player,
        stack: [90, 80, 70][index],
        totalInvested: [10, 20, 30][index],
        betThisStreet: 0,
        allIn: true,
        folded: false,
        seatOut: false,
        holeCards: [
          ["AS", "KS", "QS", "JS", "TS", "9C", "8D"],
          ["2C", "3D", "4H", "5S", "7C", "9D", "JH"],
          ["2D", "2H", "2S", "3C", "3H", "4D", "6S"],
        ][index],
      })),
    };
    controller.state.pot = controller.calculatePot();
    const beforeState = structuredClone(controller.getSnapshot());

    controller.resolveShowdown();
    const afterState = controller.getSnapshot();
    const gate = validateStrictVariantSettlement({ variantId, beforeState, afterState });

    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
    expect(afterState.lastHandResult.potDetails.map((pot) => pot.amount)).toEqual([30, 20, 10]);
    expect(afterState.lastHandResult.potDetails.map((pot) => pot.eligibleSeatIndexes)).toEqual([
      [0, 1, 2],
      [1, 2],
      [2],
    ]);
    expect(gate.check.metrics.payoutTotal).toBe(60);
    expect(gate.check.metrics.afterStackTotal).toBe(300);
  });

  it("enforces an early uncontested Stud payout before five cards are dealt", () => {
    const controller = new StudGameController({
      tableConfig: { seats: seats().slice(0, 3), blinds: { sb: 5, bb: 10, ante: 0 } },
    });
    controller.state = {
      ...controller.state,
      handId: "stud-uncontested-history-1",
      street: "THIRD",
      currentActor: null,
      players: [
        { ...controller.state.players[0], stack: 90, totalInvested: 10, holeCards: ["AH", "KD", "QC"], folded: false },
        { ...controller.state.players[1], stack: 90, totalInvested: 10, holeCards: ["2H", "3D", "4C"], folded: true },
        { ...controller.state.players[2], stack: 90, totalInvested: 10, holeCards: ["5H", "6D", "7C"], folded: true },
      ],
    };
    controller.state.pot = controller.calculatePot();
    const beforeState = structuredClone(controller.getSnapshot());
    controller.resolveUncontested();
    const afterState = controller.getSnapshot();
    const gate = validateStrictVariantSettlement({ variantId: "ST1", beforeState, afterState });

    expect(gate.ok, JSON.stringify(gate.errors, null, 2)).toBe(true);
    expect(afterState.lastHandResult.potDetails[0]).toMatchObject({
      amount: 30,
      eligibleSeatIndexes: [0],
      winnerSeatIndexes: [0],
    });
    expect(afterState.players.map((player) => player.stack)).toEqual([120, 90, 90]);
  });
});
