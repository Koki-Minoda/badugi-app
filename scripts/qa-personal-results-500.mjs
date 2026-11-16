// Bundle with esbuild for Node, then pass a new output JSON filename.
import { writeFileSync } from "node:fs";
import { BadugiGameController } from "../src/games/badugi/controller/BadugiGameController.js";
import { DeckManager } from "../src/games/badugi/utils/deck.js";
import { compareBadugiEvaluations, evaluateBadugi } from "../src/games/badugi/utils/badugiEvaluator.js";
import { bestBadugiKeep, getPersonalResults } from "../src/ui/personalResults/handProgress.js";

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const output = process.argv[2];
if (!output) throw new Error("Pass an output filename.");
const seed = 20261116;
const choose = seededRandom(seed + 1);
const hands = [];
const seatConfig = ["CPU", "CPU"];
const startingStack = 5000;
const blindStructure = [{ sb: 10, bb: 20, ante: 0, hands: 999 }];
for (let block = 0; block < 10; block += 1) {
  const controller = new BadugiGameController({ seatConfig, startingStack, blindStructure });
  let state = controller.createInitialState({ seatConfig });
  for (let index = 0; index < 50; index += 1) {
    const number = block * 50 + index + 1;
    const deck = new DeckManager({ rng: seededRandom(seed + number * 1009) });
    state = controller.createNewHandState(state, { drawCardsForSeat: () => deck.draw(4) });
    const actions = [];
    for (let step = 0; !controller.isHandFinished(state); step += 1) {
      if (step === 80) throw new Error(`Hand ${number} did not complete.`);
      const snapshot = controller.getUiSnapshot(state);
      const seatIndex = snapshot.turn ?? snapshot.nextTurn;
      if (!Number.isInteger(seatIndex)) throw new Error(`Hand ${number} has no active seat.`);
      const legal = controller.getLegalActions(state, seatIndex).map((action) => action.type.toLowerCase());
      let payload;
      if (snapshot.phase === "DRAW") {
        const before = snapshot.players[seatIndex].hand;
        const target = bestBadugiKeep(before, 3);
        const bestDiscard = before.findIndex((_, i) =>
          compareBadugiEvaluations(evaluateBadugi(before.filter((_, j) => i !== j)), target) === 0);
        // Seat 0 follows the reference choice progressively more often. The
        // opponent always follows it. No policy learns from these outcomes.
        const discard = seatIndex !== 0 || choose() < block / 9
          ? bestDiscard
          : Math.floor(choose() * 4);
        const oldCard = before[discard];
        const newCard = deck.draw(1, { activeCards: snapshot.players.flatMap((player) => player.hand) })[0];
        if (!newCard) throw new Error(`Hand ${number} exhausted the deck.`);
        deck.discard([oldCard]);
        const handAfter = before.map((card, i) => i === discard ? newCard : card);
        payload = { type: "draw", drawIndexes: [discard], drawCount: 1, handAfter,
          replacedCards: [{ index: discard, oldCard, newCard }] };
        if (seatIndex === 0) actions.push({
          seq: step + 1, type: "draw", metadata: { drawRound: snapshot.drawRound + 1,
            drawInfo: { before: [...before], drawIndexes: [discard] } },
        });
      } else {
        const type = ["check", "call"].find((action) => legal.includes(action));
        if (!type) throw new Error(`Hand ${number} has no passive betting action.`);
        payload = { type };
      }
      const result = controller.applyAction(state, { seatIndex, payload });
      if (!result?.state || result.events?.some((event) => ["invalidAction", "error"].includes(event.type))) {
        throw new Error(`Hand ${number} rejected ${payload.type}.`);
      }
      state = result.state;
    }
    const final = controller.getUiSnapshot(state);
    if (final.players.reduce((sum, player) => sum + player.stack, 0) !== startingStack * 2) {
      throw new Error(`Hand ${number} did not conserve chips.`);
    }
    hands.push({
      handId: `results-qa-${number}`, handCount: number, variantId: "badugi",
      variantName: "Badugi", endedAt: number, historySource: "cash",
      seats: [{ seat: 0, isHero: true, actions }],
      events: [{ type: "HAND_END" }],
    });
  }
}
const [game] = getPersonalResults(hands);
if (game.hands !== 500 || game.timeline.length !== 10 || game.timeline.some((block) => block.samples !== 150)) {
  throw new Error("Expected 500 hands and 150 measured draw choices per block.");
}
const report = {
  seed, handsCompleted: game.hands, measuredDecisions: game.timeline.reduce((sum, window) => sum + window.samples, 0),
  policy: "Scheduled reference-choice probability from 0/9 to 9/9; no learning",
  timeline: game.timeline, finalAxes: game.axes, hands,
};
writeFileSync(output, JSON.stringify(report), { flag: "wx" });
console.log(JSON.stringify({ ...report, hands: undefined }, null, 2));
