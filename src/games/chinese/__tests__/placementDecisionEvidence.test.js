import {describe, expect, it} from 'vitest';
import ChinesePokerController from '../ChinesePokerController.js';
import OpenFaceChineseController, {replayOfcHistory} from '../OpenFaceChineseController.js';
import {replayChinesePokerHistory} from '../chinesePokerHistory.js';

function verify(rows, reason) {
  for (const row of rows) {
    expect(row.inferenceTrace).toMatchObject({tierId:null,phase:'PLACEMENT',status:'not-connected',reason,usedModelId:null});
    expect(row.inferenceTrace.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(Object.keys(row.inferenceTrace)).not.toContain('cards');
  }
}
describe('placement policy evidence', () => {
  it('records only CPU arrangement searches and preserves Chinese replay', () => {
    const c = new ChinesePokerController(); const started = c.startNewHand();
    c.setRows(started.players[0].id, started.players[0].rows); c.resolveShowdown();
    const history = c.getHandHistory();
    expect(history.cpuDecisions).toHaveLength(1);
    verify(history.cpuDecisions, 'arrangement-search');
    expect(replayChinesePokerHistory(history).valid).toBe(true);
    c.nextHand(); expect(c.getHandHistory().cpuDecisions).toHaveLength(1);
  });
  it.each([false,true])('records actual OFC turns, including Fantasyland=%s', fantasy => {
    const c = new OpenFaceChineseController({fantasy:[false,fantasy]}); c.startNewHand();
    while (c.phase === 'placing') {
      if (c.actor === 1) c.playCpuTurns();
      else c.place(0,c.suggestPlacement(0));
    }
    const history = c.history();
    expect(history.cpuDecisions).toHaveLength(fantasy ? 1 : 9);
    verify(history.cpuDecisions,fantasy ? 'fantasy-arrangement-search' : 'placement-heuristic');
    expect(replayOfcHistory(history).valid).toBe(true);
    const legacy = {...history}; delete legacy.cpuDecisions;
    expect(replayOfcHistory(legacy).valid).toBe(true);
    c.startNewHand(); expect(c.cpuDecisions).toEqual([]);
  });
});
