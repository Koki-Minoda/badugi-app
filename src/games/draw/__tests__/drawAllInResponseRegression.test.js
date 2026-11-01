import { expect, it } from 'vitest';
import { AceToFiveSingleDrawEngine } from '../AceToFiveSingleDrawEngine.js';
import { AceToFiveTripleDrawEngine } from '../AceToFiveTripleDrawEngine.js';
import { DeuceToSevenSingleDrawEngine } from '../DeuceToSevenSingleDrawEngine.js';
import { DeuceToSevenTripleDrawEngine } from '../DeuceToSevenTripleDrawEngine.js';

const variants = [
  ['D01', DeuceToSevenTripleDrawEngine],
  ['D02', AceToFiveTripleDrawEngine],
  ['S01', DeuceToSevenSingleDrawEngine],
  ['S02', AceToFiveSingleDrawEngine],
];

function opening(EngineClass) {
  const engine = new EngineClass();
  const state = engine.applyForcedBets(engine.initHand({
    seatConfig: ['HUMAN', 'CPU'],
    startingStack: 4,
    dealerIndex: 0,
    structure: { sb: 1, bb: 2 },
  }));
  return { engine, state };
}

it.each(variants)('%s gives the remaining player a response to a heads-up all-in raise', (_id, EngineClass) => {
  const { engine, state } = opening(EngineClass);
  const raised = engine.applyPlayerAction(state, {
    seatIndex: 0, type: 'RAISE', amount: state.players[0].stack,
  });

  expect(raised.street).toBe('BET');
  expect(raised.actingPlayerIndex).toBe(1);
  expect(raised.players.map(player => player.bet)).toEqual([4, 2]);
  expect(raised.players[1].stack).toBe(2);

  const called = engine.applyPlayerAction(raised, { seatIndex: 1, type: 'CALL' });
  expect(called.street).toBe('DRAW');
  expect(called.players.map(player => player.stack)).toEqual([0, 0]);
  expect(called.pots.map(pot => pot.amount)).toEqual([8]);
});

it.each(variants)('%s pays only committed chips when the remaining player folds', (_id, EngineClass) => {
  const { engine, state } = opening(EngineClass);
  const raised = engine.applyPlayerAction(state, {
    seatIndex: 0, type: 'RAISE', amount: state.players[0].stack,
  });
  const folded = engine.applyPlayerAction(raised, { seatIndex: 1, type: 'FOLD' });
  expect(folded.isHandOver).toBe(true);
  expect(folded.players.map(player => player.stack)).toEqual([6, 2]);
  expect(folded.metadata.showdownTotal).toBe(6);
});

it('keeps the remaining S01 caller active after another opponent folds to an all-in', () => {
  const engine = new DeuceToSevenSingleDrawEngine();
  const state = engine.applyForcedBets(engine.initHand({
    seatConfig: ['HUMAN', 'CPU', 'CPU'],
    startingStack: 4,
    dealerIndex: 0,
    structure: { sb: 1, bb: 2 },
  }));
  expect(state.actingPlayerIndex).toBe(0);

  const raised = engine.applyPlayerAction(state, { seatIndex: 0, type: 'RAISE', amount: 4 });
  const folded = engine.applyPlayerAction(raised, { seatIndex: 1, type: 'FOLD' });
  expect(folded.street).toBe('BET');
  expect(folded.actingPlayerIndex).toBe(2);

  const called = engine.applyPlayerAction(folded, { seatIndex: 2, type: 'CALL' });
  expect(called.street).toBe('DRAW');
  expect(called.players[2].stack).toBe(0);
});
