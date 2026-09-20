import { describe, it, expect } from 'vitest';
import { PRACTICE_GAMES, PracticeSession, validatePracticeSetup } from '../practiceSession.js';

describe.each(PRACTICE_GAMES)('$name practice', game => {
  it('deals the requested hand, completes three draws with real actions, and preserves all cards and chips', () => {
    const session = new PracticeSession(game.id, game.defaults);
    expect(session.snapshot.players[0].hand).toEqual(game.defaults);
    for (let i = 0; i < 250 && !session.finished; i++) {
      const legal = session.legalActions();
      const action = legal.find(a => a.type === 'DRAW') ?? legal.find(a => a.type === 'CHECK') ?? legal.find(a => a.type === 'CALL');
      expect(action).toBeTruthy();
      session.act(session.actor, { type: action.type, discardIndexes: action.type === 'DRAW' ? [0, 1] : [] });
    }
    expect(session.finished).toBe(true);
    expect(session.snapshot.players.reduce((sum, player) => sum + player.stack, 0)).toBe(12000);
    expect(session.record().mode).toBe('practice');
    expect(session.record().seats.map(seat => seat.name)).toEqual(['You', 'CPU 1', 'CPU 2', 'CPU 3', 'CPU 4', 'CPU 5']);
    for (const winner of session.record().events.find(event => event.type === 'HAND_END').winners) {
      expect(winner.name).toBe(session.record().seats[winner.seat].name);
    }
    expect(session.record().events.filter(event => event.type === 'BET_ACTION').reduce((sum, event) => sum + event.amount, 30)).toBe(session.record().pot);
    expect(session.record().events.filter(event => event.type === 'DRAW_ACTION')).toHaveLength(18);
    const again = new PracticeSession(game.id, game.defaults);
    expect(again.snapshot.players[0].hand).toEqual(game.defaults);
    expect(again.handId).not.toBe(session.handId);
  });
  it('plays CPU actions to completion and rejects stale or off-turn actions', () => {
    const session = new PracticeSession(game.id, game.defaults);
    expect(session.act(0, { type: 'FOLD' })).toBe(false);
    for (let i = 0; i < 250 && !session.finished; i++) {
      if (session.actor !== 0) session.cpuAction();
      else {
        const action = session.legalActions().find(a => ['CHECK', 'CALL', 'DRAW'].includes(a.type));
        const revision = session.revision;
        session.act(0, { type: action.type, discardIndexes: [] }, revision);
        expect(session.act(session.actor, { type: 'FOLD' }, revision)).toBe(false);
      }
    }
    expect(session.finished).toBe(true);
    expect(session.snapshot.players.reduce((sum, player) => sum + player.stack, 0)).toBe(12000);
  });
});
it('rejects duplicate, incomplete, invalid and unsupported setup', () => {
  expect(validatePracticeSetup('badugi', ['AS', 'AS', '2H', '3C'])).toBe(false);
  expect(validatePracticeSetup('badugi', ['AS'])).toBe(false);
  expect(validatePracticeSetup('badugi', ['AS', '2H', '3C', 'XX'])).toBe(false);
  expect(() => new PracticeSession('nlh', ['AS', 'KH'])).toThrow();
});
it.each(PRACTICE_GAMES)('$name survives full-hand draws and rejects invalid discards before changing the deck', game => {
  const session = new PracticeSession(game.id, game.defaults);
  let validated = false;
  for (let i = 0; i < 250 && !session.finished; i++) {
    const legal = session.legalActions();
    const action = legal.find(a => a.type === 'DRAW') ?? legal.find(a => a.type === 'CHECK') ?? legal.find(a => a.type === 'CALL');
    if (action.type === 'DRAW' && !validated) {
      const before = JSON.stringify({ snapshot: session.snapshot, deck: session.deck.deck });
      expect(() => session.act(session.actor, { type: 'DRAW', discardIndexes: [0, 0] })).toThrow();
      expect(JSON.stringify({ snapshot: session.snapshot, deck: session.deck.deck })).toBe(before);
      validated = true;
    }
    session.act(session.actor, { type: action.type, discardIndexes: action.type === 'DRAW' ? Array.from({ length: game.count }, (_, index) => index) : [] });
  }
  expect(validated).toBe(true);
  expect(session.finished).toBe(true);
  expect(session.snapshot.players.reduce((sum, player) => sum + player.stack, 0)).toBe(12000);
});
it('does not write game statistics or hand history during practice', () => {
  localStorage.setItem('badugi.history.hands', '[]');
  localStorage.setItem('practice-test-stats', '{"rating":1700}');
  const before = JSON.stringify({ ...localStorage });
  const session = new PracticeSession('badugi', PRACTICE_GAMES[0].defaults);
  for (let i = 0; i < 20 && !session.finished; i++) session.act(session.actor, { type: 'FOLD' });
  expect(session.finished).toBe(true);
  expect(JSON.stringify({ ...localStorage })).toBe(before);
  localStorage.clear();
});

it.each(PRACTICE_GAMES)('$name all-seat undo restores cards, bets, actor and replayable draw randomness', game => {
  const session = new PracticeSession(game.id, game.defaults, { selfPlay: true });
  for (let i = 0; i < 100 && !session.finished; i++) {
    const before = JSON.stringify(session.snapshot);
    const actor = session.actor;
    const revision = session.revision;
    const action = session.legalActions().find(a => ['CHECK','CALL','DRAW'].includes(a.type));
    session.act(actor, { type: action.type, discardIndexes: action.type === 'DRAW' ? [0] : [] });
    if (session.finished) break;
    const after = JSON.stringify(session.snapshot);
    expect(session.undo()).toBe(true);
    expect(JSON.stringify(session.snapshot)).toBe(before);
    expect(session.act(actor, { type:action.type }, revision)).toBe(false);
    session.act(actor, { type:action.type, discardIndexes: action.type === 'DRAW' ? [0] : [] });
    expect(JSON.stringify(session.snapshot)).toBe(after);
  }
  expect(session.finished).toBe(true);
  expect(session.undo()).toBe(false);
});
it.each(PRACTICE_GAMES)('$name never-fold CPU completes all three draws', game => {
  const session = new PracticeSession(game.id, game.defaults, { neverFold:true });
  for (let i = 0; i < 300 && !session.finished; i++) {
    if (session.actor !== 0) session.cpuAction();
    else session.act(0, { type: session.legalActions().find(a => ['CHECK','CALL','DRAW'].includes(a.type)).type, discardIndexes:[] });
  }
  expect(session.finished).toBe(true);
  expect(session.events.some(e => e.action === 'fold')).toBe(false);
  expect(session.snapshot.players.reduce((sum,p) => sum+p.stack,0)).toBe(12000);
});
