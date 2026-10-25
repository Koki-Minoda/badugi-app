import { describe, expect, it } from 'vitest';
import NLHGameController from '../../games/nlh/NLHGameController.js';
import FLHGameController from '../../games/nlh/FLHGameController.js';
import { PLOGameController } from '../../games/plo/PLOGameController.js';
import { PLO8GameController } from '../../games/plo/PLO8GameController.js';
import { DramahaGameController } from '../../games/dramaha/DramahaGameController.js';
import { StudGameController, RazzGameController } from '../../games/stud/StudGameController.js';
import { buildCpuDecisionTelemetry } from '../qa/cpuDecisionPersistence.js';

describe('non-model controller decision evidence', () => {
 it.each([NLHGameController, FLHGameController, PLOGameController, PLO8GameController, DramahaGameController, StudGameController, RazzGameController])('%s records teacher decisions as not connected, rather than inference failure', Controller => {
  const controller = new Controller({ tableConfig: { seats: Array.from({length:6},(_,seatIndex)=>({seatIndex,name:`CPU ${seatIndex}`,stack:500,isCPU:true})), blinds:{sb:5,bb:10,ante:0} } });
  controller.startNewHand();
  const state = controller.getSnapshot(), seat = state.currentActor;
  const action = controller.getCpuAction(state, seat, {tierConfig:{id:'standard'}});
  expect(action).toBeTruthy();
  const trace = action.metadata.inferenceTrace;
  expect(trace).toMatchObject({tierId:'standard',phase:'BET',status:'not-connected',reason:'teacher-policy',requestedModelId:null,selectedModelId:null,usedModelId:null});
  expect(trace.variantId).toBeTruthy(); expect(trace.elapsedMs).toBeGreaterThanOrEqual(0);
  const stored = buildCpuDecisionTelemetry({variantId:trace.variantId,phase:'BET',actorSeat:seat,explicitIsCpu:true,metadata:action.metadata});
  expect(stored.cpuDecision.inferenceTrace).toEqual(trace);
 });
});
